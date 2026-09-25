// What the source dialog reads (F3–F5 of the Perplexity review). A link the
// publisher refuses offers to paste its text instead, crediting the link; a
// link and pasted text both present say which one is read; a thin read
// shows what was read and is outlined only when the creator says so; and
// colours say where they came from — a default is never "seen on the site",
// and a theme saved from defaults keeps a short name and says so.
//
// A small site on loopback plays the web: a refused page, a page that is
// only navigation, and a brand page. Test hooks allow loopback reads; the
// local file store in a temp directory keeps every database out of it.
import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-source-intake-'))

const site = http.createServer((request, response) => {
  if (request.url === '/blocked') {
    response.writeHead(403, { 'content-type': 'text/html' })
    response.end('<html><body><h1>Forbidden</h1></body></html>')
    return
  }
  if (request.url === '/nav') {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<html><head><title>Docs</title></head><body><nav><a href="/">Home</a> <a href="/docs">Docs</a> <a href="/pricing">Pricing</a></nav><main><p>Sign in to keep reading.</p></main><footer>© Example</footer></body></html>')
    return
  }
  if (request.url === '/brand') {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<html><head><title>Brand</title><meta name="theme-color" content="#635bff"><style>body{background:#ffffff;color:#0a2540;font-family:Inter,sans-serif}.cta{background:#635bff;color:#ffffff}.alt{color:#00a2d4}</style></head><body><header><h1>Brand</h1></header><main><p class="cta">Start now</p><p class="alt">Read the docs</p></main></body></html>')
    return
  }
  response.writeHead(404)
  response.end()
})
await new Promise(resolve => site.listen(0, '127.0.0.1', resolve))
const web = `http://127.0.0.1:${site.address().port}`

const ARTICLE = `# How dispatch reaches the experts

A mixture-of-experts layer sends each token to the GPUs that hold its experts. Inside a node the copies travel over NVLink; between nodes they travel over RDMA through the network cards.

The dispatch step splits each batch by destination. Tokens bound for a GPU in the same node are written straight into its memory, while tokens bound for the other node are staged and posted to the network card, which moves them without the GPU stopping its work.

The combine step brings every expert's result back to the GPU that sent the token, in the order the batch expects, so the next layer reads one tensor as if nothing had moved. Splitting send and receive lets a batch overlap its transfers with the experts' compute.

The same engine serves decode and prefill: decode moves many small batches with tight latency, prefill moves fewer, larger ones where bandwidth matters most. The library aggregates several network cards per GPU so one slow link does not hold a whole batch back.`

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: join(root, 'data'), STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_PERSISTENCE: 'local', STUDIO_ENABLE_TEST_HOOKS: '1' },
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
  const response = await fetch(`${origin}/__eval`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js: `(${js})()` }) })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
