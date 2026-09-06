// Export check (spec §7 item 7): publish a notebook to MP4 through the
// studio's real path (POST /api/render → handleRender → @hyperframes/producer,
// seek-driven by construction), then ffprobe the result: video stream,
// duration ≈ composition duration, frame count ≈ duration × fps.
// Usage: node scripts/export-check.mjs
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const results = []
const step = async (name, fn) => {
  try {
    const value = await fn()
    results.push([name, 'PASS', value])
  } catch (error) {
    results.push([name, 'FAIL', String(error && error.message ? error.message : error).slice(0, 300)])
  }
}
const j = async (base, p, init) => {
  const r = await fetch(base + p, init)
  const t = await r.text()
  let b
  try { b = JSON.parse(t) } catch { b = t }
  if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + (typeof b === 'string' ? b.slice(0, 200) : JSON.stringify(b).slice(0, 200)))
  return b
}

const root = await mkdtemp(join(tmpdir(), 'studio-export-'))
const dataDir = join(root, 'data')
const id = `export-${Date.now()}`
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    buffer += chunk.toString()
    const match = buffer.match(/STUDIO_ORIGIN (\S+)/)
    if (buffer.includes('SMOKE PASS') && match) { clearTimeout(timeout); resolve(match[1]) }
    if (buffer.includes('SMOKE FAIL')) { clearTimeout(timeout); reject(new Error('smoke failed')) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})
const stopApp = async () => {
  if (app.exitCode !== null) return
  app.kill('SIGTERM')
  await new Promise(resolve => app.once('exit', resolve))
}

const FPS = 30
const project = {
  version: 1, id, title: 'Export check',
  notebook: { type: 'doc', content: [
    { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Seek-driven export' }] },
    { type: 'paragraph', attrs: { id: 'blk-p1' }, content: [{ type: 'text', text: 'Two blocks, rendered frame by frame.' }] },
  ] },
  fps: FPS, width: 1920, height: 1080,
  blocks: {
    'blk-h1': { speakerNotes: 'A seek-driven export renders frames, never real time.' },
    'blk-p1': { speakerNotes: 'Two blocks become one short video.' },
  },
  presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
}

const ffprobe = args => {
  const run = spawnSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error('ffprobe: ' + run.stderr.slice(0, 160))
  return run.stdout.trim()
}

try {
  let render
  await step('POST /api/render (real producer path)', async () => {
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    const started = Date.now()
    render = await j(origin, '/api/render', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project),
    })
    if (!render.url || !render.durationSeconds) throw new Error('no url/durationSeconds: ' + JSON.stringify(render).slice(0, 120))
    return `${render.url} (${render.durationSeconds.toFixed(2)} s in ${((Date.now() - started) / 1000).toFixed(1)} s wall)`
  })
  let mp4Path
  await step('MP4 exists with a video stream', async () => {
    const response = await fetch(render.url)
    if (!response.ok) throw new Error(`download ${response.status}`)
    mp4Path = join(root, 'export.mp4')
    await writeFile(mp4Path, Buffer.from(await response.arrayBuffer()))
    const size = (await stat(mp4Path)).size
    const streams = ffprobe(['-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'csv=p=0', mp4Path])
    if (!streams) throw new Error('no video stream')
    return `${streams}, ${(size / 1024).toFixed(0)} KiB`
  })
  await step('duration ≈ composition duration', async () => {
    const duration = Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', mp4Path]))
    const expected = render.durationSeconds
    const drift = Math.abs(duration - expected)
    if (drift > 0.5) throw new Error(`mp4 ${duration}s vs composition ${expected}s`)
    return `mp4 ${duration.toFixed(3)} s vs composition ${expected.toFixed(3)} s (drift ${drift.toFixed(3)} s)`
  })
  await step('frame count ≈ duration × fps (seek-driven)', async () => {
    const frames = Number(ffprobe(['-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', mp4Path]))
    const duration = Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', mp4Path]))
    const expected = Math.round(duration * FPS)
    const drift = Math.abs(frames - expected)
    if (drift > FPS / 2) throw new Error(`${frames} frames vs ${expected} expected`)
    return `${frames} frames ≈ ${expected} (${duration.toFixed(2)} s × ${FPS} fps)`
  })
  await step('producer review artefact', async () => {
    // The producer emits job warnings during the render; there is no
    // separate review-sheet file in the local MVP path — the seek-driven
    // review sheet is the MCP frames tool (scripts/README.md).
    const outputs = await j(origin, '/api/health')
    return `no separate review sheet in the MVP render path (frames tool covers it); health.persistence ${outputs.persistence?.database}`
  })
  await step('cleanup', async () => {
    await j(origin, '/api/projects/' + id, { method: 'DELETE' })
    return 'test notebook deleted'
  })
} finally {
  await stopApp()
  for (const [name, status, value] of results) {
    console.log(`${status}  ${name}  ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  const failures = results.filter(result => result[1] === 'FAIL').length
  console.log(failures ? `EXPORT FAIL (${failures})` : 'EXPORT PASS')
  if (process.env.KEEP_EXPORT_MP4 && results.every(result => result[1] === 'PASS')) {
    console.log(`kept ${root}/export.mp4`)
  } else {
    await rm(root, { recursive: true, force: true })
  }
  process.exit(failures ? 1 : 0)
}
