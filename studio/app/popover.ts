// A small panel under the control that opened it, closed by Escape, a click
// outside, or the control again. A picker can open inside a parent menu.
let current: { panel: HTMLElement; close: () => void; key: string } | null =
  null

export const closePopover = () => current?.close()
export const popoverOpen = (key: string) => current?.key === key

export const openPopover = (
  anchor: HTMLElement,
  key: string,
  content: string,
  className = '',
  onClose?: () => void
) => {
  if (current?.key === key) {
    current.close()
    return null
  }
  const parent = current?.panel.contains(anchor) ? current : null
  if (!parent) current?.close()
  const panel = document.createElement('div')
  panel.className = `popover ${className}`.trim()
  panel.setAttribute('role', 'dialog')
  panel.innerHTML = content
  ;(
    parent?.panel ||
    anchor.closest('dialog, .research-compose-tools') ||
    document.body
  ).append(panel)
  const place = () => {
    const box = anchor.getBoundingClientRect()
    const width = panel.offsetWidth
    // Right-aligned under the control, kept inside the window on both
    // sides, so a control near an edge never opens it off screen (review 7).
    let left = box.right - width
    if (left < 12) left = box.left
    left = Math.min(left, window.innerWidth - width - 12)
    panel.style.left = `${Math.round(Math.max(12, left))}px`
    // Under the control, or over it when the window ends first.
    const below = box.bottom + 8 + panel.offsetHeight <= window.innerHeight - 12
    panel.style.top = `${Math.round(below ? box.bottom + 8 : Math.max(12, box.top - 8 - panel.offsetHeight))}px`
  }
  place()
  const resize = new ResizeObserver(place)
  resize.observe(panel)
  const outside = (event: MouseEvent) => {
    const target = event.target as Node
    // The opening control toggles; it may have been redrawn since it opened.
    const toggle =
      target instanceof Element && target.closest(`[data-popover="${key}"]`)
    if (panel.contains(target) || anchor.contains(target) || toggle) return
    close()
  }
  const onKey = (event: KeyboardEvent) => {
    if (current?.panel !== panel) return
    if (event.key === 'Escape') {
      // Handled: what lies under the popover stays open (review 7).
      event.preventDefault()
      event.stopPropagation()
      close()
      anchor.focus?.()
    }
  }
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    if (current?.panel !== panel && panel.contains(current?.panel || null))
      current?.close()
    document.removeEventListener('mousedown', outside, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', place)
    document.removeEventListener('scroll', place, true)
    dialog?.removeEventListener('close', close)
    resize.disconnect()
    detached.disconnect()
    panel.remove()
    onClose?.()
    if (current?.panel === panel) current = parent
  }
  const detached = new MutationObserver(() => {
    if (!anchor.isConnected || !panel.isConnected) close()
  })
  detached.observe(document.body, { childList: true, subtree: true })
  const dialog = anchor.closest('dialog')
  dialog?.addEventListener('close', close)
  document.addEventListener('mousedown', outside, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', place)
  document.addEventListener('scroll', place, true)
  current = { panel, close, key }
  panel.querySelector<HTMLElement>('input,select,button')?.focus()
  return panel
}
