/** Keep editor DOM identity when layout, agent controls, or background work
 * changes. Resource changes intentionally receive a different composer; drafts
 * are restored by the host using that resource's key. */
export const renderResearch = (
  root: HTMLElement,
  markup: string,
  previousKeys: Record<string, string>,
  keys: Record<string, string>
) => {
  const template = root.ownerDocument.createElement('template')
  template.innerHTML = markup
  for (const [id, key] of Object.entries(keys)) {
    if (previousKeys[id] !== key) continue
    const old = root.querySelector(`#${id}`)
    const next = template.content.querySelector(`#${id}`)
    if (old && next) next.replaceWith(old)
  }
  root.replaceChildren(template.content)
}