// SOURCE_INTAKE_CAPTURE_DIR keeps a PNG of each state the creator sees.
const capture = async name => {
  if (!process.env.SOURCE_INTAKE_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.SOURCE_INTAKE_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const fill = (id, value) => evaluate(`() => { const field = document.getElementById(${JSON.stringify(id)}); field.value = ${JSON.stringify(value)}; field.dispatchEvent(new Event('input', { bubbles: true })); return true }`, `fill ${id}`)
const read = () => evaluate(`() => { document.getElementById('source-read').click(); return true }`, 'read')
const onBrandStep = () => waitFor(`() => !document.getElementById('source-step-brand').hidden && !window.__source.state().busy ? true : null`, 'brand step', 120)
const backToRead = () => evaluate(`() => { document.querySelector('#source-step-brand [data-source-back="read"]').click(); return true }`, 'back')

try {
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'open studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))
  await evaluate(`() => { window.__source.open('link'); return true }`, 'open source')

  // F4: the publisher refuses the link — the ways on, without going round it.
  await fill('source-url', `${web}/blocked`)
  await read()
  const refused = await waitFor(`() => { const box = document.getElementById('source-recovery'); return box && !box.hidden ? { text: box.textContent, actions: [...box.querySelectorAll('button')].map(button => button.dataset.recovery), status: document.getElementById('source-status').textContent } : null }`, 'recovery', 60)
  check('a refused link offers to paste its text, try again or change it', JSON.stringify(refused?.actions) === '["paste","retry","change"]' && /403 from 127\.0\.0\.1/.test(refused.status) && /Paste the article's text below instead — 127\.0\.0\.1 is kept as where it came from/.test(refused.text), JSON.stringify(refused))
  await capture('01-refused-link')
  await evaluate(`() => { document.querySelector('#source-recovery [data-recovery="paste"]').click(); return true }`, 'paste instead')
  await fill('source-narrative', ARTICLE)
  const mode = await evaluate(`() => ({ hidden: document.getElementById('source-mode').hidden, active: document.querySelector('#source-mode [aria-pressed="true"]')?.dataset.readMode, labels: [...document.querySelectorAll('#source-mode button')].map(button => button.textContent) })`, 'mode')
  check('with a link and text both here, what is read is said and chosen', !mode.hidden && mode.active === 'text' && JSON.stringify(mode.labels) === JSON.stringify(['The link (127.0.0.1)', 'The pasted text, crediting 127.0.0.1']), JSON.stringify(mode))
  await capture('02-read-mode')
  await read()
  await onBrandStep()
  const pasted = await evaluate(`() => { const source = window.__source.state().source; return { kind: source.kind, url: source.url, site: source.site, snapshot: window.__source.state().snapshot.id, line: document.querySelector('.source-extraction-line')?.textContent, thin: Boolean(document.querySelector('.source-extraction-thin')), outline: document.getElementById('source-to-outline').disabled } }`, 'pasted')
  check('the pasted text is read, crediting the refused link', pasted.kind === 'narrative' && pasted.url === `${web}/blocked` && pasted.site === '127.0.0.1' && /^\d+ words · 1 heading · pasted, crediting 127\.0\.0\.1$/.test(pasted.line) && !pasted.thin && !pasted.outline, JSON.stringify(pasted))
  const revision = await fetch(`${origin}/api/source/revisions/${pasted.snapshot}`).then(response => response.json())
  check('the stored source keeps the link it came from', revision.revision?.kind === 'narrative' && revision.revision?.url === `${web}/blocked`, JSON.stringify({ kind: revision.revision?.kind, url: revision.revision?.url }))

  // F5: defaults say they are defaults, and a theme saved from them says so.
  const colours = await evaluate(`() => ({ line: document.getElementById('source-palette-provenance').textContent, swatch: document.querySelector('#source-swatches .source-swatch')?.title })`, 'colours')
  check('default colours are never described as seen on a website', /^defaults, not a brand — no brand website was given/.test(colours.line) && /^default \w+ — not read from a website$/.test(colours.swatch || ''), JSON.stringify(colours))
  await capture('03-default-colours')
  const suggested = await evaluate(`() => document.getElementById('source-theme-name').value`, 'theme name')
  check('the theme is offered a short name', suggested.length <= 32 && suggested.length > 0, suggested)
  await fill('source-theme-name', 'Dispatch article')
  await evaluate(`() => { document.getElementById('source-save-direction').click(); return true }`, 'save theme')
  let saved = null
  for (let i = 0; i < 40 && !saved; i += 1) {
    const { themes } = await fetch(`${origin}/api/themes`).then(response => response.json())
    saved = themes.find(entry => entry.name === 'Dispatch article') || null
    if (!saved) await sleep(500)
  }
  check('a theme saved from default colours keeps its name and says its colours are defaults', saved?.theme?.colours?.provenance === 'fallback' && saved.theme.name === 'Dispatch article', JSON.stringify(saved && { name: saved.name, colours: saved.theme?.colours }))
  const listed = await waitFor(`() => { const card = [...document.querySelectorAll('#source-saved-themes .source-saved-theme')].find(button => button.querySelector('b')?.textContent === 'Dispatch article'); return card ? card.querySelector('small')?.textContent : null }`, 'saved theme card', 20)
  check('reopened, the saved theme still says its colours are defaults', / · default colours$/.test(listed || ''), listed)

  // F3: a page that is only navigation is shown for what it is.
  await backToRead()
  await fill('source-narrative', '')
  await fill('source-url', `${web}/nav`)
  await read()
  await onBrandStep()
  const thin = await waitFor(`() => { const warn = document.querySelector('.source-extraction-thin'); return warn ? { text: warn.textContent, outline: document.getElementById('source-to-outline').disabled, open: document.querySelector('.source-extraction-read').open, excerpt: document.querySelector('.source-extraction-read blockquote').textContent, actions: [...warn.querySelectorAll('button')].map(button => button.dataset.thinAction) } : null }`, 'thin', 20)
  check('a thin read shows what was read, and is not outlined until the creator chooses', /^Only \d+ words were read from 127\.0\.0\.1 — it may be the page's navigation, not the article\./.test(thin?.text || '') && thin.outline === true && thin.open && /Sign in to keep reading/.test(thin.excerpt) && JSON.stringify(thin.actions) === '["paste","continue"]', JSON.stringify(thin))
  if (!thin) console.log('DIAGNOSIS', JSON.stringify(await evaluate(`() => ({ step: [...document.querySelectorAll('.source-step')].filter(step => !step.hidden).map(step => step.id), status: document.getElementById('source-status').textContent, brandStatus: document.getElementById('source-brand-status')?.textContent, extraction: window.__source.state().source?.extraction, url: window.__source.state().source?.url, readMode: window.__source.state().readMode })`, 'diagnosis')))
  await capture('04-thin-read')
  await evaluate(`() => { document.querySelector('[data-thin-action="continue"]').click(); return true }`, 'go on')
  const onward = await evaluate(`() => ({ outline: document.getElementById('source-to-outline').disabled, text: document.querySelector('.source-extraction-thin').textContent })`, 'onward')
  check('going on with it is the creator\'s explicit choice', onward.outline === false && /You chose to go on with it\.$/.test(onward.text), JSON.stringify(onward))
  const plain = await evaluate(`() => ({ line: document.getElementById('source-palette-provenance').textContent, provenance: window.__source.state().source.palette.provenance })`, 'plain page colours')
  check('a page that paints no colours of its own has no brand colours — a browser\'s link blue is not one', plain.provenance === 'fallback' && /^defaults, not a brand — 127\.0\.0\.1 showed no brand colours\./.test(plain.line), JSON.stringify(plain))

  // F5: colours read off a brand website say so; one that cannot be read says that.
  await backToRead()
  await fill('source-url', '')
  await fill('source-narrative', ARTICLE)
  await fill('source-brand-url', `${web}/brand`)
  await read()
  await onBrandStep()
  const branded = await evaluate(`() => ({ line: document.getElementById('source-palette-provenance').textContent, swatch: document.querySelector('#source-swatches .source-swatch')?.title, provenance: window.__source.state().source.palette.provenance })`, 'branded')
  check('colours read off the brand website say where they were read', branded.provenance === 'extracted' && /^read from 127\.0\.0\.1 — click a swatch$/.test(branded.line) && / on 127\.0\.0\.1$/.test(branded.swatch || ''), JSON.stringify(branded))
  await backToRead()
  await fill('source-brand-url', `${web}/blocked`)
  await read()
  await onBrandStep()
  const unbranded = await evaluate(`() => ({ line: document.getElementById('source-palette-provenance').textContent, warnings: window.__source.state().source.warnings })`, 'unbranded')
  check('a brand website that cannot be read leaves defaults, and says why', /^defaults, not a brand — 127\.0\.0\.1 could not be read\./.test(unbranded.line) && unbranded.warnings.some(warning => /Brand website could not be read/.test(warning)), JSON.stringify(unbranded))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  site.close()
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE INTAKE CHECK FAIL (${failures})` : 'SOURCE INTAKE CHECK PASS')
process.exitCode = failures ? 1 : 0
