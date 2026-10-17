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
const { closePopover } = await import('../app/popover')
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
      'cut from its episode · this episode has it'
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
   * card moved to another episode is a new card there, the one that left
   * kept to come back), a removal (an episode keeps its last, as it says
   * when loaded), and bringing either back. */
  const serve = (shown: MapView) => {
    let made = 0
    type Kept = { copy: Copies[number]; index: number }
    const kept: Record<string, Kept> = {}
    const moved: Record<string, Kept & { to: string; as: string }> = {}
    const lane = (id: string) => shown.episodes.find((e) => e.notebook === id)!
    vi.mocked(mapApi.copies).mockImplementation(async (episode, body) => {
      const { action, slide, to, index } = body as {
        action: string
        slide: string
        to?: string
        index?: number
      }
      const from = lane(episode)
      if (action === 'unmove') {
        const back = moved[episode]
        if (back?.copy.id !== slide) throw new Error('Can no longer be undone')
        const there = lane(back.to).copies
        there.splice(
          there.findIndex((copy) => copy.id === back.as),
          1
        )
        from.copies.splice(back.index, 0, back.copy)
        delete moved[episode]
        return { moved: true } as never
      }
      if (action === 'unremove') {
        const back = kept[episode]
        if (back?.copy.id !== slide)
          throw new Error('That page can no longer be brought back')
        delete kept[episode]
        from.copies.splice(back.index, 0, back.copy)
        return { restored: true } as never
      }
      const at = from.copies.findIndex((copy) => copy.id === slide)
      if (at < 0) throw new Error('That page is no longer in this episode')
      const [card] = from.copies.splice(at, 1)
      if (action === 'remove') kept[episode] = { copy: card, index: at }
      if (action === 'move') {
        const into = lane(to || episode)
        const place = Math.min(index ?? into.copies.length, into.copies.length)
        const copy = into === from ? card : { ...card, id: `m${++made}` }
        into.copies.splice(place, 0, copy)
        if (into !== from) {
          moved[episode] = {
            copy: card,
            index: at,
            to: into.notebook,
            as: copy.id
          }
          return { as: copy.id }
        }
      }
      return {}
    })
    vi.mocked(api.load).mockImplementation(async (id) => {
      const back = kept[id]
      return back
        ? {
            ...snapshot(),
            deletedSlide: { slide: back.copy as never, index: back.index }
          }
        : snapshot()
    })
    return Object.assign(
      (id: string) => lane(id).copies.map((copy) => copy.id),
      { kept }
    )
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
    const { map, root } = await openMap(shown)
    const order = serve(shown)
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
      '⌘Z  ⇧⌘Zundo or redo a card’s move, removal or update'
    )
  })

  it('undoes the last edit first, a move to another episode and a removal, and nothing after another change', async () => {
    const shown = view()
    const { map } = await openMap(shown)
    const order = serve(shown)
    await map.removeCopy('x')
    await map.moveCopy('w', 'e2', 0)
    expect([order('e1'), order('e2')]).toEqual([['y'], ['m1', 'z']])
    expect(toast(map)).toEqual(['Moved to Ep 2', 'Undo'])
    // Undo of the move brings back the very card, never a new copy of it.
    await press('z')
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'unmove',
      slide: 'w'
    })
    expect([order('e1'), order('e2')]).toEqual([['y', 'w'], ['z']])
    expect(toast(map)[0]).toBe('Back in Ep 1')
    await press('z')
    expect(order('e1')).toEqual(['x', 'y', 'w'])
    expect(toast(map)).toEqual(['Back in the episode', 'Redo'])
    await press('z')
    expect(toast(map)).toEqual(['Nothing to undo', null])
    // Redo goes forward again in order, the removal first, then the move,
    // and Undo of that brings the card back again.
    await press('z', true)
    expect(order('e1')).toEqual(['y', 'w'])
    await press('z', true)
    expect([order('e1'), order('e2')]).toEqual([['y'], ['m2', 'z']])
    await press('z')
    expect([order('e1'), order('e2')]).toEqual([['y', 'w'], ['z']])
    // Another change to the map ends the history: Undo reaches no further.
    await map.run(async () => {}, 'Episode renamed')
    const sent = vi.mocked(mapApi.copies).mock.calls.length
    await press('z')
    expect(toast(map)).toEqual(['Nothing to undo', null])
    expect(mapApi.copies).toHaveBeenCalledTimes(sent)
  })

  it('says when the card has changed since, rather than undoing something else', async () => {
    const shown = view()
    const { map } = await openMap(shown)
    const order = serve(shown)
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

  it('brings back the very card it removed, never one removed since (round 2)', async () => {
    const shown = view()
    const { map } = await openMap(shown)
    const order = serve(shown)
    await map.removeCopy('x')
    // Another card removed from the episode since, on its Wireframe stage:
    // the episode keeps that one now.
    const [y] = shown.episodes[0].copies.splice(0, 1)
    order.kept.e1 = { copy: y, index: 0 }
    await map.refresh()
    const sent = vi.mocked(mapApi.copies).mock.calls.length
    await press('z')
    expect(toast(map)[0]).toBe('Nothing to undo: that card has changed since')
    expect(mapApi.copies).toHaveBeenCalledTimes(sent)
    expect(order('e1')).toEqual(['w'])
    // Its own removal comes back by name.
    await map.removeCopy('w')
    await press('z')
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'unremove',
      slide: 'w'
    })
    expect(order('e1')).toEqual(['w'])
  })

  it('keeps Undo through a note added from the Notes panel or the canvas (round 1)', async () => {
    const shown = view()
    const { map, root } = await openMap(shown)
    const order = serve(shown)
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
    // The canvas's Add menu, opened from +: Esc gives focus back to +.
    click(map.root.querySelector('[data-map="add"]'))
    await settle()
    expect([menu.hidden, menu.contains(focused)]).toEqual([false, true])
    fire(focused!, 'keydown', { key: 'Escape' })
    expect([menu.hidden, opener()]).toEqual([true, 'add'])
  })
})

