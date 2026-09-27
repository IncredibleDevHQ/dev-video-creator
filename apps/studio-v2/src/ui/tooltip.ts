// The studio's own tooltips (the component audit): what a control's title
// says, in the studio's style — on hover after a moment, at once when the
// pointer moves on to the next control, and on keyboard focus to a control
// that is only an icon — with the key that does the same (aria-keyshortcuts). The operating system's tooltip —
// grey, a second late, never on focus — is held back while the pointer is
// over the control: its title is lent to the tooltip and given back when the
// pointer leaves, so whatever reads the title still finds it.
import './feedback.css'

const SHOW_AFTER = 450
const MOVE_ON_WITHIN = 600
const GAP = 8
const EDGE = 6

export type Tooltips = { hide: () => void; dispose: () => void }

export const installTooltips = (doc: Document = document): Tooltips => {
  const tip = doc.createElement('div')
  tip.className = 'ui-tooltip'
  tip.id = 'ui-tooltip'
  tip.setAttribute('role', 'tooltip')
  tip.hidden = true
  // In the top layer, so a control in an open dialog shows its tooltip over it.
  const layered = 'popover' in tip
  if (layered) tip.setAttribute('popover', 'manual')
  const open = () => {
    tip.hidden = false
    if (!layered) return
    try {
      if (tip.matches(':popover-open')) tip.hidePopover()
      tip.showPopover()
    } catch {
      // Out of the top layer it still shows, under a modal dialog.
    }
  }
  const close = () => {
    if (layered && tip.matches(':popover-open')) {
      try { tip.hidePopover() } catch { /* already closed */ }
    }
    tip.hidden = true
  }
  const words = doc.createElement('span')
  const key = doc.createElement('kbd')
  const arrow = doc.createElement('span')
  arrow.className = 'ui-tooltip-arrow'
  tip.append(words, key, arrow)
  doc.body.append(tip)

  let target: HTMLElement | null = null
  let lent: string | null = null
  let timer = 0
  let hiddenAt = -Infinity
  // A control that changes its title while it is lent (a transport that
  // says Play, then Pause): the new title is lent too, and shown.
  const watch = new MutationObserver(() => {
    if (!target?.hasAttribute('title')) return
    lent = target.getAttribute('title')
    target.removeAttribute('title')
    if (!tip.hidden) draw()
  })

  const labelOf = (element: HTMLElement) => (element.dataset.tooltip || lent || element.getAttribute('title') || '').trim()
  const place = () => {
    if (!target) return
    const around = target.getBoundingClientRect()
    const own = tip.getBoundingClientRect()
    let top = around.top - own.height - GAP
    let side = 'top'
    if (top < EDGE) {
      top = around.bottom + GAP
      side = 'bottom'
    }
    const left = Math.min(Math.max(EDGE, around.left + around.width / 2 - own.width / 2), window.innerWidth - own.width - EDGE)
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(top)}px`
    tip.dataset.side = side
    arrow.style.left = `${Math.round(Math.min(Math.max(10, around.left + around.width / 2 - left), own.width - 10))}px`
  }
  const draw = () => {
    if (!target || !target.isConnected) return hide()
    const label = labelOf(target)
    if (!label) return hide()
    words.textContent = label
    const shortcut = target.getAttribute('aria-keyshortcuts') || ''
    const shown = shortcut && !label.includes(`(${shortcut})`) ? shortcut.replace(/\+/g, ' ') : ''
    key.textContent = shown
    key.hidden = !shown
    open()
    place()
  }
  const lend = (element: HTMLElement) => {
    if (!element.hasAttribute('title')) return
    lent = element.getAttribute('title')
    element.removeAttribute('title')
    watch.observe(element, { attributes: true, attributeFilter: ['title'] })
  }
  const giveBack = () => {
    watch.disconnect()
    if (target && lent !== null && !target.hasAttribute('title')) target.setAttribute('title', lent)
    lent = null
  }
  const hide = () => {
    window.clearTimeout(timer)
    if (!target) return
    if (!tip.hidden) hiddenAt = performance.now()
    giveBack()
    target = null
    close()
  }
  const start = (element: HTMLElement, immediate: boolean) => {
    hide()
    target = element
    if (immediate || performance.now() - hiddenAt < MOVE_ON_WITHIN) draw()
    else timer = window.setTimeout(draw, SHOW_AFTER)
  }
  const owner = (node: EventTarget | null) =>
    node instanceof Element && !node.closest('[data-no-tooltip]') ? node.closest<HTMLElement>('[title], [data-tooltip]') : null

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const element = owner(event.target)
    if (!element || element === target) return
    start(element, false)
    lend(element)
  }
  const onPointerOut = (event: PointerEvent) => {
    if (!target) return
    const to = event.relatedTarget
    if (to instanceof Node && target.contains(to)) return
    hide()
  }
  // On keyboard focus, only for a control that shows no words of its own
  // (an icon): a menu's rows and a labelled button already say it.
  const onFocusIn = (event: FocusEvent) => {
    const element = owner(event.target)
    if (!element || !(event.target instanceof Element) || !event.target.matches(':focus-visible')) return
    if ((element.textContent || '').trim()) return
    if (element !== target) start(element, true)
  }
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
  doc.addEventListener('pointerover', onPointerOver, true)
  doc.addEventListener('pointerout', onPointerOut, true)
  doc.addEventListener('focusin', onFocusIn)
  doc.addEventListener('focusout', hide)
  doc.addEventListener('pointerdown', hide, true)
  doc.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', hide, true)
  window.addEventListener('blur', hide)
  const dispose = () => {
    hide()
    doc.removeEventListener('pointerover', onPointerOver, true)
    doc.removeEventListener('pointerout', onPointerOut, true)
    doc.removeEventListener('focusin', onFocusIn)
    doc.removeEventListener('focusout', hide)
    doc.removeEventListener('pointerdown', hide, true)
    doc.removeEventListener('keydown', onKey, true)
    window.removeEventListener('scroll', hide, true)
    window.removeEventListener('blur', hide)
    tip.remove()
  }
  return { hide, dispose }
}
