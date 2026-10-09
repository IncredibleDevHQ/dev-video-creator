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

/** The drawing's scale, its pop group's scale and offset, at each probe. */
const play = async (build: string, path: number[], probes: number[]) => {
  const tab = await browser.newPage()
  await tab.setContent(page)
  await tab.addScriptTag({ content: gsap })
  await tab.addScriptTag({ content: player })
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
      const pop = document.querySelector('[data-pose-pop]')
      const m = pop.transform.baseVal.consolidate()?.matrix
      return [+gsap.getProperty(svg, 'scaleX'), m ? m.a : 1, m ? m.e : 0]
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
    [...played, 0.5, ...played.filter((t) => t > 0.5)]
  ]
  const results = []
  for (const path of paths) results.push(await play(build, path, probes))
  for (const result of results.slice(1)) expect(result).toEqual(results[0])
  return results[0]
}

it('pops about the middle and keeps the scale the scene gives the drawing', async () => {
  const seen = await everyPath(
    `tl.to(svg, { scale: 1.5, duration: 0.5 }, 0); artworkPose(tl, 'x', 'glow', 1, 0.8)`,
    [1.64, 3]
  )
  // At the pop's height its group is 4% up about (50, 50); after it, the
  // drawing is as the scene made it.
  expect(seen[1.64]).toBe('1.5000 1.0400 -2.0000')
  expect(seen[3]).toBe('1.5000 1.0000 0.0000')
}, 60_000)

it('ends at the same frame for poses close together, entrances and scale tweens', async () => {
  const close = await everyPath(
    `artworkPose(tl, 'x', 'glow', 1, 0.8); artworkPose(tl, 'x', 'limit', 1.25, 0.8)`,
    [1.6, 1.9, 3]
  )
  expect(close[3]).toBe('1.0000 1.0000 0.0000')
  const tween = await everyPath(
    `tl.fromTo(svg, { scale: 0.5 }, { scale: 1, duration: 1, ease: 'none' }, 0.8); artworkPose(tl, 'x', 'glow', 0.5, 0.8)`,
    [1.5, 2.5]
  )
  expect(tween[1.5]).toBe('0.8500 1.0000 0.0000')
  const entrance = await everyPath(
    `tl.from(svg, { scale: 0, duration: 0.6 }, 0); artworkPose(tl, 'x', 'glow', 0, 0.8)`,
    [2],
    2
  )
  expect(entrance[2]).toBe('1.0000 1.0000 0.0000')
}, 120_000)

it('ends every part of a pose within the seconds it is given', async () => {
  const tab = await browser.newPage()
  await tab.setContent(page)
  await tab.addScriptTag({ content: gsap })
  await tab.addScriptTag({ content: player })
  const ends = (await tab.evaluate(`[0.6, 0.8, 1.2].map((seconds) => {
    const tl = gsap.timeline({ paused: true })
    artworkPose(tl, 'x', 'glow', 1, seconds)
    return Math.max(...tl.getChildren(false, true, false).map((child) => child.startTime() + child.totalDuration())) - 1
  })`)) as number[]
  await tab.close()
  expect(ends.map((end) => +end.toFixed(6))).toEqual([0.6, 0.8, 1.2])
}, 60_000)
