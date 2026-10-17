import { afterEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { MapCanvas as Canvas } from '../app/map-canvas'
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}) }
}))
vi.mock('../app/map-api', () => ({
  mapApi: {
    view: vi.fn(),
    gap: vi.fn(async () => ({})),
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
const { gapCard } = await import('../app/map-nodes')
// Review 8, F09: a gap a card may already cover shows that card's words and
// closes with it in one step. The network is a stand-in: these checks prove
// what the map shows and asks for, not the engine's answer.

const slide = (id: string, title: string) => ({ id, title, svg: '<svg/>' })
const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'APIs that survive retries',
    source: '',
    video: null,
    slides: [
      slide('a', 'A timeout is ambiguous'),
      slide('b', 'First tool: an idempotency key')
    ]
  },
  status: 'ready',
  error: null,
  events: []
})
const copy = (id: string, page: string): MapEpisode['copies'][number] => ({
  svg: '<svg/>',
  stale: false,
  orphan: false,
  id,
  title: `Copy of ${page}`,
  copyOf: { notebook: 'map', slide: page, hash: 'h' }
})
const episode = (notebook: string, number: number, page: string) =>
  ({
    made: false,
    video: null,
    teasers: [],
    posts: null,
    notebook,
    number,
    title: `Episode ${number}`,
    status: 'ready',
    copies: [copy(`${notebook}-c`, page)]
  }) as MapEpisode
const SAYS = 'the same key carrying a different order is rejected'
const view = (): MapView => ({
  notebook: 'map',
  title: 'APIs that survive retries',
  series: {
    id: 's',
    title: 'APIs that survive retries',
    organize: true,
    lines: [],
    flags: [],
    left: [],
    held: [],
    directions: [],
    gaps: [
      {
        id: 'same-key',
        missing:
          'What the server does when the same key arrives with a different order',
        episode: 'e2',
        why: 'The card idea does not show it',
        ask: 'What should the server do with a reused key?',
        state: 'open',
        covered: { page: 'b', says: SAYS }
      }
    ]
  },
  episodes: [episode('e1', 1, 'a'), episode('e2', 2, 'b')],
  usage: { a: ['e1'], b: ['e2'] },
  comments: []
})

let win = parseHTML('')
const maps: Canvas[] = []
afterEach(() => {
  for (const map of maps.splice(0)) map.dismiss()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
const openMap = async (shown: MapView) => {
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
  const hooks = { close: vi.fn(), openKeys: vi.fn(), error: vi.fn() }
  const map = new MapCanvas(win.document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async () => snapshot())
  vi.mocked(mapApi.view).mockImplementation(async () => structuredClone(shown))
  vi.mocked(mapApi.gap).mockImplementation(async () => ({}) as never)
  await map.open('map')
  return { map, root: map.root }
}
const fire = (target: EventTarget, type: string, extra: object = {}) => {
  const event = new win.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, extra)
  target.dispatchEvent(event)
}
const click = (target: Element | null) => (target as HTMLElement).click()
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
const actions = (node: Element) =>
  [...node.querySelectorAll('button')].map((button) => button.dataset.map)

it('keeps an open gap’s card as it was: its reason, and Explain here', () => {
  const { covered, ...open } = view().series!.gaps[0]
  expect(covered).toBeDefined()
  const html = gapCard(open)
  expect(html).toContain('<p>The card idea does not show it</p>')
  expect(html).toContain('data-map="gap-explain:same-key"')
  expect(html).not.toContain('a card may say it')
})

it('shows the words of the card that may cover a gap, and closes the gap with that card', async () => {
  const { map, root } = await openMap(view())
  const node = root.querySelector('[data-k="g:same-key"]')!
  expect(node.textContent).toContain('a card may say it')
  expect(node.textContent).toContain(`“${SAYS}”`)
  expect(actions(node)).toEqual([
    'gap-note:same-key',
    'gap-covered:same-key',
    'gap-ignore:same-key'
  ])
  fire(node, 'pointerdown', { button: 0, clientX: 10, clientY: 10 })
  fire(node, 'pointerup', { button: 0, clientX: 10, clientY: 10 })
  expect(map.sel).toEqual({ t: 'gap', id: 'same-key' })
  // The bar quotes the card first and names it (the gap's own card says
  // what is missing), with closing the gap beside a note.
  const bar = map.slot('bar')!
  expect(bar.querySelector('.map-info')!.textContent).toBe(
    `A card may say it · “${SAYS}”First tool: an idempotency key`
  )
  expect(actions(bar)).toEqual([
    'gap-note:same-key',
    'gap-covered:same-key',
    'gap-explain:same-key',
    'gap-ignore:same-key'
  ])
  click(bar.querySelector('[data-map="gap-covered:same-key"]'))
  await settle()
  expect(mapApi.gap).toHaveBeenCalledWith('s', 'same-key', 'covered')
  // The card's own button does the same.
  vi.mocked(mapApi.gap).mockClear()
  click(
    root.querySelector(
      '[data-k="g:same-key"] [data-map="gap-covered:same-key"]'
    )
  )
  await settle()
  expect(mapApi.gap).toHaveBeenCalledWith('s', 'same-key', 'covered')
})
