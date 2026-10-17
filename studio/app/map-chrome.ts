// What sits around the content map's canvas, kept quiet as Figma, Miro and
// Flora keep theirs: one View menu for how the map is arranged and
// filtered, a More menu (appearance, shortcuts, hiding the interface), the
// notes as a panel that opens on demand and remembers it, and a canvas
// that shows less fine print the further it is zoomed out.
import { themeControl } from './appearance'
import type { MapCanvas } from './map-canvas'
import { dialogOpen } from './ui'
import { hideMenu, place, showHelp, showMenu, type MenuItem } from './map-bar'
import { ORGANIZE_SAYS } from './map-nodes'

const NOTES_KEY = 'incredible-studio-map-notes'
const VIEW_KEY = 'incredible-studio-map-view:'
/** Below these zooms the canvas drops its fine print, then card titles. */
export const FAR = 0.62
export const FARTHEST = 0.36

const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // This session keeps it.
  }
}
const recall = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** How far out the canvas is: near shows everything. */
export const detailFor = (k: number) =>
  k < FARTHEST ? 'farthest' : k < FAR ? 'far' : 'near'

/** Zoomed out, the line under Organise new cards goes with the fine print
 * while its checkbox stays: the label says it on hover then, and only
 * then, so it is never said twice (review 8 F08). */
export const sayWhatFarHides = (map: MapCanvas) => {
  const label = map.canvas?.querySelector<HTMLElement>('.map-organize')
  if (!label) return
  if (detailFor(map.camera.k) === 'near') label.removeAttribute('title')
  else label.setAttribute('title', ORGANIZE_SAYS)
}

/** The View menu: the map's arrangement, then which cards it shows. */
export const viewChoices = (map: MapCanvas): MenuItem[] => {
  const on = (yes: boolean) => (yes ? { note: '✓' } : {})
  const grouping = map.snapshot?.project.grouping
  return [
    { action: 'mode:order', label: 'By order', ...on(map.mode === 'order') },
    { action: 'mode:topic', label: 'By topic', ...on(map.mode === 'topic') },
    {
      action: 'filter:all',
      label: 'Every card',
      sep: true,
      ...on(map.filter === 'all')
    },
    ...(map.view?.series
      ? [
          {
            action: 'filter:unused',
            label: 'Cards no episode uses',
            ...on(map.filter === 'unused')
          }
        ]
      : []),
    ...(map.snapshot?.project.notes?.length
      ? [
          {
            action: 'filter:new',
            label: 'Cards from notes',
            ...on(map.filter === 'new')
          }
        ]
      : []),
    ...(map.mode === 'topic'
      ? [
          grouping?.state === 'grouping'
            ? {
                action: 'group',
                label: 'Grouping… about a minute',
                disabled: true,
                sep: true
              }
            : {
                action: 'group',
                label: 'Group by topic again',
                sep: true,
                ...(grouping?.state === 'failed'
                  ? { note: 'last try failed' }
                  : {})
              }
        ]
      : [])
  ]
}

const showMore = (map: MapCanvas, anchor: HTMLElement) => {
  showMenu(map, anchor, [])
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  if (!menu || !stage) return
  menu.classList.add('is-more')
  menu.innerHTML = `<div class="map-more-row"><span>Appearance</span>${themeControl()}</div><hr><button type="button" data-map="shortcuts"><span>Shortcuts</span><small>?</small></button><button type="button" data-map="bare"><span>Hide the interface</span><small>⌘\\</small></button>`
  // Placed once it holds its rows, so it stays inside the canvas.
  place(menu, anchor, stage)
}

/** Opens or closes the notes panel, and remembers it. */
export const setNotes = (map: MapCanvas, open: boolean) => {
  map.root.querySelector('.map-page')?.classList.toggle('is-notes-open', open)
  map.root
    .querySelector('.map-notes-toggle')
    ?.setAttribute('aria-expanded', String(open))
  // Opening takes no focus, as Figma's panels don't: N closes them again.
  remember(NOTES_KEY, open ? 'open' : 'closed')
}

/** Shows or hides everything but the canvas (⌘\, as in Figma). */
export const setBare = (map: MapCanvas, bare: boolean) => {
  const page = map.root.querySelector('.map-page')
  page?.classList.toggle('is-bare', bare)
  let chip = map.root.querySelector<HTMLElement>('.map-bare-chip')
  if (bare && !chip) {
    const button = document.createElement('button')
    button.type = 'button'
    chip = button
    chip.className = 'map-bare-chip'
    chip.dataset.map = 'bare'
    chip.textContent = 'Show the interface  ⌘\\'
    map.root.querySelector('.map-stage')?.appendChild(chip)
  }
  if (chip) chip.hidden = !bare
}

