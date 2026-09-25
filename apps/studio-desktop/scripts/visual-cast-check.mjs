// The visual cast in the running app (P1): a video forked from a rich base
// shows the icons and objects lifted from its pages while it is planned —
// the twenty-slot pool whole with its verified rig, the gauge split from its
// chart, the user icon — each checked against the page it came from.
//
// The base is three pages the page-master skill drew for the Stripe
// rate-limiting article (studio-v2 server fixtures). No harness runs: the
// cast is extracted by the product when the video's planning opens. The
// local file store in a temp directory keeps every database out of it.
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const fixtures = fileURLToPath(new URL('../../studio-v2/server/fixtures/visual-cast/', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-visual-cast-'))

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
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures += 1
}
const api = async (path, init) => {
  const response = await fetch(origin + path, init)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const evaluate = async js => {
  const { body } = await api('/__eval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ js: `(${js})()` }) })
  if (!body?.ok) throw new Error(body?.error || 'eval failed')
  return body.result
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = async (js, tries = 120) => {
  for (let i = 0; i < tries; i += 1) {
    const value = await evaluate(js).catch(() => null)
    if (value) return value
    await sleep(500)
  }
  return null
}
const capture = async name => {
  if (!process.env.VISUAL_CAST_SHOTS) return
  const response = await fetch(`${origin}/__capture`).catch(() => null)
  if (!response?.ok) return
  await mkdir(process.env.VISUAL_CAST_SHOTS, { recursive: true })
  await writeFile(join(process.env.VISUAL_CAST_SHOTS, `${name}.png`), Buffer.from(await response.arrayBuffer()))
}

try {
  const page = async (id, title, file, passages) => ({ type: 'scene', attrs: { id, title, script: `${title}.`, directorNotes: title, sourcePassages: passages, svg: await readFile(join(fixtures, file), 'utf8'), pageOrigin: { kind: 'designed', by: 'Claude Code · Claude Opus 5.5' } } })
  const brand = { background: '#0e0c17', surface: '#15121f', text: '#ffffff', mutedText: '#a9b3cc', primary: '#635bff', secondary: '#ff7d6b', accent: '#ef61ef', codeBackground: '#0a0912' }
  const base = {
    version: 1, id: `cast-check-base-${Date.now().toString(36)}`, title: 'Scaling your API with rate limiters', fps: 30, width: 1920, height: 1080, blocks: {}, presenterTracks: {},
    brand: { ...brand, name: 'Stripe' },
    theme: { version: 1, id: 'stripe-check', name: 'Stripe', description: '', source: 'custom', brand, fonts: { display: 'sohne-var', body: 'sohne-var', mono: 'Consolas' } },
    notebook: { type: 'doc', content: [
      await page('b05', 'Request rate limiter', '05_request_rate_limiter.svg', ['The request rate limiter restricts each user to N requests per second.']),
      await page('b06', 'Concurrent requests limiter', '06_concurrent_requests_limiter.svg', ['It limits the number of requests in progress at once to 20.']),
      await page('b10', 'The token bucket', '10_the_token_bucket.svg', ['Each user has a bucket of tokens that refills at a steady rate.']),
    ] },
    outline: { title: 'Scaling your API with rate limiters', targetSeconds: 90, scenes: [], glossary: [] },
    story: { wordingPolicy: 'draft' },
  }
  check((await api(`/api/projects/${base.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) })).status === 200, 'the rich base is saved')
  const fork = await api(`/api/projects/${base.id}/fork`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ forkKey: `cast-${Date.now()}`, title: 'Rate limiters · video' }) })
  const videoId = fork.body?.project?.id
  check(Boolean(videoId && fork.body.project.derivedFrom?.snapshot), 'a video is forked from it')

  await evaluate(`() => { localStorage.setItem('incredible-studio-v2-video-view', 'notebook'), localStorage.setItem('incredible-studio-v2-active-project', ${JSON.stringify(videoId)}); location.assign('/studio'); return true }`).catch(() => {})
  await sleep(2500)
  check(Boolean(await waitFor(`() => document.getElementById('project-title')?.value === 'Rate limiters · video'`)), 'the video notebook opens')
  await evaluate(`() => { document.getElementById('open-planning').click(); return true }`)
  check(Boolean(await waitFor(`() => document.getElementById('planning-dialog')?.open && document.querySelectorAll('.planning-scene').length === 3`)), 'its planning workspace opens on three scenes')
  // The second scene: the concurrency limiter.
  await evaluate(`() => { document.querySelectorAll('.planning-scene')[1].click(); [...document.querySelectorAll('.planning-tab')].find(tab => tab.textContent === 'Visual cast').click(); return true }`)
  const cards = await waitFor(`() => {
    const all = [...document.querySelectorAll('.planning-cast-card')]
    if (!all.length) return null
    return all.map(card => ({ label: card.querySelector('strong')?.textContent, chips: [...card.querySelectorAll('.planning-chip')].map(chip => chip.textContent), parts: card.querySelector('small')?.textContent || '', image: card.querySelector('img')?.naturalWidth || 0, reference: card.classList.contains('is-reference') }))
  }`, 180)
  check(Boolean(cards?.length), `the cast appears while the video is planned (${cards?.length || 0} cards)`)
  // Its thumbnail, once it has loaded.
  const poolImage = await waitFor(`() => { const card = [...document.querySelectorAll('.planning-cast-card')].find(item => item.querySelector('strong')?.textContent === 'Concurrency cap'); const image = card?.querySelector('img'); return image && image.complete && image.naturalWidth > 0 ? image.naturalWidth : null }`, 40)
  const pool = cards?.find(card => card.label === 'Concurrency cap')
  if (pool) pool.image = poolImage || 0
  check(Boolean(pool) && pool.chips.includes('slot-pool rig — every part separate') && pool.chips.includes('matches the page') && /slots ×20/.test(pool.parts) && /occupied ×14/.test(pool.parts) && pool.image > 0, `the twenty-slot pool is whole, rigged and matches its page (${JSON.stringify(pool)})`)
  await sleep(800)
  await capture('01-scene-cast')
  // The rest of the base: the gauge split from its chart, and the user icon.
  await evaluate(`() => { const more = document.querySelector('[data-disclosure="cast:elsewhere"]'); more.open = true; more.dispatchEvent(new Event('toggle')); return true }`)
  const rest = await waitFor(`() => [...document.querySelectorAll('[data-disclosure="cast:elsewhere"] .planning-cast-card')].map(card => ({ label: card.querySelector('strong')?.textContent, chips: [...card.querySelectorAll('.planning-chip')].map(chip => chip.textContent), parts: card.querySelector('small')?.textContent || '' }))`)
  const caps = (rest || []).filter(card => card.label === 'Per-user cap')
  check(caps.length === 2 && caps.some(card => card.chips.includes('icon') && /spin/.test(card.parts)) && caps.some(card => card.chips.includes('chart')) && caps.every(card => card.chips.includes('grouping inferred')), `the gauge is its own icon, split from its chart, and the split is marked inferred (${JSON.stringify(caps)})`)
  const user = (rest || []).find(card => card.label === 'User script')
  check(Boolean(user) && user.chips.includes('icon') && user.chips.includes('matches the page'), `the user icon is lifted and matches its page (${JSON.stringify(user)})`)
  await evaluate(`() => { document.querySelector('.planning-stage').scrollTop = 99999; return true }`)
  await sleep(500)
  await capture('02-base-cast')
  // The same cast, in the library a plan reuses from.
  const library = (await api('/api/appearance/library')).body?.assets || []
  const extracted = library.filter(asset => asset.provenance?.provider === 'base-extraction')
  check(extracted.length >= 10 && extracted.some(asset => asset.origin?.node === 's06-node-concurrency-cap'), `the verified cast joined the reusable library (${extracted.length} ingredients)`)
  // The base is untouched.
  const after = (await api(`/api/projects/${base.id}`)).body?.project
  check(after?.notebook?.content?.[1]?.attrs?.svg === base.notebook.content[1].attrs.svg, 'the base page is unchanged')
} catch (error) {
  check(false, `run: ${error.message}`)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `VISUAL CAST CHECK FAIL (${failures})` : 'VISUAL CAST CHECK PASS')
process.exitCode = failures ? 1 : 0
