// Notebook derivation hierarchy check: both samples exist, /api/projects
// carries derivedFrom, the breadcrumb shows the ancestor chain on the derived
// notebook (and stays quiet on the mother), the library page nests the tree,
// and the mother breadcrumb segment navigates back. Follows
// sample-check.mjs's pattern (multi-instance flag + /__eval test hook).
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-hierarchy-'))
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
const MOTHER = 'sample-attention-is-all-you-need'
const VIDEO = 'sample-attention-is-all-you-need-video'

const openSample = label => evaluate(`async () => {
  document.getElementById('notebook-menu-toggle').click()
  await new Promise(r => setTimeout(r, 400))
  const entry = [...document.querySelectorAll('.notebook-menu-sample')]
    .find(button => button.textContent.includes('${label}'))
  if (!entry) throw new Error('no sample entry "${label}"')
  entry.click()
  return true
}`, `open ${label}`)

const waitForProject = async id => {
  for (let i = 0; i < 60; i += 1) {
    const body = await fetch(`${origin}/api/projects/${id}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
    if (body?.project) return body.project
    await sleep(500)
  }
  throw new Error(`${id} never appeared`)
}

try {
  // Both samples exist (creates-once-then-switches).
  await openSample('Attention Is All You Need')
  await waitForProject(MOTHER)
  await sleep(1_000)
  await openSample('Video')
  await waitForProject(VIDEO)
  await sleep(1_000)

  const { projects } = await fetch(`${origin}/api/projects`).then(r => r.json())
  const videoRow = projects.find(row => row.id === VIDEO)
  check(
    '/api/projects rows carry derivedFrom on the video sample',
    videoRow?.derivedFrom?.notebook === MOTHER && videoRow?.derivedFrom?.kind === 'video',
    JSON.stringify(videoRow?.derivedFrom),
  )
  check('mother row has no derivedFrom', !projects.find(row => row.id === MOTHER)?.derivedFrom)

  // Open the video notebook → breadcrumb shows mother › video.
  await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 400))
    const rows = [...document.querySelectorAll('.notebook-menu-open')]
    const video = rows.find(row => row.querySelector('strong').textContent.includes('Video'))
    if (!video) throw new Error('video notebook not in the switcher')
    video.click()
    return true
  }`, 'open video notebook')
  let lineage = null
  for (let i = 0; i < 40; i += 1) {
    lineage = await evaluate(`() => {
      const el = document.getElementById('notebook-lineage')
      if (!el || el.hidden) return null
      return {
        segments: [...el.querySelectorAll('.notebook-lineage-segment')].map(s => s.textContent),
        current: el.querySelector('.notebook-lineage-current')?.textContent || '',
        chip: el.querySelector('.notebook-lineage-derivatives')?.textContent || '',
      }
    }`, 'lineage').catch(() => null)
    if (lineage?.segments.length) break
    await sleep(500)
  }
  check(
    'breadcrumb on the derived notebook: mother › video',
    lineage?.segments.length === 1 &&
      lineage.segments[0].includes('Attention Is All You Need') &&
      lineage.current.includes('Video'),
    JSON.stringify(lineage),
  )

  // The switcher nests the video under its mother.
  const menu = await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 500))
    const rows = [...document.querySelectorAll('.notebook-menu-row')]
    const videoRow = rows.find(row => row.querySelector('strong')?.textContent.includes('Video'))
    const result = {
      isChild: videoRow?.classList.contains('is-child') || false,
      badge: videoRow?.querySelector('.notebook-kind-badge')?.textContent || '',
    }
    document.getElementById('notebook-menu-toggle').click()
    return result
  }`, 'menu tree')
  check('switcher nests the video as a child row with kind badge', menu.isChild && menu.badge === 'video', JSON.stringify(menu))

  // Library page: tree nests video under mother.
  await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 500))
    document.querySelector('.notebook-menu-library').click()
    await new Promise(r => setTimeout(r, 500))
    return true
  }`, 'open library')
  const tree = await evaluate(`() => {
    const page = document.getElementById('notebooks-page')
    const cards = [...document.querySelectorAll('#notebooks-tree .notebook-card')]
    const motherCard = cards.find(card => card.querySelector('strong')?.textContent.includes('Attention Is All You Need'))
    const videoCard = cards.find(card => card.querySelector('strong')?.textContent.includes('Video'))
    const samples = [...document.querySelectorAll('#notebooks-samples-list button')].length
    return {
      open: !page.hidden,
      motherIsRoot: motherCard ? !motherCard.classList.contains('is-child') : false,
      videoIsChild: videoCard?.classList.contains('is-child') || false,
      videoBadge: videoCard?.querySelector('.notebook-kind-badge')?.textContent || '',
      cardCount: cards.length,
      samples,
    }
  }`, 'library tree')
  check(
    'library page nests the video under the mother',
    tree.open && tree.motherIsRoot && tree.videoIsChild && tree.videoBadge === 'video',
    JSON.stringify(tree),
  )
  check('library lists the sample starters', tree.samples === 2, `${tree.samples} entries`)
  await evaluate(`() => { document.getElementById('close-notebooks-page').click() }`, 'close library')

  // Breadcrumb segment navigates back to the mother.
  await evaluate(`async () => {
    document.querySelector('#notebook-lineage .notebook-lineage-segment').click()
    return true
  }`, 'mother breadcrumb click')
  let motherLineage = null
  for (let i = 0; i < 40; i += 1) {
    motherLineage = await evaluate(`() => {
      const el = document.getElementById('notebook-lineage')
      const title = document.getElementById('project-title')?.value || ''
      if (!title.includes('Attention Is All You Need') || title.includes('Video')) return null
      return {
        hidden: el.hidden,
        segments: el.hidden ? [] : [...el.querySelectorAll('.notebook-lineage-segment')].map(s => s.textContent),
        current: el.hidden ? '' : el.querySelector('.notebook-lineage-current')?.textContent || '',
        chip: el.querySelector('.notebook-lineage-derivatives')?.textContent || '',
      }
    }`, 'mother lineage').catch(() => null)
    if (motherLineage && (motherLineage.chip || motherLineage.hidden === false)) break
    await sleep(500)
  }
  check(
    'mother breadcrumb navigates back; mother shows a quiet single segment + derivatives chip',
    motherLineage &&
      motherLineage.segments.length === 0 &&
      motherLineage.current.includes('Attention Is All You Need') &&
      /1 derivative/.test(motherLineage.chip),
    JSON.stringify(motherLineage),
  )

  await fetch(`${origin}/api/projects/${VIDEO}`, { method: 'DELETE' })
  await fetch(`${origin}/api/projects/${MOTHER}`, { method: 'DELETE' })
  check('cleanup', true, 'both sample notebooks deleted')
} catch (error) {
  check(`run: ${error.message}`, false)
} finally {
  app.kill('SIGTERM')
  await sleep(500)
  await rm(root, { recursive: true, force: true })
}
console.log(failures ? `HIERARCHY CHECK FAIL (${failures})` : 'HIERARCHY CHECK PASS')
process.exitCode = failures ? 1 : 0
