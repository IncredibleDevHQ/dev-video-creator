import type { ResearchProjectView } from '../shared/research'
import {
  researchDocumentFor,
  researchDocumentTitle
} from '../shared/research-documents'
import { projectLink, type ProjectContext } from './project-links'
import { escape } from './ui'
import './styles/project-views.css'

/** Both views carry the same channel, branch and notebook identity. */
export function projectViews(
  project: ResearchProjectView,
  context: ProjectContext,
  view: 'chat' | 'canvas'
) {
  const chat = project.chats?.find((c) => c.id === context.chat)
  const doc = researchDocumentFor(project.nodes, context.node || null)
  const book =
    project.notebooks.find((n) => n.id === context.notebook) ||
    project.notebooks[0]
  const repo = chat?.repos[0] || project.repository
  return `<div class="project-view-bar">
    <div class="project-view-history"><button type="button" data-project-history="back" aria-label="Go back" title="Back">←</button><button type="button" data-project-history="forward" aria-label="Go forward" title="Forward">→</button></div>
    <div class="project-view-identity"><strong>${escape(project.title)}</strong><span>${escape(repo?.branch || 'Project')}${chat ? ` · ${escape(chat.title)}` : ''}${doc && doc.anchor ? ` / ${escape(researchDocumentTitle(doc))}` : ''}</span></div>
    <nav class="project-view-switch" aria-label="Project views"><a href="${projectLink(project.id, { ...context, chatMinimized: false }, { projectView: 'research' })}" ${view === 'chat' ? 'aria-current="page"' : ''}>Chat</a><a href="${projectLink(project.id, context, { projectView: 'canvas' })}" ${view === 'canvas' ? 'aria-current="page"' : ''}>Canvas</a></nav>
    <button class="project-view-notebook" type="button" ${view === 'chat' ? 'data-research-action="open-notebook"' : 'data-project-notebook'} title="Open the shared notebook">▤ Notebook <span>${book?.blocks.length || 0}</span></button>
  </div>`
}
