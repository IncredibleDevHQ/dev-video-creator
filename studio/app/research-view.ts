import {
  artifactChatRail,
  activeResearchDocument,
  artifactGraph,
  researchArtifact
} from './research-artifact'
import { isResearchDocument } from '../shared/research-documents'
import { projectLink } from './project-links'
import { html } from '../shared/html'
import type {
  ResearchProjectView,
  ResearchNode,
  ResearchAnchor
} from '../shared/research'
import type { RepoLink, RepoInspection } from '../shared/repos'
import { researchHtml } from '../shared/research-markdown'
import { graphPanel, paneDivider } from './research-workbench-view'
import type { ResearchLayout } from './research-layout'
import { escape } from './ui'
import { chatSwitcher, projectSidebar } from './research-session-view'
import { projectContent } from './research-content'
import { modelName } from '../shared/agent-models'
import incredibleLogo from './assets/incredible-logo.svg'
export type ResearchViewState = {
  layout?: ResearchLayout
  sidebarOpen?: boolean
  contentOpen?: boolean
  documentExpanded?: boolean
  chatMinimized?: boolean
  project: ResearchProjectView
  tab: 'notes' | 'research' | 'wireframes' | 'canvas'
  notebook: string
  node: string | null
  chat?: string | null
  chatPositions?: Record<string, string | null>
  anchor: ResearchAnchor | null
  repos: RepoLink[]
  inspected: RepoInspection | null
  adapter: string
  model: string
  query: string
  pending: boolean
  message: string
  error: string
}
// Keep selectable contents byte-for-byte: template indentation must never
// change the offsets stored with an excerpt.
const passage = (attributes: string, content: string) =>
  '<div ' + attributes + '>' + content + '</div>'
const action = (name: string, label: string, cls = '', extra = '') =>
  html`<button
    type="button"
    data-research-action="${name}"
    class="${cls}"
    ${extra}
  >
    ${label}
  </button>`
const notebookPicker = (s: ResearchViewState) =>
  html`<label class="research-notebook-picker"
    ><span class="sr">Notebook</span
    ><select id="research-notebook">
      ${s.project.notebooks
        .map(
          (n) =>
            html`<option
              value="${n.id}"
              ${s.notebook === n.id ? 'selected' : ''}
            >
              ${escape(n.title)}
            </option>`
        )
        .join('')}
    </select></label
  >`
