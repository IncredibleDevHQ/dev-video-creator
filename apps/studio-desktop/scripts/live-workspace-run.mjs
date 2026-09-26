// Completion evidence for the video scene workspace (§10 of
// docs/plans/video-scene-workspace-ui.md), on the creator's real local
// harness. It spends model budget by design and is not part of the
// deterministic release suite.
//
// Everything goes through the product, in the scene workspace:
//   a fresh technical article with no brand website → a theme saved earlier
//   → pages designed by the harness → the video → its brief → plan r1 → a
//   provider failure and its retry → direction and r2 → a preview built
//   while the workspace is reopened, handed to the stage when ready → a
//   preview offered, not forced, after the reference was chosen → an older
//   revision's preview finishing after the newer one → a moment reviewed on
//   the timeline → approval that starts nothing → one scene the creator
//   presents and one spoken by a generated voice, each produced, played on
//   its clock and accepted → the export, with its sound.
//
// The presented scene's take is synthesized speech over a painted picture,
// committed through the product's take archive exactly as a kept camera take
// is after upload; the camera itself is not exercised. The evidence says so.
//
// Each stage checks what the product already holds first, so a run can be
// resumed with the same LIVE_EVIDENCE_DIR (and LIVE_DATA_DIR on the file
// store) without doing again what the harness already did.
//
//   LIVE_HARNESS / LIVE_MODEL      the harness choice (claude-code / claude-opus-5-5)
//   LIVE_BAD_MODEL                 a well-formed model id the provider refuses
//   LIVE_SOURCE_URL / LIVE_TARGET  the article and its target length
//   LIVE_DATA_DIR                  the app's data directory (file store; kept)
//   LIVE_EVIDENCE_DIR              captures and evidence.json (kept)
//
// The store is the local file store unless STUDIO_PERSISTENCE says otherwise;
// PostgreSQL needs an explicit STUDIO_DATABASE_URL (never the default one).
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createWriteStream, existsSync } from 'node:fs'
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
const badModel = process.env.LIVE_BAD_MODEL || 'claude-opus-0-0'
const sourceUrl = process.env.LIVE_SOURCE_URL || 'https://sqlite.org/wal.html'
const target = process.env.LIVE_TARGET || '1:30'
const THEME = { id: 'live-ledger', name: 'Ledger' }
const dataDir = process.env.LIVE_DATA_DIR || join(await mkdtemp(join(tmpdir(), 'studio-live-workspace-')), 'data')
const evidenceDir = process.env.LIVE_EVIDENCE_DIR || join(dataDir, '..', 'evidence')
await mkdir(evidenceDir, { recursive: true })
const appLog = createWriteStream(join(evidenceDir, 'app.log'), { flags: 'a' })

