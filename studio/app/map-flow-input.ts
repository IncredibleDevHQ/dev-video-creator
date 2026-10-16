// The content map as a connected canvas, after Flora's: drag from a node's
// handle to wire it into another (a card into an episode copies it, an
// episode into another puts that one next, an episode into the socials
// makes them, a direction into what it guides), drop on empty canvas to make
// the node it leads to, double-click the canvas for the Add menu, and move a
// direction note where it reads best. Also the planning actions: the
// series' outcome and audience, a gap's note, Undo for organising.
import type { MapCanvas } from './map-canvas'
import { mapApi } from './map-api'
import { LH, type Box } from './map-layout'
import { addMenu } from './map-nodes'
import { repaintWires } from './map-paint'

type Point = { x: number; y: number }
type Link = { from: string; x1: number; y1: number }
type Target =
  | { kind: 'lane'; id: string }
  | { kind: 'series' }
  | { kind: 'socials'; episode?: string }
  | { kind: 'card'; id: string }
  | null

const inside = (box: Box | null | undefined, p: Point) =>
  Boolean(
    box &&
    p.x >= box.x &&
    p.x <= box.x + box.w &&
    p.y >= box.y &&
    p.y <= box.y + box.h
  )

/** What a dragged wire would land on. */
export const targetAt = (map: MapCanvas, p: Point): Target => {
  const layout = map.layout
  if (!layout) return null
  for (const [id, box] of Object.entries(layout.lanes))
    if (inside(box, p)) return { kind: 'lane', id }
  if (inside(layout.head, p)) return { kind: 'series' }
  for (const place of layout.derived)
    if (inside(place, p)) return { kind: 'socials', episode: place.episode }
  if (inside(layout.socials, p)) return { kind: 'socials' }
  for (const [id, box] of Object.entries(layout.cards))
    if (inside(box, p)) return { kind: 'card', id }
  return null
}

const worldPoint = (map: MapCanvas, x: number, y: number) => {
  const rect = map.canvas!.getBoundingClientRect()
  return {
    x: (x - rect.left - map.camera.x) / map.camera.k,
    y: (y - rect.top - map.camera.y) / map.camera.k
  }
}
const across = (a: Point, b: Point) => {
  const h = Math.max(40, Math.abs(b.x - a.x) * 0.5)
  return `M${a.x},${a.y} C${a.x + h},${a.y} ${b.x - h},${b.y} ${b.x},${b.y}`
}

let link: Link | null = null
let moving: { id: string; start: Point; box: Box; node: HTMLElement } | null =
  null
let menuAt: Point | null = null

/** Where a node's handle starts its wire, by the node's key. */
const handleOf = (map: MapCanvas, key: string): Point | null => {
  const layout = map.layout
  if (!layout) return null
  const [kind, id] = [key.slice(0, 1), key.slice(2)]
  const box =
    kind === 'm'
      ? layout.cards[id]
      : kind === 'L'
        ? layout.lanes[id]
        : kind === 'd'
          ? layout.directions[id]
          : undefined
  if (!box) return null
  return {
    x: box.x + box.w,
    y: kind === 'L' ? box.y + LH / 2 : box.y + box.h / 2
  }
}

/** A pointer down on a handle starts a wire; on a direction note, a move.
 * True when it was one of them. */
export const startFlowPointer = (map: MapCanvas, event: PointerEvent) => {
  const target = event.target as Element
  const port = target.closest<HTMLElement>('.map-port.is-out')
  const node = target.closest<HTMLElement>('.map-el')
  const key = node?.dataset.k || ''
  if (port && key) {
    const start = handleOf(map, key)
    if (!start) return false
    event.preventDefault()
    link = { from: key, x1: start.x, y1: start.y }
    map.canvas?.classList.add('is-linking')
    return true
  }
  if (
    key.startsWith('d:') &&
    !target.closest('button, textarea, input, form')
  ) {
    const id = key.slice(2)
    const box = map.layout?.directions[id]
    if (!box || map.editingDirection === id) return false
    event.preventDefault()
    moving = {
      id,
      start: worldPoint(map, event.clientX, event.clientY),
      box,
      node: node!
    }
    return true
  }
  return false
}

const tip = (map: MapCanvas, event: PointerEvent, text: string) => {
  const node = map.slot('dragtip')
  const stage = map.root.querySelector('.map-stage')
  if (!node || !stage) return
  const box = stage.getBoundingClientRect()
  node.textContent = text
  node.style.left = `${event.clientX - box.left + 16}px`
  node.style.top = `${event.clientY - box.top + 18}px`
  node.hidden = false
}

