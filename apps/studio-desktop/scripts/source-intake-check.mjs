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
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-source-intake-'))

// B02 of the BoltDB review: the article's table of page types and its
// diagrams, set as the BoltDB article sets them — the table's labels in
// code, what each holds in plain cells, and a diagram longer than 600
// characters.
const HEADER_DIAGRAM = ['┌──────────────────────────────────────────┐', '│ Page header:  id │ flags │ count │ overflow │', '├──────────────────────────────────────────┤', ...Array.from({ length: 14 }, () => '│                                          │'), '│              page contents…              │', '└──────────────────────────────────────────┘'].join('\n')
const PAGE_ROWS = [['meta', 'The database’s root pointer and bookkeeping (see Layer 5)'], ['freelist', 'A list of pages that are free to be reused'], ['branch', 'Interior B+tree nodes — keys that route you to children'], ['leaf', 'The actual key-value pairs (and pointers to sub-buckets)']]
const BOLTDB = `<html><head><title>How BoltDB Works</title></head><body><article>
<h1>How BoltDB Works: A High-Level Tour</h1>
<p>BoltDB keeps a whole database in one file, and reads it through memory mapping. ${'Every read and write eventually comes down to which page, at which offset. '.repeat(6)}</p>
<h2>Layer 1: Pages</h2>
<p>That file is divided into equal-sized blocks called pages, typically 4KB each. Every page has a small header saying what it is:</p>
<pre><code>${HEADER_DIAGRAM}</code></pre>
<p>There are four kinds of page, distinguished by the <code>flags</code> field:</p>
<table><thead><tr><th>Page type</th><th>What it holds</th></tr></thead><tbody>
${PAGE_ROWS.map(([type, holds]) => `<tr><td><code>${type}</code></td><td>${holds}</td></tr>`).join('\n')}
</tbody></table>
<p>A brand-new BoltDB file is tiny: just four pages.</p>
<pre>Page 0: meta      ┐  two copies, for safety
Page 1: meta      ┘  (see Layer 5)
Page 2: freelist     "no free pages yet"
Page 3: leaf         the empty root bucket</pre>
<h2>Layer 2: The B+tree</h2>
<p>${'Branch pages route a search to the leaf that holds a key, and leaves hold the keys and values in order. '.repeat(8)}</p>
</article></body></html>`

