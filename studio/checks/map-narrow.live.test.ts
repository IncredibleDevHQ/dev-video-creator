import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Browser } from 'puppeteer'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { MapCanvas as Canvas } from '../app/map-canvas'
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}) }
}))
vi.mock('../app/map-api', () => ({
  mapApi: { view: vi.fn(), comments: vi.fn(async () => ({ comments: [] })) }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')

// The map with its Notes open in narrow windows, in a real browser with the
// studio's own stylesheet (review 8, round 1). On a phone (390 px) the notes
// are a sheet over the map's foot and the bar and the toast sit above it,
// the map's width: the bar had shrunk to 42 px under the panel. The map is
// painted by the real map code, its network stubbed.
const style = fileURLToPath(new URL('../app/style.css', import.meta.url))
const slide = (id: string) => ({ id, title: `Page ${id}`, svg: '<svg/>' })
const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'APIs that survive retries',
    source: '',
    video: null,
    slides: ['a', 'b', 'c'].map(slide)
  },
  status: 'ready',
  error: null,
  events: []
})
const episode = (notebook: string, number: number, pages: string[]) =>
  ({
    made: false,
    video: null,
    teasers: [],
    posts: null,
    notebook,
    number,
    title: number === 1 ? 'One click, two lattes' : `Episode ${number}`,
    status: 'ready',
    copies: pages.map((page) => ({
      id: `${notebook}-${page}`,
      title: `Copy of ${page}`,
      svg: '<svg/>',
      stale: false,
      orphan: false,
      copyOf: { notebook: 'map', slide: page, hash: 'h' }
    }))
  }) as MapEpisode
const view = (): MapView => ({
  notebook: 'map',
  title: 'APIs that survive retries',
  series: {
    id: 's',
    title: 'APIs that survive retries: one click, one latte',
    organize: true,
    directions: [],
    lines: [{ id: 'l1', name: 'The lost response', line: 'It runs through' }],
    gaps: [],
    flags: [],
    left: [],
    held: []
  },
  episodes: [episode('e1', 1, ['a', 'b']), episode('e2', 2, ['c'])],
  usage: { a: ['e1'], b: ['e1'], c: ['e2'] }
})

/** The map as the studio paints it, its Notes open, after what `act` did. */
const painted = async (act: (map: Canvas) => void | Promise<void>) => {
  const win = parseHTML('<html><body><div id="app"></div></body></html>')
  vi.stubGlobal('document', win.document)
  vi.stubGlobal('window', win)
  vi.stubGlobal('addEventListener', win.addEventListener)
  vi.stubGlobal('location', new URL('http://localhost:4194/'))
  vi.stubGlobal('history', { replaceState: () => {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  const map = new MapCanvas(win.document.getElementById('app')!, {
    close() {},
    openKeys() {},
    error() {}
  } as never)
  vi.mocked(api.load).mockImplementation(async () => snapshot())
  vi.mocked(mapApi.view).mockImplementation(async () => view())
  await map.open('map')
  ;(map.root.querySelector('.map-notes-toggle') as HTMLElement).click()
  await act(map)
  map.camera = { x: 20, y: 20, k: 0.5 }
  map.applyCamera()
  const html = map.root.innerHTML
  map.dismiss()
  vi.unstubAllGlobals()
  return html
}

let browser: Browser
let dir: string
beforeAll(async () => {
  const { default: puppeteer } = await import('puppeteer')
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  dir = await mkdtemp(join(tmpdir(), 'map-narrow-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

type Box = { left: number; top: number; right: number; bottom: number }
const meets = (one: Box, other: Box) =>
  Math.min(one.right, other.right) > Math.max(one.left, other.left) &&
  Math.min(one.bottom, other.bottom) > Math.max(one.top, other.top)

it('puts the notes in a sheet on a phone, the bar and the toast above it, the map’s width', async () => {
  const file = join(dir, 'phone.html')
  await writeFile(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body>${await painted(
      (map) => map.select({ t: 'lane', id: 'e1' })
    )}</body></html>`
  )
  const tab = await browser.newPage()
  await tab.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' }
  ])
  await tab.setViewport({ width: 390, height: 844 })
  await tab.goto(`file://${file}`, { waitUntil: 'load' })
  const at = await tab.evaluate(() => {
    const slot = (name: string) =>
      document.querySelector<HTMLElement>(`[data-map-slot="${name}"]`)!
    slot('toast').innerHTML =
      '<span>Moved. The segues around it are being rewritten.</span><button type="button" class="quiet">Undo</button>'
    slot('toast').hidden = false
    const box = (node: Element) => {
      const r = node.getBoundingClientRect()
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    const hits = (node: Element, within: Element) => {
      const r = node.getBoundingClientRect()
      return within.contains(
        document.elementFromPoint(
          (r.left + r.right) / 2,
          (r.top + r.bottom) / 2
        )
      )
    }
    const rail = document.querySelector('.map-rail')!
    const make = slot('bar').querySelector('[data-map="open:e1"]')!
    return {
      stage: box(document.querySelector('.map-stage')!),
      rail: box(rail),
      bar: box(slot('bar')),
      toast: box(slot('toast')),
      make: hits(make, slot('bar')),
      undo: hits(slot('toast').querySelector('button')!, slot('toast')),
      add: hits(rail.querySelector('[data-map-form="note"] button')!, rail)
    }
  })
  const height = at.stage.bottom - at.stage.top
  // A sheet over the foot of the map, edge to edge.
  expect.soft(at.rail.left, 'sheet, left').toBeLessThanOrEqual(12)
  expect.soft(at.rail.right, 'sheet, right').toBeGreaterThanOrEqual(378)
  expect
    .soft(at.rail.top - at.stage.top, 'sheet, map above it')
    .toBeGreaterThan(height * 0.3)
  // The bar above it, the map's width, its Make video in reach.
  expect.soft(at.bar.right - at.bar.left, 'bar, width').toBeGreaterThan(300)
  expect.soft(at.bar.left, 'bar, left').toBeGreaterThanOrEqual(0)
  expect.soft(at.bar.right, 'bar, right').toBeLessThanOrEqual(390)
  expect.soft(meets(at.bar, at.rail), 'bar, sheet').toBe(false)
  expect.soft(at.make, 'Make video can be pressed').toBe(true)
  // The toast above the bar, its Undo in reach; the sheet's Add too.
  expect.soft(meets(at.toast, at.bar), 'toast, bar').toBe(false)
  expect.soft(meets(at.toast, at.rail), 'toast, sheet').toBe(false)
  expect.soft(at.undo, 'Undo can be pressed').toBe(true)
  expect.soft(at.add, 'the sheet’s Add can be pressed').toBe(true)
}, 120_000)
