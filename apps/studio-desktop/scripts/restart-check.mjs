// What survives a real restart (F01, F03 and F05 of the project-flow fix
// verification) — an engineering fixture across two processes on the same
// data folder. The desktop's worker takes a new port at every start, and web
// storage belongs to an origin, so a page reload on one port misses all of
// this.
//
// Before the restart: a video notebook of two designed pages carries a
// root-relative logo and page artwork named on the first port; it is
// exported, and the creator leaves it on its second scene's Record tab.
// Between: the export's stored result is put back the way older builds
// wrote it — an absolute address on the first port.
// After a quit and a start on a new port:
// - F03: the app opens on the studio, on the same notebook, scene and tab;
// - F01: the saved export downloads the same bytes through the desktop's own
//   download, and a file gone from the store says so, with a retry, while
//   the studio stays the studio;
// - F05: a new export packages the logo and the artwork named on the dead
//   port — both visible in its frames, no local 404 — a missing file the
//   video shows stops it, and a missing logo exports with a warning the
//   notice reads.
// Usage: node scripts/restart-check.mjs (RESTART_SHOTS=<dir> keeps shots)
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const fixtures = fileURLToPath(new URL('../../studio-v2/server/fixtures/visual-cast/', import.meta.url))
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-restart-'))
const dataDir = join(root, 'data')
const downloads = join(root, 'downloads')
const binDir = join(root, 'bin')
await mkdir(binDir, { recursive: true })
await mkdir(downloads, { recursive: true })

let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}

// A harness that only answers who it is: nothing here plans.
const stubPath = join(binDir, 'claude')
await writeFile(stubPath, `#!/usr/bin/env node\nif (process.argv.includes('--version')) { console.log('9.9.9 (Claude Code stub)'); process.exit(0) }\nprocess.exit(1)\n`)
await chmod(stubPath, 0o755)

