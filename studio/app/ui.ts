export { html } from '../shared/html'
export const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!
  )
export const button = (
  label: string,
  action: string,
  primary = false,
  disabled = false
) =>
  `<button type="button" data-action="${action}" ${primary ? 'class="primary"' : ''} ${disabled ? 'disabled' : ''}>${label}</button>`

/** Whether the creator is typing in a field inside this element. */
export const typingIn = (root: Element) => {
  const active = document.activeElement
  return Boolean(
    active &&
    root.contains(active) &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
  )
}

/** Disables a button while its request runs, and gives it back after. */
export const busy = async <T>(
  button: HTMLButtonElement,
  work: () => Promise<T>
) => {
  button.disabled = true
  try {
    return await work()
  } finally {
    button.disabled = false
  }
}
