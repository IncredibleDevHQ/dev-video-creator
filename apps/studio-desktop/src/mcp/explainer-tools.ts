import { validateBoundary, type ActorBoundary } from '../../../studio-v2/src/continuity'
import { validateQualityReview, type QualityReview } from './quality-checkpoint'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { basename, join, resolve, relative, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { runAtomizer, captureHiddenPage } from './hidden-window'
import type { ProjectDocumentV1, MotionPlanV2 } from 'markdown-composition'
import { createDefaultBlockConfig, motionPlanOffsetsMs } from 'markdown-composition'
import { stageTrackFromShots, type DirectedShot } from '../../../studio-v2/src/shot-plan'
import type { SceneProgram } from '../../../studio-v2/src/scene-program'
import { splitCue } from '../../../studio-v2/src/scene-program'
import { sceneRevisionPayload, sceneRenderedExtras } from '../../../studio-v2/src/scene-revision'
import { portableUrl } from '../../../studio-v2/src/studio-refs'
import type { LibraryArtwork } from '../../../studio-v2/server/appearance-library'

type Args = Record<string, unknown>
type Context = { origin: string }
type Proof = { boundaryState?: ActorBoundary[]; renderHash?: string; renderManifest?: { renderer: string; fonts?: unknown; project: ProjectDocumentV1 }; directorAuto?: unknown; stageTrack?: unknown[]; hash: string; errors: string[]; warnings: string[]; frames: Array<{ atMs: number; path: string }>; program: SceneProgram; plan: MotionPlanV2; windows: unknown[]; durationMs: number }
// Canonical key order everywhere: the notebook store (PG jsonb) reorders
// object keys, and run-dir files cross it at finish/export time. Hashing or
// comparing raw JSON text would report false mismatches after a round-trip.
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : v))
const digest = (svg: string, program: unknown) => createHash('sha256').update(svg).update(stableStringify(program)).digest('hex')
// One complete scene revision (§3.9): artwork, words, program, compiled
// motion, staging and layout intent as a single canonical digest. The field
// set is the shared scene-revision contract, so the build dispatch, the
// finish conflict check and the status tool all hash the same revision.
const revisionDigest = (attrs: Record<string, unknown> | undefined, extras: Record<string, unknown> = {}) => digest(String(attrs?.svg || ''), sceneRevisionPayload(attrs, extras))

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Balanced-tag subtree extraction over raw SVG text — the same approach the
// server's cast verification uses: from the opening tag that matches to its
// balanced close. The tool side has no DOM; the run's SVG is written
// machine-side, so tag scanning is exact for it. Nested same-tag elements
// balance; a nested match is covered by its outer subtree.
const subtreesWhere = (svg: string, match: (openingTag: string) => boolean): string[] => {
  const out: string[] = []
  const tagRe = /<([a-zA-Z][\w:-]*)(?:\s[^>]*)?\/?>/g
  for (let token; (token = tagRe.exec(svg));) {
    if (token[0].endsWith('/>') || !match(token[0])) continue
    const inner = new RegExp(`<${token[1]}\\b[^>]*>|</${token[1]}>`, 'g')
    inner.lastIndex = token.index
    let depth = 0
    let end = svg.length
    for (let part; (part = inner.exec(svg));) {
      if (part[0].startsWith('</')) {
        depth -= 1
        if (depth === 0) { end = inner.lastIndex; break }
      } else if (!part[0].endsWith('/>')) {
        depth += 1
      }
    }
    out.push(svg.slice(token.index, end))
    tagRe.lastIndex = end
  }
  return out
}
// The exact embedded performance of a library object inside a scene: the
// clip subtrees carried by the element marked data-appearance-key. Editing a
// clip — or embedding another revision — changes this set (issue #15).
const embeddedClipMarkups = (sceneSvg: string, key: string): string[] =>
  subtreesWhere(sceneSvg, tag => new RegExp(`\\bdata-appearance-key="${escapeRegExp(key)}"`).test(tag))
    .flatMap(markup => subtreesWhere(markup, tag => /\bdata-object-clip\b/.test(tag)))
