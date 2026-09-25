// The base deck's designed path (review finding R4): with a drawing harness
// available, "Design the pages" is the primary action and instant schematic
// drafts the clearly named alternative. A design run shows its pages as each
// one is finished (designing → checking → ready, with a count), belongs to
// the draft that started it — a newer draft never receives an older run's
// pages — can be stopped, reports an incomplete or failed run with Retry, and
// opening early says exactly what opens. The notebook marks schematic drafts.
// F2 of the fresh end-to-end review: every page can be looked at large and
// says what it is now, and opening early no longer stops the designer — the
// rest land on their scenes as they are finished, until Stop remaining work.
//
// A stub kimi on PATH plays the harness: a story run plans two scenes, a
// page-master run draws page by page as the scenario file says. The local
// file store in a temp directory keeps every database out of it.
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-source-design-'))
const scenarioFile = join(root, 'scenario.json')
const setScenario = scenario => writeFile(scenarioFile, JSON.stringify(scenario))

const NARRATIVE = '# Retry storms\n\nWhen a service recovers, every client retries at once and the surge knocks it back down.\n\nJitter spreads those retries across a quiet window, so the service stays alive.'

const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await writeFile(
  join(binDir, 'kimi'),
  `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
if (process.argv.includes('--version')) { console.log('kimi stub 1.0'); process.exit(0) }
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let inputs = null
try { inputs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'motion', 'inputs.json'), 'utf8')) } catch {}
const page = (index, marker, title) => \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" font-family="Inter, sans-serif" font-size="22" data-page-role="diagram" data-page-index="\${String(index).padStart(2, '0')}">
<g data-role="background"><rect width="1280" height="720" fill="#0b1020"/></g>
<g data-role="header"><text id="s\${index}-title" x="80" y="96" font-size="40" fill="#f5f7fb">\${title}</text></g>
<g id="s\${index}-node-clients" data-role="node" data-kind="box" data-entity="client"><rect x="120" y="300" width="320" height="110" rx="14" fill="#635bff" fill-opacity="0.12" stroke="#635bff"/><text x="190" y="362" fill="#f5f7fb">Clients \${marker}</text></g>
<g id="s\${index}-node-service" data-role="node" data-kind="box" data-entity="service"><rect x="780" y="300" width="320" height="110" rx="14" fill="#22c55e" fill-opacity="0.12" stroke="#22c55e"/><text x="850" y="362" fill="#f5f7fb">Service</text></g>
<line id="s\${index}-edge-1" data-role="connector" data-verb="sends to" x1="440" y1="355" x2="780" y2="355" stroke="#635bff" stroke-width="2"/>
</svg>\`
;(async () => {
  if (inputs && inputs.source && typeof inputs.source.text === 'string') {
    const body = inputs.source.text.split('\\n').filter(line => line.trim() && !line.trim().startsWith('#')).join(' ')
    const sentences = (body.match(/[^.!?]+[.!?]+/g) || [body]).map(s => s.trim()).filter(Boolean)
    const scenes = sentences.slice(0, 2).map((sentence, index) => ({
      title: 'Scene ' + (index + 1), idea: sentence, kind: 'diagram', seconds: 12,
      parts: [{ label: 'Clients', kind: 'box', detail: 'retrying together' }, { label: 'Service', kind: 'box', detail: 'recovering' }],
      relations: [{ from: 'Clients', to: 'Service', verb: 'sends to' }],
      narration: sentence, source: [sentence],
    }))
    fs.mkdirSync(path.join(process.cwd(), 'story'), { recursive: true })
    fs.writeFileSync(path.join(process.cwd(), 'story', 'outline.json'), JSON.stringify({ title: 'Retry storms', targetSeconds: scenes.length * 12, scenes, glossary: [] }))
    fs.writeFileSync(path.join(process.cwd(), 'story', 'receipt.json'), JSON.stringify({ scenes: scenes.length, wordingPolicy: inputs.wordingPolicy || 'preserve' }))
    emit({ role: 'assistant', content: 'Planned ' + scenes.length + ' scenes.' })
    process.exit(0)
  }
  if (inputs && inputs.pageCount) {
    const scenario = JSON.parse(fs.readFileSync(${JSON.stringify(scenarioFile)}, 'utf8'))
    const pagesDir = path.join(process.cwd(), 'pages')
    fs.mkdirSync(pagesDir, { recursive: true })
    for (let index = 1; index <= inputs.pageCount; index++) {
      emit({ role: 'assistant', content: 'Drawing page ' + index + ' (' + scenario.marker + ')' })
      const scene = inputs.scenes[index - 1] || { title: 'Page ' + index }
      fs.writeFileSync(path.join(pagesDir, String(index).padStart(2, '0') + '_page.svg'), page(index, scenario.marker, scene.title))
      if (scenario.mode === 'partial') {
        await sleep(scenario.delayMs)
        process.stderr.write('Error: the drawing session ended unexpectedly\\n')
        process.exit(1)
      }
      await sleep(scenario.delayMs)
      if (scenario.mode === 'slow' && index === 1) await sleep(120000)
      if (scenario.mode === 'paced' && index === 1) await sleep(scenario.pauseAfterFirstMs || 10000)
    }
    emit({ role: 'assistant', content: 'Checking the pages' })
    await sleep(scenario.delayMs)
    fs.writeFileSync(path.join(pagesDir, 'receipt.json'), JSON.stringify({ pages: inputs.scenes.map((scene, i) => ({ index: i + 1, title: scene.title, checks: 'pass' })) }))
    emit({ role: 'assistant', content: 'Receipt written' })
    process.exit(0)
  }
  emit({ role: 'assistant', content: 'stub run' })
  process.exit(0)
})()
`,
)
await chmod(join(binDir, 'kimi'), 0o755)

