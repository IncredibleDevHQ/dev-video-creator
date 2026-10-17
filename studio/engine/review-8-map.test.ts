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
    note: vi.fn(async () => ({})),
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
const undo: Array<() => void> = []
/** Sets a property for one test; it is put back after. */
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

describe('what the keys reach zoomed out (F12)', () => {
  it('reaches a gap with Tab and Enter, its choices in the bar, as its own buttons go zoomed out', async () => {
    const shown = view()
    shown.series!.gaps = [
      {
        id: 'g1',
        missing: 'How the client sends the key',
        episode: 'e2',
        why: 'The episode needs it',
        ask: 'How does the client send it?',
        state: 'open'
      }
    ]
    const { map, root } = await openMap(shown)
    const gap = root.querySelector<HTMLElement>('[data-k="g:g1"]')!
    // (linkedom reads a tabindex of 0 as -1: the attribute says it.)
    expect(['tabindex', 'role'].map((name) => gap.getAttribute(name))).toEqual([
      '0',
      'button'
    ])
    expect(gap.getAttribute('aria-label')).toBe(
      'Missing: How the client sends the key'
    )
    fire(gap, 'keydown', { key: 'Enter' })
    expect(map.sel).toEqual({ t: 'gap', id: 'g1' })
    const bar = map.slot('bar')!
    expect(
      [...bar.querySelectorAll('button')].map((b) => b.dataset.map)
    ).toEqual(['gap-note:g1', 'gap-explain:g1', 'gap-ignore:g1'])
  })

  it('offers the series’ length and Plan again in its bar, as the series shows only its organising zoomed out', async () => {
    const { map, root } = await openMap()
    map.select({ t: 'series' })
    const bar = map.slot('bar')!
    const acts = () =>
      [...bar.querySelectorAll<HTMLElement>('button')].map((b) => b.dataset.map)
    expect(acts()).toEqual(['length', 'plan-series', 'rename-series'])
    expect(bar.querySelector('[data-map="plan-series"]')?.textContent).toBe(
      'Plan again'
    )
    click(bar.querySelector('[data-map="length"]'))
    expect(win.document.querySelector('.length-popover')).not.toBeNull()
    // Before its first plan, the header asks for it: the bar doesn't.
    vi.mocked(mapApi.view).mockImplementation(async () => view(false))
    await map.refresh()
    expect(acts()).toEqual(['rename-series'])
    expect(
      root.querySelector('[data-k="B:series"] [data-map-organize]')
    ).not.toBeNull()
  })
})

describe('a cut or a copy waiting to be pasted (F13)', () => {
  const three = () => {
    const shown = view()
    shown.episodes.push(episode('e3', 3, []))
    return shown
  }
  const press = async (key: string) => {
    fire(win.document.body, 'keydown', { key, metaKey: true })
    await settle()
  }

  it('keeps a cut an episode refused, says why there, and pastes it into another', async () => {
    const { map } = await openMap(three())
    map.select({ t: 'copy', id: 'y' })
    await press('x')
    const cut = { mode: 'move', copy: 'y', from: 'e1' }
    expect(map.clip).toEqual(cut)
    // Ep 2 has page b already: Paste can't be pressed there, and says why.
    map.select({ t: 'lane', id: 'e2' })
    const bar = map.slot('bar')!
    const paste = bar.querySelector<HTMLButtonElement>('button')!
    expect([paste.textContent, paste.disabled]).toEqual(['Paste', true])
    expect(bar.querySelector('.map-info')?.textContent).toContain(
      'the cut page is here already'
    )
    await press('v')
    expect(mapApi.copies).not.toHaveBeenCalled()
    expect(map.slot('toast')!.textContent).toBe(
      'Ep 2 has that page already: select another episode'
    )
    expect(map.clip).toEqual(cut)
    // Ep 3 can take it: its Paste is there, and the cut lands.
    map.select({ t: 'lane', id: 'e3' })
    expect(bar.querySelector('[data-map="paste"]')?.className).toBe('primary')
    await press('v')
    expect(mapApi.copies).toHaveBeenCalledWith('e1', {
      action: 'move',
      slide: 'y',
      to: 'e3',
      index: undefined
    })
    expect(map.clip).toBeNull()
  })

  it('keeps a cut the engine refused, and a copied page to paste again', async () => {
    const { map, hooks } = await openMap(three())
    vi.mocked(mapApi.copies).mockRejectedValueOnce(
      new Error('That episode already has a copy of this page')
    )
    map.select({ t: 'copy', id: 'y' })
    await press('x')
    map.select({ t: 'lane', id: 'e3' })
    await press('v')
    expect(hooks.error).toHaveBeenCalledOnce()
    expect(map.clip).toEqual({ mode: 'move', copy: 'y', from: 'e1' })
    expect(map.slot('bar')!.querySelector('[data-map="paste"]')).not.toBeNull()
    // A page copied from the map: an episode that has it says so first.
    map.select({ t: 'page', id: 'a' })
    await press('c')
    map.select({ t: 'lane', id: 'e1' })
    await press('v')
    expect(map.slot('toast')!.textContent).toBe(
      'Ep 1 has that page already: select another episode'
    )
    expect(map.clip).toEqual({ mode: 'copy', slide: 'a' })
    expect(mapApi.copies).toHaveBeenCalledTimes(1)
  })
})

