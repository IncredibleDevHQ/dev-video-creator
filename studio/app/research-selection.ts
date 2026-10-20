import {
  revealResearchSurface,
  releaseResearchSurface
} from './research-motion'
import { selectedText } from './research-conversation'
import { html } from '../shared/html'
import { escape } from './ui'
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
  if (element.closest('[data-research-ui]')) return null
  const passage = element.closest<HTMLElement>(
    '[data-select-response],[data-select-note]'
  )
  if (!passage || !root.contains(passage)) return null
  const before = range.cloneRange()
  before.selectNodeContents(passage)
  before.setEnd(range.startContainer, range.startOffset)
  const text = selectedText(range.cloneContents())
  const start = selectedText(before.cloneContents()).length,
    end = start + text.length
  if (end <= start || end - start > 7600) return null
  const isResponse = Boolean(passage.dataset.selectResponse)
  const selection: ResearchAnchor = {
    kind: isResponse ? 'response' : 'note',
    id: passage.dataset.selectResponse || passage.dataset.selectNote!,
    ...(isResponse ? {} : { notebookId: passage.dataset.notebookId }),
    start,
    end,
    text
  }
  const bar = root.querySelector<HTMLElement>('#research-selection')!
  const key = `${selection.id}:${start}:${end}`
  if (bar.dataset.selectionKey === key && !bar.hidden) return selection
  releaseResearchSurface(bar)
  bar.dataset.selectionKey = key
  bar.hidden = false
  bar.setAttribute('role', 'dialog')
  bar.setAttribute('aria-label', 'Selected passage')
  bar.innerHTML = html`<div class="selection-context">
      <span class="selection-quote" aria-hidden="true">“</span>
      <span class="selection-excerpt" title="${escape(text.slice(0, 1000))}"
        >${escape(text.slice(0, 240))}${text.length > 240 ? '…' : ''}</span
      >
      <button
        data-research-action="dismiss-selection"
        aria-label="Dismiss selection"
        title="Close · Esc"
      >
        ×
      </button>
    </div>
    <div class="selection-input">
      <textarea
        id="selection-comment"
        maxlength="2000"
        rows="1"
        aria-label="Question or optional note comment"
        placeholder="Ask a question or add a thought…"
      ></textarea
      ><button
        type="button"
        data-research-action="dictate-selection"
        aria-label="Dictate question or comment"
        title="Dictate · audio is transcribed by OpenAI"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="13" rx="3" />
          <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" />
        </svg>
      </button>
    </div>
    <small class="selection-status" role="status"></small>
    <footer>
      ${isResponse
        ? '<button class="selection-action selection-action-outline" type="button" data-research-action="save-selection" title="Save the excerpt with your optional comment"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h13v18H6a2 2 0 01-2-2V5a2 2 0 012-2ZM8 3v18M11 8h5M11 12h5"/></svg><span>Add to notebook</span></button>'
        : ''}<button
        class="selection-action selection-action-primary"
        type="button"
        data-research-action="ask-selection"
        disabled
        title="Write a question to start a new branch · ⌘/Ctrl + Enter"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="18" r="2" />
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M6 8v8M8 16c6 0 10-3 10-8" /></svg
        ><span>Ask follow-up</span>
      </button>
    </footer>`
  const input = bar.querySelector<HTMLTextAreaElement>('#selection-comment')!
  const ask = bar.querySelector<HTMLButtonElement>(
    '[data-research-action="ask-selection"]'
  )!
  input.addEventListener('input', () => {
    ask.disabled =
      !input.value.trim() || bar.getAttribute('aria-busy') === 'true'
    ask.title = input.value.trim()
      ? 'Start a new branch from this passage · ⌘/Ctrl + Enter'
      : 'Write a question to start a new branch · ⌘/Ctrl + Enter'
  })
  input.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.isComposing
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (!ask.disabled) ask.click()
    }
  })
  const rect = range.getBoundingClientRect()
  bar.classList.add('research-selection-near')
  bar.style.left = `${Math.max(
    12,
    Math.min(rect.left, window.innerWidth - bar.offsetWidth - 12)
  )}px`
  bar.style.top = `${Math.max(
    12,
    Math.min(rect.bottom + 8, window.innerHeight - bar.offsetHeight - 12)
  )}px`
  revealResearchSurface(bar, 'pop')
  return selection
}

/** Keep the same popover and draft intact while saving or recovering from failure. */
export const selectionSaving = (bar: HTMLElement | null, saving: boolean) => {
  if (!bar) return
  bar.setAttribute('aria-busy', String(saving))
  bar.querySelectorAll<HTMLButtonElement>('footer button').forEach((button) => {
    button.disabled =
      saving ||
      (button.dataset.researchAction === 'ask-selection' &&
        !bar
          .querySelector<HTMLTextAreaElement>('#selection-comment')
          ?.value.trim())
  })
  const label = bar.querySelector(
    '[data-research-action="save-selection"] span'
  )
  if (label) label.textContent = saving ? 'Saving…' : 'Add to notebook'
}
