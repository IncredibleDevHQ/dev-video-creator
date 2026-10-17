import { html } from '../shared/html'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'
import { modelName } from '../shared/agent-models'
import { videoOpens } from '../shared/state'

/** The visual overview follows real provenance and generated artifacts. */
export const projectContent = (s: ResearchViewState) =>
  html`<aside
    class="research-notes project-content"
    aria-label="Project content"
  >
    <div class="research-panel-heading">
      <div>
        <h2>Your ideas, connected</h2>
        <p>Follow what you learn from notes to a story worth sharing.</p>
      </div>
      <button data-research-action="close-content">Back to chat</button>
    </div>
    <div class="project-content-scroll">
      <section class="project-series-card">
        <div>
          <span class="project-content-kicker"
            >ONE PROJECT · ONE SHARED CANVAS</span
          >
          <h3>Bring the story together</h3>
          <p>
            Collect ideas across ${s.project.notebooks.length}
            ${s.project.notebooks.length === 1 ? 'notebook' : 'notebooks'}.
            Connect wireframes and shape your next series on the project canvas.
          </p>
        </div>
        ${s.project.canvasId
          ? html`<a
              class="research-primary"
              href="/?map=${s.project.canvasId}&space=${s.project.id}&detail=1"
              >Open project canvas ↗</a
            >`
          : html`<button
              class="research-primary"
              data-research-action="generate-canvas"
              ${s.pending || !s.project.notebooks.some((n) => n.blocks.length)
                ? 'disabled'
                : ''}
            >
              Create project canvas
            </button>`}
      </section>
      <div class="project-content-label">
        <span>From research to content</span
        ><label
          ><span class="sr">Jump to notebook content</span
          ><select id="research-jump">
            <option value="">Jump to a notebook…</option>
            ${s.project.notebooks
              .map(
                (n) => html`<option value="${n.id}">${escape(n.title)}</option>`
              )
              .join('')}
          </select></label
        >
      </div>
      <div class="project-content-board">
        ${s.project.notebooks
          .map((n) => {
            const snapshot = s.project.snapshots.find(
              (item) => item.project.id === n.id
            )
            const slides = snapshot?.project.slides || []
            const completed = slides.filter((slide) => Boolean(slide.svg))
            const url = `/?notebook=${n.id}&space=${s.project.id}&detail=1`
            const origins = [
              ...new Set(
                n.blocks.flatMap((b) => (b.origin ? [b.origin.nodeId] : []))
              )
            ]
            const questions = s.project.nodes.filter(
              (node) =>
                origins.includes(node.id) ||
                (node.anchor?.kind === 'note' &&
                  node.anchor.notebookId === n.id)
            )
            return html`<section
              class="project-content-notebook"
              id="wireframes-${n.id}"
            >
              <header>
                <div>
                  <h3>${escape(n.title)}</h3>
                  <p>
                    ${n.blocks.length}
                    ${n.blocks.length === 1 ? 'note' : 'notes'} ·
                    ${completed.length} wireframes
                  </p>
                </div>
                <button
                  data-select-notebook="${n.id}"
                  aria-label="Read ${escape(n.title)}"
                >
                  ↗
                </button>
              </header>
              <div class="project-notebook-flow">
                ${questions.length
                  ? html`<div class="project-visual-card">
                        <h4>Questions & answers</h4>
                        ${questions
                          .slice(-2)
                          .map(
                            (node) =>
                              html`<p>
                                <button data-research-node="${node.id}">
                                  ${escape(node.question)} ↗
                                </button>
                              </p>`
                          )
                          .join('')}${questions.length > 2
                          ? html`<small
                              >${questions.length - 2} more in your research
                              graph</small
                            >`
                          : ''}
                      </div>
                      <div class="project-flow-link">
                        Saved ideas & follow-up questions
                      </div>`
                  : ''}
                <div class="project-visual-card">
                  <h4>▤ Notebook</h4>
                  <p>
                    ${escape(
                      n.blocks.at(-1)?.text.slice(0, 220) ||
                        'A thought, a question, a discovery. Add your first note to begin.'
                    )}${(n.blocks.at(-1)?.text.length || 0) > 220 ? '…' : ''}
                  </p>
                  <button data-select-notebook="${n.id}">
                    ${n.blocks.length ? 'Read notebook' : 'Add a note'} ↗
                  </button>
                </div>
                <div class="project-flow-link">
                  ${completed.length
                    ? 'Generated wireframes'
                    : 'Turn notes into a story'}
                </div>
                <div class="project-visual-card">
                  <h4>▧ Wireframes</h4>
                  ${completed.length
                    ? html`<a
                        class="project-content-preview"
                        href="${url}&view=presentation"
                        aria-label="Open ${escape(n.title)} wireframes"
                        >${completed[0].svg}</a
                      >`
                    : ''}
                  ${snapshot?.status === 'draft' || !snapshot
                    ? html`<button
                          data-research-action="generate-notebook"
                          data-notebook-id="${n.id}"
                          class="research-primary"
                          ${!n.blocks.length || s.pending ? 'disabled' : ''}
                        >
                          Create wireframes</button
                        >${!n.blocks.length
                          ? '<small>Add a note to get started.</small>'
                          : html`<small
                              >Using
                              ${escape(
                                s.model
                                  ? modelName(s.model)
                                  : s.adapter === 'kimi'
                                    ? 'Kimi'
                                    : s.adapter === 'codex'
                                      ? 'Codex'
                                      : 'Claude Code'
                              )}</small
                            >`}`
                    : html`<div class="project-content-links">
                        <a href="${url}&view=presentation">Open wireframes ↗</a
                        >${snapshot && videoOpens(snapshot)
                          ? html`<a href="${url}&view=video"
                              >${snapshot.project.video
                                ? 'Open video'
                                : 'Create video'}
                              ↗</a
                            >`
                          : ''}
                      </div>`}
                  ${snapshot?.status === 'building'
                    ? '<small role="status">Drawing wireframes… Keep learning while they build.</small>'
                    : ''}
                  ${snapshot?.error
                    ? html`<small role="alert"
                        >${escape(snapshot.error)}</small
                      >`
                    : ''}
                  ${completed.length > 1
                    ? html`<details id="content-slides-${n.id}">
                        <summary>
                          Browse all ${completed.length} wireframes
                        </summary>
                        ${completed
                          .map(
                            (slide, i) =>
                              html`<figure>
                                <a
                                  class="project-content-preview"
                                  href="${url}&view=presentation"
                                  aria-label="Open wireframe ${i +
                                  1} in ${escape(n.title)}"
                                  >${slide.svg}</a
                                >
                                <figcaption>
                                  ${i + 1} · ${escape(slide.title)}
                                </figcaption>
                              </figure>`
                          )
                          .join('')}
                      </details>`
                    : ''}
                </div>
              </div>
            </section>`
          })
          .join('')}
      </div>
    </div>
  </aside>`
