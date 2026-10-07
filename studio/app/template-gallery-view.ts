// The template gallery page: a rail of the groups beside the lists
// (template-gallery-lists.ts) or one template opened: its directions as
// tabs, a player that walks its beats as that direction tells them, and
// what the story insists on. Every sketch is drawn in the notebook's look.
import incredibleLogo from './assets/incredible-logo.svg'
import { themeControl } from './appearance'
import { escape, html } from './ui'
import { galleryIcon } from './template-icons'
import { listPage } from './template-gallery-lists'
import {
  beatDot,
  beatStage,
  lookStyle,
  lowerFirst,
  telling,
  type GalleryState
} from './template-gallery-parts'
import type { Branding } from '../shared/settings'
import {
  DRAMA_LABELS,
  NARRATIVES,
  ON_CAMERA_LABELS,
  STORY_GROUPS,
  STRUCTURE_LABELS,
  allowedPresets,
  groupById,
  groupNarratives,
  lengthLabel,
  narrativeById,
  presetFor,
  type Narrative
} from '../shared/narratives'

export { lookStyle } from './template-gallery-parts'
export type { GalleryState, GalleryUse } from './template-gallery-parts'
export { templateResults } from './template-gallery-lists'

/** Said once, in the rail, when the previews take a notebook's look. */
const lookNote = (branding?: Branding) =>
  branding
    ? `<p class="tpl-rail-foot">${
        branding.look?.name
          ? `Previews use ${escape(branding.look.name)}, this notebook’s look.`
          : 'Previews use this notebook’s look.'
      }</p>`
    : ''

const useButton = (state: GalleryState, narrative: Narrative) => {
  const preset = presetFor(narrative, state.preset)
  const same = state.current.narrative === narrative.id
  if (same && presetFor(narrative, state.current.preset) === preset)
    return '<p class="tpl-use-note">This video tells it this way.</p>'
  if (!state.use)
    return '<p class="tpl-use-note">Open a notebook with finished wireframes to use it.</p>'
  const label =
    state.use === 'notebook'
      ? same
        ? 'Tell it this way →'
        : 'Use for this notebook →'
      : state.use === 'make'
        ? 'Use for this video →'
        : same
          ? 'Tell it this way →'
          : 'Switch this video to it →'
  return `<button type="button" class="primary" data-tpl-use="${narrative.id}" data-preset="${preset}">${label}</button><p class="tpl-use-note">${
    state.use === 'notebook'
      ? 'Your wireframes are planned from its beats.'
      : state.use === 'make'
        ? 'Camera and voice come next.'
        : 'Every scene is planned again.'
  }</p>`
}

/**
 * The player: one beat large, a caption saying what the viewer comes away
 * knowing, and the beats beside it as chapters with their time. Beats this
 * direction leaves out stay listed, dimmed.
 */
export const templatePlayer = (state: GalleryState, narrative: Narrative) => {
  const { plans, told } = telling(narrative, state.preset)
  const at = ((state.beat % told.length) + told.length) % told.length
  const shown = told[at]
  return html`<section
    class="tpl-player"
    aria-label="Beats"
    data-playing="${state.playing}"
  >
    <div class="tpl-player-main">
      ${beatStage(narrative, state.preset, at, {
        large: true,
        clickable: true
      })}
      <div class="tpl-player-bar">
        <button
          type="button"
          class="tpl-round"
          data-tpl-step="-1"
          aria-label="Previous beat"
        >
          ‹
        </button>
        <button
          type="button"
          class="tpl-round"
          data-tpl-play
          aria-label="${state.playing ? 'Pause' : 'Play'}"
          aria-pressed="${state.playing}"
        >
          ${state.playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          class="tpl-round"
          data-tpl-step="1"
          aria-label="Next beat"
        >
          ›
        </button>
        <p class="tpl-caption">
          <b>${escape(shown.beat.name)}</b
          ><span>${escape(shown.beat.know)}</span>${shown.expanded
            ? `<small>Grows: ${escape(shown.beat.expansions.map(lowerFirst).join('; '))}</small>`
            : ''}
        </p>
      </div>
    </div>
    <ol class="tpl-chapters" aria-label="Beats">
      ${plans
        .map((plan) => {
          const index = told.indexOf(plan)
          return plan.told
            ? html`<li>
                <button
                  type="button"
                  data-tpl-beat="${index}"
                  aria-current="${index === at}"
                >
                  ${beatDot(plan.beat.function)}<span
                    >${escape(plan.beat.name)}</span
                  ><small>${lengthLabel(plan.seconds)}</small>
                </button>
              </li>`
            : html`<li class="tpl-left-out" title="Left out in this telling">
                ${beatDot(plan.beat.function)}<span
                  >${escape(plan.beat.name)}</span
                ><small>—</small>
              </li>`
        })
        .join('')}
    </ol>
  </section>`
}