const linkSays = (map: MapCanvas, from: string, target: Target) => {
  const number = (id: string) =>
    map.view?.episodes.find((e) => e.notebook === id)?.number
  if (from.startsWith('m:'))
    return target?.kind === 'lane'
      ? `Copy into Ep ${number(target.id)}`
      : 'Into an episode, or let go for a new one'
  if (from.startsWith('L:'))
    return target?.kind === 'lane' && target.id !== from.slice(2)
      ? `Ep ${number(target.id)} comes next`
      : target?.kind === 'socials'
        ? 'Make its socials'
        : 'Onto an episode to put it next, or let go to add'
  return target?.kind === 'lane'
    ? `Guides Ep ${number(target.id)}`
    : target?.kind === 'card'
      ? 'Guides this card'
      : target?.kind === 'series'
        ? 'Guides the whole series'
        : 'Onto the series, an episode or a card'
}

export const installFlowInput = (map: MapCanvas) => {
  const root = map.root
  root.addEventListener('pointermove', (event) => {
    if (!map.isOpen) return
    const p = () => worldPoint(map, event.clientX, event.clientY)
    if (link) {
      const at = p()
      const target = targetAt(map, at)
      map.connecting = `<path class="map-flow is-linking" d="${across({ x: link.x1, y: link.y1 }, at)}"/>`
      repaintWires(map)
      for (const [key, node] of map.els)
        node.classList.toggle(
          'is-drop',
          (target?.kind === 'lane' && key === `L:${target.id}`) ||
            (target?.kind === 'card' && key === `m:${target.id}`) ||
            (target?.kind === 'series' && key === 'B:series')
        )
      tip(map, event, linkSays(map, link.from, target))
    } else if (moving) {
      const at = p()
      const dx = at.x - moving.start.x
      const dy = at.y - moving.start.y
      moving.node.style.transform = `translate(${moving.box.x + dx}px,${moving.box.y + dy}px)`
    }
  })
  const finish = (event: PointerEvent) => {
    if (!map.isOpen) return
    const tipNode = map.slot('dragtip')
    if (link) {
      const from = link
      link = null
      map.connecting = ''
      map.canvas?.classList.remove('is-linking')
      if (tipNode) tipNode.hidden = true
      for (const node of map.els.values()) node.classList.remove('is-drop')
      repaintWires(map)
      const at = worldPoint(map, event.clientX, event.clientY)
      void connect(map, from.from, targetAt(map, at), event, at)
    } else if (moving) {
      const done = moving
      moving = null
      const at = worldPoint(map, event.clientX, event.clientY)
      const dx = at.x - done.start.x
      const dy = at.y - done.start.y
      if (Math.hypot(dx, dy) < 4) {
        map.select({ t: 'direction', id: done.id })
        return
      }
      const series = map.view?.series
      if (series)
        void map.run(() =>
          mapApi.direction(series.id, {
            id: done.id,
            spot: { x: done.box.x + dx, y: done.box.y + dy }
          })
        )
    }
  }
  root.addEventListener('pointerup', finish)
  root.addEventListener('pointercancel', finish)
  root.addEventListener('change', (event) => {
    const box = event.target as HTMLInputElement
    if (!box.matches?.('[data-map-organize]') || !map.view?.series) return
    const on = box.checked
    void map.run(
      () => mapApi.brief(map.view!.series!.id, { organize: on }),
      on
        ? 'New cards now place themselves into the episodes'
        : 'New cards now wait for you to place them'
    )
  })
  root.addEventListener('keydown', (event) => {
    const menu = map.slot('menu')
    if (!menu || menu.hidden || !menu.classList.contains('map-add')) return
    const key = (event as KeyboardEvent).key.toLowerCase()
    const pick = menu.querySelector<HTMLElement>(`[data-key="${key}"]`)
    if (pick) {
      event.preventDefault()
      pick.click()
    } else if (key === 'escape') {
      menu.hidden = true
    }
  })
}