/** A map opens: the notes panel as it was left; the interface shown. */
export const restoreChrome = (map: MapCanvas) => {
  setNotes(map, recall(NOTES_KEY) === 'open')
  setBare(map, false)
}

/** The view a map was left at, as Flora keeps one per project. True when
 * it was put back. */
export const restoreView = (map: MapCanvas) => {
  try {
    const saved = JSON.parse(recall(VIEW_KEY + map.mapId) || 'null') as {
      x?: unknown
      y?: unknown
      k?: unknown
    } | null
    const { x, y, k } = saved || {}
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof k !== 'number' ||
      ![x, y, k].every(Number.isFinite) ||
      k < 0.2 ||
      k > 2
    )
      return false
    map.camera = { x, y, k }
    map.applyCamera()
    return true
  } catch {
    return false
  }
}

/** The notes count beside Notes, with a dot while one is being sorted. */
export const noteCount = (map: MapCanvas) => {
  const notes = map.snapshot?.project.notes || []
  if (!notes.length) return ''
  const sorting = notes.some((note) => note.state === 'sorting')
  return `${sorting ? '<i class="map-note-busy" aria-label="sorting"></i>' : ''}${notes.length}`
}

/** The chrome's actions, before the canvas's own. True when it was one. */
export const chromeAction = (
  map: MapCanvas,
  name: string,
  target?: HTMLElement,
  reopened = false
) => {
  switch (name) {
    // The same button again closes its menu.
    case 'view-menu':
      if (target && !reopened) showMenu(map, target, viewChoices(map))
      return true
    case 'map-more':
      if (target && !reopened) showMore(map, target)
      return true
    case 'shortcuts': {
      const anchor = map.root.querySelector<HTMLElement>('.map-more-button')
      if (anchor) showHelp(map, anchor)
      return true
    }
    case 'notes':
      setNotes(
        map,
        !map.root
          .querySelector('.map-page')
          ?.classList.contains('is-notes-open')
      )
      return true
    case 'bare':
      setBare(
        map,
        !map.root.querySelector('.map-page')?.classList.contains('is-bare')
      )
      return true
  }
  return false
}

/** Zoom levels and the chrome's keys: ? for shortcuts, N for the notes,
 * T to talk, ⌘\ for the interface. */
export const installChrome = (map: MapCanvas) => {
  let saving: ReturnType<typeof setTimeout> | null = null
  map.onCamera.push(() => {
    if (saving) clearTimeout(saving)
    const id = map.mapId
    saving = setTimeout(() => {
      if (map.mapId === id) remember(VIEW_KEY + id, JSON.stringify(map.camera))
    }, 500)
    const next = detailFor(map.camera.k)
    const canvas = map.canvas
    canvas?.classList.toggle('is-far', next !== 'near')
    canvas?.classList.toggle('is-farthest', next === 'farthest')
    sayWhatFarHides(map)
  })
  globalThis.addEventListener?.('keydown', (event) => {
    if (!map.isOpen || event.defaultPrevented || dialogOpen()) return
    const e = event as KeyboardEvent
    const typing = (e.target as Element)?.closest?.(
      'input, textarea, select, [contenteditable]'
    )
    if (e.key === 'Escape') {
      const menu = map.slot('menu')
      if (menu && !menu.hidden) {
        hideMenu(map)
        e.preventDefault()
        return
      }
      // A note being written keeps its panel: Esc leaves the field first.
      if (typing) {
        ;(typing as HTMLElement).blur?.()
        e.preventDefault()
        return
      }
      if (map.root.querySelector('.map-page.is-notes-open')) {
        setNotes(map, false)
        e.preventDefault()
        return
      }
    }
    if (typing) return
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault()
      chromeAction(map, 'bare')
      return
    }
    const menu = map.slot('menu')
    if (e.metaKey || e.ctrlKey || e.altKey || (menu && !menu.hidden)) return
    if (e.key === '?') {
      e.preventDefault()
      const anchor = map.root.querySelector<HTMLElement>(
        '.map-zoom [data-map="help"]'
      )
      if (anchor) showHelp(map, anchor)
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault()
      hideMenu(map)
      chromeAction(map, 'notes')
    } else if (e.key.toLowerCase() === 't') {
      e.preventDefault()
      if (map.voice.on) map.voice.stop()
      else map.voice.start()
    }
  })
}