/** The directions as tabs, and the chosen one's settings in one line. */
const directions = (state: GalleryState, narrative: Narrative) => {
  const preset = presetFor(narrative, state.preset)
  const { settings } = telling(narrative, preset)
  return html`<div
      class="tpl-variants"
      role="tablist"
      aria-label="Ways to tell it"
    >
      ${allowedPresets(narrative)
        .map(
          (item) =>
            html`<button
              type="button"
              role="tab"
              aria-selected="${item.id === preset}"
              data-tpl-preset="${item.id}"
            >
              ${escape(item.name)}
            </button>`
        )
        .join('')}
    </div>
    <p class="tpl-detail-meta">
      ${[
        lengthLabel(settings.length),
        DRAMA_LABELS[settings.drama],
        ON_CAMERA_LABELS[settings.onCamera],
        STRUCTURE_LABELS[settings.structure]
      ]
        .map(escape)
        .join(' · ')}
    </p>`
}

const detail = (state: GalleryState, narrative: Narrative) => {
  const group = groupById(narrative.group)!
  return html`<div class="tpl-detail">
    <div class="tpl-detail-head">
      <div>
        <button type="button" class="tpl-crumb" data-tpl-group="${group.id}">
          ‹ ${escape(group.name)}
        </button>
        <h1>${escape(narrative.name)}</h1>
        <p class="tpl-lede">${escape(narrative.line)}</p>
      </div>
      <div class="tpl-use">${useButton(state, narrative)}</div>
    </div>
    ${directions(state, narrative)} ${templatePlayer(state, narrative)}
    <div class="tpl-insists">
      <section>
        <h2>It insists</h2>
        <ul>
          ${narrative.rules.map((rule) => `<li>${escape(rule)}</li>`).join('')}
        </ul>
      </section>
      <section>
        <h2>Your source needs</h2>
        <ul>
          ${narrative.needs
            .map(
              (need) =>
                `<li>${escape(need.charAt(0).toUpperCase() + need.slice(1))}</li>`
            )
            .join('')}
        </ul>
      </section>
    </div>
  </div>`
}

export const templateGalleryPage = (state: GalleryState) => {
  const narrative = narrativeById(state.narrative)
  const lit = narrative?.group ?? state.group
  const item = (id: string, name: string, count: number) =>
    html`<button
      type="button"
      data-tpl-group="${id}"
      aria-current="${lit === id ? 'page' : 'false'}"
    >
      ${galleryIcon(id)}<span>${escape(name)}</span><small>${count}</small>
    </button>`
  return html`<header>
      <a class="brand" href="/" aria-label="Incredible Studio"
        ><img src="${incredibleLogo}" alt="" />Incredible</a
      ><span>Templates</span>
      <div class="header-actions">
        ${themeControl()}<button type="button" data-tpl-close>
          ← ${escape(state.back)}
        </button>
      </div>
    </header>
    <main class="tpl-layout" style="${lookStyle(state.look)}">
      <nav class="tpl-rail" aria-label="Groups of templates">
        ${item('all', 'All templates', NARRATIVES.length)}
        ${STORY_GROUPS.map((group) =>
          item(group.id, group.name, groupNarratives(group.id).length)
        ).join('')}
        ${lookNote(state.look)}
      </nav>
      <section class="tpl-panel">
        ${narrative ? detail(state, narrative) : listPage(state)}
      </section>
    </main>`
}
