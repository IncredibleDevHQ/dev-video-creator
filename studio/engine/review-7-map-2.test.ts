import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
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
    teaser: vi.fn(async () => ({})),
    direction: vi.fn(async () => ({ directions: [] })),
    removeDirection: vi.fn(async () => ({})),
    startSeries: vi.fn(async () => ({ id: 's' })),
    planSeries: vi.fn(async () => ({})),
    comments: vi.fn(async () => ({ comments: [] })),
    organize: vi.fn(async () => ({}))
  }
}))
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { MapCanvas } = await import('../app/map-canvas')
// Review 7's third look at the map: Esc reaches an open comment, its
// recording or the comment tool first. The browser's media and sockets are
// stand-ins: these checks prove the map's plumbing, not a microphone's.

const slide = (id: string) => ({ id, title: `Page ${id}`, svg: '<svg/>' })
const project = { id: 'map', title: 'Streamline', source: '', video: null }
const snapshot = (): Snapshot => ({
  project: { ...project, slides: ['a', 'b', 'c'].map(slide) },
  status: 'ready',
  error: null,
  events: []
})
type Copies = MapEpisode['copies']
const fresh = { svg: '<svg/>', stale: false, orphan: false }
const copy = (id: string, slide: string): Copies[number] => ({
  ...fresh,
  id,
  title: `Copy of ${slide}`,
  copyOf: { notebook: 'map', slide, hash: 'h' }
})
const idle = { made: false, video: null, teasers: [], posts: null }
const episode = (notebook: string, number: number, copies: Copies) =>
  ({
    ...idle,
    notebook,
    number,
    title: `Episode ${number}`,
    status: 'ready',
    copies
  }) as MapEpisode
const plain = { lines: [], gaps: [], flags: [], left: [], held: [] }
const view = (): MapView => ({
  notebook: 'map',
  title: 'Streamline',
  series: {
    ...plain,
    id: 's',
    title: 'Streamline',
    organize: true,
    directions: [{ id: 'd1', text: 'Lead with the problem', at: 'now' }]
  },
  episodes: [
    episode('e1', 1, [copy('x', 'a'), copy('y', 'b')]),
    episode('e2', 2, [copy('z', 'b')])
  ],
  usage: { a: ['e1'], b: ['e1', 'e2'] },
  comments: ['k1', 'k2'].map((id, index) => ({
    id,
    at: new Date().toISOString(),
    by: 'creator' as const,
    text: index ? 'Keep it short' : 'The intro drags',
    target: index
      ? { kind: 'series' as const }
      : { kind: 'lane' as const, id: 'e2' },
    state: 'open' as const,
    ...(index ? {} : { audio: { objectKey: 'map/k1.webm', seconds: 4 } }),
    replies: []
  }))
})

class FakeAudio {
  state = 'running'
  currentTime = 0
  destination = {}
  stream: unknown = null
  audioWorklet = { addModule: async () => {} }
  close = vi.fn(async () => {})
  resume = async () => {}
  createAnalyser = () => ({ connect() {}, getByteTimeDomainData() {} })
  createGain = () => ({ gain: { value: 1 }, connect: (next: unknown) => next })
  createMediaStreamSource(stream: unknown) {
    this.stream = stream
    return { connect() {}, disconnect() {} }
  }
}
class FakeTap {
  static made: FakeTap[] = []
  port = { onmessage: null as ((event: { data: unknown }) => void) | null }
  constructor(readonly context: FakeAudio) {
    FakeTap.made.push(this)
  }
  connect = (next: unknown) => next
  disconnect() {}
}
class FakeRecorder {
  static made: FakeRecorder[] = []
  static isTypeSupported = () => true
  state = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor() {
    FakeRecorder.made.push(this)
  }
  start = () => (this.state = 'recording')
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)]) })
    this.onstop?.()
  })
}
class FakeSound {
  static made: FakeSound[] = []
  pause = vi.fn()
  play = async () => {}
  constructor() {
    FakeSound.made.push(this)
  }
}
class FakeSocket {
  static OPEN = 1
  static made: FakeSocket[] = []
  readyState = 0
  sent: unknown[] = []
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onclose?: () => void
  constructor() {
    FakeSocket.made.push(this)
  }
  send = (data: unknown) => this.sent.push(data)
  close = () => (this.readyState = 3)
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  say = (message: object) => this.onmessage?.({ data: JSON.stringify(message) })
  told = (type: string) =>
    this.sent
      .filter((data): data is string => typeof data === 'string')
      .map((data) => JSON.parse(data) as { type: string; text?: string })
      .filter((message) => message.type === type)
}
/** A form's fields, read the way FormData reads a real one. */
class FormShim {
  constructor(private readonly form: HTMLFormElement) {}
  get = (name: string) =>
    this.form.querySelector(`[name="${name}"]`)?.textContent ?? null
}

