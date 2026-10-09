/** Update the surrounding view without disconnecting media or the active notebook editor. */
function replaceView(
  root: HTMLElement,
  html: string,
  player: HTMLMediaElement | null
) {
  const template = document.createElement('template')
  template.innerHTML = html
  const media =
    template.content.querySelector<HTMLMediaElement>(
      '[data-scene-player],[data-take-player],[data-saved-presenter]'
    ) ||
    template.content.querySelector<HTMLMediaElement>(
      '[data-rehearsal-animation]'
    )
  const editor = root.querySelector<HTMLElement>('[data-notebook-editor]')
  const incomingEditor = template.content.querySelector<HTMLElement>(
    '[data-notebook-editor]'
  )
  const retained = player || editor
  const next = player ? media : incomingEditor
  if (
    !retained ||
    !next ||
    (player
      ? player.getAttribute('src') !== next.getAttribute('src')
      : editor?.dataset.notebookEditor !==
          incomingEditor?.dataset.notebookEditor ||
        (editor?.dataset.dirty !== 'true' &&
          editor?.dataset.sourceRevision !==
            incomingEditor?.dataset.sourceRevision))
  ) {
    root.replaceChildren(template.content)
    return false
  }
  const patch = (current: Element, replacement: Element | DocumentFragment) => {
    if (current === retained && !player) return
    if (replacement instanceof Element) {
      for (const attribute of [...current.attributes])
        if (!replacement.hasAttribute(attribute.name))
          current.removeAttribute(attribute.name)
      for (const attribute of [...replacement.attributes])
        if (current.getAttribute(attribute.name) !== attribute.value)
          current.setAttribute(attribute.name, attribute.value)
    }
    if (current === retained) return
    const kept = [...current.children].find(
      (child) => child === retained || child.contains(retained)
    )!
    const incoming = [...replacement.children].find(
      (child) => child === next || child.contains(next)
    )!
    patch(kept, incoming)
    for (const child of [...current.childNodes])
      if (child !== kept) child.remove()
    let before = true
    for (const child of [...replacement.childNodes]) {
      if (child === incoming) {
        before = false
        continue
      }
      current.insertBefore(child, before ? kept : null)
    }
  }
  patch(root, template.content)
  return true
}

// A scene's activity stays as the creator opened or closed it, across
// renders. Only their click on its summary is a choice: the state a panel
// was drawn in is not (seen live: a panel drawn closed before its scene
// started stayed closed while it planned, so the scene looked stuck).
const activityOpen = new Map<string, boolean>()
const watched = new WeakSet<HTMLElement>()
const watchActivity = (root: HTMLElement) => {
  if (watched.has(root)) return
  watched.add(root)
  root.addEventListener('click', (event) => {
    const summary = (event.target as Element | null)?.closest?.(
      '[data-activity-key] > summary'
    )
    const details = summary?.parentElement
    // The click toggles the panel after this: keep the state it moves to.
    if (details?.dataset.activityKey)
      activityOpen.set(
        details.dataset.activityKey,
        !details.hasAttribute('open')
      )
  })
}
export function replacePlayerView(
  root: HTMLElement,
  html: string,
  player: HTMLMediaElement | null
) {
  watchActivity(root)
  const scroll = root.querySelector('.transcript-scroll')?.scrollTop || 0
  const result = replaceView(root, html, player)
  root.querySelectorAll<HTMLElement>('[data-activity-key]').forEach((el) => {
    const value = activityOpen.get(el.dataset.activityKey!)
    if (value === true) el.setAttribute('open', '')
    if (value === false) el.removeAttribute('open')
  })
  const transcript = root.querySelector('.transcript-scroll')
  if (transcript) transcript.scrollTop = scroll
  return result
}
