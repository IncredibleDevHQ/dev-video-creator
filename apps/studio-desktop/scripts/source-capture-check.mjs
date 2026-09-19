// D1 source-capture check: every read is persisted as an immutable,
// content-addressed source revision; re-reads are idempotent; an optional
// brand website is kept separate from the creator's words (and fails soft);
// and a light theme palette reaches the wireframe pages unforced-dark.
// Pure API level against the smoke app. Pattern per theme-library-check.mjs.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-source-'))
const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
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
const post = (path, body) =>
  fetch(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }))

const NARRATIVE = '# Retry storms\n\nWhen a service recovers, every client retries at once.\n\nJitter spreads the retries out, so the service survives.'
try {
  const first = await post('/api/source/read', { narrative: NARRATIVE })
  check('narrative read returns a source revision', Boolean(first.body.snapshot?.id && first.body.snapshot?.hash), JSON.stringify(first.body.snapshot || null))

  const second = await post('/api/source/read', { narrative: NARRATIVE })
  check('identical re-read resolves to the same revision', second.body.snapshot?.id === first.body.snapshot?.id)

  const changed = await post('/api/source/read', { narrative: `${NARRATIVE}\n\nA new paragraph changes the content.` })
  check('changed content is a new revision', changed.body.snapshot?.id && changed.body.snapshot.id !== first.body.snapshot.id)

  const stored = await fetch(`${origin}/api/source/revisions/${first.body.snapshot.id}`).then(r => r.json())
  check(
    'the revision reads back with the creator’s words intact',
    stored.revision?.kind === 'narrative' && typeof stored.revision?.content?.text === 'string' && stored.revision.content.text.includes('Jitter spreads the retries out'),
  )

  const branded = await post('/api/source/read', { narrative: NARRATIVE, brandUrl: 'http://127.0.0.1:9/brand' })
  check(
    'an unreadable brand website fails soft, words preserved',
    branded.status === 200 && branded.body.source?.text?.includes('Retry storms') && branded.body.source?.warnings?.some(w => /Brand website/.test(w)),
    JSON.stringify(branded.body.source?.warnings || []),
  )
  const brandedStored = await fetch(`${origin}/api/source/revisions/${branded.body.snapshot.id}`).then(r => r.json())
  check('failed brand evidence is not stored as fact', brandedStored.revision?.brand_content == null)

  const outline = { title: 'Retry storms', scenes: [{ title: 'The storm', kind: 'diagram', seconds: 12, idea: 'Clients retry in sync', narration: 'Everyone retries together.', parts: [], relations: [] }] }
  const palette = { candidates: [], ground: '#f4f7fb', text: '#0a2540', accent: '#635bff', secondary: '#425466', themeColor: '' }
  const fonts = { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas', seen: [] }
  const light = await post('/api/source/pages', { outline, palette, fonts, site: 'example.com', mode: 'light' })
  const dark = await post('/api/source/pages', { outline, palette, fonts, site: 'example.com', mode: 'dark' })
  const lightSvg = light.body.pages?.[0]?.svg || ''
  const darkSvg = dark.body.pages?.[0]?.svg || ''
  check('a light theme reaches the wireframe unforced', lightSvg.includes('#f4f7fb'), lightSvg.slice(0, 80))
  check('dark mode still darkens a light ground', !darkSvg.includes('#f4f7fb') && darkSvg.length > 100)
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 500))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE CAPTURE CHECK FAIL (${failures})` : 'SOURCE CAPTURE CHECK PASS')
process.exitCode = failures ? 1 : 0
