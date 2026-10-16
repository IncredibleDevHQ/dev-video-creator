import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { AiCursor } from '../app/map-ai'
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
    comments: vi.fn(async () => ({ comments: [] }))
  }
}))
vi.mock('../app/map-ai-tools', async (importOriginal) => {
  const real = await importOriginal<typeof import('../app/map-ai-tools')>()
  return { ...real, runAiTool: vi.fn(real.runAiTool) }
})
const { parseHTML } = await import('linkedom')
const { api } = await import('../app/api')
const { mapApi } = await import('../app/map-api')
const { runAiTool } = await import('../app/map-ai-tools')
const { Aliases } = await import('../app/map-ai-canvas')
const { MapCanvas } = await import('../app/map-canvas')
const { addChoices, showAdd } = await import('../app/map-flow-input')
const { TALK_TIP } = await import('../app/map-view')
// The browser's media and sockets and the model are stand-ins: these checks
// prove what the map does with them, not what a microphone or Studio AI does.

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
const texts = (nodes: Iterable<Element>) =>
  [...nodes].map((node) => node.textContent)
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
const rect = (x: number, y: number, w: number, h: number) =>
  ({ left: x, top: y, width: w, height: h, right: x + w }) as DOMRect
const later = () => {
  let pass = () => {}
  const wait = new Promise<void>((resolve) => (pass = resolve))
  return { wait, pass: () => pass() }
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
/** A call's socket opens and the engine says Studio AI is ready. */
const ready = async (index: number) => {
  const socket = FakeSocket.made[index]
  socket.open()
  socket.say({ type: 'ready', jev: false })
  await settle()
  return socket
}
const fakeCursor = (type: () => Promise<void> = async () => {}) =>
  ({
    doing: vi.fn(),
    glide: vi.fn(async () => {}),
    glideTo: vi.fn(async () => {}),
    press: vi.fn(async () => {}),
    type: vi.fn(type),
    typed: vi.fn(),
    mark: vi.fn(),
    screenOf: () => ({ x: 0, y: 0 })
  }) as unknown as AiCursor & { type: Mock }
/** One of Studio AI's tools, run while `live` says its call goes on. */
const tool = (
  map: Canvas,
  name: string,
  args: Record<string, unknown>,
  live = () => true,
  cursor = fakeCursor()
) => runAiTool(map, cursor, new Aliases(), name, args, live)

describe('the map as it closes (CV-1)', () => {
  it('stops a comment being recorded, frees the microphone, even one still opening, and pauses a comment playing', async () => {
    const { asks } = media()
    const { map, root } = await openMap()
    reply(root)
    click(root.querySelector('[data-comment^="play:"]'))
    asks[0].grant()
    await settle()
    expect(root.querySelector('.map-recording')).not.toBeNull()
    map.close()
    expect(FakeRecorder.made[0].stop).toHaveBeenCalled()
    expect(asks[0].stop).toHaveBeenCalled()
    expect(FakeSound.made[0].pause).toHaveBeenCalled()
    await minuteOn()
    expect(fetch).not.toHaveBeenCalled()
    // Closed while the microphone opens: it is freed once it does.
    await map.open('map')
    reply(root)
    map.close()
    asks[1].grant()
    await settle()
    expect(asks[1].stop).toHaveBeenCalled()
  })
})

describe('a comment recording (CV-4)', () => {
  it('opens one microphone for two presses, and stops when its thread closes, posting nothing', async () => {
    const { asks } = media()
    const { root } = await openMap()
    reply(root)
    press(root, '[data-comment-mic="reply"]')
    expect(asks).toHaveLength(1)
    asks[0].grant()
    await settle()
    expect(FakeRecorder.made).toHaveLength(1)
    click(root.querySelector('[data-comment="close"]'))
    expect(asks[0].stop).toHaveBeenCalled()
    await minuteOn()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('goes on only in the thread that started it once the microphone opens', async () => {
    const { asks } = media()
    const { root } = await openMap()
    reply(root)
    click(root.querySelector('[data-pin="k2"]'))
    asks[0].grant()
    await settle()
    expect(asks[0].stop).toHaveBeenCalled()
    expect(root.querySelector('.map-recording')).toBeNull()
  })

  it('stops when its thread is resolved mid-reply', async () => {
    const { asks } = media()
    const { root } = await openMap()
    reply(root)
    asks[0].grant()
    await settle()
    click(root.querySelector('[data-comment="resolve:k1"]'))
    expect(asks[0].stop).toHaveBeenCalled()
    expect(root.querySelector('.map-recording')).toBeNull()
  })

  it('stops when its composer goes, as the comment tool is put away', async () => {
    const { asks } = media()
    const { map, root } = await openMap()
    click(root.querySelector('[data-comment="tool"]'))
    fire(map.canvas!, 'pointerdown', { button: 0, clientX: 40, clientY: 40 })
    press(root, '[data-comment-mic="new"]')
    asks[0].grant()
    await settle()
    expect(root.querySelector('.map-recording')).not.toBeNull()
    click(root.querySelector('[data-comment="tool"]'))
    expect(asks[0].stop).toHaveBeenCalled()
    expect(root.querySelector('.map-recording')).toBeNull()
  })
})

describe('a call with Studio AI (CV-3, CV-7, CV-9)', () => {
  it('stops a microphone that opens after its call ended, so the next call hears one (CV-3)', async () => {
    const { asks } = media()
    const { map } = await openMap()
    map.voice.start()
    await ready(0)
    // End, then Talk, while the browser still asks for the microphone.
    map.voice.stop()
    map.voice.start()
    const second = await ready(1)
    asks[0].grant()
    asks[1].grant()
    await settle()
    expect(asks[0].stop).toHaveBeenCalled()
    expect(asks[1].stop).not.toHaveBeenCalled()
    const pcm = new ArrayBuffer(8)
    for (const node of FakeTap.made)
      node.port.onmessage?.({ data: { pcm, level: 0.2 } })
    expect(second.sent.filter((data) => data === pcm)).toHaveLength(1)
    map.voice.stop()
    expect(asks[1].stop).toHaveBeenCalled()
  })

  it('hears the microphone of a call after one that had none (CV-9)', async () => {
    const { asks } = media()
    const { map, root } = await openMap()
    const state = () => root.querySelector('.map-call-state')?.textContent
    map.voice.start()
    await ready(0)
    asks[0].refuse()
    await settle()
    expect(state()).toBe('Microphone off · type instead')
    map.voice.stop()
    map.voice.start()
    expect(state()).toBe('Joining…')
    await ready(1)
    asks[1].grant()
    await settle()
    expect(state()).toBe('Listening')
  })

  it('drops words queued for a call that failed; a call that joins sends its own once (CV-9)', async () => {
    const { asks } = media()
    const { map } = await openMap()
    map.voice.say('About my comment on Ep 2: the intro drags')
    FakeSocket.made[0].onclose?.()
    map.voice.start()
    const next = await ready(1)
    asks[0].grant()
    await settle()
    expect(next.told('say')).toEqual([])
    map.voice.stop()
    map.voice.say('Shorten Ep 2')
    const joined = await ready(2)
    asks[1].grant()
    await settle()
    expect(joined.told('say')).toEqual([{ type: 'say', text: 'Shorten Ep 2' }])
  })

  it('runs no tool queued by a call that ended, and tells the next call nothing (CV-7)', async () => {
    const { asks } = media()
    const { map } = await openMap()
    const look = later()
    vi.mocked(runAiTool).mockImplementationOnce(async () => {
      await look.wait
      return { ok: true, did: 'Pointing at the series' }
    })
    map.voice.start()
    const first = await ready(0)
    asks[0].grant()
    await settle()
    first.say({ type: 'tool', call: 'c1', name: 'look', args: {} })
    first.say({ type: 'tool', call: 'c2', name: 'add_note', args: {} })
    await settle()
    map.voice.stop()
    map.voice.start()
    const second = await ready(1)
    asks[1].grant()
    await settle()
    look.pass()
    await settle()
    expect(runAiTool).toHaveBeenCalledOnce()
    expect(first.told('tool_result')).toEqual([])
    expect(second.told('tool_result')).toEqual([])
  })

  it('makes no request for a tool whose call ended while its cursor moved (CV-7)', async () => {
    const { map } = await openMap()
    const typing = later()
    const cursor = fakeCursor(() => typing.wait)
    let live = true
    const args = { text: 'More on costs' }
    const running = tool(map, 'add_note', args, () => live, cursor)
    await settle()
    expect(cursor.type).toHaveBeenCalledOnce()
    live = false
    typing.pass()
    expect(await running).toEqual({ ok: false, error: 'The call ended' })
    expect(mapApi.note).not.toHaveBeenCalled()
    // In a call still going, the same tool adds the note.
    await tool(map, 'add_note', args)
    expect(mapApi.note).toHaveBeenCalledWith('map', 'More on costs', undefined)
  })

  it('makes no second request for a tool whose call ended during its first (CV-7)', async () => {
    const { map } = await openMap({ ...view(), series: null })
    const start = later()
    vi.mocked(mapApi.startSeries).mockImplementationOnce(async () => {
      await start.wait
      return { id: 's' } as Awaited<ReturnType<typeof mapApi.startSeries>>
    })
    let live = true
    const running = tool(map, 'plan_series', {}, () => live)
    await settle()
    expect(mapApi.startSeries).toHaveBeenCalledOnce()
    live = false
    start.pass()
    await running
    expect(mapApi.planSeries).not.toHaveBeenCalled()
  })
})

describe('Studio AI without a key (UX-7)', () => {
  const noKey = (index: number) => {
    FakeSocket.made[index].open()
    FakeSocket.made[index].say({
      type: 'error',
      code: 'no-key',
      message: 'Studio AI needs an OpenAI key'
    })
  }

  it('opens a popover beside Talk that leads to Settings, and keeps Talk ready to set up', async () => {
    media()
    const { map, root, hooks } = await openMap()
    const talk = root.querySelector<HTMLButtonElement>('[data-voice="talk"]')!
    click(talk)
    noKey(0)
    const menu = map.slot('menu')!
    expect([menu.hidden, menu.className]).toEqual([false, 'map-menu is-setup'])
    expect(texts(menu.querySelectorAll('[role="dialog"] *'))).toEqual([
      'Studio AI needs an OpenAI key',
      'Add a key in Settings',
      'Try connecting again'
    ])
    expect(menu.querySelector('.primary')?.getAttribute('data-map')).toBe(
      'keys'
    )
    expect(talk.disabled).toBe(false)
    expect(talk.classList.contains('is-setup')).toBe(true)
    expect(talk.title).toBe('Studio AI needs an OpenAI key · click to set up')
    // Talk again asks for the key, and dials nothing.
    click(talk)
    expect([menu.hidden, FakeSocket.made.length]).toEqual([false, 1])
    click(menu.querySelector('[data-map="keys"]'))
    await settle()
    expect(hooks.openKeys).toHaveBeenCalledOnce()
  })

  it('tries again from the popover, and a reopened map asks for the key afresh', async () => {
    media()
    const { map, root } = await openMap()
    click(root.querySelector('[data-voice="talk"]'))
    noKey(0)
    click(root.querySelector('[data-voice="check-key"]'))
    expect(FakeSocket.made).toHaveLength(2)
    noKey(1)
    await map.open('map')
    const talk = root.querySelector<HTMLButtonElement>('[data-voice="talk"]')!
    expect(talk.classList.contains('is-setup')).toBe(false)
    expect(talk.title).toBe(TALK_TIP)
    click(talk)
    expect(FakeSocket.made).toHaveLength(3)
  })
})

describe('keys on the map (CV-2, CV-8, CV-11, UX-13, UX-14)', () => {
  const at = { clientX: 0, clientY: 0 }

  it('lets an Add-menu key pick its choice and set off nothing else (CV-2)', async () => {
    media()
    const { map, root } = await openMap()
    showAdd(map, at, { x: 0, y: 0 }, [
      ['teaser:e1', 'Teaser', 'A short cut for X, 9:16', 'T'],
      ['posts:e1', 'Posts', 'Words for X, LinkedIn and YouTube', 'P']
    ])
    fire(root.querySelector('.map-add button')!, 'keydown', { key: 't' })
    await settle()
    expect(mapApi.teaser).toHaveBeenCalledWith('e1')
    expect(FakeSocket.made).toHaveLength(0)
    showAdd(map, at, { x: 0, y: 0 }, addChoices(map))
    fire(root.querySelector('.map-add button')!, 'keydown', { key: 'n' })
    expect(map.noteAsk).toEqual({ text: '' })
    const page = root.querySelector('.map-page')!
    expect(page.classList.contains('is-notes-open')).toBe(false)
  })

  it('selects a direction with Enter, so its Edit and Remove can be reached (CV-8)', async () => {
    const { map, root } = await openMap()
    fire(map.els.get('d:d1')!, 'keydown', { key: 'Enter' })
    expect(map.sel).toEqual({ t: 'direction', id: 'd1' })
    const bar = root.querySelector('[data-map-slot="bar"]')!
    expect(texts(bar.querySelectorAll('button'))).toEqual(['Edit', 'Remove'])
  })

  it('does not zoom out to everything when a direction is double-clicked (CV-8)', async () => {
    const { map, document } = await openMap()
    const note = map.els.get('d:d1')!
    document.elementFromPoint = () => note.querySelector('p')
    const fit = vi.spyOn(map, 'fit')
    fire(map.canvas!, 'dblclick', { clientX: 10, clientY: 10 })
    expect(fit.mock.calls.some((call) => call[0] === undefined)).toBe(false)
  })

  it('moves through the Add menu with the arrow keys its footer promises (CV-11)', async () => {
    const { map, root, document } = await openMap()
    let focused: Element | null = null
    patch(document, 'activeElement', undefined)
    Object.defineProperty(document, 'activeElement', { get: () => focused })
    patch(win.HTMLElement.prototype, 'focus', function (this: Element) {
      focused = this
    })
    click(root.querySelector('[data-map="add"]'))
    const name = () => focused?.querySelector('b')?.textContent
    expect(name()).toBe('Direction')
    for (const [key, next] of [
      ['ArrowDown', 'Note'],
      ['ArrowDown', 'Episode'],
      ['ArrowDown', 'Direction'],
      ['ArrowUp', 'Episode']
    ]) {
      fire(focused!, 'keydown', { key })
      expect(name()).toBe(next)
    }
    expect(map.slot('menu')?.hidden).toBe(false)
  })

  it('closes the notes with Esc (UX-13)', async () => {
    const { root, document } = await openMap()
    const page = root.querySelector('.map-page')!
    click(root.querySelector('.map-notes-toggle'))
    expect(page.classList.contains('is-notes-open')).toBe(true)
    fire(document.body, 'keydown', { key: 'Escape' })
    expect(page.classList.contains('is-notes-open')).toBe(false)
  })

  it('closes only what is open over the notes with one Esc: a menu, or a popover (UX-13)', async () => {
    const { map, root, document } = await openMap()
    const notes = root.querySelector('.map-page')!.classList
    click(root.querySelector('.map-notes-toggle'))
    const viewButton = root.querySelector('[data-map="view-menu"]')!
    click(viewButton)
    fire(viewButton, 'keydown', { key: 'Escape' })
    const afterMenu = [
      map.slot('menu')?.hidden,
      notes.contains('is-notes-open')
    ]
    if (!notes.contains('is-notes-open'))
      click(root.querySelector('.map-notes-toggle'))
    click(root.querySelector('[data-map="length"]'))
    const popover = document.querySelector('.length-popover')!
    fire(popover.querySelector('input') || popover, 'keydown', {
      key: 'Escape'
    })
    const afterPopover = [
      Boolean(document.querySelector('.length-popover')),
      notes.contains('is-notes-open')
    ]
    expect({ afterMenu, afterPopover }).toEqual({
      afterMenu: [true, true],
      afterPopover: [false, true]
    })
  })

  it('opens the Add menu beside its + button, inside the canvas (UX-14)', async () => {
    const { map, root } = await openMap()
    const add = root.querySelector('[data-map="add"]')!
    root.querySelector('.map-stage')!.getBoundingClientRect = () =>
      rect(100, 60, 1200, 800)
    add.getBoundingClientRect = () => rect(112, 420, 36, 36)
    click(add)
    const menu = map.slot('menu')!
    expect([menu.style.left, menu.style.top]).toEqual(['56px', '360px'])
    add.getBoundingClientRect = () => rect(112, 820, 36, 36)
    // The same + again closes it; the next opens it where + is now.
    click(add)
    expect(menu.hidden).toBe(true)
    click(add)
    expect(menu.style.top).toBe('540px')
  })
})

describe('a new direction (CV-11)', () => {
  const draft = async (root: HTMLElement) => {
    click(root.querySelector('[data-map="add"]'))
    click(root.querySelector('[data-map="flow-direction"]'))
    await settle()
    return root.querySelector<HTMLFormElement>('[data-map-form="direction"]')!
  }

  it('is a draft until it says something: Cancel, or Save with nothing, keeps nothing', async () => {
    const { map, root } = await openMap()
    const form = await draft(root)
    expect(form.querySelector('textarea')?.value).toBe('')
    click(form.querySelector('[data-map="direction-cancel"]'))
    await settle()
    expect(map.els.has('d:__draft__')).toBe(false)
    fire(await draft(root), 'submit')
    await settle()
    expect(map.els.has('d:__draft__')).toBe(false)
    expect(mapApi.direction).not.toHaveBeenCalled()
    expect(mapApi.removeDirection).not.toHaveBeenCalled()
  })

  it('is saved once, where it was placed, when it says something', async () => {
    const { map, root, hooks } = await openMap()
    const form = await draft(root)
    const spot = map.draftDirection?.spot
    form.querySelector('textarea')!.value = 'Open on the outage'
    fire(form, 'submit')
    await settle()
    expect(mapApi.direction).toHaveBeenCalledOnce()
    expect(mapApi.direction).toHaveBeenCalledWith('s', {
      text: 'Open on the outage',
      spot
    })
    expect(hooks.error).not.toHaveBeenCalled()
  })

  it('is dropped when the map closes', async () => {
    const { map, root } = await openMap()
    await draft(root)
    map.dismiss()
    expect([map.draftDirection, map.editingDirection]).toEqual([null, null])
    await map.open('map')
    expect(root.querySelector('[data-map-form="direction"]')).toBeNull()
    expect(map.view?.series?.directions.map((item) => item.id)).toEqual(['d1'])
    expect(mapApi.direction).not.toHaveBeenCalled()
  })
})

describe('lines and blocks (UX-8, UX-9, UX-12)', () => {
  it('runs each card’s line in the gutter, under the cards, and fades lines the selection is not about (UX-8)', async () => {
    const { map, root } = await openMap()
    map.select({ t: 'page', id: 'a' })
    const layout = map.layout!
    const svg = root.querySelector('[data-map-wires]')!
    const masked = 'g[mask="url(#map-content-mask)"]'
    const uses = [...svg.querySelectorAll(`${masked} path.map-flow.is-use`)]
    expect(uses).toHaveLength(3)
    const [from, to] = [layout.map.x + layout.map.w, layout.series!.x]
    for (const path of uses) {
      const d = path.getAttribute('d')!
      expect(d).not.toContain('C')
      expect(d.startsWith(`M${from},`)).toBe(true)
      expect(d.endsWith(`H${to}`)).toBe(true)
      const turn = Number(/Q([-\d.]+),/.exec(d)?.[1])
      expect(turn).toBeGreaterThan(from)
      expect(turn).toBeLessThan(to)
    }
    expect(svg.querySelectorAll('path.map-flow')).toHaveLength(
      svg.querySelectorAll(`${masked} path.map-flow`).length
    )
    const covered =
      Object.keys(layout.cards).length +
      Object.keys(layout.copies).length +
      layout.segues.length +
      Object.keys(layout.directions).length +
      layout.gaps.length +
      Object.keys(layout.lanes).length +
      Number(Boolean(layout.head))
    expect(
      svg.querySelectorAll('mask#map-content-mask rect[fill="black"]')
    ).toHaveLength(covered)
    expect(svg.classList.contains('has-focus')).toBe(true)
    const lit = uses.map((path) => path.classList.contains('is-lit'))
    expect(lit).toEqual([true, false, false])
  })

  it('keeps the tip of an arrow into a Socials entry, inset as an episode is', async () => {
    const shown = view()
    shown.episodes[0] = {
      ...shown.episodes[0],
      posts: { x: 'A post', linkedin: 'A post', youtube: 'A post' }
    }
    const { map, root } = await openMap(shown)
    const place = map.layout!.derived[0]
    expect(place.episode).toBe('e1')
    const masked = [
      ...root.querySelectorAll(
        '[data-map-wires] mask#map-content-mask rect[fill="black"]'
      )
    ].map((rect) =>
      ['x', 'y', 'width', 'height'].map((name) =>
        Number(rect.getAttribute(name))
      )
    )
    expect(masked).toContainEqual([
      place.x + 3,
      place.y + 3,
      place.w - 6,
      place.h - 6
    ])
    expect(masked).not.toContainEqual([place.x, place.y, place.w, place.h])
  })

  it('moves the camera to a block focused from the keyboard, never to one clicked (UX-9)', async () => {
    const { map } = await openMap()
    const block = map.els.get('B:series')!
    map.canvas!.getBoundingClientRect = () => rect(0, 0, 1200, 800)
    Object.assign(block, { offsetWidth: 600, offsetHeight: 400 })
    map.camera = { x: -5000, y: 0, k: 1 }
    let keyboard = false
    const matches = block.matches.bind(block)
    block.matches = (selector: string) =>
      selector === ':focus-visible' ? keyboard : matches(selector)
    fire(block, 'focusin')
    expect(map.camera.x).toBe(-5000)
    keyboard = true
    fire(block, 'focusin')
    expect(map.camera.x).not.toBe(-5000)
  })

  it('shows each block in the frame its lines are drawn, unless it flies in from a page (UX-12)', async () => {
    const appended: Array<[string, string]> = []
    const { map, root } = await openMap(view(), (canvas) => {
      const world = canvas.world!
      const append = world.appendChild.bind(world)
      world.appendChild = <T extends Node>(node: T) => {
        const { dataset, style } = node as unknown as HTMLElement
        if (dataset?.k) appended.push([dataset.k, style.opacity])
        return append(node)
      }
    })
    expect(appended.length).toBeGreaterThan(8)
    expect(appended.filter(([, opacity]) => opacity === '0')).toEqual([])
    expect(root.querySelector('[data-map-wires] path')).not.toBeNull()
    // A copy made from a page flies in from it, fading in as it comes.
    const next = view()
    next.episodes[1].copies.push(copy('w', 'c'))
    vi.mocked(mapApi.view).mockImplementation(async () => next)
    map.fly['pending:e2'] = { x: 0, y: 0 }
    await map.refresh()
    expect(appended).toContainEqual(['c:w', '0'])
  })
})
