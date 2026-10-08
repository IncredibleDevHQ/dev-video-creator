// What the creator does on the content map: pan and zoom the canvas, select,
// drag a page into an episode (⌥ cuts it), reorder or move copies, use the
// bar and its menus, ⌘C/⌘X/⌘V, Delete and Esc, and the notes rail's form.
import { api } from './api'
import { confirmAction } from './confirm-action'
import { episodeChoices, hideMenu, showMenu } from './map-bar'
import type { MapCanvas, MapSel } from './map-canvas'
import { mapApi } from './map-api'
import { dropSpot, QH } from './map-layout'

export type DragState = {
  key: string
  sx: number
  sy: number
  cx: number
  cy: number
  moved: boolean
  pan: boolean
  node?: HTMLElement
  ghost?: HTMLElement
  marker?: HTMLElement
  offset?: { x: number; y: number }
  over?: string | null
  spot?: ReturnType<typeof dropSpot>
}

const selectionOf = (key: string): MapSel => {
  if (key.startsWith('m:')) return { t: 'page', id: key.slice(2) }
  if (key.startsWith('c:')) return { t: 'copy', id: key.slice(2) }
  if (/^(L|Z|s|e):/.test(key)) return { t: 'lane', id: key.slice(2) }
  return null
}

const worldPoint = (map: MapCanvas, x: number, y: number) => {
  const rect = map.canvas!.getBoundingClientRect()
  return {
    x: (x - rect.left - map.camera.x) / map.camera.k,
    y: (y - rect.top - map.camera.y) / map.camera.k
  }
}

