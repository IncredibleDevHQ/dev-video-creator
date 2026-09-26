// Motion stored before F11 of the Perplexity review is repaired when its
// notebook opens. The app's own local planner plans a page as it was once
// read — the combine step taken for data, nothing routed through it — and
// stores a move and a morph of the step onto its output. The page is then
// the one a notebook holds today (a combine step the experts' routes run
// into); opening the notebook keeps the step in place and lets the output
// emerge, saves that, says so once, and changes nothing on the next open.
//
// The local file store in a temp directory keeps every database out of it.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-motion-repair-'))

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
const until = async (test, seconds = 40) => {
  for (let i = 0; i < seconds * 2; i += 1) {
    const value = await test().catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const project = id => fetch(`${origin}/api/projects/${encodeURIComponent(id)}`).then(response => response.json()).then(body => body.project)
const put = body => fetch(`${origin}/api/projects/${encodeURIComponent(body.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(response => response.status)
const open = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'open').catch(() => {})
  await sleep(2500)
  return until(() => evaluate(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)} ? true : null`, 'opened'), 40)
}

// The page: experts, a combine step and its output. `then` is the page as
// it was once read; `now` is the page the notebook holds today.
const node = (id, x, y, label, extra = '') => `<g id="${id}" data-role="node"${extra}><rect id="${id}-box" x="${x}" y="${y}" width="200" height="80" rx="10" fill="#15121f" stroke="#635bff" stroke-width="2"/><text id="${id}-label" x="${x + 100}" y="${y + 46}" text-anchor="middle" font-family="Inter" font-size="20" fill="#ffffff">${label}</text></g>`
const edge = (id, x1, y1, x2, y2, verb, from, to) => `<line id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a9b3cc" stroke-width="3" data-verb="${verb}" data-from="${from}" data-to="${to}"/>`
const page = now => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">${[
  node('same', 100, 150, 'Same-node experts'),
  node('other', 100, 400, 'Other-node experts'),
  now ? node('combine', 450, 275, 'Combine step') : node('combine', 450, 275, 'Combined results', ' data-kind="data"'),
  node('output', 800, 275, 'Output tokens'),
  ...(now ? [edge('e1', 300, 190, 450, 300, 'merges into', 'same', 'combine'), edge('e2', 300, 440, 450, 330, 'merges into', 'other', 'combine')] : []),
  edge('e3', 650, 315, 800, 315, 'becomes', 'combine', 'output'),
].join('')}</svg>`
const script = 'The same-node experts and the other-node experts send their results to the combine step.\n\nThe combine step becomes the output tokens.'
const id = 'motion-repair'
const title = 'Dispatch and combine'
const notebook = svg => ({
  version: 1, id, title, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
  brand: { name: 'check', background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', accent: '#635bff', accentText: '#ffffff', fontFamily: 'Inter', headingFontFamily: 'Inter' },
  notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 'moe', title, svg, script } }] },
})
const actionsOf = motion => (motion?.steps || []).flatMap(step => step.actions || [])
const onCombine = motion => actionsOf(motion).filter(action => action.targets.includes('combine') && (action.op === 'move' || action.op === 'morph')).map(action => action.op)

try {
  check('a notebook with the page as it was once read is saved', (await put(notebook(page(false)))) === 200)
  check('it opens', Boolean(await open(id, title)))
  await until(() => evaluate(`() => document.querySelector('#moe [data-slide-action="animate"]') ? true : null`, 'card'), 30)
  await evaluate(`() => { document.querySelector('#moe [data-slide-action="animate"]').click(); return true }`, 'animate')
  const stored = await until(async () => { const motion = (await project(id))?.notebook?.content?.[0]?.attrs?.motion; return onCombine(motion).includes('morph') ? motion : null }, 30)
  check('the app\'s planner, reading the step as data, stores a move and a morph onto the output', Boolean(stored), JSON.stringify(onCombine(stored)))

  // Today's page: the experts' routes run into the combine step. The app
  // is on another notebook first, so its own saves cannot write over it.
  check('another notebook is saved', (await put({ ...notebook(page(false)), id: 'motion-repair-other', title: 'Another notebook', notebook: { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'other-p1' }, content: [{ type: 'text', text: 'Something else.' }] }] } })) === 200)
  check('the app moves to it', Boolean(await open('motion-repair-other', 'Another notebook')))
  await sleep(1500)
  const current = await project(id)
  const saved = structuredClone(current)
  saved.notebook.content[0].attrs.svg = page(true)
  const status = await fetch(`${origin}/api/projects/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: saved, expectedProject: current }) }).then(response => response.status)
  const kept = (await project(id)).notebook.content[0].attrs
  check('the page becomes the one a notebook holds today, its motion kept', status === 200 && kept.svg.includes('data-verb="merges into"') && onCombine(kept.motion).includes('morph'), JSON.stringify({ status, today: kept.svg.includes('merges into'), motion: onCombine(kept.motion) }))
  check('the notebook opens again', Boolean(await open(id, title)))
  const toast = await until(() => evaluate(`() => { const toast = document.getElementById('toast'); return !toast.hidden && /stored motion now keeps the step in place/.test(toast.textContent) ? toast.textContent : null }`, 'toast'), 20)
  check('opening it says the stored motion was repaired', Boolean(toast), JSON.stringify(toast))
  const repaired = await until(async () => { const motion = (await project(id))?.notebook?.content?.[0]?.attrs?.motion; return motion && !onCombine(motion).length ? motion : null }, 30)
  const actions = actionsOf(repaired)
  check('the repaired motion is saved: no move or morph of the step', Boolean(repaired), JSON.stringify(onCombine(repaired)))
  check('the output emerges: revealed, then emphasised', actions.some(action => action.op === 'reveal' && action.targets.includes('output')) && actions.some(action => action.op === 'emphasize' && action.targets.includes('output')), JSON.stringify(actions.filter(action => action.targets.includes('output')).map(action => action.op)))
  check('the rest of the plan is kept', repaired && stored && repaired.steps.length === stored.steps.length && JSON.stringify(repaired.steps[0]) === JSON.stringify(stored.steps[0]))

  // Nothing more to do on the next open.
  check('the notebook opens once more', Boolean(await open(id, title)))
  await sleep(2500)
  const quiet = await evaluate(`() => { const toast = document.getElementById('toast'); return toast.hidden || !/stored motion/.test(toast.textContent) }`, 'quiet')
  const after = (await project(id)).notebook.content[0].attrs.motion
  check('the next open repairs nothing and says nothing', quiet && JSON.stringify(after) === JSON.stringify(repaired))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `MOTION REPAIR CHECK FAIL (${failures})` : 'MOTION REPAIR CHECK PASS')
process.exitCode = failures ? 1 : 0
