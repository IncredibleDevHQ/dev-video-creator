// An export is found again whatever became of the window that started it
// (F8 of the Perplexity review). Publish starts a draft export; the window
// reloads while it renders, and the notebook finds the same job running,
// with the renderer's progress kept on it. It finishes with its download;
// switching notebooks and coming back finds it again; nothing is rendered
// twice; and a dismissed notice stays dismissed.
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
const root = await mkdtemp(join(tmpdir(), 'studio-export-recovery-'))

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
const waitFor = async (js, label, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js, label).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const until = async (test, seconds = 60) => {
  for (let i = 0; i < seconds * 2; i += 1) {
    const value = await test().catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const capture = async name => {
  if (!process.env.EXPORT_RECOVERY_CAPTURE_DIR) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (response?.ok) await writeFile(join(process.env.EXPORT_RECOVERY_CAPTURE_DIR, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}
const put = (path, body) => fetch(`${origin}${path}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(response => response.status)
const exportsOf = id => fetch(`${origin}/api/projects/${encodeURIComponent(id)}/exports`).then(response => response.json()).then(body => body.exports || [])
const notebook = (id, title, lines) => ({
  version: 1, id, title, fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
  brand: { name: 'check', background: '#ffffff', surface: '#ffffff', text: '#111111', mutedText: '#555555', accent: '#16a34a', accentText: '#ffffff', fontFamily: 'Inter', headingFontFamily: 'Inter' },
  notebook: { type: 'doc', content: lines.map((line, index) => ({ type: 'paragraph', attrs: { id: `${id}-p${index + 1}` }, content: [{ type: 'text', text: line }] })) },
})
const openNotebook = async (id, title) => {
  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(id)}); localStorage.removeItem('incredible-studio-v2-project'); location.assign('/studio'); return true }`, 'open').catch(() => {})
  await sleep(2500)
  return waitFor(`() => document.getElementById('project-title')?.value === ${JSON.stringify(title)} ? true : null`, `open ${title}`, 60)
}

try {
  check('the first notebook is saved', (await put('/api/projects/recovery-a', notebook('recovery-a', 'Export recovery', ['Retries pile up when a service comes back.', 'Jitter spreads them out.']))) === 200)
  check('a second notebook is saved', (await put('/api/projects/recovery-b', notebook('recovery-b', 'Another notebook', ['Something else entirely.']))) === 200)
  check('the notebook opens', Boolean(await openNotebook('recovery-a', 'Export recovery')))
  check('with no export yet, nothing is shown', await evaluate(`() => document.getElementById('export-status').hidden`, 'no status'))

  // Publish: what to export, its switchovers walked, then the export starts.
  await waitFor(`() => !document.getElementById('render-video').disabled ? true : null`, 'publish ready', 60)
  await evaluate(`() => { document.getElementById('render-video').click(); return true }`, 'publish')
  const walked = await waitFor(`() => {
    const bar = document.getElementById('finalize-bar')
    if (bar && !bar.hidden) { document.getElementById('finalize-next').click(); return null }
    const start = document.getElementById('start-publish')
    if (!document.getElementById('publish-dialog').open) return null
    if (/^Review /.test(start.textContent)) { start.click(); return null }
    return start.textContent
  }`, 'summary', 30)
  await evaluate(`() => { document.getElementById('start-publish').click(); return true }`, 'start')
  const running = await until(async () => (await exportsOf('recovery-a')).find(job => job.status === 'running' && job.progress) || null, 60)
  if (!running) console.log('DIAGNOSIS', JSON.stringify({ exports: (await exportsOf('recovery-a')).map(job => ({ status: job.status, progress: job.progress, error: String(job.error || '').slice(-600) })), ui: await evaluate(`() => ({ walked: ${Boolean(walked)}, dialog: document.getElementById('publish-dialog').open, button: document.getElementById('start-publish').textContent, disabled: document.getElementById('render-video').disabled, scenes: document.getElementById('publish-count').textContent })`, 'diagnosis').catch(error => String(error)) }))
  check('the export runs, with the renderer\'s progress kept on the job', Boolean(running?.progress?.stage), JSON.stringify(running?.progress))

  // The window reloads mid-render: the notebook finds the same job running.
  await evaluate(`() => { location.reload(); return true }`, 'reload').catch(() => {})
  await sleep(2500)
  await waitFor(`() => document.getElementById('project-title')?.value === 'Export recovery' ? true : null`, 'reopened', 60)
  const found = await waitFor(`() => { const box = document.getElementById('export-status'); return !box.hidden && (box.dataset.status === 'running' || box.dataset.status === 'queued' || box.dataset.status === 'stored') ? { status: box.dataset.status, job: box.dataset.job, text: document.getElementById('export-status-text').textContent, cancel: !document.getElementById('export-status-cancel').hidden } : null }`, 'found again', 40)
  check('after a reload mid-render the notebook finds the same export', found?.job === running?.id && (found.status !== 'running' || (found.cancel && /^Exporting · /.test(found.text))), JSON.stringify(found))
  await capture('01-export-running-after-reload')
  const stored = await waitFor(`() => { const box = document.getElementById('export-status'); return box.dataset.status === 'stored' ? { job: box.dataset.job, text: document.getElementById('export-status-text').textContent, href: document.getElementById('export-status-download').href, download: !document.getElementById('export-status-download').hidden } : null }`, 'stored', 600)
  check('it finishes, found where the notebook shows it, with its download', stored?.job === running?.id && stored.download && /^Export ready · /.test(stored.text), JSON.stringify(stored))
  const file = stored?.href ? await fetch(stored.href).then(async response => ({ status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength })) : null
  check('the download is the stored MP4', file?.status === 200 && /video\/mp4/.test(file.type || '') && file.bytes > 10000, JSON.stringify(file))
  await capture('02-export-ready')
  const jobs = await exportsOf('recovery-a')
  check('nothing was rendered twice', jobs.length === 1 && jobs[0].id === running?.id, JSON.stringify(jobs.map(job => [job.id.slice(0, 8), job.status])))

  // Another notebook has its own exports; coming back finds this one.
  check('another notebook opens', Boolean(await openNotebook('recovery-b', 'Another notebook')))
  check('it shows no export of its own', await waitFor(`() => document.getElementById('export-status').hidden ? true : null`, 'other hidden', 20) === true)
  check('the first notebook opens again', Boolean(await openNotebook('recovery-a', 'Export recovery')))
  const back = await waitFor(`() => { const box = document.getElementById('export-status'); return !box.hidden ? { status: box.dataset.status, job: box.dataset.job } : null }`, 'back', 20)
  check('coming back finds the same finished export', back?.status === 'stored' && back.job === running?.id, JSON.stringify(back))

  // A dismissed notice stays dismissed across a reload.
  await evaluate(`() => { document.getElementById('export-status-dismiss').click(); return true }`, 'dismiss')
  await evaluate(`() => { location.reload(); return true }`, 'reload again').catch(() => {})
  await sleep(2500)
  await waitFor(`() => document.getElementById('project-title')?.value === 'Export recovery' ? true : null`, 'reopened again', 60)
  await sleep(1500)
  check('a dismissed export notice stays dismissed', await evaluate(`() => document.getElementById('export-status').hidden`, 'dismissed'))
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `EXPORT RECOVERY CHECK FAIL (${failures})` : 'EXPORT RECOVERY CHECK PASS')
process.exitCode = failures ? 1 : 0