export const installMapInput = (map: MapCanvas) => {
  const root = map.root
  root.addEventListener('click', (event) => {
    if (!map.isOpen) return
    const target = (event.target as Element).closest<HTMLElement>('[data-map]')
    if (target)
      void dispatch(map, target.dataset.map!, target, event as MouseEvent)
    else if (!(event.target as Element).closest('.map-menu')) hideMenu(map)
  })
  root.addEventListener('submit', (event) => {
    if (!map.isOpen) return
    const form = (event.target as Element).closest<HTMLFormElement>(
      '[data-map-form]'
    )
    if (!form) return
    event.preventDefault()
    void submit(map, form)
  })
  root.addEventListener('keydown', (event) => {
    const form = (event.target as Element).closest?.('[data-map-form="note"]')
    if (form && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      ;(form as HTMLFormElement).requestSubmit()
    }
  })
  root.addEventListener('pointerdown', (event) => {
    if (!map.isOpen || event.button !== 0) return
    const target = event.target as Element
    const canvas = target.closest<HTMLElement>('[data-map-canvas]')
    if (!canvas || target.closest('button')) return
    event.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    hideMenu(map)
    const node = target.closest<HTMLElement>('.map-el')
    const key = node?.dataset.k || ''
    const draggable = key.startsWith('m:') || key.startsWith('c:')
    map.drag = {
      key,
      sx: event.clientX,
      sy: event.clientY,
      cx: map.camera.x,
      cy: map.camera.y,
      moved: false,
      pan: !draggable,
      node: node || undefined
    }
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // A synthetic pointer has nothing to capture.
    }
  })
  root.addEventListener('pointermove', (event) => {
    const drag = map.drag
    if (!map.isOpen || !drag) return
    const dx = event.clientX - drag.sx
    const dy = event.clientY - drag.sy
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    if (!drag.moved) {
      drag.moved = true
      if (drag.pan) map.canvas?.classList.add('is-panning')
      else startDrag(map, drag)
    }
    if (drag.pan) {
      map.camera.x = drag.cx + dx
      map.camera.y = drag.cy + dy
      map.applyCamera()
    } else moveDrag(map, drag, event)
  })
  const finish = (event: PointerEvent) => {
    const drag = map.drag
    if (!map.isOpen || !drag) return
    map.drag = null
    map.canvas?.classList.remove('is-panning')
    const tip = map.slot('dragtip')
    if (tip) tip.hidden = true
    if (!drag.moved) {
      map.changing = null
      map.select(drag.key ? selectionOf(drag.key) : null)
      return
    }
    if (drag.pan) return
    endDrag(map, drag, event)
  }
  root.addEventListener('pointerup', finish)
  root.addEventListener('pointercancel', (event) => finish(event))
  root.addEventListener(
    'wheel',
    (event) => {
      if (
        !map.isOpen ||
        !(event.target as Element).closest('[data-map-canvas]')
      )
        return
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = map.canvas!.getBoundingClientRect()
        const mx = event.clientX - rect.left
        const my = event.clientY - rect.top
        const k = Math.min(
          2,
          Math.max(0.2, map.camera.k * Math.exp(-event.deltaY * 0.01))
        )
        map.camera.x = mx - (mx - map.camera.x) * (k / map.camera.k)
        map.camera.y = my - (my - map.camera.y) * (k / map.camera.k)
        map.camera.k = k
      } else {
        map.camera.x -= event.deltaX
        map.camera.y -= event.deltaY
      }
      map.applyCamera()
    },
    { passive: false }
  )
  root.addEventListener('dblclick', (event) => {
    if (!map.isOpen || !map.layout) return
    // Pointer capture sends the event to the canvas: find what is under it.
    const under = document.elementFromPoint(event.clientX, event.clientY)
    if (!under?.closest('[data-map-canvas]') || under.closest('button')) return
    const key = under.closest<HTMLElement>('.map-el')?.dataset.k || ''
    const pad = (b: { x: number; y: number; w: number; h: number }) => ({
      x: b.x - 20,
      y: b.y - 20,
      w: b.w + 40,
      h: b.h + 40
    })
    if (key.startsWith('m:') || key.startsWith('G:') || key === 'B:map')
      return map.fit(map.layout.map)
    if (key === 'B:series' && map.layout.series)
      return map.fit(map.layout.series)
    const sel = selectionOf(key)
    const lane =
      sel?.t === 'lane'
        ? sel.id
        : sel?.t === 'copy'
          ? map.episodeOf(sel.id)?.notebook
          : undefined
    if (lane && map.layout.lanes[lane])
      return map.fit(pad(map.layout.lanes[lane]))
    map.fit()
  })
  globalThis.addEventListener?.('keydown', (event) => {
    if (!map.isOpen) return
    const e = event as KeyboardEvent
    if ((e.target as Element)?.closest?.('input, textarea, select')) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    const sel = map.sel
    if (mod && key === 'c' && sel?.t === 'page') {
      e.preventDefault()
      void dispatch(map, 'copy')
    } else if (mod && key === 'x' && sel) {
      e.preventDefault()
      void dispatch(map, sel.t === 'copy' ? 'cut-copy' : 'cut')
    } else if (mod && key === 'v') {
      e.preventDefault()
      void map.paste()
    } else if ((key === 'backspace' || key === 'delete') && sel?.t === 'copy') {
      e.preventDefault()
      void map.removeCopy(sel.id)
    } else if (key === 'escape') {
      map.naming = null
      map.changing = null
      map.select(null)
    }
  })
}

const startDrag = (map: MapCanvas, drag: DragState) => {
  const node = drag.node
  if (!node || !map.layout) return
  const start = worldPoint(map, drag.sx, drag.sy)
  if (drag.key.startsWith('m:')) {
    if (!map.view?.series) {
      drag.pan = true
      return
    }
    // A map page never moves: the drag carries a copy of it.
    const ghost = node.cloneNode(true) as HTMLElement
    ghost.removeAttribute('data-k')
    ghost.classList.add('is-dragging')
    map.world!.appendChild(ghost)
    drag.ghost = ghost
    const box = map.layout.cards[drag.key.slice(2)]
    drag.offset = { x: start.x - box.x, y: start.y - box.y }
  } else {
    node.classList.add('is-dragging')
    drag.ghost = node
    const box = map.layout.copies[drag.key.slice(2)]
    drag.offset = { x: start.x - box.x, y: start.y - box.y }
  }
  const marker = document.createElement('div')
  marker.className = 'map-el is-still map-marker'
  marker.hidden = true
  map.world!.appendChild(marker)
  drag.marker = marker
}