const clipIdOf = (markup: string) => /\bid="([^"]+)"/.exec(markup.slice(0, markup.indexOf('>') + 1))?.[1] || ''
const embeddedPerformance = (sceneSvg: string, key: string) => {
  const markups = embeddedClipMarkups(sceneSvg, key)
  return { hash: markups.length ? createHash('sha256').update(markups.join('\n')).digest('hex') : '', clips: [...new Set(markups.map(clipIdOf))] }
}
const jsonFile = async (path: string) => JSON.parse(await readFile(path, 'utf8'))
const save = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2))
const execute = promisify(execFile)
const local = (dir: string, file: string) => {
  const path = resolve(dir, file)
  const rel = relative(resolve(dir), path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Artifact paths must stay inside the run directory')
  return path
}
const call = async <T>(context: Context, path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> => {
  const response = await fetch(`${context.origin}${path}`, { method, headers: { 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Studio answered ${response.status}`)
  return result as T
}
const paths = (args: Args) => {
  const projectDir = String(args.projectDir || '')
  if (!isAbsolute(projectDir)) throw new Error('projectDir must be absolute')
  const scene = String(args.scene || '')
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(scene)) throw new Error('scene is a file stem, such as 01-bucket')
  return { projectDir, scene, folder: join(projectDir, 'explainer'), svgPath: local(projectDir, `explainer/${scene}.svg`), programPath: local(projectDir, `explainer/${scene}.program.json`) }
}

// Stage checkpoints (D3): when this run lives in a runs/ directory, each
// tool records its typed outcome against the durable run row — the stage
// history survives the agent and the app. The states are the plan's:
// a human branch may durably wait for a recording (needs-input).
// Per-scene and per-object stages key their checkpoint on that subject, so
// one scene's waiting state is never overwritten by another scene's progress.
const STAGE_STATES = ['pending', 'running', 'succeeded', 'needs-input', 'failed', 'cancelled', 'stale'] as const
const recordStage = async (context: Context, projectDir: string, stage: string, status: (typeof STAGE_STATES)[number], detail?: unknown, subject?: string) => {
  const runId = basename(projectDir)
  if (!/^run-/.test(runId)) return
  try {
    await call(context, `/api/runs/${encodeURIComponent(runId)}/stages`, { stage, ...(subject ? { subject } : {}), status, detail })
  } catch {
    // The run dir remains the working record; the durable row is best-effort.
  }
}

const assetTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir || '')
  if (!isAbsolute(projectDir)) throw new Error('projectDir must be absolute')
  const inputs = await jsonFile(join(projectDir, 'motion', 'inputs.json'))
  if (args.operation === 'list') {
    const { assets } = await call<{ assets: LibraryArtwork[] }>(context, '/api/appearance/library')
    const folder = join(projectDir, 'explainer', 'assets')
    await mkdir(folder, { recursive: true })
    for (const asset of assets) {
      await writeFile(join(folder, `${asset.key}.svg`), asset.svg)
      await save(join(folder, `${asset.key}.json`), asset)
    }
    return { assets: assets.map(a => ({ key: a.key, entity: a.entity, brief: a.brief, operation: a.operation, svgPath: join(folder, `${a.key}.svg`) })) }
  }
  const operation = args.operation === 'edit' || args.operation === 'animate' ? args.operation : 'generate'
  const brief = typeof args.briefPath === 'string' ? await jsonFile(local(projectDir, args.briefPath)) : args.brief
  const { appearance, reused } = await call<{ appearance: LibraryArtwork; reused: boolean }>(context, `/api/appearance/${operation}`, {
    brief, key: args.key, prompt: args.prompt, projectId: inputs.projectId,
  })
  const folder = join(projectDir, 'explainer', 'assets')
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, `${appearance.key}.svg`), appearance.svg)
  await save(join(folder, `${appearance.key}.json`), { ...appearance, reused })
  return { key: appearance.key, reused, svgPath: join(folder, `${appearance.key}.svg`), metadataPath: join(folder, `${appearance.key}.json`), parts: appearance.parts, viewBox: appearance.viewBox, operation }
}

// The hidden renderer is shared, so keep each review and its captures together.
let reviewQueue: Promise<unknown> = Promise.resolve()
// §5.5: previews cost a render each; a scene's revision loop is bounded.
// Direct tool calls count; the narration and take tools' own recompiles do
// not (chargeBudget = false) — but their passing revisions still snapshot.
const REVIEW_BUDGET = Math.max(1, Number(process.env.STUDIO_REVIEW_BUDGET || 8))
const previewTool = (args: Args, context?: Context, chargeBudget = true) => {
  const work = reviewQueue.catch(() => {}).then(async () => {
    const p = paths(args)
    if (context && chargeBudget) {
      const countsPath = join(p.folder, 'review-counts.json')
      const counts = await jsonFile(countsPath).catch(() => ({} as Record<string, number>))
      const spent = Number(counts[p.scene] || 0)
      if (spent >= REVIEW_BUDGET) {
        // Over budget: the best retained proof answers, and the agent must
        // report the exact remaining issue instead of revising forever.
        const best = await jsonFile(join(p.folder, `${p.scene}.best-proof.json`)).catch(() => jsonFile(join(p.folder, `${p.scene}.proof.json`)).catch(() => null))
        return {
          errors: [`The review budget for ${p.scene} is spent (${REVIEW_BUDGET} previews). Do not revise further: run explainer_restore to put the retained passing revision back (its artwork, program, timing and frames), then finish with it if it passes — or stop and report the exact remaining issue.`],
          warnings: [] as string[],
          durationMs: best?.durationMs || 0,
          frames: best?.frames || [],
          proofPath: join(p.folder, `${p.scene}.proof.json`),
          instruction: 'Review budget spent — restore the retained passing revision with explainer_restore, or report the remaining issue instead of revising.',
        }
      }
      counts[p.scene] = spent + 1
      await save(countsPath, counts)
    }
    const svg = await readFile(p.svgPath, 'utf8')
    const program = await jsonFile(p.programPath)
    if (program.scheduling === 2) {
      const reference = await jsonFile(join(p.folder, 'reference-scene.json')).catch(() => null)
      if (!reference) await save(join(p.folder, 'reference-scene.json'), { scene: p.scene })
      else if (reference.scene !== p.scene) {
        const accepted = await jsonFile(join(p.folder, 'reference-accepted.json')).catch(() => null)
        const referenceProof = await jsonFile(join(p.folder, `${reference.scene}.proof.json`)).catch(() => null)
        if (!accepted || accepted.scene !== reference.scene || accepted.hash !== (referenceProof?.renderHash || referenceProof?.hash)) throw new Error('Accept the representative mechanism and its short export before expanding other scenes')
      }
    }
    const runInputs = await jsonFile(join(p.projectDir, 'motion', 'inputs.json')).catch(() => null)
    const sourceProject = context && runInputs?.projectId ? (await call<{ project: ProjectDocumentV1 }>(context, `/api/projects/${encodeURIComponent(runInputs.projectId)}`)).project : undefined
    const story = await jsonFile(join(p.folder, 'story.json')).catch(() => null)
    const sceneId = story?.scenes?.find((scene: { file: string }) => scene.file === p.scene)?.id
    const fonts = context && sourceProject ? await call(context, '/api/review-fonts', sourceProject) : undefined
    const gsapSource = await readFile(createRequire(resolve('package.json')).resolve('gsap/dist/gsap.min.js'), 'utf8')
    let result = await runAtomizer<Omit<Proof, 'hash' | 'frames'> & { frames: number[] }>('reviewExplainer', svg, program, { gsapSource, fonts, project: sourceProject, sceneId })
    if (result.renderManifest?.project) {
      const candidate = result.renderManifest.project
      const narration = await jsonFile(join(p.folder, `${p.scene}.narration.json`)).catch(() => null)
      if (narration?.hash === digest(svg, program) && narration.audioUrl) {
        candidate.presenterTracks['review-scene'] = [{ kind: 'narration', audioUrl: narration.audioUrl, audioKind: narration.alignment === 'selected-take' ? 'recorded-mic' : 'generated', ...(narration.recordingId ? { recordingId: narration.recordingId } : {}) }]
      }
      const sceneIndex = Math.max(0, story?.scenes?.findIndex((scene: { file: string }) => scene.file === p.scene) ?? 0)
      const directed = await runAtomizer<{ storyboard?: unknown; shots?: DirectedShot[]; recordingBrief?: unknown }>('direct', svg, { windows: result.windows, title: story?.scenes?.[sceneIndex]?.title || p.scene, position: { index: sceneIndex, count: story?.scenes?.length || 1 } })
      const stageTrack = directed?.shots?.length ? stageTrackFromShots(directed.shots, motionPlanOffsetsMs(result.plan).offsets, result.plan.steps.map(step => step.motionWindowMs + step.holdMs)) : []
      const directorAuto = { storyboard: directed?.storyboard, shots: directed?.shots, recordingBrief: directed?.recordingBrief }
      candidate.notebook.content[0].attrs = { ...candidate.notebook.content[0].attrs, stageTrack, directorAuto, stagePlacements: null }
      result = await runAtomizer<Omit<Proof, 'hash' | 'frames'> & { frames: number[] }>('reviewExplainer', svg, program, { gsapSource, fonts, project: candidate, sceneId: 'review-scene' })
      result.stageTrack = stageTrack
      result.directorAuto = directorAuto
    }
    const hash = digest(svg, program)
    // Each revision's frames live under their own content address (issue #16):
    // a later failed revision can never overwrite the retained best's frames.
    const renderHash = result.renderManifest ? digest(svg, { program, manifest: result.renderManifest }) : hash
    const revision = renderHash.slice(0, 12)
    const folder = join(p.folder, 'review', p.scene, revision)
    await mkdir(folder, { recursive: true })
    const frames: Proof['frames'] = []
    if (result.frames?.length) {
      for (const atMs of result.frames) {
        await runAtomizer('explainerFrame', atMs)
        const path = join(folder, `${String(atMs).padStart(7, '0')}.png`)
        await writeFile(path, await captureHiddenPage())
        frames.push({ atMs, path })
      }
    }
    const proof = { ...result, frames, hash, renderHash }
    await save(join(p.folder, `${p.scene}.proof.json`), proof)
    // The best retained candidate survives later failed revisions (§5.5): an
    // immutable snapshot of artwork, program and proof that explainer_restore
    // can put back exactly (issue #16).
    if (context && !result.errors.length) {
      // Structural validity retains a candidate; only an explicit quality
      // decision may replace an existing best candidate.
      const existingBest = await jsonFile(join(p.folder, `${p.scene}.best-proof.json`)).catch(() => null)
      if (!existingBest) await save(join(p.folder, `${p.scene}.best-proof.json`), proof)
      const candidate = join(p.folder, 'candidates', p.scene, revision)
      await mkdir(candidate, { recursive: true })
      await writeFile(join(candidate, `${p.scene}.svg`), svg)
      await save(join(candidate, `${p.scene}.program.json`), program)
      await save(join(candidate, 'proof.json'), proof)
    }
    if (context) {
      await recordStage(context, p.projectDir, 'preview', result.errors.length ? 'failed' : 'succeeded', { scene: p.scene, errors: result.errors, warnings: result.warnings, durationMs: result.durationMs }, p.scene)
    }
    return { errors: result.errors, warnings: result.warnings, durationMs: result.durationMs, frames, hash: proof.renderHash || proof.hash, proofPath: join(p.folder, `${p.scene}.proof.json`), instruction: 'Open the frame files and inspect the actual artwork, state changes, readability and motion. A schema pass is not visual approval.' }
  })
  reviewQueue = work
  return work
}

// §5.5 recovery (issue #16): every passing preview snapshots the candidate —
// artwork, program, timing and frames — under its content hash, so the
// retained best revision is recoverable after later failed revisions.
// Restoring puts it back as the working revision with its original frames,
// ready to narrate (if it predates them) and finish.
const restoreTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const requested = String(args.hash || '').trim()
  const best = await jsonFile(join(p.folder, `${p.scene}.best-proof.json`)).catch(() => null) as Proof | null
  const hash = requested || String(best?.renderHash || best?.hash || '')
  if (!hash) throw new Error(`No retained passing candidate for ${p.scene} — preview a passing revision first`)
  const candidate = join(p.folder, 'candidates', p.scene, hash.slice(0, 12))
  const proof = await jsonFile(join(candidate, 'proof.json')).catch(() => null) as Proof | null
  if (!proof || (proof.renderHash || proof.hash) !== hash) throw new Error(`No retained candidate ${hash.slice(0, 12)} for ${p.scene}`)
  if (proof.errors?.length) throw new Error(`The retained candidate for ${p.scene} has review errors; it was never a passing revision`)
  const svg = await readFile(join(candidate, `${p.scene}.svg`), 'utf8')
  const program = await jsonFile(join(candidate, `${p.scene}.program.json`))
  if (proof.hash !== digest(svg, program)) throw new Error(`The retained candidate for ${p.scene} is corrupt — its proof no longer matches its files`)
  // The candidate's frames must still be the ones its review captured.
  for (const frame of proof.frames || []) await readFile(frame.path)
  await writeFile(p.svgPath, svg)
  await save(p.programPath, program)
  await save(join(p.folder, `${p.scene}.proof.json`), proof)
  const narration = await jsonFile(join(p.folder, `${p.scene}.narration.json`)).catch(() => null) as { hash?: string } | null
  const staleNarration = Boolean(narration?.hash && narration.hash !== proof.hash)
  await recordStage(context, p.projectDir, 'restore', 'succeeded', { scene: p.scene, hash }, p.scene)
  return {
    scene: p.scene,
    hash,
    durationMs: proof.durationMs,
    frames: proof.frames,
    warnings: staleNarration ? ['The narration predates the restored revision — narrate again before finishing'] : [],
    instruction: staleNarration
      ? 'The retained passing revision is back as the working copy with its original frames. Its narration predates it — run explainer_narrate (or explainer_align_take) again, then finish.'
      : 'The retained passing revision is back as the working copy with its original frames. Narration still matches — finish when ready.',
  }
}

const narrateTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const inputs = await jsonFile(join(p.projectDir, 'motion', 'inputs.json'))
  // The human path never synthesizes a presenter's voice (§3.7/§5.5): its
  // narration comes from the selected take via explainer_align_take. Refuse
  // here, and leave the run durably waiting for a person — never failed, and
  // never silently substituted.
  if (inputs.delivery?.mode === 'human') {
    await recordStage(context, p.projectDir, 'narrate', 'needs-input', { scene: p.scene, reason: 'The human path narrates from the recorded take; none is aligned in this run yet. Record or select the take in the app, then run explainer_align_take.' }, p.scene)
    throw new Error(`Scene ${p.scene} is on the human delivery path: narration comes from the creator's recorded take. Record or select the take in the app and call explainer_align_take with its audio — generated speech is never a silent substitute.`)
  }
  const program = await jsonFile(p.programPath) as SceneProgram
  const audioDir = join(p.folder, 'audio', p.scene)
  await mkdir(audioDir, { recursive: true })
  const beats: Array<{ say: string; path: string; durationMs: number; words?: SceneProgram['beats'][number]['words']; coverage?: number }> = []
  for (const beat of program.beats) {
    const name = createHash('sha256').update(JSON.stringify([beat.say, inputs.voiceReferenceId || 'default'])).digest('hex').slice(0, 16)
    const path = join(audioDir, `${name}.mp3`)
    try { await readFile(path) } catch {
      const voice = await call<{ url: string }>(context, '/api/voice', { text: beat.say, projectId: inputs.projectId, referenceId: inputs.voiceReferenceId })
      // Named by its path on the app's own origin (F01 of the fix verification).
      const audio = await fetch(new URL(portableUrl(voice.url), context.origin))
      if (!audio.ok) throw new Error('Could not read the generated voice')
      await writeFile(path, Buffer.from(await audio.arrayBuffer()))
    }
    const probe = await execute('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
    const durationMs = Math.ceil(Number(probe.stdout.trim()) * 1000)
    if (!(durationMs > 0)) throw new Error('The narration has no measurable duration')
    beats.push({ say: beat.say, path, durationMs })
  }
  const manifest = join(audioDir, 'alignment.json')
  await save(manifest, { beats })
  const aligner = fileURLToPath(new URL('../skills/explainer-master/scripts/align_words.py', import.meta.url))
  try {
    await execute('uv', ['run', '--with', 'faster-whisper==1.2.0', '--with', 'requests==2.32.5', 'python', aligner, manifest], { timeout: 600_000, maxBuffer: 2 * 1024 * 1024 })
  } catch (error) {
    throw new Error(`Local narration alignment failed. Install uv and allow its cached faster-whisper runtime/model download, then retry. ${String((error as Error).message).slice(0, 250)}`)
  }
  const aligned = await jsonFile(join(audioDir, 'alignment.aligned.json')) as { beats: typeof beats }
  const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  program.beats.forEach((beat, index) => {
    const alignment = aligned.beats[index]
    if (!alignment || (alignment.coverage || 0) < 0.75) throw new Error(`Could not reliably align beat ${index + 1}; revise its narration or voice before retrying`)
    for (const event of [beat, ...(beat.then || [])].flatMap(b => b.events || [])) {
      if (event.cue) {
        // Occurrence identity (D5): "retry#2" needs a second aligned "retry".
        const { word, occurrence } = splitCue(event.cue)
        const occurrences = (alignment.words || []).filter(w => normalize(w.word) === normalize(word))
        if (occurrences.length < occurrence) throw new Error(`Beat ${index + 1}: cue "${event.cue}" needs ${occurrence > 1 ? `occurrence ${occurrence} of ` : ''}"${word}" in the take; the alignment captured ${occurrences.length}. Use a spoken word from alignment.aligned.json`)
      }
    }
    beat.durationMs = alignment.durationMs
    beat.words = alignment.words
  })
  if (program.scheduling === 2) program.clock = 'take'
  await save(p.programPath, program)
  // The recompile does not spend the scene's review budget, but a passing
  // narrated revision is still snapshotted as the retained candidate.
  const preview = await previewTool(args, context, false)
  if (preview.errors.length) {
    await recordStage(context, p.projectDir, 'narrate', 'failed', { scene: p.scene, errors: preview.errors }, p.scene)
    return preview
  }
  const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`)) as Proof
  const ffmpegArgs = ['-y', ...beats.flatMap(b => ['-i', b.path])]
  const filters = proof.plan.steps.map((b, i) => `[${i}:a]apad,atrim=duration=${(b.motionWindowMs + b.holdMs) / 1000},asetpts=PTS-STARTPTS[a${i}]`)
  filters.push(`${beats.map((_, i) => `[a${i}]`).join('')}concat=n=${beats.length}:v=0:a=1[out]`)
  const audioPath = join(audioDir, 'scene.mp3')
  await execute('ffmpeg', [...ffmpegArgs, '-filter_complex', filters.join(';'), '-map', '[out]', '-codec:a', 'libmp3lame', '-q:a', '2', audioPath], { maxBuffer: 2 * 1024 * 1024 })
  const uploaded = await fetch(`${context.origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'audio/mpeg', 'x-project-id': inputs.projectId }, body: new Uint8Array(await readFile(audioPath)) })
  if (!uploaded.ok) throw new Error('Could not store scene narration')
  const track = await uploaded.json() as { url: string }
  await save(join(p.folder, `${p.scene}.narration.json`), { hash: proof.hash, audioUrl: track.url, alignment: 'local-whisper-word-timestamps', durationMs: proof.durationMs })
  await recordStage(context, p.projectDir, 'narrate', 'succeeded', { scene: p.scene, durationMs: proof.durationMs, audioUrl: track.url }, p.scene)
  return { ...preview, audioPath, audioUrl: track.url, alignment: 'local-whisper-word-timestamps', instruction: 'Listen to the narration and inspect these final timed frames. The MP4 will use these same durations and word anchors.' }
}

export const readExplainer = async (projectDir: string, origin?: string) => {
  const manifest = await jsonFile(join(projectDir, 'explainer', 'story.json')) as { scenes: Array<{ id: string; file: string; title: string; question: string; answer: string; review: string; assets: string[]; covers?: string[]; cast?: Array<{ key: string; status: string }> }> }
  const inputs = await jsonFile(join(projectDir, 'motion', 'inputs.json'))
  if (!Array.isArray(manifest.scenes) || !manifest.scenes.length) throw new Error('No scenes in explainer/story.json')
  const scenes: Array<(typeof manifest.scenes)[number] & { svg: string; program: SceneProgram; motion: MotionPlanV2; windows: unknown[]; durationMs: number; stageTrack?: unknown[]; directorAuto?: unknown; boundaryState?: ActorBoundary[] }> = []
  for (const scene of manifest.scenes) {
    const p = paths({ projectDir, scene: scene.file })
    const svg = await readFile(p.svgPath, 'utf8')
    const program = await jsonFile(p.programPath)
    const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`)) as Proof
    if (proof.hash !== digest(svg, program) || proof.errors.length || !proof.frames.length) throw new Error(`${scene.file}: render the current revision and fix its errors before finishing`)
    if (program.scheduling === 2) {
      const quality = await jsonFile(join(p.folder, `${p.scene}.quality.json`)).catch(() => null)
      if (!quality || quality.hash !== (proof.renderHash || proof.hash)) throw new Error(`${scene.file}: accept the current composed export with separate quality evidence before finishing`)
      const reference = await jsonFile(join(p.folder, `${p.scene}.reference.json`))
      const actual = createHash('sha256').update(await readFile(reference.path)).digest('hex')
      const errors = validateQualityReview(quality, proof.renderHash || proof.hash, proof.durationMs, reference.hash === (proof.renderHash || proof.hash) && actual === reference.videoHash ? actual : '')
      if (errors.length) throw new Error(`${scene.file}: ${errors.join('; ')}`)
    }
    if (!scene.question?.trim() || !scene.answer?.trim() || !scene.review?.trim()) throw new Error(`${scene.file}: explain the causal question, answer, and what the frame review established`)
    scenes.push({ ...scene, svg, program: proof.program, motion: proof.plan, windows: proof.windows, durationMs: proof.durationMs, stageTrack: proof.stageTrack, directorAuto: proof.directorAuto, boundaryState: proof.boundaryState })
  }
  for (let index = 1; index < scenes.length; index++) {
    const incoming = scenes[index].program.initialState
    if (!incoming?.length) continue
    const outgoing = scenes[index - 1].boundaryState || []
    const carried = outgoing.filter(actor => incoming.some(next => next.id === actor.id))
    if (carried.length !== incoming.length) throw new Error('A carried actor is absent from the previous boundary')
    const problems = validateBoundary({ kind: 'carry', reason: 'Explicit carried state', outgoingSubject: scenes[index - 1].id, incomingSubject: scenes[index].id, readableMs: 200, actors: carried }, incoming)
    if (problems.length) throw new Error(problems.join('; '))
  }
  // Lineage, not counting (D3): a reviewed scene declares the input scenes
  // it covers — a split shares one input across several scenes, a merge
  // lists several inputs in one scene's covers. Every input scene must be
  // covered, and nothing unknown may be claimed.
  if (new Set(scenes.map(s => s.id)).size !== scenes.length) throw new Error('Every reviewed scene needs its own id')
  const known = new Set(inputs.scenes.map((s: { id: string }) => s.id))
  const covered = new Set<string>()
  for (const scene of scenes) {
    for (const id of scene.covers?.length ? scene.covers : [scene.id]) {
      if (!known.has(id)) throw new Error(`${scene.file}: covers unknown input scene "${id}". Declare covers only from the run's input scenes.`)
      covered.add(id)
    }
  }
  const missing = inputs.scenes.filter((s: { id: string }) => !covered.has(s.id))
  if (missing.length) throw new Error(`Every input scene must be covered by a reviewed derivative; nothing covers: ${missing.map((s: { id: string }) => s.id).join(', ')}`)
  if (origin && scenes.some(scene => scene.program.beats.some(beat => beat.events?.some(event => event.behavior)))) {
    const response = await fetch(`${origin}/api/appearance/library`)
    if (!response.ok) throw new Error('Could not verify reusable behavior versions')
    const { assets } = await response.json() as { assets: LibraryArtwork[] }
    for (const scene of scenes) for (const event of scene.program.beats.flatMap(beat => [beat, ...(beat.then || [])]).flatMap(beat => beat.events || [])) {
      if (!event.behavior) continue
      const definition = event.behavior.definition
      const registered = assets.find(asset => asset.key === definition.artworkKey)?.behaviors?.find(behavior => behavior.key === definition.key)
      if (!registered || stableStringify(registered) !== stableStringify(definition)) throw new Error(`${scene.file}: behavior ${definition.key} is not the exact accepted library version`)
    }
  }
  // Cast receipts (D4): when the server is reachable, every artwork marker
  // must resolve to the accepted library asset with its real geometry — a
  // forged or empty marker cannot pass rich completion.
  if (origin) {
    for (const scene of scenes) {
      const verdict = await call<{ ok: boolean; cast: Array<{ key: string; status: string; tokensFound: number; tokensTotal: number }> }>(
        { origin }, '/api/appearance/verify-cast', { svg: scene.svg },
      )
      scene.cast = verdict.cast
      const bad = verdict.cast.filter(entry => entry.status !== 'verified')
      if (bad.length) {
        throw new Error(`${scene.file}: artwork marker(s) not verified against the library: ${bad.map(entry => `${entry.key} (${entry.status}, ${entry.tokensFound}/${entry.tokensTotal} parts found)`).join(', ')}. Use the accepted artwork from explainer_asset; a marker alone is not proof.`)
      }
      // §5.4a: an object that performs must carry an isolated review receipt.
      const markers = [...scene.svg.matchAll(/data-appearance-key="([^"]+)"/g)]
      const performedKeys = [...new Set(markers
        .filter((marker, index) => /data-object-clip/.test(scene.svg.slice(marker.index, markers[index + 1]?.index ?? scene.svg.length)))
        .map(marker => marker[1]))]
      for (const key of performedKeys) {
        const reviewReceipt = await jsonFile(join(projectDir, 'explainer', 'objects', `${key}.review.json`)).catch(() => null)
        if (!reviewReceipt) throw new Error(`${scene.file}: object ${key} performs without an isolated review. Run explainer_review_object for it first.`)
        if (reviewReceipt.errors?.length) throw new Error(`${scene.file}: object ${key}'s isolated review has errors: ${reviewReceipt.errors.join('; ')}`)
        // The receipt must name WHAT it reviewed (issue #15): the current
        // review instructions, the current artwork revision, and this scene's
        // exact embedded performance with its clip ids and captured frames.
        // Anything else is stale until the object is re-reviewed.
        const currentSkill = await explainerSkillVersion()
        if (reviewReceipt.skillVersion !== currentSkill) throw new Error(`${scene.file}: object ${key}'s isolated review predates the current review instructions; run explainer_review_object for it again.`)
        const assetRecord = (await jsonFile(join(projectDir, 'explainer', 'assets', `${key}.json`)).catch(() => null))
          || (await call<{ assets: LibraryArtwork[] }>({ origin }, '/api/appearance/library')).assets.find(asset => asset.key === key)
        const sourceHash = assetRecord?.svg ? createHash('sha256').update(String(assetRecord.svg)).digest('hex') : ''
        if (!sourceHash || reviewReceipt.sourceHash !== sourceHash) throw new Error(`${scene.file}: object ${key} is a different revision than its isolated review covered; run explainer_review_object for it again.`)
        const embedded = embeddedPerformance(scene.svg, key)
        const bound = (reviewReceipt.performances as Array<{ scene?: string; hash?: string; clips?: string[] }> | undefined)?.find(entry => entry.scene === scene.file)
        if (!bound?.hash || bound.hash !== embedded.hash) throw new Error(`${scene.file}: object ${key}'s embedded performance changed since its isolated review; run explainer_review_object for it again.`)
        if (!embedded.clips.length || !embedded.clips.every(id => (bound.clips || []).includes(id))) throw new Error(`${scene.file}: object ${key} performs clip(s) its isolated review did not cover (${embedded.clips.join(', ') || 'unknown'}); run explainer_review_object for it again.`)
        if (!Array.isArray(reviewReceipt.frames) || !reviewReceipt.frames.length) throw new Error(`${scene.file}: object ${key}'s isolated review captured no frames; run explainer_review_object for it again.`)
      }
    }
  }
  return { scenes, inputs }
}

export const verifyExplainerExport = async (projectDir: string, origin?: string) => {
  const { scenes, inputs } = await readExplainer(projectDir, origin)
  const receipt = await jsonFile(join(projectDir, 'explainer', 'receipt.json'))
  const exported = await jsonFile(join(projectDir, 'explainer', 'export.json'))
  const durationMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
  if (receipt.projectId !== inputs.projectId || !Number.isFinite(exported.durationSeconds) || Math.abs(exported.durationSeconds * 1000 - durationMs) > 100 || JSON.stringify(exported.sceneHashes) !== JSON.stringify(scenes.map(s => digest(s.svg, s.program)))) throw new Error('The export is stale or does not contain the complete reviewed performance')
  // The receipt pins the artifact: a replaced or truncated MP4 fails here
  // even when the scene hashes still match. Hashless receipts predate the pin.
  if (exported.videoHash) {
    const bytes = await readFile(String(exported.videoPath || join(projectDir, 'explainer', 'export.mp4'))).catch(() => null)
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== exported.videoHash) throw new Error('The exported MP4 changed or is missing — export again so the receipt and the video agree')
  }
}

const finishTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir || '')
  const { scenes, inputs } = await readExplainer(projectDir, context.origin)
  const { project } = await call<{ project: ProjectDocumentV1 }>(context, `/api/projects/${encodeURIComponent(inputs.projectId)}`)
  const expectedProject = structuredClone(project)
  if (!project?.derivedFrom?.notebook) throw new Error('Build an explainer in a derived video notebook; the base is preserved')
  const previous = await jsonFile(join(projectDir, 'explainer', 'receipt.json')).catch(() => null)
  // The applied snapshot is the complete scene revision: a page that still
  // carries what this run applied is a safe re-application; anything else is
  // a reviewable conflict.
  const snapshot = (attrs: Record<string, unknown>) => revisionDigest(attrs)
  const applied: Record<string, string> = {}
  const coversOf = (scene: (typeof scenes)[number]) => (scene.covers?.length ? scene.covers : [scene.id])
  const content = project.notebook.content
  const nodeNamed = (id: string) => content.find(n => n.attrs?.id === id)
  const inputNamed = (id: string) => inputs.scenes.find((s: { id: string; revision?: string }) => s.id === id)
  // Compare-and-swap against the revision captured when the run started: an
  // edit to beat motion, staging or camera/layout while the run was live is
  // flagged here, and the user's version stays untouched. Runs dispatched by
  // an older build carry no revision; fall back to the svg/script compare.
  const unchangedFromInput = (nodeAttrs: Record<string, unknown> | undefined, id: string) => {
    const original = inputNamed(id)
    if (!nodeAttrs || !original) return false
    if (typeof original.revision === 'string' && original.revision) return revisionDigest(nodeAttrs) === original.revision
    return nodeAttrs.svg === original.svg && String(nodeAttrs.script || '') === String(original.script || '')
  }

  // Pass 1 — the whole story must apply cleanly before anything changes:
  // each scene's page exists (or its split parent does), and no covered page
  // carries edits made after the run started.
  for (const scene of scenes) {
    const covers = coversOf(scene)
    const node = nodeNamed(scene.id)
    const parentNode = node || nodeNamed(covers[0])
    const ownPrevious = Boolean(previous?.projectId === project.id && node?.attrs && previous.applied?.[scene.id] === snapshot(node.attrs))
    if (!parentNode && !previous?.applied?.[scene.id]) throw new Error(`The notebook has no page "${scene.id}" to receive the reviewed scene. The candidate is saved in this run; refresh before applying it.`)
    if (parentNode && !unchangedFromInput(parentNode.attrs as Record<string, unknown>, covers[0]) && !ownPrevious) throw new Error('The notebook changed during generation. The reviewed candidate is saved in this run; refresh before applying it.')
    for (const extra of covers.slice(1)) {
      if (extra === scene.id) continue
      const extraNode = nodeNamed(extra)
      if (!extraNode) {
        if (!previous?.applied?.[scene.id]) throw new Error(`${scene.file}: covers ${extra}, but that page is not in the notebook`)
        continue
      }
      if (!unchangedFromInput(extraNode.attrs as Record<string, unknown>, extra) && !previous?.applied?.[scene.id]) throw new Error('The notebook changed during generation. The reviewed candidate is saved in this run; refresh before applying it.')
    }
  }

  // Pass 1.5 — every scene's narration proves current before anything
  // changes: a missing or stale record anywhere fails the whole finish here,
  // with the notebook and every take selection exactly as they were. (The
  // durable take clears collected below fire only after the project PUT.)
  type NarrationRecord = { recordingId?: string; sourceTakeAudioUrl?: string; hash?: string; audioUrl?: string; alignment?: string; review?: Array<{ beat: number; note: string }> }
  const narrations = new Map<string, { audioUrl: string; recorded: boolean; narration: NarrationRecord }>()
  for (const scene of scenes) {
    const narration = await jsonFile(join(projectDir, 'explainer', `${scene.file}.narration.json`)).catch(() => null) as NarrationRecord | null
    if (!narration?.audioUrl) throw new Error(`${scene.file}: no narration yet — run explainer_narrate (or align the scene's take) before finishing`)
    const rawProgram = await jsonFile(join(projectDir, 'explainer', `${scene.file}.program.json`))
    if (narration.hash !== digest(scene.svg, rawProgram)) throw new Error(`${scene.file}: narration or picture changed; run explainer_narrate again`)
    // The human path's narration record is the selected take: the export must
    // carry the person's voice, not a guide-voice substitute.
    const recorded = narration.alignment === 'selected-take'
    const selectedTake = project.recordedBlocks?.[scene.id]
    const alignedTakeId = narration.recordingId || inputNamed(coversOf(scene)[0])?.recordingId
    const alignedTakeUrl = narration.sourceTakeAudioUrl || inputNamed(coversOf(scene)[0])?.takeAudioUrl
    if (recorded && alignedTakeId && selectedTake?.recordingId !== alignedTakeId) {
      throw new Error(`${scene.file}: the selected take changed; align and review the selected take again`)
    }
    if (recorded && alignedTakeUrl && alignedTakeUrl !== (selectedTake?.keepsPlan && selectedTake.cameraUrl ? selectedTake.cameraUrl : selectedTake?.videoUrl)) {
      throw new Error(`${scene.file}: the selected take media changed; align and review it again`)
    }
    // An aligned take whose latest alignment still reports needs-input (an
    // unresolved pickup) blocks the finish — the run waits for the person;
    // it never completes over a beat the take did not say as written.
    const pending = Array.isArray(narration.review) ? narration.review : []
    if (recorded && pending.length) {
      throw new Error(`${scene.file}: the aligned take still needs input — ${pending.map(item => `beat ${item.beat}: ${item.note}`).join(' · ')} Record the pickup or rebind the cue, then run explainer_align_take again.`)
    }
    narrations.set(scene.id, { audioUrl: narration.audioUrl, recorded, narration })
  }

  // Pass 2 — apply: clone split children, write the reviewed content, fold
  // merged pages into the surviving node's origin. Nothing durable happens in
  // this loop — take selections retire only once the project PUT has landed.
  const takeClears: string[] = []
  const rendered: Record<string, string> = {}
  for (const scene of scenes) {
    const covers = coversOf(scene)
    let node = nodeNamed(scene.id)
    if (!node) {
      // A split child: a new node cloned from the page it came from.
      const parentNode = nodeNamed(covers[0])!
      const cloned = structuredClone(parentNode)
      cloned.attrs = { ...cloned.attrs, id: scene.id }
      // After the parent's last applied half, so splits keep story order.
      const siblings = [covers[0], ...scenes.filter(other => coversOf(other)[0] === covers[0]).map(other => other.id)]
      const lastSibling = Math.max(...siblings.map(id => content.findIndex(n => n.attrs?.id === id)).filter(index => index >= 0))
      content.splice(lastSibling + 1, 0, cloned)
      project.blocks ||= {}
      project.blocks[scene.id] = structuredClone(project.blocks[String(parentNode.attrs?.id)] || createDefaultBlockConfig(scene.id, cloned))
      node = cloned
    }
    if (scene.program.initialState?.length) project.blocks[scene.id].frameTransition = { style: 'cut', durationSeconds: 0 }
    const earlier = node.attrs?.explainer as { previousPresenterTracks?: unknown; previousRecording?: unknown } | undefined
    const previousTracks = project.presenterTracks?.[scene.id]
    const previousRecording = project.recordedBlocks?.[scene.id]
    const say = scene.program.beats.map(b => b.say).join('\n\n')
    // The applied scene's staging comes from a fresh director pass over the
    // reviewed content (D6): the pre-build directorAuto is stale by index, so
    // it is replaced, not carried. Without a working renderer the scene keeps
    // no staging claims rather than stale ones.
    let stageTrack: unknown[] = scene.stageTrack || []
    let directorAuto: unknown = scene.directorAuto || null
    try {
      if (!scene.stageTrack) {
      const directed = await runAtomizer<{ storyboard?: unknown; shots?: DirectedShot[]; recordingBrief?: unknown }>(
        'direct',
        scene.svg,
        { windows: scene.windows, title: scene.title, position: { index: scenes.indexOf(scene), count: scenes.length } },
      )
      if (directed?.shots?.length) {
        const { offsets } = motionPlanOffsetsMs(scene.motion)
        stageTrack = stageTrackFromShots(directed.shots, offsets, scene.motion.steps.map(step => step.motionWindowMs + step.holdMs))
        directorAuto = { storyboard: directed.storyboard, shots: directed.shots, recordingBrief: directed.recordingBrief }
      }
      }
    } catch {
      // No renderer on this host: the scene applies without staging claims.
    }
    node.attrs = { ...node.attrs, title: scene.title, svg: scene.svg, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scene.svg)}`,
      program: scene.program, motion: scene.motion, windows: scene.windows, script: say, sourceText: say, scriptApproved: true, breakdownApproved: true,
      directorNotes: `${scene.question}\n${scene.answer}`, structureApproved: true, stageTrack, stagePlacements: null, directorAuto,
      explainer: { run: projectDir, question: scene.question, answer: scene.answer, assets: scene.assets, reviewed: true,
        previousPresenterTracks: earlier?.previousPresenterTracks ?? previousTracks ?? [], previousRecording: earlier?.previousRecording ?? previousRecording ?? null } }
    // The surviving node remembers every base scene it now covers.
    const originScenes = [...new Set(covers.flatMap(cid => {
      const origin = nodeNamed(cid)?.attrs?.origin as { scene?: string; scenes?: string[] } | undefined
      return origin?.scenes?.length ? origin.scenes : origin?.scene ? [origin.scene] : []
    }))]
    if (originScenes.length) {
      const origin = (node.attrs.origin || {}) as Record<string, unknown>
      node.attrs.origin = { ...origin, scenes: originScenes, scene: originScenes[0] }
    }
    project.blocks[scene.id] = { ...(project.blocks[scene.id] || createDefaultBlockConfig(scene.id, node)), durationMs: scene.durationMs }
    const { audioUrl, recorded } = narrations.get(scene.id)!
    // An old take cannot cover a newly composed mechanism — unless the build
    // aligned this scene to it: then the take IS the timing authority and
    // stays. Otherwise it leaves the document AND the durable selection, so
    // it does not resurrect on reopen.
    if (!recorded) {
      if (project.recordedBlocks) delete project.recordedBlocks[scene.id]
      takeClears.push(scene.id)
    }
    project.presenterTracks ||= {}
    project.presenterTracks[scene.id] = [{ kind: 'narration', audioUrl, audioKind: recorded ? 'recorded-mic' : 'generated', ...(recorded && previousRecording ? { recordingId: previousRecording.recordingId } : {}) }]
    // The pin of exactly what was reviewed AND is now applied (issue #17):
    // the complete scene revision plus everything else the export draws or
    // plays — camera, duration, the narration track and the take identity. A
    // later edit keeps the reviewed boolean but breaks the pin, and staleness
    // becomes visible (§3.9) and blocking at export.
    rendered[scene.id] = revisionDigest(node.attrs, sceneRenderedExtras(project.blocks[scene.id], project.presenterTracks[scene.id], project.recordedBlocks?.[scene.id], project))
    ;(node.attrs.explainer as Record<string, unknown>).hash = rendered[scene.id]
    applied[scene.id] = snapshot(node.attrs)
    // Merged-away pages leave the notebook; their origin lives on in the survivor.
    for (const extra of covers.slice(1)) {
      if (extra === scene.id) continue
      const index = content.findIndex(n => n.attrs?.id === extra)
      if (index >= 0) content.splice(index, 1)
      delete project.blocks[extra]
      delete project.presenterTracks[extra]
      if (project.recordedBlocks) delete project.recordedBlocks[extra]
      takeClears.push(extra)
    }
  }

  // Pages that were split: no reviewed scene took their id, so the original
  // wireframe page leaves once both halves are applied.
  for (const input of inputs.scenes as Array<{ id: string }>) {
    if (scenes.some(scene => scene.id === input.id)) continue
    const covered = scenes.some(scene => coversOf(scene).includes(input.id))
    if (!covered) continue
    const node = nodeNamed(input.id)
    if (!node) continue
    if (!unchangedFromInput(node.attrs as Record<string, unknown>, input.id)) throw new Error('The notebook changed during generation. The reviewed candidate is saved in this run; refresh before applying it.')
    content.splice(content.findIndex(n => n.attrs?.id === input.id), 1)
    delete project.blocks[input.id]
    delete project.presenterTracks[input.id]
    if (project.recordedBlocks) delete project.recordedBlocks[input.id]
    takeClears.push(input.id)
  }
  await call(context, `/api/projects/${encodeURIComponent(project.id)}`, { project, expectedProject, clearTakeBlocks: takeClears }, 'PUT')
  const preview = await call(context, '/api/preview', { project })
  const cast = Object.fromEntries(scenes.map(scene => [scene.id, (scene.cast || []).map(entry => `${entry.key}:${entry.status}`)]))
  await save(join(projectDir, 'explainer', 'receipt.json'), { projectId: project.id, scenes: scenes.length, applied, rendered, cast, preview, at: new Date().toISOString() })
  await recordStage(context, projectDir, 'finish', 'succeeded', { scenes: scenes.length, projectId: project.id })
  return { projectId: project.id, scenes: scenes.length, preview, next: 'The reviewed editable scenes are saved. Use explainer_export to render the video after narration is attached.' }
}

const renderOrAttach = async (project: ProjectDocumentV1, context: Context, durable: boolean): Promise<{ url: string; durationSeconds: number } | { pending: true; jobId: string; instruction: string }> => {
  if (!durable) return call(context, '/api/render', project)
  const { job } = await call<{ job: { id: string; status: string; error?: string; result?: { url: string; durationSeconds: number } } }>(context, '/api/exports', project)
  if (job.status === 'stored' && job.result) return job.result
  if (job.status === 'failed' || job.status === 'cancelled') throw new Error(job.error || `Export ${job.status}`)
  return { pending: true, jobId: job.id, instruction: 'The durable export continues independently. Call this tool again to reattach to the same manifest; do not start another build.' }
}

const exportTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir)
  const { inputs, scenes } = await readExplainer(projectDir, context.origin)
  const receipt = await jsonFile(join(projectDir, 'explainer', 'receipt.json'))
  if (receipt.projectId !== inputs.projectId) throw new Error('Apply this reviewed explainer before exporting')
  const { project } = await call<{ project: ProjectDocumentV1 }>(context, `/api/projects/${encodeURIComponent(inputs.projectId)}`)
  if (!project.derivedFrom) throw new Error('Export a derived explainer')
  await rm(join(projectDir, 'explainer', 'export.json'), { force: true })
  for (const scene of scenes) {
    const node = project.notebook.content.find(n => n.attrs?.id === scene.id)
    // The reviewed export pins the whole rendered performance (issue #17):
    // the scene revision plus camera, duration, narration and take identity —
    // anything the render would draw or play. Receipts from before the pin
    // fall back to the svg/program/duration compare.
    if (receipt.rendered?.[scene.id]) {
      const current = revisionDigest(node?.attrs as Record<string, unknown> | undefined, sceneRenderedExtras(project.blocks?.[scene.id], project.presenterTracks?.[scene.id], project.recordedBlocks?.[scene.id], project))
      if (!node || current !== receipt.rendered[scene.id]) throw new Error('The saved scene differs from its reviewed performance — motion, staging, camera or audio changed after the finish. Re-apply with explainer_finish (an unchanged review re-pins the presentation) or build again.')
    } else if (node?.attrs?.svg !== scene.svg || stableStringify(node.attrs.program) !== stableStringify(scene.program) || project.blocks[scene.id]?.durationMs !== scene.durationMs) throw new Error('The saved scene differs from its reviewed performance. Apply it with explainer_finish before exporting.')
  }
  const result = await renderOrAttach(project, context, scenes.some(scene => scene.program.scheduling === 2))
  if ('pending' in result) return result
  const response = await fetch(new URL(portableUrl(result.url), context.origin))
  if (!response.ok) throw new Error('Export completed but its video could not be inspected')
  const videoPath = join(projectDir, 'explainer', 'export.mp4')
  const videoBuffer = Buffer.from(await response.arrayBuffer())
  await writeFile(videoPath, videoBuffer)
  // The receipt pins the artifact itself (§4 ExportReceipt): a replaced or
  // truncated MP4 fails verification even when the scene hashes match.
  const videoHash = createHash('sha256').update(videoBuffer).digest('hex')
  const probe = await execute('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath])
  const measuredDurationMs = Number(probe.stdout.trim()) * 1000
  const expectedDurationMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0)
  if (!Number.isFinite(measuredDurationMs) || Math.abs(measuredDurationMs - expectedDurationMs) > 100) throw new Error(`Export duration ${measuredDurationMs}ms differs from the reviewed performance ${expectedDurationMs}ms. The video is not complete.`)
  const folder = join(projectDir, 'explainer', 'export-review')
  await mkdir(folder, { recursive: true })
  const frames: string[] = []
  let offset = 0
  for (const scene of scenes) {
    for (const [index, fraction] of [0.15, 0.5, 0.85].entries()) {
      const path = join(folder, `${scene.file}-${index}.png`)
      const seconds = Math.min(result.durationSeconds - 0.05, (offset + scene.durationMs * fraction) / 1000)
      await execute('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, seconds)), '-i', videoPath, '-frames:v', '1', path])
      frames.push(path)
    }
    offset += scene.durationMs
  }
  const exported = { ...result, durationSeconds: measuredDurationMs / 1000, expectedDurationMs, sceneHashes: scenes.map(s => digest(s.svg, s.program)), videoPath, videoHash, frames, instruction: 'Inspect these frames from the actual MP4 for full-frame composition, captions, clipping and state continuity. Report any remaining visual limitation.' }
  await save(join(projectDir, 'explainer', 'export.json'), exported)
  await recordStage(context, projectDir, 'export', 'succeeded', { durationSeconds: exported.durationSeconds, scenes: scenes.length })
  return exported
}

const composedFrameTool = (args: Args) => {
  const work = reviewQueue.catch(() => {}).then(async () => {
    const p = paths(args)
    const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`)) as Proof
    const svg = await readFile(p.svgPath, 'utf8'), program = await jsonFile(p.programPath)
    if (!proof.renderManifest || proof.hash !== digest(svg, program) || args.revision !== proof.renderHash) throw new Error('Request the current immutable render revision')
    const gsapSource = await readFile(createRequire(resolve('package.json')).resolve('gsap/dist/gsap.min.js'), 'utf8')
    const result = await runAtomizer<{ schedule: unknown; errors: string[] }>('reviewExplainer', svg, program, { project: proof.renderManifest.project, sceneId: 'review-scene', fonts: proof.renderManifest.fonts, gsapSource })
    const atMs = Math.round(Math.max(0, Math.min(proof.durationMs, Number(args.atMs) || 0)) * proof.renderManifest.project.fps / 1000) * 1000 / proof.renderManifest.project.fps
    const frame = await runAtomizer('explainerFrame', atMs)
    const folder = join(p.folder, 'review', p.scene, proof.renderHash!.slice(0, 12)); await mkdir(folder, { recursive: true })
    const path = join(folder, `inspect-${Math.round(atMs)}.png`); await writeFile(path, await captureHiddenPage())
    return { revision: proof.renderHash, path, frame, schedule: result.schedule, errors: result.errors }
  })
  reviewQueue = work; return work
}
const importObjectTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const { assets } = await call<{ assets: LibraryArtwork[] }>(context, '/api/appearance/library')
  const artwork = assets.find(asset => asset.key === args.key && asset.accepted)
  if (!artwork) throw new Error('Choose an accepted library version')
  const svg = await readFile(p.svgPath, 'utf8')
  const imported = await runAtomizer<string>('wearAppearance', svg, String(args.unit), artwork)
  if (imported === svg) throw new Error('The scene does not contain a placeable object with that ID')
  await writeFile(p.svgPath, imported)
  return { svgPath: p.svgPath, key: artwork.key, behaviors: artwork.behaviors || [], next: 'Bind the required parts and preview this changed render revision.' }
}

const referenceExportTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`))
  if (proof.errors?.length || !proof.renderManifest?.project) throw new Error('Preview a passing composed candidate first')
  const narration = await jsonFile(join(p.folder, `${p.scene}.narration.json`))
  if (narration.hash !== proof.hash || !narration.audioUrl) throw new Error('Narration must match the reference candidate')
  const project = proof.renderManifest.project as ProjectDocumentV1
  const id = String(project.notebook.content[0].attrs!.id)
  if (!project.presenterTracks[id]?.some(track => track.kind === 'narration' && track.audioUrl === narration.audioUrl)) throw new Error('Preview again to bind the current narration to the immutable render manifest')
  const result = await renderOrAttach(project, context, true)
  if ('pending' in result) return result
  const response = await fetch(new URL(portableUrl(result.url), context.origin))
  if (!response.ok) throw new Error('Reference export could not be downloaded')
  const bytes = Buffer.from(await response.arrayBuffer())
  const path = join(p.folder, `${p.scene}.reference.mp4`)
  await writeFile(path, bytes)
  const exported = { hash: proof.renderHash || proof.hash, sourceHash: proof.hash, videoHash: createHash('sha256').update(bytes).digest('hex'), path, url: result.url, durationMs: result.durationSeconds * 1000 }
  if (Math.abs(exported.durationMs - proof.durationMs) > 100) throw new Error('Reference export duration differs from the reviewed clock')
  await save(join(p.folder, `${p.scene}.reference.json`), exported)
  return { ...exported, next: 'View the actual video and listen. Record separate render/design/causal/viewing evidence with explainer_accept before expanding the story.' }
}
const acceptQualityTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`)) as Proof
  const exported = await jsonFile(join(p.folder, `${p.scene}.reference.json`))
  const review = args.review as QualityReview
  if (!review || proof.errors.length) throw new Error('A passing candidate and concrete quality review are required')
  const errors = validateQualityReview(review, proof.renderHash || proof.hash, proof.durationMs, exported.hash === (proof.renderHash || proof.hash) ? exported.videoHash : '')
  if (errors.length) throw new Error(errors.join('; '))
  const actual = createHash('sha256').update(await readFile(exported.path)).digest('hex')
  if (actual !== exported.videoHash) throw new Error('The reviewed export has changed')
  await save(join(p.folder, `${p.scene}.quality.json`), review)
  const previous = await jsonFile(join(p.folder, `${p.scene}.best-quality.json`)).catch(() => null)
  if (!previous || review.score > previous.score || (review.score === previous.score && review.limitations.length < previous.limitations.length)) {
    await save(join(p.folder, `${p.scene}.best-quality.json`), review)
    await save(join(p.folder, `${p.scene}.best-proof.json`), proof)
  }
  await save(join(p.folder, 'reference-accepted.json'), { scene: p.scene, hash: proof.renderHash || proof.hash, exportHash: exported.videoHash })
  await recordStage(context, p.projectDir, 'quality', 'succeeded', { scene: p.scene, review }, p.scene)
  return { accepted: true, hash: proof.renderHash || proof.hash, limitations: review.limitations }
}
const registerRepairTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir)
  const svg = await readFile(local(projectDir, String(args.svgPath)), 'utf8')
  const review = await jsonFile(local(projectDir, String(args.reviewPath)))
  if (!Array.isArray(review.frames) || !review.frames.length) throw new Error('A repair needs captured frame evidence')
  for (const frame of review.frames) {
    const bytes = await readFile(local(projectDir, String(frame)))
    if (bytes.length < 100) throw new Error('Repair frame evidence is empty')
  }
  return call(context, '/api/appearance/register', { parentKey: args.parentKey, svg, behaviors: args.behaviors, review })
}

const alignTakeTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const program = await jsonFile(p.programPath) as SceneProgram
  const audioDir = join(p.folder, 'audio', p.scene)
  await mkdir(audioDir, { recursive: true })
  // The take's audio: a file the run already holds, or a stored object URL.
  let audioPath = typeof args.audioPath === 'string' && args.audioPath ? local(p.projectDir, args.audioPath) : ''
  if (!audioPath) {
    const audioUrl = String(args.audioUrl || '')
    if (!audioUrl) throw new Error('Give the take audio as a run file (audioPath) or a stored object URL (audioUrl)')
    // A stored object is read on the app's origin now, whatever port wrote it.
    const response = await fetch(new URL(portableUrl(audioUrl), context.origin))
    if (!response.ok) throw new Error('Could not read the take audio')
    audioPath = join(audioDir, 'take-source.mp3')
    await writeFile(audioPath, Buffer.from(await response.arrayBuffer()))
  }
  const manifest = join(audioDir, 'take.json')
  await save(manifest, { audio: audioPath, beats: program.beats.map(beat => ({ id: beat.id, say: beat.say })) })
  const aligner = fileURLToPath(new URL('../skills/explainer-master/scripts/align_take.py', import.meta.url))
  try {
    await execute('uv', ['run', '--with', 'faster-whisper==1.2.0', '--with', 'requests==2.32.5', 'python', aligner, manifest], { timeout: 600_000, maxBuffer: 2 * 1024 * 1024 })
  } catch (error) {
    throw new Error(`Take alignment failed. Install uv and allow its cached faster-whisper runtime/model download, then retry. ${String((error as Error).message).slice(0, 250)}`)
  }
  const aligned = await jsonFile(join(audioDir, 'take.take-aligned.json')) as { beats: Array<{ id?: string; words: Array<{ word: string; startMs: number; endMs: number }>; coverage: number; startMs: number; durationMs: number; review: string | null }> }
  // The take becomes the timing authority — on the take's own clock. The
  // scene starts where the take starts, so the opening beat keeps the silence
  // before the first word; every later beat starts where its first word was
  // actually said; the last beat ends at the last measured word. Word anchors
  // are beat-local offsets on that same clock, and nothing is invented to
  // fill a gap.
  const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const review: Array<{ beat: number; note: string }> = []
  const beatStartMs = aligned.beats.map((beat, index) => (index === 0 ? 0 : beat.startMs))
  program.beats.forEach((beat, index) => {
    const alignedBeat = aligned.beats[index]
    if (!alignedBeat) throw new Error(`Beat ${index + 1} has no alignment`)
    beat.words = alignedBeat.words.map(word => ({ word: word.word, startMs: word.startMs - beatStartMs[index], endMs: word.endMs - beatStartMs[index] }))
    if (alignedBeat.review) review.push({ beat: index + 1, note: alignedBeat.review })
    for (const event of [beat, ...(beat.then || [])].flatMap(b => b.events || [])) {
      if (!event.cue) continue
      const { word, occurrence } = splitCue(event.cue)
      const occurrences = beat.words.filter(w => normalize(w.word) === normalize(word))
      if (occurrences.length < occurrence) {
        review.push({ beat: index + 1, note: `Cue "${event.cue}" needs ${occurrence > 1 ? `occurrence ${occurrence} of ` : ''}"${word}"; the take has ${occurrences.length}. Rebind the cue or record a pickup.` })
      }
    }
  })
  // The final beat ends at the take's last measured word — never at the old
  // estimate. (A beat the take does not say keeps its estimate; its review
  // note blocks the finish until the pickup lands.)
  const closingWords = aligned.beats[aligned.beats.length - 1]?.words || []
  const takeEndMs = closingWords.length ? closingWords[closingWords.length - 1].endMs : 0
  program.beats.forEach((beat, index) => {
    const next = aligned.beats[index + 1]
    const endMs = next ? next.startMs : takeEndMs || beatStartMs[index] + (beat.durationMs || 2000)
    beat.durationMs = Math.max(1, Math.round(endMs - beatStartMs[index]))
  })
  // Measured times are the whole beat: the compiler must not pad its own
  // holds between them, or the scene would drift off the take's clock.
  program.clock = 'take'
  await save(p.programPath, program)
  await save(join(p.folder, `${p.scene}.take-alignment.json`), { beats: aligned.beats.map(beat => ({ id: beat.id, coverage: beat.coverage, startMs: beat.startMs, durationMs: beat.durationMs, review: beat.review })) })
  // The take IS this scene's audio on the human path: store it and write the
  // narration record the finish applies, so the export carries the person's
  // actual voice — never a guide substitute (§3.8).
  const inputs = await jsonFile(join(p.projectDir, 'motion', 'inputs.json'))
  const uploaded = await fetch(`${context.origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'audio/mpeg', 'x-project-id': inputs.projectId }, body: new Uint8Array(await readFile(audioPath)) })
  if (!uploaded.ok) throw new Error('Could not store the take audio')
  const track = await uploaded.json() as { url: string }
  const sceneSvg = await readFile(p.svgPath, 'utf8')
  // The receipt is also the alignment verdict (§3.8): unresolved pickups ride
  // it as `review`, and the finish refuses a scene whose latest take still
  // needs input — a needs-input beat is a wait, never a completable review.
  const story = await jsonFile(join(p.folder, 'story.json')).catch(() => null)
  const sceneId = story?.scenes?.find((scene: { file?: string }) => scene.file === p.scene)?.id || p.scene
  const takeInput = inputs.scenes?.find((scene: { id?: string }) => scene.id === sceneId)
  if (args.audioUrl && takeInput?.takeAudioUrl && args.audioUrl !== takeInput.takeAudioUrl) throw new Error('The alignment audio is not the selected input take')
  await save(join(p.folder, `${p.scene}.narration.json`), { hash: digest(sceneSvg, program), audioUrl: track.url, alignment: 'selected-take', ...(takeInput?.recordingId ? { recordingId: takeInput.recordingId } : {}), ...(takeInput?.takeAudioUrl ? { sourceTakeAudioUrl: takeInput.takeAudioUrl } : {}), durationMs: program.beats.reduce((sum, beat) => sum + (beat.durationMs || 0), 0), ...(review.length ? { review } : {}) })
  // Same recompile rule as narration: no budget spent, but a passing
  // take-aligned revision is snapshotted as the retained candidate.
  const preview = await previewTool(args, context, false)
  await recordStage(context, p.projectDir, 'align-take', review.length ? 'needs-input' : 'succeeded', { scene: p.scene, review }, p.scene)
  return { ...preview, review, alignment: 'selected-take', instruction: review.length ? 'These beats were not said as written; rebind their cues or record the named pickups, then align again.' : 'The take is the timing authority. Inspect the frames: motion follows the actual delivery.' }
}

// The vendored skill's declared version, memoized — the review receipt cites
// it so a skill change invalidates the right proofs (§5.4a).
let explainerSkillVersionCache = ''
const explainerSkillVersion = async () => {
  if (explainerSkillVersionCache) return explainerSkillVersionCache
  const doc = await readFile(fileURLToPath(new URL('../skills/explainer-master/SKILL.md', import.meta.url)), 'utf8').catch(() => '')
  explainerSkillVersionCache = /^ {2}version:\s*["']?([^"'\n]+)["']?/m.exec(doc)?.[1]?.trim() || 'unversioned'
  return explainerSkillVersionCache
}

const reviewObjectTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir || '')
  if (!isAbsolute(projectDir)) throw new Error('projectDir must be absolute')
  const key = String(args.key || '')
  if (!/^[a-z0-9]{6,64}$/i.test(key)) throw new Error('key is the library asset key')
  // The asset from the run's local copy, else the library.
  const assetsDir = join(projectDir, 'explainer', 'assets')
  let record = await jsonFile(join(assetsDir, `${key}.json`)).catch(() => null)
  if (!record?.svg) {
    const { assets } = await call<{ assets: LibraryArtwork[] }>(context, '/api/appearance/library')
    record = assets.find(asset => asset.key === key) || null
  }
  if (!record?.svg) throw new Error(`No accepted artwork named ${key}`)
  // An animated revision is judged against its source, never overwriting it.
  let parentSvg = ''
  if (record.parentKey) {
    const parent = (await jsonFile(join(assetsDir, `${record.parentKey}.json`)).catch(() => null))
      || (await call<{ assets: LibraryArtwork[] }>(context, '/api/appearance/library')).assets.find(asset => asset.key === record.parentKey)
    parentSvg = parent?.svg || ''
  }
  const result = await runAtomizer<{ errors: string[]; warnings: string[]; captures: Array<{ clipId: string; atMs: number; label: string }>; clips: Array<{ id: string; durationMs: number }>; fidelity: { kept: number; total: number } | null }>('reviewObjectClip', { svg: record.svg, parentSvg: parentSvg || undefined })
  const folder = join(projectDir, 'explainer', 'objects', key)
  await mkdir(folder, { recursive: true })
  const frames: Array<{ label: string; clipId: string; atMs: number; path: string }> = []
  for (const capture of result.captures || []) {
    await runAtomizer('objectClipSeek', capture.clipId, capture.atMs)
    const path = join(folder, `${capture.clipId}-${capture.label}.png`)
    await writeFile(path, await captureHiddenPage())
    frames.push({ ...capture, path })
  }
  // §5.4a binding (issue #15): pin the exact embedded performance revision
  // this run's scenes carry for the object — the clip subtrees and their ids,
  // per scene file. Editing a clip or embedding another revision makes this
  // receipt stale at finish/export until the object is re-reviewed.
  const performances: Array<{ scene: string; hash: string; clips: string[] }> = []
  const story = await jsonFile(join(projectDir, 'explainer', 'story.json')).catch(() => null) as { scenes?: Array<{ file?: unknown }> } | null
  for (const storyScene of story?.scenes || []) {
    const file = String(storyScene?.file || '')
    if (!file) continue
    const sceneSvg = await readFile(local(projectDir, `explainer/${file}.svg`), 'utf8').catch(() => '')
    if (!sceneSvg) continue
    const embedded = embeddedPerformance(sceneSvg, key)
    if (embedded.hash) performances.push({ scene: file, ...embedded })
  }
  const receipt = {
    key,
    // §5.4a provenance: which accepted asset this review covered and which
    // skill version's instructions shaped it — an artwork or instruction
    // change invalidates this proof.
    sourceHash: createHash('sha256').update(record.svg).digest('hex'),
    skillVersion: await explainerSkillVersion(),
    performances,
    errors: result.errors, warnings: result.warnings, clips: result.clips, fidelity: result.fidelity, frames, at: new Date().toISOString(),
  }
  await save(join(projectDir, 'explainer', 'objects', `${key}.review.json`), receipt)
  await recordStage(context, projectDir, 'object-review', result.errors.length ? 'failed' : 'succeeded', { key, clips: result.clips.length, fidelity: result.fidelity }, key)
  return {
    errors: result.errors,
    warnings: result.warnings,
    clips: result.clips,
    fidelity: result.fidelity,
    frames,
    performances,
    receiptPath: join(projectDir, 'explainer', 'objects', `${key}.review.json`),
    instruction: 'Open the frames: at rest the object must read as the accepted artwork; the action midpoint must show the named behavior; the settled frame must be readable. A fidelity error means the performance redrew the art. The receipt binds this run\'s embedded performances of the object; editing a clip or embedding another revision requires a fresh review.',
  }
}

// §3.9 staleness as data: per scene, which stages are current and which are
// stale — the svg/program changed since its preview proof, the narration no
// longer matches, the notebook diverged from what was applied. Read this
// before re-running anything; local edits never cascade blindly.
const statusTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir || '')
  if (!isAbsolute(projectDir)) throw new Error('projectDir must be absolute')
  const manifest = await jsonFile(join(projectDir, 'explainer', 'story.json')).catch(() => null) as { scenes?: Array<{ id: string; file: string }> } | null
  const scenes = manifest?.scenes || []
  if (!scenes.length) throw new Error('No scenes in explainer/story.json')
  const inputs = await jsonFile(join(projectDir, 'motion', 'inputs.json')).catch(() => ({ projectId: '' }))
  const receipt = await jsonFile(join(projectDir, 'explainer', 'receipt.json')).catch(() => null)
  const projectResponse = inputs.projectId
    ? await call<{ project: ProjectDocumentV1 }>(context, `/api/projects/${encodeURIComponent(inputs.projectId)}`).catch(() => null)
    : null
  const snapshot = (attrs: Record<string, unknown>) => revisionDigest(attrs)
  const rows = []
  for (const scene of scenes) {
    const p = paths({ projectDir, scene: scene.file })
    const svg = await readFile(p.svgPath, 'utf8')
    const program = await jsonFile(p.programPath)
    const hash = digest(svg, program)
    const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`)).catch(() => null)
    const narration = await jsonFile(join(p.folder, `${p.scene}.narration.json`)).catch(() => null)
    const stale: string[] = []
    if (!proof) stale.push('never previewed')
    else if (proof.hash !== hash) stale.push('svg or program changed since the preview proof')
    else if (proof.errors?.length) stale.push('the preview proof has errors')
    if (narration && narration.hash !== hash) stale.push('narration predates the current svg/program — narrate again')
    if (!narration) stale.push('never narrated')
    const node = projectResponse?.project?.notebook?.content?.find((n: { attrs?: { id?: unknown } }) => n.attrs?.id === scene.id)
    if (receipt?.applied?.[scene.id] && node?.attrs && receipt.applied[scene.id] !== snapshot(node.attrs)) stale.push('the notebook diverged from what was applied — refresh or re-apply')
    if (!receipt?.applied?.[scene.id]) stale.push('not applied to the notebook')
    // The rendered pin goes wider than the applied revision: motion, staging,
    // camera, narration and the take identity are what the export draws.
    const project = projectResponse?.project
    if (receipt?.rendered?.[scene.id] && node?.attrs && project) {
      const current = revisionDigest(node.attrs as Record<string, unknown>, sceneRenderedExtras(project.blocks?.[scene.id], project.presenterTracks?.[scene.id], project.recordedBlocks?.[scene.id], project))
      if (current !== receipt.rendered[scene.id]) stale.push('the rendered performance diverged from the finish (motion, staging, camera or audio) — re-apply or rebuild before exporting')
    }
    rows.push({ scene: scene.id, file: scene.file, hash, fresh: !stale.length, stale })
  }
  return { projectId: inputs.projectId, scenes: rows, fresh: rows.every(row => row.fresh) }
}

