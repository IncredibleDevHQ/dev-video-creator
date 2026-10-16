// One quiet tooltip for the whole studio, as Figma and Miro show theirs:
// quick (a third of a second, then at once while moving along a toolbar),
// beside the control, and with the shortcut set apart. It reads each
// control's own title, lending it for the moment it shows, so the markup
// keeps its titles and a screen reader keeps its names.
const DELAY = 350
const WARM = 600

let tip: HTMLElement | null = null
let owner: HTMLElement | null = null
let lent = ''
let timer: ReturnType<typeof setTimeout> | null = null
let warmUntil = 0

const layer = () => {
  if (!tip) {
    tip = document.createElement('div')
    tip.className = 'tooltip'
    tip.setAttribute('role', 'tooltip')
    tip.hidden = true
    document.body.appendChild(tip)
  }
  return tip
}

/** A title's words, with a trailing shortcut ("Comment · C") set apart. */
export const tipParts = (title: string) => {
  const match = /^(.*?)\s·\s(⌘?⇧?⌥?[A-Z0-9?\\/⌫←→↑↓]{1,3})(:\s*(.*))?$/.exec(
    title
  )
  if (!match) return { text: title, keys: '' }
  return {
    text: match[4] ? `${match[1]}: ${match[4]}` : match[1],
    keys: match[2]
  }
}

const place = (node: HTMLElement, at: DOMRect) => {
  const box = node.getBoundingClientRect()
  const below = at.bottom + 8 + box.height < innerHeight
  const left = Math.min(
    innerWidth - box.width - 8,
    Math.max(8, at.left + at.width / 2 - box.width / 2)
  )
  node.style.left = `${left}px`
  node.style.top = `${below ? at.bottom + 8 : at.top - box.height - 8}px`
}

const restore = () => {
  if (owner && lent && !owner.hasAttribute('title'))
    owner.setAttribute('title', lent)
  owner = null
  lent = ''
}

const hide = () => {
  if (timer) clearTimeout(timer)
  timer = null
  if (tip && !tip.hidden) {
    tip.hidden = true
    warmUntil = Date.now() + WARM
  }
  restore()
}

const show = (element: HTMLElement) => {
  const title = element.getAttribute('title') || ''
  if (!title || !element.isConnected) return
  owner = element
  lent = title
  // The browser's own tooltip would show too.
  element.removeAttribute('title')
  const node = layer()
  const { text, keys } = tipParts(title)
  node.textContent = text
  if (keys) {
    const kbd = document.createElement('kbd')
    kbd.textContent = keys
    node.append(kbd)
  }
  node.hidden = false
  place(node, element.getBoundingClientRect())
}

const target = (event: Event) =>
  (event.target as Element | null)?.closest?.<HTMLElement>(
    'button[title], a[title], [role="button"][title], input[title], label[title], [data-tip][title]'
  ) || null

export const installTooltips = () => {
  document.addEventListener('pointerover', (event) => {
    // Inside the control already showing: its title is lent, so look there.
    if (owner?.contains(event.target as Node)) return
    const element = target(event)
    if (!element) return
    hide()
    if ((event as PointerEvent).pointerType === 'touch') return
    timer = setTimeout(() => show(element), Date.now() < warmUntil ? 0 : DELAY)
  })
  document.addEventListener('pointerout', (event) => {
    const into = (event as PointerEvent).relatedTarget as Node | null
    const from = owner || target(event)
    if (!from || (into && from.contains(into))) return
    if (from.contains(event.target as Node)) hide()
  })
  document.addEventListener('focusin', (event) => {
    const element = target(event)
    if (!element || !element.matches(':focus-visible')) return
    hide()
    show(element)
  })
  document.addEventListener('focusout', hide)
  document.addEventListener('pointerdown', hide, true)
  document.addEventListener('keydown', hide, true)
  addEventListener('scroll', hide, true)
  addEventListener('blur', hide)
}