const moveDrag = (map: MapCanvas, drag: DragState, event: PointerEvent) => {
  if (!drag.ghost || !drag.offset || !map.layout || !map.view) return
  const point = worldPoint(map, event.clientX, event.clientY)
  drag.ghost.style.transform = `translate(${point.x - drag.offset.x}px,${point.y - drag.offset.y}px)`
  const copy = drag.key.startsWith('c:') ? drag.key.slice(2) : undefined
  const spot = dropSpot(map.layout, map.view, point, copy)
  drag.spot = spot
  if ((spot?.episode ?? null) !== (drag.over ?? null)) {
    drag.over = spot?.episode ?? null
    for (const [key, node] of map.els)
      if (key.startsWith('L:'))
        node.classList.toggle('is-drop', key === `L:${drag.over}`)
  }
  if (drag.marker) {
    drag.marker.hidden = !spot
    if (spot) {
      drag.marker.style.transform = `translate(${spot.marker - 1}px,${spot.y}px)`
      drag.marker.style.height = `${QH}px`
    }
  }
  const tip = map.slot('dragtip')
  const stage = map.root.querySelector('.map-stage')
  if (!tip || !stage) return
  const number = (id?: string) =>
    map.view?.episodes.find((e) => e.notebook === id)?.number
  const from = copy ? map.episodeOf(copy)?.notebook : undefined
  tip.textContent = copy
    ? !spot
      ? 'Let go to put it back'
      : spot.episode === from
        ? 'Reorder'
        : `Move to Ep ${number(spot.episode)}`
    : !spot
      ? 'Drop on an episode to copy it'
      : event.altKey
        ? `Cut into Ep ${number(spot.episode)}: it becomes that episode’s only`
        : `Copy into Ep ${number(spot.episode)} · hold ⌥ to cut`
  const box = stage.getBoundingClientRect()
  tip.style.left = `${event.clientX - box.left + 16}px`
  tip.style.top = `${event.clientY - box.top + 18}px`
  tip.hidden = false
}

const endDrag = (map: MapCanvas, drag: DragState, event: PointerEvent) => {
  drag.marker?.remove()
  for (const [key, node] of map.els)
    if (key.startsWith('L:')) node.classList.remove('is-drop')
  const spot = drag.spot
  if (drag.key.startsWith('m:')) {
    const ghost = drag.ghost
    if (spot && ghost) {
      const at = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
        ghost.style.transform
      )
      if (at)
        map.fly[`pending:${spot.episode}`] = {
          x: Number(at[1]),
          y: Number(at[2])
        }
      void map.copyInto(
        drag.key.slice(2),
        spot.episode,
        spot.index,
        event.altKey
      )
    }
    ghost?.remove()
  } else {
    drag.node?.classList.remove('is-dragging')
    if (spot) void map.moveCopy(drag.key.slice(2), spot.episode, spot.index)
  }
  map.paint()
}

const submit = async (map: MapCanvas, form: HTMLFormElement) => {
  const kind = form.dataset.mapForm
  const data = new FormData(form)
  if (kind === 'note') {
    const text = String(data.get('note') || '').trim()
    if (!text) return
    form.reset()
    return map.run(
      () => mapApi.note(map.mapId, text),
      'Note added: sorting it into the map'
    )
  }
  if (kind === 'episode') return map.addEpisode(String(data.get('title') || ''))
  if (kind === 'change' && map.changing) {
    const slideId = map.changing
    const instruction = String(data.get('instruction') || '').trim()
    map.changing = null
    if (!instruction) return map.paint()
    return map.run(
      () =>
        api.chat(map.mapId, {
          anchor: { stage: 'presentation', slideId },
          instruction
        }),
      'Change queued. The page is redrawn in the background.'
    )
  }
}

