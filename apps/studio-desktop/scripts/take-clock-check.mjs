// Earlier-review P3 (P1): a human take's clock survives alignment. The take
// starts the scene (its opening silence stays), every beat starts where its
// first word was actually said, the final beat ends at the last measured word
// — never at the old estimate — and the compiler adds no holds of its own, so
// a measured take ending at 10 s compiles to 10 s with cues on their words.
// The finished scene then keeps that clock: the take's press marks and its
// recorded length no longer move the reviewed plan. The real align_take.py
// runs with a canned transcript (fake `uv`), and the stubbed renderer calls
// the real scene-program compiler. Layout per take-alignment-e2e-check.mjs.
import { build } from 'esbuild'
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const dir = await mkdtemp(join(tmpdir(), 'take-clock-'))
const projectDir = join(dir, 'run-clock')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const SAY_1 = 'When the service comes back everyone retries together.'
const SAY_2 = 'Each client waits so retries spread out.'
// The measured take: 1.2 s of silence, beat 1 spoken 1.2 s–4.95 s, beat 2
// spoken 6.0 s on, the last word ending at exactly 10 s.
const TRANSCRIPT = [
  ['When', 1200, 1550], ['the', 1600, 1900], ['service', 2000, 2500], ['comes', 2550, 2900],
  ['back', 2950, 3250], ['everyone', 3300, 3550], ['retries', 3600, 4000], ['together.', 4050, 4550],
  ['Each', 6000, 6450], ['client', 6500, 6950], ['waits', 7000, 7450], ['so', 7500, 7800],
  ['retries', 8000, 8500], ['spread', 8600, 9100], ['out.', 9200, 10000],
].map(([word, startMs, endMs]) => ({ word, startMs, endMs }))
// Cue words: 'retries' is said at 3600 in beat 1; 'spread' at 8600 in beat 2.
const RETRIES_AT = 3600
const SPREAD_AT = 8600

