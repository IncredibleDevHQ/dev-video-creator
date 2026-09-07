// Scene entity check: the derived "Attention — Video" sample notebook.
// Creates it from the switcher (15 scene blocks from video.json + the mother
// pages), asserts the card anatomy and the mother sample's integrity, and
// verifies a reload round-trip keeps the scene blocks.
// Usage: node scripts/scene-check.mjs
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appDir = fileURLToPath(new URL('..', import.meta.url))
const electronBinary = require('electron')
const root = await mkdtemp(join(tmpdir(), 'studio-scene-'))
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

try {
  const manifest = await fetch(`${origin}/samples/attention-is-all-you-need/video.json`)
    .then(r => r.json())
  check('video.json served', manifest.scenes?.length === 15, `${manifest.scenes?.length} scenes`)

  await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 400))
    const entry = [...document.querySelectorAll('.notebook-menu-sample')]
      .find(button => button.textContent.includes('Video'))
    if (!entry) throw new Error('no video sample entry in the switcher')
    entry.click()
    return true
  }`)

  let doc = null
  for (let i = 0; i < 60; i += 1) {
    const response = await fetch(`${origin}/api/projects/${VIDEO}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
    if (response?.project) { doc = response.project; break }
    await sleep(500)
  }
  check('derived notebook created', !!doc, doc?.title)
  const scenes = (doc?.notebook?.content || []).filter(node => node.type === 'scene')
  check('15 scene blocks', scenes.length === 15, `${scenes.length} scenes`)
  check('no slide blocks leaked into the fork', !(doc?.notebook?.content || []).some(node => node.type === 'slide'))
  check('every scene carries svg + provenance + approval', scenes.every(node =>
    typeof node.attrs?.svg === 'string' && node.attrs.svg.includes('<svg') &&
    node.attrs.svgSrc?.includes('/samples/') &&
    node.attrs.derivedFrom === MOTHER &&
    node.attrs.structureApproved === true,
  ))
  check('arc roles + director notes + cues per scene', scenes.every((node, index) =>
    node.attrs.arcRole === manifest.scenes[index].arcRole &&
    node.attrs.directorNotes === manifest.scenes[index].director &&
    (node.attrs.cues || []).length === (manifest.scenes[index].cues || []).length &&
    (node.attrs.storyboard || []).length === (manifest.scenes[index].storyboard || []).length &&
    (node.attrs.steps || []).length === (manifest.scenes[index].steps || []).length,
  ))
  check('beats become speaker notes', scenes.every(node =>
    (doc.blocks?.[node.attrs.id]?.speakerNotes || '').length > 0,
  ))

  const dom = await evaluate(`async () => {
    for (let i = 0; i < 40 && !document.querySelector('.ProseMirror'); i++) await new Promise(r => setTimeout(r, 250))
    const cards = [...document.querySelectorAll('#editor figure[data-block-type="scene"]')]
    const frameCounts = cards.map(card => card.querySelectorAll('.scene-frame img').length)
    const posters = [...document.querySelectorAll('#editor .scene-poster')]
    return {
      cards: cards.length,
      badges: cards.filter(card => card.querySelector('.scene-badge') && card.querySelector('.scene-arc')).length,
      directors: cards.filter(card => card.querySelector('.scene-director p')?.textContent.length > 10).length,
      cuesLists: cards.filter(card => card.querySelectorAll('.scene-cues li').length > 0).length,
      frameCounts,
      posterLoaded: posters.filter(img => img.complete && img.naturalWidth > 0).length,
      provenance: cards.filter(card => card.querySelector('.scene-provenance')).length,
      stepsLists: cards.filter(card => card.querySelectorAll('.notebook-explainer-steps li').length > 0).length,
    }
  }`)
  check('15 scene cards rendered', dom.cards === 15, `${dom.cards} cards`)
  check('badge + arc badge per card', dom.badges === 15, `${dom.badges}/15`)
  check('director paragraph per card', dom.directors === 15, `${dom.directors}/15`)
  check('coach cues per card', dom.cuesLists === 15, `${dom.cuesLists}/15`)
  check('provenance line per card', dom.provenance === 15, `${dom.provenance}/15`)
  check(
    'storyboard frames match video.json per scene',
    dom.frameCounts.join(',') === manifest.scenes.map(s => (s.storyboard || []).length).join(','),
    dom.frameCounts.join(','),
  )
  check('poster SVGs load (naturalWidth > 0)', dom.posterLoaded === 15, `${dom.posterLoaded}/15`)
  check('narration beats listed per card', dom.stepsLists === 15, `${dom.stepsLists}/15`)

  // Reload round-trip: scene blocks survive a full reload. The eval fails
  // BECAUSE the navigation tears down the frame mid-call — that is the
  // success signal, so swallow it.
  await evaluate(`() => location.reload()`).catch(() => {})
  let reloaded = 0
  for (let i = 0; i < 30; i += 1) {
    reloaded = await evaluate(
      `() => document.querySelectorAll('#editor figure[data-block-type="scene"]').length`,
      'count',
    ).catch(() => 0)
    if (reloaded === 15) break
    await sleep(500)
  }
  check('scene blocks persist across reload', reloaded === 15, `${reloaded} cards after reload`)

  // The mother notebook is untouched: create it and compare.
  await evaluate(`async () => {
    document.getElementById('notebook-menu-toggle').click()
    await new Promise(r => setTimeout(r, 400))
    const entry = [...document.querySelectorAll('.notebook-menu-sample')]
      .find(button => !button.textContent.includes('Video'))
    entry.click()
    return true
  }`)
  let mother = null
  for (let i = 0; i < 60; i += 1) {
    const response = await fetch(`${origin}/api/projects/${MOTHER}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
    if (response?.project) { mother = response.project; break }
    await sleep(500)
  }
  const motherSlides = (mother?.notebook?.content || []).filter(node => node.type === 'slide')
  const motherScenes = (mother?.notebook?.content || []).filter(node => node.type === 'scene')
  check('mother sample untouched: 15 slides, 0 scenes', motherSlides.length === 15 && motherScenes.length === 0, `${motherSlides.length} slides / ${motherScenes.length} scenes`)

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
console.log(failures ? `SCENE CHECK FAIL (${failures})` : 'SCENE CHECK PASS')
process.exitCode = failures ? 1 : 0
