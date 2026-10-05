import { html } from './ui'
import type { Snapshot } from '../shared/api'
import type { ChangeTarget, SlideChange } from '../shared/model'
import { agentNames } from './agent-setup'
import { escape, button } from './ui'
import { presentationProgress } from './progress'
import { wireframeStatus } from './wireframe-copy'

/** A rail entry: a drawn wireframe, or an outline scene not drawn yet. */
export type WireframeTile =
  | {
      kind: 'slide'
      index: number
      id: string
      title: string
      svg: string | null
    }
  | { kind: 'plan'; id: string; title: string; narration: string }

/**
 * The outline is the story: while pages are drawn, every planned scene shows
 * as a titled tile, so nothing that is missing is invisible (review 5).
 */
export const wireframeTiles = (snapshot: Snapshot): WireframeTile[] => {
  const slides = snapshot.project.slides
  const plan = snapshot.status === 'ready' ? [] : snapshot.plan || []
  const tiles: WireframeTile[] = plan.map((entry) => {
    const index = slides.findIndex((slide) => slide.id === entry.id)
    return index >= 0
      ? { kind: 'slide', index, ...slides[index], svg: slides[index].svg }
      : { kind: 'plan', ...entry }
  })
  slides.forEach((slide, index) => {
    if (!plan.some((entry) => entry.id === slide.id))
      tiles.push({ kind: 'slide', index, ...slide, svg: slide.svg })
  })
  return tiles
}

/** Which undrawn scenes the agent is drawing now (two at a time after the first). */
const drawingNow = (snapshot: Snapshot, tiles: WireframeTile[]) => {
  if (snapshot.status !== 'building' || snapshot.stopping) return new Set()
  const missing = tiles.filter((tile) => tile.kind === 'plan')
  const drawn = tiles.length - missing.length
  return new Set(missing.slice(0, drawn ? 2 : 1).map((tile) => tile.id))
}

const changeFor = (snapshot: Snapshot, slideId?: string) =>
  [...(snapshot.changes || [])]
    .reverse()
    .find((change) => change.slideId === slideId)

const changeBadge = (change?: SlideChange) =>
  !change
    ? ''
    : `<span class="tile-badge is-${change.state}">${change.state === 'working' ? 'changing' : change.state === 'queued' ? 'queued' : 'not changed'}</span>`

const changeChip = (snapshot: Snapshot, change?: SlideChange) => {
  if (!change) return ''
  const agent = snapshot.project.harness
    ? agentNames[snapshot.project.harness.adapter]
    : 'The agent'
  if (change.state === 'working')
    return `<div class="change-chip is-working" role="status"><i class="activity-orbit" aria-hidden="true"></i><span>${escape(agent)} is changing this wireframe: “${escape(change.instruction.slice(0, 90))}”</span></div>`
  if (change.state === 'queued')
    return `<div class="change-chip" role="status"><span>Waiting: “${escape(change.instruction.slice(0, 90))}”. ${snapshot.status === 'ready' ? 'Next in line.' : `${escape(agent)} changes it once every wireframe is drawn.`}</span></div>`
  return `<div class="change-chip is-failed" role="status"><span>${escape(change.message || 'This change did not finish.')}</span>${button('Send again', `resend-change:${change.id}`)}</div>`
}

const planStage = (
  snapshot: Snapshot,
  tile: Extract<WireframeTile, { kind: 'plan' }>,
  number: number,
  drawing: boolean
) => {
  const agent = snapshot.project.harness
    ? agentNames[snapshot.project.harness.adapter]
    : 'The agent'
  const state = drawing
    ? `${agent} is drawing this wireframe.`
    : snapshot.status === 'building'
      ? 'Waiting to be drawn.'
      : 'Not drawn yet. Try again continues from here.'
  return `<div class="plan-stage${drawing ? ' is-drawing' : ''}"><span class="plan-number">${String(number).padStart(2, '0')}</span><h2>${escape(tile.title)}</h2><p>${drawing ? '<i class="activity-orbit" aria-hidden="true"></i>' : ''}${escape(state)}</p></div>`
}