describe('what a direction applies to (F14)', () => {
  it('is chosen from its bar, from the keys as from the mouse: the series, an episode, or its cards', async () => {
    const shown = view()
    const { map } = await openMap(shown)
    let focused: Element | null = null
    patch(win.HTMLElement.prototype, 'focus', function (this: Element) {
      focused = this
    })
    map.select({ t: 'direction', id: 'd1' })
    const bar = map.slot('bar')!
    const acts = [...bar.querySelectorAll<HTMLElement>('button')]
    expect(acts.map((b) => b.textContent)).toEqual([
      'Edit',
      'Apply to…',
      'Remove'
    ])
    const menu = map.slot('menu')!
    /** Opens Apply to…; what it offers, the ticked ones marked. */
    const open = async () => {
      click(bar.querySelector('[data-map="menu:apply-to"]'))
      await settle()
      return [...menu.querySelectorAll<HTMLElement>('button')].map(
        (b) =>
          `${b.querySelector('span')!.textContent}${b.querySelector('small') ? ' ✓' : ''}`
      )
    }
    const choose = async (action: string, to: unknown) => {
      click(menu.querySelector(`[data-map="${action}"]`))
      await settle()
      shown.series!.directions[0].to = to as never
      await map.refresh()
    }
    expect(await open()).toEqual([
      'The whole series ✓',
      'Ep 1 · Episode 1',
      'Ep 2 · Episode 2',
      'Card 1 · Page a',
      'Card 2 · Page b',
      'Card 3 · Page c',
      'Card 4 · Page d'
    ])
    expect(menu.hidden).toBe(false)
    // From the keyboard, the choice it has now is where the keys start.
    expect((focused as HTMLElement | null)?.dataset.map).toBe('apply-to:series')
    await choose('apply-to:episode:e2', { episode: 'e2' })
    expect(mapApi.direction).toHaveBeenLastCalledWith('s', {
      id: 'd1',
      to: { episode: 'e2' }
    })
    expect(map.slot('toast')!.textContent).toBe('It guides Ep 2 now')
    expect((focused as HTMLElement | null)?.dataset.map).toBe('menu:apply-to')
    expect(await open()).toContain('Ep 2 · Episode 2 ✓')
    // A card replaces the episode, more cards join it, a ticked one leaves.
    await choose('apply-to:card:a', { pages: ['a'] })
    expect(mapApi.direction).toHaveBeenLastCalledWith('s', {
      id: 'd1',
      to: { pages: ['a'] }
    })
    await open()
    await choose('apply-to:card:c', { pages: ['a', 'c'] })
    expect(map.slot('toast')!.textContent).toBe('It guides cards 1, 3 now')
    await open()
    await choose('apply-to:card:a', { pages: ['c'] })
    expect(mapApi.direction).toHaveBeenLastCalledWith('s', {
      id: 'd1',
      to: { pages: ['c'] }
    })
    await open()
    await choose('apply-to:series', undefined)
    expect(mapApi.direction).toHaveBeenLastCalledWith('s', {
      id: 'd1',
      to: null
    })
    expect(map.slot('toast')!.textContent).toBe(
      'It guides the whole series now'
    )
    // What it has already is not sent again.
    await open()
    await choose('apply-to:series', undefined)
    expect(mapApi.direction).toHaveBeenCalledTimes(5)
  })
})

