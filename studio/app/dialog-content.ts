/** One close affordance: retain Cancel on forms, use a named X for other dialogs. */
export const dialogContent = (content: string) => {
  const template = document.createElement('div')
  template.innerHTML = content
  const closers = [...template.querySelectorAll('[data-action="close"]')]
  const cancel = closers.find(
    (button) => button.textContent?.trim() === 'Cancel'
  )
  for (const button of closers) {
    if (button === cancel) continue
    const parent = button.parentElement
    button.remove()
    if (parent?.classList.contains('dialog-actions') && !parent.children.length)
      parent.remove()
  }
  return `${cancel ? '' : '<button type="button" data-action="close" aria-label="Close dialog">×</button>'}<div class="dialog-body">${template.innerHTML}</div>`
}
