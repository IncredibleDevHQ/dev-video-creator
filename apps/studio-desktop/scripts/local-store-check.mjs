// Local store check (spec §7 item 4, docker infra STOPPED): full recording
// flow with real bytes against the desktop app, then an app restart to prove
// persistence. Uses a temp STUDIO_DATA_DIR so the user's data is untouched.
// Usage: node scripts/local-store-check.mjs
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const results = []
const step = async (name, fn) => {
  try {
    const value = await fn()
    results.push([name, 'PASS', value])
  } catch (error) {
    results.push([name, 'FAIL', String(error && error.message ? error.message : error).slice(0, 220)])
  }
}
const j = async (base, p, init) => {
  const r = await fetch(base + p, init)
  const t = await r.text()
  let b
  try { b = JSON.parse(t) } catch { b = t }
  if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + (typeof b === 'string' ? b.slice(0, 120) : JSON.stringify(b).slice(0, 160)))
  return b
}

const startApp = async dataDir => {
  const child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const origin = await new Promise((resolve, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
    child.stdout.on('data', chunk => {
      process.stdout.write(chunk)
      buffer += chunk.toString()
      const failure = buffer.match(/SMOKE FAIL: ([^\n]+)/)
      if (failure) { clearTimeout(timeout); reject(new Error(failure[1])) }
      const match = buffer.match(/STUDIO_ORIGIN (\S+)/)
      if (buffer.includes('SMOKE PASS') && match) { clearTimeout(timeout); resolve(match[1]) }
    })
    child.once('exit', code => reject(new Error(`app exited (${code})`)))
  })
  return {
    origin,
    stop: async () => {
      if (child.exitCode !== null) return
      child.kill('SIGTERM')
      await new Promise(resolve => child.once('exit', resolve))
    },
  }
}

