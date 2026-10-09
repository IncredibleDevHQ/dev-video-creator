import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import { withPop } from '../engine/creative/artwork-poses'

// The pose player on the pinned GSAP in a real browser, under the seeks a
// paused timeline gets: frame by frame (the render), half-second samples
// (the check), one jump, and back again. Each must show the same frame.
const require = createRequire(import.meta.url)
const gsap = readFileSync(
  require.resolve('gsap').replace(/[^/]+$/, 'gsap.min.js'),
  'utf8'
)
const player = readFileSync(
  new URL('../engine/creative/pose-player.js', import.meta.url),
  'utf8'
)
const drawing = withPop(`<svg viewBox="0 0 100 100" width="100%" height="100%">
<circle data-posed="" data-pose-glow='{"attr":{"r":"20"}}' data-pose-limit='{"attr":{"r":"30"}}' cx="50" cy="50" r="10"/>
<rect data-posed="" data-pose-glow='{"attr":{"x":"20"}}' data-pose-limit='{"attr":{"x":"40"}}' x="10" y="10" width="10" height="10"/>
<path data-posed="" data-pose-glow='{"attr":{"transform":"rotate(30 50 50)"}}' data-pose-limit='{"attr":{"transform":"rotate(60 50 50)"}}' transform="rotate(0 50 50)" d="M50 50h40"/>
</svg>`)
const page = `<!doctype html><html><body style="margin:0">
<div data-artwork="x" style="position:absolute;left:100px;top:100px;width:400px;height:400px">${drawing}</div>
</body></html>`

let browser: Browser
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
})
afterAll(() => browser?.close())

const open = async () => {
  const tab = await browser.newPage()
  await tab.setContent(page)
  await tab.addScriptTag({ content: gsap })
  await tab.addScriptTag({ content: player })
  return tab
}

/**
 * At each probe: the drawing's scale, the scale of the group around its
 * content (the scene's to move), and the pop layers' scale and offset.
 */
const play = async (build: string, path: number[], probes: number[]) => {
  const tab = await open()
  await tab.evaluate(`(() => {
    const svg = document.querySelector('svg')
    const tl = gsap.timeline({ paused: true })
    window.tl = tl
    ${build}
    tl.set({}, {}, 4)
  })()`)
  const seen: Record<string, string> = {}
  for (const t of path) {
    const state = (await tab.evaluate(`(() => {
      tl.seek(${t}, true)
      const svg = document.querySelector('svg')
      const outer = document.querySelector('[data-pose-pop]')
      let m = new DOMMatrix()
      for (const layer of document.querySelectorAll('[data-pose-layer]')) {
        const k = layer.transform.baseVal.consolidate()?.matrix
        if (k) m = m.multiply(new DOMMatrix([k.a, k.b, k.c, k.d, k.e, k.f]))
      }
      return [+gsap.getProperty(svg, 'scaleX'), +gsap.getProperty(outer, 'scaleX'), m.a, m.e]
    })()`)) as number[]
    if (probes.includes(t))
      seen[t] = state.map((value) => value.toFixed(4)).join(' ')
  }
  await tab.close()
  return seen
}
const frames = (to: number) =>
  Array.from(
    { length: Math.round(to * 30) + 1 },
    (_, i) => +(i / 30).toFixed(4)
  )
const samples = (to: number) =>
  Array.from({ length: Math.round(to * 2) + 1 }, (_, i) => i / 2)
const inOrder = (times: number[]) => [...new Set(times)].sort((a, b) => a - b)
/** The same probes by every path: frames, samples, a jump, back and on. */
const everyPath = async (build: string, probes: number[], to = 3) => {
  const played = inOrder([...frames(to), ...probes])
  const paths = [
    played,
    inOrder([...samples(to), ...probes]),
    [0, ...probes],
    [...played, 0.5, ...played.filter((t) => t > 0.5)],
    [to, ...[...probes].reverse(), ...probes]
  ]
  const results = []
  for (const path of paths) results.push(await play(build, path, probes))
  for (const result of results.slice(1)) expect(result).toEqual(results[0])
  return results[0]
}
const AT_REST = '1.0000 1.0000 1.0000 0.0000'

it('pops about the middle and keeps the scale the scene gives the drawing', async () => {
  const seen = await everyPath(
    `tl.to(svg, { scale: 1.5, duration: 0.5 }, 0); artworkPose(tl, 'x', 'glow', 1, 0.8)`,
    [1.64, 3]
  )
  // At the pop's height a layer is 4% up about (50, 50); after it, the
  // drawing is as the scene made it.
  expect(seen[1.64]).toBe('1.5000 1.0000 1.0400 -2.0000')
  expect(seen[3]).toBe('1.5000 1.0000 1.0000 0.0000')
  // A scene that scales the group around the content keeps its scale.
  const group = await everyPath(
    `tl.to(svg.querySelector(':scope > g'), { scale: 1.2, duration: 0.3 }, 0); artworkPose(tl, 'x', 'glow', 1, 0.8)`,
    [1.64, 3]
  )
  expect(group[1.64]).toBe('1.0000 1.2000 1.0400 -2.0000')
  expect(group[3]).toBe('1.0000 1.2000 1.0000 0.0000')
}, 120_000)