describe('a box to type in is never focused off screen (round 2)', () => {
  it('brings a new direction into view, its zoom kept, when Add → Direction opens it far from where the creator is looking', async () => {
    const { map, root } = await openMap()
    map.canvas!.getBoundingClientRect = () => rect(0, 0, 1200, 800)
    patch(win.HTMLElement.prototype, 'offsetWidth', 240)
    patch(win.HTMLElement.prototype, 'offsetHeight', 152)
    patch(win.HTMLElement.prototype, 'select', () => {})
    patch(win.HTMLElement.prototype, 'focus', function (this: Element) {
      fire(this, 'focusin')
    })
    // Zoomed in on the last episode: the series' head, where a direction
    // made over the episodes goes, is above the screen.
    const lane = map.layout!.lanes.e2
    map.camera = {
      k: 1.5,
      x: 600 - (lane.x + lane.w / 2) * 1.5,
      y: 400 - (lane.y + lane.h / 2) * 1.5
    }
    map.applyCamera()
    expect(map.camera.y + map.layout!.series!.y * 1.5).toBeLessThan(0)
    click(root.querySelector('[data-map="add"]'))
    await settle()
    click(map.slot('menu')!.querySelector('[data-map="flow-direction"]'))
    await settle()
    const node = root
      .querySelector('.map-direction-form textarea')!
      .closest<HTMLElement>('.map-el')!
    const y = Number(
      /translate\([-\d.]+px,\s*([-\d.]+)px\)/.exec(node.style.transform)![1]
    )
    const top = map.camera.y + y * map.camera.k
    expect(map.camera.k).toBe(1.5)
    expect(top).toBeGreaterThanOrEqual(60)
    expect(top + 152 * 1.5).toBeLessThanOrEqual(800 - 110)
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

describe('a phone with the notes open (round 1)', () => {
  it('fits the map above the sheet of notes, across the whole width, and looks past a panel that leaves no room', async () => {
    const { map, root } = await openMap()
    map.canvas!.getBoundingClientRect = () => rect(0, 0, 390, 690)
    click(root.querySelector('.map-notes-toggle'))
    const rail = root.querySelector('.map-rail')!
    // The sheet, 8 px in, over the foot of the canvas.
    rail.getBoundingClientRect = () => rect(8, 282, 374, 400)
    map.camera = { x: 0, y: 0, k: 1 }
    map.fit()
    const box = extent(map.layout!)
    const { x, y, k } = map.camera
    expect(k).toBeLessThan(1)
    // From the left edge (the tools wait while the sheet is open).
    expect(x + box.x * k).toBeCloseTo(16, 5)
    // Clear of the sheet, with room for the bar just over it.
    expect(y + (box.y + box.h) * k).toBeLessThanOrEqual(282 - 70 + 0.5)
    // A panel beside the map that would leave it too little: fitted as if
    // shut, never not at all.
    rail.getBoundingClientRect = () => rect(78, 10, 300, 670)
    map.camera = { x: 0, y: 0, k: 1 }
    map.fit()
    expect(map.camera.k).toBeLessThan(1)
    expect(map.camera.x + (box.x + box.w) * map.camera.k).toBeGreaterThan(78)
  })
})

describe('a cut or a copy waiting, said once in the bar (round 1)', () => {
  it('says it whatever is selected: ⌘V where it can land, why or where otherwise', async () => {
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
    const { map } = await openMap(shown)
    const bar = map.slot('bar')!
    const said = () =>
      [...bar.querySelectorAll('[data-clip]')].map((n) => n.textContent)
    map.clip = { mode: 'copy', slide: 'd' }
    const at = (sel: Canvas['sel']) => {
      map.select(sel)
      return said()
    }
    const where = 'page 4 copied · select an episode to paste'
    expect(at({ t: 'series' })).toEqual([where])
    expect(at({ t: 'direction', id: 'd1' })).toEqual([where])
    expect(at({ t: 'gap', id: 'g1' })).toEqual([where])
    expect(at({ t: 'page', id: 'a' })).toEqual([where])
    expect(at(null)).toEqual([where])
    expect(bar.querySelector('[data-map="clear-clip"]')).not.toBeNull()
    // Where a paste can land, ⌘V; where the page is already, why not.
    expect(at({ t: 'lane', id: 'e1' })).toEqual(['page 4 copied · ⌘V to paste'])
    expect(at({ t: 'copy', id: 'z' })).toEqual(['page 4 copied · ⌘V to paste'])
    map.clip = { mode: 'copy', slide: 'b' }
    expect(at({ t: 'lane', id: 'e2' })).toEqual([
      'page 2 copied · this episode has it'
    ])
  })
})

describe('what Organise new cards does (round 1)', () => {
  it('says its scope in words under it on the series, once, and in the plan bar (F08)', async () => {
    const { map, root } = await openMap()
    const line =
      'New cards only; unedited copies follow their card until their episode is approved.'
    const head = root.querySelector('[data-k="B:series"]')!
    expect(head.querySelector('.map-organize-says')!.textContent).toBe(line)
    // Seen, not hovered for, and said once.
    const box = head.querySelector('.map-organize')!
    expect(box.getAttribute('title')).toBeNull()
    expect(box.querySelector('[data-map-organize]')).not.toBeNull()
    expect(root.textContent!.split(line)).toHaveLength(2)
    map.askPlan()
    const plan = map.slot('bar')!.querySelector('.map-plan-check')!
    expect(plan.textContent).toBe('Organise new cards')
    expect(plan.getAttribute('title')).toBe(line)
  })
})

describe('an episode’s cards changed on the map (round 1)', () => {
  it('says them once in the episode’s bar, and Review goes through them one by one', async () => {
    const shown = view()
    shown.episodes[0].copies[0].stale = true
    shown.episodes[0].copies[2].stale = true
    const { map } = await openMap(shown)
    // The engine brings a copy up to date, or keeps it: no longer changed.
    vi.mocked(mapApi.copies).mockImplementation(async (_episode, body) => {
      const { slide } = body as { slide: string }
      shown.episodes[0].copies.find((copy) => copy.id === slide)!.stale = false
      return {}
    })
    map.select({ t: 'lane', id: 'e1' })
    const bar = map.slot('bar')!
    const info = () => bar.querySelector('.map-info small')?.textContent
    expect(info()).toBe('3 pages · 2 changed on the map')
    click(bar.querySelector('[data-map="review:e1"]'))
    await settle()
    expect(map.sel).toEqual({ t: 'copy', id: 'x' })
    // Its bar offers Update and Keep; either one moves on to the next.
    click(bar.querySelector('[data-map="update"]'))
    await settle()
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'update',
      slide: 'x'
    })
    expect(map.sel).toEqual({ t: 'copy', id: 'w' })
    click(bar.querySelector('[data-map="keep"]'))
    await settle()
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'keep',
      slide: 'w'
    })
    // None left: the last one stays selected, and the episode says no more.
    expect(map.sel).toEqual({ t: 'copy', id: 'w' })
    map.select({ t: 'lane', id: 'e1' })
    expect(bar.querySelector('[data-map^="review:"]')).toBeNull()
    expect(info()).toBe('3 pages')
  })

  it('updates them all at once, and an Update, a Keep or Update all undoes from its toast and with ⌘Z (F08)', async () => {
    const shown = view()
    const lane = shown.episodes[0]
    lane.copies[0].stale = true
    lane.copies[2].stale = true
    const { map } = await openMap(shown)
    // The engine brings copies up to date or keeps one; its Undo puts the
    // last of those back, waiting again.
    let last: string[] = []
    const mark = (ids: string[], stale: boolean) => {
      for (const id of ids) lane.copies.find((c) => c.id === id)!.stale = stale
    }
    vi.mocked(mapApi.copies).mockImplementation(async (_episode, body) => {
      const { action, slide, slides } = body as {
        action: string
        slide?: string
        slides?: string[]
      }
      if (action === 'undo-update') mark(last, true)
      else mark((last = slides || [slide!]), false)
      return action === 'update' ? { updated: last.length } : {}
    })
    const bar = map.slot('bar')!
    const toast = () => {
      const node = map.slot('toast')!
      return [
        node.querySelector('span')?.textContent,
        node.querySelector('button')?.textContent ?? null
      ]
    }
    const press = async (shiftKey = false) => {
      fire(win.document.body, 'keydown', { key: 'z', metaKey: true, shiftKey })
      await settle()
    }
    map.select({ t: 'lane', id: 'e1' })
    const all = bar.querySelector('[data-map="update-all:e1"]')!
    expect(all.textContent).toBe('Update all 2')
    click(all)
    await settle()
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'update',
      slides: ['x', 'w']
    })
    expect(toast()).toEqual(['2 cards updated from the map', 'Undo'])
    map.select({ t: 'lane', id: 'e1' })
    expect(bar.querySelector('[data-map^="update-all:"]')).toBeNull()
    // Its toast's Undo puts both back, waiting again.
    click(map.slot('toast')!.querySelector('button'))
    await settle()
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'undo-update'
    })
    expect(toast()).toEqual(['2 cards put back as they were', 'Redo'])
    map.select({ t: 'lane', id: 'e1' })
    expect(bar.querySelector('[data-map="update-all:e1"]')).not.toBeNull()
    // A Keep undone with ⌘Z waits again; ⇧⌘Z keeps it again.
    map.select({ t: 'copy', id: 'w' })
    click(bar.querySelector('[data-map="keep"]'))
    await settle()
    expect(toast()).toEqual(['This episode keeps its version', 'Undo'])
    await press()
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'undo-update'
    })
    expect(toast()[0]).toBe('It waits for your Update again')
    await press(true)
    expect(mapApi.copies).toHaveBeenLastCalledWith('e1', {
      action: 'keep',
      slide: 'w'
    })
    // One card's Update, undone the same way.
    map.select({ t: 'copy', id: 'x' })
    click(bar.querySelector('[data-map="update"]'))
    await settle()
    expect(toast()).toEqual(['Copy updated from the map', 'Undo'])
    await press()
    expect(toast()[0]).toBe('Put back as it was')
    expect(lane.copies[0].stale).toBe(true)
  })
})

