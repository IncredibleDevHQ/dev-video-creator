import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'

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
const page = `<!doctype html><html><body style="margin:0">
<div data-artwork="x" style="position:absolute;left:100px;top:100px;width:400px;height:400px">
<svg viewBox="0 0 100 100" width="100%" height="100%">
<circle data-posed="" data-pose-glow='{"attr":{"r":"20"}}' data-pose-limit='{"attr":{"r":"30"}}' cx="50" cy="50" r="10"/>
<rect data-posed="" data-pose-glow='{"attr":{"x":"20"}}' data-pose-limit='{"attr":{"x":"40"}}' x="10" y="10" width="10" height="10"/>
<path data-posed="" data-pose-glow='{"attr":{"transform":"rotate(30 50 50)"}}' data-pose-limit='{"attr":{"transform":"rotate(60 50 50)"}}' transform="rotate(0 50 50)" d="M50 50h40"/>
</svg></div></body></html>`

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

/** The drawing's scale and its shapes' posed values at each probe. */
const play = async (build: string, path: number[], probes: number[]) => {
  const tab = await open()
  await tab.evaluate(`(() => {
    const svg = document.querySelector('svg')
    const tl = gsap.timeline({ paused: true })
    window.tl = tl
    ${build}
    tl.set({}, {}, 6)
  })()`)
  const seen: Record<string, string> = {}
  for (const t of path) {
    const state = (await tab.evaluate(`(() => {
      tl.seek(${t}, true)
      const svg = document.querySelector('svg')
      return [
        (+gsap.getProperty(svg, 'scaleX')).toFixed(4),
        (+document.querySelector('circle').getAttribute('r')).toFixed(3),
        (+document.querySelector('rect').getAttribute('x')).toFixed(3),
        document.querySelector('path').getAttribute('transform')
      ].join(' ')
    })()`)) as string
    if (probes.includes(t)) seen[t] = state
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

it('poses the drawing the same by every seek, and keeps the scale the scene gives it', async () => {
  const build = `tl.to(svg, { scale: 1.5, duration: 0.5 }, 0); artworkPose(tl, 'x', 'glow', 1, 0.8); artworkPose(tl, 'x', 'limit', 2.5, 0.8); artworkPose(tl, 'x', 'rest', 4, 0.8)`
  const probes = [1.3, 2, 2.8, 3.5, 4.4, 5.5]
  const played = inOrder([...frames(6), ...probes])
  const paths = [
    played,
    inOrder([...samples(6), ...probes]),
    [0, ...probes],
    [6, ...[...probes].reverse(), ...probes],
    [...played, 0.5, ...played.filter((t) => t > 0.5)]
  ]
  const results = []
  for (const path of paths) results.push(await play(build, path, probes))
  for (const result of results.slice(1)) expect(result).toEqual(results[0])
  const seen = results[0]
  // Each pose arrives, the scene's scale untouched; rest returns it.
  expect(seen[2]).toBe('1.5000 20.000 20.000 rotate(30 50 50)')
  expect(seen[3.5]).toBe('1.5000 30.000 40.000 rotate(60 50 50)')
  expect(seen[5.5]).toBe('1.5000 10.000 10.000 rotate(0 50 50)')
}, 120_000)

it('ends every part of a pose within the seconds it is given', async () => {
  const tab = await open()
  const ends = (await tab.evaluate(`[0.6, 0.8, 1.2].map((seconds) => {
    const tl = gsap.timeline({ paused: true })
    artworkPose(tl, 'x', 'glow', 1, seconds)
    return Math.max(...tl.getChildren(false, true, false).map((child) => child.startTime() + child.totalDuration())) - 1
  })`)) as number[]
  await tab.close()
  expect(ends.map((end) => +end.toFixed(6))).toEqual([0.6, 0.8, 1.2])
}, 60_000)
