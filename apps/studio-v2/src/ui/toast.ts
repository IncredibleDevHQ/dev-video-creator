// The studio's toasts (the component audit): a card at the bottom right —
// what happened, a line of detail when there is one, one action when it
// helps, and a way to dismiss it — up to three stacked, the newest nearest
// the corner. They sit in the top layer, so a toast raised from a dialog
// shows over it. #toast stays the newest card: what reads it — its words,
// whether it is hidden — reads it as before.
import './feedback.css'
import { icon, type IconName } from './icons'

export type ToastTone = 'info' | 'good' | 'bad' | 'busy'
export type ToastOptions = {
  tone?: ToastTone
  detail?: string
  action?: { label: string; run: () => void }
  // How long it stays, in milliseconds; longer when it offers an action.
  duration?: number
}

const TONE_ICON: Record<ToastTone, IconName | null> = { info: null, good: 'check', bad: 'x', busy: 'loader-circle' }
const STACK = 3
const LEAVE_MS = 160

export const createToaster = (newest: HTMLElement) => {
  const region = document.createElement('section')
  region.className = 'ui-toasts'
  region.setAttribute('aria-label', 'Notifications')
  if ('popover' in region) region.setAttribute('popover', 'manual')
  newest.before(region)
  region.append(newest)
  newest.classList.add('ui-toast')
  newest.hidden = true

  let serial = 0
  const actions = new Map<string, () => void>()
  const timers = new WeakMap<HTMLElement, number>()

  const raise = () => {
    // Shown again on each toast, so it is above whatever opened since.
    if (!region.hasAttribute('popover')) return
    try {
      if (region.matches(':popover-open')) region.hidePopover()
      region.showPopover()
    } catch {
      // Without the top layer the region still shows, under a modal dialog.
    }
  }
  const settle = () => {
    const shown = [...region.querySelectorAll<HTMLElement>('.ui-toast:not([hidden])')]
    if (!shown.length && region.hasAttribute('popover')) {
      try { region.hidePopover() } catch { /* already hidden */ }
    }
  }
  const retire = (card: HTMLElement) => {
    window.clearTimeout(timers.get(card))
    if (card === newest) {
      newest.hidden = true
      settle()
      return
    }
    card.classList.add('is-leaving')
    window.setTimeout(() => {
      card.remove()
      settle()
    }, LEAVE_MS)
  }
  const schedule = (card: HTMLElement, ms: number) => {
    window.clearTimeout(timers.get(card))
    timers.set(card, window.setTimeout(() => retire(card), ms))
  }
  const fill = (card: HTMLElement, message: string, options: ToastOptions) => {
    const tone = options.tone || 'info'
    const id = String(++serial)
    card.dataset.toast = id
    card.dataset.tone = tone
    const mark = TONE_ICON[tone]
    const words = document.createElement('span')
    words.className = 'ui-toast-words'
    const title = document.createElement('span')
    title.className = 'ui-toast-title'
    title.textContent = message
    words.append(title)
    if (options.detail) {
      const detail = document.createElement('span')
      detail.className = 'ui-toast-detail'
      detail.textContent = options.detail
      words.append(detail)
    }
    const parts: Node[] = []
    if (mark) {
      const marked = icon(mark, 'ui-icon ui-toast-mark')
      parts.push(marked)
    }
    parts.push(words)
    if (options.action) {
      actions.set(id, options.action.run)
      const act = document.createElement('button')
      act.type = 'button'
      act.className = 'button small ui-toast-action'
      act.textContent = options.action.label
      parts.push(act)
    }
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.className = 'ui-toast-dismiss'
    dismiss.setAttribute('aria-label', 'Dismiss')
    dismiss.append(icon('x'))
    parts.push(dismiss)
    card.replaceChildren(...parts)
  }

  region.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    const card = target?.closest<HTMLElement>('.ui-toast')
    if (!card) return
    if (target?.closest('.ui-toast-dismiss')) retire(card)
    else if (target?.closest('.ui-toast-action')) {
      actions.get(card.dataset.toast || '')?.()
      retire(card)
    }
  })
  // A card held by the pointer stays until the pointer leaves it.
  region.addEventListener('pointerenter', () => [...region.querySelectorAll<HTMLElement>('.ui-toast')].forEach(card => window.clearTimeout(timers.get(card))), true)
  region.addEventListener('pointerleave', () => [...region.querySelectorAll<HTMLElement>('.ui-toast:not([hidden])')].forEach(card => schedule(card, 2400)))

  // The same news as the newest card, while it shows.
  const repeats = (message: string, options: ToastOptions) =>
    !newest.hidden && !options.action && newest.dataset.tone === (options.tone || 'info') &&
    newest.querySelector('.ui-toast-title')?.textContent === message &&
    (newest.querySelector('.ui-toast-detail')?.textContent || '') === (options.detail || '')

  return (message: string, options: ToastOptions = {}) => {
    // Said again: one card, its time started over, not a stack of copies.
    if (repeats(message, options)) {
      schedule(newest, options.duration ?? 4200)
      return
    }
    // The newest card moves up into the stack; #toast takes the new message.
    if (!newest.hidden && newest.textContent) {
      const older = newest.cloneNode(true) as HTMLElement
      older.removeAttribute('id')
      older.removeAttribute('role')
      older.removeAttribute('aria-live')
      region.insertBefore(older, newest)
      schedule(older, 2600)
      const cards = [...region.querySelectorAll<HTMLElement>('.ui-toast:not(#toast)')]
      cards.slice(0, Math.max(0, cards.length - (STACK - 1))).forEach(card => retire(card))
    }
    fill(newest, message, options)
    newest.hidden = false
    raise()
    schedule(newest, options.duration ?? (options.action ? 8000 : 4200))
  }
}
