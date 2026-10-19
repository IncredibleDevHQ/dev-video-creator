import type { ResearchAnchor, ResearchNode } from '../shared/research'
import { escape } from './ui'
/** Keyboard alternative to highlighting a passage in a long answer. */
export const chooseResearchPassage = (
  root: HTMLElement,
  node: ResearchNode
): Promise<ResearchAnchor | null> =>
  new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'research-passage-dialog'
    const first =
      node.answerText.split(/\n+/).find((p) => p.trim().length > 80) ||
      node.answerText.slice(0, 500)
    dialog.innerHTML = `<form><h2>Choose a passage to explore</h2><p>Keep the exact words you want to ask about. You can also highlight text directly in any answer.</p><label for="branch-passage">Selected passage</label><textarea id="branch-passage" rows="6" maxlength="7600">${escape(first.slice(0, 7600))}</textarea><p role="alert"></p><footer><button type="button" data-cancel>Cancel</button><button type="submit" class="research-primary">Ask follow-up</button></footer></form>`
    root.append(dialog)
    let result: ResearchAnchor | null = null
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove()
        resolve(result)
      },
      { once: true }
    )
    dialog
      .querySelector('[data-cancel]')!
      .addEventListener('click', () => dialog.close())
    dialog.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const text = dialog.querySelector('textarea')!.value.trim()
      const start = node.answerText.indexOf(text)
      if (!text || start < 0) {
        dialog.querySelector('[role="alert"]')!.textContent =
          'Keep an exact passage from this answer.'
        return
      }
      result = {
        kind: 'response',
        id: node.id,
        text,
        start,
        end: start + text.length
      }
      dialog.close()
    })
    dialog.showModal()
    dialog.querySelector('textarea')!.focus()
  })
