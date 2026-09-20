// Earlier-review P4 (P1): unresolved pickups must block completion. The take
// aligner reports needs-input beats; the narration receipt now carries that
// verdict, and explainer_finish refuses a scene whose latest alignment still
// needs input — naming what is missing — until the pickup is recorded and
// aligned again. The real align_take.py runs with a canned transcript (a fake
// `uv` injects it — no model download), so the refusal path is the product's
// own wiring end to end. Layout mirrors production per take-alignment-e2e.
import { build } from 'esbuild'
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const dir = await mkdtemp(join(tmpdir(), 'finish-pickup-'))
const projectDir = join(dir, 'run-pickup')
const stageCalls = []

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const SAY_1 = 'When the service comes back everyone retries together.'
const SAY_2 = 'Each client waits so retries spread out.'
const spoken = (lines, startAt = 1200, step = 400) => {
  const words = []
  let at = startAt
  for (const [lineIndex, line] of lines.entries()) {
    if (lineIndex) at += 1000
    for (const word of line.split(' ')) {
      words.push({ word, startMs: at, endMs: at + 350 })
      at += step
    }
  }
  return words
}
// The paraphrased take: beat 2 came out as different words — a pickup case.
const PARAPHRASED = spoken([SAY_1, 'Each client holds back and retries land apart.'])
const FAITHFUL = spoken([SAY_1, SAY_2])

try {
  // The fake uv: inject the staged transcript into the align manifest, then
  // run the real aligner with plain python3 (its transcript path is stdlib).
  await mkdir(join(dir, 'bin'), { recursive: true })
  const transcriptPath = join(dir, 'transcript.json')
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

  // The run: one scene whose two beats carry cue words the take must say.
  const program = {
    version: 1,
    cast: [],
    beats: [
      { id: 'b1', say: SAY_1, events: [{ id: 'e1', actor: 'request', action: 'travel', to: 'service', cue: 'retries' }] },
      { id: 'b2', say: SAY_2, events: [{ id: 'e2', actor: 'scheduler', action: 'highlight', cue: 'spread' }] },
    ],
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await writeFile(join(projectDir, 'motion', 'inputs.json'), JSON.stringify({ projectId: 'nb-pickup', delivery: { mode: 'human' }, scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] }))
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
  await writeFile(join(projectDir, 'explainer', 'scene.program.json'), JSON.stringify(program))
  await writeFile(join(projectDir, 'take.mp3'), 'stand-in take audio bytes')
  await writeFile(join(projectDir, 'explainer', 'story.json'), JSON.stringify({ scenes: [{ id: 'scene', file: 'scene', title: 'Retries', question: 'Why spread?', answer: 'Jitter.', review: 'States checked.', assets: [] }] }))

  await mkdir(join(dir, 'dist-electron'), { recursive: true })
  await symlink(fileURLToPath(new URL('../skills', import.meta.url)), join(dir, 'skills'), 'dir')
  await build({
    entryPoints: [fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'dist-electron', 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async (name, svg, program) => { if (name === "objectClipSeek") return { found: true }; if (name === "explainerFrame") return { ms: 0, beat: 0 }; const beats = (program && program.beats) || []; return { errors: [], warnings: [], frames: [0], durationMs: Math.max(1, beats.length) * 200, program, plan: { version: 2, steps: beats.map(() => ({ motionWindowMs: 100, holdMs: 100, actions: [] })) }, windows: [] } }; export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS } = await import(pathToFileURL(join(dir, 'dist-electron', 'tools.mjs')))
  const tool = name => EXPLAINER_TOOLS.find(t => t.name === name)
  const context = { origin: 'http://fixture' }

  let project = {
    version: 1, id: 'nb-pickup', title: 'Pickup fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {}, recordedBlocks: {},
  }
  let putCalls = 0
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.includes('/api/runs/') && u.endsWith('/stages')) { stageCalls.push(JSON.parse(options?.body || '{}')); return Response.json({ saved: true }) }
    if (u.endsWith('/api/assets')) return Response.json({ url: 'http://fixture/take-audio.mp3' })
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/nb-pickup')) {
      if (options?.method === 'PUT') { putCalls += 1; project = JSON.parse(options.body) }
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  try {
    // The take paraphrases beat 2: alignment reports it, the receipt carries
    // it, and the run durably waits for the person.
    await writeFile(transcriptPath, JSON.stringify(PARAPHRASED))
    const aligned = await tool('explainer_align_take').call({ projectDir, scene: 'scene', audioPath: 'take.mp3' }, context)
    check('the paraphrased beat comes back flagged', Array.isArray(aligned.review) && aligned.review.length > 0 && aligned.review.every(item => item.beat === 2), JSON.stringify(aligned.review || []))
    const receipt = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.narration.json'), 'utf8'))
    check('the narration receipt carries the unresolved pickup', receipt.alignment === 'selected-take' && Array.isArray(receipt.review) && receipt.review.length > 0, JSON.stringify({ alignment: receipt.alignment, review: receipt.review || null }).slice(0, 160))
    check('the run durably waits for the person', stageCalls.some(c => c.stage === 'align-take' && c.status === 'needs-input'), JSON.stringify(stageCalls))

    const refusal = await tool('explainer_finish').call({ projectDir }, context).then(() => '', error => String(error?.message || error))
    check('finish refuses the unresolved pickup', /still needs input/.test(refusal), refusal.slice(0, 140))
    check('the refusal names the beat and what is missing', /scene/.test(refusal) && /beat 2/.test(refusal) && /spread/.test(refusal), refusal.slice(0, 240))
    check('the refused finish applied nothing', putCalls === 0 && !project.presenterTracks?.scene, `putCalls=${putCalls}`)

    // The pickup lands: a faithful take aligns clean, and finish proceeds.
    await writeFile(transcriptPath, JSON.stringify(FAITHFUL))
    const realigned = await tool('explainer_align_take').call({ projectDir, scene: 'scene', audioPath: 'take.mp3' }, context)
    check('the faithful take clears the review', Array.isArray(realigned.review) && realigned.review.length === 0, JSON.stringify(realigned.review || []))
    const clearedReceipt = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.narration.json'), 'utf8'))
    check('the receipt no longer carries a pickup', !clearedReceipt.review?.length)
    const finished = await tool('explainer_finish').call({ projectDir }, context)
    check('finish proceeds once the pickup is resolved', finished?.projectId === 'nb-pickup' && putCalls === 1, JSON.stringify(finished).slice(0, 120))
    const applied = project.notebook.content.find(n => n.attrs?.id === 'scene')
    check('the scene is reviewed with the take as its voice', applied?.attrs?.explainer?.reviewed === true && project.presenterTracks?.scene?.[0]?.audioKind === 'recorded-mic' && project.presenterTracks?.scene?.[0]?.audioUrl === 'http://fixture/take-audio.mp3')
  } finally {
    globalThis.fetch = previousFetch
  }
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `FINISH PICKUP CHECK FAIL (${failures})` : 'FINISH PICKUP CHECK PASS')
process.exitCode = failures ? 1 : 0
