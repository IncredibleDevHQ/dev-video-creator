import { html } from '../shared/html'
import type {
  ResearchProjectView,
  ResearchNode,
  ResearchAnchor
} from '../shared/research'
import type { RepoLink, RepoInspection } from '../shared/repos'
import { researchPath } from '../shared/research'
import { researchHtml } from '../shared/research-markdown'
import {
  graphPanel,
  workbenchToolbar,
  paneDivider,
  ancestryTrail
} from './research-workbench-view'
import type { ResearchLayout } from './research-layout'
import { escape } from './ui'
import { chatSwitcher, collaborationLoop } from './research-session-view'
export type ResearchViewState = {
  layout?: ResearchLayout
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
    >Notebook<select id="research-notebook">
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
export const notePanel = (s: ResearchViewState, compact = false) => {
  const n =
    s.project.notebooks.find((n) => n.id === s.notebook) ||
    s.project.notebooks[0]
  return html`<section
    class="research-notes ${compact ? 'compact' : ''}"
    aria-label="Notebook"
  >
    <div class="research-panel-heading">
      ${notebookPicker(s)}${action(
        'new-notebook',
        '+',
        'research-icon',
        'aria-label="New notebook"'
      )}
    </div>
    ${compact ? collaborationLoop(s) : ''}
    <div class="research-note-scroll">
      ${n.blocks.length
        ? n.blocks
            .map(
              (b) =>
                html`<article class="research-note" data-note-block="${b.id}">
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
                    ? html`<small class="research-note-origin"
                        >${escape(b.origin.question)}${b.origin.repos
                          .map(
                            (r) =>
                              ` · ${escape(r.name)} @ ${r.commit.slice(0, 7)}`
                          )
                          .join('')}</small
                      >`
                    : ''}<button type="button" data-note-ask="${b.id}">
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
        <small>Saved to ${escape(n.title)}</small
        ><button class="research-primary" ${s.pending ? 'disabled' : ''}>
          Add note
        </button>
      </div>
    </form>
  </section>`
}
const reply = (n: ResearchNode) =>
  html`<article class="research-turn" id="turn-${n.id}">
    <div class="research-question">
      <span>You</span>
      <h2>${escape(n.question)}</h2>
      ${n.anchor ? html`<blockquote>${escape(n.anchor.text)}</blockquote>` : ''}
    </div>
    <div class="research-answer-heading">
      <span class="research-agent-mark">✳</span
      ><strong
        >${n.harness.adapter === 'claude-code'
          ? 'Claude Code'
          : n.harness.adapter === 'codex'
            ? 'Codex'
            : 'Kimi'}</strong
      ><small>${escape(n.harness.model || 'Default model')}</small>
    </div>
    ${n.repos.length
      ? html`<div class="research-context-receipt">
          ${n.repos
            .map(
              (r) =>
                html`<span title="${escape(r.path)}"
                  >${escape(r.name)} · ${escape(r.branch)}
                  <code>${r.commit.slice(0, 7)}</code></span
                >`
            )
            .join('')}
        </div>`
      : ''}
    ${n.state === 'done'
      ? html`${passage(
            `class="research-prose" data-select-response="${n.id}"`,
            researchHtml(n.answer)
          )}
          <div class="research-answer-actions">
            <button type="button" data-save-answer="${n.id}">
              Save answer to notebook</button
            ><button type="button" data-branch-answer="${n.id}">
              Branch from here ↗</button
            ><small>Select a passage to save or explore it.</small>
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
  html`<details class="research-repos" ${s.inspected ? 'open' : ''}>
    <summary>
      Repository context
      <span>${s.repos.length ? `${s.repos.length} linked` : 'Optional'}</span>
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
  const path = researchPath(s.project.nodes, s.node)
  const workingNode = s.project.nodes.find(
    (n) => n.chatId === s.chat && n.state === 'working'
  )
  const working = Boolean(workingNode)
  const session = s.project.chats?.find((c) => c.id === s.chat)
  const unfinished = Boolean(s.node && path.at(-1)?.state !== 'done')
  return html`<section class="research-chat" aria-label="Research conversation">
    <div class="research-chat-heading">
      <div>
        <span class="research-eyebrow">YOU + YOUR AGENT</span>
        <h2>
          ${escape(session?.title || 'What would you like to understand?')}
        </h2>
      </div>
      ${session ? action('rename-chat', 'Rename', 'research-secondary') : ''}
    </div>
    ${workingNode && workingNode.id !== s.node
      ? html`<button
          class="research-running-link"
          data-research-node="${workingNode.id}"
        >
          Your agent is answering in this chat · View progress →
        </button>`
      : ''}
    ${ancestryTrail(s.project.nodes, s.node)}
    <div class="research-transcript" aria-live="polite">
      ${path.length
        ? path.map(reply).join('')
        : html`<div class="research-chat-welcome">
            <span class="research-welcome-icon">✳</span>
            <h2>Bring a question. Build understanding.</h2>
            <p>
              Add repository context below, choose your agent, and ask. You
              guide the research and keep the useful answers in your notebooks.
            </p>
            <div class="research-hints">
              <span>01 &nbsp; Ask anything</span
              ><span>02 &nbsp; Follow a thread</span
              ><span>03 &nbsp; Save → create</span>
            </div>
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
        : s.node
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
          rows="3"
          maxlength="8000"
          placeholder="Ask a question. Follow an idea. Understand it deeply."
          required
        ></textarea>
        <div class="research-composer-footer">
          <div class="research-model">
            <label class="sr" for="research-adapter">Local agent</label
            ><select id="research-adapter" ${s.pending ? 'disabled' : ''}>
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
              </option></select
            ><label class="sr" for="research-model">Model (optional)</label
            ><input
              id="research-model"
              maxlength="200"
              ${s.pending ? 'disabled' : ''}
              value="${escape(s.model)}"
              placeholder="Default model"
              aria-label="Model (optional)"
            />
          </div>
          <button
            class="research-primary"
            ${working || unfinished || s.pending ? 'disabled' : ''}
          >
            ${working ? 'Researching…' : 'Ask ↗'}
          </button>
        </div>
      </form>
      <p class="research-next-agent">
        Agent and model apply to the next answer. Earlier answers keep their
        history.
      </p>
      ${repoContext(s)}
    </div>
  </section>`
}
export const researchWorkspaceView = (s: ResearchViewState) =>
  html`<div class="research-workspace">
    <header class="research-header">
      <a href="/" class="research-brand">✳ <span>Incredible</span></a
      ><span class="research-header-divider">/</span
      ><button
        data-research-action="rename-project"
        class="research-project-title"
      >
        ${escape(s.project.title)} <span>⌄</span>
      </button>
      <nav aria-label="Project views">
        ${(['notes', 'research', 'wireframes', 'canvas'] as const)
          .map((tab) =>
            action(
              `tab-${tab}`,
              tab === 'notes'
                ? 'Notebooks'
                : tab === 'canvas'
                  ? 'Shared canvas'
                  : tab[0].toUpperCase() + tab.slice(1),
              s.tab === tab ? 'active' : '',
              `aria-current="${s.tab === tab ? 'page' : 'false'}"`
            )
          )
          .join('')}
      </nav>
      <a class="research-legacy" href="/?legacy=1">Studio tools ↗</a>
    </header>
    ${s.error
      ? html`<div class="research-banner error" role="alert">
          ${escape(s.error)}${action('clear-error', 'Dismiss')}
        </div>`
      : ''}${s.message
      ? html`<div class="research-banner" role="status">
          ${escape(s.message)}
        </div>`
      : ''}${s.project.syncError
      ? html`<div class="research-banner error" role="alert">
          Your notes are saved. Wireframe sync needs attention:
          ${escape(s.project.syncError)}${action('sync', 'Retry sync')}
        </div>`
      : ''}
    ${s.tab === 'research'
      ? html`${chatSwitcher(s)}${workbenchToolbar(s.layout)}
          <main
            class="research-columns ${s.layout?.notesOpen === false
              ? 'notes-hidden'
              : ''} ${s.layout?.expanded ? 'graph-expanded' : ''}"
          >
            ${graphPanel(s.project.nodes, s.node, s.query, s.layout)}${s.layout
              ?.expanded
              ? '<div aria-hidden="true"></div>'
              : paneDivider('graph')}
            ${chat(s)}${paneDivider('notes')}${notePanel(s, true)}
          </main>`
      : s.tab === 'notes'
        ? html`<main class="research-notebooks-page">
            <aside>
              <span class="research-eyebrow">PROJECT NOTEBOOKS</span>
              <h1>A little space<br />for every idea.</h1>
              <p>Separate your subjects.<br />Keep one connected picture.</p>
              ${s.project.notebooks
                .map(
                  (n) =>
                    html`<button
                      class="research-notebook-row ${n.id === s.notebook
                        ? 'active'
                        : ''}"
                      data-select-notebook="${n.id}"
                    >
                      <span>▤ &nbsp; ${escape(n.title)}</span
                      ><small>${n.blocks.length} notes</small>
                    </button>`
                )
                .join('')}${action('new-notebook', '+ New notebook')}${action(
                'rename-notebook',
                'Rename notebook',
                'research-muted'
              )}
              <div class="research-next-step">
                Ready to connect the
                dots?${action(
                  'tab-research',
                  'Research with your notes ↗'
                )}${action('tab-canvas', 'See the shared canvas ↗')}
              </div>
            </aside>
            ${notePanel(s)}
          </main>`
        : s.tab === 'wireframes'
          ? wireframes(s)
          : canvas(s)}
    <div id="research-selection" class="research-selection" hidden></div>
    <dialog id="research-dialog"></dialog>
  </div>`
const wireframes = (s: ResearchViewState) =>
  html`<main class="research-wireframes">
    <div class="research-section-heading">
      <div>
        <span class="research-eyebrow">ONE CONTINUOUS VIEW</span>
        <h1>From notes to a story.</h1>
        <p>
          Scroll across notebooks, or jump to one. Every notebook contributes to
          the shared canvas.
        </p>
      </div>
      <label
        >Jump to notebook<select id="research-jump">
          <option value="">Choose notebook</option>
          ${s.project.notebooks
            .map(
              (n) => html`<option value="${n.id}">${escape(n.title)}</option>`
            )
            .join('')}
        </select></label
      >
    </div>
    ${s.project.notebooks
      .map((n) => {
        const snapshot = s.project.snapshots.find((v) => v.project.id === n.id)
        return html`<section id="wireframes-${n.id}" class="research-deck">
          <div class="research-deck-heading">
            <h2>▤ ${escape(n.title)}</h2>
            <span>${snapshot?.project.slides.length || 0} wireframes</span
            >${snapshot?.status === 'draft'
              ? action(
                  'generate-notebook',
                  'Create wireframes',
                  'research-primary',
                  `data-notebook-id="${n.id}" ${!n.blocks.length || s.pending ? 'disabled' : ''}`
                )
              : html`<a
                  href="/?notebook=${n.id}&view=presentation&space=${s.project
                    .id}&detail=1"
                  >Open editor ↗</a
                >`}
          </div>
          ${snapshot?.error
            ? html`<p role="alert">${escape(snapshot.error)}</p>`
            : ''}${snapshot?.status === 'building'
            ? '<p role="status">Creating wireframes… You can keep adding notes.</p>'
            : ''}
          <div class="research-wireframe-grid">
            ${snapshot?.project.slides
              .map(
                (slide, index) =>
                  html`<a
                    class="research-wireframe-card"
                    href="/?notebook=${n.id}&view=presentation&space=${s.project
                      .id}&detail=1"
                    ><div>${slide.svg || '<span>Drawing…</span>'}</div>
                    <h3>${index + 1}. ${escape(slide.title)}</h3></a
                  >`
              )
              .join('') ||
            html`<p class="research-deck-empty">
              ${snapshot?.status === 'building'
                ? 'Your first wireframes will appear here as they are ready.'
                : n.blocks.length
                  ? 'Your notes are saved. Create wireframes when you are ready to shape them into a story.'
                  : 'Add your first note to this notebook to get started.'}
            </p>`}
          </div>
        </section>`
      })
      .join('')}
  </main>`
const canvas = (s: ResearchViewState) =>
  html`<main class="research-canvas-page">
    <div class="research-section-heading">
      <div>
        <span class="research-eyebrow">ONE PROJECT · ONE CANVAS</span>
        <h1>Everything connects here.</h1>
        <p>
          Notes from every notebook feed the same content map and series. New
          notes join it automatically.
        </p>
      </div>
      ${s.project.canvasId
        ? html`<a
            class="research-primary"
            href="/?map=${s.project.canvasId}&space=${s.project.id}&detail=1"
            >Open interactive canvas ↗</a
          >`
        : action(
            'generate-canvas',
            'Create shared canvas',
            'research-primary',
            s.pending ? 'disabled' : ''
          )}
    </div>
    <div class="research-canvas-sources">
      ${s.project.notebooks
        .map(
          (n) =>
            html`<div>
              <span>▤</span>
              <h2>${escape(n.title)}</h2>
              <small>${n.blocks.length} saved notes</small>
            </div>`
        )
        .join('')}
    </div>
    <div class="research-canvas-connector">↓</div>
    <section class="research-canvas-output">
      <span class="research-eyebrow">SHARED CONTENT MAP</span>
      <h2>${escape(s.project.title)}</h2>
      <p>
        ${s.project.canvas?.status === 'building'
          ? 'Organizing your notes and drawing the shared wireframes…'
          : s.project.canvas?.project.slides.length
            ? `${s.project.canvas.project.slides.length} connected wireframes · ready to organize into episodes`
            : 'A unified picture of what you know, ready to become a series.'}
      </p>
      ${s.project.canvas?.error
        ? html`<p role="alert">${escape(s.project.canvas.error)}</p>`
        : ''}
      <div class="research-wireframe-grid">
        ${s.project.canvas?.project.slides
          .map(
            (slide) =>
              html`<div class="research-wireframe-card">
                <div>${slide.svg || ''}</div>
                <h3>${escape(slide.title)}</h3>
              </div>`
          )
          .join('') || ''}
      </div>
    </section>
  </main>`
