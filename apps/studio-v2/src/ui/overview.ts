// All pages, or all scenes, at once (O — as Open Slide's overview): their
// pictures in a grid over the stage, with their numbers and titles, opened
// on the one on show. The arrows move through it, a choice opens it, and
// Escape or O closes it, the keyboard back where it was.
import { icon } from './icons'

export type OverviewItem = { id: string; title: string; picture: string; note?: string; tone?: string }

const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | boolean | undefined> = {},
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue
    if (key === 'text') element.textContent = String(value)
    else if (value === true) element.setAttribute(key, '')
    else element.setAttribute(key, value)
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child)
  return element
}

export const folio = (value: number) => String(value).padStart(2, '0')

export const createOverview = ({ heading, noun, onPick, onClose }: {
  heading: string
  // What one item is called, for its label: "Page", "Scene".
  noun: string
  onPick: (id: string) => void
  onClose: () => void
}) => {
  const grid = h('ol', { class: 'pw-overview-grid' })
  const count = h('span', { class: 'pw-folio' })
  const close = h('button', { type: 'button', class: 'pw-icon-button', 'aria-label': `Close ${heading.toLowerCase()}`, title: `Close ${heading.toLowerCase()} (Esc)`, 'aria-keyshortcuts': 'Escape' }, icon('x'))
  const element = h('div', { class: 'pw-overview', role: 'dialog', 'aria-label': heading, hidden: true }, h('header', { class: 'pw-overview-head' }, h('strong', { text: heading }), count, close), grid)
  let open = false
  // Drawn again only when what it shows changes; the item that had the
  // keyboard keeps it.
  let shownKey = ''

  const render = (items: OverviewItem[], current: string) => {
    if (!open) return
    if (!items.length) {
      hide(false)
      return
    }
    count.textContent = `${folio(Math.max(1, items.findIndex(item => item.id === current) + 1))} / ${folio(items.length)}`
    const key = JSON.stringify([current, items.map(item => [item.id, item.title, item.note || '', item.tone || '', item.picture.length])])
    if (key === shownKey) return
    shownKey = key
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest('.pw-overview-page')?.getAttribute('data-item') || '' : ''
    grid.replaceChildren(
      ...items.map((item, index) => {
        const button = h('button', { type: 'button', class: `pw-overview-page${item.id === current ? ' is-current' : ''}`, 'data-item': item.id, 'aria-label': `${noun} ${index + 1}: ${item.title}${item.note ? ` — ${item.note}` : ''}`, 'aria-current': item.id === current ? 'true' : undefined },
          h('span', { class: 'pw-page-thumb' }, item.picture ? Object.assign(h('img', { alt: '', loading: 'lazy', draggable: 'false' }), { src: item.picture }) : null),
          h('span', { class: 'pw-overview-label' }, h('span', { class: 'pw-page-number', text: folio(index + 1) }), h('span', { class: 'pw-overview-title', text: item.title })),
          item.note ? h('span', { class: `pw-overview-note${item.tone ? ` is-${item.tone}` : ''}`, text: item.note }) : null,
        )
        button.addEventListener('click', () => {
          hide(false)
          onPick(item.id)
        })
        return h('li', {}, button)
      }),
    )
    if (focused) grid.querySelector<HTMLElement>(`[data-item="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true })
  }
  const show = (items: OverviewItem[], current: string) => {
    if (open || !items.length) return
    open = true
    shownKey = ''
    element.hidden = false
    render(items, current)
    grid.querySelector<HTMLElement>('.is-current')?.focus({ preventScroll: false })
  }
  const hide = (restore = true) => {
    if (!open) return
    open = false
    element.hidden = true
    if (restore) onClose()
  }
  // Rows of the grid, as the arrows walk it.
  const columns = () => {
    const first = grid.children[0] as HTMLElement | undefined
    if (!first) return 1
    let count = 0
    for (const child of Array.from(grid.children) as HTMLElement[]) {
      if (child.offsetTop !== first.offsetTop) break
      count += 1
    }
    return Math.max(1, count)
  }
  element.addEventListener('keydown', event => {
    if (event.key === 'Escape' || ((event.key === 'o' || event.key === 'O') && !event.metaKey && !event.ctrlKey && !event.altKey)) {
      event.preventDefault()
      event.stopPropagation()
      hide()
      return
    }
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns(), ArrowUp: -columns() }
    if (!(event.key in moves)) return
    const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('button'))
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    event.preventDefault()
    event.stopPropagation()
    buttons[Math.min(buttons.length - 1, Math.max(0, (at < 0 ? 0 : at) + moves[event.key]))]?.focus()
  })
  close.addEventListener('click', () => hide())

  return { element, show, hide, render, isOpen: () => open }
}
