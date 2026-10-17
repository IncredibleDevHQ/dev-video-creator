import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Browser, Page } from 'puppeteer'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
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
const { ORGANIZE_SAYS } = await import('../app/map-nodes')

// The map zoomed out, in a real browser with the studio's own stylesheet
// (review 8, F12): Tab through the canvas never lands on a control the eye
// can't see (at 45% it reached a hidden Organise new cards, and Space turned
// organising off unseen; round 2: a made episode's Cut, Read, Draft and
// Watch stayed 6 px Tab stops), and the series' organise setting stays in
// view at every zoom. The canvas is painted by the real map code, network
// stubbed.
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
const copy = (id: string, page: string) => ({
  id,
  title: `Copy of ${page}`,
  svg: '<svg/>',
  stale: false,
  orphan: false,
  copyOf: { notebook: 'map', slide: page, hash: 'h' }
})
const episode = (notebook: string, number: number, pages: string[]) =>
  ({
    made: true,
    // Made: its place among the socials, with what each offers.
    video: { scenes: pages.length, made: pages.length, joined: true },
    teasers: [],
    posts: null,
    notebook,
    number,
    title: `Episode ${number}`,
    status: 'ready',
    copies: pages.map((page) => copy(`${notebook}-${page}`, page))
  }) as MapEpisode
/** The first episode's teaser cut and posts drafted (Watch, Read); the
 * second's still to make (Cut, Draft). */
const episodes = () => {
  const [one, two] = [episode('e1', 1, ['a', 'b']), episode('e2', 2, ['c'])]
  one.teasers = [
    {
      id: 't1',
      channel: 'x',
      aspect: '9:16',
      state: 'ready',
      objectKey: 'teasers/t1.mp4'
    }
  ]
  one.posts = { x: 'Post', linkedin: 'Post', youtube: 'Post' }
  return [one, two]
}
/** The series planned; with no episode yet, it offers + Episode itself. */
const view = (empty = false): MapView => ({
  notebook: 'map',
  title: 'APIs that survive retries',
  series: {
    id: 's',
    title: 'APIs that survive retries: one click, one latte',
    organize: true,
    outcome: 'Design a retry-safe order API',
    audience: 'Backend developers',
    directions: [{ id: 'd1', text: 'Lead with the crash', at: 'now' }],
    lines: [{ id: 'l1', name: 'The lost response', line: 'It runs through' }],
    gaps: [
      {
        id: 'g1',
        missing: 'How the client sends the key',
        episode: 'e2',
        why: 'The episode needs it',
        ask: 'How does the client send it?',
        state: 'open'
      }
    ],
    flags: [],
    left: [],
    held: []
  },
  episodes: empty ? [] : episodes(),
  usage: empty ? {} : { a: ['e1'], b: ['e1'], c: ['e2'] }
})

/** The map as the studio paints it, its camera at a zoom: its cards by
 * topic, none grouped yet (Group by topic). */
const painted = async (k: number, empty = false) => {
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
  vi.mocked(mapApi.view).mockImplementation(async () => view(empty))
  map.mode = 'topic'
  await map.open('map')
  // Where the camera's zoom leaves the canvas, as the map sets it.
  map.camera = { x: 20, y: 20, k }
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
  dir = await mkdtemp(join(tmpdir(), 'map-far-zoom-'))
})
afterAll(async () => {
  await browser?.close()
  if (dir) await rm(dir, { recursive: true, force: true })
})

/** Each control Tab reaches in the canvas, from its start on: what it is,
 * whether it can be seen, and how large its words are on screen. */
const tabThrough = async (tab: Page, k: number) => {
  await tab.evaluate(() => {
    const start = document.createElement('i')
    start.tabIndex = 0
    document.querySelector('[data-map-world]')!.prepend(start)
    start.focus()
  })
  const seen: Array<{
    what: string
    opacity: number
    visibility: string
    size: number
    px: number | null
  }> = []
  for (let i = 0; i < 80; i++) {
    await tab.keyboard.press('Tab')
    const at = await tab.evaluate((k) => {
      const el = document.activeElement as HTMLElement | null
      if (!el?.closest('[data-map-canvas]')) return null
      let opacity = 1
      for (let node: Element | null = el; node; node = node.parentElement)
        opacity *= Number(getComputedStyle(node).opacity)
      const r = el.getBoundingClientRect()
      return {
        what:
          el.dataset.k ||
          el.dataset.map ||
          (el.matches('[data-map-organize]')
            ? 'organize'
            : el.matches('a')
              ? 'watch'
              : el.tagName),
        opacity,
        visibility: getComputedStyle(el).visibility,
        size: r.width * r.height,
        // A block is seen whole; a button or a box is read by its words.
        px: el.classList.contains('map-el')
          ? null
          : parseFloat(getComputedStyle(el).fontSize) * k
      }
    }, k)
    if (!at) break
    seen.push(at)
  }
  return seen
}

