// D1 site-association check: a direction read off a brand site can be saved
// as a durable theme carrying that site; reading the same site again names
// the saved theme instead of starting from scratch. A tiny fixture server
// plays the brand site. Pattern per rehearsal-check.mjs (smoke app + __eval).
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-theme-site-'))
const stamp = Date.now().toString(36)
const SITE_NAME = `Acme ${stamp}`
const PROJECT_ID = `d1-site-${stamp}`

// The brand site: a theme colour, a named brand custom property, a site name.
const brandServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' })
  response.end(`<!doctype html><html><head>
    <title>${SITE_NAME}</title>
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta name="theme-color" content="#635bff">
    <style>:root { --brand-primary: #635bff; } body { background: #f4f7fb; color: #0a2540; }</style>
  </head><body><h1>${SITE_NAME}</h1><p>Brand page.</p></body></html>`)
})
await new Promise(resolve => brandServer.listen(0, '127.0.0.1', resolve))
const brandUrl = `http://127.0.0.1:${brandServer.address().port}/`

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    STUDIO_DATA_DIR: join(root, 'data'),
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
const evalInWindow = async js => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js }),
  }).then(r => r.json())
  if (!response.ok) throw new Error(response.error || 'eval failed')
  return response.result
}
const waitFor = async (js, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evalInWindow(js).catch(() => null)
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw new Error(`waitFor timed out: ${js.slice(0, 90)}`)
}
const readAgain = async () => {
  await evalInWindow(`(() => {
    const narrative = document.getElementById('source-narrative')
    const brand = document.getElementById('source-brand-url')
    if (!narrative.value) narrative.value = 'When the service recovers, every client retries at once.'
    brand.value = ${JSON.stringify(brandUrl)}
    document.getElementById('source-read').click()
  })()`)
  await waitFor(`document.getElementById('source-step-brand')?.hidden === false`)
}

try {
  const project = {
    version: 1, id: PROJECT_ID, title: 'Site association fixture',
    notebook: { type: 'doc', content: [{ type: 'heading', attrs: { id: 'blk-h1', level: 1 }, content: [{ type: 'text', text: 'Brands' }] }] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  }
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(project) })
  await evalInWindow(`localStorage.setItem('incredible-studio-v2-active-project', '${PROJECT_ID}'); location.assign('/studio')`)
  await waitFor(`document.getElementById('project-title')?.value === ${JSON.stringify('Site association fixture')}`)

  // Create explainer → Present it myself → narrative: the source dialog opens.
  await evalInWindow(`(() => {
    document.getElementById('create-explainer').click()
    document.querySelector('#create-explainer-paths [data-delivery="human"]').click()
    document.querySelector('#create-explainer-materials [data-material="narrative"]').click()
  })()`)
  await waitFor(`document.getElementById('source-dialog')?.open === true`)

  await readAgain()
  const brandStep = await evalInWindow(`(() => ({
    site: (document.getElementById('source-read-meta')?.textContent || '').includes(${JSON.stringify(SITE_NAME)}),
    association: document.getElementById('source-theme-association')?.hidden === false,
    saveButton: !!document.getElementById('source-save-direction'),
  }))()`)
  check('the brand read reaches the brand step with the site named', brandStep.site, JSON.stringify(brandStep))
  check('the association row offers saving the direction as a theme', brandStep.association && brandStep.saveButton, JSON.stringify(brandStep))

  await evalInWindow(`document.getElementById('source-save-direction').click()`)
  let savedTheme = null
  for (let i = 0; i < 30; i += 1) {
    const { themes } = await fetch(`${origin}/api/themes`).then(r => r.json()).catch(() => ({ themes: [] }))
    savedTheme = themes.find(t => t.site === SITE_NAME)
    if (savedTheme) break
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  check('the direction is saved as a theme with the site on it', Boolean(savedTheme), savedTheme && `${savedTheme.id} rev ${savedTheme.revision}`)

  // Reading the same site again names what the library already holds.
  await evalInWindow(`document.querySelector('[data-source-back="read"]').click()`)
  await readAgain()
  const note = await evalInWindow(`document.getElementById('source-theme-association-note')?.textContent || ''`)
  check('the re-read names the saved theme for the site', note.includes('Saved from this site') && note.includes('rev 1'), note)

  if (savedTheme) await fetch(`${origin}/api/themes/${savedTheme.id}`, { method: 'DELETE' })
  await fetch(`${origin}/api/projects/${PROJECT_ID}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture theme and notebook deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  brandServer.close()
  await new Promise(resolve => setTimeout(resolve, 600))
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `THEME SITE CHECK FAIL (${failures})` : 'THEME SITE CHECK PASS')
process.exitCode = failures ? 1 : 0
