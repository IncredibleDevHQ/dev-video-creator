// Live proof of the first next-stage milestone (P0–P3, the visual review
// loop) on the creator's real local harness. It spends model budget by
// design and is not part of the deterministic release suite.
//
// Everything goes through the product: a real article is read, the story is
// planned and the pages designed by the harness; a video is made from the
// base, whose brief the harness prepares; two scenes are planned from their
// complete packets; one is revised with creator direction, compared, sketched
// as a rough Hyperframes preview on the Studio stage and approved; the other
// stays a candidate. After a restart both read as they were left, and nothing
// downstream — artwork generation, takes, production, export — has started.
//
//   LIVE_HARNESS / LIVE_MODEL   the planning choice (claude-code / claude-opus-5-5)
//   LIVE_SOURCE_URL / LIVE_TARGET  the article and its target length (2:00)
//   LIVE_DATA_DIR               the app's data directory (kept)
//   LIVE_EVIDENCE_DIR           captures and evidence.json
//   LIVE_BASE_ID / LIVE_VIDEO_ID  resume from an existing base or video
//
// The store is the local file store unless STUDIO_PERSISTENCE says otherwise;
// PostgreSQL needs an explicit STUDIO_DATABASE_URL (never the default one).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const persistence = process.env.STUDIO_PERSISTENCE || 'local'
if (persistence === 'postgres' && !process.env.STUDIO_DATABASE_URL) {
  console.error('Refusing: PostgreSQL persistence needs an explicit STUDIO_DATABASE_URL — the default is the development database')
  process.exit(2)
}
if (process.env.STUDIO_CLAUDE_BIN) console.warn(`Note: STUDIO_CLAUDE_BIN is set (${process.env.STUDIO_CLAUDE_BIN}) — this is not the auto-discovered harness`)
const harness = process.env.LIVE_HARNESS || 'claude-code'
const model = process.env.LIVE_MODEL || 'claude-opus-5-5'
const sourceUrl = process.env.LIVE_SOURCE_URL || 'https://stripe.com/blog/rate-limiters'
const target = process.env.LIVE_TARGET || '2:00'
const dataDir = process.env.LIVE_DATA_DIR || join(await mkdtemp(join(tmpdir(), 'studio-live-review-')), 'data')
const evidenceDir = process.env.LIVE_EVIDENCE_DIR || join(dataDir, '..', 'evidence')
await mkdir(evidenceDir, { recursive: true })
const appLog = createWriteStream(join(evidenceDir, 'app.log'), { flags: 'a' })

const evidence = { harness, model, sourceUrl, target, persistence, startedAt: new Date().toISOString(), stages: [], checks: [], runs: [], notes: [] }
const saveEvidence = () => writeFile(join(evidenceDir, 'evidence.json'), JSON.stringify(evidence, null, 2)).catch(() => {})
let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  evidence.checks.push({ ok: Boolean(ok), label, at: new Date().toISOString() })
  if (!ok) failures += 1
  void saveEvidence()
}
const note = text => {
  console.log(`NOTE  ${text}`)
  evidence.notes.push({ text, at: new Date().toISOString() })
}
const stage = name => {
  const entry = { name, startedAt: new Date().toISOString(), seconds: null }
  evidence.stages.push(entry)
  console.log(`\n——— ${name} ———`)
  const started = Date.now()
  return extra => {
    entry.seconds = Math.round((Date.now() - started) / 1000)
    Object.assign(entry, extra || {})
    void saveEvidence()
  }
}