const noteQuestions = (
  s: ResearchViewState,
  notebookId: string,
  blockId: string
) => {
  const questions = s.project.nodes.filter(
    (node) =>
      node.anchor?.kind === 'note' &&
      node.anchor.notebookId === notebookId &&
      node.anchor.id === blockId
  )
  return questions.length
    ? html`<div class="research-note-links">
        <h3>Questions from this note</h3>
        ${questions
          .map(
            (node) =>
              html`<button data-research-node="${node.id}">
                ↳ ${escape(node.question)}
              </button>`
          )
          .join('')}
      </div>`
    : ''
}
export const notePanel = (s: ResearchViewState, compact = false) => {
  const n =
    s.project.notebooks.find((n) => n.id === s.notebook) ||
    s.project.notebooks[0]
  const output = s.project.snapshots.find((item) => item.project.id === n.id)
  const wireframes =
    output?.project.slides.filter((slide) => slide.svg).length || 0
  return html`<section
    class="research-notes ${compact ? 'compact' : ''}"
    id="research-notes-panel"
    aria-label="Notebook"
  >
    <div class="research-panel-heading">
      ${compact && !s.documentExpanded
        ? notebookPicker(s)
        : `<h1>${escape(n.title)}</h1>`}
      <div class="project-document-actions">
        ${action(
          'expand-document',
          s.documentExpanded ? 'Chat beside notes' : '⤢',
          '',
          `aria-label="${s.documentExpanded ? 'Chat beside notes' : 'Expand notebook'}"`
        )}${action(
          'rename-notebook',
          '···',
          '',
          'aria-label="Rename notebook"'
        )}
        ${!s.documentExpanded
          ? action(
              'open-notebook',
              '×',
              '',
              'aria-label="Close notebook panel"'
            )
          : ''}
      </div>
    </div>
    ${wireframes
      ? `<div class="project-notebook-outputs"><span>${wireframes} wireframes from these notes</span><a href="${projectLink(s.project.id, { ...s, notebook: n.id }, { detail: '1', notebook: n.id, view: 'presentation' })}">Open wireframes →</a></div>`
      : s.documentExpanded && n.blocks.length
        ? '<div class="project-notebook-outputs"><span>Ready to turn these notes into a story?</span><button data-research-action="open-content">Create from notes →</button></div>'
        : ''}
    <div class="research-note-scroll">
      ${n.blocks.length
        ? n.blocks
            .map(
              (b) =>
                html`<article
                  class="research-note"
                  data-note-block="${b.id}"
                  data-note-source="${b.origin?.nodeId || ''}"
                >
                  <div class="research-note-meta">
                    <span
                      >${b.origin ? 'Saved from research' : 'Your note'}</span
                    >${b.origin
                      ? html`<button
                          type="button"
                          data-research-node="${b.origin.nodeId}"
                        >
                          View source ↗
                        </button>`
                      : ''}
                  </div>
                  ${passage(
                    `class="research-note-text" data-select-note="${b.id}" data-notebook-id="${n.id}"`,
                    escape(b.text)
                  )}
                  ${b.origin
                    ? html`<details
                        class="research-note-provenance"
                        id="research-origin-${b.id}"
                      >
                        <summary>Source details</summary>
                        <small class="research-note-origin"
                          >${escape(b.origin.question)}${b.origin.repos
                            .map(
                              (r) =>
                                ` · ${escape(r.name)} @ ${r.commit.slice(0, 7)}`
                            )
                            .join('')}</small
                        >
                      </details>`
                    : ''}${noteQuestions(s, n.id, b.id)}<button
                    type="button"
                    data-note-ask="${b.id}"
                  >
                    Ask about this note ↗
                  </button>
                </article>`
            )
            .join('')
        : html`<div class="research-empty">
            <span class="research-empty-symbol">＋</span>
            <h3>A home for what you learn</h3>
            <p>
              Add a thought below, or save a passage from a research answer. Its
              source comes with it.
            </p>
          </div>`}
    </div>
    <form id="research-note-form">
      <label class="sr" for="research-note-input"
        >Add a note to ${escape(n.title)}</label
      ><textarea
        id="research-note-input"
        name="note"
        rows="3"
        maxlength="7600"
        placeholder="Keep a thought, a question, a discovery…"
        required
      ></textarea>
      <div class="research-composer-footer">
        <small>In ${escape(n.title)}</small
        ><button class="research-primary" ${s.pending ? 'disabled' : ''}>
          Add note
        </button>
      </div>
    </form>
  </section>`
}
const reply = (n: ResearchNode, s: ResearchViewState) =>
  html`<article class="research-turn" id="turn-${n.id}">
    <div class="research-question">
      <span class="research-message-meta"
        ><strong>You</strong
        ><time datetime="${escape(n.at)}"
          >${escape(
            new Date(n.at).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit'
            })
          )}</time
        ></span
      >
      <h2>${escape(n.question)}</h2>
      ${n.contextDocumentId
        ? `<button class="chat-message-document" data-research-node="${n.contextDocumentId}">In research document ↗</button>`
        : ''}
      ${n.anchor
        ? html`<details
            class="research-question-context"
            id="question-context-${n.id}"
          >
            <summary>
              Selected ${n.anchor.kind === 'note' ? 'notebook' : 'answer'}
              passage
            </summary>
            <blockquote>${escape(n.anchor.text)}</blockquote>
          </details>`
        : ''}
    </div>
    <div class="research-answer-heading">
      <span class="research-agent-mark"
        ><img src="${incredibleLogo}" alt="" /></span
      ><strong
        >${n.harness.adapter === 'claude-code'
          ? 'Claude Code'
          : n.harness.adapter === 'codex'
            ? 'Codex'
            : 'Kimi'}</strong
      ><small
        >${escape(n.harness.model ? modelName(n.harness.model) : '')}</small
      >
    </div>
    ${n.repos.length
      ? html`<details
          class="research-answer-sources"
          id="research-sources-${n.id}"
        >
          <summary>
            ${n.repos.length}
            ${n.repos.length === 1 ? 'repository' : 'repositories'}
          </summary>
          <div class="research-context-receipt">
            ${n.repos
              .map(
                (r) =>
                  html`<span title="${escape(r.path)}"
                    >${escape(r.name)} · ${escape(r.branch)}
                    <code>${r.commit.slice(0, 7)}</code></span
                  >`
              )
              .join('')}
          </div>
        </details>`
      : ''}
    ${n.state === 'done'
      ? html`${passage(
            `class="research-prose" data-select-response="${n.id}"`,
            researchHtml(n.answer)
          )}
          ${s.project.notebooks
            .filter((book) =>
              book.blocks.some((b) => b.origin?.nodeId === n.id)
            )
            .map(
              (book) =>
                html`<button
                  class="research-saved-link"
                  data-saved-source="${n.id}"
                  data-select-notebook="${book.id}"
                >
                  ▤ Saved in ${escape(book.title)} ↗
                </button>`
            )
            .join('')}
          ${isResearchDocument(n)
            ? `<button class="research-artifact-link" data-research-node="${n.id}">Open research document ↗</button>`
            : ''}
          <div class="research-answer-actions">
            <button type="button" data-save-answer="${n.id}">
              Save to notebook</button
            ><button type="button" data-branch-answer="${n.id}">
              Ask a follow-up ↗
            </button>
          </div>`
      : n.state === 'working'
        ? html`<div class="research-working" role="status">
            <i></i>${escape(n.activity || 'Researching…')}
            ${action('stop', 'Stop', '', `data-node-id="${n.id}"`)}
          </div>`
        : html`<div class="research-failure">
            ${escape(
              n.error || 'Stopped. Your earlier answers are kept.'
            )}<button type="button" data-retry-node="${n.id}">Ask again</button>
          </div>`}
  </article>`
