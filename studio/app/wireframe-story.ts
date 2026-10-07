// The notebook's template on its wireframes: which beats a page carries,
// the evidence it still needs from the creator, and the core beats no page
// carries yet, each a click from a page of its own.
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import {
  EVIDENCE_LABELS,
  coverage,
  narrativeById,
  openRequests
} from '../shared/narratives'
import { escape, html } from './ui'

const dot = (fn: string) => `<i class="tpl-beat-dot" data-function="${fn}"></i>`

/** A page's beats and its open requests, under its caption. */
export const pageStory = (
  snapshot: Snapshot,
  slide: Slide | undefined,
  editable: boolean
) => {
  const narrative = narrativeById(snapshot.project.narrative)
  if (!narrative || !slide) return ''
  const beats = (slide.beats || [])
    .map((id) => narrative.beats.find((beat) => beat.id === id))
    .filter((beat) => beat !== undefined)
  const asks = openRequests([slide])
  const answered = slide.answers || []
  if (!beats.length && !asks.length && !answered.length) return ''
  return html`<section class="page-story" aria-label="This wireframe's story">
    ${beats.length
      ? html`<p class="page-beats">
          <span>Carries</span>${beats
            .map(
              (beat) =>
                `<b title="${escape(beat.know)}">${dot(beat.function)}${escape(beat.name)}</b>`
            )
            .join('')}
        </p>`
      : ''}
    ${asks.length
      ? html`<div class="evidence-asks">
          <h3>
            From you
            <small
              >Not in your source. The page is redrawn with what you add.</small
            >
          </h3>
          ${asks
            .map(
              ({ need }) =>
                html`<form
                  class="evidence-ask"
                  data-evidence-slide="${escape(slide.id)}"
                  data-evidence-what="${escape(need.what)}"
                >
                  <label for="ask-${escape(slide.id)}-${escape(need.what)}"
                    >${escape(
                      need.what.charAt(0).toUpperCase() + need.what.slice(1)
                    )}<small
                      >${escape(EVIDENCE_LABELS[need.kind])}</small
                    ></label
                  ><input
                    id="ask-${escape(slide.id)}-${escape(need.what)}"
                    name="answer"
                    placeholder="Your answer"
                    autocomplete="off"
                    ${editable ? '' : 'disabled'}
                  /><button type="submit" ${editable ? '' : 'disabled'}>
                    Add
                  </button>
                </form>`
            )
            .join('')}
        </div>`
      : ''}
    ${answered
      .map(
        (item) =>
          `<p class="evidence-given"><b>${escape(item.what)}</b> ${escape(item.answer)}</p>`
      )
      .join('')}
  </section>`
}

/** Core beats no page carries, in the rail, each with a page to add. */
export const storyGaps = (snapshot: Snapshot, editable: boolean) => {
  const narrative = narrativeById(snapshot.project.narrative)
  if (!narrative || snapshot.status !== 'ready') return ''
  const covered = coverage(
    narrative,
    snapshot.project.direction,
    snapshot.project.slides
  )
  if (!covered?.missing.length) return ''
  return html`<div class="story-gaps" role="status">
    <p>No wireframe carries</p>
    ${covered.missing
      .map(
        (beat) =>
          `<button type="button" data-action="add-beat" data-beat="${beat.id}" title="${escape(beat.know)}" ${editable ? '' : 'disabled'}>${dot(beat.function)}${escape(beat.name)} <span aria-hidden="true">+</span></button>`
      )
      .join('')}
  </div>`
}
