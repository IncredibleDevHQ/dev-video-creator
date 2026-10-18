/** Keep multiline drafting and IME composition intact while supporting chat send. */
export const installChatKeyboard = (root: HTMLElement) => {
  root.addEventListener('keydown', (event) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return
    const input = event.target as HTMLTextAreaElement
    if (input.id !== 'research-question') return
    event.preventDefault()
    const send = root.querySelector<HTMLButtonElement>('.research-send')
    if (input.value.trim() && send && !send.disabled)
      input.form?.requestSubmit(send)
  })
}