// A stub kimi on PATH plans the outline from the run's own inputs, so the
// check can read the inputs the harness was given.
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(join(binDir, 'kimi'), `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('kimi stub 1.0'); process.exit(0) }
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
let inputs = null
try { inputs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'motion', 'inputs.json'), 'utf8')) } catch {}
if (inputs && inputs.source && typeof inputs.source.text === 'string') {
  const scenes = [1, 2].map(index => ({ title: 'Scene ' + index, idea: 'The pages of BoltDB, part ' + index + '.', kind: 'diagram', seconds: 12, parts: [{ label: 'Page', kind: 'box', detail: 'a block of the file' }], relations: [], narration: 'The pages of BoltDB.', source: [] }))
  fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title: 'How BoltDB works', targetSeconds: 24, scenes, glossary: [] }))
  fs.writeFileSync(path.join(process.cwd(), 'story', 'receipt.json'), JSON.stringify({ scenes: 2 }))
  emit({ role: 'assistant', content: 'Planned 2 scenes.' })
} else emit({ role: 'assistant', content: 'stub run' })
process.exit(0)
`)
await chmod(join(binDir, 'kimi'), 0o755)

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
  if (request.url === '/boltdb') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(BOLTDB)
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
  env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_DATA_DIR: join(root, 'data'), STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_PERSISTENCE: 'local', STUDIO_ENABLE_TEST_HOOKS: '1' },
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
  // U1: one input shows at a time; pasted text says it credits the link.
  const credit = await evaluate(`() => ({ input: window.__source.state().input, tab: document.querySelector('#source-step-read [data-source-input][aria-selected="true"]')?.dataset.sourceInput, credit: document.getElementById('source-credit').hidden ? '' : document.getElementById('source-credit').textContent, link: document.getElementById('source-url').value, linkShown: !document.getElementById('source-input-link').hidden })`, 'credit')
  check('pasting the article instead shows the text, crediting the refused link, and keeps the link', credit.input === 'text' && credit.tab === 'text' && /^Crediting 127\.0\.0\.1 as where it came from\./.test(credit.credit) && credit.link === `${web}/blocked` && !credit.linkShown, JSON.stringify(credit))
  await capture('02-read-mode')
  await evaluate(`() => { document.getElementById('source-input-tab-file').click(); document.getElementById('source-input-tab-link').click(); return true }`, 'switch inputs')
  const onLink = await evaluate(`() => ({ link: document.getElementById('source-url').value, shown: !document.getElementById('source-input-link').hidden, text: document.getElementById('source-narrative').value.length })`, 'on link')
  await evaluate(`() => { document.getElementById('source-input-tab-link').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); return true }`, 'arrow to text')
  const onText = await evaluate(`() => ({ input: window.__source.state().input, focused: document.activeElement?.id, text: document.getElementById('source-narrative').value })`, 'on text')
  check('each input keeps its draft while another is shown, and the arrow keys move between them', onLink.link === `${web}/blocked` && onLink.shown && onLink.text === ARTICLE.length && onText.input === 'text' && onText.focused === 'source-input-tab-text' && onText.text === ARTICLE, JSON.stringify({ onLink, onText: { ...onText, text: onText.text.length } }))
  await read()
  await onBrandStep()
  // U1: text without a brand website opens the saved themes; an empty
  // library offers the built-in starting themes and a theme of your own.
  const empty = await evaluate(`() => ({ panel: document.querySelector('#source-step-brand [data-brand-panel][aria-selected="true"]')?.dataset.brandPanel, hint: document.querySelector('.source-saved-themes-empty')?.textContent || '', starting: document.getElementById('source-starting').hidden ? 0 : document.querySelectorAll('#source-starting .source-direction').length, bound: document.getElementById('source-brand-bound').textContent, outline: document.getElementById('source-to-outline').textContent })`, 'empty library')
  check('text without a brand website opens the saved themes; an empty library offers starting themes and a theme of your own', empty.panel === 'saved' && /^No saved themes yet\./.test(empty.hint) && /Create a theme/.test(empty.hint) && empty.starting === 3 && /· a starting theme, default colours$/.test(empty.bound) && /^Create the project with “.+”$/.test(empty.outline), JSON.stringify(empty))
  await capture('02b-empty-library')
  const pasted = await evaluate(`() => { const source = window.__source.state().source; return { kind: source.kind, url: source.url, site: source.site, words: source.words, snapshot: window.__source.state().snapshot.id, line: document.querySelector('.source-extraction-line')?.textContent, thin: Boolean(document.querySelector('.source-extraction-thin')), outline: document.getElementById('source-to-outline').disabled } }`, 'pasted')
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
  check('a theme from default colours is saved for no site: the article was only credited', !saved?.site, JSON.stringify(saved && { site: saved.site }))

  // U1: a brand website read at the brand step, as its own step — one that
  // cannot be read says so and offers ways on; one that can suggests its
  // colours, and the bound theme says where they came from.
  await evaluate(`() => { document.getElementById('source-brand-tab-site').click(); const field = document.getElementById('source-brand-site'); field.value = ${JSON.stringify(`${web}/blocked`)}; document.getElementById('source-brand-read').click(); return true }`, 'read blocked brand')
  const brandFailed = await waitFor(`() => { const status = document.getElementById('source-brand-read-status'); return status.classList.contains('is-error') ? status.textContent : null }`, 'brand read failure', 40)
  check('a brand website that cannot be read says so, with ways on', /try again, use another website, or pick a saved theme\.$/.test(brandFailed || ''), brandFailed)
  const triedLine = await evaluate(`() => document.getElementById('source-palette-provenance').textContent`, 'tried line')
  check('its default colours then say the website was tried', /^defaults, not a brand — 127\.0\.0\.1 could not be read\./.test(triedLine), triedLine)
  await capture('03b-brand-read-failed')
  await evaluate(`() => { document.getElementById('source-brand-site').value = ${JSON.stringify(`${web}/brand`)}; document.getElementById('source-brand-read').click(); return true }`, 'read brand')
  const brandRead = await waitFor(`() => { const state = window.__source.state(); return state.source.palette.provenance === 'extracted' && !state.brandReading ? { panel: document.querySelector('#source-step-brand [data-brand-panel][aria-selected="true"]')?.dataset.brandPanel, directions: document.querySelectorAll('#source-site-directions .source-direction').length, starting: document.getElementById('source-starting').hidden, bound: document.getElementById('source-brand-bound').textContent, line: document.getElementById('source-palette-provenance').textContent, words: state.source.words } : null }`, 'brand read', 40)
  check('a brand website read at the brand step suggests its colours, and names where they came from', brandRead?.panel === 'site' && brandRead.directions === 3 && brandRead.starting === true && /· colours from 127\.0\.0\.1$/.test(brandRead.bound) && /^read from 127\.0\.0\.1/.test(brandRead.line) && brandRead.words === pasted.words, JSON.stringify(brandRead))
  await capture('03c-brand-read')

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
  // U1: a site with a saved theme is offered that theme, bound and named.
  await fill('source-theme-name', 'Brand site')
  await evaluate(`() => { document.getElementById('source-save-direction').click(); return true }`, 'save site theme')
  let siteTheme = null
  for (let i = 0; i < 40 && !siteTheme; i += 1) {
    const { themes } = await fetch(`${origin}/api/themes`).then(response => response.json())
    siteTheme = themes.find(entry => entry.name === 'Brand site') || null
    if (!siteTheme) await sleep(500)
  }
  check('a theme saved from a website\'s colours is saved for that site', siteTheme?.site === '127.0.0.1', JSON.stringify(siteTheme && { site: siteTheme.site, revision: siteTheme.revision }))
  await backToRead()
  await read()
  await onBrandStep()
  const suggested2 = await evaluate(`() => ({ choice: window.__source.state().brandChoice, panel: document.querySelector('#source-step-brand [data-brand-panel][aria-selected="true"]')?.dataset.brandPanel, picked: document.querySelector('#source-saved-themes .source-saved-theme.is-picked b')?.textContent, bound: document.getElementById('source-brand-bound').textContent, outline: document.getElementById('source-to-outline').textContent })`, 'site association')
  check('reading that site again offers its saved theme, bound and named, and any other can be chosen', suggested2.choice === 'saved' && suggested2.panel === 'saved' && suggested2.picked === 'Brand site' && /^Theme: “Brand site” · saved theme, rev 1, colours from 127\.0\.0\.1$/.test(suggested2.bound) && suggested2.outline === 'Create the project with “Brand site”', JSON.stringify(suggested2))
  await capture('05-site-association')
  await evaluate(`() => { document.querySelector('#source-directions .source-direction')?.click(); return true }`, 'pick a direction instead')
  const other = await evaluate(`() => ({ choice: window.__source.state().brandChoice, picked: Boolean(document.querySelector('#source-saved-themes .source-saved-theme.is-picked')) })`, 'another choice')
  check('choosing a direction instead binds it', other.choice === 'direction' && !other.picked, JSON.stringify(other))
  await backToRead()
  await fill('source-brand-url', `${web}/blocked`)
  await read()
  await onBrandStep()
  const unbranded = await evaluate(`() => ({ line: document.getElementById('source-palette-provenance').textContent, warnings: window.__source.state().source.warnings })`, 'unbranded')
  check('a brand website that cannot be read leaves defaults, and says why', /^defaults, not a brand — 127\.0\.0\.1 could not be read\./.test(unbranded.line) && unbranded.warnings.some(warning => /Brand website could not be read/.test(warning)), JSON.stringify(unbranded))

  // B02 of the BoltDB review: an article's table keeps every cell — each
  // page type with what it holds — and its diagrams are read whole, shown
  // before anything is planned and given to the harness as read.
  await fetch(`${origin}/api/settings/harness`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness: 'kimi', model: null } }) })
  await backToRead()
  await fill('source-brand-url', '')
  await evaluate(`() => { document.querySelector('#source-step-read [data-source-input="link"]')?.click(); return true }`, 'link input')
  await fill('source-url', `${web}/boltdb`)
  await read()
  await onBrandStep()
  const table = PAGE_ROWS.map(([type, holds]) => `| ${type} | ${holds} |`)
  const shown = await evaluate(`() => ({ text: window.__source.state().source.text, line: document.querySelector('.source-extraction-line')?.textContent, whole: document.querySelector('.source-extraction-text pre')?.textContent || '', cuts: document.querySelector('.source-extraction-cuts')?.textContent || '' })`, 'boltdb read')
  check('every page type is read with what it holds, as a table', shown.text.includes('| Page type | What it holds |') && table.every(row => shown.text.includes(row)), JSON.stringify(table.filter(row => !shown.text.includes(row))))
  check('its diagrams are read whole, lines intact', shown.text.includes('```\n' + HEADER_DIAGRAM + '\n```') && shown.text.includes('Page 3: leaf         the empty root bucket'), `${HEADER_DIAGRAM.length} characters`)
  check('the source step counts its table and code, shows the whole text read, and nothing was cut', /· 1 table · 2 code blocks · read from 127\.0\.0\.1$/.test(shown.line || '') && table.every(row => shown.whole.includes(row)) && shown.whole.includes(HEADER_DIAGRAM) && !shown.cuts, JSON.stringify({ line: shown.line, cuts: shown.cuts }))
  await capture('07-boltdb-read')
  // The four-notebook model: once the brand is chosen the import is a
  // project, and the studio opens on its text at once — nothing waits in
  // the dialog. The story run starts on the creator's harness with the
  // article as read, tables and diagrams whole (B02); the wireframe is made
  // from its outline in the background, in its own notebook.
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'create the boltdb project')
  const opened = await waitFor(`() => document.getElementById('source-dialog')?.open === false && document.body.dataset.notebookKind === 'text' && document.querySelectorAll('#notebook-switch .notebook-switch-tab').length === 4 ? { id: localStorage.getItem('incredible-studio-v2-active-project'), heading: document.getElementById('notebook-title').textContent, text: document.querySelector('#editor .ProseMirror')?.innerText.slice(0, 400) || '', toast: document.getElementById('toast')?.textContent || '' } : null`, 'the text opens', 120)
  await capture('08-boltdb-text')
  check('choosing the brand opens the project on its text at once, the article as read', Boolean(opened) && opened.heading === 'The article, as text' && /How BoltDB Works: A High-Level Tour/.test(opened.text), JSON.stringify(opened && { heading: opened.heading, text: opened.text.slice(0, 60) }))
  const notice = await waitFor(`() => { const toast = document.getElementById('toast'); return toast && /is making its wireframe/.test(toast.textContent) ? toast.textContent : null }`, 'notice', 20)
  check('it says its wireframe is being made, and asks for no provider', Boolean(notice) && !/AI provider|Direct API/.test(notice), String(notice))
  const storyRun = (await fetch(`${origin}/api/runs`).then(r => r.json())).runs.find(run => run.skill === 'story-master' || /story/i.test(run.route))
  const given = storyRun ? JSON.parse(await readFile(join(storyRun.projectDir, 'motion', 'inputs.json'), 'utf8').catch(() => '{}')) : {}
  const packet = String(given.source?.text || '')
  check('the harness is given the table and the diagrams as read', table.every(row => packet.includes(row)) && packet.includes(HEADER_DIAGRAM), JSON.stringify({ run: storyRun?.route, characters: packet.length }))
  const textNotebook = opened?.id ? await fetch(`${origin}/api/projects/${encodeURIComponent(opened.id)}`).then(r => r.json()).then(body => body.project) : null
  const textOf = node => (node.content || []).map(child => child.text || textOf(child)).join('')
  const blocks = (textNotebook?.notebook?.content || []).map(node => ({ type: node.type, text: textOf(node) }))
  const fenced = blocks.filter(block => block.type === 'codeBlock').map(block => block.text)
  check('the text notebook is the article as read: its headings, its prose, its table and its diagrams whole', blocks.some(block => block.type === 'heading' && block.text === 'How BoltDB Works: A High-Level Tour') && blocks.some(block => block.type === 'paragraph' && /reads it through memory mapping/.test(block.text)) && fenced.some(text => text.includes('| Page type | What it holds |') && table.every(row => text.includes(row))) && fenced.some(text => text.includes(HEADER_DIAGRAM)), JSON.stringify(blocks.map(block => `${block.type}: ${block.text.slice(0, 40)}`)))

  // Its wireframe is made in the background; its tab says so, then that it
  // is made. B03 of the BoltDB review: made with the harness alone, its
  // pages keeping the harness's lines as their notes.
  const made = await waitFor(`() => { const status = document.querySelector('#notebook-switch [data-kind="wireframe"] small')?.textContent || ''; return status === '2 pages' ? status : null }`, 'wireframe made', 120)
  check('the wireframe is made in the background, and its tab says when', made === '2 pages', String(made))
  const view = textNotebook?.container?.id ? await fetch(`${origin}/api/containers/${encodeURIComponent(textNotebook.container.id)}`).then(r => r.json()) : null
  const wireframeRow = (view?.notebooks || []).find(entry => entry.kind === 'wireframe')
  const wireframe = wireframeRow ? await fetch(`${origin}/api/projects/${encodeURIComponent(wireframeRow.id)}`).then(r => r.json()).then(body => body.project) : null
  const lines = (wireframe?.notebook?.content || []).filter(node => node.type === 'scene').map(node => node.attrs?.script)
  check('the project is named after the article as read and holds its text and its wireframe, made from the text', view?.container?.title === 'How BoltDB Works' && JSON.stringify(view.notebooks.map(entry => entry.kind).sort()) === '["text","wireframe"]' && wireframe?.container?.from === textNotebook.id && !wireframe.build, JSON.stringify(view && { title: view.container?.title, kinds: view.notebooks.map(entry => entry.kind), place: wireframe?.container, build: wireframe?.build || null }))
  check('the wireframe is made with the harness alone, its pages keeping the harness\'s lines as their notes', lines.length === 2 && lines.every(line => line === 'The pages of BoltDB.') && wireframe.story?.wordingPolicy === 'draft' && wireframe.outline?.scenes?.length === 2, JSON.stringify({ lines, story: wireframe?.story }))

  // B04: the wireframe, opened from the switch, shows its pages — each
  // with what it explains, its notes and its source — and none of the
  // video's staging. Designing the presentation is its one way on.
  await evaluate(`() => { setTimeout(() => document.querySelector('#notebook-switch [data-kind="wireframe"]').click(), 0); return true }`, 'open the wireframe')
  const visibleJs = `const visible = element => Boolean(element) && element.getClientRects().length > 0`
  const pages = await waitFor(`() => {
    ${visibleJs}
    const blocks = [...document.querySelectorAll('#editor .notebook-scene-block')]
    const src = document.getElementById('player')?.getAttribute('src')
    const tabs = [...document.querySelectorAll('#notebook-switch .notebook-switch-tab')]
    if (document.body.dataset.notebookKind !== 'wireframe' || blocks.length !== 2 || !src || tabs.length !== 4) return null
    return {
      base: document.body.classList.contains('is-base-pages'),
      badges: blocks.map(block => block.querySelector('.scene-badge').innerText.trim()),
      posters: blocks.filter(block => visible(block.querySelector('.scene-poster'))).length,
      ideas: blocks.map(block => block.querySelector('.scene-notes-idea p')?.innerText || ''),
      notes: blocks.map(block => block.querySelector('.scene-notes-script p')?.innerText || ''),
      staging: [...new Set(blocks.flatMap(block => ['.scene-arc', '.scene-area', '[data-slide-action]', '.scene-director', '.scene-storyboard', '.scene-cues', '.block-dialogue', 'figcaption'].filter(selector => [...block.querySelectorAll(selector)].some(visible))))],
      chrome: ['#inline-preview', '#live-camera-toggle', '#render-video', '#open-fullscreen-tab', '#toggle-video-staging', '#notebook-build-status'].filter(selector => visible(document.querySelector(selector))),
      primaries: [...document.querySelectorAll('.topbar .button.primary, .commandbar .button.primary')].filter(visible).map(element => element.textContent.trim()),
      tabs: tabs.map(tab => tab.querySelector('strong').textContent + (tab.getAttribute('aria-current') === 'page' ? '*' : '') + ': ' + tab.querySelector('small').textContent).join(' · '),
      src,
    }
  }`, 'the wireframe', 60)
  const pagesCanvas = pages?.src ? await fetch(new URL(pages.src, origin)).then(response => response.text()).catch(() => '') : ''
  await capture('09-boltdb-wireframe')
  check('the wireframe shows its pages, each with what it explains and its notes', pages?.base === true && pages.posters === 2 && pages.badges.every(badge => badge === 'PAGE') && pages.ideas.join('|') === 'The pages of BoltDB, part 1.|The pages of BoltDB, part 2.' && pages.notes.every(note => note === 'The pages of BoltDB.'), JSON.stringify(pages && { base: pages.base, posters: pages.posters, badges: pages.badges, ideas: pages.ideas, notes: pages.notes }))
  check('none of the video\'s staging is in the wireframe: no dialogue, motion, director, coach, live canvas, camera or Publish; designing the presentation is its one way on', pages?.staging.length === 0 && pages.chrome.length === 0 && JSON.stringify(pages.primaries) === '["Design presentation"]', JSON.stringify(pages && { staging: pages.staging, chrome: pages.chrome, primaries: pages.primaries }))
  check('its page composition has no presenter in it', pagesCanvas.length > 0 && !pagesCanvas.includes('data-preview-presenter'), `${pagesCanvas.length} characters`)
  check('the switch shows the project: its text and wireframe made, its presentation and video not yet', /^Text: \d+ blocks · Wireframe\*: 2 pages · Presentation: not made yet · Video: not made yet$/.test(pages?.tabs || ''), pages?.tabs)
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