const common = { projectDir: { type: 'string', description: 'Absolute run project directory' } }
export const EXPLAINER_TOOLS = [
  { name: 'explainer_frame', description: 'Seek an immutable composed review revision on the project frame clock. Returns the exact frame, resolved schedule and visible part bounds.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' }, revision: { type: 'string' }, atMs: { type: 'number' } }, required: ['projectDir', 'scene', 'revision', 'atMs'] }, call: composedFrameTool },
  { name: 'explainer_import', description: 'Place an accepted library SVG with the same import helper as the editor. Preserves paint, source viewport, named parts and per-instance references.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' }, unit: { type: 'string' }, key: { type: 'string' } }, required: ['projectDir', 'scene', 'unit', 'key'] }, call: importObjectTool },
  { name: 'explainer_reference_export', description: 'Render the current narrated reference scene as a real short MP4 before expanding the story.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' } }, required: ['projectDir', 'scene'] }, call: referenceExportTool },
  { name: 'explainer_accept', description: 'Persist separate render, design, causal and viewing/listening evidence bound to the current candidate and reference MP4. Only explicit acceptance ranks a candidate as best.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' }, review: { type: 'object' } }, required: ['projectDir', 'scene', 'review'] }, call: acceptQualityTool },
  { name: 'explainer_register_repair', description: 'Register a reviewed local SVG repair and named behaviors as an immutable reusable library version of an accepted parent.', inputSchema: { type: 'object', properties: { ...common, parentKey: { type: 'string' }, svgPath: { type: 'string' }, reviewPath: { type: 'string' }, behaviors: { type: 'array', items: { type: 'object' } } }, required: ['projectDir', 'parentKey', 'svgPath', 'reviewPath'] }, call: registerRepairTool },
  { name: 'explainer_asset', description: 'Reuse, generate, edit or animate a rich Quiver SVG. Uses the server credential and permanent asset library. Returns local SVG and metadata paths, never credentials.', inputSchema: { type: 'object', properties: { ...common, operation: { enum: ['list', 'generate', 'edit', 'animate'] }, briefPath: { type: 'string' }, brief: { type: 'object' }, key: { type: 'string' }, prompt: { type: 'string' } }, required: ['projectDir', 'operation'] }, call: assetTool },
  { name: 'explainer_preview', description: 'Compile explainer/<scene>.svg and .program.json using the production player; validate and capture before/action/settled frames. Re-run after every edit.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' } }, required: ['projectDir', 'scene'] }, call: previewTool },
  { name: 'explainer_restore', description: 'Restore a retained passing candidate (the best by default, or a given proof hash) as the scene\'s working revision — its artwork, program, timing and original frames. Use when the review budget is spent or a later revision regressed.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' }, hash: { type: 'string', description: 'Full hash of the candidate to restore; defaults to the retained best' } }, required: ['projectDir', 'scene'] }, call: restoreTool },
  { name: 'explainer_narrate', description: 'Generate guide speech, align its spoken words locally, recompile the events against measured timestamps, render review frames, and store a padded scene audio track. Requires local uv and ffmpeg; caches voice/model downloads.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' } }, required: ['projectDir', 'scene'] }, call: narrateTool },
  { name: 'explainer_align_take', description: 'Make a recorded human take the timing authority: transcribe it once, map the beats onto the actual words in order, rebind cue occurrences, and recompile. Beats the take does not say come back flagged for review or pickup, never silently invented.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' }, audioPath: { type: 'string' }, audioUrl: { type: 'string' } }, required: ['projectDir', 'scene'] }, call: alignTakeTool },
  { name: 'explainer_review_object', description: 'Isolated object-performance review (required before finishing when a library object performs): render the accepted asset alone at display size, drive each clip through rest/action/settle, capture frames, check fidelity against the original, and write the review receipt.', inputSchema: { type: 'object', properties: { ...common, key: { type: 'string' } }, required: ['projectDir', 'key'] }, call: reviewObjectTool },
  { name: 'explainer_status', description: 'Report per-scene freshness across the pipeline: preview proof, narration, notebook application, and what is stale. Read before re-running anything; never re-narrate or re-finish blindly.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: statusTool },
  { name: 'explainer_finish', description: 'Validate the reviewed story.json bundle and apply it to its derived notebook. Rejects stale reviews and concurrent edits; preserves the base.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: finishTool },
  { name: 'explainer_export', description: 'Render the saved explainer through the product export engine, writing export.json with the MP4 URL.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: exportTool },
]