// ——— The app, started and quit as the creator does ———
let child = null
let origin = ''
let appLog = ''
const launch = async () => {
  appLog = ''
  child = spawn(electronBinary, ['.', '--smoke', '--keep-running'], {
    cwd: appDir,
    env: { ...process.env, STUDIO_ALLOW_MULTI_INSTANCE: '1', STUDIO_ENABLE_TEST_HOOKS: '1', STUDIO_PERSISTENCE: 'local', STUDIO_DATA_DIR: dataDir, STUDIO_OUTPUTS_DIR: join(root, 'outputs'), STUDIO_DOWNLOADS_DIR: downloads, STUDIO_CLAUDE_BIN: stubPath },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  child.stdout.on('data', chunk => { appLog += chunk.toString() })
  origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the app did not start')), 120_000)
    const read = () => {
      const match = /STUDIO_ORIGIN (\S+)/.exec(appLog)
      if (match && /SMOKE PASS/.test(appLog)) { clearTimeout(timer); child.stdout.off('data', read); resolve(match[1]) }
      const failed = /SMOKE FAIL: ([^\n]+)/.exec(appLog)
      if (failed) { clearTimeout(timer); reject(new Error(failed[1])) }
    }
    child.stdout.on('data', read)
  })
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const quit = async () => {
  if (!child) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  await fetch(`${origin}/__quit`, { method: 'POST' }).catch(() => {})
  if (!(await Promise.race([exited.then(() => true), sleep(20_000).then(() => false)]))) {
    console.log('NOTE  the app was still running 20s after it was asked to quit; it was killed')
    child.kill('SIGKILL')
  }
  child = null
}
const api = async (path, init) => {
  const response = await fetch(origin + path, init)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const put = (path, body) => api(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
const evaluate = async js => {
  const { body } = await post('/__eval', { js: `(${js})()` })
  if (!body?.ok) throw new Error(body?.error || 'eval failed')
  return body.result
}
const waitFor = async (js, seconds = 60) => {
  for (let i = 0; i < seconds * 2; i++) {
    const value = await evaluate(js).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const until = async (test, seconds = 90) => {
  for (let i = 0; i < seconds * 2; i++) {
    const value = await test().catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const click = selector => evaluate(`() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true }`)
const shot = async name => {
  if (!process.env.RESTART_SHOTS) return
  await sleep(700)
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.RESTART_SHOTS, { recursive: true })
  await writeFile(join(process.env.RESTART_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const upload = async (type, body, projectId) => {
  const response = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { 'content-type': type, 'x-project-id': projectId, 'x-block-id': 'restart' }, body })
  return response.json()
}
const exportOf = async project => {
  const started = await post('/api/exports?retry=true', project)
  const id = started.body?.job?.id
  return until(async () => {
    const { body } = await api(`/api/exports/${id}`)
    return ['stored', 'failed', 'cancelled'].includes(body?.job?.status) ? body.job : null
  }, 300)
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
// One frame of an MP4 as RGB, and the colour at a point of it.
const frameAt = (file, seconds) => spawnSync('ffmpeg', ['-v', 'error', '-ss', String(seconds), '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1920 * 1080 * 3 + 1024 }).stdout
const colourAt = (frame, x, y) => { const at = (y * 1920 + x) * 3; return [frame[at], frame[at + 1], frame[at + 2]] }
const near = (colour, target, tolerance = 40) => colour.every((value, index) => Math.abs(value - target[index]) <= tolerance)

try {
  await launch()
  const firstOrigin = origin
  // ——— A video of two designed pages ———
  const page = async (id, title, file, script) => ({ type: 'scene', attrs: { id, title, script, directorNotes: title, sourcePassages: [], svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `restart-base-${Date.now().toString(36)}`, title: 'Restart check', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Restart' },
    theme: { version: 1, id: 'restart-theme', name: 'Restart', description: '', source: 'custom', brand, fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('r01', 'The bucket fills', '05_request_rate_limiter.svg', 'Each request spends one token.'),
      await page('r02', 'Requests wait their turn', '06_concurrent_requests_limiter.svg', 'The limiter holds the rest.'),
    ] },
  }
  check((await put(`/api/projects/${base.id}`, base)).status === 200, 'the base is saved')
  const fork = await post(`/api/projects/${base.id}/fork`, { forkKey: `restart-${Date.now()}`, title: 'Restart check · video' })
  const videoId = fork.body?.project?.id
  const { body: { project: video } } = await api(`/api/projects/${encodeURIComponent(videoId)}`)
  const scenes = video.notebook.content.filter(node => node.type === 'scene').map(node => node.attrs.id)
  check(scenes.length === 2, `the video has its two scenes (${scenes.join(', ')})`)

  // ——— A logo named by path, artwork named on this port ———
  const magenta = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff00ff"/></svg>'
  const logo = await upload('image/svg+xml', Buffer.from(magenta), videoId)
  const limePath = join(root, 'lime.png')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=16x16', '-frames:v', '1', limePath])
  const art = await upload('image/png', await readFile(limePath), videoId)
  check(logo.url?.startsWith('/objects/') && art.url?.startsWith('/objects/'), `a stored file is named by its path, never this port (${logo.url}, ${art.url})`)
  const expected = structuredClone(video)
  video.theme = { ...video.theme, logo: { url: logo.url, placement: 'top-left', size: 60 } }
  const first = video.notebook.content.find(node => node.attrs?.id === scenes[0])
  // The way older builds named page artwork: on the port the app had then.
  first.attrs.svg = first.attrs.svg.replace(/<\/svg>\s*$/, `<image href="${firstOrigin}${art.url}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none"/></svg>`)
  check((await put(`/api/projects/${encodeURIComponent(videoId)}`, { project: video, expectedProject: expected })).status === 200, 'the video keeps its logo and artwork')

  // ——— Exported before the restart ———
  const before = await exportOf(video)
  check(before?.status === 'stored' && before.result?.url?.startsWith('/objects/'), `the export is stored and named by its path (${before?.status} ${before?.result?.url || before?.error || ''})`)
  const exportKey = before?.result?.exportAsset?.objectKey
  const exportBytes = Buffer.from(await (await fetch(`${origin}${before.result.url}`)).arrayBuffer())

  // ——— The creator leaves it on the second scene's Record tab ———
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(videoId)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  const opened = await waitFor(`() => document.querySelectorAll('#scene-workspace .sw-scene').length === 2 && !document.getElementById('scene-workspace').hidden ? true : null`, 60)
  check(Boolean(opened), 'the video opens on its scenes')
  await click(`#scene-workspace .sw-scene[data-scene="${scenes[1]}"]`)
  await waitFor(`() => document.querySelector('#scene-workspace .sw-scene.is-selected')?.dataset.scene === ${JSON.stringify(scenes[1])} ? true : null`, 20)
  await click('#sw-tab-record')
  const left = await waitFor(`() => { const tab = document.querySelector('#scene-workspace .sw-tabs [aria-selected="true"]')?.textContent; const scene = document.querySelector('#scene-workspace .sw-scene.is-selected')?.dataset.scene; const notice = document.getElementById('export-status'); return tab === 'Record' ? { tab, scene, path: location.pathname, notice: notice.hidden ? '' : document.getElementById('export-status-text').textContent } : null }`, 20)
  check(left?.scene === scenes[1] && left.tab === 'Record' && /^Export ready · /.test(left.notice), `before the restart: scene 2, its Record tab, the export offered (${JSON.stringify(left)})`)
  await shot('01-before-restart')
  await sleep(2000)
  await quit()

  // ——— Between: the stored result, as older builds wrote it ———
  const settingsFile = join(dataDir, 'settings.json')
  const settings = JSON.parse(await readFile(settingsFile, 'utf8'))
  const jobKey = `export-job:${before.id}`
  if (settings[jobKey]?.result) settings[jobKey].result.url = `${firstOrigin}/objects/${exportKey}`
  await writeFile(settingsFile, JSON.stringify(settings, null, 2))
  check(settings[jobKey]?.result?.url === `${firstOrigin}/objects/${exportKey}`, 'the stored export is put back on the first port, as older builds kept it')

  // ——— F03: a new port, the same place ———
  await launch()
  check(origin !== firstOrigin, `the app started on another port (${firstOrigin} → ${origin})`)
  const back = await waitFor(`() => { const root = document.getElementById('scene-workspace'); const scene = document.querySelector('#scene-workspace .sw-scene.is-selected')?.dataset.scene; const tab = document.querySelector('#scene-workspace .sw-tabs [aria-selected="true"]')?.textContent; return root && !root.hidden && scene && tab ? { path: location.pathname, origin: location.origin, title: document.getElementById('project-title')?.value, scene, tab } : null }`, 60)
  check(back?.path === '/studio' && back.origin === origin, `the app opens on the studio itself, not its themes page (${back?.path})`)
  check(back?.title === 'Restart check · video' && back.scene === scenes[1] && back.tab === 'Record', `the same notebook, on the same scene and inspector tab (${JSON.stringify(back)})`)
  await shot('02-after-restart')

  // ——— F01: the saved export downloads, on this port ———
  const offered = await waitFor(`() => { const box = document.getElementById('export-status'); const link = document.getElementById('export-status-download'); return !box.hidden && !link.hidden ? { text: document.getElementById('export-status-text').textContent, href: link.getAttribute('href'), resolved: link.href } : null }`, 30)
  check(offered?.href === `/objects/${exportKey}` && offered.resolved.startsWith(origin), `the export stored on the old port is offered on this one (${JSON.stringify(offered)})`)
  await click('#export-status-download')
  const saved = await until(async () => {
    const names = (await readdir(downloads)).filter(name => name.endsWith('.mp4'))
    return names.length ? names : null
  }, 60)
  const savedBytes = saved ? await readFile(join(downloads, saved[0])) : Buffer.alloc(0)
  check(saved?.length === 1 && sha(savedBytes) === sha(exportBytes), `Download saves the same bytes, through the desktop's own download (${saved?.[0]}, ${savedBytes.length} of ${exportBytes.length} bytes)`)
  const stayed = await evaluate(`() => ({ href: location.href, app: Boolean(document.getElementById('app')) && !document.getElementById('app').hidden, title: document.title })`)
  check(stayed?.href === `${origin}/studio` && stayed.app, `the studio stays the studio (${JSON.stringify(stayed)})`)
  // A file gone from the store: said, with a retry — never an error page.
  await rm(join(dataDir, 'objects', exportKey), { force: true })
  await click('#export-status-download')
  const refused = await waitFor(`() => { const text = document.getElementById('export-status-text').textContent; return /^Download failed/.test(text) ? { text, link: document.getElementById('export-status-download').textContent, href: location.href } : null }`, 20)
  check(refused?.text === 'Download failed — The file is no longer in the studio’s store' && refused.link === 'Retry download' && refused.href === `${origin}/studio`, `an unavailable file says so, with a retry, and the studio stays (${JSON.stringify(refused)})`)
  await shot('03-download-unavailable')

  // ——— F05: exported after the restart, every file packaged ———
  const logged = appLog.length
  const after = await exportOf({ ...video, title: 'Restart check · video · after the restart' })
  check(after?.status === 'stored' && !after.result?.warnings, `the export after the restart is ready, with no warnings (${after?.status} ${JSON.stringify(after?.result?.warnings || after?.error || '')})`)
  const renderLog = appLog.slice(logged)
  const notFound = renderLog.split('\n').filter(line => /404/.test(line) && /\/(objects|assets|media)\//.test(line))
  check(!notFound.length, `the render asked for no local file it did not have (${notFound.slice(0, 3).join(' | ') || 'no 404s'})`)
  if (after?.result?.url) {
    const file = join(root, 'after.mp4')
    await writeFile(file, Buffer.from(await (await fetch(`${origin}${after.result.url}`)).arrayBuffer()))
    const frame = frameAt(file, 1.5)
    const logoColour = frame?.length ? colourAt(frame, 72 + 30, 58 + 30) : []
    const artColour = frame?.length ? colourAt(frame, 960, 540) : []
    check(near(logoColour, [255, 0, 255]), `the logo named by its path is in the frame (${logoColour.join(',')} at 102,88)`)
    check(near(artColour, [0, 255, 0]), `the page artwork named on the dead port is in the frame (${artColour.join(',')} at 960,540)`)
  }
  // A file the video shows, gone: the export stops, and says which.
  const missingArt = structuredClone(video)
  missingArt.title = 'Restart check · missing artwork'
  const missingScene = missingArt.notebook.content.find(node => node.attrs?.id === scenes[0])
  missingScene.attrs.svg = missingScene.attrs.svg.replace(`${firstOrigin}${art.url}`, `/objects/projects/${videoId}/restart/missing.png`)
  const stopped = await exportOf(missingArt)
  check(stopped?.status === 'failed' && /no longer in the studio's store \(\/objects\/projects\/[^)]*missing\.png\)/.test(stopped.error || ''), `a missing file the video shows stops the export, named (${stopped?.status}: ${String(stopped?.error || '').slice(0, 200)})`)
  // A logo gone: the video exports without it, and says so.
  const missingLogo = { ...video, title: 'Restart check · missing logo', theme: { ...video.theme, logo: { url: `/objects/projects/${videoId}/restart/missing-logo.svg`, placement: 'top-left', size: 60 } } }
  const warned = await exportOf(missingLogo)
  check(warned?.status === 'stored' && warned.result?.warnings?.length === 1 && warned.result.warnings[0].code === 'logo_missing', `a missing logo exports with a warning kept with the result (${JSON.stringify(warned?.result?.warnings || warned?.error)})`)
  await evaluate(`() => { location.reload(); return true }`).catch(() => {})
  await sleep(2500)
  const notice = await waitFor(`() => { const box = document.getElementById('export-status'); return !box.hidden && box.dataset.warnings === '1' ? { text: document.getElementById('export-status-text').textContent, details: !document.getElementById('export-status-details').hidden, title: box.title } : null }`, 30)
  check(/^Export ready with a warning · /.test(notice?.text || '') && notice.details && /no logo/.test(notice.title), `the notice reads "Export ready with a warning", with its details (${JSON.stringify(notice)})`)
  await shot('04-ready-with-warning')
} catch (error) {
  failures += 1
  console.log(`FAIL  ${error instanceof Error ? error.stack : error}`)
} finally {
  await quit().catch(() => {})
  if (!failures) await rm(root, { recursive: true, force: true })
  else console.log(`kept ${root}`)
}
console.log(failures ? `RESTART CHECK FAIL (${failures})` : 'RESTART CHECK PASS')
process.exit(failures ? 1 : 0)
