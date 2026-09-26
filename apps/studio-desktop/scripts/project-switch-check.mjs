// A project and its notebooks (the four-notebook model). A project is a
// container: its text, wireframe, presentation and video are notebooks of
// their own, each naming its project and what it is there. Every notebook
// of a project shows one switch, a tab per kind, each opening its notebook —
// or, not made yet, the notebook it is made from. Each notebook shows its
// own kind's tools: the text reads as text, the wireframe and presentation
// as pages, and only the video has the video's staging.
//
// The local file store in a temp directory keeps every database out of it.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-project-switch-'))

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  // PROJECT_SWITCH_PG=1 runs it against the Postgres store the environment
  // names (an isolated one), instead of the local files.
  env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_ENABLE_TEST_HOOKS: '1', ...(process.env.PROJECT_SWITCH_PG ? {} : { STUDIO_DATA_DIR: join(root, 'data'), STUDIO_PERSISTENCE: 'local' }) },
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
  if (!process.env.PROJECT_SWITCH_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.PROJECT_SWITCH_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const api = async (path, init = {}) => {
  const response = await fetch(`${origin}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
  return { status: response.status, body: await response.json().catch(() => null) }
}

// The project's notebooks, as the import will make them.
const PROJECT = 'project-boltdb'
const TITLE = 'How BoltDB works'
const page = (label, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${fill}"/><text x="160" y="220" font-size="96" fill="#111">${label}</text></svg>`
const scene = (id, title, svg, pageOrigin, script, idea) => ({ type: 'scene', attrs: { id, title, svg, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, pageOrigin, script, directorNotes: idea, sourcePassages: ['BoltDB keeps the whole database in one file.'] } })
const notebook = (id, kind, from, content) => ({
  version: 1, id, title: TITLE, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
  brand: { primary: '#16a34a', secondary: '#0f172a', accent: '#f59e0b', background: '#ffffff', text: '#111111' },
  notebook: { type: 'doc', content },
  container: { id: PROJECT, kind, ...(from ? { from } : {}) },
  source: { kind: 'url', url: 'https://example.com/boltdb', site: 'example.com', title: TITLE, readAt: new Date().toISOString() },
})
const TEXT = notebook('nb-text', 'text', null, [
  { type: 'heading', attrs: { id: 't-h1', level: 1 }, content: [{ type: 'text', text: 'How BoltDB works' }] },
  { type: 'paragraph', attrs: { id: 't-p1' }, content: [{ type: 'text', text: 'BoltDB keeps a whole database in one file, and reads it through memory mapping.' }] },
  { type: 'codeBlock', attrs: { id: 't-c1', language: null }, content: [{ type: 'text', text: 'Page 0: meta\nPage 1: meta\nPage 2: freelist\nPage 3: leaf' }] },
])
const WIREFRAME = notebook('nb-wire', 'wireframe', 'nb-text', [
  scene('page-1', 'One file', page('One file', '#f4f4f5'), { kind: 'schematic' }, 'BoltDB keeps one file.', 'The whole database is one file.'),
  scene('page-2', 'Pages', page('Pages', '#f4f4f5'), { kind: 'schematic' }, 'The file is cut into pages. [pause]', 'The file is divided into pages.'),
])
const PRESENTATION = notebook('nb-pres', 'presentation', 'nb-wire', [
  scene('page-1', 'One file', page('One file — designed', '#dcfce7'), { kind: 'designed', by: 'Kimi' }, 'BoltDB keeps one file.', 'The whole database is one file.'),
  scene('page-2', 'Pages', page('Pages — designed', '#dcfce7'), { kind: 'designed', by: 'Kimi' }, 'The file is cut into pages. [pause]', 'The file is divided into pages.'),
])

const open = async id => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'); localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'open').catch(() => {})
  return waitFor(`() => document.getElementById('project-title')?.value && !document.getElementById('notebook-switch').hidden && document.querySelectorAll('#notebook-switch .notebook-switch-tab').length === 4 && window.__workspace ? true : null`, `open ${id}`)
}
// What the chrome and the notebook show: the switch's tabs, and which of
// each kind's tools are on screen.
const seen = () => evaluate(`() => {
  const visible = element => Boolean(element) && element.getClientRects().length > 0
  const tabs = [...document.querySelectorAll('#notebook-switch .notebook-switch-tab')].map(tab => ({ kind: tab.dataset.kind, label: tab.querySelector('strong').textContent, status: tab.querySelector('small').textContent, current: tab.getAttribute('aria-current') === 'page', missing: tab.classList.contains('is-missing'), title: tab.title }))
  const block = document.querySelector('#editor .notebook-scene-block')
  return {
    kind: document.body.dataset.notebookKind,
    tabs,
    format: visible(document.querySelector('.format-control')),
    lineage: visible(document.getElementById('notebook-lineage')),
    canvas: visible(document.getElementById('inline-preview')),
    publish: visible(document.getElementById('render-video')),
    preview: visible(document.getElementById('open-fullscreen-tab')),
    notebookTab: visible(document.getElementById('workspace-tab-notebook')),
    next: visible(document.getElementById('next-step')) ? document.getElementById('next-step').textContent : null,
    text: document.querySelector('#editor .ProseMirror')?.innerText.slice(0, 200) || '',
    pages: document.querySelectorAll('#editor .notebook-scene-block').length,
    // A folded scene hides its head; the badge reads as its rules set it.
    badge: block ? (getComputedStyle(block.querySelector('.scene-badge-page')).display === 'none' ? 'SCENE' : 'PAGE') : null,
    notes: block ? block.querySelector('.scene-notes-script p')?.innerText || '' : null,
    staging: block ? ['.block-dialogue', '[data-slide-action]', '.scene-director', 'figcaption'].filter(selector => [...block.querySelectorAll(selector)].some(visible)) : [],
  }
}`, 'seen')
const click = kind => evaluate(`() => { setTimeout(() => document.querySelector('#notebook-switch [data-kind="${kind}"]').click(), 0); return true }`, `click ${kind}`)
const summary = tabs => tabs?.map(tab => `${tab.label}${tab.current ? '*' : ''}: ${tab.status}`).join(' · ')

try {
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))

  // The notebooks are saved into the project; the first makes it.
  for (const entry of [TEXT, WIREFRAME, PRESENTATION]) {
    const saved = await api(`/api/projects/${entry.id}`, { method: 'PUT', body: JSON.stringify(entry) })
    if (saved.status !== 200) throw new Error(`save ${entry.id}: ${saved.status} ${JSON.stringify(saved.body)}`)
  }
  const made = await api(`/api/containers/${PROJECT}`)
  const kinds = Object.fromEntries((made.body?.notebooks || []).map(entry => [entry.kind, `${entry.state}: ${entry.detail}`]))
  check('the project is made by its first notebook, named after it, and holds each notebook counted in what its kind holds', made.status === 200 && made.body.container.title === TITLE && JSON.stringify(kinds) === JSON.stringify({ presentation: 'ready: 2 slides', wireframe: 'ready: 2 pages', text: 'ready: 3 blocks' }), JSON.stringify({ status: made.status, title: made.body?.container?.title, kinds }))

  // The text: a switch with a tab per kind, and the article as text alone.
  check('the text notebook opens with the project\'s switch', Boolean(await open('nb-text')))
  const text = await seen()
  await capture('01-text')
  check('the switch has a tab per kind in the order they are made, each saying where it stands; the video is not made yet', summary(text.tabs) === 'Text*: 3 blocks · Wireframe: 2 pages · Presentation: 2 slides · Video: not made yet' && text.tabs[3].missing && /made from the presentation — open it to make the video/.test(text.tabs[3].title), summary(text.tabs))
  check('the text reads as text: no canvas, preview, Publish or next step, and no lineage or format in the chrome', text.kind === 'text' && /BoltDB keeps a whole database in one file/.test(text.text) && !text.canvas && !text.preview && !text.publish && text.next === null && !text.lineage && !text.format && !text.notebookTab, JSON.stringify({ ...text, tabs: undefined }))

  // The wireframe: its pages, and nothing of the video.
  await click('wireframe')
  const wireframe = await waitFor(`() => document.body.dataset.notebookKind === 'wireframe' && document.querySelectorAll('#editor .notebook-scene-block').length === 2 ? true : null`, 'wireframe')
  const wire = wireframe ? await seen() : null
  await capture('02-wireframe')
  check('the wireframe tab opens the wireframe notebook, current in the switch', Boolean(wire) && summary(wire.tabs) === 'Text: 3 blocks · Wireframe*: 2 pages · Presentation: 2 slides · Video: not made yet', summary(wire?.tabs))
  check('the wireframe shows its pages with their notes, and none of the video\'s staging', wire?.pages === 2 && wire.badge === 'PAGE' && wire.notes === 'BoltDB keeps one file.' && wire.staging.length === 0 && !wire.canvas && !wire.publish && !wire.preview && wire.next === null, JSON.stringify(wire && { ...wire, tabs: undefined, text: undefined }))

  // The presentation: its slides, and Create video its one way on.
  await click('presentation')
  const presentation = await waitFor(`() => document.body.dataset.notebookKind === 'presentation' && document.querySelectorAll('#editor .notebook-scene-block').length === 2 ? true : null`, 'presentation')
  const pres = presentation ? await seen() : null
  await capture('03-presentation')
  check('the presentation shows its slides with no staging, and Create video as its next step', Boolean(pres) && pres.tabs[2].current && pres.staging.length === 0 && !pres.canvas && !pres.publish && pres.next === 'Create video', JSON.stringify(pres && { ...pres, tabs: summary(pres.tabs), text: undefined }))

  // A video made from the presentation joins the project as its video.
  const forked = await api(`/api/projects/nb-pres/fork`, { method: 'POST', body: JSON.stringify({ forkKey: 'switch-check-video', title: `${TITLE} · video` }) })
  const video = forked.body?.project
  check('a video made from the presentation is the project\'s video, made from it', forked.status === 201 && video?.container?.id === PROJECT && video.container.kind === 'video' && video.container.from === 'nb-pres' && video.derivedFrom?.notebook === 'nb-pres', JSON.stringify({ status: forked.status, container: video?.container }))
  check('the video notebook opens with the switch', Boolean(await open(video?.id)))
  const videoSeen = await seen()
  await capture('04-video')
  check('in the video, the video tab is current and every notebook of the project is there', summary(videoSeen.tabs) === 'Text: 3 blocks · Wireframe: 2 pages · Presentation: 2 slides · Video*: 2 scenes' && videoSeen.kind === 'video', summary(videoSeen.tabs))
  check('the video notebook keeps its own tools: the notebook view and the video\'s staging', videoSeen.notebookTab && videoSeen.pages === 2 && videoSeen.badge === 'SCENE', JSON.stringify({ notebookTab: videoSeen.notebookTab, pages: videoSeen.pages, badge: videoSeen.badge }))

  // Back to the text from the video, in one step.
  await click('text')
  const back = await waitFor(`() => document.body.dataset.notebookKind === 'text' ? true : null`, 'back to text')
  check('from the video, the text tab opens the text', Boolean(back))

  // A project removed takes its notebooks with it.
  const removed = await api(`/api/containers/${PROJECT}`, { method: 'DELETE' })
  const gone = await api(`/api/containers/${PROJECT}`)
  const left = await api('/api/projects')
  const stillThere = (left.body?.projects || []).filter(row => row.container?.id === PROJECT).length
  check('removing the project removes its notebooks', removed.body?.deleted === true && removed.body.notebooks.length === 4 && gone.status === 404 && stillThere === 0, JSON.stringify({ removed: removed.body, gone: gone.status, stillThere }))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `PROJECT SWITCH CHECK FAIL (${failures})` : 'PROJECT SWITCH CHECK PASS')
process.exitCode = failures ? 1 : 0