const repoContext = (s: ResearchViewState) =>
  html`<details
    id="research-repos"
    class="research-repos"
    ${s.inspected ? 'open' : ''}
  >
    <summary>
      ${s.repos.length
        ? `${escape(s.repos[0].name)} · ${escape(s.repos[0].branch)}${s.repos.length > 1 ? ` +${s.repos.length - 1}` : ''}`
        : 'Choose repositories'}
    </summary>
    <div class="research-context-popover">
      <div class="research-context-title">
        <strong>Chat repositories</strong>${action(
          'close-context',
          '×',
          '',
          'aria-label="Close repository context"'
        )}
      </div>
      <p>
        Link up to four repositories and choose a branch for each. Context is
        saved to this chat; every answer records the exact commit it used.
      </p>
      <div class="research-context-editor">
        ${s.repos
          .map(
            (r, i) =>
              html`<div class="research-repo-chip">
                <span title="${escape(r.path)}"
                  >${escape(r.name)} <small>${escape(r.branch)}</small></span
                >${action(
                  'remove-repo',
                  '×',
                  '',
                  `data-index="${i}" aria-label="Remove ${escape(r.name)}"`
                )}
              </div>`
          )
          .join('')}
        <form id="research-repo-form">
          <label for="research-repo-path">Repository folder</label>
          <div class="research-inline">
            <input
              id="research-repo-path"
              name="path"
              placeholder="/Users/you/code/repository"
              required
            /><button ${s.pending ? 'disabled' : ''}>Find branches</button>
          </div>
        </form>
        ${s.inspected
          ? html`<form id="research-branch-form">
              <label for="research-repo-branch"
                >${escape(s.inspected.name)} · Branch</label
              >
              <div class="research-inline">
                <select id="research-repo-branch" name="branch">
                  ${s.inspected.branches
                    .map(
                      (b) =>
                        html`<option
                          ${b === s.inspected!.current ? 'selected' : ''}
                        >
                          ${escape(b)}
                        </option>`
                    )
                    .join('')}</select
                ><button ${s.repos.length >= 4 ? 'disabled' : ''}>
                  Add context
                </button>
              </div>
            </form>`
          : ''}
      </div>
    </div>
  </details>`
