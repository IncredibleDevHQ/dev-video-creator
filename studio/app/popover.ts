// A small panel under the control that opened it, closed by Escape, a click
// outside, or the control again. One popover is open at a time.
let current: { panel: HTMLElement; close: () => void; key: string } | null =
  null

export const closePopover = () => current?.close()
export const popoverOpen = (key: string) => current?.key === key

export const openPopover = (
  anchor: HTMLElement,
  key: string,
  content: string,
  className = ''
) => {
  if (current?.key === key) {
    current.close()
    return null
  }
  current?.close()
  const panel = document.createElement('div')
  panel.className = `popover ${className}`.trim()
  panel.setAttribute('role', 'dialog')
  panel.innerHTML = content
  document.body.append(panel)
  const place = () => {
    const box = anchor.getBoundingClientRect()
    const width = panel.offsetWidth
    // Right-aligned under the control, kept inside the window.
    let left = box.right - width
    if (left < 12) left = Math.min(box.left, window.innerWidth - width - 12)
    panel.style.left = `${Math.round(Math.max(12, left))}px`
    panel.style.top = `${Math.round(box.bottom + 8)}px`
  }
  place()
  const outside = (event: MouseEvent) => {
    const target = event.target as Node
    // The opening control toggles; it may have been redrawn since it opened.
    const toggle =
      target instanceof Element && target.closest(`[data-popover="${key}"]`)
    if (panel.contains(target) || anchor.contains(target) || toggle) return
    close()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close()
      anchor.focus?.()
    }
  }
  const close = () => {
    document.removeEventListener('mousedown', outside, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', place)
    panel.remove()
    if (current?.panel === panel) current = null
  }
  document.addEventListener('mousedown', outside, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', place)
  current = { panel, close, key }
  panel.querySelector<HTMLElement>('input,select,button')?.focus()
  return panel
}
