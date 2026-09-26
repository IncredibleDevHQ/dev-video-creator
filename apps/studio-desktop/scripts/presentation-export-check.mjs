// A presentation's PDF, exported by choice (R04 and R05 of the project-flow
// rereview). The live review exported fourteen schematic placeholders while
// the switch said "0 of 14 designed", with nothing in the file to say so,
// and the slides' own faces — named in their SVG attributes — were set in
// Times with no word that a face was missing.
//
// Here a presentation holds one designed slide and one schematic. Export
// says what it would hold first: which slides are designed, and the type —
// the faces embedded, and a face no one has. The designed slides alone make
// a one-page PDF; every slide as a draft makes two pages, the schematic
// marked as a draft on its page, the file named a draft. Both PDFs carry
// the faces the SVG names, never the default serif. A finished deck in
// faces it has is exported at once, as before.
//
// The local file store in a temp directory keeps every database out of it.
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-presentation-export-'))

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
  if (!process.env.PRESENTATION_EXPORT_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.PRESENTATION_EXPORT_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const api = async (path, init = {}) => {
  const response = await fetch(`${origin}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
  return { status: response.status, body: await response.json().catch(() => null) }
}
// What poppler reads in a PDF: its pages, its text and its fonts.
const poppler = spawnSync('pdfinfo', ['-v']).error ? null : true
const readPdf = async (href, name) => {
  const file = join(root, name)
  await writeFile(file, Buffer.from(await fetch(href).then(response => response.arrayBuffer())))
  if (!poppler) return { pages: null, text: '', fonts: '', title: '' }
  const info = spawnSync('pdfinfo', [file], { encoding: 'utf8' }).stdout
  return {
    pages: Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]),
    title: /^Title:\s+(.*)$/m.exec(info)?.[1]?.trim() || '',
    text: spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).stdout,
    fonts: spawnSync('pdffonts', [file], { encoding: 'utf8' }).stdout,
  }
}

// A deck whose slides set their text in SVG attributes, bare, as the live
// designer wrote them: a face the renderer carries, and one no one has.
const PROJECT = 'project-export'
const TITLE = 'How BoltDB works'
const slide = (label, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="${fill}"/>
<text x="160" y="220" font-size="96" fill="#111" font-family="Studio Test Serif 4, Georgia, serif">${label}</text>
<text x="160" y="420" font-size="48" fill="#111" font-family="JetBrains Mono, Consolas, monospace">page 3 · leaf</text></svg>`
const scene = (id, title, svg, pageOrigin) => ({ type: 'scene', attrs: { id, title, svg, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, pageOrigin, script: '', directorNotes: title, sourcePassages: [] } })
const PRESENTATION = {
  version: 1, id: 'nb-export', title: TITLE, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
  brand: { primary: '#16a34a', secondary: '#0f172a', accent: '#f59e0b', background: '#ffffff', text: '#111111' },
  notebook: { type: 'doc', content: [
    scene('page-1', 'One file', slide('One file — designed', '#dcfce7'), { kind: 'designed', by: 'Kimi' }),
    scene('page-2', 'Pages', slide('Pages — a schematic', '#f4f4f5'), { kind: 'schematic' }),
  ] },
  container: { id: PROJECT, kind: 'presentation' },
  source: { kind: 'url', url: 'https://example.com/boltdb', site: 'example.com', title: TITLE, readAt: new Date().toISOString() },
}

const dialogState = `() => {
  const dialog = document.getElementById('presentation-export-dialog')
  if (!dialog?.open) return null
  const ready = document.getElementById('presentation-export-ready')
  const draft = document.getElementById('presentation-export-draft')
  const type = document.getElementById('presentation-export-type')
  return { slides: document.getElementById('presentation-export-slides').textContent, type: type.hidden ? '' : type.textContent, warning: type.classList.contains('is-warning'), ready: ready.textContent, readyDisabled: ready.disabled, draft: draft.hidden ? null : draft.textContent }
}`
const exportWith = async (button, label) => {
  await evaluate(`() => { window.__downloads = []; document.getElementById('export-presentation').click(); return true }`, 'export')
  const dialog = await waitFor(dialogState, `${label}: the export dialog`, 60)
  await capture(`${label}-choice`)
  await evaluate(`() => { document.getElementById(${JSON.stringify(button)}).click(); return true }`, `${label}: choose`)
  const download = await waitFor(`() => window.__downloads?.[0] || null`, `${label}: download`, 120)
  const toast = await waitFor(`() => { const toast = document.getElementById('toast')?.textContent || ''; return /^Exported/.test(toast) ? toast : null }`, `${label}: toast`, 20)
  return { dialog, download, toast }
}

try {
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))
  const saved = await api(`/api/projects/${PRESENTATION.id}`, { method: 'PUT', body: JSON.stringify(PRESENTATION) })
  check('the presentation is saved into its project', saved.status === 200, String(saved.status))
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', 'nb-export'); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'open').catch(() => {})
  check('the presentation opens, with its export', Boolean(await waitFor(`() => document.body.dataset.notebookKind === 'presentation' && !document.getElementById('export-presentation').hidden ? true : null`, 'open')))
  // Downloads are recorded rather than saved.
  await evaluate(`() => { HTMLAnchorElement.prototype.click = function () { (window.__downloads = window.__downloads || []).push({ href: this.href, name: this.download }) }; return true }`, 'record downloads')

  // What the export would hold is said first.
  const plan = await api(`/api/projects/${PRESENTATION.id}/presentation-pdf`)
  check('the export says what it would hold: each slide\'s state, and the type', plan.body?.plan?.designed === 1 && plan.body.plan.total === 2 && JSON.stringify(plan.body.plan.slides.map(entry => entry.state)) === '["designed","schematic"]' && JSON.stringify(plan.body.plan.type.unresolved) === '["Studio Test Serif 4"]' && plan.body.plan.type.faces.includes('JetBrains Mono'), JSON.stringify(plan.body?.plan && { designed: plan.body.plan.designed, type: plan.body.plan.type }))
  const refused = await api(`/api/projects/${PRESENTATION.id}/presentation-pdf`, { method: 'POST', body: '{}' })
  check('an unfinished deck is never exported as if it were finished: it must be chosen', refused.status === 409 && /1 of 2 slides are not designed yet/.test(refused.body?.error || ''), JSON.stringify(refused))

  // The designed slides alone.
  const ready = await exportWith('presentation-export-ready', 'ready')
  check('the choice says which slides are designed and the type before anything is made', /^1 of 2 slides is designed; 1 is a schematic, not designed\. A draft marks that page as such in the file\.$/.test(ready.dialog?.slides || '') && /^Type: JetBrains Mono, embedded in the file\. “Studio Test Serif 4” cannot be had here: the PDF sets it in the fallback its drawing names\.$/.test(ready.dialog?.type || '') && ready.dialog.warning && ready.dialog.ready === 'Export ready slides (1)' && !ready.dialog.readyDisabled && ready.dialog.draft === 'Export all 2 as a draft', JSON.stringify(ready.dialog))
  const readyPdf = ready.download ? await readPdf(ready.download.href, 'ready.pdf') : null
  check('the designed slides alone make a one-page PDF, named as the deck', ready.download?.name === `${TITLE}.pdf` && (readyPdf?.pages === 1 || !poppler) && /Exported the 1 designed slide — 1 not designed yet was left out\. “Studio Test Serif 4” set in its fallback\./.test(ready.toast || ''), JSON.stringify({ name: ready.download?.name, pages: readyPdf?.pages, toast: ready.toast }))

  // Every slide, as a draft.
  await sleep(4500)
  const draft = await exportWith('presentation-export-draft', 'draft')
  const draftPdf = draft.download ? await readPdf(draft.download.href, 'draft.pdf') : null
  check('every slide as a draft makes two pages, the file named a draft', draft.download?.name === `${TITLE} — draft.pdf` && (draftPdf?.pages === 2 || !poppler) && /^Exported all 2 slides as a draft — 1 marked as not designed yet\./.test(draft.toast || ''), JSON.stringify({ name: draft.download?.name, pages: draftPdf?.pages, toast: draft.toast }))
  if (poppler && process.env.PRESENTATION_EXPORT_CAPTURE_DIR) await writeFile(join(process.env.PRESENTATION_EXPORT_CAPTURE_DIR, 'pdf-fonts.txt'), `The draft PDF's fonts, read by pdffonts:\n\n${draftPdf.fonts}`)
  if (poppler) {
    const pages = draftPdf.text.split('\f')
    check('the schematic is marked a draft on its own page, in the file; the designed slide is not', /DRAFT · SCHEMATIC, NOT DESIGNED/.test(pages[1] || '') && !/DRAFT/.test(pages[0] || '') && /draft \(1 of 2 designed\)/.test(draftPdf.title), JSON.stringify({ title: draftPdf.title, first: (pages[0] || '').trim().slice(0, 60), second: (pages[1] || '').trim().slice(0, 80) }))
    check('both PDFs carry the face the SVG names, embedded — never the default serif', /JetBrainsMono/.test(readyPdf.fonts) && /JetBrainsMono/.test(draftPdf.fonts) && !/Times/.test(readyPdf.fonts + draftPdf.fonts), readyPdf.fonts.split('\n').slice(2).map(line => line.split(/\s+/)[0]).filter(Boolean).join(', '))
  } else console.log('NOTE  poppler (pdfinfo, pdftotext, pdffonts) is not installed: the PDFs\' pages, marks and fonts were not read')

  // The stage draws the same slide live, in a video made from the deck:
  // its bare list quoted, so it is set in the faces it names, and those
  // faces asked for — as in the PDF (R05).
  const forked = await api(`/api/projects/${PRESENTATION.id}/fork`, { method: 'POST', body: JSON.stringify({ forkKey: 'export-check-video', title: `${TITLE} · video` }) })
  const videoId = forked.body?.project?.id
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(videoId)}); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'open the video').catch(() => {})
  const stage = await waitFor(`() => {
    const texts = [...document.querySelectorAll('#scene-stage-reference svg text[font-family]')]
    if (texts.length < 2) return null
    return { attributes: texts.map(text => text.getAttribute('font-family')), computed: getComputedStyle(texts[0]).fontFamily, links: [...document.querySelectorAll('link[data-page-font]')].map(link => link.dataset.pageFont) }
  }`, 'the stage', 90)
  await capture('03-stage')
  check('the stage sets the slide in the faces it names: a bare name CSS cannot read is quoted, and the faces are asked for', stage?.attributes[0] === "'Studio Test Serif 4', 'Georgia', serif" && stage.attributes[1] === 'JetBrains Mono, Consolas, monospace' && /^"Studio Test Serif 4", Georgia, serif$/.test(stage.computed) && stage.links.includes('Studio Test Serif 4') && stage.links.includes('JetBrains Mono'), JSON.stringify(stage))

  // Finished, in faces it has: exported at once.
  const finished = { ...PRESENTATION, notebook: { type: 'doc', content: PRESENTATION.notebook.content.map(node => ({ ...node, attrs: { ...node.attrs, svg: node.attrs.svg.replace('Studio Test Serif 4, Georgia, serif', 'Inter, sans-serif'), pageOrigin: { kind: 'designed', by: 'Kimi' } } })) } }
  const stored = (await api(`/api/projects/${PRESENTATION.id}`)).body?.project
  const updated = await api(`/api/projects/${PRESENTATION.id}`, { method: 'PUT', body: JSON.stringify({ project: { ...stored, notebook: finished.notebook }, expectedProject: stored }) })
  if (updated.status !== 200) throw new Error(`finish the deck: ${updated.status} ${JSON.stringify(updated.body)}`)
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', 'nb-export'); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'reopen').catch(() => {})
  await waitFor(`() => document.body.dataset.notebookKind === 'presentation' && !document.getElementById('export-presentation').hidden ? true : null`, 'reopen')
  await evaluate(`() => { window.__downloads = []; HTMLAnchorElement.prototype.click = function () { window.__downloads.push({ href: this.href, name: this.download }) }; document.getElementById('export-presentation').click(); return true }`, 'export finished')
  const direct = await waitFor(`() => window.__downloads?.[0] ? { name: window.__downloads[0].name, dialog: document.getElementById('presentation-export-dialog').open } : null`, 'finished download', 120)
  check('a finished deck in faces it has is exported at once, with no choice to make', direct?.name === `${TITLE}.pdf` && direct.dialog === false, JSON.stringify(direct))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `PRESENTATION EXPORT CHECK FAIL (${failures})` : 'PRESENTATION EXPORT CHECK PASS')
process.exitCode = failures ? 1 : 0
