// What the creator does on the content map: pan and zoom the canvas, select,
// drag a page into an episode (⌥ cuts it), reorder or move copies, use the
// bar and its menus, ⌘C/⌘X/⌘V, Delete and Esc, and the notes rail's form.
import { api } from './api'
import { confirmAction } from './confirm-action'
import {
  episodeChoices,
  hideMenu,
  moreChoices,
  showHelp,
  showMenu,
  showPosts
} from './map-bar'
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
  /** The latest pointer, and the frame that pans while it is at an edge. */
  last?: PointerEvent
  edge?: number
}

// Held near the canvas's edge, a drag pans the map toward that edge, so a
// lane out of view can still be reached.
const EDGE = 48
const panAtEdge = (map: MapCanvas, drag: DragState, event: PointerEvent) => {
  drag.last = event
  if (drag.edge) return
  const step = () => {
    drag.edge = 0
    const canvas = map.canvas
    if (map.drag !== drag || !drag.last || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const { clientX: x, clientY: y } = drag.last
    const dx = x < rect.left + EDGE ? 14 : x > rect.right - EDGE ? -14 : 0
    const dy = y < rect.top + EDGE ? 14 : y > rect.bottom - EDGE ? -14 : 0
    if (!dx && !dy) return
    map.camera.x += dx
    map.camera.y += dy
    map.applyCamera()
    moveDrag(map, drag, drag.last)
    drag.edge = requestAnimationFrame(step)
  }
  drag.edge = requestAnimationFrame(step)
}

const selectionOf = (key: string): MapSel => {
  if (key.startsWith('m:')) return { t: 'page', id: key.slice(2) }
  if (key.startsWith('c:')) return { t: 'copy', id: key.slice(2) }
  if (/^(L|Z|s|e):/.test(key)) return { t: 'lane', id: key.slice(2) }
  if (key === 'B:series') return { t: 'series' }
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
    // A card reached with Tab selects with Enter or Space, as a click would.
    const el = (event.target as Element).closest?.<HTMLElement>(
      '[data-map-canvas] .map-el'
    )
    const own = (event.target as Element).closest?.('button, a, input')
    if (el && !own && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      map.select(selectionOf(el.dataset.k || ''))
    }
  })
  // Focus moves the camera, never the canvas: a card reached with Tab is
  // brought into view as a pan would, from where the layout puts it (the
  // camera may still be gliding).
  root.addEventListener('focusin', (event) => {
    const el = event.target as HTMLElement
    const canvas = map.canvas
    if (!el.classList?.contains('map-el') || !canvas?.contains(el)) return
    canvas.scrollLeft = 0
    canvas.scrollTop = 0
    const at = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      el.style.transform
    )
    if (!at) return
    const { k } = map.camera
    const rect = canvas.getBoundingClientRect()
    // Too big to show whole, it shows its start; else it is nudged in.
    const nudge = (
      start: number,
      size: number,
      room: number,
      lead: number,
      tail: number
    ) =>
      size > room - lead - tail
        ? start < lead || start > room - tail
          ? lead - start
          : 0
        : start < lead
          ? lead - start
          : start + size > room - tail
            ? room - tail - start - size
            : 0
    const dx = nudge(
      map.camera.x + Number(at[1]) * k,
      el.offsetWidth * k,
      rect.width,
      40,
      40
    )
    const dy = nudge(
      map.camera.y + Number(at[2]) * k,
      el.offsetHeight * k,
      rect.height,
      60,
      110
    )
    if (!dx && !dy) return
    map.camera.x += dx
    map.camera.y += dy
    map.applyCamera(true)
  })
  root.addEventListener('pointerdown', (event) => {
    if (!map.isOpen || event.button !== 0) return
    const target = event.target as Element
    const canvas = target.closest<HTMLElement>('[data-map-canvas]')
    if (!canvas || target.closest('button, a')) return
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
    } else {
      moveDrag(map, drag, event)
      panAtEdge(map, drag, event)
    }
  })
  // With no pages chosen, a new episode needs to say what it is about
  // before the agent can choose its pages.
  root.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement
    const form = input.closest?.<HTMLFormElement>('[data-map-form="episode"]')
    const submit = form?.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    )
    if (submit && form?.querySelector('[data-map="empty-episode"]'))
      submit.disabled = !input.value.trim()
  })
  const finish = (event: PointerEvent) => {
    const drag = map.drag
    if (!map.isOpen || !drag) return
    map.drag = null
    if (drag.edge) cancelAnimationFrame(drag.edge)
    map.canvas?.classList.remove('is-panning')
    const tip = map.slot('dragtip')
    if (tip) tip.hidden = true
    if (!drag.moved) {
      map.changing = null
      map.renaming = null
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
    if (!under?.closest('[data-map-canvas]') || under.closest('button, a'))
      return
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
    // The Socials box, or a made episode's place in it.
    if ((key === 'S:socials' || key.startsWith('D:')) && map.layout.socials)
      return map.fit(pad(map.layout.socials))
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
      map.renaming = null
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
  if (kind === 'rename') return map.saveTitle(String(data.get('title') || ''))
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
  const lane =
    sel?.t === 'lane'
      ? map.view?.episodes.find((e) => e.notebook === sel.id)
      : undefined
  // The same "More" again closes its menu; copying a post keeps the posts.
  const menu = map.slot('menu')
  const reopened = menu && !menu.hidden && menu.dataset.for === action
  if (name !== 'cancel' && name !== 'copy-post') hideMenu(map)
  switch (name) {
    case 'close':
      return map.close()
    case 'stage':
      return arg === 'notebook' || arg === 'presentation' || arg === 'video'
        ? map.hooks.openStage(arg)
        : undefined
    case 'zoom-in':
    case 'zoom-out': {
      // Around the view's centre, as the wheel zooms around the pointer, so
      // what is in view stays in view (review 6).
      const rect = map.canvas!.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const k = Math.min(
        2,
        Math.max(0.2, map.camera.k * (name === 'zoom-in' ? 1.2 : 1 / 1.2))
      )
      map.camera.x = cx - (cx - map.camera.x) * (k / map.camera.k)
      map.camera.y = cy - (cy - map.camera.y) * (k / map.camera.k)
      map.camera.k = k
      return map.applyCamera(true)
    }
    case 'fit':
      return map.fit()
    case 'mode':
      map.mode = arg === 'topic' ? 'topic' : 'order'
      return map.paint()
    case 'filter':
      map.filter =
        (arg === 'unused' || arg === 'new') && map.filter !== arg ? arg : 'all'
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
      map.renaming = null
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
    case 'menu': {
      if (!target || reopened) return
      if (arg === 'copy-to')
        return showMenu(
          map,
          target,
          episodeChoices(map, 'copy-to', undefined, page)
        )
      if (arg === 'move-to') {
        const from = map.episodeOf(copy)
        const source = from?.copies.find((c) => c.id === copy)?.copyOf?.slide
        return showMenu(
          map,
          target,
          episodeChoices(map, 'move-to', from?.notebook, source)
        )
      }
      return showMenu(map, target, moreChoices(map, arg))
    }
    case 'open-page': {
      const index =
        map.snapshot?.project.slides.findIndex((s) => s.id === page) ?? -1
      return index < 0 ? undefined : map.hooks.openPage(map.mapId, index)
    }
    case 'open-copy': {
      const from = map.episodeOf(copy)
      const index = from?.copies.findIndex((c) => c.id === copy) ?? -1
      return from && index >= 0
        ? map.hooks.openPage(from.notebook, index)
        : undefined
    }
    case 'rename-episode':
      return lane ? map.rename('episode', lane.notebook, lane.title) : undefined
    case 'rename-series': {
      const series = map.view?.series
      return series ? map.rename('series', series.id, series.title) : undefined
    }
    case 'remove-episode': {
      const series = map.view?.series
      if (!series || !lane) return
      const sure = await confirmAction({
        title: `Take Ep ${lane.number} out of the series?`,
        detail:
          'It stays a notebook of its own, with its copies and anything made. The map keeps its pages.',
        action: 'Take it out'
      })
      if (!sure) return
      map.sel = null
      return map.run(
        () => mapApi.removeEpisode(series.id, lane.notebook),
        'Taken out of the series. The episodes either side now meet.'
      )
    }
    case 'reveal':
      return map.reveal(arg)
    case 'help':
      return target && !reopened ? showHelp(map, target) : undefined
    case 'notes': {
      const shell = map.root.querySelector('.map-page')
      const open = !shell?.classList.contains('is-notes-open')
      shell?.classList.toggle('is-notes-open', open)
      target?.setAttribute('aria-expanded', String(open))
      return
    }
    case 'note-more':
      if (map.openNotes.has(arg)) map.openNotes.delete(arg)
      else map.openNotes.add(arg)
      return map.paint()
    case 'read-posts':
      return target && !reopened ? showPosts(map, target, arg) : undefined
    case 'copy-post': {
      const [episode, channel] = arg.split(':')
      const posts = map.view?.episodes.find(
        (e) => e.notebook === episode
      )?.posts
      const text = posts?.[channel as keyof typeof posts]
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        return map.toast('Copied')
      } catch {
        return map.toast('Could not copy: select the text instead')
      }
    }
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
    case 'undo-remove':
      return map.undoRemove()
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
    case 'posts': {
      // A draft running already is not asked for again.
      const episode = map.view?.episodes.find((e) => e.notebook === arg)
      if (episode?.drafting?.state === 'drafting') return
      return map.run(
        () => mapApi.posts(arg),
        'Drafting the posts: about a minute'
      )
    }
  }
}