it('never tabs to a control the eye can’t see, and keeps Organise new cards in view, at every zoom', async () => {
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1206, height: 954 })
  await tab.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' }
  ])
  // Two episodes made, or the series planned with none yet.
  for (const [empty, k] of [false, true].flatMap((empty) =>
    [1, 0.45, 0.3].map((k) => [empty, k] as const)
  )) {
    const file = join(dir, `map-${empty}-${k}.html`)
    await writeFile(
      file,
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${style}"></head><body>${await painted(k, empty)}</body></html>`
    )
    await tab.goto(`file://${file}`, { waitUntil: 'load' })
    const seen = await tabThrough(tab, k)
    const where = `${empty ? 'no episode' : 'made'} at ${k * 100}%`
    expect
      .soft(seen.length, `${where}: Tab reaches the canvas`)
      .toBeGreaterThan(3)
    // Close up, the small controls are there to reach: zoomed out, the
    // checks above and below hold for them too.
    if (k === 1)
      expect
        .soft(
          seen.map((at) => at.what),
          `${where}: what is reached close up`
        )
        .toEqual(
          expect.arrayContaining(
            empty
              ? ['group', 'new-episode']
              : ['group', 'teaser:e2', 'posts:e2', 'read-posts:e1', 'watch']
          )
        )
    for (const at of seen) {
      expect.soft(at.visibility, `${where}: ${at.what}`).toBe('visible')
      expect.soft(at.opacity, `${where}: ${at.what}`).toBeGreaterThan(0.9)
      expect.soft(at.size, `${where}: ${at.what}`).toBeGreaterThan(0)
      // No control Tab reaches is too small to read (round 1: an episode's
      // Make video stayed 12 px, about 5 px on screen at 41%).
      if (at.px !== null)
        expect.soft(at.px, `${where}: ${at.what}, on screen`).toBeGreaterThan(7)
    }
    // Farthest out, an episode's Make video is in its bar, not its lane.
    if (empty) void 0
    else if (k < 0.36)
      expect
        .soft(
          seen.filter((at) => at.what.startsWith('open:')),
          `${where}: Make video in a lane`
        )
        .toEqual([])
    else
      expect
        .soft(
          seen.some((at) => at.what === 'open:e1'),
          `${where}: Make video reached`
        )
        .toBe(true)
    // The series' automation, reached right after the series, and shown.
    const organize = seen.findIndex((at) => at.what === 'organize')
    expect
      .soft(organize, `${where}: organise reached`)
      .toBeGreaterThanOrEqual(0)
    const label = await tab.evaluate(() => {
      const box = document.querySelector('.map-organize')!
      const r = box.getBoundingClientRect()
      return {
        title: box.getAttribute('title'),
        says: getComputedStyle(document.querySelector('.map-organize-says')!)
          .visibility,
        opacity: Number(getComputedStyle(box).opacity),
        visibility: getComputedStyle(box).visibility,
        size: parseFloat(getComputedStyle(box).fontSize),
        name: parseFloat(
          getComputedStyle(document.querySelector('.map-series-title h2')!)
            .fontSize
        ),
        inside: (() => {
          const head = document
            .querySelector('.map-series-head')!
            .getBoundingClientRect()
          return r.left >= head.left && r.right <= head.right + 0.5
        })()
      }
    })
    // What it covers stays reachable: the line under it close up, and its
    // label's hover once that line is hidden, never both (round 3).
    expect
      .soft(label.title, `${where}: organise says it on hover`)
      .toBe(label.says === 'visible' ? null : ORGANIZE_SAYS)
    expect
      .soft(label.says, `${where}: the line under organise`)
      .toBe(k === 1 ? 'visible' : 'hidden')
    expect.soft(label.visibility, `${where}: organise shown`).toBe('visible')
    expect.soft(label.opacity, `${where}: organise shown`).toBe(1)
    expect.soft(label.inside, `${where}: organise in the series`).toBe(true)
    // As large as the series' name, against the name's 16 px.
    expect
      .soft(label.size / label.name, `${where}: organise grows with the name`)
      .toBeGreaterThanOrEqual(0.74)
  }
}, 120_000)