describe('Undo and Redo for what is done to an episode’s cards (F15)', () => {
  /** The engine's copies, kept in the view the map reads back: a move (a
   * card moved to another episode is a new card there), a removal, and
   * bringing the last removal back. */
  const serve = (shown: MapView) => {
    let made = 0
    const kept: Record<string, { copy: Copies[number]; index: number }> = {}
    const lane = (id: string) => shown.episodes.find((e) => e.notebook === id)!
    vi.mocked(mapApi.copies).mockImplementation(async (episode, body) => {
      const { action, slide, to, index } = body as {
        action: string
        slide: string
        to?: string
        index?: number
      }
      const from = lane(episode)
      const at = from.copies.findIndex((copy) => copy.id === slide)
      if (at < 0) throw new Error('That page is no longer in this episode')
      const [card] = from.copies.splice(at, 1)
      if (action === 'remove') kept[episode] = { copy: card, index: at }
      if (action === 'move') {
        const into = lane(to || episode)
        const place = Math.min(index ?? into.copies.length, into.copies.length)
        into.copies.splice(
          place,
          0,
          into === from ? card : { ...card, id: `m${++made}` }
        )
      }
      return {}
    })
    vi.mocked(api.slide).mockImplementation(async (episode) => {
      const back = kept[episode]
      delete kept[episode]
      lane(episode).copies.splice(back.index, 0, back.copy)
      return snapshot()
    })
    return (id: string) => lane(id).copies.map((copy) => copy.id)
  }
  const press = async (key: string, shiftKey = false) => {
    fire(win.document.body, 'keydown', { key, metaKey: true, shiftKey })
    await settle()
  }
  const toast = (map: Canvas) => {
    const node = map.slot('toast')!
    return [
      node.querySelector('span')?.textContent,
      node.querySelector('button')?.textContent ?? null
    ]
  }

  it('puts a reorder back from its toast’s Undo, and with ⌘Z and ⇧⌘Z, as Shortcuts says', async () => {
    const shown = view()
    const order = serve(shown)
    const { map, root } = await openMap(shown)
    // A card dragged from third to second.
    await map.moveCopy('w', 'e1', 1)
    expect(order('e1')).toEqual(['x', 'w', 'y'])
    expect(toast(map)).toEqual([
      'Moved. The segues around it are being rewritten.',
      'Undo'
    ])
    click(map.slot('toast')!.querySelector('button'))
    await settle()
    expect(order('e1')).toEqual(['x', 'y', 'w'])
    expect(toast(map)).toEqual([
      'Put back. The segues around it are being rewritten.',
      'Redo'
    ])
    await press('z', true)
    expect(order('e1')).toEqual(['x', 'w', 'y'])
    expect(toast(map)[1]).toBe('Undo')
    await press('z')
    expect(order('e1')).toEqual(['x', 'y', 'w'])
    expect(vi.mocked(mapApi.copies).mock.calls.at(-1)).toEqual([
      'e1',
      { action: 'move', slide: 'w', to: 'e1', index: 2 }
    ])
    // Let go where it was, nothing is sent and nothing is offered.
    const sent = vi.mocked(mapApi.copies).mock.calls.length
    await map.moveCopy('w', 'e1', 2)
    expect(mapApi.copies).toHaveBeenCalledTimes(sent)
    click(root.querySelector('[data-map="help"]'))
    await settle()
    expect(map.slot('menu')!.textContent).toContain(
      '⌘Z  ⇧⌘Zundo or redo a card’s move or removal'
    )
  })

  it('undoes the last edit first, a move to another episode and a removal, and nothing after another change', async () => {
    const shown = view()
    const order = serve(shown)
    const { map } = await openMap(shown)
    await map.removeCopy('x')
    await map.moveCopy('w', 'e2', 0)
    expect([order('e1'), order('e2')]).toEqual([['y'], ['m1', 'z']])
    expect(toast(map)).toEqual(['Moved to Ep 2', 'Undo'])
    await press('z')
    expect([order('e1'), order('e2')]).toEqual([['y', 'm2'], ['z']])
    expect(toast(map)[0]).toBe('Back in Ep 1')
    await press('z')
    expect(order('e1')).toEqual(['x', 'y', 'm2'])
    expect(toast(map)).toEqual(['Back in the episode', 'Redo'])
    await press('z')
    expect(toast(map)).toEqual(['Nothing to undo', null])
    // Redo goes forward again in order, the removal first.
    await press('z', true)
    expect(order('e1')).toEqual(['y', 'm2'])
    // Another change to the map ends the history: Undo reaches no further.
    await map.run(async () => {}, 'Episode renamed')
    const sent = vi.mocked(mapApi.copies).mock.calls.length
    await press('z')
    expect(toast(map)).toEqual(['Nothing to undo', null])
    expect(mapApi.copies).toHaveBeenCalledTimes(sent)
  })

  it('says when the card has changed since, rather than undoing something else', async () => {
    const shown = view()
    const order = serve(shown)
    const { map } = await openMap(shown)
    await map.moveCopy('w', 'e1', 0)
    // Removed elsewhere meanwhile (another tab, Studio AI).
    shown.episodes[0].copies = shown.episodes[0].copies.filter(
      (copy) => copy.id !== 'w'
    )
    await map.refresh()
    const sent = vi.mocked(mapApi.copies).mock.calls.length
    await press('z')
    expect(toast(map)[0]).toBe('Nothing to undo: that card has changed since')
    expect(mapApi.copies).toHaveBeenCalledTimes(sent)
    expect(order('e1')).toEqual(['x', 'y'])
  })

  it('keeps Undo through a note added from the Notes panel or the canvas (round 1)', async () => {
    const shown = view()
    const order = serve(shown)
    const { map, root } = await openMap(shown)
    await map.moveCopy('w', 'e1', 1)
    const rail = root.querySelector<HTMLFormElement>('[data-map-form="note"]')!
    rail.querySelector('textarea')!.value = 'A thought'
    // (linkedom's form has no reset(); the browser's does.)
    rail.reset = () => {}
    fire(rail, 'submit')
    await settle()
    expect(mapApi.note).toHaveBeenCalledWith('map', 'A thought')
    expect(toast(map)[0]).toBe('Note added: sorting it into the map')
    await press('z')
    expect(order('e1')).toEqual(['x', 'y', 'w'])
    // A note from the canvas's Add → Note keeps it too.
    await press('z', true)
    expect(order('e1')).toEqual(['x', 'w', 'y'])
    map.noteAsk = { text: '' }
    map.paint()
    const flow = root.querySelector<HTMLFormElement>(
      '[data-map-form="flow-note"]'
    )!
    flow.querySelector('textarea')!.value = 'Another thought'
    fire(flow, 'submit')
    await settle()
    expect(mapApi.note).toHaveBeenLastCalledWith(
      'map',
      'Another thought',
      undefined
    )
    await press('z')
    expect(order('e1')).toEqual(['x', 'y', 'w'])
  })
})

