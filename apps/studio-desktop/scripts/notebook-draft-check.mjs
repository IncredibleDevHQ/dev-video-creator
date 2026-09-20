// Offline draft check: edits whose durable save fails are kept per notebook
// until a save lands. Edit a notebook during an outage, switch away (the
// switch used to clear the only cache and discard the edits), restore
// storage, return — the complete draft is back, and the first acknowledged
// save retires the draft. Pattern per take-workflow-check.mjs (smoke app +
// /__eval; the outage is a page-side fetch stub, per its failed-upload test).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-drafts-'))
const stamp = Date.now().toString(36)
const A = `draft-a-${stamp}`
const B = `draft-b-${stamp}`
const A_TITLE = 'Draft check A'
const A_EDITED = 'Draft check A · offline edit'
const B_TITLE = 'Draft check B'
const DRAFT_KEY = `incredible-studio-v2-draft-${A}`
const SCENE_SVG = '<svg viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><rect id="r1" x="40" y="40" width="200" height="120" fill="#4f46e5"/></svg>'

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
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitForTitle = async title => {
  for (let i = 0; i < 60; i += 1) {
    const current = await evalInWindow(`document.getElementById('project-title')?.value || ''`).catch(() => '')
    if (current === title) return true
    await sleep(500)
  }
  return false
}
const switchTo = async (menuTitle, expectedTitle) => {
  await evalInWindow(`(async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 600))
    const row = [...document.querySelectorAll('.notebook-menu-open')]
      .find(button => button.querySelector('strong')?.textContent === ${JSON.stringify(menuTitle)})
    if (!row) throw new Error('notebook not in the switcher: ' + ${JSON.stringify(menuTitle)})
    row.click()
    return true
  })()`)
  return waitForTitle(expectedTitle)
}
const durableTitle = async id =>
  fetch(`${origin}/api/projects/${id}`).then(r => r.json()).then(body => body.project?.title || '')

try {
  const fixture = (id, title) => ({
    version: 1, id, title,
    notebook: { type: 'doc', content: [
      { type: 'scene', attrs: { id: `blk-${id}`, title: `${title} scene`, svg: SCENE_SVG, svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SCENE_SVG)}` } },
    ] },
    fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {}, recordedBlocks: {}, brand: {}, theme: {},
  })
  await fetch(`${origin}/api/projects/${A}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture(A, A_TITLE)) })
  await fetch(`${origin}/api/projects/${B}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture(B, B_TITLE)) })

  await evalInWindow(`(() => { window.localStorage.setItem('incredible-studio-v2-active-project', '${A}'); window.location.assign('/studio'); })()`)
  check('notebook A open in the editor', await waitForTitle(A_TITLE))

  // The outage: durable saves of A fail, everything else works.
  await evalInWindow(`(() => {
    const real = window.fetch
    window.fetch = (url, options) =>
      String(url).endsWith('/api/projects/${A}') && String(options?.method || 'GET') === 'PUT'
        ? Promise.resolve(new Response(JSON.stringify({ error: 'database offline' }), { status: 503, headers: { 'content-type': 'application/json' } }))
        : real(url, options)
    return true
  })()`)

  // The edit: rename A while the outage holds.
  await evalInWindow(`(() => {
    const input = document.getElementById('project-title')
    input.value = ${JSON.stringify(A_EDITED)}
    input.dispatchEvent(new Event('input'))
    return true
  })()`)
  await sleep(1_500)

  const draft = await evalInWindow(`(() => {
    const raw = window.localStorage.getItem(${JSON.stringify(DRAFT_KEY)})
    if (!raw) return null
    try { const parsed = JSON.parse(raw); return { id: parsed.id, title: parsed.title } } catch { return null }
  })()`)
  check('the failed save leaves a per-notebook draft with the edit', Boolean(draft && draft.id === A && draft.title === A_EDITED), JSON.stringify(draft))
  check('the outage was real — the durable store still has the old title', (await durableTitle(A)) === A_TITLE, await durableTitle(A))

  // Switch away mid-outage: the failing flush used to clear the only cache.
  check('switching to B during the outage still works', await switchTo(B_TITLE, B_TITLE))
  const afterSwitch = await evalInWindow(`(() => ({
    draftKept: Boolean(window.localStorage.getItem(${JSON.stringify(DRAFT_KEY)})),
    cache: (() => { try { return JSON.parse(window.localStorage.getItem('incredible-studio-v2-project') || 'null')?.id || null } catch { return null } })(),
  }))()`)
  check('the dirty draft survives the switch', afterSwitch.draftKept)
  check("the single-slot cache is the opened notebook's, not the dirty one's", afterSwitch.cache !== A, String(afterSwitch.cache))

  // Storage is healthy again on the fresh page (the stub died with A's page).
  // The switcher lists A by its durable (old) title; the editor must open
  // with the edited one.
  check('returning to A', await switchTo(A_TITLE, A_EDITED))
  check('the complete draft is recovered in the editor', await evalInWindow(`document.getElementById('project-title')?.value === ${JSON.stringify(A_EDITED)}`))

  // Acknowledged: the next landed save retires the draft and carries the edit.
  await evalInWindow(`(() => {
    const input = document.getElementById('project-title')
    input.dispatchEvent(new Event('input'))
    return true
  })()`)
  let acknowledged = false
  for (let i = 0; i < 25; i += 1) {
    const draftGone = await evalInWindow(`window.localStorage.getItem(${JSON.stringify(DRAFT_KEY)}) === null`)
    const stored = await durableTitle(A)
    if (draftGone && stored === A_EDITED) { acknowledged = true; break }
    await sleep(400)
  }
  check('a landed save retires the draft and stores the edit durably', acknowledged)

  await fetch(`${origin}/api/projects/${A}`, { method: 'DELETE' })
  await fetch(`${origin}/api/projects/${B}`, { method: 'DELETE' })
  check('cleanup', true, 'fixture notebooks deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(600)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `NOTEBOOK DRAFT CHECK FAIL (${failures})` : 'NOTEBOOK DRAFT CHECK PASS')
process.exitCode = failures ? 1 : 0
