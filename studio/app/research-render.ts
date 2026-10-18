/** Keep editor DOM identity when layout, agent controls, or background work
 * changes. Resource changes intentionally receive a different composer; drafts
 * are restored by the host using that resource's key. */
export const renderResearch = (
  root: HTMLElement,
  markup: string,
  previousKeys: Record<string, string>,
  keys: Record<string, string>
) => {
  const notebooksOpen = root
    .querySelector('#project-notebooks')
    ?.hasAttribute('open')
  const template = root.ownerDocument.createElement('template')
  template.innerHTML = markup
  for (const [id, key] of Object.entries(keys)) {
    if (previousKeys[id] !== key) continue
    const old = root.querySelector(`#${id}`)
    const next = template.content.querySelector(`#${id}`)
    if (old && next) next.replaceWith(old)
  }
  if (notebooksOpen === false)
    template.content
      .querySelector('#project-notebooks')
      ?.removeAttribute('open')
  root.replaceChildren(template.content)
}

export const researchScroll = (root: HTMLElement) =>
  [
    ...root.querySelectorAll<HTMLElement>(
      '.research-transcript,.research-note-scroll,.research-graph-scroll,.project-content-scroll,.research-artifact-scroll'
    )
  ].map((e) => [e.className, e.scrollTop, e.scrollLeft] as const)
export const restoreResearchScroll = (
  root: HTMLElement,
  positions: ReturnType<typeof researchScroll>
) => {
  for (const [cls, top, left] of positions) {
    const element = root.querySelector<HTMLElement>(
      `.${cls.split(' ').join('.')}`
    )
    if (element) {
      element.scrollTop = top
      element.scrollLeft = left
    }
  }
}

type Place = Pick<
  import('./research-view').ResearchViewState,
  'project' | 'notebook' | 'chat' | 'node' | 'contentOpen' | 'documentExpanded'
>
const placeKey = (s: Place) =>
  JSON.stringify([
    s.project.id,
    s.notebook,
    s.chat,
    s.node,
    Boolean(s.contentOpen),
    Boolean(s.documentExpanded)
  ])
/** A production detour returns to the exact reading position, not just its chat. */
export class ResearchReturn {
  private places = new Map<string, ReturnType<typeof researchScroll>>()
  save(root: HTMLElement, state: Place | null) {
    if (state) this.places.set(placeKey(state), researchScroll(root))
  }
  restore(root: HTMLElement, state: Place) {
    const positions = this.places.get(placeKey(state))
    if (positions) restoreResearchScroll(root, positions)
  }
}
