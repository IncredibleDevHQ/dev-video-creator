import { html } from '../shared/html'
import { recentResearchChats } from '../shared/research-chats'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'
import incredibleLogo from './assets/incredible-logo.svg'

export const projectSidebar = (
  s: Pick<
    ResearchViewState,
    | 'project'
    | 'notebook'
    | 'chat'
    | 'contentOpen'
    | 'documentExpanded'
    | 'layout'
  >
) =>
  html`<aside class="project-sidebar" aria-label="Project workspace">
    <a
      href="/"
      class="project-brand"
      aria-label="Incredible Studio: all projects"
      ><img src="${incredibleLogo}" alt="" /><span>Incredible</span></a
    >
    <details class="project-switcher" id="project-switcher">
      <summary>${escape(s.project.title)} <span>⌄</span></summary>
      <div>
        <a href="/">All projects</a
        ><button data-research-action="rename-project">Rename project</button
        ><button data-research-action="new-project">New project</button>
      </div>
    </details>
    <button class="project-new-chat" data-research-action="new-chat">
      ＋ New chat
    </button>
    <nav aria-label="Project chats">
      <h2>Chats</h2>
      ${recentResearchChats(s.project.chats)
        .map(
          (c) =>
            html`<button
              data-select-chat="${c.id}"
              aria-current="${s.chat === c.id &&
              !s.contentOpen &&
              !s.documentExpanded
                ? 'page'
                : 'false'}"
              title="${escape(c.title)}"
            >
              <span aria-hidden="true">#</span
              ><span>${escape(c.title)}</span>${s.project.nodes.some(
                (n) => n.chatId === c.id && n.state === 'working'
              )
                ? '<i aria-label="Answer in progress"></i>'
                : ''}
            </button>`
        )
        .join('') || '<p>Your first question starts a chat.</p>'}
    </nav>
    <details class="project-notebooks" id="project-notebooks" open>
      <summary>Notebooks <span>${s.project.notebooks.length}</span></summary>
      ${s.project.notebooks
        .map(
          (n) =>
            html`<button
              data-select-notebook="${n.id}"
              aria-current="${s.notebook === n.id &&
              !s.contentOpen &&
              (s.documentExpanded || s.layout?.notesOpen)
                ? 'page'
                : 'false'}"
              title="${escape(n.title)}"
            >
              <span aria-hidden="true">▤</span><span>${escape(n.title)}</span>
            </button>`
        )
        .join('')}
      <button data-research-action="new-notebook">＋ New notebook</button>
    </details>
    <div class="project-sidebar-footer">
      <button
        data-research-action="open-content"
        aria-pressed="${Boolean(s.contentOpen)}"
      >
        <span aria-hidden="true">▧</span> Content
        <small>Notes → stories → videos</small>
      </button>
    </div>
  </aside>`

export const chatSwitcher = (s: ResearchViewState) => {
  const current = s.project.chats?.find((c) => c.id === s.chat)
  const notebook = s.project.notebooks.find((n) => n.id === s.notebook)
  return html`<header class="project-chat-header">
    <button
      class="project-sidebar-toggle"
      data-research-action="toggle-sidebar"
      aria-label="Toggle project navigation"
      aria-expanded="${Boolean(s.sidebarOpen)}"
    >
      ☰
    </button>
    <div class="project-chat-title">
      <h1>
        ${s.contentOpen
          ? `${escape(s.project.title)} / Content`
          : s.documentExpanded
            ? escape(notebook?.title || 'Notebook')
            : current
              ? `# ${escape(current.title)}`
              : 'Your workspace'}
      </h1>
      ${s.contentOpen || s.documentExpanded
        ? `<span class="project-tool-origin">${escape(s.project.title)}${s.documentExpanded ? ' · Notebook' : ''}</span>`
        : `<button data-research-action="open-notebook">Notes in ${escape(notebook?.title || 'your notebook')} <span>↗</span></button>`}
    </div>
    <div class="project-chat-actions">
      ${s.contentOpen || s.documentExpanded
        ? '<button data-research-action="close-content">Back to chat</button>'
        : `
      <button
        data-research-action="toggle-graph"
        aria-pressed="${Boolean(
          s.layout?.graphOpen && !s.contentOpen && !s.documentExpanded
        )}"
        aria-controls="research-graph-panel"
      >
        Graph
      </button>
      <button
        data-research-action="open-notebook"
        aria-pressed="${Boolean(
          s.layout?.notesOpen && !s.contentOpen && !s.layout?.expanded
        )}"
        aria-controls="research-notes-panel"
      >
        Notes
      </button>
      ${
        current
          ? '<button data-research-action="rename-chat" aria-label="Chat details" title="Chat details">···</button>'
          : ''
      }
      `}
    </div>
  </header>`
}