// A resumed run continues the evidence it left.
const evidencePath = join(evidenceDir, 'evidence.json')
const previous = existsSync(evidencePath) ? JSON.parse(await readFile(evidencePath, 'utf8')) : null
const evidence = previous || { harness, model, sourceUrl, target, persistence, startedAt: new Date().toISOString(), stages: [], checks: [], notes: [], provisional: [] }
evidence.resumedAt = previous ? [...(previous.resumedAt || []), new Date().toISOString()] : []
const saveEvidence = () => writeFile(evidencePath, JSON.stringify(evidence, null, 2)).catch(() => {})
let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  evidence.checks.push({ ok: Boolean(ok), label, at: new Date().toISOString() })
  if (!ok) failures += 1
  void saveEvidence()
  return Boolean(ok)
}
const note = text => {
  console.log(`NOTE  ${text}`)
  evidence.notes.push({ text, at: new Date().toISOString() })
  void saveEvidence()
}
const provisional = text => {
  if (!evidence.provisional.includes(text)) evidence.provisional.push(text)
  void saveEvidence()
}
const done = name => evidence.stages.some(stage => stage.name === name && stage.ok)
const stage = async (name, body) => {
  if (done(name)) {
    console.log(`\n——— ${name} (done before) ———`)
    return
  }
  console.log(`\n——— ${name} ———`)
  const entry = { name, startedAt: new Date().toISOString(), seconds: null, ok: false }
  evidence.stages.push(entry)
  const started = Date.now()
  const before = failures
  try {
    Object.assign(entry, (await body()) || {})
    entry.ok = failures === before
  } finally {
    entry.seconds = Math.round((Date.now() - started) / 1000)
    await saveEvidence()
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
  if (!(await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 10_000))]))) {
    note('the app was still running 10s after SIGTERM; it was killed')
    child.kill('SIGKILL')
  }
  child = null
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const api = async (path, init) => {
  const response = await fetch(origin + path, init)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
const put = (path, body) => api(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
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
const shot = async name => {
  await sleep(1200)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await writeFile(join(evidenceDir, `${name}.png`), Buffer.from(await response.arrayBuffer()))
  console.log(`SHOT  ${name}.png`)
}
const focusApp = () => evaluate(`() => { window.dispatchEvent(new Event('focus')); return true }`).catch(() => {})
const ffprobe = args => spawnSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' }).stdout.trim()
const loudness = (path, start, length) => {
  const run = spawnSync('ffmpeg', ['-v', 'info', '-ss', String(start), '-t', String(length), '-i', path, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' })
  const max = /max_volume: (-?[\d.]+|-inf) dB/.exec(run.stderr)
  return max ? (max[1] === '-inf' ? -Infinity : Number(max[1])) : null
}
const runs = async () => (await api('/api/runs')).body?.runs || []
const overview = id => api(`/api/planning/${encodeURIComponent(id)}`).then(response => response.body)
const sceneOf = async (videoId, sceneId) => (await overview(videoId))?.scenes?.find(scene => scene.id === sceneId)
const project = async id => (await api(`/api/projects/${encodeURIComponent(id)}`)).body?.project
// One harness and model for every stage: a stage's own choice, left by an
// earlier session, is cleared so the default applies to it.
const STAGES = ['story', 'drawing', 'planning', 'composition']
const setModel = value => put('/api/settings/harness', { default: { harness, model: value }, stages: Object.fromEntries(STAGES.map(name => [name, null])) })

// ——— The workspace ———
const W = '#scene-workspace'
const openVideo = async id => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'scenes'); localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(3000)
  return waitFor(`() => !document.getElementById('scene-workspace').hidden && document.querySelector('${W} .sw-scene') ? true : null`, 120)
}
const openNotebook = async id => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(3000)
  return waitFor(`() => localStorage.getItem('incredible-studio-v2-active-project') === ${JSON.stringify(id)} && document.querySelector('#editor .ProseMirror') ? true : null`, 120)
}
const pickScene = async id => {
  await evaluate(`() => { const button = document.querySelector('${W} .sw-scene[data-scene="${id}"]'); if (!button) return false; button.click(); return true }`)
  return waitFor(`() => document.querySelector('${W} .sw-scene.is-selected')?.dataset.scene === ${JSON.stringify(id)} ? true : null`, 30)
}
const tab = name => evaluate(`() => { const button = document.querySelector('${W} [data-focus="sw-tab:${name}"]'); if (!button) return false; button.click(); return true }`)
const primary = () => evaluate(`() => { const button = document.querySelector('${W} .sw-actions .button.primary'); return button ? { text: button.textContent, disabled: button.disabled } : null }`)
// Clicks the header action with this label once it is there and enabled.
const act = (label, seconds = 60) => waitFor(`() => { const button = [...document.querySelectorAll('${W} .sw-actions .button')].find(entry => entry.textContent === ${JSON.stringify(label)}); if (!button || button.disabled) return null; button.click(); return true }`, seconds)
// The timeline, expanded once: the choice is kept per video.
const expandTimeline = async () => {
  if (await evaluate(`() => Boolean(document.querySelector('${W} .sw-timeline'))`).catch(() => false)) return true
  return waitFor(`() => { const toggle = document.querySelector('${W} [data-focus="sw-timeline"]'); if (!toggle) return null; if (toggle.getAttribute('aria-pressed') !== 'true') toggle.click(); return true }`, 20)
}
const clickIn = (selector, seconds = 30) => waitFor(`() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element || element.disabled) return null; element.click(); return true }`, seconds)
const stageNow = `() => {
  const pressed = document.querySelector('#scene-stage-bar [data-stage-mode][aria-pressed="true"]')?.dataset.stageMode || ''
  const players = [...document.querySelectorAll('#scene-stage-preview hyperframes-player')]
  const shown = players.find(player => !player.classList.contains('is-loading'))
  const preview = document.getElementById('scene-stage-preview')
  return {
    scene: document.querySelector('${W} .sw-scene.is-selected')?.dataset.scene || '',
    mode: pressed,
    player: preview.hidden || preview.classList.contains('is-only-loading') ? '' : shown?.getAttribute('src') || '',
    offer: document.querySelector('${W} .ws-offer')?.dataset.offer || '',
    revision: document.querySelector('${W} .ws-revision')?.selectedOptions?.[0]?.textContent || '',
    activity: document.querySelector('${W} .sw-stage-activity')?.textContent || '',
    announced: document.querySelector('${W} .sr-only[role="status"]')?.textContent || '',
  }
}`
const progressNow = `() => {
  const box = document.querySelector('${W} .sw-panel .ws-progress') || document.querySelector('${W} .sw-stage-activity .ws-progress')
  if (!box) return null
  const draft = document.querySelector('${W} .sw-panel .ws-draft')
  return {
    phases: [...box.querySelectorAll('.ws-phases li')].map(li => li.dataset.phase + ':' + li.dataset.state).join(' '),
    now: box.querySelector('.ws-progress-now')?.textContent || '',
    who: box.querySelector('.ws-progress-who')?.textContent || '',
    draft: draft ? { label: draft.querySelector('.ws-draft-label')?.textContent || '', question: draft.querySelector('.ws-draft-question')?.textContent || '', moments: [...draft.querySelectorAll('.ws-draft-moments li')].map(li => li.textContent) } : null,
  }
}`
const timelineNow = `() => {
  const box = document.querySelector('${W} .sw-timeline')
  if (!box) return null
  return {
    tracks: [...box.querySelectorAll('.sw-timeline-tracks > .sw-track .sw-track-label')].map(label => label.textContent),
    layers: [...box.querySelectorAll('.sw-track-group .sw-track-label')].map(label => label.textContent),
    note: box.querySelector('.sw-timeline-note')?.textContent || '',
    ruler: [...box.querySelectorAll('.sw-timeline-ruler span')].map(span => span.textContent).join('–'),
  }
}`
// Watches a run's phases while it works, keeping each new state it shows.
const watchProgress = async (label, finished, seconds) => {
  const seen = []
  const deadline = Date.now() + seconds * 1000
  let result = null
  let shotTaken = false
  while (Date.now() < deadline) {
    const now = await evaluate(progressNow).catch(() => null)
    if (now) {
      const key = `${now.phases} | ${now.now} | ${now.draft ? now.draft.question + ' · ' + now.draft.moments.length : ''}`
      if (!seen.some(entry => entry.key === key)) {
        seen.push({ key, at: new Date().toISOString(), ...now })
        console.log(`      ${label}: ${key.slice(0, 180)}`)
      }
      if (!shotTaken && /moments:active|explanation:done|building:active|drafting:active/.test(now.phases)) {
        shotTaken = true
        await shot(`${label}-in-progress`)
      }
    }
    result = await finished().catch(() => null)
    if (result) break
    await sleep(4000)
  }
  return { result, seen }
}
const directionFor = title =>
  /checkpoint/i.test(title) ? 'Let the WAL file fill with committed pages first; then run the checkpoint and show each page moving back into the database file — push in on the moment the WAL can be reset.'
  : /reader|writer|concurren|snapshot/i.test(title) ? 'Show a reader holding its end mark while a writer keeps appending past it; the reader must not see the new pages — hold on that boundary before the narration names it.'
  : /recover|crash|rollback|journal/i.test(title) ? 'Start from the crash: show what the database holds, then the WAL replayed up to the last commit — hold on the last committed frame.'
  : 'Slow the key moment down: push in on the mechanism at the instant it acts, and hold there long enough to read it.'
const MECHANISM = [/checkpoint/i, /reader|writer|concurren|snapshot/i, /commit|append|write.?ahead/i, /recover|crash|rollback|journal/i, /wal.?index|shared memory/i]
const pick = list => MECHANISM.map(pattern => list.find(scene => pattern.test(scene.title))).find(Boolean) || list[0]

// A take of lines: synthesized speech over a painted picture with a white
// box that moves, so its frames differ.
// Each item is a line to say, or a pause (seconds) where a moment has no
// words — as the recording guide asks of a presenter.
const makeTake = async (parts, name) => {
  const voice = join(evidenceDir, `${name}.aiff`)
  const text = parts.map(part => (typeof part === 'number' ? `[[slnc ${Math.round(part * 1000)}]]` : part)).join(' [[slnc 700]] ')
  const said = spawnSync('/usr/bin/say', ['-o', voice, text])
  if (said.status !== 0) throw new Error('say failed')
  const take = join(evidenceDir, `${name}.webm`)
  const made = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x334155:size=1280x720:rate=30', '-i', voice, '-filter_complex', "[0:v]drawbox=x='mod(t*300,1180)':y=40:w=100:h=100:color=white:t=fill[v]", '-map', '[v]', '-map', '1:a', '-shortest', '-c:v', 'libvpx', '-deadline', 'realtime', '-b:v', '1500k', '-c:a', 'libopus', take])
  if (made.status !== 0) throw new Error('ffmpeg take failed: ' + String(made.stderr).slice(0, 200))
  return { path: take, seconds: Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', take])) }
}

let baseId = evidence.baseId || ''
let videoId = evidence.videoId || ''
let A = evidence.scenes?.a || null
let B = evidence.scenes?.b || null
try {
  await stage('Launch and choose the harness', async () => {
    await launch()
    const saved = await setModel(model)
    const preferences = saved.body?.preferences
    check(preferences?.default?.harness === harness && preferences.default.model === model && STAGES.every(name => !preferences.stages?.[name]), `every stage runs on ${harness} · ${model}, with no stage of its own (${JSON.stringify(preferences?.stages || {})})`)
    await evaluate(`() => { location.assign('/studio'); return true }`).catch(() => {})
    await sleep(2500)
    const adapters = await evaluate(`() => window.studioDesktop.harness.adapters()`)
    const adapter = adapters.find(entry => entry.id === harness)
    check(adapter?.ok, `the harness is available (${adapter?.id} ${adapter?.version || ''})`)
    evidence.harnessVersion = adapter?.version || null
  })
  // A resumed run starts the app again; the stage above is marked done.
  if (!child) {
    await launch()
    await setModel(model)
  }

  // ——— An article with no brand website, bound to a theme saved earlier ———
  await stage('A theme saved earlier', async () => {
    const { body } = await api('/api/themes')
    if (!(body?.themes || []).some(theme => theme.id === THEME.id)) {
      const brand = { background: '#f6f3ea', surface: '#fffdf7', text: '#1c1917', mutedText: '#57534e', primary: '#0f766e', secondary: '#b45309', accent: '#be123c', codeBackground: '#e7e5e4' }
      const saved = await post('/api/themes', { theme: { version: 1, id: THEME.id, name: THEME.name, description: 'A paper-and-ink theme saved for technical explainers', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'JetBrains Mono' } } })
      check(saved.status === 200, `the library holds a saved theme, "${THEME.name}"`)
    } else note(`the library already holds "${THEME.name}"`)
    // Saved in an earlier session: the studio reads its library as it opens.
    await evaluate(`() => { location.assign('/studio'); return true }`).catch(() => {})
    await sleep(2500)
    await waitFor(`() => document.querySelector('#editor .ProseMirror') ? true : null`, 90)
  })
  await stage('Read the article and bind the saved theme', async () => {
    if (baseId || videoId) return
    await evaluate(`() => { window.__source.open('link'); return true }`)
    await evaluate(`() => { document.getElementById('source-url').value = ${JSON.stringify(sourceUrl)}; document.getElementById('source-brand-url').value = ''; document.getElementById('source-read').click(); return true }`)
    const read = await waitFor(`() => {
      if (!document.getElementById('source-step-brand').hidden) return { title: document.getElementById('source-read-title').textContent, meta: document.getElementById('source-read-meta').textContent }
      const status = document.getElementById('source-status')
      return status && status.classList.contains('is-error') ? { error: status.textContent } : null
    }`, 300)
    check(read && !read.error, `the article is read (${JSON.stringify(read)})`)
    // A link's own site is offered as its brand first (U1); the creator
    // chooses a theme saved earlier instead.
    const panel = await waitFor(`() => document.querySelector('#source-step-brand [data-brand-panel][aria-selected="true"]')?.dataset.brandPanel || null`, 20)
    note(`with no brand website given, the brand step opened on "${panel}"`)
    if (panel !== 'saved') await clickIn('#source-brand-tab-saved', 10)
    const listed = await waitFor(`() => { const panel = document.getElementById('source-brand-panel-saved'); return panel && !panel.hidden && document.querySelector('#source-saved-themes .source-saved-theme') ? true : null }`, 20)
    check(listed === true, 'the saved themes are one choice away, and list the theme saved earlier')
    await evaluate(`() => { const card = [...document.querySelectorAll('#source-saved-themes .source-saved-theme')].find(button => button.querySelector('b')?.textContent === ${JSON.stringify(THEME.name)}); card?.click(); return Boolean(card) }`)
    const bound = await waitFor(`() => { const text = document.getElementById('source-brand-bound').textContent; return /${THEME.name}/.test(text) ? { bound: text, outline: document.getElementById('source-to-outline').textContent } : null }`, 20)
    check(Boolean(bound) && /saved theme/.test(bound.bound), `the saved theme is bound and named (${JSON.stringify(bound)})`)
    await shot('01-brand-saved-theme')
    // LIVE_DRY=brand stops here, before any harness run, to try the import.
    if (process.env.LIVE_DRY === 'brand') throw new Error('dry run: stopped after the brand step')
    await evaluate(`() => { document.getElementById('source-target').value = ${JSON.stringify(target)}; document.getElementById('source-to-outline').click(); return true }`)
    const outline = await waitFor(`() => {
      if (!document.getElementById('source-step-outline').hidden && document.querySelectorAll('#source-scenes li').length) return { titles: [...document.querySelectorAll('#source-scenes li')].map(item => item.querySelector('input')?.value || '') }
      const status = document.getElementById('source-brand-status')?.textContent || ''
      return /ended|failed|wrote no outline|still going/i.test(status) ? { error: status } : null
    }`, 25 * 60)
    check(outline && !outline.error, `the harness plans the story (${JSON.stringify(outline)})`)
    await shot('02-outline')
    return { scenes: outline?.titles || [] }
  })
  await stage('Design every page with the harness', async () => {
    if (baseId || videoId) return
    await waitFor(`() => { const design = document.getElementById('source-design-pages'); return design && !design.hidden ? true : null }`, 60)
    await evaluate(`() => { document.getElementById('source-design-pages').click(); return true }`)
    let status = null
    const deadline = Date.now() + 90 * 60 * 1000
    while (Date.now() < deadline) {
      status = await evaluate(`() => window.__source.drawStatus()`).catch(() => status)
      if (['ready', 'failed', 'incomplete'].includes(status?.phase)) break
      await sleep(5000)
    }
    check(status?.phase === 'ready' && status.drawn === status.total, `the harness designs every page (${status?.phase} ${status?.drawn}/${status?.total}${status?.failure ? ` — ${status.failure}` : ''})`)
    await shot('03-designed-pages')
    await evaluate(`() => { document.getElementById('source-finish').click(); return true }`)
    const base = await waitFor(`async () => {
      if (document.getElementById('source-dialog')?.open) return null
      const id = localStorage.getItem('incredible-studio-v2-active-project')
      const body = await fetch('/api/projects/' + encodeURIComponent(id)).then(response => response.json()).catch(() => null)
      const scenes = (body?.project?.notebook?.content || []).filter(node => node.type === 'scene')
      return scenes.length ? { id, title: body.project.title, theme: body.project.theme?.name || '', scenes: scenes.map(scene => ({ id: scene.attrs.id, title: scene.attrs.title, origin: scene.attrs.pageOrigin?.kind })) } : null
    }`, 180)
    check(Boolean(base) && base.scenes.every(scene => scene.origin === 'designed'), `the base opens on designed pages, themed "${base?.theme}" (${JSON.stringify(base?.scenes?.map(scene => scene.origin))})`)
    baseId = base?.id || ''
    evidence.baseId = baseId
    evidence.base = base
  })

  // ——— The video, in the scene workspace ———
  await stage('Make the video', async () => {
    if (videoId) return
    if (!(await openNotebook(baseId))) throw new Error('the base did not open')
    await focusApp()
    const step = await waitFor(`() => { const button = document.getElementById('next-step'); return !button.hidden && /Create video|Plan video/.test(button.textContent) ? button.textContent : null }`, 60)
    check(Boolean(step), `the base's next step makes its video (${step})`)
    await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'scenes'); document.getElementById('next-step').click(); return true }`)
    const offer = await waitFor(`() => { const button = document.querySelector('.planning-create-fork'); return button && !button.disabled ? button.textContent : null }`, 60)
    note(`fork offer: ${offer}`)
    await evaluate(`() => { document.querySelector('.planning-create-fork').click(); return true }`)
    const video = await until(async () => {
      const id = await evaluate(`() => localStorage.getItem('incredible-studio-v2-active-project')`)
      if (!id || id === baseId) return null
      const doc = await project(id)
      return doc?.derivedFrom?.notebook === baseId ? doc : null
    }, 180)
    check(Boolean(video), `a video notebook is made from the base (${video?.title})`)
    videoId = video?.id || ''
    evidence.videoId = videoId
  })
  if (!(await openVideo(videoId))) throw new Error('the video did not open on its scenes')
  await focusApp()

  await stage('Choose who speaks, per scene', async () => {
    const scenes = (await overview(videoId)).scenes
    A = pick(scenes)
    B = pick(scenes.filter(scene => scene.id !== A.id))
    evidence.scenes = { a: { id: A.id, title: A.title, delivery: 'human' }, b: { id: B.id, title: B.title, delivery: 'generated' } }
    for (const [scene, label, value] of [[A, 'You present it', 'human'], [B, 'Generated voice', 'generated']]) {
      await pickScene(scene.id)
      await tab('record')
      await waitFor(`() => document.querySelector('${W} .sw-panel .ws-delivery') ? true : null`, 30)
      await evaluate(`() => { const button = [...document.querySelectorAll('${W} .sw-panel .ws-delivery button')].find(entry => entry.textContent === ${JSON.stringify(label)}); button?.click(); return Boolean(button) }`)
      check(Boolean(await until(async () => (await sceneOf(videoId, scene.id))?.delivery === value, 30)), `${scene.title}: ${label.toLowerCase()}`)
    }
    await shot('04-workspace-who-speaks')
  })

  await stage('Prepare the brief', async () => {
    if ((await overview(videoId))?.brief?.current) return
    const label = await waitFor(`() => { const button = document.querySelector('${W} .sw-actions .button.primary'); return button && /^(Prepare|Retry) the brief$/.test(button.textContent) && !button.disabled ? button.textContent : null }`, 60)
    await act(label || 'Prepare the brief', 30)
    const { result, seen } = await watchProgress('05-brief', async () => {
      const current = await overview(videoId)
      return current?.brief?.current || (current?.brief?.latest?.status === 'failed' ? current.brief.latest : null)
    }, 30 * 60)
    evidence.briefProgress = seen
    check(result?.status === 'ready', `the harness prepares the brief (${result?.status}${result?.error ? ` — ${result.error.message}` : ''})`)
  })

  // ——— Plan r1: its phases as the product confirmed them ———
  await stage('Plan r1', async () => {
    if ((await sceneOf(videoId, A.id))?.view?.current) return
    await pickScene(A.id)
    await tab('story')
    await act('Plan the scene', 60)
    const { result, seen } = await watchProgress('06-plan-r1', async () => {
      const view = (await sceneOf(videoId, A.id))?.view
      return view?.current || (view?.latest?.status === 'failed' ? view.latest : null)
    }, 45 * 60)
    evidence.planProgress = seen
    const record = (await overview(videoId)).records.find(entry => entry.id === result?.id)
    evidence.planMilestones = record?.progress?.events?.map(event => `${event.milestone}${event.section ? `:${event.section}` : ''}${event.count !== undefined ? `(${event.count})` : ''}`) || []
    check(result?.status === 'candidate', `the harness plans ${A.title} (r${result?.revision} ${result?.status}${result?.error ? ` — ${result.error.message}` : ''})`)
    note(`r1's milestones: ${evidence.planMilestones.join(' → ')}`)
    if (!evidence.planMilestones.some(entry => entry.startsWith('draft'))) provisional('The harness published no draft sections while planning; its phases moved only on the milestones it confirmed (read its packet, handed in, checked).')
    await shot('07-plan-r1')
  })

  // ——— A provider failure, and the retry ———
  await stage('A provider failure, then the retry', async () => {
    const view = (await sceneOf(videoId, B.id))?.view
    if (view?.current) return
    await setModel(badModel)
    await pickScene(B.id)
    await tab('story')
    await act('Plan the scene', 60)
    const failed = await until(async () => {
      const latest = (await sceneOf(videoId, B.id))?.view?.latest
      return latest?.status === 'failed' ? latest : null
    }, 15 * 60)
    await focusApp()
    const shown = await waitFor(`() => { const box = document.querySelector('${W} .sw-panel .ws-failure'); return box ? { kind: box.dataset.failure, text: box.textContent, buttons: [...box.querySelectorAll('button')].map(button => button.textContent) } : null }`, 60)
    evidence.providerFailure = { error: failed?.error || null, shown }
    check(Boolean(failed) && Boolean(shown) && shown.buttons.includes('Plan the scene again') && shown.buttons.includes('Change the harness or model'), `a model the provider refuses fails with its own words and the ways on (${failed?.error?.category || 'no category'}: ${String(failed?.error?.providerStatus || failed?.error?.message || '').slice(0, 160)})`)
    await shot('08-provider-failure')
    await setModel(model)
    await clickIn(`${W} .sw-panel .ws-failure [data-focus^="retry-plan:"]`, 30)
    const retried = await until(async () => {
      const latest = (await sceneOf(videoId, B.id))?.view
      return latest?.current || (latest?.latest?.status === 'failed' && latest.latest.id !== failed?.id ? latest.latest : null)
    }, 45 * 60, 5000)
    check(retried?.status === 'candidate', `retried with ${model}, ${B.title} is planned (r${retried?.revision} ${retried?.status})`)
  })

  // ——— Direction, and r2 ———
  await stage('Direction, and r2', async () => {
    const view = (await sceneOf(videoId, A.id))?.view
    if (view?.current && view.current.revision >= 2) return
    const r1 = view?.current
    await pickScene(A.id)
    await tab('story')
    await waitFor(`() => document.querySelector('${W} [data-focus^="direction:"]') ? true : null`, 30)
    await evaluate(`() => { const box = document.querySelector('${W} [data-focus^="direction:"]'); box.value = ${JSON.stringify(directionFor(A.title))}; box.dispatchEvent(new Event('input', { bubbles: true })); return true }`)
    await clickIn(`${W} [data-focus^="revise:"]`, 30)
    const { result, seen } = await watchProgress('09-plan-r2', async () => {
      const next = (await sceneOf(videoId, A.id))?.view
      if (next?.current && next.current.id !== r1?.id) return next.current
      return next?.latest?.id !== r1?.id && next?.latest?.status === 'failed' ? next.latest : null
    }, 45 * 60)
    evidence.revisionProgress = seen
    check(result?.status === 'candidate' && result.revision === 2, `the harness plans r2 from the direction (r${result?.revision} ${result?.status})`)
  })

  // ——— The preview: built while the workspace is reopened, then handed over ———
  await stage('Preview r2, reopened midway, handed to the stage', async () => {
    const scene = await sceneOf(videoId, A.id)
    const r2 = scene?.view?.current
    if (scene?.preview?.byTreatment?.[r2?.id]) {
      note('r2\'s preview was built in an earlier session; the reopen is proved again on another scene below')
      return
    }
    await pickScene(A.id)
    await act('Preview r2', 60)
    const building = await waitFor(`() => { const box = document.querySelector('${W} .sw-stage-activity .ws-progress'); return box ? box.textContent : null }`, 120)
    check(Boolean(building), 'the preview shows its phases under the stage while it builds')
    await shot('10-preview-building')
    // Reopen the workspace midway.
    await sleep(20_000)
    await evaluate(`() => { location.reload(); return true }`).catch(() => {})
    await sleep(4000)
    await waitFor(`() => document.querySelector('${W} .sw-scene.is-selected')?.dataset.scene === ${JSON.stringify(A.id)} ? true : null`, 90)
    note('the workspace was reopened while the preview was being built')
    const ready = await until(async () => {
      const preview = (await sceneOf(videoId, A.id))?.preview
      return preview?.byTreatment?.[r2.id] || (preview?.latest?.status === 'failed' && preview.latest.treatmentId === r2.id ? preview.latest : null)
    }, 45 * 60, 5000)
    check(Boolean(ready?.url), `the harness builds the preview of r2${ready?.error ? ` (failed: ${ready.error.message})` : ''}`)
    await focusApp()
    const handed = await waitFor(`() => { const now = (${stageNow})(); return now.mode === 'preview' && now.player ? now : null }`, 90)
    check(Boolean(handed) && handed.player.startsWith(ready?.url || '—'), `waited for, it takes the stage by itself after the reopen (${JSON.stringify(handed && { mode: handed.mode, announced: handed.announced })})`)
    await shot('11-preview-handed-over')
  })

  await stage('A chosen reference is kept; the preview is offered', async () => {
    const scene = await sceneOf(videoId, B.id)
    const r1 = scene?.view?.current
    if (scene?.preview?.byTreatment?.[r1?.id]) return
    await pickScene(B.id)
    await act(`Preview r${r1.revision}`, 60)
    await sleep(3000)
    // The creator chooses the page while it builds.
    await clickIn('#scene-stage-bar [data-stage-mode="reference"]', 20)
    const ready = await until(async () => (await sceneOf(videoId, B.id))?.preview?.byTreatment?.[r1.id] || null, 45 * 60, 5000)
    await focusApp()
    const kept = await waitFor(`() => { const now = (${stageNow})(); return now.offer ? now : null }`, 90)
    check(Boolean(ready) && kept?.mode === 'reference' && kept.offer === 'offer', `with the page chosen, the ready preview is offered, not forced (${JSON.stringify(kept && { mode: kept.mode, offer: kept.offer })})`)
    await shot('12-preview-offered')
    await clickIn(`${W} [data-focus="sw-play-offer"]`, 20)
  })

  await stage('An older revision finishing after the newer one', async () => {
    const scene = await sceneOf(videoId, A.id)
    const r1 = (await overview(videoId)).records.find(record => record.kind === 'treatment' && record.subject === A.id && record.revision === 1)
    if (!r1 || scene?.preview?.byTreatment?.[r1.id]) return
    await pickScene(A.id)
    await waitFor(`() => { const now = (${stageNow})(); return now.mode === 'preview' && now.player ? true : null }`, 60)
    const before = await evaluate(stageNow)
    // r1's preview is asked for through the product's own route, and lands
    // after r2's.
    const asked = await post(`/api/planning/${encodeURIComponent(videoId)}/scenes/${encodeURIComponent(A.id)}/preview`, { recordId: r1.id })
    const queued = asked.body?.record
    // Started as the product starts one: the local harness, on the preview route.
    if (queued?.status === 'queued') await evaluate(`() => { void window.studioDesktop.harness.run({ adapter: ${JSON.stringify(harness)}, skill: 'video-planner', route: 'Sketch Scene', projectId: ${JSON.stringify(videoId)}, inputs: { planning: { recordId: ${JSON.stringify(queued.id)} }, model: ${JSON.stringify(model)}, effort: 'high', autonomous: true } }); return true }`)
    note(`r1's preview asked for (${asked.status}, ${queued?.status})`)
    const late = await until(async () => (await sceneOf(videoId, A.id))?.preview?.byTreatment?.[r1.id] || null, 45 * 60, 5000)
    await focusApp()
    await sleep(3000)
    const after = await evaluate(stageNow)
    check(Boolean(late) && after.player === before.player && /^Plan r2/.test(after.revision), `r1's preview finishing later is kept as history; the stage keeps r2's (${JSON.stringify({ stillR2: after.player === before.player, revision: after.revision })})`)
  })

  // The first session found the reopen coming back to the first scene, so
  // the waiting preview was only offered; after the fix it is proved again
  // on a third scene that is not the first.
  await stage('Reopen midway on another scene, and the preview is handed over', async () => {
    const scenes = (await overview(videoId)).scenes
    const C = evidence.scenes.c || (() => { const pickC = scenes.filter(scene => scene.id !== A.id && scene.id !== B.id && scene.index > 0); const chosen = pick(pickC); return { id: chosen.id, title: chosen.title } })()
    evidence.scenes.c = C
    await pickScene(C.id)
    await tab('story')
    let view = (await sceneOf(videoId, C.id))?.view
    if (!view?.current) {
      await act('Plan the scene', 60)
      view = (await until(async () => {
        const next = (await sceneOf(videoId, C.id))?.view
        return next?.current || (next?.latest?.status === 'failed' ? next.latest : null)
      }, 45 * 60, 5000)) ? (await sceneOf(videoId, C.id))?.view : null
      check(view?.current?.status === 'candidate', `the harness plans ${C.title} (r${view?.current?.revision})`)
    }
    const plan = view?.current
    if (!plan) return
    await focusApp()
    await act(`Preview r${plan.revision}`, 60)
    await waitFor(`() => document.querySelector('${W} .sw-stage-activity .ws-progress') ? true : null`, 120)
    await sleep(20_000)
    await evaluate(`() => { location.reload(); return true }`).catch(() => {})
    await sleep(4000)
    const cameBack = await waitFor(`() => document.querySelector('${W} .sw-scene.is-selected')?.dataset.scene === ${JSON.stringify(C.id)} ? true : null`, 90)
    check(cameBack === true, `reopened while its preview is built, the workspace comes back to ${C.title}, not the first scene`)
    const ready = await until(async () => (await sceneOf(videoId, C.id))?.preview?.byTreatment?.[plan.id] || null, 45 * 60, 5000)
    const handed = await waitFor(`() => { const now = (${stageNow})(); return now.mode === 'preview' && now.player ? now : null }`, 120)
    check(Boolean(ready) && Boolean(handed) && handed.player.startsWith(ready.url), `waited for, the preview takes the stage by itself after the reopen (${JSON.stringify(handed && { mode: handed.mode, announced: handed.announced })})`)
    await shot('11b-preview-handed-over-after-reopen')
  })

  // ——— A moment reviewed on the timeline; approval starts nothing ———
  await stage('Review a moment on the timeline', async () => {
    await pickScene(A.id)
    await waitFor(`() => document.querySelector('${W} .sw-moment, ${W} .sw-cell-moment') ? true : null`, 30)
    await evaluate(`() => { const chips = document.querySelectorAll('${W} .sw-moment, ${W} .sw-cell-moment'); chips[Math.min(1, chips.length - 1)].click(); return true }`)
    const moment = await waitFor(`() => { const panel = document.querySelector('${W} .sw-panel .ws-moment'); return panel?.querySelector('.ws-moment-title') ? { title: panel.querySelector('.ws-moment-title').textContent, fields: [...panel.querySelectorAll('.ws-moment-fields dt')].map(dt => dt.textContent) } : null }`, 30)
    check(Boolean(moment) && moment.fields.includes('On screen') && moment.fields.includes('Spoken line'), `a moment opens with what is on screen and what is said (${JSON.stringify(moment)})`)
    await shot('13-moment')
    await expandTimeline()
    const timeline = await waitFor(timelineNow, 20)
    check(Boolean(timeline) && /sketch/.test(timeline.note), `the timeline reads the scene on the sketch's clock (${JSON.stringify(timeline)})`)
    evidence.timelineOnSketch = timeline
    await shot('14-timeline-on-the-sketch')
  })

  await stage('Approve, starting nothing', async () => {
    for (const scene of [A, B]) {
      const view = (await sceneOf(videoId, scene.id))?.view
      if (view?.reviewed && view.reviewed.id === view.current?.id) continue
      await pickScene(scene.id)
      const runsBefore = (await runs()).length
      const label = (await primary())?.text || ''
      if (/^Approve r\d+$/.test(label)) await act(label, 30)
      else await act(`Approve r${view.current.revision} without a preview`, 30)
      const approved = await until(async () => (await sceneOf(videoId, scene.id))?.view?.reviewed, 60)
      await sleep(8000)
      check(Boolean(approved) && (await runs()).length === runsBefore, `${scene.title}: approving r${approved?.revision} starts nothing`)
    }
    await shot('15-approved')
  })

  // ——— The scene the creator presents: a take, the clock, the production ———
  // Recording in the workspace: the plan's lines made the script, the
  // capture opened beside the stage, a take read from its teleprompter and
  // kept through the product's archive.
  const recordTake = async (scene, name) => {
    await pickScene(scene.id)
    await tab('record')
    if (await clickIn(`${W} [data-focus^="use-plan-script:"]`, 5)) await sleep(500)
    const label = await waitFor(`() => { const button = [...document.querySelectorAll('${W} .sw-actions .button')].find(entry => /^Record (the scene|the scene again|it again)$/.test(entry.textContent) && !entry.disabled); return button ? button.textContent : null }`, 60)
    await act(label || 'Record the scene', 30)
    const capture = await waitFor(`() => { const dialog = document.getElementById('camera-dialog'); return dialog.open ? { inWorkspace: Boolean(dialog.closest('${W} .sw-capture')), modal: dialog.matches(':modal'), teleprompter: document.getElementById('presenter-script').value } : null }`, 30)
    check(capture?.inWorkspace === true && capture.modal === false && capture.teleprompter.length > 0, 'recording opens beside the stage, with the teleprompter')
    await shot(`16-recording-beside-the-stage-${name}`)
    const lines = capture?.teleprompter.split(/\n+/).map(line => line.trim()).filter(Boolean) || []
    // The lines in the plan's order, with a pause for each moment the plan
    // gives no words (the guide says to hold there).
    const plan = (await sceneOf(videoId, scene.id))?.view?.reviewed?.content
    const pending = [...lines]
    const parts = plan?.moments?.length
      ? plan.moments.flatMap(moment => (moment.narration?.guide ? (pending.length ? [pending.shift()] : []) : [Math.max(1.5, moment.estimateSeconds || 2.5)])).concat(pending)
      : lines
    const take = await makeTake(parts, name)
    evidence[name] = { parts, seconds: take.seconds, synthesized: true }
    provisional('The presented scene\'s take is synthesized speech over a painted picture, committed through the product\'s take archive as a kept camera take is after upload; the camera and microphone capture were not exercised.')
    const asset = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': 'video/webm', 'x-asset-name': `camera-${scene.id}.webm`, 'x-project-id': videoId, 'x-block-id': scene.id }, body: await readFile(take.path) }).then(response => response.json())
    const committed = await evaluate(`() => window.__timing.archive(${JSON.stringify(scene.id)}, ${JSON.stringify({ url: asset.url, assetId: asset.assetId })}, ${Math.round(take.seconds * 1000)})`)
    check(Boolean(committed?.recordingId), `the take is kept as the scene's (${take.seconds.toFixed(1)}s: ${lines.length} line${lines.length === 1 ? '' : 's'})`)
    await clickIn('#close-camera', 10)
    const listed = await waitFor(`() => { const row = document.querySelector('${W} .sw-panel .ws-take.is-selected'); return row ? row.textContent : null }`, 30)
    check(Boolean(listed), `the Record tab lists it as the take used (${listed})`)
    await shot(`17-take-used-${name}`)
  }
  await stage('Record the presented scene', async () => {
    const takes = (await project(videoId))?.recordedBlockTakes?.[A.id] || []
    if (takes.some(take => !take.pickup)) return
    await recordTake(A, 'take')
  })

  const produce = async (scene, clock) => {
    const production = (await sceneOf(videoId, scene.id))?.production
    if (production?.accepted?.current) return
    await pickScene(scene.id)
    if (!production?.ready?.current) {
      await act('Produce the scene', 120)
      // A take that cannot set the clock is refused, naming the line it lacks;
      // the creator records again from the teleprompter, then produces.
      const started = await until(async () => {
        if ((await sceneOf(videoId, scene.id))?.production?.latest) return { started: true }
        const toast = await evaluate(`() => document.getElementById('toast')?.textContent || ''`).catch(() => '')
        return /cannot set this scene's clock/.test(toast) ? { refused: toast } : null
      }, 120, 2000)
      if (started?.refused && scene.delivery === 'human') {
        evidence.takeRefusals = [...(evidence.takeRefusals || []), started.refused]
        check(true, `a take that cannot set the approved plan's clock is refused, saying why (${started.refused.slice(0, 200)})`)
        await recordTake(scene, `take-${evidence.takeRefusals.length + 1}`)
        await act('Produce the scene', 120)
      }
      const { result, seen } = await watchProgress(`18-produce-${scene.delivery}`, async () => {
        const now = (await sceneOf(videoId, scene.id))?.production
        if (now?.ready?.current) return now
        return now?.latest?.status === 'failed' ? now : null
      }, 90 * 60)
      evidence[`production-${scene.delivery}`] = { status: result?.latest?.status, error: result?.latest?.error?.message || null, clock: result?.ready?.summary?.clock, duration: result?.ready?.summary?.duration, voice: result?.ready?.voice, layers: result?.ready?.summary?.layers?.map(layer => `${layer.kind}:${layer.label}`), progress: seen.map(entry => entry.key) }
      check(Boolean(result?.ready?.current), `${scene.title}: the harness produces it on ${clock}${result?.latest?.error ? ` (failed: ${result.latest.error.message})` : ''}`)
      if (!result?.ready) return
    }
    await focusApp()
    await act('Review the output', 60)
    await waitFor(`() => { const now = (${stageNow})(); return now.mode === 'output' && now.player ? true : null }`, 90)
    await expandTimeline()
    const timeline = await waitFor(`() => { const now = (${timelineNow})(); return now && /^On the clock of/.test(now.note) ? now : null }`, 30)
    evidence[`timeline-${scene.delivery}`] = timeline
    check(Boolean(timeline) && timeline.note.includes(clock), `${scene.title}: the timeline is on the clock of ${clock} (${timeline?.note})`)
    await shot(`19-produced-${scene.delivery}`)
    await act('Accept as the scene\'s output', 60)
    const accepted = await until(async () => (await project(videoId))?.producedScenes?.[scene.id], 15 * 60, 5000)
    check(Boolean(accepted), `${scene.title}: accepted and rendered (${accepted?.durationMs} ms)`)
  }
  await stage('Produce the presented scene on its take', () => produce({ ...A, delivery: 'human' }, 'your take'))
  await stage('Produce the voiced scene on its generated voice', () => produce({ ...B, delivery: 'generated' }, 'the generated voice'))

  // ——— The export, with its sound ———
  await stage('Export the two scenes', async () => {
    const accepted = Object.keys((await project(videoId))?.producedScenes || {}).filter(id => [A.id, B.id].includes(id))
    if (accepted.length < 2) note(`only ${accepted.length} of the two scenes is accepted`)
    await focusApp()
    await evaluate(`() => { document.getElementById('render-video').click(); return true }`)
    for (let i = 0; i < 20; i++) {
      if (await evaluate(`() => document.getElementById('publish-dialog').open`)) break
      await evaluate(`() => { const next = document.getElementById('finalize-next'); if (next && !document.getElementById('finalize-bar').hidden) next.click(); return true }`)
      await sleep(1500)
    }
    await evaluate(`() => { const ids = ${JSON.stringify(accepted)}; document.querySelectorAll('#publish-block-list .publish-block-row').forEach(row => { const box = row.querySelector('input[type="checkbox"]'); const id = row.dataset.nodeId || row.dataset.blockId || ''; if (box && id && box.checked !== ids.includes(id)) box.click() }); return true }`)
    const summary = await waitFor(`() => document.getElementById('publish-dialog').open ? { kind: document.getElementById('publish-export-kind').textContent, audio: document.getElementById('publish-audio').textContent, count: document.getElementById('publish-count').textContent } : null`, 20)
    note(`Publish: ${JSON.stringify(summary)}`)
    await shot('20-publish')
    await evaluate(`() => { document.getElementById('start-publish').click(); return true }`)
    const download = await waitFor(`() => { const result = document.getElementById('render-result'); return result && !result.hidden ? document.getElementById('download-render').href : null }`, 30 * 60)
    check(Boolean(download), 'the export renders')
    if (!download) return
    const mp4 = join(evidenceDir, 'export.mp4')
    await writeFile(mp4, Buffer.from(await (await fetch(download)).arrayBuffer()))
    const streams = ffprobe(['-show_entries', 'stream=codec_type,codec_name,width,height', '-of', 'csv=p=0', mp4])
    const length = Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]))
    // Sound through the whole export, a second at a time.
    const levels = []
    for (let at = 0; at < length - 0.5; at += 1) levels.push(loudness(mp4, at, 1))
    const silent = levels.filter(level => level === null || level < -45).length
    evidence.export = { streams, length, levels, silentSeconds: silent }
    check(/video/.test(streams) && /audio/.test(streams) && silent <= Math.ceil(length * 0.3), `the MP4 has picture and sound through it (${length.toFixed(1)}s · ${streams.replace(/\n/g, ' | ')} · ${silent} quiet seconds of ${levels.length})`)
    for (let index = 0; index < 8; index++) spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String((length * (index + 0.5)) / 8), '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:-1', join(evidenceDir, `export-frame-${index + 1}.png`)])
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=8/${Math.max(1, length)},scale=480:-1,tile=4x2`, '-frames:v', '1', join(evidenceDir, 'export-contact-sheet.png')])
    provisional('Watching the export is summarized from its frames and per-second loudness: this run did not have a person watch it.')
  })

  evidence.allRuns = (await runs()).filter(run => !evidence.startedAt || String(run.startedAt) >= evidence.startedAt).map(run => ({ id: run.id, skill: run.skill, route: run.route, adapter: run.adapter, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt }))
  const others = evidence.allRuns.filter(run => run.adapter && run.adapter !== harness)
  check(!others.length, `every harness run was ${harness} (${evidence.allRuns.length} runs${others.length ? `; others: ${others.map(run => `${run.route} on ${run.adapter}`).join(', ')}` : ''})`)
} catch (error) {
  check(false, `run: ${error instanceof Error ? error.stack || error.message : error}`)
} finally {
  evidence.baseId = baseId
  evidence.videoId = videoId
  evidence.finishedAt = new Date().toISOString()
  evidence.failures = failures
  await saveEvidence()
  await setModel(model).catch(() => {})
  await quit()
  appLog.end()
}
console.log(failures ? `LIVE WORKSPACE RUN FAIL (${failures})` : 'LIVE WORKSPACE RUN PASS')
process.exitCode = failures ? 1 : 0
