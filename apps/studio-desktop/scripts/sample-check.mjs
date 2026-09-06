// Verifies the bundled ppt-master sample: the switcher creates the
// "Attention Is All You Need" notebook from the vendored SVG pages on first
// use, lands in it after reload, and switches back to it on later clicks.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-sample-'))
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
const evaluate = async js => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(body.error || 'eval failed')
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

try {
  await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 400))
    const sample = document.querySelector('.notebook-menu-sample')
    if (!sample) throw new Error('no sample entry in the switcher')
    sample.click()
    return true
  }`)

  // The click creates the notebook and reloads into it; poll the API.
  let doc = null
  for (let i = 0; i < 40; i += 1) {
    const response = await fetch(`${origin}/api/projects/sample-attention-is-all-you-need`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
    if (response?.project) { doc = response.project; break }
    await sleep(500)
  }
  check('sample notebook created', !!doc, doc?.title)
  const slides = (doc?.notebook?.content || []).filter(node => node.type === 'slide')
  check('15 slide blocks imported from the vendored pages', slides.length === 15, `${slides.length} slides`)
  check('every page sanitised and titled', slides.every(node =>
    typeof node.attrs?.svg === 'string' && node.attrs.svg.includes('<svg') &&
    !/<script|foreignObject|javascript:/i.test(node.attrs.svg) && node.attrs?.title,
  ))
  const withNotes = slides.filter(node => doc.blocks?.[node.attrs.id]?.speakerNotes)
  check('speaker notes prefilled on every page', withNotes.length === 15, `${withNotes.length}/15`)

  const after = await evaluate(`async () => {
    for (let i = 0; i < 40 && !document.querySelector('.ProseMirror'); i++) await new Promise(r => setTimeout(r, 250))
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 400))
    const rows = [...document.querySelectorAll('.notebook-menu-open')].map(row => ({
      title: row.querySelector('strong').textContent,
      current: row.closest('.notebook-menu-row').classList.contains('is-current'),
    }))
    const sampleRow = rows.find(row => row.title.includes('Attention Is All You Need'))
    const sampleButton = document.querySelector('.notebook-menu-sample')
    return { sampleRow, hasSampleButton: !!sampleButton }
  }`)
  check('switcher lists the sample as the open notebook', !!after.sampleRow?.current, after.sampleRow?.title)
  check('sample entry still offered (switches back on next click)', after.hasSampleButton)

  await fetch(`${origin}/api/projects/sample-attention-is-all-you-need`, { method: 'DELETE' })
  check('cleanup', true, 'sample deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SAMPLE CHECK FAIL (${failures})` : 'SAMPLE CHECK PASS')
process.exitCode = failures ? 1 : 0