try {
  // The fake uv: inject the staged transcript into the align manifest, then
  // run the real aligner with plain python3 (its transcript path is stdlib).
  await mkdir(join(dir, 'bin'), { recursive: true })
  const transcriptPath = join(dir, 'transcript.json')
  await writeFile(transcriptPath, JSON.stringify(TRANSCRIPT))
  await writeFile(join(dir, 'bin', 'uv'), `#!/bin/bash
set -euo pipefail
script=""
seen_python=0
manifest=""
for arg in "$@"; do
  if [ "$seen_python" = "1" ] && [ -z "$script" ]; then script="$arg"; fi
  if [ "$arg" = "python" ]; then seen_python=1; fi
  manifest="$arg"
done
python3 - "$manifest" <<'PYEOF'
import json, os, sys
manifest = sys.argv[1]
data = json.load(open(manifest))
data["transcript"] = json.load(open(os.environ["FAKE_TAKE_TRANSCRIPT"]))
json.dump(data, open(manifest, "w"))
PYEOF
exec python3 "$script" "$manifest"
`)
  await chmod(join(dir, 'bin', 'uv'), 0o755)
  process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`
  process.env.FAKE_TAKE_TRANSCRIPT = transcriptPath

  const program = {
    version: 1,
    cast: [{ id: 'request' }],
    beats: [
      { id: 'b1', say: SAY_1, events: [{ id: 'e1', actor: 'request', action: 'travel', to: 'service', cue: 'retries' }] },
      { id: 'b2', say: SAY_2, events: [{ id: 'e2', actor: 'scheduler', action: 'highlight', cue: 'spread' }] },
    ],
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><g id="request"><rect x="60" y="60" width="240" height="140"/></g><g id="service"><circle cx="620" cy="130" r="70"/></g><g id="scheduler"><rect x="900" y="300" width="200" height="120"/></g></svg>'
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await writeFile(join(projectDir, 'motion', 'inputs.json'), JSON.stringify({ projectId: 'nb-clock', delivery: { mode: 'human' }, scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] }))
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
  await writeFile(join(projectDir, 'explainer', 'scene.program.json'), JSON.stringify(program))
  await writeFile(join(projectDir, 'take.mp3'), 'stand-in take audio bytes')
  await writeFile(join(projectDir, 'explainer', 'story.json'), JSON.stringify({ scenes: [{ id: 'scene', file: 'scene', title: 'Retries', question: 'Why spread?', answer: 'Jitter.', review: 'States checked.', assets: [] }] }))

  // The stubbed hidden window runs the REAL scene-program compiler over a
  // hand-written unit layout (no DOM needed at this level).
  const units = [
    { id: 'request', ids: ['request'], kind: 'box', label: 'request', bbox: { x: 60, y: 60, width: 240, height: 140 }, chrome: false, children: [], actorRole: 'actor' },
    { id: 'service', ids: ['service'], kind: 'box', label: 'service', bbox: { x: 550, y: 60, width: 240, height: 140 }, chrome: false, children: [] },
    { id: 'scheduler', ids: ['scheduler'], kind: 'box', label: 'scheduler', bbox: { x: 900, y: 300, width: 200, height: 120 }, chrome: false, children: [] },
  ]
  const sceneProgramPath = fileURLToPath(new URL('../../studio-v2/src/scene-program.ts', import.meta.url))
  const motionPlanPath = fileURLToPath(new URL('../../../packages/markdown-composition/src/motion-plan.ts', import.meta.url))
  const stub = [
    `import { compileSceneProgram, sanitizeSceneProgram } from ${JSON.stringify(sceneProgramPath)}`,
    `import { motionPlanOffsetsMs } from ${JSON.stringify(motionPlanPath)}`,
    `const units = ${JSON.stringify(units)}`,
    `export const runAtomizer = async (name, svg, program) => {
      if (name === 'explainerFrame') return { ms: 0, beat: 0 }
      if (name === 'objectClipSeek') return { found: true }
      if (name !== 'reviewExplainer') return undefined
      const clean = sanitizeSceneProgram(program, units)
      if (!clean) return { errors: ['No scene program'], warnings: [], frames: [] }
      const compiled = compileSceneProgram(clean, units, { viewBox: { width: 1600, height: 900 } })
      if (!compiled) return { errors: ['Could not compile the story'], warnings: [], frames: [] }
      return { errors: [], warnings: [], frames: [0], durationMs: motionPlanOffsetsMs(compiled.plan).durationMs, program: clean, plan: compiled.plan, windows: compiled.windows }
    }`,
    `export const captureHiddenPage = async () => Buffer.from([])`,
  ].join('\n')

  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  // The bundle carries the tools AND the real composition compiler, so the
  // finished notebook compiles the way preview/export compile it.
  await writeFile(join(dir, 'entry.ts'), [
    `export { EXPLAINER_TOOLS } from ${JSON.stringify(fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url)))}`,
    `export { compileProject } from ${JSON.stringify(fileURLToPath(new URL('../../../packages/markdown-composition/src/index.ts', import.meta.url)))}`,
  ].join('\n'))
  await build({
    entryPoints: [join(dir, 'entry.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub, resolveDir: fileURLToPath(new URL('..', import.meta.url)) }))
    } }],
  })
  const { EXPLAINER_TOOLS, compileProject } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const tool = name => EXPLAINER_TOOLS.find(t => t.name === name)
  const context = { origin: 'http://fixture' }

  // The project carries the recorded take: a kept plan with press marks and a
  // camera track, longer than the spoken program (12.4 s — review and trail).
  let project = {
    version: 1, id: 'nb-clock', title: 'Clock fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {},
    recordedBlocks: { scene: { blockId: 'scene', recordingId: 'take-1', videoUrl: 'http://fixture/take.webm', durationMs: 12400, recordedAt: '2026-09-20T00:00:00.000Z', storage: 'local', keepsPlan: true, beatMarksMs: [1500, 6200], cameraUrl: 'http://fixture/camera.webm' } },
    brand: {}, theme: {},
  }
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/review-fonts')) return Response.json({ css: '', shipped: [], substituted: {} })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    if (u.endsWith('/api/assets')) return Response.json({ url: 'http://fixture/take-audio.mp3' })
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/nb-clock')) {
      if (options?.method === 'PUT') project = JSON.parse(options.body).project || JSON.parse(options.body)
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  try {
    const aligned = await tool('explainer_align_take').call({ projectDir, scene: 'scene', audioPath: 'take.mp3' }, context)
    check('a faithful take aligns clean', Array.isArray(aligned.review) && aligned.review.length === 0, JSON.stringify(aligned.review || []))

    const retimed = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.program.json'), 'utf8'))
    check('the program is marked as running on the take clock', retimed.clock === 'take', retimed.clock || '(unset)')
    const [b1, b2] = retimed.beats
    check('the opening silence stays on the clock: beat 1 keeps the take start', b1.words[0].startMs === 1200, `first word at ${b1.words[0].startMs}ms`)
    check('beat 1 runs until beat 2 actually starts', b1.durationMs === 6000, `${b1.durationMs}ms`)
    check('the final beat ends at the last measured word (10 s), not the estimate', b2.durationMs === 4000, `${b2.durationMs}ms`)
    check('later beats keep beat-local word anchors', b2.words[0].startMs === 0 && b2.words.find(w => w.word === 'spread')?.startMs === 2600, JSON.stringify(b2.words.slice(0, 2)))

    const proof = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.proof.json'), 'utf8'))
    check('the reviewed scene compiles to the take length (10 s)', proof.durationMs === 10000, `${proof.durationMs}ms`)
    const offsets = []
    proof.plan.steps.reduce((at, step) => { offsets.push(at); return at + step.motionWindowMs + step.holdMs }, 0)
    check('beats start where their first words were said', offsets[0] === 0 && offsets[1] === 6000, JSON.stringify(offsets))
    check('no holds were inserted between the beats', proof.plan.steps[0].motionWindowMs + proof.plan.steps[0].holdMs === 6000 && proof.plan.steps[1].motionWindowMs + proof.plan.steps[1].holdMs === 4000)
    check('the beat 1 cue lands on its spoken word', proof.plan.steps[0].actions[0].startMs === RETRIES_AT, `${proof.plan.steps[0].actions[0].startMs}ms`)
    check('the beat 2 cue lands on its spoken word', offsets[1] + proof.plan.steps[1].actions[0].startMs === SPREAD_AT, `${proof.plan.steps[1].actions[0].startMs}ms + ${offsets[1]}ms`)
    const narration = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.narration.json'), 'utf8'))
    check('the narration receipt covers the whole take', narration.durationMs === 10000, `${narration.durationMs}ms`)

    // The finished notebook keeps that clock: the take's press marks and its
    // longer recorded length no longer move the reviewed plan.
    await tool('explainer_finish').call({ projectDir }, context)
    const compiled = compileProject(project)
    check('the kept take does not stretch the aligned scene', compiled.scenes[0].durationSeconds === 10, `${compiled.scenes[0].durationSeconds}s`)
    const spans = compiled.scenes[0].node.attrs.motion.steps.map(step => step.motionWindowMs + step.holdMs)
    check('the press marks do not re-time the aligned plan', spans[0] === 6000 && spans[1] === 4000, JSON.stringify(spans))
  } finally {
    globalThis.fetch = previousFetch
  }
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `TAKE CLOCK CHECK FAIL (${failures})` : 'TAKE CLOCK CHECK PASS')
process.exitCode = failures ? 1 : 0
