import { html } from './ui'
import type { Snapshot } from '../shared/api'
import { escape, button } from './ui'
import { presentationProgress } from './progress'
import { wireframeStatus } from './wireframe-copy'
import { wireframeCanvasStatus } from './wireframe-progress'
export const presentationScreen = (
  snapshot: Snapshot,
  selected: number,
  pendingChat = false,
  liveConnected = true
) => {
  const { project, status } = snapshot
  const slide = project.slides[selected]
  const slides = project.slides
  const latestSlideEvent = [...snapshot.events]
    .reverse()
    .find(
      (event) =>
        event.kind === 'slide' ||
        (event.kind === 'chat' &&
          event.anchor?.stage === 'presentation' &&
          event.anchor.slideId === slide?.id)
    )
  const slideReply =
    status === 'ready'
      ? latestSlideEvent?.kind === 'chat'
        ? latestSlideEvent.message
        : 'Wireframes ready'
      : latestSlideEvent?.message
        ? wireframeStatus(latestSlideEvent.message)
        : undefined
  const pending = Boolean(
    status === 'building' &&
    !snapshot.stopping &&
    snapshot.plannedSlides &&
    slides.length < snapshot.plannedSlides
  )
  const validating =
    status === 'building' && !snapshot.stopping && !pending && slides.length > 0
  return html`<section class="slides">
    <aside class="rail" aria-label="Wireframes">
      <div class="rail-heading">
        <strong>Wireframes <small>${project.slides.length}</small></strong
        ><button
          data-action="add"
          aria-label="New wireframe"
          ${status !== 'ready' ? 'disabled' : ''}
        >
          +
        </button>
        <p>Each wireframe is one scene of your video.</p>
      </div>
      ${project.slides
        .map(
          (item, index) =>
            html`<button
              class="thumbnail ${index === selected ? 'selected' : ''}"
              data-slide="${index}"
              aria-current="${index === selected ? 'page' : 'false'}"
              draggable="true"
              aria-label="Wireframe ${index + 1}: ${escape(
                item.title || 'Blank wireframe'
              )}"
            >
              <span class="thumb-number" aria-hidden="true"
                >${String(index + 1).padStart(2, '0')}</span
              >
              <div>${item.svg || '<span>Blank wireframe</span>'}</div>
            </button>`
        )
        .join('')}${pending
        ? html`<div class="thumbnail slide-processing" role="status">
            <div class="slide-skeleton"></div>
            <span
              >Designing wireframe ${project.slides.length + 1} of
              ${snapshot.plannedSlides}</span
            >
          </div>`
        : validating
          ? '<p class="deck-validation" role="status"><span class="spinner" aria-hidden="true"></span>Checking your wireframes</p>'
          : ''}
    </aside>
    <div class="stage-area">
      ${wireframeCanvasStatus(snapshot, selected, pendingChat, liveConnected)}
      <div class="stage">
        ${slide?.svg ||
        (slide
          ? html`<div class="blank">
              <h2>What is this wireframe about?</h2>
              <p>Tell the studio below.</p>
            </div>`
          : presentationProgress(snapshot))}
      </div>
      <div class="slide-caption">
        <span
          >${project.slides.length
            ? ` ${status !== 'ready' ? 'Draft · ' : ''}Wireframe ${selected + 1} of ${snapshot.plannedSlides || project.slides.length}`
            : ''}</span
        >${slide
          ? html`<details class="slide-menu">
              <summary aria-label="Wireframe actions">•••</summary>
              <div>
                ${button(
                  'Duplicate',
                  'duplicate',
                  false,
                  status !== 'ready'
                )}${button(
                  'Move up',
                  'up',
                  false,
                  selected === 0 || status !== 'ready'
                )}${button(
                  'Move down',
                  'down',
                  false,
                  selected === project.slides.length - 1 || status !== 'ready'
                )}${button('Delete', 'delete', false, status !== 'ready')}
              </div>
            </details>`
          : ''}
      </div>
      <form id="chat" class="chat">
        <label class="sr" for="instruction">Change this wireframe</label
        ><input
          id="instruction"
          name="instruction"
          placeholder="Ask for a change, like “split this wireframe in two”"
          ${status !== 'ready' ? 'disabled' : ''}
        /><button
          aria-label="Send instruction"
          ${status !== 'ready' || pendingChat ? 'disabled' : ''}
        >
          ↑
        </button>
      </form>
      <div class="reply">
        <span
          >${escape(
            snapshot.error ||
              (pending
                ? `Designing wireframe ${slides.length + 1} of ${snapshot.plannedSlides} · ${slides.length} ${slides.length === 1 ? 'draft' : 'drafts'} saved`
                : validating
                  ? 'Checking your wireframes'
                  : slideReply) ||
              (status === 'ready'
                ? 'Your wireframes are ready. Check them, then Make the video, top right.'
                : '')
          )}</span
        >${status === 'building'
          ? button(
              snapshot.stopping ? 'Stopping…' : 'Stop generation',
              'stop-slides',
              false,
              Boolean(snapshot.stopping || snapshot.readOnly)
            )
          : ''}${snapshot.sourceFailure
          ? button('Paste article text', 'paste-source', true)
          : ''}${status === 'failed'
          ? button(
              snapshot.stopping ? 'Continue generation' : 'Try again',
              'retry-slides',
              !snapshot.sourceFailure,
              Boolean(snapshot.readOnly)
            )
          : ''}${snapshot.deletedSlide
          ? button('Undo delete', 'undo-delete')
          : ''}${button('History', 'history')}
      </div>
    </div>
  </section>`
}
