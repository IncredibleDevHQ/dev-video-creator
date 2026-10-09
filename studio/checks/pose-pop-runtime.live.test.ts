import {
  mkdtemp,
  mkdir,
  copyFile,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, normalize, sep } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import { RUNTIME_PATHS } from '../render/runtime'
import {
  POSE_PLAYER,
  posePlayer,
  withPop
} from '../engine/creative/artwork-poses'
import { inlineArtwork } from '../engine/creative/artwork'

// The pose player under the runtime's own seek (window.__player.renderSeek),
// as the check and the render play a scene: a composition served with the
// pinned runtime, its drawing placed by the app and its pops on layers.
const drawing = withPop(`<svg viewBox="0 0 100 100">
<circle data-posed="" data-pose-glow='{"attr":{"r":"20"}}' data-pose-limit='{"attr":{"r":"30"}}' cx="50" cy="50" r="10"/>
</svg>`)
const composition = (build: string) =>
  inlineArtwork(
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0} #scene{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff}</style></head><body>
<div id="scene" data-composition-id="pop" data-start="0" data-width="1920" data-height="1080" data-duration="4">
  <div data-artwork="x" style="position:absolute;left:700px;top:300px;width:400px;height:400px"></div>
</div>
<script src="./runtime/gsap.min.js"></script>
<script src="./runtime/hyperframes.iife.js"></script>
<script src="${POSE_PLAYER}"></script>
<script>
  const tl = gsap.timeline({ paused: true })
  ${build}
  tl.set({}, {}, 4)
  window.__timelines = window.__timelines || {}
  window.__timelines.pop = tl
</script>
</body></html>`,
    { x: drawing }
  ).html

let browser: Browser
let dir = ''
let server: ReturnType<typeof createServer>
let origin = ''
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'studio-pose-pop-'))
  for (const [url, source] of Object.entries(RUNTIME_PATHS)) {
    const path = join(dir, url.replace(/^\//, ''))
    await mkdir(dirname(path), { recursive: true })
    await copyFile(source, path)
  }
  await mkdir(join(dir, dirname(POSE_PLAYER)), { recursive: true })
  await writeFile(join(dir, POSE_PLAYER), await posePlayer())
  server = createServer(async (request, response) => {
    const path = normalize(
      join(dir, new URL(request.url || '/', 'http://x').pathname)
    )
    const body = path.startsWith(dir + sep)
      ? await readFile(path).catch(() => null)
      : null
    if (!body) return void response.writeHead(404).end()
    response.writeHead(200, {
      'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'text/html'
    })
    response.end(body)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
})
afterAll(async () => {
  await browser?.close()
  await new Promise((done) => server?.close(done))
  if (dir) await rm(dir, { recursive: true, force: true })
})

/** The pop layers' scale after the runtime seeks to `at`. */
const SEEK = (at: number) => `(async () => {
  await window.__player.renderSeek(${at})
  if (window.__hfWaitForSeekCompletion) await window.__hfWaitForSeekCompletion()
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  return SCALE()
})()`
const SCALE = `window.SCALE = () => {
  let m = new DOMMatrix()
  for (const layer of document.querySelectorAll('[data-pose-layer]')) {
    const k = layer.transform.baseVal.consolidate()?.matrix
    if (k) m = m.multiply(new DOMMatrix([k.a, k.b, k.c, k.d, k.e, k.f]))
  }
  return +m.a.toFixed(4)
}`

const open = async (build: string) => {
  await writeFile(join(dir, 'index.html'), composition(build))
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  await tab.goto(`${origin}/index.html`, { waitUntil: 'load' })
  await tab.waitForFunction(
    'window.__playerReady === true && typeof window.__player?.renderSeek === "function"',
    { timeout: 30_000 }
  )
  await tab.evaluate(SCALE)
  return tab
}

it('shows a paused scene’s pop at its frame, though another timeline poses the drawing meanwhile', async () => {
  const tab = await open(`artworkPose(tl, 'x', 'glow', 1, 0.8)`)
  const before = await tab.evaluate(SEEK(1.6))
  // Another timeline poses the drawing while the scene waits mid-pop: the
  // next seek, to the same frame, shows the pop again.
  await tab.evaluate(
    `(() => { const other = gsap.timeline({ paused: true }); artworkPose(other, 'x', 'limit', 2, 0.8) })()`
  )
  const again = await tab.evaluate(SEEK(1.6))
  const later = await tab.evaluate(SEEK(3))
  await tab.close()
  expect(before).toBeGreaterThan(1.03)
  expect(again).toBe(before)
  expect(later).toBe(1)
}, 60_000)

it('plays pops that overlap, and a scene cleared and built again, as drawn by the runtime', async () => {
  const tab = await open(
    `for (const at of [1, 1.05, 1.1, 1.15]) artworkPose(tl, 'x', 'glow', at, 0.8)`
  )
  const forward = []
  for (const at of [1.6, 1.7, 3]) forward.push(await tab.evaluate(SEEK(at)))
  const backward = []
  for (const at of [3, 1.7, 1.6]) backward.push(await tab.evaluate(SEEK(at)))
  await tab.close()
  expect(backward.reverse()).toEqual(forward)
  // At 1.6 s three of the pops are under way, on three layers: they add up.
  expect(forward[0]).toBeCloseTo(1.0375 * 1.0273 * 1.0094, 3)
  expect(forward[2]).toBe(1)
  const cleared = await open(
    `artworkPose(tl, 'x', 'glow', 1, 0.8); tl.seek(1.64, true); tl.clear(); artworkPose(tl, 'x', 'limit', 2, 0.8)`
  )
  const seen = []
  for (const at of [0, 1.6, 2.6, 3.5])
    seen.push(await cleared.evaluate(SEEK(at)))
  await cleared.close()
  expect(seen[0]).toBe(1)
  expect(seen[1]).toBe(1)
  expect(seen[2]).toBeGreaterThan(1.03)
  expect(seen[3]).toBe(1)
}, 120_000)