/** What a wire does where it is let go. */
const connect = async (
  map: MapCanvas,
  from: string,
  target: Target,
  event: PointerEvent,
  at: Point
) => {
  const series = map.view?.series
  if (!series) return
  const id = from.slice(2)
  const number = (nb: string) =>
    map.view?.episodes.find((e) => e.notebook === nb)?.number
  if (from.startsWith('m:')) {
    if (target?.kind === 'lane') return map.copyInto(id, target.id)
    if (!target)
      return showAdd(map, event, at, [
        [
          'flow-episode-from:' + id,
          'Episode',
          'A new episode with this card',
          'E'
        ]
      ])
    return
  }
  if (from.startsWith('L:')) {
    const episode = map.view?.episodes.find((e) => e.notebook === id)
    if (target?.kind === 'lane' && target.id !== id)
      return map.run(
        () => mapApi.placeAfter(series.id, target.id, id),
        `Ep ${number(target.id)} now comes after “${episode?.title || ''}”`
      )
    if (target?.kind === 'socials' || !target) {
      const made = Boolean(episode?.video?.joined)
      const options: Array<[string, string, string, string]> = [
        ...(made
          ? ([
              [`teaser:${id}`, 'Teaser', 'A short cut for X, 9:16', 'T'],
              [`posts:${id}`, 'Posts', 'Words for X, LinkedIn and YouTube', 'P']
            ] as Array<[string, string, string, string]>)
          : []),
        ...(!target
          ? ([
              [
                `flow-next:${id}`,
                'Next episode',
                'A new episode right after this one',
                'E'
              ]
            ] as Array<[string, string, string, string]>)
          : [])
      ]
      if (!options.length)
        return map.toast(
          `Make Ep ${episode?.number}’s video first: its socials are cut from it`
        )
      return showAdd(map, event, at, options)
    }
    return
  }
  if (from.startsWith('d:')) {
    const direction = series.directions.find((d) => d.id === id)
    if (!direction) return
    const to =
      target?.kind === 'lane'
        ? { episode: target.id }
        : target?.kind === 'card'
          ? { pages: [...new Set([...(direction.to?.pages || []), target.id])] }
          : target?.kind === 'series'
            ? null
            : undefined
    if (to === undefined) return
    return map.run(
      () => mapApi.direction(series.id, { id, to }),
      'Wired. The next plan answers it.'
    )
  }
}

/** The Add menu at a point: Flora's, with a key for each choice. */
export const showAdd = (
  map: MapCanvas,
  event: { clientX: number; clientY: number },
  at: Point,
  options: Array<[string, string, string, string]>
) => {
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  if (!menu || !stage) return
  menuAt = at
  menu.innerHTML = addMenu(options).replace(
    /data-map="([^"]+)"><i>([^<]+)<\/i>/g,
    (_all, action: string, key: string) =>
      `data-map="${action}" data-key="${key.toLowerCase()}"><i>${key}</i>`
  )
  menu.className = 'map-menu map-add'
  menu.dataset.for = 'add'
  const box = stage.getBoundingClientRect()
  menu.style.left = `${Math.min(event.clientX - box.left, box.width - 300)}px`
  menu.style.top = `${Math.min(event.clientY - box.top, box.height - 260)}px`
  menu.hidden = false
  menu.querySelector<HTMLElement>('button')?.focus()
}

/** Double-click on empty canvas: the Add menu. True when it opened. */
export const flowDoubleClick = (map: MapCanvas, event: MouseEvent) => {
  const under = document.elementFromPoint(event.clientX, event.clientY)
  if (
    !under?.closest('[data-map-canvas]') ||
    under.closest('.map-el, button, a')
  )
    return false
  if (map.snapshot?.status !== 'ready') return false
  const at = worldPoint(map, event.clientX, event.clientY)
  showAdd(map, event, at, addChoices(map))
  return true
}

/** What the Add menu offers on this map. */
export const addChoices = (
  map: MapCanvas
): Array<[string, string, string, string]> => [
  ...(map.view?.series
    ? ([
        ['flow-direction', 'Direction', 'An idea that guides the plan', 'D']
      ] as Array<[string, string, string, string]>)
    : []),
  ['flow-note', 'Note', 'Material that becomes cards', 'N'],
  map.view?.series
    ? ['new-episode', 'Episode', 'Pick its cards, or let the agent', 'E']
    : ['start-series', 'Series', 'A series from these cards', 'S']
]

