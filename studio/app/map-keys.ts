// The map's keys and focus: ⌘C, ⌘X and ⌘V, ⌘Z and ⇧⌘Z, Delete and Esc,
// and a block reached with Tab brought into view as a pan would, never by
// scrolling the canvas.
import type { MapCanvas } from './map-canvas'
import { dialogOpen } from './ui'

/** Runs one of the map's actions by name, as its buttons do. */
type Dispatch = (map: MapCanvas, action: string) => Promise<unknown>

export const installMapKeys = (map: MapCanvas, dispatch: Dispatch) => {
  const root = map.root
  // Focus moves the camera, never the canvas: a card reached with Tab is
  // brought into view as a pan would, from where the layout puts it (the
  // camera may still be gliding).
  root.addEventListener('focusin', (event) => {
    const el = event.target as HTMLElement
    const canvas = map.canvas
    if (!canvas?.contains(el)) return
    // No focus scrolls the canvas itself, by mouse or by key: the camera is
    // the only view (review 7). Once now, and once after the browser's own.
    const still = () => {
      canvas.scrollLeft = 0
      canvas.scrollTop = 0
    }
    still()
    requestAnimationFrame(still)
    if (!el.classList?.contains('map-el') || !el.matches(':focus-visible'))
      return
    const at = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      el.style.transform
    )
    if (!at) return
    const { k } = map.camera
    const rect = canvas.getBoundingClientRect()
    const cover = map.covered(rect)
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
      rect.width - cover.right,
      40,
      40
    )
    const dy = nudge(
      map.camera.y + Number(at[2]) * k,
      el.offsetHeight * k,
      rect.height - cover.bottom,
      60,
      110
    )
    if (!dx && !dy) return
    map.camera.x += dx
    map.camera.y += dy
    map.applyCamera(true)
  })
  globalThis.addEventListener?.('keydown', (event) => {
    // A dialog open over the map has the keys (review 7).
    if (!map.isOpen || event.defaultPrevented || dialogOpen()) return
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
    } else if (mod && key === 'z') {
      // The last card reordered, moved or removed (review 8).
      e.preventDefault()
      void (e.shiftKey ? map.history.redo() : map.history.undo())
    } else if ((key === 'backspace' || key === 'delete') && sel?.t === 'copy') {
      e.preventDefault()
      void map.removeCopy(sel.id)
    } else if (key === 'escape') {
      // One Esc closes one thing: an open menu or the Notes panel is the
      // chrome's to close; then the selection goes.
      const menu = map.slot('menu')
      if (menu && !menu.hidden) return
      if (map.root.querySelector('.map-page.is-notes-open')) return
      // A comment, its recording or the comment tool closes first (review 7).
      if (map.comments.escapable) return
      e.preventDefault()
      // Then the queue's list, then a question in the bar, then what is
      // selected: one at a time.
      if (map.queueOpen) {
        map.queueOpen = false
        return map.paint()
      }
      // A question in the bar, then a direction being written: one each.
      const asking =
        map.naming ||
        map.changing ||
        map.renaming ||
        map.askingPlan ||
        map.noteAsk ||
        map.briefing
      if (asking) return void dispatch(map, 'cancel')
      if (map.editingDirection) return void dispatch(map, 'direction-cancel')
      map.select(null)
    }
  })
}
