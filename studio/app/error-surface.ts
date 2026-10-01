/** One dismissible surface for failed actions, also available inside a modal. */
export const showError = (reason: unknown) => {
  let surface = document.querySelector<HTMLElement>('#studio-error')
  if (!surface) {
    surface = document.createElement('div')
    surface.id = 'studio-error'
    surface.className = 'error-surface'
    surface.setAttribute('role', 'alert')
    surface.innerHTML =
      '<span></span><button type="button" aria-label="Dismiss error">×</button>'
    surface
      .querySelector('button')!
      .addEventListener('click', () => surface!.remove())
  }
  surface.querySelector('span')!.textContent =
    reason instanceof Error ? reason.message : 'Could not complete that change'
  const host = document.querySelector('dialog[open]') || document.body
  host.append(surface)
}
