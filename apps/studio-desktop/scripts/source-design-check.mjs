// A project's presentation, designed from its wireframe (the four-notebook
// model). The import opens on the project's text as soon as the brand is
// chosen, and its wireframe is made in the background. The wireframe offers
// to design the presentation: a drawing run draws each page, and the
// presentation — a notebook of its own, the same pages with the same ids —
// takes each slide as it is finished. While it is designed the presentation
// says so, with the run's progress; a video offered meanwhile says so and
// offers to wait; Stop remaining work keeps what is finished; a video made
// while a slide is designed takes it by itself as it lands (B06 and the
// per-scene chaining of the BoltDB review); and a slide the run left when
// the app closed lands when it opens again.
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

// The app, started again on the same store for the restart flow (B06).
const startApp = async () => {
  const child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
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
  const found = await new Promise((resolve, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => reject(new Error('app start timed out')), 90_000)
    child.stdout.on('data', chunk => {
      buffer += chunk
      const match = /STUDIO_ORIGIN (http:\/\/\S+)/.exec(buffer)
      if (match && buffer.includes('SMOKE PASS')) { clearTimeout(timeout); resolve(match[1]) }
    })
    child.once('exit', code => reject(new Error(`app exited (${code})`)))
  })
  return { child, found }
}
const stopApp = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
  await exited
  clearTimeout(timer)
}
let { child: app, found: origin } = await startApp()

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
// SOURCE_DESIGN_CAPTURE_DIR keeps a PNG of each state the creator sees.
const capture = async name => {
  if (!process.env.SOURCE_DESIGN_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.SOURCE_DESIGN_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const runStatus = async id => (await fetch(`${origin}/api/runs`).then(r => r.json()).then(body => body.runs || []).catch(() => [])).find(run => run.id === id)?.status
const projectOf = id => fetch(`${origin}/api/projects/${encodeURIComponent(id)}`).then(r => r.json()).then(body => body.project || null).catch(() => null)
const scenesIn = project => (project?.notebook?.content || []).filter(node => node.type === 'scene')
const overviewOf = id => fetch(`${origin}/api/planning/${encodeURIComponent(id)}`).then(r => r.json()).catch(() => null)
const until = async (test, seconds = 90) => {
  for (let i = 0; i < seconds * 2; i += 1) {
    const value = await test().catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const landNow = notebook => fetch(`${origin}/api/pages/land`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notebook }) }).then(r => r.json()).catch(() => null)
// A new project from the narrative: read, the brand, and the studio opens
// on its text while its wireframe is made in the background.
const importProject = async label => {
  await evaluate(`() => { window.__source.open('narrative'); return true }`, `open source ${label}`)
  await evaluate(`() => { document.getElementById('source-narrative').value = ${JSON.stringify(NARRATIVE)}; document.getElementById('source-read').click(); return true }`, `read ${label}`)
  await waitFor(`() => !document.getElementById('source-step-brand')?.hidden && !document.getElementById('source-to-outline').disabled`, `brand ${label}`)
  await evaluate(`() => { document.getElementById('source-to-outline').click(); return true }`, `create ${label}`)
  const text = await waitFor(`() => document.getElementById('source-dialog')?.open === false && document.body.dataset.notebookKind === 'text' ? localStorage.getItem('incredible-studio-v2-active-project') : null`, `text ${label}`, 120)
  const wireframe = await waitFor(`() => document.querySelector('#notebook-switch [data-kind="wireframe"] small')?.textContent === '2 pages' ? true : null`, `wireframe ${label}`, 120)
  return { text, wireframe: Boolean(wireframe) }
}
// From the project's text: its wireframe, then its presentation designed
// from it — the studio opens on the presentation.
const designFromWireframe = async label => {
  await evaluate(`() => { setTimeout(() => document.querySelector('#notebook-switch [data-kind="wireframe"]').click(), 0); return true }`, `open wireframe ${label}`)
  const wireframe = await waitFor(`() => document.body.dataset.notebookKind === 'wireframe' && !document.getElementById('next-step').hidden && document.getElementById('next-step').textContent === 'Design presentation' ? localStorage.getItem('incredible-studio-v2-active-project') : null`, `wireframe ${label}`, 60)
  await evaluate(`() => { setTimeout(() => document.getElementById('next-step').click(), 0); return true }`, `design ${label}`)
  const presentation = await waitFor(`() => document.body.dataset.notebookKind === 'presentation' ? localStorage.getItem('incredible-studio-v2-active-project') : null`, `presentation ${label}`, 120)
  return { wireframe, presentation }
}
// A project whose presentation opens with its first slide landed and its
// second still being designed.
const designedDeck = async marker => {
  await importProject(marker)
  const { presentation } = await designFromWireframe(marker)
  const deck = await until(async () => {
    const scenes = scenesIn(await projectOf(presentation))
    return scenes.length === 2 && scenes[0].attrs.pageOrigin?.kind === 'designed' && String(scenes[0].attrs.svg).includes(marker) && scenes[1].attrs.pageOrigin?.designing ? scenes : null
  }, 90)
  return { run: deck?.[1]?.attrs?.pageOrigin?.designing?.runId, base: presentation }
}

try {
  const prefs = await fetch(`${origin}/api/settings/harness`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ default: { harness: 'kimi', model: null } }),
  }).then(r => r.json())
  check('Kimi is the chosen harness', prefs.preferences?.default?.harness === 'kimi', JSON.stringify(prefs.preferences?.default))
  await evaluate(`() => { window.location.assign('/studio'); return true }`, 'open studio')
  check('studio booted', Boolean(await waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 'boot')))

  // 1. The import: choosing the brand opens the project on its text at
  // once; the wireframe is made in the background, and its tab says when.
  await setScenario({ mode: 'paced', marker: 'RUN-F', delayMs: 1000, pauseAfterFirstMs: 25000 })
  const first = await importProject('F')
  await capture('01-text-while-the-wireframe-is-made')
  check('choosing the brand opens the project on its text at once', Boolean(first.text), String(first.text))
  check('the wireframe is made in the background, and its tab says when it is', first.wireframe === true, String(first.wireframe))

  // 2. The presentation, designed from the wireframe: a notebook of its
  // own, its pages bound to the run's; each slide lands as it is finished.
  const designedF = await designFromWireframe('F')
  const wireF = designedF.wireframe ? await projectOf(designedF.wireframe) : null
  const madeF = designedF.presentation ? await projectOf(designedF.presentation) : null
  check('the wireframe offers to design the presentation, and designing it opens the presentation', Boolean(designedF.wireframe && designedF.presentation), JSON.stringify(designedF))
  check('the presentation is a notebook of the project, made from the wireframe: the same pages, each bound to the run', madeF?.container?.kind === 'presentation' && madeF.container.from === designedF.wireframe && madeF.container.id === wireF?.container?.id && scenesIn(madeF).length === 2 && scenesIn(madeF).every((scene, index) => scene.attrs.id === scenesIn(wireF)[index]?.attrs?.id && scene.attrs.pageOrigin?.designing?.page === index + 1), JSON.stringify({ container: madeF?.container, origins: scenesIn(madeF).map(scene => scene.attrs.pageOrigin) }))
  const opened = await waitFor(`async () => {
    const body = await fetch('/api/projects/' + encodeURIComponent(${JSON.stringify(designedF.presentation)})).then(r => r.json()).catch(() => null)
    const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
    const chips = [...document.querySelectorAll('.notebook-scene-block .scene-page-origin')].map(chip => chip.textContent)
    return scenes.length === 2 && scenes[0].attrs.pageOrigin?.kind === 'designed' && scenes[1].attrs.pageOrigin?.designing && chips.length === 1 && !document.getElementById('page-design-status').hidden ? { origins: scenes.map(scene => scene.attrs.pageOrigin), svgs: scenes.map(scene => (String(scene.attrs.svg).match(/RUN-\\w/) || [''])[0]), chips, status: document.getElementById('page-design-text').textContent } : null
  }`, 'first slide landed', 120)
  const runF = opened?.origins?.[1]?.designing?.runId
  check('the first slide lands as it is finished, recording its harness and run', opened?.origins?.[0]?.kind === 'designed' && /^Kimi/.test(opened.origins[0].by || '') && Boolean(runF) && opened.origins[0].runId === runF && opened.svgs[0] === 'RUN-F', JSON.stringify(opened?.origins?.[0]))
  check('the slide still being designed waits for its page from that run', opened?.origins?.[1]?.kind === 'schematic' && opened.origins[1].designing?.page === 2 && opened.svgs[1] === '', JSON.stringify(opened?.origins?.[1]))
  check('the presentation says the slide is being designed', opened?.chips?.[0] === 'schematic draft · being designed' && /still designing 1 page; each lands on its scene when it is finished/.test(opened?.status || ''), JSON.stringify({ chips: opened?.chips, status: opened?.status }))
  // B05 of the BoltDB review: how many are designed, how long the run has
  // worked, and the last thing it did.
  const detail = await waitFor(`() => { const text = document.getElementById('page-design-text').textContent; return /1 of 2 designed · working \\d/.test(text) ? text : null }`, 'status detail', 30)
  check('the presentation says how far the design run is, and for how long it has worked', Boolean(detail), String(detail))
  check('the designer goes on', (await runStatus(runF)) === 'running', String(await runStatus(runF)))
  // F1 of the Perplexity review: a video made now would start from the
  // schematic still being designed. The offer says so, and waiting comes first.
  await evaluate(`() => { document.getElementById('open-planning').click(); return true }`, 'plan video')
  const waitOffer = await waitFor(`() => { const wait = document.querySelector('#planning-workspace .planning-wait-pages'); const create = document.querySelector('#planning-workspace .planning-create-fork'); return wait && create ? { wait: wait.textContent, create: create.textContent, status: document.querySelector('#planning-workspace .planning-fork-status')?.textContent || '' } : null }`, 'fork offer', 40)
  check('a video offered while a slide is still being designed says so, and offers to wait', waitOffer?.wait === 'Wait for the designed pages' && waitOffer.create === 'Make the video now' && /^1 of 2 pages are designed; 1 is still being designed\. A video made now starts from that page's schematic draft; a scene not yet planned takes its designed slide by itself as it lands, and one you have planned is offered it\./.test(waitOffer.status), JSON.stringify(waitOffer))
  await capture('02-video-offered-while-designing')
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-wait-pages').click(); return true }`, 'wait')
  const waited = await waitFor(`async () => document.getElementById('planning-dialog').open ? null : (await fetch('/api/projects').then(r => r.json())).projects.filter(row => row.derivedFrom).length + 1`, 'offer closed', 20)
  check('waiting closes the offer and makes no video', waited === 1, String(waited))
  await evaluate(`() => { document.querySelector('.notebook-scene-block .scene-page-origin')?.scrollIntoView({ block: 'center' }); return true }`, 'scroll to draft').catch(() => {})
  await sleep(600)
  const sticky = await evaluate(`() => { const bar = document.getElementById('page-design-status').getBoundingClientRect(); return bar.height > 0 && bar.top >= 0 && bar.bottom <= innerHeight }`, 'status in view')
  check('the presentation keeps saying so while it is scrolled', sticky === true, String(sticky))
  await capture('03-presentation-still-designing')
  const landed = await waitFor(`async () => {
    const body = await fetch('/api/projects/' + encodeURIComponent(${JSON.stringify(designedF.presentation)})).then(r => r.json()).catch(() => null)
    const scene = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')[1]
    const origin = scene?.attrs?.pageOrigin
    // The worker settles the slide; the window takes it on its next pass.
    return origin?.kind === 'designed' && !origin.designing && String(scene.attrs.svg).includes('RUN-F') && document.getElementById('page-design-status').hidden ? { origin, chips: [...document.querySelectorAll('.notebook-scene-block .scene-page-origin')].length, statusHidden: document.getElementById('page-design-status').hidden } : null
  }`, 'landed', 120)
  check('the slide designed after opening lands on its page', /^Kimi/.test(landed?.origin?.by || '') && landed?.origin?.runId === runF && landed?.chips === 0, JSON.stringify(landed))
  check('once the run is done, the presentation stops waiting', landed?.statusHidden === true && (await runStatus(runF)) === 'done', JSON.stringify({ statusHidden: landed?.statusHidden, run: await runStatus(runF) }))
  const wireAfter = designedF.wireframe ? await projectOf(designedF.wireframe) : null
  check('the wireframe keeps its schematics', scenesIn(wireAfter).length === 2 && scenesIn(wireAfter).every(scene => scene.attrs.pageOrigin?.kind === 'schematic' && !String(scene.attrs.svg).includes('RUN-F')), JSON.stringify(scenesIn(wireAfter).map(scene => scene.attrs.pageOrigin)))
  // Every slide designed: the offer makes the video from them.
  await evaluate(`() => { document.getElementById('open-planning').click(); return true }`, 'plan video again')
  const readyOffer = await waitFor(`() => { const create = document.querySelector('#planning-workspace .planning-create-fork'); return create && !document.querySelector('#planning-workspace .planning-wait-pages') ? { create: create.textContent, status: document.querySelector('#planning-workspace .planning-fork-status')?.textContent || '' } : null }`, 'fork offer ready', 40)
  check('once every slide is designed, the offer makes the video from them', readyOffer?.create === 'Create video fork and prepare brief' && !/schematic|still being designed/.test(readyOffer.status), JSON.stringify(readyOffer))
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-close').click(); return true }`, 'close offer')
  const shownF = await waitFor(`() => { const tabs = [...document.querySelectorAll('#notebook-switch .notebook-switch-tab')].map(tab => tab.querySelector('strong').textContent + (tab.getAttribute('aria-current') === 'page' ? '*' : '') + ': ' + tab.querySelector('small').textContent).join(' · '); return /Wireframe: 2 pages · Presentation\\*: 2 slides · Video: not made yet$/.test(tabs) && document.getElementById('next-step').textContent === 'Create video' ? tabs : null }`, 'presentation ready', 60)
  await capture('04-presentation-landed')
  check('the presentation, its slides landed, reads as ready in the switch and leads to its video', Boolean(shownF), String(shownF))

  // 3. Stop remaining work, from the presentation: what was finished stays,
  // the rest stay schematic drafts, and nothing waits any more.
  await setScenario({ mode: 'paced', marker: 'RUN-G', delayMs: 1000, pauseAfterFirstMs: 90000 })
  const deckG = await designedDeck('RUN-G')
  const statusG = await waitFor(`() => document.getElementById('page-design-status').hidden ? null : document.getElementById('page-design-text').textContent`, 'G designing', 30)
  check('a second presentation opens while its second slide is still being designed', Boolean(deckG.run) && /still designing 1 page/.test(statusG || ''), statusG)
  await evaluate(`() => { document.getElementById('page-design-stop').click(); return true }`, 'stop remaining work')
  const stoppedG = await waitFor(`async () => {
    if (!document.getElementById('page-design-status').hidden) return null
    const body = await fetch('/api/projects/' + encodeURIComponent(${JSON.stringify(deckG.base)})).then(r => r.json()).catch(() => null)
    const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
    return scenes.length === 2 && scenes.every(scene => !scene.attrs.pageOrigin?.designing) ? { origins: scenes.map(scene => scene.attrs.pageOrigin), chips: [...document.querySelectorAll('.notebook-scene-block .scene-page-origin')].map(chip => chip.textContent) } : null
  }`, 'G stopped', 60)
  check('Stop remaining work stops the designer from the presentation', (await runStatus(deckG.run)) === 'cancelled', String(await runStatus(deckG.run)))
  check('what it finished stays designed, and the rest stay schematic drafts', stoppedG?.origins?.[0]?.kind === 'designed' && stoppedG?.origins?.[1]?.kind === 'schematic' && JSON.stringify(stoppedG?.chips) === JSON.stringify(['schematic draft']), JSON.stringify(stoppedG))

  // 4. A video made while a slide is still being designed (B06). Only the
  // video is open: the slide the run finishes lands on the saved
  // presentation in the app's worker, and the video's waiting scene takes
  // it by itself as it lands, the scene on show left as it was. Asking
  // again lands nothing twice.
  await setScenario({ mode: 'paced', marker: 'RUN-H', delayMs: 1000, pauseAfterFirstMs: 25000 })
  const deckH = await designedDeck('RUN-H')
  check('a third presentation opens while its second slide is still being designed', Boolean(deckH.run && deckH.base), JSON.stringify(deckH))
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'); document.getElementById('open-planning').click(); return true }`, 'plan video H')
  await waitFor(`() => document.querySelector('#planning-workspace .planning-create-fork') ? true : null`, 'fork offer H', 40)
  await evaluate(`() => { document.querySelector('#planning-workspace .planning-create-fork').click(); return true }`, 'continue with schematics')
  const videoH = await waitFor(`async () => {
    const id = window.localStorage.getItem('incredible-studio-v2-active-project')
    const body = id ? await fetch('/api/projects/' + encodeURIComponent(id)).then(r => r.json()).catch(() => null) : null
    return body?.project?.derivedFrom?.notebook === ${JSON.stringify(deckH.base)} && document.body.classList.contains('is-video-notebook') ? id : null
  }`, 'video H open', 90)
  check('the video is made from the base while its page is designed, and opens in its place', Boolean(videoH), String(videoH))
  // R06 of the project-flow rereview: it opens in Scenes, preparing its brief
  // there, with no planning window over it. The notebook view is where the
  // rest of this flow works.
  const inScenes = await waitFor(`() => { const workspace = document.getElementById('scene-workspace'); return workspace && !workspace.hidden ? { dialog: document.getElementById('planning-dialog')?.open === true } : null }`, 'video H in scenes', 40)
  await sleep(2000)
  check(Boolean(inScenes) && !inScenes.dialog && !(await evaluate(`() => document.getElementById('planning-dialog')?.open === true`, 'no planning window')), 'the new video opens in Scenes, with no planning window over it', JSON.stringify(inScenes))
  await evaluate(`() => { document.getElementById('workspace-tab-notebook').click(); return true }`, 'the notebook view')
  await waitFor(`() => document.getElementById('scene-workspace').hidden ? true : null`, 'notebook view', 20)
  const waitingScene = String(scenesIn(await projectOf(videoH))[1]?.attrs?.id || '')
  const before = (await overviewOf(videoH))?.scenes?.find(scene => scene.id === waitingScene)?.reference
  check('its second scene says its base is still designing its page', before?.baseDesigning === true && !before.newer, JSON.stringify(before))
  await evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[1]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true }`, 'select the waiting scene')
  const waitingNotice = await waitFor(`() => { const notice = document.querySelector('[data-review-reference="designing"]'); return notice ? { text: notice.textContent, progress: Boolean(notice.querySelector('[data-review-design]')) } : null }`, 'designing notice', 40)
  check('the scene\'s review says its page is being designed, with the run\'s progress, and that it takes the page by itself — it is not planned yet', Boolean(waitingNotice?.progress) && /When it lands, this scene takes it by itself/.test(waitingNotice.text), JSON.stringify(waitingNotice))
  // The creator goes on with the other scene: selection and keyboard there.
  await evaluate(`() => { const node = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[0]; node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true }`, 'select the first scene')
  await sleep(1000)
  // The scene on show is the one whose review is open (the test window has
  // no keyboard focus to keep, so focus is not read here).
  const inHand = await waitFor(`() => { const first = document.querySelectorAll('#editor .tiptap > [data-block-type="scene"]')[0]; const control = document.querySelector('.scene-review.is-expanded [data-focus^="workspace:"]'); return first && control?.dataset.focus === 'workspace:' + first.id ? { first: first.id } : null }`, 'first scene in hand', 30)
  check('the creator goes on with the first scene', Boolean(inHand), JSON.stringify(inHand))
  const firstScene = inHand?.first
  const landedH = await until(async () => {
    const scene = scenesIn(await projectOf(deckH.base))[1]
    return scene?.attrs?.pageOrigin?.kind === 'designed' && String(scene.attrs.svg).includes('RUN-H') ? scene.attrs : null
  }, 120)
  check('the page lands on the saved base while only the video is open', Boolean(landedH) && landedH.pageOrigin.runId === deckH.run, JSON.stringify(landedH?.pageOrigin))
  check('it waits to be planned from its words until the base is next opened', landedH?.pageOrigin?.replan === true, JSON.stringify(landedH?.pageOrigin))
  // The chaining: the scene not yet planned takes its designed slide as it
  // lands, by itself — the base never opened, the creator's scene and
  // keyboard left where they were.
  const taken = await until(async () => {
    const scene = scenesIn(await projectOf(videoH))[1]
    return String(scene?.attrs?.svg || '').includes('RUN-H') && scene.attrs.reference ? scene.attrs : null
  }, 60)
  check('the waiting scene takes its designed slide by itself as it lands', taken?.pageOrigin?.kind === 'designed' && !taken.pageOrigin.replan && Boolean(taken.reference?.revision), JSON.stringify(taken && { origin: taken.pageOrigin, reference: taken.reference }))
  const stayed = await waitFor(`() => { const control = document.querySelector('.scene-review.is-expanded [data-focus^="workspace:"]'); return control ? { shown: control.dataset.focus.slice('workspace:'.length) } : null }`, 'first scene kept', 20)
  check('the scene on show stays the one the creator chose', Boolean(firstScene) && stayed?.shown === firstScene, JSON.stringify({ firstScene, stayed }))
  if (!stayed || stayed.shown !== firstScene) console.log('DIAGNOSIS', JSON.stringify(await evaluate(`() => ({ reviews: [...document.querySelectorAll('.scene-review')].map(review => ({ expanded: review.classList.contains('is-expanded'), controls: [...review.querySelectorAll('[data-focus]')].map(element => element.dataset.focus).slice(0, 4) })), selected: document.querySelector('.selected-block')?.id || '', active: localStorage.getItem('incredible-studio-v2-active-project'), view: localStorage.getItem('incredible-studio-v2-video-view'), dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id), title: document.getElementById('project-title')?.value })`, 'diagnosis after')))
  await capture('08-video-took-landed-page')
  const pinned = (await overviewOf(videoH))?.scenes?.find(scene => scene.id === waitingScene)?.reference
  check('the video records which page it took, and has nothing more to offer', Boolean(pinned?.adopted) && pinned.newer === null && pinned.kind === 'designed', JSON.stringify(pinned && { revision: pinned.revision, adopted: pinned.adopted, newer: pinned.newer }))
  const settled = await until(async () => (await runStatus(deckH.run)) === 'done' && !scenesIn(await projectOf(deckH.base))[1]?.attrs?.pageOrigin?.designing, 90)
  const again = [await landNow(deckH.base), await landNow(deckH.base)]
  check('once the run is done its binding goes, and landing again changes nothing', Boolean(settled) && again.every(result => result?.landed && !result.landed.saved && result.landed.landed.length === 0), JSON.stringify(again.map(result => result?.landed)))
  // Opened again, the base plans the landed page from its words, and saves
  // over the worker's landing without a conflict.
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(deckH.base)}); location.assign('/studio'); return true }`, 'open base H').catch(() => {})
  const replanned = await until(async () => {
    const scene = scenesIn(await projectOf(deckH.base))[1]
    return scene?.attrs?.pageOrigin?.kind === 'designed' && !scene.attrs.pageOrigin.replan ? scene.attrs : null
  }, 60)
  const saved = await waitFor(`() => document.getElementById('project-title')?.value ? { conflict: /Newer saved version/.test(document.body.innerText) } : null`, 'base H open', 30)
  check('opened again, the base plans the landed page, and saves without a conflict', Boolean(replanned) && (replanned.motion?.steps || []).length > 0 && saved?.conflict === false, JSON.stringify({ origin: replanned?.pageOrigin, steps: (replanned?.motion?.steps || []).length, saved }))

  // 5. After a restart (B06): the app closes while a run draws, and the
  // page the run left lands when it opens again — with the video open, not
  // the base.
  await setScenario({ mode: 'paced', marker: 'RUN-I', delayMs: 1000, pauseAfterFirstMs: 90000 })
  const deckI = await designedDeck('RUN-I')
  check('a fourth presentation opens while its second slide is still being designed', Boolean(deckI.run && deckI.base), JSON.stringify(deckI))
  const runI = (await fetch(`${origin}/api/runs`).then(r => r.json())).runs.find(run => run.id === deckI.run)
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(videoH)}); return true }`, 'leave the video open')
  await stopApp(app)
  await writeFile(join(runI.projectDir, 'pages', '02_page.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" font-family="Inter, sans-serif" font-size="22" data-page-role="diagram" data-page-index="02">
<g data-role="background"><rect width="1280" height="720" fill="#0b1020"/></g>
<g data-role="header"><text id="s2-title" x="80" y="96" font-size="40" fill="#f5f7fb">Scene 2</text></g>
<g id="s2-node-clients" data-role="node" data-kind="box" data-entity="client"><rect x="120" y="300" width="320" height="110" rx="14" fill="#635bff" fill-opacity="0.12" stroke="#635bff"/><text x="190" y="362" fill="#f5f7fb">Clients RUN-I</text></g>
<g id="s2-node-service" data-role="node" data-kind="box" data-entity="service"><rect x="780" y="300" width="320" height="110" rx="14" fill="#22c55e" fill-opacity="0.12" stroke="#22c55e"/><text x="850" y="362" fill="#f5f7fb">Service</text></g>
<line id="s2-edge-1" data-role="connector" data-verb="sends to" x1="440" y1="355" x2="780" y2="355" stroke="#635bff" stroke-width="2"/>
</svg>`)
  ;({ child: app, found: origin } = await startApp())
  const recovered = await until(async () => {
    const scene = scenesIn(await projectOf(deckI.base))[1]
    return scene?.attrs?.pageOrigin?.kind === 'designed' && !scene.attrs.pageOrigin.designing && String(scene.attrs.svg).includes('RUN-I') ? scene.attrs : null
  }, 90)
  check('after a restart, the page the run left lands on its base, and the binding goes with the run', Boolean(recovered), JSON.stringify(recovered?.pageOrigin))
  check('the run the app was working when it closed reads as ended', ['error', 'interrupted', 'cancelled'].includes(await runStatus(deckI.run)), String(await runStatus(deckI.run)))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  await stopApp(app)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `SOURCE DESIGN CHECK FAIL (${failures})` : 'SOURCE DESIGN CHECK PASS')
process.exitCode = failures ? 1 : 0
