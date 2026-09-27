// The page view (the one stage layout): a wireframe's and a presentation's
// pages around one stage, as a video's scenes are. The page on show is large
// in the middle, the rail numbers every page and says how it was made, and
// the inspector holds what the page explains, its notes and its source. The
// arrow keys, Home and End, and the wheel turn the pages; O shows them all;
// F asks for the whole screen. The notebook stays one click away (Pages ·
// Notebook), on the same selection, and the view is kept.
//
// The local file store in a temp directory keeps every database out of it.
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-page-view-'))

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_DATA_DIR: join(root, 'data'), STUDIO_PERSISTENCE: 'local' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const origin = await new Promise((resolve, reject) => {
  let buffer = ''
  const timeout = setTimeout(() => reject(new Error('app start timed out')), 120_000)
  app.stdout.on('data', chunk => {
    buffer += chunk
    const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
    if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
    const failed = /SMOKE FAIL[^\n]*/.exec(buffer)
    if (failed) { clearTimeout(timeout); reject(new Error(failed[0])) }
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
const capture = async name => {
  const dir = process.env.PAGE_VIEW_SHOTS
  if (!dir) return
  await sleep(400)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const api = async (path, init = {}) => {
  const response = await fetch(`${origin}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
  return { status: response.status, body: await response.json().catch(() => null) }
}

// A project of four notebooks: its text, a wireframe of two pages, and a
// presentation of five, one of them still being designed.
const PROJECT = 'project-pages'
const TITLE = 'How BoltDB works'
const page = (label, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${fill}"/><text x="160" y="220" font-size="96" fill="#111">${label}</text></svg>`
const scene = (id, title, svg, pageOrigin, script, idea) => ({ type: 'scene', attrs: { id, title, svg, pageOrigin, script, directorNotes: idea, sourcePassages: [`BoltDB: ${title.toLowerCase()}.`] } })
const notebook = (id, kind, from, content) => ({
  version: 1, id, title: TITLE, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
  brand: { primary: '#16a34a', secondary: '#0f172a', accent: '#f59e0b', background: '#ffffff', text: '#111111' },
  notebook: { type: 'doc', content },
  container: { id: PROJECT, kind, ...(from ? { from } : {}) },
  source: { kind: 'url', url: 'https://example.com/boltdb', site: 'example.com', title: TITLE, readAt: new Date().toISOString() },
})
const TITLES = ['One file', 'Pages', 'The B+tree', 'Transactions', 'The freelist']
const TEXT = notebook('nb-text', 'text', null, [
  { type: 'heading', attrs: { id: 't-h1', level: 1 }, content: [{ type: 'text', text: TITLE }] },
  { type: 'paragraph', attrs: { id: 't-p1' }, content: [{ type: 'text', text: 'BoltDB keeps a whole database in one file.' }] },
])
const WIREFRAME = notebook('nb-wire', 'wireframe', 'nb-text', TITLES.slice(0, 2).map((title, index) => scene(`w-${index + 1}`, title, page(title, '#f4f4f5'), { kind: 'schematic' }, `${title}, in basic shapes.`, `The ${title.toLowerCase()} page.`)))
const PRESENTATION = notebook('nb-pres', 'presentation', 'nb-wire', TITLES.map((title, index) => scene(`p-${index + 1}`, title, page(`${title} — designed`, index === 3 ? '#fef3c7' : '#dcfce7'),
  index === 3 ? { kind: 'schematic', designing: { runId: 'run-1', page: 4, by: 'Kimi', placeholder: 'x' } } : { kind: 'designed', by: 'Kimi' },
  `${title}: the notes spoken over it. [pause]\n\nA second paragraph.`, `What ${title.toLowerCase()} explains.`)))

const open = async id => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'open').catch(() => {})
  return waitFor(`() => document.getElementById('project-title')?.value && document.querySelectorAll('#notebook-switch .notebook-switch-tab').length === 4 && window.__pages ? document.body.dataset.notebookKind : null`, `open ${id}`)
}
// What the page view shows now.
const view = () => evaluate(`() => {
  const visible = element => Boolean(element) && element.getClientRects().length > 0
  const root = document.getElementById('page-workspace')
  const rail = [...root.querySelectorAll('.pw-page')]
  const current = root.querySelector('.pw-page.is-current')
  return {
    on: visible(root),
    document: visible(document.querySelector('.notebook-document')),
    tabs: ['workspace-tab-pages', 'workspace-tab-notebook'].map(id => { const tab = document.getElementById(id); return visible(tab) ? tab.textContent + (tab.getAttribute('aria-pressed') === 'true' ? '*' : '') : null }),
    count: root.querySelector('.sw-rail-count')?.textContent,
    numbers: rail.map(item => item.querySelector('.pw-page-number').textContent),
    flags: rail.map(item => item.querySelector('.pw-page-flag').className.replace('pw-page-flag', '').trim()),
    current: current?.dataset.page || '',
    focused: document.activeElement?.closest?.('.pw-page')?.dataset.page || '',
    selected: window.__pages.current(),
    counter: root.querySelector('.pw-folio').textContent,
    stage: root.querySelector('.pw-slide').getAttribute('src')?.slice(0, 40) || '',
    stageFits: (() => { const stage = root.querySelector('.pw-stage').getBoundingClientRect(); const area = root.querySelector('.pw-stage-area').getBoundingClientRect(); return stage.width > 400 && stage.right <= area.right + 1 && stage.bottom <= area.bottom + 1 })(),
    badge: visible(root.querySelector('.pw-stage-badge')) ? root.querySelector('.pw-stage-badge').textContent : null,
    head: root.querySelector('.pw-inspector-head')?.innerText.replace(/\\s+/g, ' ').trim(),
    sections: [...root.querySelectorAll('.pw-section-label')].map(label => label.textContent),
    idea: root.querySelector('.pw-idea')?.textContent || '',
    notes: [...root.querySelectorAll('.pw-note')].map(note => note.textContent),
    made: root.querySelector('.pw-made')?.textContent || '',
    previous: root.querySelector('[aria-label="Previous page"]').disabled,
    next: root.querySelector('[aria-label="Next page"]').disabled,
    overview: visible(root.querySelector('.pw-overview')) ? root.querySelectorAll('.pw-overview-page').length : 0,
    notices: [...root.querySelectorAll('.pw-notices > *')].map(element => element.id),
  }
}`, 'view')
const key = (value, target = 'document.body') => evaluate(`() => { ${target}.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(value)}, bubbles: true, cancelable: true })); return true }`, `key ${value}`)
const settle = () => sleep(250)

try {
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))
  for (const entry of [TEXT, WIREFRAME, PRESENTATION]) {
    const saved = await api(`/api/projects/${entry.id}`, { method: 'PUT', body: JSON.stringify(entry) })
    if (saved.status !== 200) throw new Error(`save ${entry.id}: ${saved.status} ${JSON.stringify(saved.body)}`)
  }
  await evaluate(`() => { localStorage.removeItem('incredible-studio-v2-pages-view'); return true }`, 'fresh view')

  // ——— A presentation opens on its pages ———
  check('the presentation opens', (await open('nb-pres')) === 'presentation')
  await waitFor(`() => document.querySelectorAll('#page-workspace .pw-page').length === 5 ? true : null`, 'pages drawn', 40)
  await settle()
  let seen = await view()
  await capture('01-presentation')
  check('a presentation shows its pages around one stage, the notebook one click away', seen.on && !seen.document && JSON.stringify(seen.tabs) === JSON.stringify(['Pages*', 'Notebook']), JSON.stringify({ on: seen.on, document: seen.document, tabs: seen.tabs }))
  check('the rail numbers every page and says how each was made', seen.count === '5' && seen.numbers.join() === '01,02,03,04,05' && seen.flags.join() === 'is-good,is-good,is-good,is-busy,is-good', JSON.stringify({ count: seen.count, numbers: seen.numbers, flags: seen.flags }))
  check('the first page is on show: large, in its stage, with its words beside it', seen.current === 'p-1' && seen.selected === 'p-1' && seen.counter === '01 / 05' && seen.stage.startsWith('data:image/svg+xml') && seen.stageFits && seen.head === 'Page 1 of 5 One file' && seen.idea === 'What one file explains.' && JSON.stringify(seen.notes) === JSON.stringify(['One file: the notes spoken over it.', 'A second paragraph.']) && seen.previous && !seen.next, JSON.stringify(seen))
  check('the inspector says what the page explains, its notes, its source and how it was made', JSON.stringify(seen.sections) === JSON.stringify(['What this page explains', 'Notes', 'From the source', 'How it was made']) && /^Designed — A designed slide, drawn by Kimi\.$/.test(seen.made), JSON.stringify({ sections: seen.sections, made: seen.made }))

  // ——— The keys turn the pages ———
  await key('ArrowRight')
  await settle()
  const afterRight = await view()
  await key('End')
  await settle()
  const afterEnd = await view()
  await key('Home')
  await settle()
  const afterHome = await view()
  await key('PageDown')
  await settle()
  const afterPageDown = await view()
  await key('ArrowLeft')
  await settle()
  const afterLeft = await view()
  check('→, End, Home, PageDown and ← turn the pages, the counter and the inspector with them', afterRight.current === 'p-2' && afterRight.counter === '02 / 05' && afterRight.head === 'Page 2 of 5 Pages' && afterEnd.current === 'p-5' && afterEnd.next && afterHome.current === 'p-1' && afterPageDown.current === 'p-2' && afterLeft.current === 'p-1', JSON.stringify([afterRight.current, afterRight.counter, afterRight.head, afterEnd.current, afterHome.current, afterPageDown.current, afterLeft.current]))
  // A key typed into a field is the field's.
  await evaluate(`() => { document.getElementById('project-title').focus(); return true }`, 'focus title')
  await key('ArrowRight', 'document.getElementById("project-title")')
  await settle()
  const typing = await view()
  await evaluate(`() => { document.getElementById('project-title').blur(); return true }`, 'blur title')
  check('a key typed into a field never turns a page', typing.current === 'p-1', typing.current)

  // ——— The rail, the wheel ———
  await evaluate(`() => { document.querySelector('#page-workspace .pw-page[data-page="p-3"]').click(); return true }`, 'rail click')
  await settle()
  const clicked = await view()
  await evaluate(`() => { document.querySelector('#page-workspace .pw-page[data-page="p-3"]').focus(); return true }`, 'focus rail')
  await key('ArrowDown', 'document.activeElement')
  await settle()
  const walked = await view()
  check('a page in the rail opens it; the arrows walk the rail, the focus with the page', clicked.current === 'p-3' && walked.current === 'p-4' && walked.focused === 'p-4', JSON.stringify({ clicked: clicked.current, walked: walked.current, focused: walked.focused }))
  check('a page still being designed says so on the stage and in the inspector', walked.badge === 'Being designed' && /^Being designed — A schematic draft for now: Kimi is drawing this page/.test(walked.made), JSON.stringify({ badge: walked.badge, made: walked.made }))
  await capture('02-being-designed')
  const wheel = async deltaY => evaluate(`() => { document.querySelector('#page-workspace .pw-stage-area').dispatchEvent(new WheelEvent('wheel', { deltaY: ${deltaY}, bubbles: true, cancelable: true })); return true }`, 'wheel')
  await wheel(40)
  await wheel(40)
  await wheel(40)
  await settle()
  const wheeled = await view()
  await sleep(200)
  await wheel(-40)
  await settle()
  const wheeledBack = await view()
  check('the wheel turns one page per gesture, either way', wheeled.current === 'p-5' && wheeledBack.current === 'p-4', JSON.stringify({ wheeled: wheeled.current, back: wheeledBack.current }))

  // ——— All pages at once, and the whole screen ———
  await key('o')
  await settle()
  const overview = await view()
  const focusedCard = await evaluate(`() => document.activeElement?.dataset?.page || ''`, 'overview focus')
  await capture('03-all-pages')
  await evaluate(`() => { document.querySelector('#page-workspace .pw-overview-page[data-page="p-2"]').click(); return true }`, 'overview pick')
  await settle()
  const picked = await view()
  await key('o')
  await settle()
  await key('Escape', 'document.activeElement')
  await settle()
  const closed = await view()
  check('O shows every page at once, on the page on show; a page chosen opens; Escape closes', overview.overview === 5 && focusedCard === 'p-4' && picked.overview === 0 && picked.current === 'p-2' && closed.overview === 0 && closed.current === 'p-2', JSON.stringify({ overview: overview.overview, focusedCard, picked: picked.current, closed: closed.overview }))
  const full = await evaluate(`async () => {
    const asked = []
    const original = Element.prototype.requestFullscreen
    Element.prototype.requestFullscreen = function () { asked.push(this.className); return Promise.resolve() }
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }))
    document.querySelector('#page-workspace .pw-stage-tools .pw-tool:last-child').click()
    Element.prototype.requestFullscreen = original
    return { asked, title: document.querySelector('#page-workspace .pw-stage-tools .pw-tool:last-child').title }
  }`, 'fullscreen')
  check('F and Full screen ask for the whole screen for the stage alone', full.asked.length === 2 && full.asked.every(name => name.includes('pw-stage')) && /\(F\)$/.test(full.title), JSON.stringify(full))

  // ——— The notebook, one click away, on the same page ———
  await evaluate(`() => { document.getElementById('workspace-tab-notebook').click(); return true }`, 'notebook tab')
  await settle()
  const notebookView = await view()
  const selectedBlock = await evaluate(`() => document.querySelector('#editor .selected-block')?.id || ''`, 'selected block')
  await capture('04-notebook')
  check('Notebook shows the notebook, on the page that was on show', !notebookView.on && notebookView.document && JSON.stringify(notebookView.tabs) === JSON.stringify(['Pages', 'Notebook*']) && selectedBlock === 'p-2', JSON.stringify({ on: notebookView.on, document: notebookView.document, tabs: notebookView.tabs, selectedBlock }))
  check('the notebook is kept as the view on reopening', (await open('nb-pres')) === 'presentation' && !(await view()).on)
  await evaluate(`() => { document.getElementById('workspace-tab-pages').click(); return true }`, 'pages tab')
  await settle()
  const back = await view()
  check('Pages shows the pages again, on the same page', back.on && back.current === 'p-2', JSON.stringify({ on: back.on, current: back.current }))

  // ——— The wireframe, the same way; the text stays an article ———
  check('the wireframe opens', (await open('nb-wire')) === 'wireframe')
  await waitFor(`() => document.querySelectorAll('#page-workspace .pw-page').length === 2 ? true : null`, 'wireframe pages', 40)
  await settle()
  const wire = await view()
  await capture('05-wireframe')
  check('a wireframe shows its pages the same way, without calling each a schematic draft', wire.on && wire.count === '2' && wire.flags.every(flag => flag === '') && wire.badge === null && !wire.sections.includes('How it was made'), JSON.stringify({ on: wire.on, count: wire.count, flags: wire.flags, badge: wire.badge, sections: wire.sections }))
  check('the text opens', (await open('nb-text')) === 'text')
  await settle()
  const text = await evaluate(`() => ({ pages: document.getElementById('page-workspace').getClientRects().length > 0, switch: document.querySelector('#contextbar .view-switch').getClientRects().length > 0, article: document.querySelector('.notebook-document').getClientRects().length > 0 })`, 'text view')
  check('the text stays an article: no page view and no view switch', !text.pages && !text.switch && text.article, JSON.stringify(text))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `PAGE VIEW CHECK FAIL (${failures})` : 'PAGE VIEW CHECK PASS')
process.exitCode = failures ? 1 : 0
