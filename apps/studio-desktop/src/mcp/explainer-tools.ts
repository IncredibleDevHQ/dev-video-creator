import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { basename, join, resolve, relative, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { runAtomizer, captureHiddenPage } from './hidden-window'
import type { ProjectDocumentV1, MotionPlanV2 } from 'markdown-composition'
import { createDefaultBlockConfig } from 'markdown-composition'
import type { SceneProgram } from '../../../studio-v2/src/scene-program'
import type { LibraryArtwork } from '../../../studio-v2/server/appearance-library'

type Args = Record<string, unknown>
type Context = { origin: string }
type Proof = { hash: string; errors: string[]; warnings: string[]; frames: Array<{ atMs: number; path: string }>; program: SceneProgram; plan: MotionPlanV2; windows: unknown[]; durationMs: number }
const digest = (svg: string, program: unknown) => createHash('sha256').update(svg).update(JSON.stringify(program)).digest('hex')
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
// history survives the agent and the app.
const recordStage = async (context: Context, projectDir: string, stage: string, status: 'succeeded' | 'failed', detail?: unknown) => {
  const runId = basename(projectDir)
  if (!/^run-/.test(runId)) return
  try {
    await call(context, `/api/runs/${encodeURIComponent(runId)}/stages`, { stage, status, detail })
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
  await save(join(folder, `${appearance.key}.json`), appearance)
  return { key: appearance.key, reused, svgPath: join(folder, `${appearance.key}.svg`), metadataPath: join(folder, `${appearance.key}.json`), parts: appearance.parts, viewBox: appearance.viewBox, operation }
}

// The hidden renderer is shared, so keep each review and its captures together.
let reviewQueue: Promise<unknown> = Promise.resolve()
const previewTool = (args: Args, context?: Context) => {
  const work = reviewQueue.catch(() => {}).then(async () => {
    const p = paths(args)
    const svg = await readFile(p.svgPath, 'utf8')
    const program = await jsonFile(p.programPath)
    const result = await runAtomizer<Omit<Proof, 'hash' | 'frames'> & { frames: number[] }>('reviewExplainer', svg, program)
    const folder = join(p.folder, 'review', p.scene)
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
    const proof = { ...result, frames, hash: digest(svg, program) }
    await save(join(p.folder, `${p.scene}.proof.json`), proof)
    if (context) {
      await recordStage(context, p.projectDir, 'preview', result.errors.length ? 'failed' : 'succeeded', { scene: p.scene, errors: result.errors, warnings: result.warnings, durationMs: result.durationMs })
    }
    return { errors: result.errors, warnings: result.warnings, durationMs: result.durationMs, frames, proofPath: join(p.folder, `${p.scene}.proof.json`), instruction: 'Open the frame files and inspect the actual artwork, state changes, readability and motion. A schema pass is not visual approval.' }
  })
  reviewQueue = work
  return work
}

const narrateTool = async (args: Args, context: Context) => {
  const p = paths(args)
  const inputs = await jsonFile(join(p.projectDir, 'motion', 'inputs.json'))
  const program = await jsonFile(p.programPath) as SceneProgram
  const audioDir = join(p.folder, 'audio', p.scene)
  await mkdir(audioDir, { recursive: true })
  const beats: Array<{ say: string; path: string; durationMs: number; words?: SceneProgram['beats'][number]['words']; coverage?: number }> = []
  for (const beat of program.beats) {
    const name = createHash('sha256').update(JSON.stringify([beat.say, inputs.voiceReferenceId || 'default'])).digest('hex').slice(0, 16)
    const path = join(audioDir, `${name}.mp3`)
    try { await readFile(path) } catch {
      const voice = await call<{ url: string }>(context, '/api/voice', { text: beat.say, projectId: inputs.projectId, referenceId: inputs.voiceReferenceId })
      const audio = await fetch(voice.url)
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
      if (event.cue && !alignment.words?.some(w => normalize(w.word) === normalize(event.cue!))) throw new Error(`Beat ${index + 1}: cue "${event.cue}" was not aligned. Use a single spoken word captured in alignment.aligned.json`)
    }
    beat.durationMs = alignment.durationMs
    beat.words = alignment.words
  })
  await save(p.programPath, program)
  const preview = await previewTool(args)
  if (preview.errors.length) {
    await recordStage(context, p.projectDir, 'narrate', 'failed', { scene: p.scene, errors: preview.errors })
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
  await recordStage(context, p.projectDir, 'narrate', 'succeeded', { scene: p.scene, durationMs: proof.durationMs, audioUrl: track.url })
  return { ...preview, audioPath, audioUrl: track.url, alignment: 'local-whisper-word-timestamps', instruction: 'Listen to the narration and inspect these final timed frames. The MP4 will use these same durations and word anchors.' }
}

export const readExplainer = async (projectDir: string, origin?: string) => {
  const manifest = await jsonFile(join(projectDir, 'explainer', 'story.json')) as { scenes: Array<{ id: string; file: string; title: string; question: string; answer: string; review: string; assets: string[]; covers?: string[]; cast?: Array<{ key: string; status: string }> }> }
  const inputs = await jsonFile(join(projectDir, 'motion', 'inputs.json'))
  if (!Array.isArray(manifest.scenes) || !manifest.scenes.length) throw new Error('No scenes in explainer/story.json')
  const scenes: Array<(typeof manifest.scenes)[number] & { svg: string; program: SceneProgram; motion: MotionPlanV2; windows: unknown[]; durationMs: number }> = []
  for (const scene of manifest.scenes) {
    const p = paths({ projectDir, scene: scene.file })
    const svg = await readFile(p.svgPath, 'utf8')
    const program = await jsonFile(p.programPath)
    const proof = await jsonFile(join(p.folder, `${p.scene}.proof.json`)) as Proof
    if (proof.hash !== digest(svg, program) || proof.errors.length || !proof.frames.length) throw new Error(`${scene.file}: render the current revision and fix its errors before finishing`)
    if (!scene.question?.trim() || !scene.answer?.trim() || !scene.review?.trim()) throw new Error(`${scene.file}: explain the causal question, answer, and what the frame review established`)
    scenes.push({ ...scene, svg, program: proof.program, motion: proof.plan, windows: proof.windows, durationMs: proof.durationMs })
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
}

const finishTool = async (args: Args, context: Context) => {
  const projectDir = String(args.projectDir || '')
  const { scenes, inputs } = await readExplainer(projectDir, context.origin)
  const { project } = await call<{ project: ProjectDocumentV1 }>(context, `/api/projects/${encodeURIComponent(inputs.projectId)}`)
  if (!project?.derivedFrom?.notebook) throw new Error('Build an explainer in a derived video notebook; the base is preserved')
  const previous = await jsonFile(join(projectDir, 'explainer', 'receipt.json')).catch(() => null)
  const snapshot = (attrs: Record<string, unknown>) => digest(String(attrs.svg || ''), { script: attrs.script, program: attrs.program, motion: attrs.motion })
  const applied: Record<string, string> = {}
  const coversOf = (scene: (typeof scenes)[number]) => (scene.covers?.length ? scene.covers : [scene.id])
  const content = project.notebook.content
  const nodeNamed = (id: string) => content.find(n => n.attrs?.id === id)
  const inputNamed = (id: string) => inputs.scenes.find((s: { id: string }) => s.id === id)
  const unchangedFromInput = (nodeAttrs: Record<string, unknown> | undefined, id: string) => {
    const original = inputNamed(id)
    return Boolean(nodeAttrs && original && nodeAttrs.svg === original.svg && String(nodeAttrs.script || '') === String(original.script || ''))
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

  // Pass 2 — apply: clone split children, write the reviewed content, fold
  // merged pages into the surviving node's origin.
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
    const earlier = node.attrs?.explainer as { previousPresenterTracks?: unknown; previousRecording?: unknown } | undefined
    const say = scene.program.beats.map(b => b.say).join('\n\n')
    node.attrs = { ...node.attrs, title: scene.title, svg: scene.svg, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scene.svg)}`,
      program: scene.program, motion: scene.motion, windows: scene.windows, script: say, sourceText: say, scriptApproved: true, breakdownApproved: true,
      directorNotes: `${scene.question}\n${scene.answer}`, structureApproved: true, stageTrack: [], stagePlacements: null, directorAuto: null,
      explainer: { run: projectDir, question: scene.question, answer: scene.answer, assets: scene.assets, reviewed: true,
        previousPresenterTracks: earlier?.previousPresenterTracks ?? project.presenterTracks?.[scene.id] ?? [], previousRecording: earlier?.previousRecording ?? project.recordedBlocks?.[scene.id] ?? null } }
    // The surviving node remembers every base scene it now covers.
    const originScenes = [...new Set(covers.flatMap(cid => {
      const origin = nodeNamed(cid)?.attrs?.origin as { scene?: string; scenes?: string[] } | undefined
      return origin?.scenes?.length ? origin.scenes : origin?.scene ? [origin.scene] : []
    }))]
    if (originScenes.length) {
      const origin = (node.attrs.origin || {}) as Record<string, unknown>
      node.attrs.origin = { ...origin, scenes: originScenes, scene: originScenes[0] }
    }
    applied[scene.id] = snapshot(node.attrs)
    project.blocks[scene.id] = { ...(project.blocks[scene.id] || createDefaultBlockConfig(scene.id, node)), durationMs: scene.durationMs }
    // An old take cannot cover a newly composed mechanism.
    if (project.recordedBlocks) delete project.recordedBlocks[scene.id]
    const narration = await jsonFile(join(projectDir, 'explainer', `${scene.file}.narration.json`))
    const rawProgram = await jsonFile(join(projectDir, 'explainer', `${scene.file}.program.json`))
    if (narration.hash !== digest(scene.svg, rawProgram)) throw new Error(`${scene.file}: narration or picture changed; run explainer_narrate again`)
    project.presenterTracks ||= {}
    project.presenterTracks[scene.id] = [{ kind: 'narration', audioUrl: narration.audioUrl, audioKind: 'generated' }]
    // Merged-away pages leave the notebook; their origin lives on in the survivor.
    for (const extra of covers.slice(1)) {
      if (extra === scene.id) continue
      const index = content.findIndex(n => n.attrs?.id === extra)
      if (index >= 0) content.splice(index, 1)
      delete project.blocks[extra]
      delete project.presenterTracks[extra]
      if (project.recordedBlocks) delete project.recordedBlocks[extra]
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
  }
  await call(context, `/api/projects/${encodeURIComponent(project.id)}`, project, 'PUT')
  const preview = await call(context, '/api/preview', { project })
  const cast = Object.fromEntries(scenes.map(scene => [scene.id, (scene.cast || []).map(entry => `${entry.key}:${entry.status}`)]))
  await save(join(projectDir, 'explainer', 'receipt.json'), { projectId: project.id, scenes: scenes.length, applied, cast, preview, at: new Date().toISOString() })
  await recordStage(context, projectDir, 'finish', 'succeeded', { scenes: scenes.length, projectId: project.id })
  return { projectId: project.id, scenes: scenes.length, preview, next: 'The reviewed editable scenes are saved. Use explainer_export to render the video after narration is attached.' }
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
    if (node?.attrs?.svg !== scene.svg || JSON.stringify(node.attrs.program) !== JSON.stringify(scene.program) || project.blocks[scene.id]?.durationMs !== scene.durationMs) throw new Error('The saved scene differs from its reviewed performance. Apply it with explainer_finish before exporting.')
  }
  const result = await call<{ url: string; durationSeconds: number }>(context, '/api/render', project)
  const response = await fetch(result.url)
  if (!response.ok) throw new Error('Export completed but its video could not be inspected')
  const videoPath = join(projectDir, 'explainer', 'export.mp4')
  await writeFile(videoPath, Buffer.from(await response.arrayBuffer()))
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
  const exported = { ...result, durationSeconds: measuredDurationMs / 1000, expectedDurationMs, sceneHashes: scenes.map(s => digest(s.svg, s.program)), videoPath, frames, instruction: 'Inspect these frames from the actual MP4 for full-frame composition, captions, clipping and state continuity. Report any remaining visual limitation.' }
  await save(join(projectDir, 'explainer', 'export.json'), exported)
  await recordStage(context, projectDir, 'export', 'succeeded', { durationSeconds: exported.durationSeconds, scenes: scenes.length })
  return exported
}

const common = { projectDir: { type: 'string', description: 'Absolute run project directory' } }
export const EXPLAINER_TOOLS = [
  { name: 'explainer_asset', description: 'Reuse, generate, edit or animate a rich Quiver SVG. Uses the server credential and permanent asset library. Returns local SVG and metadata paths, never credentials.', inputSchema: { type: 'object', properties: { ...common, operation: { enum: ['list', 'generate', 'edit', 'animate'] }, briefPath: { type: 'string' }, brief: { type: 'object' }, key: { type: 'string' }, prompt: { type: 'string' } }, required: ['projectDir', 'operation'] }, call: assetTool },
  { name: 'explainer_preview', description: 'Compile explainer/<scene>.svg and .program.json using the production player; validate and capture before/action/settled frames. Re-run after every edit.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' } }, required: ['projectDir', 'scene'] }, call: previewTool },
  { name: 'explainer_narrate', description: 'Generate guide speech, align its spoken words locally, recompile the events against measured timestamps, render review frames, and store a padded scene audio track. Requires local uv and ffmpeg; caches voice/model downloads.', inputSchema: { type: 'object', properties: { ...common, scene: { type: 'string' } }, required: ['projectDir', 'scene'] }, call: narrateTool },
  { name: 'explainer_finish', description: 'Validate the reviewed story.json bundle and apply it to its derived notebook. Rejects stale reviews and concurrent edits; preserves the base.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: finishTool },
  { name: 'explainer_export', description: 'Render the saved explainer through the product export engine, writing export.json with the MP4 URL.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: exportTool },
]