const app = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
  cwd: appDir,
  env: {
    ...process.env,
    STUDIO_ALLOW_MULTI_INSTANCE: '1',
    PATH: `${binDir}:${process.env.PATH}`,
    STUDIO_DATA_DIR: join(root, 'data'),
    STUDIO_OUTPUTS_DIR: join(root, 'outputs'),
    STUDIO_PERSISTENCE: 'local',
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
const evaluate = async (js, label = '') => {
  const response = await fetch(`${origin}/__eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ js: `(${js})()` }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${label || js.slice(0, 50)}: ${body.error || 'eval failed'}`)
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const status = () => evaluate(`() => window.__source.drawStatus()`, 'draw status')
// SOURCE_DESIGN_CAPTURE_DIR keeps a PNG of each state the creator sees.
const capture = async name => {
  if (!process.env.SOURCE_DESIGN_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.SOURCE_DESIGN_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const cards = () =>
  evaluate(`() => [...document.querySelectorAll('#source-pages-grid .source-page')].map(card => ({ origin: card.dataset.origin, text: card.querySelector('.thumb')?.textContent || '', badge: card.querySelector('.drawn')?.textContent || '' }))`, 'cards')
const runStatus = async id => (await fetch(`${origin}/api/runs`).then(r => r.json()).then(body => body.runs || []).catch(() => [])).find(run => run.id === id)?.status
// Every phase the draw status passes through until `until` holds.
const watch = async (until, seconds = 60) => {
  const seen = []
  let last = null
  for (let i = 0; i < seconds * 2; i++) {
    last = await status().catch(() => null)
    if (last) {
      const key = `${last.phase}:${last.drawn}/${last.total}`
      if (seen[seen.length - 1] !== key) seen.push(key)
      if (until(last)) break
    }
    await sleep(500)
  }
  return { seen, last }
}
const backToOutline = async title =>
  evaluate(`() => {
    document.querySelector('#source-step-pages [data-source-back="outline"]').click()
    const input = document.querySelector('#source-scenes li input')
    input.value = ${JSON.stringify(title)}
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return !document.getElementById('source-step-outline').hidden
  }`, 'back to outline')

try {
  const prefs = await fetch(`${origin}/api/settings/harness`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ default: { harness: 'kimi', model: null } }),
  }).then(r => r.json())
  check('Kimi is the chosen harness', prefs.preferences?.default?.harness === 'kimi', JSON.stringify(prefs.preferences?.default))

  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'open studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))
  await evaluate(`() => { window.__source.open('narrative'); return true }`, 'open source')
  await evaluate(`() => { document.getElementById('source-narrative').value = ${JSON.stringify(NARRATIVE)}; document.getElementById('source-read').click(); return true }`, 'read')
  check('the narrative is read', Boolean(await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step')))
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'outline')
  check('the story run plans the outline', Boolean(await waitFor(`() => !document.getElementById('source-step-outline')?.hidden && document.querySelectorAll('#source-scenes li').length === 2`, 'outline step', 150)))

  // The designed path leads; drafts are the named alternative.
  const actions = await waitFor(`() => {
    const design = document.getElementById('source-design-pages')
    const drafts = document.getElementById('source-make-pages')
    if (design.hidden) return null
    return { design: design.textContent, designPrimary: design.classList.contains('primary'), drafts: drafts.textContent, draftsGhost: drafts.classList.contains('ghost'), hint: document.getElementById('source-design-hint').textContent }
  }`, 'outline actions', 40)
  check('"Design the pages" is the primary action', actions?.designPrimary === true && actions?.design === 'Design the pages', JSON.stringify(actions))
  check('instant schematic drafts are the named alternative', actions?.draftsGhost === true && actions?.drafts === 'Instant schematic drafts', JSON.stringify(actions))
  check('the hint names the harness and model that design the pages', /Kimi/.test(actions?.hint || ''), actions?.hint)
  await capture('01-outline-actions')

  // 1. A full design run: pages arrive one at a time, then checking, then ready.
  await setScenario({ mode: 'full', marker: 'RUN-A', delayMs: 6000 })
  await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`, 'design')
  check('the pages step opens on the schematic drafts', Boolean(await waitFor(`() => !document.getElementById('source-step-pages')?.hidden`, 'pages step')))
  const early = await waitFor(`() => { const s = window.__source.drawStatus(); return s.phase === 'designing' && s.lastRunId ? s : null }`, 'designing', 20)
  const firstRun = early?.lastRunId
  check('the design run starts bound to the draft', Boolean(early?.draftId && firstRun), JSON.stringify({ draftId: early?.draftId, run: firstRun }))
  check('designing is labelled with the count', /^Designing with Kimi — \d of 2 pages/.test(early?.status || ''), early?.status)
  check('opening early says what opens', /^Open now — \d designed, \d still designing$/.test(early?.finishLabel || ''), early?.finishLabel)
  await waitFor(`() => window.__source.drawStatus().drawn === 1`, 'one designed', 30)
  await capture('02-designing-one-of-two')
  const full = await watch(s => s.phase === 'ready' || s.phase === 'failed' || s.phase === 'incomplete', 60)
  await capture('03-ready')
  check('pages arrive one at a time, then checking, then ready', ['designing:1/2', 'checking:2/2', 'ready:2/2'].every(key => full.seen.includes(key)), full.seen.join(' → '))
  check('ready is labelled with the harness and the check', /^Ready — 2 of 2 pages designed by Kimi, checked/.test(full.last?.status || ''), full.last?.status)
  check('the finish opens the designed notebook', full.last?.finishLabel === 'Open the designed notebook', full.last?.finishLabel)
  const readyCards = await cards()
  check('every card is a designed page from this run', readyCards.every(card => card.origin === 'designed' && card.text.includes('RUN-A') && card.badge === 'designed · Kimi'), JSON.stringify(readyCards))

  // 2. A new draft stops the old run, and the old run's pages never land on it.
  await backToOutline('Scene one, retitled')
  await setScenario({ mode: 'slow', marker: 'RUN-B', delayMs: 3000 })
  await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`, 'design B')
  const draftB = await waitFor(`() => { const s = window.__source.drawStatus(); return s.lastRunId && s.lastRunId !== ${JSON.stringify(firstRun)} && s.drawn >= 1 ? s : null }`, 'draft B designing', 60)
  check('a changed outline makes a new draft with its own run', Boolean(draftB && draftB.draftId !== early?.draftId), JSON.stringify({ a: early?.draftId, b: draftB?.draftId }))
  const runB = draftB?.lastRunId
  await backToOutline('Scene one, retitled again')
  await setScenario({ mode: 'full', marker: 'RUN-C', delayMs: 1500 })
  await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`, 'design C')
  const draftC = await watch(s => s.lastRunId && s.lastRunId !== runB && (s.phase === 'ready' || s.phase === 'failed' || s.phase === 'incomplete'), 60)
  check('the new draft is designed by its own run', draftC.last?.phase === 'ready' && draftC.last?.draftId !== draftB?.draftId, draftC.seen.join(' → '))
  const cCards = await cards()
  check('no page from the replaced run landed on the new draft', cCards.every(card => card.text.includes('RUN-C') && !card.text.includes('RUN-B')), JSON.stringify(cCards.map(card => card.text.match(/RUN-\w/)?.[0])))
  check('the replaced run was stopped', (await runStatus(runB)) === 'cancelled', String(await runStatus(runB)))

  // 3. Stop: what the designer finished stays; the rest stay drafts.
  await backToOutline('Scene one, third title')
  await setScenario({ mode: 'slow', marker: 'RUN-D', delayMs: 2000 })
  await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`, 'design D')
  const draftD = await waitFor(`() => { const s = window.__source.drawStatus(); return s.phase === 'designing' && s.drawn === 1 && !document.getElementById('source-draw-stop').hidden ? s : null }`, 'draft D one page', 60)
  check('a run can be stopped while it designs', Boolean(draftD), JSON.stringify(draftD?.status))
  await evaluate(`() => { document.getElementById('source-draw-stop').click(); return true }`, 'stop')
  const stopped = await waitFor(`() => { const s = window.__source.drawStatus(); return s.phase === 'incomplete' ? { ...s, again: document.getElementById('source-draw').textContent, againHidden: document.getElementById('source-draw').hidden } : null }`, 'stopped', 30)
  check('stopping keeps the finished page and names the rest as drafts', /^Incomplete — 1 of 2 pages designed by Kimi; 1 stay schematic drafts/.test(stopped?.status || ''), stopped?.status)
  check('the incomplete deck opens as designed + drafts', stopped?.finishLabel === 'Open with 1 designed + 1 schematic drafts', stopped?.finishLabel)
  check('the pages can be designed again', stopped?.againHidden === false && stopped?.again === 'Design them again', JSON.stringify({ again: stopped?.again, hidden: stopped?.againHidden }))
  check('the stopped run is cancelled', (await runStatus(draftD?.lastRunId)) === 'cancelled', String(await runStatus(draftD?.lastRunId)))

  // 4. A run that fails part-way: the failure is shown with Retry.
  await setScenario({ mode: 'partial', marker: 'RUN-E', delayMs: 1000 })
  await evaluate(`() => { document.getElementById('source-draw').click(); return true }`, 'design again')
  const partial = await watch(s => s.lastRunId && s.lastRunId !== draftD?.lastRunId && (s.phase === 'incomplete' || s.phase === 'failed' || s.phase === 'ready'), 40)
  const failureLine = await evaluate(`() => ({ hidden: document.getElementById('source-draw-failure').hidden, text: document.getElementById('source-draw-failure').textContent, buttons: [...document.querySelectorAll('#source-draw-failure button')].map(b => b.textContent) })`, 'failure line')
  check('a failed run leaves an incomplete deck', partial.last?.phase === 'incomplete', partial.seen.join(' → '))
  await capture('04-incomplete-with-failure')
  check('the failure is shown with Retry and a way to switch', failureLine.hidden === false && failureLine.buttons.includes('Retry') && failureLine.buttons.includes('Switch harness or model'), JSON.stringify(failureLine))

  // 5. Opening while the designer works (F2): every page says what it is and
  // opens large; opening keeps the designer going, and the page still being
  // designed lands on its scene when it is finished.
  await setScenario({ mode: 'paced', marker: 'RUN-F', delayMs: 1500, pauseAfterFirstMs: 14000 })
  await evaluate(`() => { [...document.querySelectorAll('#source-draw-failure button')].find(b => b.textContent === 'Retry').click(); return true }`, 'retry')
  const running = await waitFor(`async () => {
    const s = window.__source.drawStatus()
    const first = document.querySelector('#source-pages-grid .source-page .thumb')?.textContent || ''
    return s.phase === 'designing' && s.drawn === 1 && first.includes('RUN-F') ? { ...s, note: document.getElementById('source-pages-note').textContent, stop: document.getElementById('source-draw-stop').textContent } : null
  }`, 'retry designing', 60)
  const states = await evaluate(`() => [...document.querySelectorAll('#source-pages-grid .source-page .drawn')].map(badge => ({ state: badge.dataset.state, text: badge.textContent }))`, 'page states')
  check('each page says what it is now: designed, or being designed', states[0]?.state === 'designed' && states[0]?.text === 'designed · Kimi' && states[1]?.state === 'designing' && states[1]?.text === 'schematic draft · being designed', JSON.stringify(states))
  // A finished page opens large while the rest design; Escape goes back.
  const firstLook = await evaluate(`async () => {
    document.querySelectorAll('#source-pages-grid .source-page')[0].click()
    await new Promise(resolve => setTimeout(resolve, 200))
    const box = document.getElementById('source-inspector-page').getBoundingClientRect()
    return { open: !document.getElementById('source-page-inspector').hidden, title: document.getElementById('source-inspector-title').textContent, state: document.getElementById('source-inspector-state').textContent, width: Math.round(box.width), height: Math.round(box.height), marker: document.getElementById('source-inspector-page').textContent.includes('RUN-F') }
  }`, 'inspect first')
  await capture('05-inspector')
  const inspected = await evaluate(`async () => {
    const first = ${JSON.stringify(firstLook)}
    document.getElementById('source-inspector-next').click()
    const second = { title: document.getElementById('source-inspector-title').textContent, state: document.getElementById('source-inspector-state').textContent }
    document.getElementById('source-page-inspector').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.getElementById('source-dialog').dispatchEvent(new Event('cancel', { cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 200))
    return { first, second, closed: document.getElementById('source-page-inspector').hidden, dialogOpen: document.getElementById('source-dialog').open }
  }`, 'inspect')
  check('a finished page opens large in the wizard, with its state', inspected.first.open && inspected.first.width > 600 && inspected.first.marker && /^1 of 2 · /.test(inspected.first.title) && inspected.first.state === 'designed · Kimi', JSON.stringify(inspected.first))
  check('the next page says it is still being designed', /^2 of 2 · /.test(inspected.second.title) && inspected.second.state === 'schematic draft · being designed', JSON.stringify(inspected.second))
  check('Escape closes the page and keeps the wizard', inspected.closed && inspected.dialogOpen, JSON.stringify({ closed: inspected.closed, dialogOpen: inspected.dialogOpen }))
  await capture('05b-pages-with-states')
  check('opening now says what opens, and that the rest keep designing', running?.finishLabel === 'Open now — 1 designed, 1 still designing', running?.finishLabel)
  check('opening now says the page still being designed lands on its scene', /keeps designing: the page still being designed lands on its scene/.test(running?.note || '') && /Stop remaining work/.test(running?.note || ''), running?.note)
  check('stopping is its own action', running?.stop === 'Stop remaining work', running?.stop)
  await evaluate(`() => { document.getElementById('source-finish').click(); return true }`, 'finish')
  const opened = await waitFor(`async () => {
    if (document.getElementById('source-dialog')?.open) return null
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null)
    const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
    return scenes.length === 2 ? { id, origins: scenes.map(scene => scene.attrs.pageOrigin), svgs: scenes.map(scene => (String(scene.attrs.svg).match(/RUN-\\w/) || [''])[0]), chips: [...document.querySelectorAll('.notebook-scene-block .scene-page-origin')].map(chip => chip.textContent), status: document.getElementById('page-design-status').hidden ? '' : document.getElementById('page-design-text').textContent } : null
  }`, 'finish', 120)
  check('the notebook opens with both scenes', Boolean(opened), JSON.stringify(opened?.origins))
  const runF = opened?.origins?.[0]?.runId
  check('the designed scene records its harness and run', opened?.origins?.[0]?.kind === 'designed' && opened?.origins?.[0]?.by === 'Kimi' && Boolean(runF) && opened?.svgs?.[0] === 'RUN-F', JSON.stringify(opened?.origins?.[0]))
  check('the scene still being designed waits for its page from that run', opened?.origins?.[1]?.kind === 'schematic' && opened?.origins?.[1]?.designing?.runId === runF && opened?.origins?.[1]?.designing?.page === 2 && opened?.svgs?.[1] === '', JSON.stringify(opened?.origins?.[1]))
  check('the notebook says the page is being designed', opened?.chips?.length === 1 && opened.chips[0] === 'schematic draft · being designed' && /still designing 1 page; each lands on its scene when it is finished/.test(opened?.status || ''), JSON.stringify({ chips: opened?.chips, status: opened?.status }))
  check('opening did not stop the designer', (await runStatus(runF)) === 'running', String(await runStatus(runF)))
  // F1 of the Perplexity review: a video made now would start from the
  // schematic still being designed. The offer says so, and waiting comes first.
  await evaluate(`() => { document.getElementById('open-planning').click(); return true }`, 'plan video')
  const waitOffer = await waitFor(`() => { const wait = document.querySelector('#planning-workspace .planning-wait-pages'); const create = document.querySelector('#planning-workspace .planning-create-fork'); return wait && create ? { wait: wait.textContent, create: create.textContent, status: document.querySelector('#planning-workspace .planning-fork-status')?.textContent || '' } : null }`, 'fork offer', 40)
  check('a video offered while a page is still being designed says so, and offers to wait', waitOffer?.wait === 'Wait for the designed pages' && waitOffer.create === 'Continue with schematics' && /^1 of 2 pages are designed; 1 is still being designed\. A video made now starts from that page's schematic draft; each scene can adopt its designed slide once it lands\./.test(waitOffer.status), JSON.stringify(waitOffer))
  await capture('06a-fork-offer-while-designing')
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-wait-pages').click(); return true }`, 'wait')
  const waited = await waitFor(`async () => document.getElementById('planning-dialog').open ? null : (await fetch('/api/projects').then(r => r.json())).projects.filter(row => row.derivedFrom).length + 1`, 'offer closed', 20)
  check('waiting closes the offer and makes no video', waited === 1, String(waited))
  await evaluate(`() => { document.querySelector('.notebook-scene-block .scene-page-origin')?.scrollIntoView({ block: 'center' }); return true }`, 'scroll to draft').catch(() => {})
  await sleep(600)
  const sticky = await evaluate(`() => { const bar = document.getElementById('page-design-status').getBoundingClientRect(); return bar.height > 0 && bar.top >= 0 && bar.bottom <= innerHeight }`, 'status in view')
  check('the notebook keeps saying so while it is scrolled', sticky === true, String(sticky))
  await capture('06-notebook-still-designing')
  const landed = await waitFor(`async () => {
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null)
    const scene = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')[1]
    const origin = scene?.attrs?.pageOrigin
    return origin?.kind === 'designed' && !origin.designing && String(scene.attrs.svg).includes('RUN-F') ? { origin, chips: [...document.querySelectorAll('.notebook-scene-block .scene-page-origin')].length, statusHidden: document.getElementById('page-design-status').hidden, windows: (scene.attrs.motion?.steps || []).length } : null
  }`, 'landed', 120)
  check('the page designed after opening lands on its scene', landed?.origin?.by === 'Kimi' && landed?.origin?.runId === runF && landed?.chips === 0, JSON.stringify(landed))
  check('once the run is done, the notebook stops waiting', landed?.statusHidden === true && (await runStatus(runF)) === 'done', JSON.stringify({ statusHidden: landed?.statusHidden, run: await runStatus(runF) }))
  // Every page designed: the offer makes the video from them.
  await evaluate(`() => { document.getElementById('open-planning').click(); return true }`, 'plan video again')
  const readyOffer = await waitFor(`() => { const create = document.querySelector('#planning-workspace .planning-create-fork'); return create ? { create: create.textContent, wait: Boolean(document.querySelector('#planning-workspace .planning-wait-pages')), status: document.querySelector('#planning-workspace .planning-fork-status')?.textContent || '' } : null }`, 'fork offer ready', 40)
  check('once every page is designed, the offer makes the video from them', readyOffer?.create === 'Create video fork and prepare brief' && readyOffer.wait === false && !/schematic|still being designed/.test(readyOffer.status), JSON.stringify(readyOffer))
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-close').click(); return true }`, 'close offer')
  await capture('07-notebook-landed')

  // 6. Stop remaining work, from the notebook: what was finished stays, the
  // rest stay schematic drafts, and nothing waits any more.
  await setScenario({ mode: 'paced', marker: 'RUN-G', delayMs: 1000, pauseAfterFirstMs: 90000 })
  await evaluate(`() => { window.__source.open('narrative'); return true }`, 'open source again')
  await evaluate(`() => { document.getElementById('source-narrative').value = ${JSON.stringify(NARRATIVE)}; document.getElementById('source-read').click(); return true }`, 'read again')
  await waitFor(`() => !document.getElementById('source-step-brand')?.hidden`, 'brand step again')
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, 'outline again')
  await waitFor(`() => !document.getElementById('source-step-outline')?.hidden && document.querySelectorAll('#source-scenes li').length === 2 && !document.getElementById('source-design-pages').hidden`, 'outline again', 150)
  await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`, 'design G')
  const runningG = await waitFor(`() => { const s = window.__source.drawStatus(); const first = document.querySelector('#source-pages-grid .source-page .thumb')?.textContent || ''; return s.phase === 'designing' && s.drawn === 1 && first.includes('RUN-G') ? s : null }`, 'G designing', 60)
  const runG = runningG?.lastRunId
  await evaluate(`() => { document.getElementById('source-finish').click(); return true }`, 'finish G')
  const openedG = await waitFor(`() => !document.getElementById('source-dialog')?.open && !document.getElementById('page-design-status').hidden ? document.getElementById('page-design-text').textContent : null`, 'G opened', 120)
  check('a second deck opens while its page is still being designed', Boolean(runG) && /still designing 1 page/.test(openedG || ''), openedG)
  await evaluate(`() => { document.getElementById('page-design-stop').click(); return true }`, 'stop remaining work')
  const stoppedG = await waitFor(`async () => {
    if (!document.getElementById('page-design-status').hidden) return null
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null)
    const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
    return scenes.length === 2 && scenes.every(scene => !scene.attrs.pageOrigin?.designing) ? { origins: scenes.map(scene => scene.attrs.pageOrigin), chips: [...document.querySelectorAll('.notebook-scene-block .scene-page-origin')].map(chip => chip.textContent) } : null
  }`, 'G stopped', 60)
  check('Stop remaining work stops the designer from the notebook', (await runStatus(runG)) === 'cancelled', String(await runStatus(runG)))
  check('what it finished stays designed, and the rest stay schematic drafts', stoppedG?.origins?.[0]?.kind === 'designed' && stoppedG?.origins?.[1]?.kind === 'schematic' && JSON.stringify(stoppedG?.chips) === JSON.stringify(['schematic draft']), JSON.stringify(stoppedG))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE DESIGN CHECK FAIL (${failures})` : 'SOURCE DESIGN CHECK PASS')
process.exitCode = failures ? 1 : 0
