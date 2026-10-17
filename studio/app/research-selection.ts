import { html } from '../shared/html'
import type { ResearchAnchor } from '../shared/research'

export const captureResearchSelection = (
  root: HTMLElement
): ResearchAnchor | null => {
  const selected = getSelection()
  if (!selected?.rangeCount || selected.isCollapsed) return null
  const range = selected.getRangeAt(0)
  const element = (
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement
  ) as Element
  const passage = element.closest<HTMLElement>(
    '[data-select-response],[data-select-note]'
  )
  if (!passage || !root.contains(passage)) return null
  const before = range.cloneRange()
  before.selectNodeContents(passage)
  before.setEnd(range.startContainer, range.startOffset)
  const start = before.toString().length,
    end = start + range.toString().length
  if (end <= start || end - start > 7600) return null
  const isResponse = Boolean(passage.dataset.selectResponse)
  const selection: ResearchAnchor = {
    kind: isResponse ? 'response' : 'note',
    id: passage.dataset.selectResponse || passage.dataset.selectNote!,
    ...(isResponse ? {} : { notebookId: passage.dataset.notebookId }),
    start,
    end,
    text: range.toString()
  }
  const bar = root.querySelector<HTMLElement>('#research-selection')!
  bar.hidden = false
  bar.innerHTML = html`<span>${end - start} characters selected</span
    >${isResponse
      ? '<button data-research-action="save-selection">Save to notebook</button>'
      : ''}<button data-research-action="ask-selection">Ask about this ↗</button
    ><button
      data-research-action="dismiss-selection"
      aria-label="Dismiss selection"
    >
      ×
    </button>`
  return selection
}