let win = parseHTML('')
let frames: FrameRequestCallback[] = []
const maps: Canvas[] = []
const undo: Array<() => void> = []
const patch = (target: object, key: string, value: unknown) => {
  const own = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, { value, configurable: true })
  undo.push(() =>
    own
      ? Object.defineProperty(target, key, own)
      : delete (target as Record<string, unknown>)[key]
  )
}
afterEach(() => {
  for (const map of maps.splice(0)) map.dismiss()
  for (const step of undo.splice(0).reverse()) step()
  frames = []
  vi.unstubAllGlobals()
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

const dom = () => {
  win = parseHTML('<html><body><div id="app"></div></body></html>')
  vi.stubGlobal('document', win.document)
  vi.stubGlobal('window', win)
  vi.stubGlobal('addEventListener', win.addEventListener)
  vi.stubGlobal('location', new URL('http://localhost:4194/'))
  vi.stubGlobal('history', { replaceState: () => {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  vi.stubGlobal('requestAnimationFrame', (run: never) => frames.push(run))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('FormData', FormShim)
  // linkedom's textarea has no select(); the browser's does.
  patch(win.HTMLTextAreaElement.prototype, 'select', () => {})
  return win
}
const openMap = async (shown = view(), hold?: (map: Canvas) => void) => {
  const { document } = dom()
  let held = false
  const hooks = { close: vi.fn(), openKeys: vi.fn(), error: vi.fn() }
  const map = new MapCanvas(document.getElementById('app')!, hooks as never)
  maps.push(map)
  vi.mocked(api.load).mockImplementation(async () => {
    if (!held) hold?.(map)
    held = true
    return snapshot()
  })
  vi.mocked(mapApi.view).mockImplementation(async () => structuredClone(shown))
  await map.open('map')
  return { map, hooks, root: map.root, document }
}
const fire = (target: EventTarget, type: string, extra: object = {}) => {
  const event = new win.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, extra)
  target.dispatchEvent(event)
}
const click = (target: Element | null) => (target as HTMLElement).click()
const press = (root: Element, selector: string) =>
  fire(root.querySelector(selector)!, 'pointerdown', { button: 0 })
/** Opens the first comment's thread and holds its reply's microphone. */
const reply = (root: Element) => {
  click(root.querySelector('[data-pin="k1"]'))
  press(root, '[data-comment-mic="reply"]')
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
/** A minute on: past the longest comment, which would post itself. */
const minuteOn = async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000)
  for (const run of frames.splice(0)) run(0)
  await settle()
}
/** The browser's media and sockets; each microphone asked for waits. */
const media = () => {
  const asks: Array<{ stop: Mock; grant: () => void; refuse: () => void }> = []
  const getUserMedia = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        const stop = vi.fn()
        const stream = { getTracks: () => [{ stop }] }
        asks.push({
          stop,
          grant: () => resolve(stream),
          refuse: () => reject(new Error('Permission denied'))
        })
      })
  )
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  vi.stubGlobal('AudioContext', FakeAudio)
  vi.stubGlobal('AudioWorkletNode', FakeTap)
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.stubGlobal('Audio', FakeSound)
  vi.stubGlobal('WebSocket', FakeSocket)
  for (const fake of [FakeTap, FakeRecorder, FakeSound, FakeSocket])
    fake.made = []
  return { asks }
}
describe('Esc and the comments (UX-13)', () => {
  it('closes an open comment thread, then puts the comment tool away, before anything of the map', async () => {
    const { map, root, document } = await openMap()
    click(root.querySelector('[data-pin="k1"]'))
    expect(map.comments.thread).toBe('k1')
    map.select({ t: 'lane', id: 'e1' })
    fire(document.body, 'keydown', { key: 'Escape' })
    // The thread goes; the selection under it stays for the next Esc.
    expect([map.comments.thread, map.sel?.t]).toEqual([null, 'lane'])
    click(root.querySelector('[data-comment="tool"]'))
    expect(map.comments.tool).toBe(true)
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(map.comments.tool).toBe(false)
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(map.sel).toBeNull()
  })

  it('cancels a comment being recorded with Esc, and nothing posts itself later', async () => {
    const { asks } = media()
    const { root, document } = await openMap()
    reply(root)
    asks[0].grant()
    await settle()
    expect(root.querySelector('.map-recording')).not.toBeNull()
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(asks[0].stop).toHaveBeenCalled()
    expect(root.querySelector('.map-recording')).toBeNull()
    await minuteOn()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('closes a menu open over a comment first, then the comment', async () => {
    const { map, root, document } = await openMap()
    click(root.querySelector('[data-pin="k1"]'))
    click(root.querySelector('[data-map="map-more"]'))
    expect(map.slot('menu')?.hidden).toBe(false)
    fire(document.body, 'keydown', { key: 'Escape' })
    expect([map.slot('menu')?.hidden, map.comments.thread]).toEqual([
      true,
      'k1'
    ])
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(map.comments.thread).toBeNull()
  })

  it('lets words being typed in a comment leave their field before the comment goes', async () => {
    const { map, root } = await openMap()
    click(root.querySelector('[data-comment="tool"]'))
    fire(map.canvas!, 'pointerdown', { button: 0, clientX: 40, clientY: 40 })
    const field = root.querySelector<HTMLInputElement>(
      '[data-comment-form="new"] input[name="text"]'
    )!
    field.value = 'The intro drags'
    field.focus()
    fire(field, 'keydown', { key: 'Escape' })
    // Still there, with its words; the next Esc closes it.
    expect(map.comments.composer).not.toBeNull()
    expect(field.value).toBe('The intro drags')
    fire(root.ownerDocument.body, 'keydown', { key: 'Escape' })
    expect(map.comments.composer).toBeNull()
  })

  it('closes a menu open over a recording first, and the take goes on', async () => {
    const { asks } = media()
    const { map, root, document } = await openMap()
    reply(root)
    asks[0].grant()
    await settle()
    click(root.querySelector('[data-map="map-more"]'))
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(map.slot('menu')?.hidden).toBe(true)
    expect(asks[0].stop).not.toHaveBeenCalled()
    expect(root.querySelector('.map-recording')).not.toBeNull()
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(asks[0].stop).toHaveBeenCalled()
  })

  it('closes the queue’s list with Esc before what is selected', async () => {
    const { map, document } = await openMap()
    map.select({ t: 'lane', id: 'e1' })
    map.queueOpen = true
    fire(document.body, 'keydown', { key: 'Escape' })
    expect([map.queueOpen, map.sel?.t]).toEqual([false, 'lane'])
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(map.sel).toBeNull()
  })

  it('lets go of the microphone when a recorder that stopped by itself is cancelled', async () => {
    const { asks } = media()
    const { root, document } = await openMap()
    reply(root)
    asks[0].grant()
    await settle()
    // The browser stopped it (the device went away): stopping an inactive
    // recorder does nothing, and no stop event comes, as in the browser.
    const recorder = FakeRecorder.made[0]
    recorder.state = 'inactive'
    recorder.stop = vi.fn(() => {})
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(asks[0].stop).toHaveBeenCalled()
  })
})

describe('the map’s set-up popover and the note form (review 7)', () => {
  it('opens a menu at the first click after Studio AI’s set-up popover', async () => {
    const { map, root } = await openMap()
    const more = root.querySelector('[data-map="map-more"]')!
    click(more)
    click(more)
    const voice = map.voice as unknown as { needsKey: boolean }
    voice.needsKey = true
    map.voice.start()
    expect(map.slot('menu')?.className).toContain('is-setup')
    click(more)
    expect(map.slot('menu')?.hidden).toBe(false)
    expect(map.slot('menu')?.className).toContain('is-more')
  })

  it('keeps a refused note’s words in its form', async () => {
    const { map, root } = await openMap()
    vi.mocked(mapApi.note).mockRejectedValueOnce(new Error('Refused'))
    map.noteAsk = { text: '' }
    map.paint()
    const form = root.querySelector<HTMLFormElement>(
      '[data-map-form="flow-note"]'
    )!
    form.querySelector('textarea')!.textContent = 'An idea worth a card'
    fire(form, 'submit')
    await settle()
    expect(map.noteAsk).toMatchObject({ text: 'An idea worth a card' })
    expect(
      root.querySelector('[data-map-form="flow-note"] textarea')?.textContent
    ).toBe('An idea worth a card')
  })
})

describe('lines and questions on the map (UX-8, UX-13)', () => {
  it('draws a selected card’s lines from the Cards frame, down the gutter, into each episode’s frame', async () => {
    const { map, root } = await openMap()
    map.select({ t: 'page', id: 'b' })
    const layout = map.layout!
    const wires = [...root.querySelectorAll('path.map-wire.is-on')]
    expect(wires).toHaveLength(2)
    const turn = layout.series!.x - 40
    for (const wire of wires) {
      const d = wire.getAttribute('d')!
      expect(d.startsWith(`M${layout.map.x + layout.map.w},`)).toBe(true)
      expect(Number(/Q([-\d.]+),/.exec(d)?.[1])).toBe(turn)
      const end = Number(/H([-\d.]+)$/.exec(d)?.[1])
      expect(Object.values(layout.lanes).some((lane) => lane.x === end)).toBe(
        true
      )
    }
  })

  it('closes the note question with Esc before what is selected', async () => {
    const { map, document } = await openMap()
    map.select({ t: 'lane', id: 'e1' })
    map.noteAsk = { text: '' }
    map.paint()
    fire(document.body, 'keydown', { key: 'Escape' })
    expect([map.noteAsk, map.sel?.t]).toEqual([null, 'lane'])
  })

  it('keeps a refused note on its own map, never the next one opened', async () => {
    const { map, root } = await openMap()
    let refuse = (_: Error) => {}
    vi.mocked(mapApi.note).mockImplementationOnce(
      () => new Promise((_, reject) => (refuse = reject))
    )
    map.noteAsk = { text: '' }
    map.paint()
    const form = root.querySelector<HTMLFormElement>(
      '[data-map-form="flow-note"]'
    )!
    form.querySelector('textarea')!.textContent = 'For the first map'
    fire(form, 'submit')
    map.mapId = 'another-map'
    refuse(new Error('Refused'))
    await settle()
    expect(map.noteAsk).toBeNull()
  })
})

describe('questions, directions and organising on the map (review 7)', () => {
  it('closes a question in the bar with Esc, or its Cancel, and leaves a direction being written open', async () => {
    const { map, root, document } = await openMap()
    map.editingDirection = 'd1'
    map.noteAsk = { text: '' }
    map.paint()
    fire(document.body, 'keydown', { key: 'Escape' })
    expect([map.noteAsk, map.editingDirection]).toEqual([null, 'd1'])
    map.renaming = { kind: 'series', title: 'Streamline' } as never
    map.paint()
    click(root.querySelector('[data-map-form="rename"] [data-map="cancel"]'))
    await settle()
    expect([map.renaming, map.editingDirection]).toEqual([null, 'd1'])
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(map.editingDirection).toBeNull()
  })

  it('leaves no half-asked question for the next map', async () => {
    const { map } = await openMap()
    map.renaming = { kind: 'series', title: 'Streamline' } as never
    map.askingPlan = true
    await map.open('map')
    expect([map.renaming, map.askingPlan]).toEqual([null, false])
  })

  it('says when organising stopped, once, with the way to organise again', async () => {
    const shown = view()
    shown.series!.organizing = {
      state: 'failed',
      error: 'An episode left the series meanwhile; organise again',
      at: 'then'
    }
    const { map } = await openMap(shown)
    const toast = map.slot('toast')!
    expect(toast.textContent).toContain('Organising stopped: An episode left')
    click(toast.querySelector('[data-map="organize-again"]'))
    await settle()
    expect(mapApi.organize).toHaveBeenCalledWith('s')
    // Said once: a repaint doesn't say it again.
    toast.hidden = true
    map.paint()
    expect(toast.hidden).toBe(true)
  })

  it('selects a gap at any zoom, its three choices in the bar (Jev series run)', async () => {
    const shown = view()
    shown.series!.gaps = [
      {
        id: 'do',
        missing: 'What a Durable Object is',
        episode: 'e2',
        why: 'The orchestrator is one',
        ask: 'What is it?',
        state: 'open'
      }
    ]
    const { map, root } = await openMap(shown)
    const node = root.querySelector('[data-k="g:do"]')!
    fire(node, 'pointerdown', { button: 0, clientX: 10, clientY: 10 })
    fire(node, 'pointerup', { button: 0, clientX: 10, clientY: 10 })
    expect(map.sel).toEqual({ t: 'gap', id: 'do' })
    expect(root.querySelector('[data-k="g:do"]')?.className).toContain(
      'is-selected'
    )
    const bar = map.slot('bar')!
    expect(bar.textContent).toContain('What a Durable Object is')
    expect(
      [...bar.querySelectorAll('button')].map((b) => b.dataset.map)
    ).toEqual(['gap-note:do', 'gap-explain:do', 'gap-ignore:do'])
    click(bar.querySelector('[data-map="gap-note:do"]'))
    await settle()
    expect(map.noteAsk).toEqual({ text: '', gap: 'do' })
  })

  it('keeps an Undo showing when organising news comes, then says the news', async () => {
    const { map } = await openMap()
    vi.useFakeTimers()
    try {
      map.toast('Copy removed', { label: 'Undo', map: 'undo-remove:x' })
      map.view!.series!.organizing = {
        state: 'failed',
        error: 'An episode’s video started; plan again',
        at: 'later'
      }
      map.paint()
      const toast = map.slot('toast')!
      expect(toast.textContent).toContain('Copy removed')
      expect(toast.querySelector('[data-map="undo-remove:x"]')).not.toBeNull()
      vi.advanceTimersByTime(7000)
      expect(toast.hidden).toBe(false)
      expect(toast.textContent).toContain('Organising stopped')
      expect(toast.querySelector('[data-map="organize-again"]')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
