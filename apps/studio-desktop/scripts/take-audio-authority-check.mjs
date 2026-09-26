// Earlier-review P6 (P2): exactly one voice per scene. The finish attaches the
// aligned take's audio as the scene's recorded-mic narration track AND keeps
// the take — so the composition must mute every other copy of that voice: the
// kept-plan camera track, the composite's take-voice element, the presenter
// fallback's audio. A scene-replacing composite take keeps its own audio as
// the one voice (narration markup never reaches those scenes), and a take the
// build never aligned is untouched. Tool-bundle pattern + the real compiler.
import { build } from 'esbuild'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const dir = await mkdtemp(join(tmpdir(), 'take-audio-'))
const projectDir = join(dir, 'run-audio')
const previousFetch = globalThis.fetch

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}

const VOICE = 'http://fixture/voice.mp3'
const audioSources = html => [...html.matchAll(/<audio\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1])
const unmutedVideos = html =>
  [...html.matchAll(/<video\b[^>]*>/g)].filter(tag => !/ muted/.test(tag)).map(tag => /\bsrc="([^"]+)"/.exec(tag)?.[1] || '(no src)')

try {
  await mkdir(join(projectDir, 'explainer'), { recursive: true })
  await mkdir(join(projectDir, 'motion'), { recursive: true })
  await writeFile(join(dir, 'entry.ts'), [
    `export { EXPLAINER_TOOLS } from ${JSON.stringify(fileURLToPath(new URL('../src/mcp/explainer-tools.ts', import.meta.url)))}`,
    `export { compileProject } from ${JSON.stringify(fileURLToPath(new URL('../../../packages/markdown-composition/src/index.ts', import.meta.url)))}`,
  ].join('\n'))
  await build({
    entryPoints: [join(dir, 'entry.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'tools.mjs'),
    plugins: [{ name: 'stub-render-window', setup(b) {
      b.onResolve({ filter: /hidden-window$/ }, () => ({ path: 'window', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const runAtomizer = async () => undefined; export const captureHiddenPage = async () => Buffer.from([]);' }))
    } }],
  })
  const { EXPLAINER_TOOLS, compileProject } = await import(pathToFileURL(join(dir, 'tools.mjs')))
  const finish = () => EXPLAINER_TOOLS.find(t => t.name === 'explainer_finish').call({ projectDir }, { origin: 'http://fixture' })

  // The reviewed scene, aligned to the selected take (its uploaded audio is
  // the narration receipt's track).
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><g id="queue"><rect x="60" y="60" width="240" height="140"/></g></svg>'
  const program = { version: 1, clock: 'take', cast: [], beats: [{ say: 'One measured line.', durationMs: 4000, events: [] }] }
  const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
  const hash = createHash('sha256').update(svg).update(stable(program)).digest('hex')
  const save = (name, value) => writeFile(join(projectDir, name), JSON.stringify(value))
  await writeFile(join(projectDir, 'explainer', 'scene.svg'), svg)
  await save('explainer/scene.program.json', program)
  await save('explainer/scene.proof.json', { hash, errors: [], warnings: [], frames: [{ atMs: 0, path: 'review.png' }], program, plan: { version: 2, steps: [{ motionWindowMs: 100, holdMs: 3900, actions: [] }] }, windows: [], durationMs: 4000 })
  await save('explainer/scene.narration.json', { hash, audioUrl: VOICE, alignment: 'selected-take', durationMs: 4000 })
  await save('explainer/story.json', { scenes: [{ id: 'scene', file: 'scene', title: 'Queue', question: 'Why?', answer: 'Because.', review: 'States checked.', assets: [] }] })
  await save('motion/inputs.json', { projectId: 'nb-audio', delivery: { mode: 'human' }, scenes: [{ id: 'scene', svg: 'wireframe', script: '' }] })

  let project = null
  globalThis.fetch = async (url, options) => {
    const u = String(url)
    if (u.endsWith('/api/review-fonts')) return Response.json({ css: '', shipped: [], substituted: {} })
    if (u.includes('/api/runs/') && u.endsWith('/stages')) return Response.json({ saved: true })
    if (u.endsWith('/api/appearance/verify-cast')) return Response.json({ ok: true, cast: [] })
    if (u.endsWith('/api/takes/clear')) return Response.json({ cleared: true })
    if (u.endsWith('/api/projects/nb-audio')) {
      if (options?.method === 'PUT') project = JSON.parse(options.body).project || JSON.parse(options.body)
      return Response.json({ project })
    }
    if (u.endsWith('/api/preview')) return Response.json({})
    throw new Error(`Unexpected fixture URL: ${url}`)
  }

  const baseProject = () => ({
    version: 1, id: 'nb-audio', title: 'Audio authority fixture', derivedFrom: { notebook: 'base' },
    notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'scene', svg: 'wireframe', script: '' } }] },
    fps: 30, width: 1920, height: 1080,
    blocks: { scene: { nodeId: 'scene', durationMs: 6000 } },
    presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  })
  const take = (extra) => ({ blockId: 'scene', recordingId: 'take-1', durationMs: 9000, recordedAt: '2026-09-20T00:00:00.000Z', storage: 'local', ...extra })
  const finishAndCompile = async recording => {
    project = { ...baseProject(), recordedBlocks: { scene: recording } }
    await finish()
    return compileProject(project)
  }

  // keepsPlan + camera: the camera rides as picture; the narration is the voice.
  const kept = await finishAndCompile(take({ videoUrl: 'http://fixture/composite-a.webm', keepsPlan: true, beatMarksMs: [1000], cameraUrl: 'http://fixture/camera-a.webm' }))
  check('kept-plan take: the aligned narration is the only audio element', audioSources(kept.html).length === 1 && audioSources(kept.html)[0] === VOICE, JSON.stringify(audioSources(kept.html)))
  check('kept-plan take: the camera track is muted picture', unmutedVideos(kept.html).length === 0 && kept.html.includes('src="http://fixture/camera-a.webm" muted'), JSON.stringify(unmutedVideos(kept.html)))
  check('kept-plan take: no composite take-voice rides along', !kept.html.includes('take-voice'))

  // keepsPlan without a camera: the composite's audio would ride as
  // take-voice — the narration replaces it.
  const keptNoCamera = await finishAndCompile(take({ videoUrl: 'http://fixture/composite-a2.webm', keepsPlan: true, beatMarksMs: [1000] }))
  check('camera-less kept-plan take: the aligned narration is the only audio element', audioSources(keptNoCamera.html).length === 1 && audioSources(keptNoCamera.html)[0] === VOICE, JSON.stringify(audioSources(keptNoCamera.html)))
  check('camera-less kept-plan take: the composite take-voice is suppressed', !keptNoCamera.html.includes('take-voice'))

  // Presenter footage: the overlay composes with the graphics, muted; the
  // narration is the voice.
  const presenter = await finishAndCompile(take({ videoUrl: 'http://fixture/presenter-b.webm', role: 'presenter' }))
  check('presenter take: the aligned narration is the only audio element', audioSources(presenter.html).length === 1 && audioSources(presenter.html)[0] === VOICE, JSON.stringify(audioSources(presenter.html)))
  check('presenter take: the overlay stays as muted picture', unmutedVideos(presenter.html).length === 0 && presenter.html.includes('src="http://fixture/presenter-b.webm" muted'), JSON.stringify(unmutedVideos(presenter.html)))

  // Composite scene recording: it replaces the scene, so its own audio is the
  // one voice — the narration markup never reaches these scenes.
  const composite = await finishAndCompile(take({ videoUrl: 'http://fixture/composite-c.webm' }))
  check('composite take: the take itself is the one voice', audioSources(composite.html).length === 1 && audioSources(composite.html)[0] === 'http://fixture/composite-c.webm', JSON.stringify(audioSources(composite.html)))
  check('composite take: the scene stays replaced and muted-picture', composite.html.includes('has-recorded-take') && unmutedVideos(composite.html).length === 0)

  // Control: takes the build never aligned keep their existing single voice —
  // the camera file's sound, or the composite's when there is no camera.
  const standaloneCamera = compileProject({ ...baseProject(), recordedBlocks: { scene: take({ videoUrl: 'http://fixture/composite-d.webm', keepsPlan: true, beatMarksMs: [1000], cameraUrl: 'http://fixture/camera-d.webm' }) } })
  check('unaligned kept-plan take: the camera still carries its voice', unmutedVideos(standaloneCamera.html).length === 1 && unmutedVideos(standaloneCamera.html)[0] === 'http://fixture/camera-d.webm' && audioSources(standaloneCamera.html).length === 0, JSON.stringify({ videos: unmutedVideos(standaloneCamera.html), audios: audioSources(standaloneCamera.html) }))
  const standaloneComposite = compileProject({ ...baseProject(), recordedBlocks: { scene: take({ videoUrl: 'http://fixture/composite-e.webm', keepsPlan: true, beatMarksMs: [1000] }) } })
  check('unaligned camera-less kept-plan take: the composite voice still plays', audioSources(standaloneComposite.html).length === 1 && audioSources(standaloneComposite.html)[0] === 'http://fixture/composite-e.webm' && standaloneComposite.html.includes('take-voice'), JSON.stringify(audioSources(standaloneComposite.html)))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  globalThis.fetch = previousFetch
  await rm(dir, { recursive: true, force: true })
}
console.log(failures ? `TAKE AUDIO AUTHORITY CHECK FAIL (${failures})` : 'TAKE AUDIO AUTHORITY CHECK PASS')
process.exitCode = failures ? 1 : 0
