// D5 end-to-end human-delivery timing proof: a synthesized spoken take (the
// local system voice — a stand-in for a human recording, labeled as such)
// goes through the real aligner: the program's beats are re-timed to the
// measured delivery, cues keep their occurrences, the review list is empty
// when the take is faithful, and the stage checkpoint lands. Proves the
// alignment/compile pipeline; it does not claim a human performed.
// Skips honestly when uv or the whisper model cannot run here.
import { build } from 'esbuild'
import { mkdtemp, mkdir, readFile, rm, writeFile, access, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const exec = promisify(execFile)
const dir = await mkdtemp(join(tmpdir(), 'take-align-e2e-'))
const projectDir = join(dir, 'run-take-e2e')
const stageCalls = []

let failures = 0
let skipped = false
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const skip = reason => {
  skipped = true
  console.log(`ALIGN E2E CHECK SKIP — ${reason}`)
}

try {
  // uv drives the aligner; without it there is nothing to prove here.
  await exec('uv', ['--version'])

  // The scene: two beats, each with a cue word the take will actually say.
  const program = {
    version: 1,
    cast: [],
    beats: [
      { id: 'b1', say: 'When the service comes back, everyone retries together.', events: [{ id: 'e1', actor: 'request', action: 'travel', to: 'service', cue: 'retries' }] },
      { id: 'b2', say: 'Each client waits a different interval, so retries spread out.', events: [{ id: 'e2', actor: 'scheduler', action: 'perform', cue: 'spread', clip: { fromMs: 0, toMs: 400, durationMs: 400 } }] },
    ],
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await writeFile(join(projectDir, 'motion', 'inputs.json'), JSON.stringify({ projectId: 'nb', scenes: [{ id: 'scene', svg, script: '' }] }))
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
  await writeFile(join(projectDir, 'explainer', 'scene.program.json'), JSON.stringify(program))

  // Synthesize the take: each line spoken, a pause between — one file.
  const parts = []
  for (const [index, beat] of program.beats.entries()) {
    const aiff = join(dir, `line-${index}.aiff`)
    await exec('/usr/bin/say', ['-o', aiff, beat.say])
    parts.push(aiff)
  }
  const takeAudio = join(projectDir, 'take.mp3')
  await exec('ffmpeg', ['-y', '-loglevel', 'error',
    '-i', parts[0], '-i', parts[1],
    '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[out]',
    '-map', '[out]', '-codec:a', 'libmp3lame', takeAudio])

  // The real tool bundle, with the hidden renderer stubbed to a benign pass.
  // Layout mirrors production: dist-electron/tools.mjs with ../skills beside
  // it, the way dist-electron/worker.mjs resolves the vendored aligner.
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
  let project = {
    id: 'nb', derivedFrom: { notebook: 'base' },
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {},
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg, script: '' } }] },
  }
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.includes('/api/runs/') && u.endsWith('/stages')) {
      stageCalls.push(JSON.parse(options?.body || '{}'))
      return Response.json({ saved: true })
    }
    if (u.endsWith('/api/assets')) return Response.json({ url: 'http://fixture/take-audio.mp3' })
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.endsWith('/api/projects/nb')) {
      if (options?.method === 'PUT') project = JSON.parse(options.body)
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    throw new Error(`Unexpected fixture URL: ${url}`)
  }
  try {
    const tool = EXPLAINER_TOOLS.find(t => t.name === 'explainer_align_take')
    const result = await tool.call({ projectDir, scene: 'scene', audioPath: 'take.mp3' }, { origin: 'http://fixture' })
    check('the faithful take aligns with nothing to review', Array.isArray(result.review) && result.review.length === 0, JSON.stringify(result.review || []))

    const retimed = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.program.json'), 'utf8'))
    const [b1, b2] = retimed.beats
    check('beat durations come from the measured take', b1.durationMs > 1500 && b2.durationMs > 1500 && b1.durationMs < 12000, `${b1.durationMs}/${b2.durationMs}`)
    check('word anchors are beat-local and measured', Array.isArray(b1.words) && b1.words.length >= 7 && b1.words[0].startMs >= 0 && b1.words.at(-1).endMs <= b1.durationMs + 50, `${b1.words?.length} words`)
    const cue = b1.words.find(w => /retries/i.test(w.word))
    check('the cue word is present in the measured alignment', Boolean(cue), (b1.words || []).map(w => w.word).join(' '))
    await access(join(projectDir, 'explainer', 'scene.take-alignment.json'))
    check('the take alignment receipt is written', true)
    check('the align-take stage checkpoint landed', stageCalls.some(c => c.stage === 'align-take' && c.status === 'succeeded'), JSON.stringify(stageCalls))
    const proof = JSON.parse(await readFile(join(projectDir, 'explainer', 'scene.proof.json'), 'utf8'))
    // The product hashes a canonical key order (PG jsonb reorders keys).
    const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
    check('the preview recompiled against the take timing', proof.hash === createHash('sha256').update(svg).update(stable(retimed)).digest('hex'))

    // The human delivery path completes: the finish applies the take as the
    // scene's audio track, kind recorded — never a guide substitute.
    await writeFile(join(projectDir, 'explainer', 'story.json'), JSON.stringify({ scenes: [{ id: 'scene', file: 'scene', title: 'Mechanism', question: 'Why?', answer: 'Because.', review: 'States checked.', assets: [] }] }))
    await EXPLAINER_TOOLS.find(t => t.name === 'explainer_finish').call({ projectDir }, { origin: 'http://fixture' })
    const track = project.presenterTracks?.scene?.[0]
    check('the export carries the take, not a guide', track?.audioUrl === 'http://fixture/take-audio.mp3' && track?.audioKind === 'recorded-mic', JSON.stringify(track || null))
  } finally {
    globalThis.fetch = previousFetch
  }
} catch (error) {
  const message = String(error?.message || error)
  if (/uv|whisper|ENOTFOUND|network|fetch failed/i.test(message)) skip(message.slice(0, 200))
  else check(`run: ${message.slice(0, 250)}`, false)
} finally {
  await rm(dir, { recursive: true, force: true })
}
if (failures) console.log(`ALIGN E2E CHECK FAIL (${failures})`)
else if (!skipped) console.log('ALIGN E2E CHECK PASS')
process.exitCode = failures ? 1 : 0