it('shows the same frame by every seek, and ends as drawn', async () => {
  // Poses close together, on one timeline and from a timeline placed in it.
  const close = await everyPath(
    `artworkPose(tl, 'x', 'glow', 1, 0.8); artworkPose(tl, 'x', 'limit', 1.25, 0.8)`,
    [1.6, 1.9, 3]
  )
  expect(close[3]).toBe(AT_REST)
  const four = await everyPath(
    `for (const at of [1, 1.05, 1.1, 1.15]) artworkPose(tl, 'x', 'glow', at, 0.8)`,
    [1.65, 1.8, 3]
  )
  expect(four[3]).toBe(AT_REST)
  // A fifth at once finds every layer popping and is left out.
  const five = await everyPath(
    `for (const at of [1, 1.05, 1.1, 1.15, 1.2]) artworkPose(tl, 'x', 'glow', at, 0.8)`,
    [1.65, 1.8, 3]
  )
  expect(five[1.65]).toBe(four[1.65])
  expect(five[3]).toBe(AT_REST)
  const nested = await everyPath(
    `const sub = gsap.timeline(); artworkPose(sub, 'x', 'limit', 0.25, 0.8); tl.add(sub, 1); artworkPose(tl, 'x', 'glow', 1, 0.8)`,
    [1.6, 1.9, 3]
  )
  expect(nested[3]).toBe(AT_REST)
  // The scene tweens the drawing's scale across the pop, or brings it in
  // from nothing as a pose starts.
  const tween = await everyPath(
    `tl.fromTo(svg, { scale: 0.5 }, { scale: 1, duration: 1, ease: 'none' }, 0.8); artworkPose(tl, 'x', 'glow', 0.5, 0.8)`,
    [1.5, 2.5]
  )
  expect(tween[1.5]).toBe('0.8500 1.0000 1.0000 0.0000')
  const entrance = await everyPath(
    `tl.from(svg, { scale: 0, duration: 0.6 }, 0); artworkPose(tl, 'x', 'glow', 0, 0.8)`,
    [0.5, 2],
    2
  )
  expect(entrance[2]).toBe(AT_REST)
  // A drawing without a frame pops about its content as drawn.
  const unframed = await everyPath(
    `svg.removeAttribute('viewBox'); artworkPose(tl, 'x', 'glow', 1, 0.8)`,
    [1.64, 3]
  )
  expect(unframed[3]).toBe(AT_REST)
}, 240_000)

it('ends every part of a pose within its seconds, its pop included, however often it is built', async () => {
  const tab = await open()
  const built = (await tab.evaluate(`[0.6, 0.8, 1.2].map((seconds) => {
    const tl = gsap.timeline({ paused: true })
    artworkPose(tl, 'x', 'glow', 1, seconds)
    const children = tl.getChildren(false, true, false)
    return [
      Math.max(...children.map((child) => child.startTime() + child.totalDuration())) - 1,
      children.filter((child) => child.targets()[0].hasAttribute('data-pose-layer')).length
    ]
  })`)) as Array<[number, number]>
  await tab.close()
  expect(built.map(([end]) => +end.toFixed(6))).toEqual([0.6, 0.8, 1.2])
  expect(built.map(([, pops]) => pops)).toEqual([1, 1, 1])
}, 60_000)

it('starts a timeline cleared and built again with the drawing as drawn', async () => {
  // Cleared in the middle of a pop and built again: no layer stays swollen,
  // and the new pop plays, by every seek.
  const rebuilt = await everyPath(
    `artworkPose(tl, 'x', 'glow', 1, 0.8); tl.seek(1.64, true); tl.clear(); artworkPose(tl, 'x', 'limit', 2, 0.8)`,
    [0, 1.64, 2.64, 3.5],
    3.5
  )
  expect(rebuilt[0]).toBe(AT_REST)
  expect(rebuilt[1.64]).toBe(AT_REST)
  expect(rebuilt[2.64]).toBe('1.0000 1.0000 1.0400 -2.0000')
  expect(rebuilt[3.5]).toBe(AT_REST)
}, 120_000)

it('starts a new timeline with the drawing as drawn, though an older one stopped mid-pop', async () => {
  const tab = await open()
  const layers = (await tab.evaluate(`(() => {
    const old = gsap.timeline({ paused: true })
    artworkPose(old, 'x', 'glow', 1, 0.8)
    old.seek(1.64, true)
    const fresh = gsap.timeline({ paused: true })
    artworkPose(fresh, 'x', 'limit', 2, 0.8)
    fresh.seek(4, true)
    return [...document.querySelectorAll('[data-pose-layer]')].map((layer) => layer.getAttribute('transform'))
  })()`)) as string[]
  await tab.close()
  expect(layers).toEqual(Array(4).fill('matrix(1 0 0 1 0 0)'))
}, 60_000)
