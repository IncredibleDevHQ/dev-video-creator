import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { MapCanvas as Canvas } from '../app/map-canvas'
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}), slide: vi.fn() }
}))
vi.mock('../app/map-api', () => ({
  mapApi: {
    view: vi.fn(),
    copies: vi.fn(async () => ({})),
    direction: vi.fn(async () => ({})),
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
const { markRuns } = await import('../app/map-length')
const { extent } = await import('../app/map-layout')
// Review 8's live look at the content map, with the network stubbed: these
// checks drive the real canvas, its header, bar and keys; what the engine
// and a model do is proved elsewhere.

const slide = (id: string) => ({ id, title: `Page ${id}`, svg: '<svg/>' })
const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    video: null,
    slides: ['a', 'b', 'c', 'd'].map(slide)
  },
  status: 'ready',
  error: null,
  events: []
})
type Copies = MapEpisode['copies']
const copy = (id: string, page: string): Copies[number] => ({
  id,
  title: `Copy of ${page}`,
  svg: '<svg/>',
  stale: false,
  orphan: false,
  copyOf: { notebook: 'map', slide: page, hash: 'h' }
})
const episode = (notebook: string, number: number, copies: Copies) =>
  ({
    made: false,
    video: null,
    teasers: [],
    posts: null,
    notebook,
    number,
    title: `Episode ${number}`,
    status: 'ready',
    copies
  }) as MapEpisode
const line = { id: 'l1', name: 'The lost response', line: 'It runs through' }
const view = (planned = true): MapView => ({
  notebook: 'map',
  title: 'Streamline',
  series: {
    id: 's',
    title: 'Streamline',
    organize: true,
    directions: [{ id: 'd1', text: 'Lead with the crash', at: 'now' }],
    lines: planned ? [line] : [],
    gaps: [],
    flags: [],
    left: [],
    held: []
  },
  episodes: planned
    ? [
        episode('e1', 1, [copy('x', 'a'), copy('y', 'b'), copy('w', 'c')]),
        episode('e2', 2, [copy('z', 'b')])
      ]
    : [],
  usage: planned ? { a: ['e1'], b: ['e1', 'e2'], c: ['e1'] } : {}
})

/** A form's fields, read the way FormData reads a real one. */
class FormShim {
  constructor(private readonly form: HTMLFormElement) {}
  get = (name: string) =>
    this.form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? null
}

let win = parseHTML('')
const maps: Canvas[] = []
afterEach(() => {
  for (const map of maps.splice(0)) map.dismiss()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const openMap = async (shown = view()) => {
  win = parseHTML('<html><body><div id="app"></div></body></html>')
  vi.stubGlobal('document', win.document)
  vi.stubGlobal('window', win)
  vi.stubGlobal('addEventListener', win.addEventListener)
  vi.stubGlobal('location', new URL('http://localhost:4194/'))
  vi.stubGlobal('history', { replaceState: () => {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('FormData', FormShim)
  const hooks = {
    close: vi.fn(),
    openKeys: vi.fn(),
    openEpisode: vi.fn(),
    error: vi.fn()
  }
  const map = new MapCanvas(win.document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async () => snapshot())
  vi.mocked(mapApi.view).mockImplementation(async () => structuredClone(shown))
  vi.mocked(mapApi.comments).mockImplementation(async () => ({
    comments: []
  }))
  await map.open('map')
  return { map, hooks, root: map.root }
}
const click = (target: Element | null) => (target as HTMLElement).click()
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
const fire = (target: EventTarget, type: string, extra: object = {}) => {
  const event = new win.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, extra)
  target.dispatchEvent(event)
}
const rect = (x: number, y: number, w: number, h: number) =>
  ({
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h
  }) as DOMRect
const tools = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-map-slot="tools"]')!

describe('the series’ next step in the header (F06)', () => {
  it('asks for the plan first, with its length, and + Episode second, outside the zoomed canvas', async () => {
    const { map, root } = await openMap(view(false))
    const plan = tools(root).querySelector<HTMLElement>(
      '[data-map="plan-series"]'
    )!
    expect(plan.className).toContain('primary')
    expect(plan.textContent).toBe('Plan the series45–120 s each')
    const add = tools(root).querySelector('[data-map="new-episode"]')!
    expect(add.className).toContain('quiet')
    expect(add.className).not.toContain('primary')
    // The header is not in the world the camera scales.
    map.camera = { x: 0, y: 0, k: 0.45 }
    map.applyCamera()
    expect(map.world!.contains(plan)).toBe(false)
    // Said once: the series on the canvas doesn't ask again.
    const series = root.querySelector('[data-k="B:series"]')!
    expect(series.querySelector('[data-map="plan-series"]')).toBeNull()
    expect(series.querySelector('[data-map="new-episode"]')).toBeNull()
    expect(series.querySelector('[data-map="length"]')).toBeNull()
    // It asks how to plan in the bar, with the length to change.
    click(plan)
    await settle()
    const form = map.slot('bar')!.querySelector('[data-map-form="plan"]')!
    expect(form.querySelector('[data-map="length"]')?.textContent).toBe(
      '45–120 s each'
    )
    // The slider's window shows in the header as it moves.
    markRuns(root, { min: 60, max: 90, strict: true })
    expect(plan.querySelector('small')?.textContent).toBe(
      '60–90 s each · must fit'
    )
  })

  it('has nothing to press while the plan runs, then + Episode leads, and the series plans again', async () => {
    const running = view(false)
    running.series!.planning = { state: 'planning' }
    const { map, root } = await openMap(running)
    const busy = tools(root).querySelector<HTMLButtonElement>('.map-next')!
    expect(busy.disabled).toBe(true)
    expect(busy.dataset.map).toBeUndefined()
    expect(busy.textContent).toContain('Planning…')
    vi.mocked(mapApi.view).mockImplementation(async () => view())
    await map.refresh()
    expect(tools(root).querySelector('.map-next')).toBeNull()
    expect(
      tools(root).querySelector('[data-map="new-episode"]')?.className
    ).toContain('primary')
    const series = root.querySelector('[data-k="B:series"]')!
    expect(series.querySelector('[data-map="plan-series"]')?.textContent).toBe(
      'Plan again'
    )
    expect(series.querySelector('[data-map="length"]')).not.toBeNull()
  })
})

describe('the Notes panel and the episode’s next step (F07)', () => {
  /** The canvas 1200 × 800, and the Notes panel open over its right side,
   * 300 px wide and 12 px in, as the stylesheet puts it. */
  const withNotes = async () => {
    const opened = await openMap()
    const { map, root } = opened
    map.canvas!.getBoundingClientRect = () => rect(0, 0, 1200, 800)
    click(root.querySelector('.map-notes-toggle'))
    root.querySelector('.map-rail')!.getBoundingClientRect = () =>
      rect(888, 10, 300, 780)
    return opened
  }
  /** Where a world box lands on screen, left and right. */
  const onScreen = (map: Canvas, box: { x: number; w: number }) => [
    map.camera.x + box.x * map.camera.k,
    map.camera.x + (box.x + box.w) * map.camera.k
  ]

  it('fits everything, and a block zoomed to, left of the open panel', async () => {
    const { map, root } = await withNotes()
    map.fit()
    const [left, right] = onScreen(map, extent(map.layout!))
    expect(left).toBeGreaterThanOrEqual(72)
    expect(right).toBeLessThanOrEqual(888 - 16 + 0.5)
    // Double-click an episode: it is brought close, still clear of it.
    const lane = map.layout!.lanes.e1
    map.fit(lane)
    expect(onScreen(map, lane)[1]).toBeLessThanOrEqual(888 - 16 + 0.5)
    // Shut, the whole width is used again.
    click(root.querySelector('.map-notes-toggle'))
    map.fit()
    expect(onScreen(map, extent(map.layout!))[1]).toBeGreaterThan(888)
  })

  it('brings an episode reached with Tab out from under the open panel', async () => {
    const { map } = await withNotes()
    const node = map.els.get('L:e1')!
    const lane = map.layout!.lanes.e1
    Object.assign(node, { offsetWidth: lane.w, offsetHeight: lane.h })
    node.matches = (selector: string) => selector === ':focus-visible'
    // Its right end, with Make video, sits under the panel.
    const k = 0.6
    map.camera = { x: 900 - (lane.x + lane.w) * k, y: 100 - lane.y * k, k }
    fire(node, 'focusin')
    expect(onScreen(map, lane)[1]).toBeLessThanOrEqual(888 - 40)
  })

  it('offers a selected episode’s Make video in the bar, a paste leading when one waits', async () => {
    const { map, hooks } = await withNotes()
    map.select({ t: 'lane', id: 'e1' })
    const bar = map.slot('bar')!
    const make = bar.querySelector<HTMLElement>('[data-map="open:e1"]')!
    expect(make.textContent).toBe('Make video')
    expect(make.className).toBe('primary')
    click(make)
    await settle()
    expect(hooks.openEpisode).toHaveBeenCalledWith('e1')
    // A page waiting to be pasted leads; making comes second.
    map.clip = { mode: 'copy', slide: 'd' }
    map.paint()
    const buttons = [...bar.querySelectorAll<HTMLElement>('button')]
    expect(buttons.map((b) => [b.dataset.map, b.className])).toEqual([
      ['paste', 'primary'],
      ['open:e1', 'quiet'],
      ['rename-episode', 'quiet'],
      ['menu:lane', 'quiet map-more']
    ])
  })
})
