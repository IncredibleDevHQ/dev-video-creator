import type { Snapshot } from '../shared/api'
import { escape, button } from './ui'
import { sourceMarkdown } from './source-markdown'
import { noteRevision } from './notebook-editor'
import { notebookToolbar } from './notebook-toolbar'
import { notebookHint } from './notebook-next-step'
export const notebookScreen = (snapshot: Snapshot, pending: boolean) => {
  const { project, status } = snapshot
  const editable =
    !snapshot.readOnly &&
    !project.slides.length &&
    !project.video &&
    ['draft', 'failed'].includes(status)
  let sourceLabel = 'Your notes'
  try {
    if (project.sourceUrl)
      sourceLabel = new URL(project.sourceUrl).hostname.replace(/^www\./, '')
  } catch {}
  const words = project.source.trim().split(/\s+/).filter(Boolean).length
  const title = project.title.replace(/ \| [^|]+$/, '')
  // The article's own first heading is the title: show it once (review 5).
  const firstHeading = project.source
    .match(/^\s*#{1,2}\s+(.+)$/m)?.[1]
    ?.trim()
    .toLowerCase()
  const titled = firstHeading === title.trim().toLowerCase()
  return `<article class="notebook">
<div class="notebook-heading">
<div class="notebook-eyebrow">NOTEBOOK <span>·</span> ${words.toLocaleString()} words</div>
${titled ? '' : `<h1>${escape(title)}</h1>`}
<div class="notebook-meta">
<div class="notebook-source">${project.sourceUrl ? `<a href="${escape(project.sourceUrl)}" target="_blank" rel="noopener" title="Open original article">${escape(sourceLabel)} ↗</a>${editable ? button('Refresh', 'refresh-source') : ''}` : '<span>Your notes</span>'}</div>
</div>
${notebookHint(snapshot, editable)}</div>
${editable ? notebookToolbar() : ''}
<div class="notebook-body">
${status === 'reading' ? '<p class="source-reading" role="status"><span class="spinner" aria-hidden="true"></span> Reading your source…</p>' : ''}
${snapshot.sourceOnly && snapshot.error ? `<div class="source-error" role="alert"><p>${escape(snapshot.error)}</p>${snapshot.sourceFailure ? button('Paste article text', 'paste-source', true) : ''}</div>` : ''}
<div class="source-document" ${editable ? ` data-notebook-editor="${escape(project.id)}" data-source-revision="${noteRevision(project.source)}"` : ''}>
${sourceMarkdown(project.source, project.title)}</div>
${
  snapshot.sourceOnly
    ? ''
    : `<form id="notebook-chat" class="chat">
<label class="sr" for="source-question">Ask about the source</label>
<input id="source-question" name="instruction" placeholder="Ask about the source…" ${
        status !== 'ready' ? 'disabled' : ''
      }>
<button aria-label="Send source question" ${
        status !== 'ready' || pending ? 'disabled' : ''
      }>↑</button>
</form>`
}

<div class="reply">
<span>
${escape(
  [...snapshot.events]
    .reverse()
    .find(
      (event) => event.kind === 'chat' && event.anchor?.stage === 'notebook'
    )?.message || ''
)}</span>
${button('Activity', 'history')}</div>

</div></article>`
}
