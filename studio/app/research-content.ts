import { projectLink } from './project-links'
import { html } from '../shared/html'
import type { ResearchViewState } from './research-view'
import { escape } from './ui'
import { videoOpens } from '../shared/state'

/** One next step per notebook; detailed editing stays in its own workspace. */
export const projectContent = (s: ResearchViewState) => {
  if (s.project.autoOrganize || s.project.canvasId) {
    const canvas = s.project.canvas
    const cards = canvas?.project.slides || []
    const url = canvas
      ? projectLink(s.project.id, s, { map: canvas.project.id, detail: '1' })
      : ''
    return `<aside class="research-notes project-content" aria-label="Wireframe canvas"><div class="research-panel-heading"><div><h2>Wireframe canvas</h2><p>Keep researching. Excerpts from your notebook become cards here.</p></div><button data-research-action="close-content" aria-label="Close canvas">×</button></div><div class="project-content-scroll"><p role="status">${escape(canvas?.error || s.project.syncError || (canvas?.status === 'building' ? 'Organizing your excerpts and drawing cards…' : cards.length ? `${cards.length} cards · new excerpts keep this canvas growing` : 'Your excerpts are saved. Preparing the canvas…'))}</p>${canvas?.status === 'failed' ? '<button class="research-primary" data-research-action="retry-canvas">Resume wireframes</button>' : ''}${url ? `<a class="research-primary" href="${url}">Open canvas →</a>` : ''}<div class="conversation-canvas-cards">${cards.map((card) => `<a href="${url}" class="project-content-notebook">${card.svg ? `<div class="project-content-preview">${card.svg}</div>` : ''}<h3>${escape(card.title)}</h3></a>`).join('')}</div><button data-research-action="open-notebook">Back to notebook</button></div></aside>`
  }
  const populated = s.project.notebooks.filter((n) => n.blocks.length)
  const seriesMap =
    s.project.canvasId || (populated.length === 1 ? populated[0].id : undefined)
  const seriesSources = s.project.snapshots.filter(
    (item) => item.project.mapSeries
  )
  if (
    s.project.canvas?.project.mapSeries &&
    !seriesSources.some(
      (item) => item.project.id === s.project.canvas!.project.id
    )
  )
    seriesSources.push(s.project.canvas)
  const continuingSeries = seriesSources.length > 0
  return html`<aside
    class="research-notes project-content"
    aria-label="Project content"
  >
    <div class="research-panel-heading">
      <div>
        <h2>
          ${continuingSeries
            ? 'Continue your series'
            : 'Turn your notes into a video'}
        </h2>
        <p>
          ${continuingSeries
            ? 'Your notes feed the series. Open it to review episodes and continue production, or keep collecting findings in your notebook.'
            : 'Start with a visual story draft: wireframes that show what each scene will say and show. Review the draft, then add narration and make your video.'}
        </p>
      </div>
    </div>
    <div class="project-content-scroll">
      ${seriesSources
        .map(
          (source) =>
            html`<section class="project-series-card project-canvas-entry">
              <div>
                <h3>
                  Series from
                  ${escape(
                    s.project.notebooks.find((n) => n.id === source.project.id)
                      ?.title || 'your project notes'
                  )}
                </h3>
                <p>
                  Review your episodes, see what is being generated, and pick up
                  the next step.
                </p>
              </div>
              <a
                class="research-primary"
                href="${projectLink(s.project.id, s, {
                  map: source.project.id,
                  detail: '1'
                })}"
                >Continue series →</a
              >
            </section>`
        )
        .join('')}
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
                    : snapshot?.project.mapSeries
                      ? 'Source cards for your series'
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
                        Create story draft
                      </button>`
                    : html`<a
                        class="${snapshot?.project.mapSeries
                          ? ''
                          : 'research-primary'}"
                        href="${url}&view=${snapshot?.project.video
                          ? 'video'
                          : 'presentation'}"
                        >${snapshot?.project.video
                          ? 'Continue video'
                          : building
                            ? 'View progress'
                            : snapshot?.project.mapSeries
                              ? 'Review source cards'
                              : 'Review story draft'}</a
                      >`}
                ${ready &&
                !snapshot?.project.video &&
                !snapshot?.project.mapSeries
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
      ${continuingSeries
        ? ''
        : html`<section class="project-series-card project-canvas-entry">
            <div>
              <h3>Build a series from your notes</h3>
              <p>
                Keep collecting in your notebook. Plan episodes on the content
                map, then let new findings organize into the series.
              </p>
            </div>
            ${seriesMap
              ? html`<a
                  href="${projectLink(s.project.id, s, {
                    map: seriesMap,
                    detail: '1'
                  })}"
                  >Open content map →</a
                >`
              : html`<button
                  data-research-action="generate-canvas"
                  ${s.pending ||
                  !s.project.notebooks.some((n) => n.blocks.length)
                    ? 'disabled'
                    : ''}
                >
                  Create project canvas →
                </button>`}
          </section>`}
    </div>
  </aside>`
}