describe('the content map, round 2 of the audit', () => {
  it('brings a block into view when the keys reach a button on it, never when it is clicked (F12)', async () => {
    const { map, root } = await openMap()
    map.canvas!.getBoundingClientRect = () => rect(0, 0, 1200, 800)
    const lane = map.layout!.lanes.e1
    const node = map.els.get('L:e1')!
    Object.assign(node, { offsetWidth: lane.w, offsetHeight: lane.h })
    // The episode is far off to the left; its Make video gets focus.
    const button = root.querySelector<HTMLElement>('[data-map="open:e1"]')!
    let keyboard = false
    const matches = button.matches.bind(button)
    button.matches = (selector: string) =>
      selector === ':focus-visible' ? keyboard : matches(selector)
    map.camera = { x: -5000, y: 100 - lane.y, k: 1 }
    fire(button, 'focusin')
    expect(map.camera.x).toBe(-5000)
    keyboard = true
    fire(button, 'focusin')
    const left = map.camera.x + lane.x * map.camera.k
    expect(left).toBeGreaterThanOrEqual(40)
    expect(left + lane.w).toBeLessThanOrEqual(1200 - 40)
  })

  it('takes ⌘Z and ⇧⌘Z on Organise new cards and the length slider, leaving typed words their own Undo', async () => {
    const { map, root } = await openMap()
    const undo = vi.spyOn(map.history, 'undo').mockResolvedValue(undefined)
    const redo = vi.spyOn(map.history, 'redo').mockResolvedValue(undefined)
    const z = (target: Element, shiftKey = false) =>
      fire(target, 'keydown', { key: 'z', metaKey: true, shiftKey })
    z(root.querySelector('[data-map-organize]')!)
    expect(undo).toHaveBeenCalledTimes(1)
    map.select({ t: 'series' })
    // (One popover is open at a time, in any document.)
    closePopover()
    click(map.slot('bar')!.querySelector('[data-map="length"]'))
    const slider = win.document.querySelector(
      '.length-popover input[type="range"]'
    )!
    z(slider, true)
    expect(redo).toHaveBeenCalledTimes(1)
    // A note being written keeps the browser's Undo of its words.
    z(root.querySelector('[data-map-form="note"] textarea')!)
    expect(undo).toHaveBeenCalledTimes(1)
  })
})