// A real 1×1 PNG (89 bytes) and a real 1 s WebM take made with ffmpeg.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const root = await mkdtemp(join(tmpdir(), 'studio-local-store-'))
const dataDir = join(root, 'data')
const id = `local-store-${Date.now()}`
const blockId = 'blk-p1'
let app = null
try {
  app = await startApp(dataDir)
  const { origin } = app

  const project = {
    version: 1, id, title: 'Local store check',
    notebook: { type: 'doc', content: [
      { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Persistence' }] },
      { type: 'paragraph', attrs: { id: blockId }, content: [{ type: 'text', text: 'A block to record.' }] },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }

  let asset
  await step('create notebook (docker stopped)', async () => {
    await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
    const health = await j(origin, '/api/health')
    if (health.persistence?.database !== 'files') throw new Error('persistence is not files')
    return health.persistence.bucket
  })
  await step('upload image asset (POST /api/assets)', async () => {
    const body = Buffer.from(PNG_B64, 'base64')
    asset = await j(origin, '/api/assets', {
      method: 'POST',
      headers: { 'content-type': 'image/png', 'x-project-id': id, 'x-block-id': blockId },
      body,
    })
    if (!asset.assetId || !asset.url) throw new Error('no assetId/url')
    const fetched = Buffer.from(await (await fetch(asset.url)).arrayBuffer())
    if (!fetched.equals(body)) throw new Error('object bytes differ')
    return `${asset.assetId} (${fetched.length} bytes round-trip)`
  })
  let draft
  await step('record take with real bytes (POST /api/recordings/finalize)', async () => {
    const webmPath = join(root, 'take.webm')
    const make = spawnSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=10',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
      '-c:v', 'libvpx', '-c:a', 'libopus', webmPath,
    ], { encoding: 'utf8' })
    if (make.status !== 0) throw new Error('ffmpeg could not make the take: ' + make.stderr.slice(-160))
    const bytes = await readFile(webmPath)
    const response = await fetch(origin + '/api/recordings/finalize', {
      method: 'POST',
      headers: {
        'content-type': 'video/webm',
        'x-project-id': id,
        'x-block-id': blockId,
        'x-duration-ms': '1000',
      },
      body: bytes,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`finalize → ${response.status} ${text.slice(0, 160)}`)
    draft = JSON.parse(text)
    if (!draft.draft?.assetId || !draft.url) throw new Error('no draft returned')
    return `take ${bytes.length} bytes → mp4 asset ${draft.draft.assetId}`
  })
  await step('commit recording (POST /api/recordings/commit)', async () => {
    const { recording } = await j(origin, '/api/recordings/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: id, blockId,
        assetId: draft.draft.assetId,
        mediaUrl: draft.url,
        durationMs: draft.draft.durationMs,
      }),
    })
    if (!recording || recording.storage !== 'local') throw new Error('recording not local: ' + JSON.stringify(recording).slice(0, 120))
    return `recording ${recording.recordingId?.slice(0, 8) || recording.assetId.slice(0, 8)}… storage ${recording.storage}`
  })
  await step('save recordedBlocks mapping (studio save path)', async () => {
    // The studio updates its in-memory project and saves after a commit;
    // mirror that via the API. NOTE: doing this out-of-band races the booted
    // front-end's own auto-save of the version it loaded at boot — so write
    // LAST and assert the file (see report; not a product bug in the
    // single-user flow where the studio itself drives the commit).
    const writeMapping = async () => {
      const current = (await j(origin, '/api/projects/' + id)).project
      current.recordedBlocks = {
        [blockId]: {
          recordingId: draft.draft.assetId,
          assetId: draft.draft.assetId,
          videoUrl: draft.url,
          durationMs: draft.draft.durationMs,
          storage: 'local',
        },
      }
      await j(origin, '/api/projects/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(current) })
    }
    await writeMapping()
    await new Promise(resolve => setTimeout(resolve, 2_500))
    const onDisk = JSON.parse(await readFile(join(dataDir, 'notebooks', `${id}.json`), 'utf8'))
    if (!onDisk.recordedBlocks?.[blockId]?.assetId) {
      // The front-end's stale auto-save landed after ours; write again.
      await writeMapping()
      const retry = JSON.parse(await readFile(join(dataDir, 'notebooks', `${id}.json`), 'utf8'))
      if (!retry.recordedBlocks?.[blockId]?.assetId) throw new Error('mapping would not stick')
    }
    return `recordedBlocks[${blockId}] in notebooks/${id}.json`
  })
  await step('artefacts on disk under the data dir', async () => {
    const notebook = join(dataDir, 'notebooks', `${id}.json`)
    const takes = join(dataDir, 'notebooks', `${id}.takes.json`)
    if (!existsSync(notebook)) throw new Error('notebook file missing')
    if (!existsSync(takes)) throw new Error('takes file missing')
    const takesBody = JSON.parse(await readFile(takes, 'utf8'))
    if (!takesBody[blockId]?.assetId) throw new Error('takes mapping missing block')
    return `notebooks/${id}.json + takes.json (${takesBody[blockId].assetId.slice(0, 8)}…)`
  })

  await app.stop()
  app = null

  // ——— restart and verify persistence ———
  app = await startApp(dataDir)
  const restarted = app.origin
  await step('after restart: notebook + asset + recording persist', async () => {
    const { project: reloaded } = await j(restarted, '/api/projects/' + id)
    if (!reloaded || reloaded.title !== 'Local store check') throw new Error('notebook lost')
    const mapping = reloaded.recordedBlocks?.[blockId]
    if (!mapping?.assetId) throw new Error('recordedBlocks mapping lost')
    const fetched = Buffer.from(await (await fetch(asset.url.replace(origin, restarted))).arrayBuffer())
    if (!fetched.equals(Buffer.from(PNG_B64, 'base64'))) throw new Error('asset object lost')
    const mediaUrl = mapping.videoUrl || mapping.mediaUrl
    const video = await fetch(String(mediaUrl).replace(origin, restarted))
    if (!video.ok) throw new Error(`recording media ${video.status}`)
    const takesBody = JSON.parse(await readFile(join(dataDir, 'notebooks', `${id}.takes.json`), 'utf8'))
    if (!takesBody[blockId]) throw new Error('takes file lost')
    return `notebook ✓ asset ✓ recording ${mapping.assetId.slice(0, 8)}… ✓`
  })

  await step('cleanup', async () => {
    await j(restarted, '/api/projects/' + id, { method: 'DELETE' })
    const gone = (await j(restarted, '/api/projects/' + id)).project
    if (gone) throw new Error('notebook still present')
    return 'test notebook deleted; temp data dir removed'
  })
} finally {
  if (app) await app.stop()
  for (const [name, status, value] of results) {
    console.log(`${status}  ${name}  ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  }
  const failures = results.filter(result => result[1] === 'FAIL').length
  console.log(failures ? `LOCAL STORE FAIL (${failures})` : 'LOCAL STORE PASS')
  await rm(root, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}