describe('focus as a bar menu closes (round 1)', () => {
  it('goes back to the button that opened it when Esc closes it', async () => {
    const { map } = await openMap()
    let focused: Element | null = null
    patch(win.HTMLElement.prototype, 'focus', function (this: Element) {
      focused = this
    })
    Object.defineProperty(win.document, 'activeElement', {
      get: () => focused,
      configurable: true
    })
    const opener = () => (focused as HTMLElement | null)?.dataset.map
    const menu = map.slot('menu')!
    // Apply to… focuses its current choice; Esc brings focus back to it.
    map.select({ t: 'direction', id: 'd1' })
    click(map.slot('bar')!.querySelector('[data-map="menu:apply-to"]'))
    await settle()
    expect(menu.contains(focused)).toBe(true)
    fire(focused!, 'keydown', { key: 'Escape' })
    expect([menu.hidden, opener()]).toEqual([true, 'menu:apply-to'])
    // A copy's Move to…, its choices reached with Tab: the same.
    map.select({ t: 'copy', id: 'x' })
    click(map.slot('bar')!.querySelector('[data-map="menu:move-to"]'))
    await settle()
    menu.querySelector<HTMLElement>('button')!.focus()
    fire(focused!, 'keydown', { key: 'Escape' })
    expect([menu.hidden, opener()]).toEqual([true, 'menu:move-to'])
  })
})

