// D0a migration check: a legacy file store (notebook + object + take +
// settings) is inspected, imported into PostgreSQL + MinIO through the real
// API, verified through the product surface (project list, project document,
// object bytes), proven idempotent on a second run, and the UI import banner
// appears only while something is pending. Non-destructive: the fixture's
// files must still be there at the end. Follows notebooks-hierarchy-check.mjs.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-migration-'))
const dataDir = join(root, 'data')
const NOTEBOOK_ID = `d0a-legacy-${Date.now().toString(36)}`
const ASSET_ID = randomUUID()
const RECORDING_ID = randomUUID()
const OBJECT_KEY = `projects/${NOTEBOOK_ID}/blk-p1/${ASSET_ID}.webm`
const OBJECT_BYTES = Buffer.from('legacy recording bytes — d0a fixture')

// Lay down a legacy file store before the app boots.
await mkdir(join(dataDir, 'notebooks'), { recursive: true })
await mkdir(join(dataDir, 'objects', 'projects', NOTEBOOK_ID, 'blk-p1'), { recursive: true })
const legacyProject = {
  version: 1,
  id: NOTEBOOK_ID,
  title: 'Legacy notebook',
  notebook: { type: 'doc', content: [
    { type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Old work' }] },
    { type: 'paragraph', attrs: { id: 'blk-p1' }, content: [{ type: 'text', text: 'Recorded once.' }] },
  ] },
  fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
}
await writeFile(join(dataDir, 'notebooks', `${NOTEBOOK_ID}.json`), JSON.stringify(legacyProject))
await writeFile(join(dataDir, 'notebooks', `${NOTEBOOK_ID}.takes.json`), JSON.stringify({
  'blk-p1': { recordingId: RECORDING_ID, assetId: ASSET_ID, durationMs: 4200, recordedAt: '2026-09-01T10:00:00.000Z' },
}))
await writeFile(join(dataDir, 'objects', ...OBJECT_KEY.split('/')), OBJECT_BYTES)
await writeFile(join(dataDir, 'objects', ...OBJECT_KEY.split('/')) + '.meta.json', JSON.stringify({
  assetId: ASSET_ID, contentType: 'video/webm', byteSize: OBJECT_BYTES.length, kind: 'recording', projectId: NOTEBOOK_ID, blockId: 'blk-p1',
}))
await writeFile(join(dataDir, 'settings.json'), JSON.stringify({ 'legacy-setting': { origin: 'files' } }))

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: dataDir,
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_ENABLE_TEST_HOOKS: '1',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
  app.stdout.on('data', chunk => {
    buffer += chunk
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
  })
  app.once('exit', code => reject(new Error(`app exited (${code})`)))
})

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures += 1
}
const evaluate = async (js, label = '') => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

try {
  const inspect = await fetch(`${origin}/api/migrate/local`).then(r => r.json())
  check(
    'inspection counts the legacy store, all pending',
    inspect.local?.notebooks === 1 && inspect.local?.pendingNotebooks === 1 && inspect.local?.objects === 1 && inspect.local?.takes === 1 && inspect.local?.settings === 1,
    JSON.stringify(inspect.local),
  )

  // The UI offers the import while something is pending.
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'open studio')
  let banner = null
  for (let i = 0; i < 40; i += 1) {
    banner = await evaluate(`() => ({
      hidden: document.getElementById('migration-banner')?.hidden,
      text: document.getElementById('migration-banner-text')?.textContent || '',
    })`, 'banner').catch(() => null)
    if (banner && banner.hidden === false) break
    await sleep(400)
  }
  check('import banner appears with pending counts', Boolean(banner && banner.hidden === false && /1 notebook/.test(banner.text)), JSON.stringify(banner))

  // Drive the import from the banner button.
  await evaluate(`() => { document.getElementById('migration-import').click(); return true }`, 'click import')
  let imported = null
  for (let i = 0; i < 60; i += 1) {
    imported = await evaluate(`() => document.getElementById('migration-banner')?.hidden`, 'banner hidden').catch(() => null)
    if (imported === true) break
    await sleep(500)
  }
  check('banner import completes and hides', imported === true)

  const listed = await fetch(`${origin}/api/projects`).then(r => r.json())
  const row = listed.projects?.find(p => p.id === NOTEBOOK_ID)
  check('legacy notebook is listed from PostgreSQL', Boolean(row), JSON.stringify(row || null))
  const doc = await fetch(`${origin}/api/projects/${NOTEBOOK_ID}`).then(r => r.json())
  check('legacy notebook document survives intact', doc.project?.title === 'Legacy notebook' && doc.project?.notebook?.content?.length === 2)
  const objectResponse = await fetch(`${origin}/objects/${OBJECT_KEY}`)
  const objectBytes = Buffer.from(await objectResponse.arrayBuffer())
  check('legacy object served from MinIO with identical bytes', objectResponse.ok && objectBytes.equals(OBJECT_BYTES), `${objectBytes.length}b`)

  // A second run is a no-op: everything skipped, nothing duplicated.
  const again = await fetch(`${origin}/api/migrate/local`, { method: 'POST' }).then(r => r.json())
  const rep = again.report
  check(
    're-import is idempotent (all skipped, nothing unresolved)',
    rep?.notebooks?.skipped === 1 && rep?.notebooks?.imported === 0 && rep?.assets?.skipped === 1 && rep?.takes?.skipped === 1 && rep?.settings?.skipped === 1 && rep?.unresolved?.length === 0,
    JSON.stringify(rep),
  )

  // The banner stays quiet once nothing is pending.
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'reload studio')
  let quiet = true
  for (let i = 0; i < 25; i += 1) {
    const state = await evaluate(`() => document.getElementById('migration-banner')?.hidden`, 'banner quiet').catch(() => null)
    if (state === false) { quiet = false; break }
    await sleep(400)
  }
  check('no import offer when nothing is pending', quiet)

  // Non-destructive: the legacy files are untouched.
  const surviving = await readFile(join(dataDir, 'notebooks', `${NOTEBOOK_ID}.json`), 'utf8')
  check('legacy files left in place', JSON.parse(surviving).title === 'Legacy notebook')

  await fetch(`${origin}/api/projects/${NOTEBOOK_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebook deleted (minio object kept, tiny)')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `MIGRATION CHECK FAIL (${failures})` : 'MIGRATION CHECK PASS')
process.exitCode = failures ? 1 : 0
