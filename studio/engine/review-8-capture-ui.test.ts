import { afterEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import type { MapCanvas as Canvas } from '../app/map-canvas'

// Review 8 (the live AI run), F01: while the first map is drawn, the Notes
// field stays open and both note paths keep the note, saying when it is
// sorted. The network is a stand-in: these checks prove the page, not the
// engine.
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}) }
}))
vi.mock('../app/map-api', () => ({
  mapApi: { view: vi.fn(), note: vi.fn(async () => ({})) }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')

class FormShim {
  constructor(private readonly form: HTMLFormElement) {}
  get = (name: string) =>
    this.form.querySelector(`[name="${name}"]`)?.textContent ?? null
}
const maps: Canvas[] = []
afterEach(() => {
  for (const map of maps.splice(0)) map.dismiss()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

const drawing = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'Payments',
    source: 'Payments retry safely.',
    video: null,
    slides: [{ id: 'a', title: 'A timeout is ambiguous', svg: null }]
  },
  status: 'building',
  error: null,
  events: []
})
const view: MapView = {
  notebook: 'map',
  title: 'Payments',
  series: null,
  episodes: [],
  usage: {}
} as unknown as MapView

const openMap = async () => {
  const win = parseHTML('<html><body><div id="app"></div></body></html>')
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
  const hooks = { close: vi.fn(), openKeys: vi.fn(), error: vi.fn() }
  const map = new MapCanvas(win.document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async () => drawing())
  vi.mocked(mapApi.view).mockImplementation(async () => structuredClone(view))
  await map.open('map')
  return { map, root: map.root, win, hooks }
}

it('keeps the Notes field open while the first map is drawn, and says when a note is sorted', async () => {
  const { root, win, hooks } = await openMap()
  const field = root.querySelector<HTMLTextAreaElement>(
    '[data-map-form="note"] textarea'
  )!
  const add = root.querySelector<HTMLButtonElement>(
    '[data-map-form="note"] button'
  )!
  expect([field.disabled, add.disabled]).toEqual([false, false])
  expect(field.placeholder).toBe(
    'Add a note: it joins the map once the wireframes are drawn'
  )
  field.textContent = 'Deduplication lasts as long as the key is kept.'
  const form = root.querySelector<HTMLFormElement>('[data-map-form="note"]')!
  // linkedom's form has no reset(); the browser's does.
  form.reset = () => {}
  form.dispatchEvent(
    new win.Event('submit', { bubbles: true, cancelable: true })
  )
  await new Promise((resolve) => setTimeout(resolve, 5))
  expect(mapApi.note).toHaveBeenCalledWith(
    'map',
    'Deduplication lasts as long as the key is kept.'
  )
  expect(hooks.error).not.toHaveBeenCalled()
  expect(root.querySelector('[data-map-slot="toast"]')?.textContent).toBe(
    'Note saved: it joins the map once the wireframes are drawn'
  )
})