const chat = (s: ResearchViewState) => {
  const path = s.project.nodes.filter((n) => n.chatId === s.chat)
  const workingNode = s.project.nodes.find(
    (n) => n.chatId === s.chat && n.state === 'working'
  )
  const working = Boolean(workingNode)
  const unfinished = Boolean(s.node && path.at(-1)?.state !== 'done')
  return html`<section class="research-chat" aria-label="Research conversation">
    ${workingNode && workingNode.id !== s.node
      ? html`<button
          class="research-running-link"
          data-research-node="${workingNode.id}"
        >
          Your agent is answering in this chat · View progress →
        </button>`
      : ''}
    <div class="chat-document-context">
      ${activeResearchDocument(s)
        ? `Discussing: ${escape(activeResearchDocument(s)!.question.slice(0, 80))}`
        : 'Start a research conversation'}
    </div>
    <div class="research-transcript" aria-live="polite">
      ${path.length
        ? path.map((node) => reply(node, s)).join('')
        : html`<div class="research-chat-welcome">
            <span class="research-welcome-icon"
              ><img src="${incredibleLogo}" alt=""
            /></span>
            <h2>What are you exploring?</h2>
            <p>
              Choose repositories and branches below to research code. Your
              project notes are also available. Save useful answers as you go.
            </p>
          </div>`}
    </div>
    <div class="research-compose-area">
      ${s.anchor
        ? html`<div class="research-anchor">
            <span>Exploring a selected passage</span>${action(
              'clear-anchor',
              '×',
              '',
              'aria-label="Clear selected passage"'
            )}
            <blockquote>
              ${escape(s.anchor.text.slice(0, 500))}${s.anchor.text.length > 500
                ? '…'
                : ''}
            </blockquote>
          </div>`
        : s.node && (working || unfinished)
          ? html`<div class="research-branch-hint">
              ${path.at(-1)?.state === 'working'
                ? 'Your agent is researching this question. Keep notes or explore another path while it works.'
                : unfinished
                  ? 'To continue, use Ask again, choose an answered node, or start a new conversation.'
                  : 'Your next question branches from this answer. Earlier paths stay saved.'}
            </div>`
          : ''}
      <form id="research-question-form">
        <label class="sr" for="research-question">Research question</label
        ><textarea
          id="research-question"
          name="question"
          rows="2"
          maxlength="8000"
          placeholder="Message ${s.adapter === 'kimi'
            ? 'Kimi'
            : s.adapter === 'codex'
              ? 'Codex'
              : 'Claude Code'}…"
          required
        ></textarea>
      </form>
      <div class="research-compose-tools">
        <details class="research-agent-options" id="research-agent-options">
          <summary>
            ${s.adapter === 'claude-code'
              ? 'Claude Code'
              : s.adapter === 'kimi'
                ? 'Kimi'
                : 'Codex'}${s.model ? ` · ${escape(modelName(s.model))}` : ''}
            <span aria-hidden="true">⌄</span>
          </summary>
          <div class="research-agent-popover">
            <strong>Agent for this chat</strong>
            <label for="research-adapter">Local agent</label>
            <select id="research-adapter" ${s.pending ? 'disabled' : ''}>
              <option
                value="claude-code"
                ${s.adapter === 'claude-code' ? 'selected' : ''}
              >
                Claude Code
              </option>
              <option value="codex" ${s.adapter === 'codex' ? 'selected' : ''}>
                Codex
              </option>
              <option value="kimi" ${s.adapter === 'kimi' ? 'selected' : ''}>
                Kimi
              </option>
            </select>
            <label for="research-model">Model (optional)</label>
            <input
              id="research-model"
              maxlength="200"
              ${s.pending ? 'disabled' : ''}
              value="${escape(s.model)}"
              placeholder="Default model"
            />
            <p>
              Applies to your next answer. Earlier answers keep their original
              agent.
            </p>
          </div>
        </details>
        ${repoContext(s)}
        <button
          type="submit"
          form="research-question-form"
          class="research-primary research-send"
          aria-label="Send message"
          ${working || unfinished || s.pending ? 'disabled' : ''}
        >
          ${working ? 'Working…' : 'Send ↑'}
        </button>
      </div>
      <small class="research-send-hint"
        >Enter to send · Shift + Enter for a new line</small
      >
    </div>
  </section>`
}
export const researchWorkspaceView = (s: ResearchViewState) =>
  html`<div
    class="research-workspace project-workspace ${s.sidebarOpen
      ? 'sidebar-open'
      : ''}"
  >
    ${projectSidebar(s)}
    <button
      class="project-sidebar-scrim"
      data-research-action="toggle-sidebar"
      aria-label="Close project navigation"
      tabindex="-1"
    ></button>
    <div class="project-workspace-main">
      ${chatSwitcher(s)}
      ${s.error
        ? html`<div class="research-banner error" role="alert">
            ${escape(s.error)}${action('clear-error', 'Dismiss')}
          </div>`
        : ''}
      ${s.message
        ? html`<div class="research-banner" role="status">
            ${escape(s.message)}${action(
              'clear-message',
              '×',
              '',
              'aria-label="Dismiss notification"'
            )}
          </div>`
        : ''}
      ${s.project.syncError
        ? html`<div class="research-banner error" role="alert">
            Your notes are saved. Content sync needs attention:
            ${escape(s.project.syncError)}${action('sync', 'Retry sync')}
          </div>`
        : ''}
      <main
        class="research-columns ${activeResearchDocument(s) &&
        !s.contentOpen &&
        !s.documentExpanded
          ? 'has-research-artifact'
          : ''} ${s.chatMinimized ? 'artifact-chat-minimized' : ''} graph-${s
          .layout?.graphMode || 'pip'} ${!s.layout?.graphOpen
          ? 'graph-hidden'
          : ''} ${s.layout?.notesOpen !== true ? 'notes-hidden' : ''} ${s.layout
          ?.expanded
          ? 'graph-expanded'
          : ''} ${s.contentOpen
          ? 'content-expanded'
          : ''} ${s.documentExpanded && !s.contentOpen
          ? 'document-expanded'
          : ''}"
      >
        ${graphPanel(
          artifactGraph(s),
          activeResearchDocument(s)?.id || null,
          s.query,
          s.layout
        )}${s.layout?.expanded
          ? '<div aria-hidden="true"></div>'
          : paneDivider('graph')}
        ${artifactChatRail(s)}${chat(s)}${researchArtifact(s)}${paneDivider(
          'notes'
        )}${s.contentOpen ? projectContent(s) : notePanel(s, true)}
      </main>
    </div>
    <div id="research-selection" class="research-selection" hidden></div>
    <dialog id="research-dialog"></dialog>
  </div>`