/** The planning actions. True when the action was one of them. */
export const flowAction = async (map: MapCanvas, name: string, arg: string) => {
  const series = map.view?.series
  switch (name) {
    case 'cancel': {
      const editing = map.editingDirection
      if (!editing && !map.briefing && !map.noteAsk) return false
      map.editingDirection = null
      map.briefing = null
      map.noteAsk = null
      // A new note left as it was made is not kept.
      const draft = series?.directions.find((d) => d.id === editing)
      if (series && draft?.text === 'New direction')
        await map.run(() => mapApi.removeDirection(series.id, draft.id))
      else map.paint()
      return true
    }
    case 'add': {
      const canvas = map.canvas!.getBoundingClientRect()
      const at = worldPoint(
        map,
        canvas.left + canvas.width / 2,
        canvas.top + canvas.height / 2
      )
      showAdd(
        map,
        { clientX: canvas.left + 80, clientY: canvas.top + 90 },
        at,
        addChoices(map)
      )
      return true
    }
    case 'flow-direction': {
      if (!series) return true
      const spot = menuAt || { x: map.layout?.series?.x ?? 400, y: 40 }
      let made = ''
      await map.run(async () => {
        const saved = await mapApi.direction(series.id, {
          text: 'New direction',
          spot
        })
        made = saved.directions?.at(-1)?.id || ''
      })
      if (made) {
        map.editingDirection = made
        map.paint()
        const area = map.root.querySelector<HTMLTextAreaElement>(
          `[data-direction="${made}"] textarea`
        )
        area?.focus()
        area?.select()
      }
      return true
    }
    case 'flow-note':
      map.noteAsk = { text: '' }
      map.paint()
      map.root
        .querySelector<HTMLTextAreaElement>(
          '[data-map-form="flow-note"] textarea'
        )
        ?.focus()
      return true
    case 'flow-episode-from':
      map.newEpisode([arg])
      return true
    case 'flow-next': {
      if (!series) return true
      await map.run(async () => {
        const made = await mapApi.addEpisode(series.id, { slides: [] })
        await mapApi.placeAfter(series.id, made.notebook.project.id, arg)
      }, 'Empty episode added after it: wire cards into it')
      return true
    }
    case 'direction-edit':
      map.editingDirection = arg
      map.paint()
      map.root
        .querySelector<HTMLTextAreaElement>(
          `[data-direction="${arg}"] textarea`
        )
        ?.focus()
      return true
    case 'direction-unwire':
      if (series)
        await map.run(
          () => mapApi.direction(series.id, { id: arg, to: null }),
          'It guides the whole series now'
        )
      return true
    case 'direction-delete':
      if (series) {
        map.sel = null
        await map.run(
          () => mapApi.removeDirection(series.id, arg),
          'Direction removed'
        )
      }
      return true
    case 'brief':
      map.briefing = arg === 'audience' ? 'audience' : 'outcome'
      map.paint()
      map.root
        .querySelector<HTMLInputElement>('[data-map-form="brief"] input')
        ?.focus()
      return true
    case 'gap-note':
      map.noteAsk = { text: '', gap: arg }
      map.paint()
      map.root
        .querySelector<HTMLTextAreaElement>(
          '[data-map-form="flow-note"] textarea'
        )
        ?.focus()
      return true
    case 'gap-explain':
    case 'gap-ignore':
      if (series)
        await map.run(
          () =>
            mapApi.gap(
              series.id,
              arg,
              name === 'gap-explain' ? 'explained' : 'ignored'
            ),
          name === 'gap-explain'
            ? 'The episode explains it in a line'
            : 'Gap set aside'
        )
      return true
    case 'undo-organize':
      if (series)
        await map.run(
          () => mapApi.undoOrganize(series.id, arg),
          'Taken out again: those cards wait for you to place them'
        )
      return true
    case 'queue':
      map.queueOpen = !map.queueOpen
      map.paint()
      return true
  }
  return false
}

/** The planning forms. True when the form was one of them. */
export const flowSubmit = async (map: MapCanvas, form: HTMLFormElement) => {
  const kind = form.dataset.mapForm
  const data = new FormData(form)
  const series = map.view?.series
  if (kind === 'direction' && series) {
    const id = form.dataset.direction || ''
    const text = String(data.get('text') || '').trim()
    map.editingDirection = null
    if (!text) {
      await map.run(() => mapApi.removeDirection(series.id, id))
      return true
    }
    await map.run(
      () => mapApi.direction(series.id, { id, text }),
      'Saved. Wire it to what it guides; the next plan answers it.'
    )
    return true
  }
  if (kind === 'brief' && series && map.briefing) {
    const key = map.briefing
    map.briefing = null
    await map.run(
      () => mapApi.brief(series.id, { [key]: String(data.get('value') || '') }),
      key === 'outcome'
        ? 'Outcome saved: the next plan aims for it'
        : 'Audience saved'
    )
    return true
  }
  if (kind === 'flow-note') {
    const text = String(data.get('note') || '').trim()
    const gap = map.noteAsk?.gap
    map.noteAsk = null
    if (!text) {
      map.paint()
      return true
    }
    await map.run(
      () => mapApi.note(map.mapId, text),
      gap
        ? 'Note added: it becomes a card, and organising puts it where the gap is'
        : 'Note added: sorting it into the map'
    )
    return true
  }
  return false
}

/** Says what the latest organising run moved, once, with Undo. A run there
 * when the map opened was told then. */
export const tellOrganized = (map: MapCanvas) => {
  if (!map.view) return
  const run = map.view.series?.organized
  if (map.toldRun === null) {
    map.toldRun = run?.id || ''
    return
  }
  if (!run || run.id === map.toldRun) return
  map.toldRun = run.id
  const placed = run.moves.filter((move) => move.kind !== 'left').length
  const left = run.moves.length - placed
  const gap = run.moves.some((move) => move.kind === 'closes')
  map.toast(
    `Organised ${placed} new card${placed === 1 ? '' : 's'} into the series${gap ? ', filling a gap' : ''}${left ? `; ${left} left out` : ''}`,
    { label: 'Undo', map: `undo-organize:${run.id}` }
  )
}
