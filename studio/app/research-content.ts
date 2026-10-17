import { projectLink } from './project-links'
import { html } from '../shared/html'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'
import { videoOpens } from '../shared/state'

/** One next step per notebook; detailed editing stays in its own workspace. */
export const projectContent = (s: ResearchViewState) =>
  html`<aside
    class="research-notes project-content"
    aria-label="Project content"
  >
    <div class="research-panel-heading">
      <div>
        <h2>Make something from your notes</h2>
        <p>Choose a notebook. Shape its story, then make a video.</p>
      </div>
    </div>
    <div class="project-content-scroll">
      <div class="project-content-board">
        ${s.project.notebooks
          .map((n) => {
            const snapshot = s.project.snapshots.find(
              (item) => item.project.id === n.id
            )
            const completed =
              snapshot?.project.slides.filter((slide) => slide.svg) || []
            const url = projectLink(
              s.project.id,
              { ...s, notebook: n.id },
              { notebook: n.id, detail: '1' }
            )
            const ready = snapshot && videoOpens(snapshot)
            const building = snapshot?.status === 'building'
            const draft = !snapshot || snapshot.status === 'draft'
            return html`<section
              class="project-content-notebook project-creation-row"
              id="wireframes-${n.id}"
            >
              ${completed.length
                ? html`<a
                    class="project-content-preview"
                    href="${url}&view=presentation"
                    aria-label="Preview ${escape(n.title)} wireframes"
                    >${completed[0].svg}</a
                  >`
                : '<div class="project-creation-placeholder" aria-hidden="true">▤</div>'}
              <div class="project-creation-description">
                <h3>${escape(n.title)}</h3>
                <p>
                  ${n.blocks.length}
                  ${n.blocks.length === 1 ? 'note' : 'notes'}${completed.length
                    ? ` · ${completed.length} wireframes`
                    : ''}
                </p>
                <span
                  class="project-creation-status"
                  ${building ? 'role="status"' : ''}
                >
                  ${building
                    ? 'Drawing your story… You can keep taking notes.'
                    : snapshot?.project.video
                      ? 'Video started'
                      : completed.length
                        ? 'Your story is ready to review'
                        : n.blocks.length
                          ? 'Ready to shape into a story'
                          : 'Start with a note'}
                </span>
                ${snapshot?.error
                  ? `<p role="alert">${escape(snapshot.error)}</p>`
                  : ''}
              </div>
              <div class="project-creation-actions">
                ${!n.blocks.length
                  ? html`<button
                      class="research-primary"
                      data-select-notebook="${n.id}"
                    >
                      Add a note
                    </button>`
                  : draft
                    ? html`<button
                        class="research-primary"
                        data-research-action="generate-notebook"
                        data-notebook-id="${n.id}"
                        ${s.pending ? 'disabled' : ''}
                      >
                        Create wireframes
                      </button>`
                    : html`<a
                        class="research-primary"
                        href="${url}&view=${snapshot?.project.video
                          ? 'video'
                          : 'presentation'}"
                        >${snapshot?.project.video
                          ? 'Continue video'
                          : building
                            ? 'View progress'
                            : 'Review wireframes'}</a
                      >`}
                ${ready && !snapshot?.project.video
                  ? html`<a href="${url}&view=video">Create video →</a>`
                  : n.blocks.length
                    ? html`<button data-select-notebook="${n.id}">
                        Read notes
                      </button>`
                    : ''}
              </div>
            </section>`
          })
          .join('')}
      </div>
      <section class="project-series-card project-canvas-entry">
        <div>
          <h3>Plan a series together</h3>
          <p>Arrange ideas from all your notebooks on one visual canvas.</p>
        </div>
        ${s.project.canvasId
          ? html`<a
              href="${projectLink(s.project.id, s, {
                map: s.project.canvasId,
                detail: '1'
              })}"
              >Open project canvas →</a
            >`
          : html`<button
              data-research-action="generate-canvas"
              ${s.pending || !s.project.notebooks.some((n) => n.blocks.length)
                ? 'disabled'
                : ''}
            >
              Create project canvas →
            </button>`}
      </section>
    </div>
  </aside>`
