import type { ResearchAnchor } from '../shared/research'

/** Keep the existing form and its draft; only its presentation changes. */
export const floatBranchComposer = (
  root: HTMLElement,
  anchor: ResearchAnchor,
  collapsed: boolean
) => {
  const panel = root.querySelector<HTMLElement>('.research-compose-area')
  const transcript = root.querySelector<HTMLElement>('.research-transcript')
  if (!panel || !transcript) return
  panel.classList.add('research-floating-composer')
  panel.classList.toggle('is-collapsed', collapsed)
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-label', 'Passage question')
  const toggle = panel.querySelector<HTMLButtonElement>(
    '[data-research-action="toggle-branch-composer"]'
  )
  if (toggle) {
    toggle.textContent = collapsed ? '+' : '−'
    toggle.setAttribute('aria-expanded', String(!collapsed))
    toggle.setAttribute(
      'aria-label',
      collapsed ? 'Expand passage question' : 'Minimize passage question'
    )
  }
  const bounds = transcript.getBoundingClientRect()
  const width = Math.min(480, bounds.width - 24, window.innerWidth - 24)
  panel.style.width = `${Math.max(240, width)}px`
  const prose = root.querySelector<HTMLElement>(
    `[data-select-${anchor.kind}="${CSS.escape(anchor.id)}"]`
  )
  const passageLeft = prose?.getBoundingClientRect().left ?? bounds.left + 24
  panel.style.left = `${Math.max(12, Math.min(passageLeft, window.innerWidth - width - 12))}px`
  let bottom = bounds.bottom - panel.offsetHeight - 12
  if (prose) {
    // Find the source block without altering the selection or immutable offsets.
    let offset = 0
    const block = [...prose.children].find((el) => {
      offset += (el.textContent || '').length
      return offset >= anchor.end
    })
    if (block) bottom = block.getBoundingClientRect().bottom + 10
  }
  panel.style.top = `${Math.max(bounds.top + 12, Math.min(bottom, window.innerHeight - panel.offsetHeight - 12))}px`
}
