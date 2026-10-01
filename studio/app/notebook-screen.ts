import type { Snapshot } from '../shared/api'
import { escape, button } from './ui'
import { sourceMarkdown } from './source-markdown'
export const notebookScreen = (snapshot: Snapshot, pending: boolean) => {
  const { project, status } = snapshot
  return `<article class="notebook">${
    project.sourceUrl
      ? `<p>From <a href="${escape(
          project.sourceUrl
        )}" target="_blank" rel="noopener">${escape(project.sourceUrl)}</a>
</p>`
      : ''
  }<div class="source-document">${sourceMarkdown(project.source)}</div>
<form id="notebook-chat" class="chat">
<label class="sr" for="source-question">Ask about the source</label>
<input id="source-question" name="instruction" placeholder="Ask about the source…" ${
    status !== 'ready' ? 'disabled' : ''
  }>
<button aria-label="Send source question" ${
    status !== 'ready' || pending ? 'disabled' : ''
  }>↑</button>
</form>
<div class="reply">
<span>${escape(
    [...snapshot.events]
      .reverse()
      .find(
        event => event.kind === 'chat' && event.anchor?.stage === 'notebook'
      )?.message || ''
  )}</span>${button('History', 'history')}</div>
<p id="error" role="alert">
</p>
</article>`
}