// ——— The app ———
let child = null
let origin = ''
const launch = async () => {
  const env = { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_PERSISTENCE: persistence, STUDIO_DATA_DIR: dataDir, STUDIO_OUTPUTS_DIR: join(dataDir, '..', 'outputs') }
  child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stderr.on('data', chunk => appLog.write(chunk))
  origin = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('the app did not start')), 180_000)
    child.stdout.on('data', chunk => {
      appLog.write(chunk)
      text += chunk.toString()
      const match = /STUDIO_ORIGIN (\S+)/.exec(text)
      if (match && /SMOKE PASS/.test(text)) { clearTimeout(timer); resolve(match[1]) }
    })
    child.once('exit', code => reject(new Error(`the app exited (${code})`)))
  })
}
const quit = async () => {
  if (!child) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 10_000))])
  child = null
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const api = async (path, init) => {
  const response = await fetch(origin + path, init)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
const evaluate = async js => {
  const { body } = await post('/__eval', { js: `(${js})()` })
  if (!body?.ok) throw new Error(body?.error || 'eval failed')
  return body.result
}
const waitFor = async (js, seconds = 60) => {
  for (let i = 0; i < seconds; i++) {
    const value = await evaluate(js).catch(() => null)
    if (value) return value
    await sleep(1000)
  }
  return null
}
const until = async (test, seconds = 90, every = 3000) => {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    const value = await test().catch(() => null)
    if (value) return value
    await sleep(every)
  }
  return null
}
const shot = async (name, scrollTo) => {
  if (scrollTo) await evaluate(scrollTo).catch(() => {})
  await sleep(1200)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await writeFile(join(evidenceDir, `${name}.png`), Buffer.from(await response.arrayBuffer()))
  console.log(`SHOT  ${name}.png`)
}
const openStudio = async () => {
  await evaluate(`() => { location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  return waitFor(`() => Boolean(document.querySelector('#editor .ProseMirror'))`, 90)
}
const openNotebook = async id => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(3000)
  return waitFor(`async () => { const id = localStorage.getItem('incredible-studio-v2-active-project'); return id === ${JSON.stringify(id)} && document.querySelector('#editor .ProseMirror') ? document.getElementById('project-title')?.value || true : null }`, 90)
}
const runs = async () => (await api('/api/runs')).body?.runs || []
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(response => response.body)
const sceneOf = async (videoId, sceneId) => (await overview(videoId))?.scenes?.find(scene => scene.id === sceneId)
// What a finished run says about itself: the model it asked for and the one
// the harness reported, and whether it looked at the images it was given.
const describeRun = async run => {
  const info = { id: run.id, skill: run.skill, route: run.route, adapter: run.adapter, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, seconds: run.startedAt && run.finishedAt ? Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000) : null }
  try {
    const facts = JSON.parse(await readFile(join(run.projectDir, 'packet', 'RUN.json'), 'utf8'))
    info.packetRun = { harness: facts.harness, model: facts.model, imageInspection: facts.imageInspection }
  } catch {}
  try {
    const inputs = JSON.parse(await readFile(join(run.projectDir, 'motion', 'inputs.json'), 'utf8'))
    info.requestedModel = inputs.model || null
  } catch {}
  return info
}
const selectScene = id => evaluate(`() => { const node = document.getElementById(${JSON.stringify(id)}); if (!node) return false; node.scrollIntoView({ block: 'start' }); node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true }`)
const inReview = (id, selector) => `document.querySelector('.scene-review[data-review-scene="${id}"] ${selector}')`
const click = (id, selector) => evaluate(`() => { const element = ${inReview(id, selector)}; if (!element || element.disabled) return false; element.click(); return true }`)
const reviewState = id => evaluate(`() => {
  const review = document.querySelector('.scene-review[data-review-scene="${id}"]')
  if (!review) return null
  return {
    expanded: review.classList.contains('is-expanded'),
    strip: [...review.querySelectorAll('.review-strip .review-chip')].map(chip => chip.textContent),
    thumbs: review.querySelectorAll('.review-strip-cast img').length,
    question: review.querySelector('.review-question')?.textContent || '',
    cast: [...review.querySelectorAll('.review-cast-item')].map(item => ({ entity: item.querySelector('strong')?.textContent, image: Boolean(item.querySelector('img')) })),
    moments: [...review.querySelectorAll('.review-moment-head strong')].map(entry => entry.textContent),
    approve: review.querySelector('[data-focus^="approve:"]')?.textContent || '',
    revisions: [...review.querySelectorAll('.review-revision')].map(button => button.textContent),
    provenance: [...review.querySelectorAll('.review-panel .review-muted')].map(line => line.textContent).find(line => /^Plan r\\d+/.test(line)) || '',
  }
}`)
const scrollToScene = id => `() => { const node = document.getElementById(${JSON.stringify(id)}); if (node) node.scrollIntoView({ block: 'start' }); return true }`
const scrollToReview = id => `() => { const review = document.querySelector('.scene-review[data-review-scene="${id}"] .review-panel') || document.querySelector('.scene-review[data-review-scene="${id}"]'); if (review) review.scrollIntoView({ block: 'start' }); return true }`
// The direction a creator might give each kind of scene.
const directionFor = title =>
  /concurren/i.test(title) ? 'Open on the pool already holding twenty requests. When the twenty-first arrives, push in on it being turned away before the narration says why — the refusal is the point of this scene.'
  : /token bucket/i.test(title) ? 'Let a burst drain the bucket until a request is refused, then hold on the steady refill before the narration names the rate.'
  : 'Slow the key moment down: push in on the mechanism at the instant it acts, and hold there long enough to read it.'
const MECHANISM = [/concurren/i, /token bucket/i, /each user|per user|request rate/i, /load shed|shed load/i, /fleet/i, /worker/i]

let baseId = process.env.LIVE_BASE_ID || ''
let videoId = process.env.LIVE_VIDEO_ID || ''
try {
  let done = stage('Launch and choose the planning harness')
  await launch()
  const saved = await api('/api/settings/harness', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default: { harness, model } }) })
  check(saved.body?.preferences?.default?.harness === harness && saved.body?.preferences?.default?.model === model, `the durable harness choice is ${harness} · ${model} (${JSON.stringify(saved.body?.preferences?.default)})`)
  check(Boolean(await openStudio()), 'the studio opens')
  const adapters = await evaluate(`() => window.studioDesktop.harness.adapters()`)
  const adapter = adapters.find(entry => entry.id === harness)
  const option = adapter?.models?.options?.find(entry => entry.id === model)
  check(adapter?.ok && option && !option.unavailable, `the harness is available with the model (${adapter?.id} ${adapter?.version || ''} · ${option?.label || model}${option?.unavailable ? ` — ${option.unavailable}` : ''})`)
  evidence.harnessVersion = adapter?.version || null
  done({ harnessVersion: adapter?.version || null })

  // ——— A rich base from a real article, designed by the harness ———
  if (!baseId && !videoId) {
    done = stage('Read the article')
    await evaluate(`() => { window.__source.open('link'); return true }`)
    await evaluate(`() => { document.getElementById('source-url').value = ${JSON.stringify(sourceUrl)}; document.getElementById('source-read').click(); return true }`)
    const read = await waitFor(`() => {
      if (!document.getElementById('source-step-brand').hidden) return { title: document.getElementById('source-read-title').textContent, meta: document.getElementById('source-read-meta').textContent }
      const status = document.getElementById('source-status')
      return status && status.classList.contains('is-error') ? { error: status.textContent } : null
    }`, 300)
    check(read && !read.error, `the article is read (${JSON.stringify(read)})`)
    await shot('01-source-read')
    done(read || {})

    done = stage('Plan the story')
    await evaluate(`() => { document.getElementById('source-target').value = ${JSON.stringify(target)}; document.getElementById('source-to-outline').click(); return true }`)
    const outline = await waitFor(`() => {
      if (!document.getElementById('source-step-outline').hidden && document.querySelectorAll('#source-scenes li').length) {
        return { titles: [...document.querySelectorAll('#source-scenes li')].map(item => item.querySelector('input')?.value || ''), sum: document.getElementById('source-outline-sum').textContent, hint: document.getElementById('source-design-hint').textContent, designHidden: document.getElementById('source-design-pages').hidden }
      }
      const status = document.getElementById('source-brand-status')?.textContent || ''
      return /ended|failed|wrote no outline|still going/i.test(status) ? { error: status } : null
    }`, 25 * 60)
    check(outline && !outline.error, `the harness plans the story (${JSON.stringify(outline)})`)
    const storyRun = (await runs()).find(run => run.skill === 'story-master')
    if (storyRun) evidence.runs.push(await describeRun(storyRun))
    // The harness list resolves after the outline shows: wait for the offer.
    const offer = await waitFor(`() => { const design = document.getElementById('source-design-pages'); return design.hidden ? null : { primary: design.classList.contains('primary'), hint: document.getElementById('source-design-hint').textContent } }`, 40)
    check(offer?.primary && /Claude Code|Kimi|Codex/.test(offer.hint), `designing the pages is the primary action on the chosen harness (${offer?.hint})`)
    await shot('02-outline')
    done({ scenes: outline?.titles || [] })

    done = stage('Design the pages')
    await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`)
    let phases = []
    let status = null
    let retried = false
    let firstShot = false
    const deadline = Date.now() + 75 * 60 * 1000
    while (Date.now() < deadline) {
      status = await evaluate(`() => window.__source.drawStatus()`).catch(() => status)
      if (status) {
        const key = `${status.phase}:${status.drawn}/${status.total}`
        if (phases[phases.length - 1]?.key !== key) {
          phases.push({ key, at: new Date().toISOString(), status: status.status })
          console.log(`      ${key}  ${status.status}`)
        }
        if (!firstShot && status.drawn >= 1 && status.phase === 'designing') { firstShot = true; await shot('03-designing') }
        if (status.phase === 'ready') break
        if ((status.phase === 'failed' || status.phase === 'incomplete') && !status.runId) {
          if (retried) break
          retried = true
          note(`the design run ended ${status.phase}: ${status.status} ${status.failure}`)
          await evaluate(`() => { const retry = [...document.querySelectorAll('#source-draw-failure button')].find(button => button.textContent === 'Retry') || document.getElementById('source-draw'); if (retry && !retry.hidden) retry.click(); return true }`)
          await sleep(5000)
        }
      }
      await sleep(3000)
    }
    evidence.designPhases = phases
    check(status?.phase === 'ready', `the harness designs every page (${status?.status})`)
    const pageRuns = (await runs()).filter(run => run.skill === 'page-master')
    for (const run of pageRuns) evidence.runs.push(await describeRun(run))
    await shot('04-pages-ready')
    await evaluate(`() => { document.getElementById('source-finish').click(); return true }`)
    const base = await waitFor(`async () => {
      if (document.getElementById('source-dialog')?.open) return null
      const id = localStorage.getItem('incredible-studio-v2-active-project')
      const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(response => response.json()).catch(() => null)
      const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
      return scenes.length ? { id, title: body.project.title, scenes: scenes.map(scene => ({ id: scene.attrs.id, title: scene.attrs.title, origin: scene.attrs.pageOrigin, svg: String(scene.attrs.svg || '').length })) } : null
    }`, 180)
    check(Boolean(base) && base.scenes.every(scene => scene.origin?.kind === 'designed' && scene.svg > 2000), `the base opens with every page designed (${JSON.stringify(base?.scenes?.map(scene => [scene.title, scene.origin?.kind, scene.origin?.by, scene.svg]))})`)
    baseId = base?.id || ''
    evidence.base = base
    done({ baseId, phases: phases.map(phase => phase.key) })
  }

  // ——— The video, made from the base; its brief prepared by the harness ———
  if (!videoId) {
    done = stage('Make the video and prepare its brief')
    const baseDoc = (await api(`/api/projects/${encodeURIComponent(baseId)}`)).body?.project
    if (!(await openNotebook(baseId))) throw new Error('the base did not open')
    await evaluate(`() => { document.getElementById('notebook-menu-toggle').click(); return true }`)
    await waitFor(`() => { const button = document.querySelector('.notebook-menu-library'); if (!button) return null; button.click(); return true }`, 20)
    const created = await waitFor(`() => {
      const card = [...document.querySelectorAll('#notebooks-tree .notebook-card:not(.is-child)')].find(entry => entry.querySelector('.notebook-card-main strong')?.textContent === ${JSON.stringify(baseDoc.title)})
      const button = card && [...card.querySelectorAll('button')].find(entry => entry.textContent === 'Create video')
      if (!button) return null
      button.click()
      return true
    }`, 30)
    check(Boolean(created), 'Create video is offered on the base in the library')
    const video = await until(async () => {
      const id = await evaluate(`() => localStorage.getItem('incredible-studio-v2-active-project')`)
      if (!id || id === baseId) return null
      const doc = (await api(`/api/projects/${encodeURIComponent(id)}`)).body?.project
      return doc?.derivedFrom?.notebook === baseId ? doc : null
    }, 120)
    check(Boolean(video), `a video notebook is made from the base (${video?.title})`)
    videoId = video?.id || ''
    evidence.video = { id: videoId, title: video?.title }
    const brief = await until(async () => {
      const current = await overview(videoId)
      if (current?.brief?.current) return current.brief.current
      return current?.brief?.latest?.status === 'failed' ? current.brief.latest : null
    }, 30 * 60, 5000)
    check(brief?.status === 'ready', `the harness prepares the video's explanation brief${brief?.status === 'failed' ? ` (failed: ${brief.error?.message} ${brief.error?.providerStatus || ''})` : ''} (${brief?.adapter} ${brief?.reportedModel || brief?.model || ''})`)
    const briefRun = (await runs()).find(run => run.route === 'Prepare Brief')
    if (briefRun) evidence.runs.push(await describeRun(briefRun))
    evidence.brief = brief ? { id: brief.id, adapter: brief.adapter, model: brief.model, reportedModel: brief.reportedModel, units: brief.content?.units?.length, entities: brief.content?.entities?.length, evidence: brief.content?.evidence?.length } : null
    done({ videoId, brief: evidence.brief })
  }
  if (!(await evaluate(`() => localStorage.getItem('incredible-studio-v2-active-project')`).catch(() => '')).includes(videoId)) await openNotebook(videoId)

  // ——— The visual cast, extracted from the rich pages ———
  let done2 = stage('The visual cast')
  const cast = await until(async () => { const current = (await overview(videoId))?.visualCast; return current && current.status !== 'extracting' ? current : null }, 300)
  const verified = (cast?.entries || []).filter(entry => entry.verification === 'verified')
  check(cast?.status === 'ready' && verified.length >= 3, `the base's cast is extracted and verified (${verified.length} of ${cast?.entries?.length || 0} verified, ${cast?.pages?.length || 0} pages)`)
  evidence.cast = { status: cast?.status, entries: cast?.entries?.length || 0, verified: verified.length, byPage: Object.fromEntries((cast?.pages || []).map(page => [page.title, (cast.entries || []).filter(entry => entry.page === page.scene && entry.verification === 'verified').map(entry => entry.label)])) }
  const planning = await waitFor(`() => document.getElementById('planning-dialog')?.open ? true : null`, 5)
  if (planning) {
    await evaluate(`() => { [...document.querySelectorAll('#planning-workspace .planning-tab')].find(tab => tab.textContent === 'Video explanation brief')?.click(); return true }`)
    await shot('05-brief')
    await evaluate(`() => { [...document.querySelectorAll('#planning-workspace .planning-tab')].find(tab => tab.textContent === 'Visual cast')?.click(); return true }`)
    await shot('06-visual-cast')
    await evaluate(`() => { document.querySelector('#planning-workspace .planning-close')?.click(); return true }`)
  }
  done2(evidence.cast)

  // ——— Two scenes, planned from their packets ———
  done2 = stage('Plan two scenes')
  const scenes = (await overview(videoId)).scenes
  const pick = pattern => scenes.find(scene => pattern.test(scene.title))
  const sceneA = MECHANISM.map(pick).find(Boolean) || scenes[Math.min(1, scenes.length - 1)]
  const sceneB = MECHANISM.map(pick).filter(Boolean).find(scene => scene.id !== sceneA.id) || scenes.find(scene => scene.id !== sceneA.id)
  evidence.scenes = { a: { id: sceneA.id, title: sceneA.title }, b: { id: sceneB.id, title: sceneB.title } }
  note(`scene A: ${sceneA.title} · scene B: ${sceneB.title}`)
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  for (const scene of [sceneA, sceneB]) {
    await selectScene(scene.id)
    const ready = await waitFor(`() => ${inReview(scene.id, '[data-focus^="revise:"]:not([disabled])')} ? true : null`, 60)
    check(Boolean(ready), `${scene.title}: Plan the scene is offered in its notebook block`)
    if (scene.id === sceneA.id) {
      const before = await reviewState(scene.id)
      check(before?.thumbs >= 1, `${scene.title}: the block shows the cast its page offers (${before?.thumbs} thumbnails)`)
      await shot('07-scene-block-before-plan', scrollToScene(scene.id))
    }
    // A resumed video keeps the plans it already has.
    if ((await sceneOf(videoId, scene.id))?.view?.current) { note(`${scene.title} already has a plan — kept`); continue }
    await click(scene.id, '[data-focus^="revise:"]')
    await sleep(4000)
  }
  const planned = await until(async () => {
    const a = await sceneOf(videoId, sceneA.id)
    const b = await sceneOf(videoId, sceneB.id)
    const settled = view => view?.current || (view?.latest?.status === 'failed' ? view.latest : null)
    return settled(a?.view) && settled(b?.view) ? { a: settled(a.view), b: settled(b.view) } : null
  }, 35 * 60, 5000)
  check(planned?.a?.status === 'candidate', `${sceneA.title}: the harness plans it (${planned?.a?.status}${planned?.a?.error ? ` — ${planned.a.error.message}` : ''})`)
  check(planned?.b?.status === 'candidate', `${sceneB.title}: the harness plans it (${planned?.b?.status}${planned?.b?.error ? ` — ${planned.b.error.message}` : ''})`)
  for (const run of (await runs()).filter(run => run.route === 'Plan Scene')) evidence.runs.push(await describeRun(run))
  // On a resumed video, the first plan is the scene's earliest candidate.
  const treatmentsA = ((await overview(videoId))?.records || []).filter(record => record.kind === 'treatment' && record.subject === sceneA.id && record.content).sort((a, b) => a.revision - b.revision)
  const firstA = treatmentsA.length > 1 ? treatmentsA[0] : planned?.a
  evidence.plans = { a1: firstA && { id: firstA.id, revision: firstA.revision, adapter: firstA.adapter, model: firstA.model, reportedModel: firstA.reportedModel, question: firstA.content?.question, moments: firstA.content?.moments?.map(moment => moment.title), assets: firstA.content?.objects?.map(object => `${object.entity}: ${object.asset?.status}`) }, b1: planned?.b && { id: planned.b.id, revision: planned.b.revision, question: planned.b.content?.question, moments: planned.b.content?.moments?.map(moment => moment.title) } }
  done2(evidence.plans)

  // ——— Review scene A in its block, beside the stage ———
  done2 = stage('Review the plan in the notebook')
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  await selectScene(sceneA.id)
  const reviewed = await waitFor(`() => ${inReview(sceneA.id, '.review-question')} && !document.getElementById('scene-stage').hidden ? true : null`, 60)
  const state = await reviewState(sceneA.id)
  check(Boolean(reviewed) && state.question && state.moments.length >= 2, `${sceneA.title}: the review shows the plan's question and moments (${JSON.stringify({ question: state?.question, moments: state?.moments })})`)
  check(state?.cast?.length >= 1 && state.cast.some(item => item.image), `${sceneA.title}: the review shows the cast the plan uses, with images (${JSON.stringify(state?.cast)})`)
  check(/Claude Code|claude-code|Kimi|kimi|Codex|codex/.test(state?.provenance || ''), `the review names the harness and model that made the plan (${state?.provenance})`)
  const stageShown = await evaluate(`() => ({ mode: document.querySelector('.scene-stage-modes .is-active')?.textContent, note: document.getElementById('scene-stage-note').textContent, page: Boolean(document.querySelector('#scene-stage-reference svg')) })`)
  check(stageShown.mode === 'Wireframe reference' && stageShown.page, `the stage shows the rich page as the reference (${JSON.stringify(stageShown)})`)
  await evaluate(`() => { const heads = document.querySelectorAll('.scene-review[data-review-scene="${sceneA.id}"] .review-moment-head'); heads[Math.min(1, heads.length - 1)].click(); return true }`)
  const highlight = await waitFor(`() => { const hits = [...document.querySelectorAll('#scene-stage-reference .stage-hit')].map(element => element.id); return hits.length ? hits : null }`, 10)
  note(`moment highlight on the page: ${JSON.stringify(highlight)}`)
  await shot('08-scene-review', scrollToReview(sceneA.id))
  await shot('09-scene-block', scrollToScene(sceneA.id))
  done2({ state })

  // ——— Revise with direction, and compare ———
  done2 = stage('Revise with creator direction')
  const direction = directionFor(sceneA.title)
  await evaluate(`() => { const box = ${inReview(sceneA.id, '[data-focus^="direction:"]')}; box.value = ${JSON.stringify(direction)}; box.dispatchEvent(new Event('input')); return true }`)
  await sleep(1500)
  await click(sceneA.id, '[data-focus^="revise:"]')
  const revised = await until(async () => {
    const view = (await sceneOf(videoId, sceneA.id))?.view
    if (view?.current && view.current.id !== firstA?.id && view.current.status === 'candidate') return view.current
    return view?.latest?.id !== firstA?.id && view?.latest?.status === 'failed' ? view.latest : null
  }, 30 * 60, 5000)
  check(revised?.status === 'candidate' && revised.revision > (firstA?.revision || 0), `the harness revises the plan from the direction (r${revised?.revision} ${revised?.status}${revised?.error ? ` — ${revised.error.message}` : ''})`)
  const reviseRun = (await runs()).filter(run => run.route === 'Plan Scene').sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0]
  if (reviseRun) evidence.runs.push(await describeRun(reviseRun))
  evidence.plans.a2 = revised && { id: revised.id, revision: revised.revision, direction, reportedModel: revised.reportedModel, question: revised.content?.question, moments: revised.content?.moments?.map(moment => `${moment.title} · camera: ${moment.camera?.treatment}`) }
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const compared = await evaluate(`async () => {
    // The review redraws with the new revision first: wait until it offers r1.
    const offered = () => document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="compare:"] option[value="${firstA?.id || ''}"]')
    for (let i = 0; i < 120 && !offered(); i++) await new Promise(resolve => setTimeout(resolve, 500))
    const details = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="compare:"]')
    if (!details) return null
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    const picker = details.querySelector('select')
    if (picker) { picker.value = ${JSON.stringify(firstA?.id || '')}; picker.dispatchEvent(new Event('change')) }
    await new Promise(resolve => setTimeout(resolve, 800))
    const again = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="compare:"]')
    return [...again.querySelectorAll('.review-diff li')].map(item => item.textContent)
  }`)
  check(Array.isArray(compared) && compared.length > 0, `the revision is compared with r${firstA?.revision} (${(compared || []).length} differences)`)
  evidence.compare = compared
  await shot('10-compare', `() => { const details = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="compare:"]'); if (details) details.scrollIntoView({ block: 'start' }); return true }`)
  done2({ revision: revised?.revision, differences: (compared || []).length })

  // ——— A rough coded preview of the revised plan on the Studio stage ———
  done2 = stage('Preview the plan on the stage')
  const runsBeforePreview = (await runs()).map(run => run.id)
  await waitFor(`() => ${inReview(sceneA.id, '[data-focus^="preview:"]:not([disabled])')} ? true : null`, 60)
  await click(sceneA.id, '[data-focus^="preview:"]')
  const preview = await until(async () => {
    const current = (await sceneOf(videoId, sceneA.id))?.preview
    if (current?.ready?.current) return current
    return current?.latest?.status === 'failed' ? current : null
  }, 40 * 60, 5000)
  check(Boolean(preview?.ready?.current) && preview.ready.of.record === revised?.id, `the harness sketches a preview of the revised plan${preview?.latest?.status === 'failed' ? ` (failed: ${preview.latest.error?.message})` : ''} (${JSON.stringify(preview?.ready?.of || null)})`)
  const sketchRun = (await runs()).find(run => run.route === 'Sketch Scene')
  if (sketchRun) evidence.runs.push(await describeRun(sketchRun))
  const summary = preview?.ready?.summary
  evidence.preview = summary ? { url: preview.ready.url, duration: summary.duration, moments: summary.moments, layers: summary.layers, provisional: summary.provisional } : null
  check(summary && summary.moments.length === (revised?.content?.moments?.length || -1), `the sketch declares every moment of the plan (${summary?.moments?.length} of ${revised?.content?.moments?.length})`)
  check(summary?.provisional?.some(item => /estimated/i.test(item)), `the sketch says what is provisional (${JSON.stringify(summary?.provisional)})`)
  if (sketchRun) {
    const manifest = await readFile(join(sketchRun.projectDir, 'sketch', 'manifest.json'), 'utf8').then(JSON.parse).catch(() => null)
    const castLayers = (manifest?.layers || []).filter(layer => layer.asset?.libraryKey)
    note(`sketch layers: ${(manifest?.layers || []).map(layer => `${layer.kind}:${layer.label}${layer.asset?.libraryKey ? ' [cast]' : ''}${layer.placeholder ? ' [placeholder]' : ''}`).join(' · ')}`)
    check(castLayers.length >= 1, `the sketch reuses the page's own cast artwork (${castLayers.map(layer => layer.label).join(', ')})`)
  }
  await evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`)
  const shown = await waitFor(`() => { const button = ${inReview(sceneA.id, '[data-focus^="show-preview:"]')}; if (!button) return null; button.click(); return true }`, 60)
  check(Boolean(shown), 'the review offers the preview on the stage')
  const player = await waitFor(`() => {
    const element = document.querySelector('#scene-stage-preview hyperframes-player')
    if (!element || document.getElementById('scene-stage-preview').hidden) return null
    return element.duration > 0 ? { src: element.getAttribute('src'), duration: element.duration, mode: document.querySelector('.scene-stage-modes .is-active')?.textContent, note: document.getElementById('scene-stage-note').textContent, moments: [...document.querySelectorAll('.scene-stage-moment')].map(button => button.textContent) } : null
  }`, 60)
  check(player?.mode === 'Plan preview' && Math.abs(player.duration - (summary?.duration || 0)) < 0.5, `the Studio stage plays the sketch through the Hyperframes player (${JSON.stringify(player)})`)
  check(/^Rough sketch of plan r\d+/.test(player?.note || ''), `the stage labels it a rough sketch with its limitations (${player?.note})`)
  const middle = summary?.moments?.[Math.min(1, summary.moments.length - 1)]
  await evaluate(`() => { const buttons = document.querySelectorAll('.scene-stage-moment'); buttons[Math.min(1, buttons.length - 1)].click(); return true }`)
  const seeked = await waitFor(`() => { const element = document.querySelector('#scene-stage-preview hyperframes-player'); return Math.abs(element.currentTime - ${middle?.start ?? 0}) < 0.3 ? element.currentTime : null }`, 20)
  check(seeked !== null, `the stage's timeline seeks the preview to a moment (${seeked}s)`)
  await sleep(2000)
  await shot('11-preview-on-stage')
  const last = summary?.moments?.[summary.moments.length - 1]
  await evaluate(`() => { const heads = document.querySelectorAll('.scene-review[data-review-scene="${sceneA.id}"] .review-moment-head'); heads[heads.length - 1].click(); return true }`)
  const followed = await waitFor(`() => { const element = document.querySelector('#scene-stage-preview hyperframes-player'); return Math.abs(element.currentTime - ${last?.start ?? 0}) < 0.3 ? element.currentTime : null }`, 20)
  check(followed !== null, `selecting a moment in the review seeks the preview (${followed}s)`)
  await evaluate(`() => { const player = document.querySelector('#scene-stage-preview hyperframes-player'); player.seek(${(last?.start ?? 0) + 1.5}); return true }`)
  await sleep(1500)
  await shot('12-preview-late-moment')
  const lanes = await evaluate(`() => [...document.querySelectorAll('.scene-review[data-review-scene="${sceneA.id}"] .review-timeline-row .review-timeline-label')].map(label => label.textContent)`)
  check(lanes.includes('Moments') && lanes.length >= 2, `the review shows the sketch's read-only timeline (${lanes})`)
  await shot('13-preview-timeline', `() => { const row = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] .review-timeline-row'); if (row) row.scrollIntoView({ block: 'center' }); return true }`)
  const previewRuns = (await runs()).filter(run => !runsBeforePreview.includes(run.id))
  check(previewRuns.length === 1 && previewRuns[0].route === 'Sketch Scene', `the only run the preview started is the sketch (${previewRuns.map(run => run.route)})`)
  done2({ duration: summary?.duration, moments: summary?.moments?.length })

  // ——— Approve scene A; nothing starts ———
  done2 = stage('Approve one scene')
  const runsBeforeApproval = (await runs()).length
  await waitFor(`() => ${inReview(sceneA.id, '[data-focus^="approve:"]:not([disabled])')} ? true : null`, 30)
  await click(sceneA.id, '[data-focus^="approve:"]')
  const approved = await until(async () => (await sceneOf(videoId, sceneA.id))?.view?.reviewed, 60)
  check(approved?.id === revised?.id && approved.approval?.fingerprint === revised.fingerprint && Boolean(approved.approval?.briefId), `approval pins the revised plan with what it was made from (${JSON.stringify(approved?.approval)})`)
  await sleep(3000)
  check((await runs()).length === runsBeforeApproval, 'approving starts no run')
  const guide = await evaluate(`() => {
    const details = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="guide:"]')
    if (!details) return null
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    const again = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="guide:"]')
    return { purpose: again.querySelector('.review-guide p')?.textContent || '', lines: [...again.querySelectorAll('.review-guide > div ol li')].map(item => item.textContent), steps: [...again.querySelectorAll('.review-guide > ol li')].map(item => item.textContent), record: Boolean(again.querySelector('[data-focus^="record:"]')) }
  }`)
  check(guide && guide.steps.length >= 2 && guide.record, `the recording guide explains the human contribution, moment by moment (${guide?.steps?.length} steps, ${guide?.lines?.length} lines)`)
  evidence.guide = guide
  await shot('14-recording-guide', `() => { const details = document.querySelector('.scene-review[data-review-scene="${sceneA.id}"] [data-review-open^="guide:"]'); if (details) details.scrollIntoView({ block: 'start' }); return true }`)
  const strip = (await reviewState(sceneA.id))?.strip || []
  check(strip.some(chip => /^Recording: guide ready · no take yet/.test(chip)), `no take is needed to plan or preview (${strip.join(' | ')})`)
  await click(sceneA.id, '[data-focus^="produce:"]')
  const production = await waitFor(`() => ${inReview(sceneA.id, '.review-production')}?.textContent || null`, 10)
  check(/never starts it/.test(production || ''), `Produce scene is a separate action that approval never starts (${(production || '').slice(0, 160)})`)
  await shot('15-approved', scrollToReview(sceneA.id))
  const bNow = (await sceneOf(videoId, sceneB.id))?.view
  check(bNow?.current?.status === 'candidate' && !bNow.reviewed, `${sceneB.title} stays an unapproved candidate`)
  done2({ approval: approved?.approval })

  // ——— Restart: both states intact ———
  done2 = stage('Restart and return')
  await quit()
  await launch()
  check(Boolean(await openNotebook(videoId)), 'the app restarts on the video notebook')
  const afterA = (await sceneOf(videoId, sceneA.id))?.view
  const afterB = (await sceneOf(videoId, sceneB.id))?.view
  check(afterA?.reviewed?.id === revised?.id && afterA.reviewed.approval?.fingerprint === revised?.fingerprint, `${sceneA.title}: still approved at r${afterA?.reviewed?.revision} after the restart`)
  check(afterB?.current?.id === planned?.b?.id && afterB.current.status === 'candidate' && !afterB.reviewed, `${sceneB.title}: still an unapproved candidate after the restart`)
  const afterPreview = (await sceneOf(videoId, sceneA.id))?.preview
  check(afterPreview?.ready?.current === true, 'the preview of the approved plan is still there and current')
  await selectScene(sceneA.id)
  const strips = await waitFor(`() => { const a = [...document.querySelectorAll('.scene-review[data-review-scene="${sceneA.id}"] .review-chip')].map(chip => chip.textContent); const b = [...document.querySelectorAll('.scene-review[data-review-scene="${sceneB.id}"] .review-chip')].map(chip => chip.textContent); return a.some(chip => chip.startsWith('Plan:')) && b.some(chip => chip.startsWith('Plan:')) ? { a, b } : null }`, 60)
  check(strips?.a?.includes(`Plan: Approved r${revised?.revision}`) && strips?.b?.includes(`Plan: Candidate r${planned?.b?.revision}`), `the notebook blocks read as they were left (${JSON.stringify(strips)})`)
  await shot('16-after-restart-approved', scrollToScene(sceneA.id))
  await selectScene(sceneB.id)
  await waitFor(`() => ${inReview(sceneB.id, '.review-question')} ? true : null`, 30)
  await shot('17-after-restart-candidate', scrollToScene(sceneB.id))
  done2({ strips })

  // ——— Nothing downstream ———
  done2 = stage('Nothing downstream started')
  const allRuns = await runs()
  const skills = [...new Set(allRuns.map(run => run.skill))]
  check(allRuns.every(run => ['story-master', 'page-master', 'video-planner'].includes(run.skill)), `only story, page and planning runs ran (${skills})`)
  check(allRuns.filter(run => run.skill === 'video-planner').every(run => ['Prepare Brief', 'Plan Scene', 'Sketch Scene'].includes(run.route)), `planning runs were briefs, plans and the sketch (${[...new Set(allRuns.map(run => run.route))]})`)
  const base = (await api(`/api/projects/${encodeURIComponent(baseId)}`)).body?.project
  const baseScenes = (base?.notebook?.content || []).filter(node => node.type === 'scene')
  check(baseScenes.length > 0 && baseScenes.every(scene => scene.attrs.pageOrigin?.kind === 'designed'), 'the base is as it was designed')
  evidence.allRuns = allRuns.map(run => ({ id: run.id, skill: run.skill, route: run.route, adapter: run.adapter, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt }))
  done2({ runs: allRuns.length })
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  evidence.baseId = baseId
  evidence.videoId = videoId
  evidence.finishedAt = new Date().toISOString()
  evidence.failures = failures
  await saveEvidence()
  await quit()
  appLog.end()
}
console.log(failures ? `LIVE REVIEW LOOP FAIL (${failures})` : 'LIVE REVIEW LOOP PASS')
process.exitCode = failures ? 1 : 0
