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
    segueCheck: vi.fn(async () => ({})),
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
// Review 8, F10, round 1: a line still past the creator's words after its
// rewrite is flagged on the map's "Next time" card, where an episode is
// approved, with Write it again and Keep it once the episode is open. The
// network is a stand-in: these checks prove what the map shows and asks.

const NOTE =
  'It says “never”; the note of 17 October 2026 says “Do not promise that an old retry will be deduplicated forever.”'
const OUTRO =
  'Next time, in Give the latte a name, we reach for our first tool: an idempotency key, so a retry can never pour a second latte.'
const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'APIs that survive retries',
    source: '',
    video: null,
    slides: [
      { id: 'a', title: 'APIs that survive retries', svg: '<svg/>' },
      { id: 'b', title: 'A timeout is ambiguous', svg: '<svg/>' }
    ]
  },
  status: 'ready',
  error: null,
  events: []
})
const copy = (id: string, page: string, extra = {}) => ({
  svg: '<svg/>',
  stale: false,
  orphan: false,
  id,
  title: `Copy of ${page}`,
  copyOf: { notebook: 'map', slide: page, hash: 'h' },
  ...extra
})
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
    gaps: []
  },
  episodes: [
    {
      made: false,
      video: null,
      teasers: [],
      posts: null,
      notebook: 'e1',
      number: 1,
      title: 'One click, two lattes',
      status: 'ready',
      copies: [
        copy('x', 'a', { bridge: 'You tap order once.' }),
        copy('y', 'b', {
          bridge: 'So where does it go wrong?',
          outro: OUTRO,
          checks: { outro: NOTE }
        })
      ]
    } as MapEpisode,
    {
      made: false,
      video: null,
      teasers: [],
      posts: null,
      notebook: 'e2',
      number: 2,
      title: 'Give the latte a name',
      status: 'ready',
      copies: [copy('z', 'a', { bridge: 'Last time, two lattes.' })]
    } as MapEpisode
  ],
  usage: { a: ['e1', 'e2'], b: ['e1'] },
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
  vi.mocked(mapApi.segueCheck).mockImplementation(async () => ({}) as never)
  await map.open('map')
  return { map, root: map.root }
}
const click = (target: Element | null) => (target as HTMLElement).click()
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))

it('flags the “Next time” card, and offers its two answers once the episode is open', async () => {
  const { map, root } = await openMap(view())
  const end = root.querySelector('[data-k="e:e1"]')!
  expect(end.querySelector('.map-segue-k')!.textContent).toBe('Next time check')
  expect(end.getAttribute('title')).toBe(`${OUTRO}\n${NOTE}`)
  expect(end.querySelector('.map-segue-check small')!.textContent).toBe(NOTE)
  // Not flagged: the other cards say nothing more.
  expect(root.querySelector('[data-k="s:e1"] .map-check')).toBeNull()
  expect(root.querySelector('[data-k="s:e2"] .map-check')).toBeNull()
  map.select({ t: 'lane', id: 'e1' })
  const open = root.querySelector('[data-k="e:e1"]')!
  expect(open.className).toContain('is-open')
  const buttons = [...open.querySelectorAll('.map-segue-check button')]
  expect(
    buttons.map((b) => [b.textContent, b.getAttribute('data-map')])
  ).toEqual([
    ['Write it again', 'segue-again:e1|y|outro'],
    ['Keep it', 'segue-keep:e1|y|outro']
  ])
  click(buttons[1])
  await settle()
  expect(mapApi.segueCheck).toHaveBeenCalledWith('e1', {
    slide: 'y',
    line: 'outro',
    keep: true
  })
  click(root.querySelector('[data-k="e:e1"] [data-map^="segue-again"]'))
  await settle()
  expect(mapApi.segueCheck).toHaveBeenLastCalledWith('e1', {
    slide: 'y',
    line: 'outro'
  })
})