describe('heard as well as seen (round 1)', () => {
  it('says the toast aloud, and what a direction guides with its name', async () => {
    const shown = view()
    const { map } = await openMap(shown)
    const toast = map.slot('toast')!
    expect([
      toast.getAttribute('role'),
      toast.getAttribute('aria-live')
    ]).toEqual(['status', 'polite'])
    const label = () => map.els.get('d:d1')!.getAttribute('aria-label')
    expect(label()).toBe('Direction for the series: Lead with the crash')
    shown.series!.directions[0].to = { episode: 'e2' }
    await map.refresh()
    expect(label()).toBe('Direction for Ep 2: Lead with the crash')
    shown.series!.directions[0].to = { pages: ['a', 'c'] }
    await map.refresh()
    expect(label()).toBe('Direction for cards 1, 3: Lead with the crash')
  })

  it('offers Apply to… as a menu of radio and check choices, moved through with the arrows', async () => {
    const shown = view()
    shown.series!.directions[0].to = { pages: ['b'] }
    const { map } = await openMap(shown)
    let focused: Element | null = null
    patch(win.HTMLElement.prototype, 'focus', function (this: Element) {
      focused = this
    })
    Object.defineProperty(win.document, 'activeElement', {
      get: () => focused,
      configurable: true
    })
    map.select({ t: 'direction', id: 'd1' })
    const opener = map.slot('bar')!.querySelector('[data-map="menu:apply-to"]')!
    expect(opener.getAttribute('aria-haspopup')).toBe('menu')
    click(opener)
    await settle()
    const menu = map.slot('menu')!
    expect([
      menu.getAttribute('role'),
      menu.getAttribute('aria-label')
    ]).toEqual(['menu', 'Apply to'])
    const items = [...menu.querySelectorAll<HTMLElement>('button')]
    expect(
      items.map(
        (b) => `${b.getAttribute('role')} ${b.getAttribute('aria-checked')}`
      )
    ).toEqual([
      'menuitemradio false',
      'menuitemradio false',
      'menuitemradio false',
      'menuitemcheckbox false',
      'menuitemcheckbox true',
      'menuitemcheckbox false',
      'menuitemcheckbox false'
    ])
    // Its choice now is where the keys start; the arrows go round.
    const at = () => items.indexOf(focused as HTMLElement)
    expect(at()).toBe(4)
    const press = (key: string) => fire(focused!, 'keydown', { key })
    press('ArrowDown')
    expect(at()).toBe(5)
    press('Home')
    expect(at()).toBe(0)
    press('ArrowUp')
    expect(at()).toBe(6)
    press('End')
    expect(at()).toBe(6)
    press('ArrowDown')
    expect(at()).toBe(0)
    // Another menu in the same place is a plain one again.
    map.select({ t: 'copy', id: 'x' })
    click(map.slot('bar')!.querySelector('[data-map="menu:move-to"]'))
    await settle()
    expect(menu.getAttribute('role')).toBeNull()
    expect(menu.querySelector('[role]')).toBeNull()
  })
})
