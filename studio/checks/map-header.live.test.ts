import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Browser } from 'puppeteer'
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import { mapPage, mapStages, mapTools } from '../app/map-view'

// The map's header in a real browser, with the studio's own stylesheet
// (review 8, F06): before a series' first plan its next step, Plan the
// series with the length it plans for, sits in the header beside a quieter
// + Episode, whole and readable at the review's window and narrower, never
// under the project's pill, whatever the canvas's zoom.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const TITLE = 'APIs that survive retries: one click, one latte'
const snapshot = {
  project: { id: 'map', title: TITLE, source: '', slides: [], video: null },
  status: 'ready',
  error: null,
  events: []
} as Snapshot
const view = {
  notebook: 'map',
  title: TITLE,
  series: {
    id: 's',
    title: TITLE,
    organize: true,
    directions: [],
    lines: [],
    gaps: [],
    flags: [],
    left: [],
    held: []
  },
  episodes: [],
  usage: {}
} as MapView

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'map-header-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

type Box = { left: number; top: number; right: number; bottom: number }
const meets = (one: Box, other: Box) =>
  Math.min(one.right, other.right) > Math.max(one.left, other.left) &&
  Math.min(one.bottom, other.bottom) > Math.max(one.top, other.top)

it('keeps Plan the series and its length whole and readable in the header at every width', async () => {
  const file = join(dir, 'map.html')
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body>${mapPage(TITLE)}</body></html>`
  )
  const tab = await browser.newPage()
  for (const width of [1440, 1206, 1100, 981, 900, 768]) {
    await tab.setViewport({ width, height: 954 })
    await tab.goto(`file://${file}`, { waitUntil: 'load' })
    const at = await tab.evaluate(
      (parts) => {
        const slot = (name: string) =>
          document.querySelector<HTMLElement>(`[data-map-slot="${name}"]`)!
        slot('tools').innerHTML = parts.tools
        slot('stages').innerHTML = parts.stages
        slot('note-count').textContent = '3'
        const box = (node: Element) => {
          const r = node.getBoundingClientRect()
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        }
        const plan = slot('tools').querySelector<HTMLElement>(
          '[data-map="plan-series"]'
        )!
        const add = slot('tools').querySelector<HTMLElement>(
          '[data-map="new-episode"]'
        )!
        const small = plan.querySelector('small')!
        const size = (node: Element) =>
          parseFloat(getComputedStyle(node).fontSize)
        const hit = (node: Element) => {
          const r = node.getBoundingClientRect()
          return node.contains(
            document.elementFromPoint(
              (r.left + r.right) / 2,
              (r.top + r.bottom) / 2
            )
          )
        }
        return {
          window: innerWidth,
          plan: box(plan),
          small: box(small),
          add: box(add),
          tools: box(document.querySelector('.map-pill-tools')!),
          project: box(document.querySelector('.map-pill-project')!),
          clipped: plan.scrollWidth > plan.clientWidth,
          planSize: size(plan),
          smallSize: size(small),
          addSize: size(add),
          onTop: hit(plan) && hit(add)
        }
      },
      {
        tools: mapTools(snapshot, view, 'order', 'all'),
        stages: mapStages(snapshot)
      }
    )
    const where = `${width} px`
    expect.soft(at.plan.left, `${where}: plan, left`).toBeGreaterThan(0)
    expect
      .soft(at.plan.right, `${where}: plan, right`)
      .toBeLessThanOrEqual(at.window)
    expect
      .soft(at.tools.right, `${where}: tools, right`)
      .toBeLessThanOrEqual(at.window)
    expect
      .soft(meets(at.tools, at.project), `${where}: tools, project`)
      .toBe(false)
    expect.soft(at.clipped, `${where}: plan, clipped`).toBe(false)
    expect
      .soft(at.small.right, `${where}: length, inside its button`)
      .toBeLessThanOrEqual(at.plan.right)
    expect.soft(at.planSize, `${where}: plan, size`).toBeGreaterThanOrEqual(13)
    expect
      .soft(at.smallSize, `${where}: length, size`)
      .toBeGreaterThanOrEqual(12)
    expect.soft(at.addSize, `${where}: add, size`).toBeGreaterThanOrEqual(13)
    expect.soft(at.onTop, `${where}: both can be pressed`).toBe(true)
    // + Episode comes first, and second in weight.
    expect
      .soft(at.add.right, `${where}: add, before plan`)
      .toBeLessThan(at.plan.left)
  }
}, 120_000)

it('keeps the header’s primary button green on hover in both appearances', async () => {
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1206, height: 400 })
  const seen: Record<string, string> = {}
  for (const theme of ['light', 'dark']) {
    const file = join(dir, `hover-${theme}.html`)
    await writeFile(
      file,
      `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body>${mapPage(TITLE)}</body></html>`
    )
    await tab.goto(`file://${file}`, { waitUntil: 'load' })
    await tab.evaluate(
      (tools) => {
        document.querySelector('[data-map-slot="tools"]')!.innerHTML = tools
      },
      mapTools(snapshot, view, 'order', 'all')
    )
    await tab.hover('[data-map="plan-series"]')
    seen[theme] = await tab.evaluate(
      () =>
        getComputedStyle(document.querySelector('[data-map="plan-series"]')!)
          .backgroundColor
    )
  }
  // The green every .primary has on hover, never the header's grey.
  expect(seen).toEqual({ light: 'rgb(25, 99, 50)', dark: 'rgb(25, 99, 50)' })
}, 60_000)