const dispatch = async (
  map: MapCanvas,
  action: string,
  target?: HTMLElement,
  event?: MouseEvent
) => {
  const [name, arg] = action.split(/:(.*)/s)
  const sel = map.sel
  const page = sel?.t === 'page' ? sel.id : ''
  const copy = sel?.t === 'copy' ? sel.id : ''
  if (name !== 'cancel') hideMenu(map)
  switch (name) {
    case 'close':
      return map.close()
    case 'zoom-in':
    case 'zoom-out':
      map.camera.k = Math.min(
        2,
        Math.max(0.2, map.camera.k * (name === 'zoom-in' ? 1.2 : 1 / 1.2))
      )
      return map.applyCamera(true)
    case 'fit':
      return map.fit()
    case 'mode':
      map.mode = arg === 'topic' ? 'topic' : 'order'
      return map.paint()
    case 'filter':
      map.filter = arg === 'unused' || arg === 'new' ? arg : 'all'
      return map.paint()
    case 'group':
      return map.run(
        () => mapApi.topics(map.mapId),
        'Grouping the map by topic…'
      )
    case 'start-series':
      return map.startSeries()
    case 'new-episode':
      return map.newEpisode()
    case 'empty-episode': {
      const input = map.root.querySelector<HTMLInputElement>(
        '[data-map-form="episode"] input'
      )
      return map.addEpisode(input?.value || '', true)
    }
    case 'cancel':
      map.naming = null
      map.changing = null
      return map.paint()
    case 'copy':
    case 'cut':
      if (!page) return
      map.clip = { mode: name, slide: page }
      map.toast(
        `Page ${name === 'cut' ? 'cut' : 'copied'}: select an episode and press ⌘V`
      )
      return map.paint()
    case 'cut-copy': {
      const from = map.episodeOf(copy)
      if (!from) return
      map.clip = { mode: 'move', copy, from: from.notebook }
      map.toast('Cut from its episode: select another and press ⌘V to move it')
      return map.paint()
    }
    case 'menu':
      if (!target) return
      if (arg === 'copy-to')
        return showMenu(map, target, episodeChoices(map, 'copy-to'))
      return showMenu(
        map,
        target,
        episodeChoices(map, 'move-to', map.episodeOf(copy)?.notebook)
      )
    case 'copy-to':
      if (!page) return
      if (arg === 'new') return map.newEpisode([page])
      return map.copyInto(page, arg, undefined, Boolean(event?.altKey))
    case 'move-to':
      return copy ? map.moveCopy(copy, arg) : undefined
    case 'aside':
    case 'bring-back':
      return page
        ? map.run(
            () => mapApi.aside(map.mapId, page, name === 'aside'),
            name === 'aside'
              ? 'Set aside: it no longer counts as unused'
              : 'Back in play'
          )
        : undefined
    case 'resort':
      return map.run(
        () => mapApi.resortNote(map.mapId, arg),
        'Sorting the note again'
      )
    case 'pick':
      return map.run(() => mapApi.pick(arg), 'Picking the pages again')
    case 'resend': {
      const failed = map.snapshot?.changes?.find(
        (change) => change.slideId === page && change.state === 'failed'
      )
      if (!failed) return
      return map.run(
        () =>
          api.chat(map.mapId, {
            anchor: { stage: 'presentation', slideId: page },
            instruction: failed.instruction,
            ...(failed.target ? { target: failed.target } : {})
          }),
        'Sent again: the page is redrawn in the background'
      )
    }
    case 'delete-page': {
      if (!page) return
      const sure = await confirmAction({
        title: 'Delete this page from the map?',
        detail:
          'Episodes keep their copies, marked “original deleted”. Undo is on the Wireframe stage.',
        action: 'Delete page'
      })
      if (!sure) return
      map.sel = null
      return map.run(
        () => api.slide(map.mapId, { action: 'delete', slideId: page }),
        'Page deleted from the map'
      )
    }
    case 'change':
      map.changing = page || null
      map.paint()
      return map.root
        .querySelector<HTMLInputElement>('[data-map-form="change"] input')
        ?.focus()
    case 'update':
    case 'keep': {
      const from = map.episodeOf(copy)
      if (!from) return
      return map.run(
        () => mapApi.copies(from.notebook, { action: name, slide: copy }),
        name === 'update'
          ? 'Copy updated from the map'
          : 'This episode keeps its version'
      )
    }
    case 'remove':
      return copy ? map.removeCopy(copy) : undefined
    case 'paste':
      return map.paste()
    case 'clear-clip':
      map.clip = null
      return map.paint()
    case 'open':
      return map.hooks.openEpisode(arg)
    case 'order': {
      const series = map.view?.series
      if (!series || sel?.t !== 'lane') return
      return map.run(
        () => mapApi.moveEpisode(series.id, sel.id, arg === '-1' ? -1 : 1),
        'Episodes reordered: every “last time” and “next time” is rewritten'
      )
    }
    case 'segues':
      return map.run(() => mapApi.segues(arg), 'Writing the segues again')
    case 'teaser':
      return map.run(
        () => mapApi.teaser(arg),
        'Cutting a teaser from the made episode'
      )
    case 'posts':
      return map.run(() => mapApi.posts(arg), 'Drafting the posts')
  }
}