export const presentationScreen = (
  snapshot: Snapshot,
  selected: number,
  pendingChat = false,
  liveConnected = true,
  view: { plan?: string | null; pin?: ChangeTarget | null } = {}
) => {
  const { project, status } = snapshot
  const tiles = wireframeTiles(snapshot)
  const now = drawingNow(snapshot, tiles)
  const planTile = view.plan
    ? (tiles.find((tile) => tile.kind === 'plan' && tile.id === view.plan) as
        | Extract<WireframeTile, { kind: 'plan' }>
        | undefined)
    : undefined
  const slide = planTile ? undefined : project.slides[selected]
  const position = planTile
    ? tiles.indexOf(planTile)
    : tiles.findIndex(
        (tile) => tile.kind === 'slide' && tile.index === selected
      )
  const total = Math.max(tiles.length, snapshot.plannedSlides || 0)
  const change = changeFor(snapshot, slide?.id)
  const building = status === 'building'
  const drawn = Boolean(slide?.svg)
  // A drawn wireframe takes changes while the rest are drawn, or after a
  // stop; they run once the deck is finished (review 5).
  const canChange =
    drawn &&
    !snapshot.readOnly &&
    (status === 'ready' || building || status === 'failed')
  const exchange = [...snapshot.events]
    .reverse()
    .find(
      (event) =>
        event.kind === 'chat' &&
        event.anchor?.stage === 'presentation' &&
        event.anchor.slideId === slide?.id
    )
  const scriptEditable = status === 'ready' && !snapshot.readOnly && slide
  const script = planTile ? planTile.narration : slide?.narration || ''
  const pin = view.pin && slide && canChange ? view.pin : null
  return html`<section class="slides">
    <aside class="rail" aria-label="Wireframes">
      <div class="rail-heading">
        <strong>Wireframes <small>${total}</small></strong
        >${building
          ? button(
              snapshot.stopping ? 'Stopping…' : 'Stop',
              'stop-slides',
              false,
              Boolean(snapshot.stopping || snapshot.readOnly)
            )
          : html`<button
              data-action="add"
              aria-label="New wireframe"
              ${status !== 'ready' ? 'disabled' : ''}
            >
              +
            </button>`}
        <p>Each wireframe is one scene of your video.</p>
      </div>
      ${tiles
        .map((tile, order) => {
          const number = String(order + 1).padStart(2, '0')
          if (tile.kind === 'plan') {
            const drawing = now.has(tile.id)
            return html`<button
              class="thumbnail plan-tile ${drawing
                ? 'is-drawing'
                : ''} ${planTile?.id === tile.id ? 'selected' : ''}"
              data-plan="${escape(tile.id)}"
              aria-current="${planTile?.id === tile.id ? 'page' : 'false'}"
              aria-label="Wireframe ${order + 1}: ${escape(
                tile.title
              )}, ${drawing ? 'being drawn' : 'not drawn yet'}"
            >
              <span class="thumb-number" aria-hidden="true">${number}</span>
              <div class="plan-thumb">
                <b>${escape(tile.title)}</b
                ><small
                  >${drawing
                    ? 'Drawing…'
                    : building
                      ? 'Waiting'
                      : 'Not drawn'}</small
                >
              </div>
            </button>`
          }
          const isSelected = !planTile && tile.index === selected
          return html`<button
            class="thumbnail ${isSelected ? 'selected' : ''}"
            data-slide="${tile.index}"
            aria-current="${isSelected ? 'page' : 'false'}"
            draggable="${status === 'ready' ? 'true' : 'false'}"
            aria-label="Wireframe ${order + 1}: ${escape(
              tile.title || 'Blank wireframe'
            )}"
          >
            <span class="thumb-number" aria-hidden="true">${number}</span>
            <div>${tile.svg || '<span>Blank wireframe</span>'}</div>
            ${changeBadge(changeFor(snapshot, tile.id))}
          </button>`
        })
        .join('')}
    </aside>
    <div class="stage-area">
      ${status === 'failed' && !snapshot.sourceFailure
        ? html`<div class="run-notice is-stopped" role="status">
            <p>
              ${escape(wireframeStatus(snapshot.error || 'Drawing stopped.'))}
            </p>
            ${button(
              'Try again',
              'retry-slides',
              true,
              Boolean(snapshot.readOnly)
            )}
          </div>`
        : ''}${changeChip(snapshot, change)}
      <div
        class="stage ${pin ? 'is-pinning' : ''}"
        ${canChange ? 'data-pinnable' : ''}
      >
        ${planTile
          ? planStage(snapshot, planTile, position + 1, now.has(planTile.id))
          : slide?.svg ||
            (slide
              ? html`<div class="blank">
                  <h2>What is this wireframe about?</h2>
                  <p>Tell the studio below.</p>
                </div>`
              : presentationProgress(snapshot))}
      </div>
      <div class="slide-caption">
        <span
          >${position >= 0 ? `Wireframe ${position + 1} of ${total}` : ''}</span
        >${slide
          ? html`<button
              type="button"
              class="slide-menu-button"
              data-action="slide-menu"
              data-popover="slide-menu"
              aria-label="Wireframe actions"
            >
              •••
            </button>`
          : ''}
      </div>
      ${script || slide
        ? html`<section class="script-notes" aria-labelledby="script-heading">
            <h3 id="script-heading">
              Script
              <small
                >${scriptEditable
                  ? 'What the video says over this wireframe. Changes save as you type.'
                  : 'From the story. You can edit it once the wireframes are ready.'}</small
              >
            </h3>
            <textarea
              id="script-${escape(slide?.id || planTile?.id || '')}"
              data-script-slide="${escape(slide?.id || '')}"
              rows="3"
              aria-labelledby="script-heading"
              ${scriptEditable ? '' : 'readonly'}
            >
${escape(script)}</textarea
            >
          </section>`
        : ''}
      <form id="chat" class="chat ${pin ? 'has-pin' : ''}">
        ${pin
          ? html`<span class="pin-chip"
              >On: ${escape(pin.label || pin.kind || 'this part')}
              <button
                type="button"
                data-action="unpin"
                aria-label="Stop pointing at this part"
              >
                ×
              </button></span
            >`
          : ''}<label class="sr" for="instruction">Change this wireframe</label
        ><input
          id="instruction"
          name="instruction"
          placeholder="${pin
            ? 'Describe a change for this part…'
            : canChange
              ? 'Ask for a change, or click part of the wireframe to point at it'
              : 'Changes open once this wireframe is drawn'}"
          ${canChange ? '' : 'disabled'}
        /><button
          aria-label="Send instruction"
          ${!canChange || pendingChat ? 'disabled' : ''}
        >
          ↑
        </button>
      </form>
      <div class="reply">
        <span
          class="${exchange?.activity === 'failed' ||
          /^Could not/.test(exchange?.message || '')
            ? 'is-failed'
            : ''}"
          >${escape(
            !liveConnected
              ? 'Reconnecting… your work is saved.'
              : exchange && !change
                ? wireframeStatus(exchange.message)
                : status === 'ready' && !change
                  ? 'Wireframes ready. Check each one and its script, then Make the video, top right.'
                  : ''
          )}</span
        >${snapshot.sourceFailure
          ? button('Paste article text', 'paste-source', true)
          : ''}${snapshot.deletedSlide
          ? button('Undo delete', 'undo-delete')
          : ''}${button('Activity', 'history')}
      </div>
    </div>
  </section>`
}
