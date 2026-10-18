import type { ResearchViewState } from './research-view'
import {
  researchDocumentFor,
  researchDocumentGraph
} from '../shared/research-documents'
import { researchHtml } from '../shared/research-markdown'
import { escape } from './ui'
export const activeResearchDocument = (s: ResearchViewState) =>
  researchDocumentFor(s.project.nodes, s.node)
export const artifactGraph = (s: ResearchViewState) =>
  researchDocumentGraph(s.project.nodes.filter((n) => n.chatId === s.chat))
export const researchTurnRequest = (
  s: ResearchViewState,
  question: FormDataEntryValue | null
) => ({
  question,
  notebookId: s.notebook,
  chatId: s.chat || undefined,
  parentId: s.anchor
    ? s.node
    : s.project.nodes
        .filter((n) => n.chatId === s.chat && n.state === 'done')
        .at(-1)?.id || null,
  contextDocumentId: activeResearchDocument(s)?.id,
  anchor: s.anchor,
  harness: { adapter: s.adapter, ...(s.model ? { model: s.model } : {}) },
  repos: s.repos
})
export const researchArtifact = (s: ResearchViewState) => {
  const doc = activeResearchDocument(s)
  if (!doc || s.contentOpen || s.documentExpanded) return ''
  const title =
    doc.answer.match(/^# (.+)$/m)?.[1] ||
    (doc.artifact ? doc.artifact.title : doc.question.slice(0, 100))
  return `<section class="research-artifact" aria-label="Research document">
    <header><div><small>Research document · separate from your notebook</small><h2>${escape(title)}</h2></div>
    ${s.chatMinimized ? '' : '<button data-research-action="minimize-chat" aria-label="Minimize chat panel">Minimize chat</button>'}</header>
    <div class="research-artifact-scroll artifact-${doc.id}">${doc.anchor ? `<blockquote class="artifact-origin">From a selected passage: ${escape(doc.anchor.text)}</blockquote>` : ''}
    ${
      doc.state === 'done'
        ? '<div class="research-prose" data-select-response="' +
          doc.id +
          '">' +
          researchHtml(doc.answer) +
          '</div>'
        : `<p role="status">${escape(doc.state === 'working' ? 'Creating this research document…' : doc.error || 'Document generation was stopped.')}</p>`
    }
    </div><footer>Select a passage to explore it in a child document, or save it to your notebook.</footer>
  </section>`
}

export const artifactChatRail = (s: ResearchViewState) =>
  s.chatMinimized &&
  activeResearchDocument(s) &&
  !s.documentExpanded &&
  !s.contentOpen
    ? '<button class="artifact-chat-restore" data-research-action="minimize-chat" aria-label="Show chat panel" title="Show chat">◌<span>Chat</span></button>'
    : ''
