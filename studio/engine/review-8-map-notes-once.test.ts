import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { MapCanvas as Canvas } from '../app/map-canvas'
vi.mock('../app/api', () => ({
  api: { load: vi.fn(), subscribe: vi.fn(() => () => {}) }
}))
vi.mock('../app/map-api', () => ({
  mapApi: {
    view: vi.fn(),
    note: vi.fn(async () => ({})),
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
// Review 8, round 3's audit: a note added from the canvas (Add → Note, a
// gap's "Add a note", a comment made a note) is sent once however often it
// is pressed, as the Notebook's note form is. The engine is a stand-in:
// these checks prove the map's plumbing.

const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    video: null,
    slides: [{ id: 'a', title: 'Page a', svg: '<svg/>' }]
  },
  status: 'ready',
  error: null,
  events: []
})
const view = (): MapView => ({
  notebook: 'map',
  title: 'Streamline',
  series: {
    lines: [],
    gaps: [
      {
        id: 'do',
        missing: 'What a Durable Object is',
        episode: 'e1',
        why: 'The orchestrator is one',
        ask: 'What is it?',
        state: 'open'
      }
    ],
    flags: [],
    left: [],
    held: [],
    id: 's',
    title: 'Streamline',
    organize: true,
    directions: []
  },
  episodes: [
    {
      made: false,
      video: null,
      teasers: [],
      posts: null,
      notebook: 'e1',
      number: 1,
      title: 'Episode 1',
      status: 'ready',
      copies: []
    } as unknown as MapEpisode
  ],
  usage: {},
  comments: [
    {
      id: 'k1',
      at: new Date().toISOString(),
      by: 'creator',
      text: 'Say what a Durable Object is',
      target: { kind: 'gap', id: 'do' },
      kind: 'material',
      state: 'open',
      replies: []
    }
  ]
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

const openMap = async () => {
  win = parseHTML('<html><body><div id="app"></div></body></html>')
  vi.stubGlobal('document', win.document)
  vi.stubGlobal('window', win)
  vi.stubGlobal('addEventListener', win.addEventListener)
  vi.stubGlobal('location', new URL('http://localhost:4820/'))
  vi.stubGlobal('history', { replaceState: () => {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('FormData', FormShim)
  Object.defineProperty(win.HTMLTextAreaElement.prototype, 'select', {
    value: () => {},
    configurable: true
  })
  const hooks = { close: vi.fn(), openKeys: vi.fn(), error: vi.fn() }
  const map = new MapCanvas(win.document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async () => snapshot())
  vi.mocked(mapApi.view).mockImplementation(async () => view())
  vi.mocked(mapApi.comments).mockImplementation(async () => ({
    comments: []
  }))
  await map.open('map')
  return { map, hooks, root: map.root }
}
const fire = (target: EventTarget, type: string) =>
  target.dispatchEvent(new win.Event(type, { bubbles: true, cancelable: true }))
const click = (target: Element | null) => (target as HTMLElement).click()
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
/** The engine holds the note until released. */
const held = () => {
  let release = () => {}
  vi.mocked(mapApi.note).mockImplementation(
    () => new Promise((resolve) => (release = () => resolve({} as never)))
  )
  return () => release()
}
const noteForm = (root: HTMLElement) =>
  root.querySelector<HTMLFormElement>('[data-map-form="flow-note"]')!
const addButton = (root: HTMLElement) =>
  noteForm(root).querySelector<HTMLButtonElement>('button[type="submit"]')!

describe('a note added on the canvas is sent once (round 3’s audit)', () => {
  it('sends Add → Note once when Add is pressed twice, its Add off while it saves', async () => {
    const { map, root } = await openMap()
    const release = held()
    click(root.querySelector('[data-map="add"]'))
    click(root.querySelector('[data-map="flow-note"]'))
    noteForm(root).querySelector('textarea')!.value = 'An idea worth a card'
    fire(noteForm(root), 'submit')
    fire(noteForm(root), 'submit')
    await settle()
    expect(addButton(root).disabled).toBe(true)
    release()
    await settle()
    expect(vi.mocked(mapApi.note).mock.calls).toEqual([
      ['map', 'An idea worth a card', undefined]
    ])
    expect(map.noteAsk).toBeNull()
  })

  it('sends a gap’s note once, and keeps words typed while it saved, with Add on again', async () => {
    const { map, root } = await openMap()
    const release = held()
    map.select({ t: 'gap', id: 'do' })
    click(root.querySelector('[data-map="gap-note:do"]'))
    const area = noteForm(root).querySelector('textarea')!
    area.value = 'A Durable Object is one instance with its own storage'
    fire(noteForm(root), 'submit')
    fire(noteForm(root), 'submit')
    area.value = 'And one more thought'
    release()
    await settle()
    expect(vi.mocked(mapApi.note).mock.calls).toEqual([
      ['map', 'A Durable Object is one instance with its own storage', 'do']
    ])
    expect(map.noteAsk).toEqual({ text: 'And one more thought', gap: 'do' })
    expect(noteForm(root).querySelector('textarea')!.value).toBe(
      'And one more thought'
    )
    expect(addButton(root).disabled).toBe(false)
  })

  it('makes a comment one note when its button is pressed twice, its buttons off meanwhile', async () => {
    const { root } = await openMap()
    const release = held()
    click(root.querySelector('[data-pin="k1"]'))
    click(root.querySelector('[data-comment="note:k1"]'))
    expect(
      root.querySelector<HTMLButtonElement>('[data-comment="note:k1"]')
        ?.disabled
    ).toBe(true)
    click(root.querySelector('[data-comment="note:k1"]'))
    release()
    await settle()
    expect(vi.mocked(mapApi.note).mock.calls).toEqual([
      ['map', 'Say what a Durable Object is', 'do']
    ])
    const resolves = vi
      .mocked(mapApi.comments)
      .mock.calls.filter((call) => call[1]?.action === 'resolve')
    expect(resolves).toHaveLength(1)
  })
})
