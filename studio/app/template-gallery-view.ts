// The template gallery page: a rail of the groups of stories beside the
// lists (template-gallery-lists.ts) or one template opened, with its
// storyboard player. Every sketch is drawn in the notebook's own look.
import incredibleLogo from './assets/incredible-logo.svg'
import { themeControl } from './appearance'
import { escape, html } from './ui'
import { galleryIcon } from './template-icons'
import { listPage } from './template-gallery-lists'
import {
  lookStyle,
  mmss,
  templateStage,
  typeDot,
  type GalleryState
} from './template-gallery-parts'
import type { Branding } from '../shared/settings'
import {
  SLOT_TYPES,
  STORY_GROUPS,
  TEMPLATE_STORIES,
  VIDEO_TEMPLATES,
  cameraShare,
  seamLine,
  storyById,
  storyTemplates,
  type SpeakerPlace,
  type VideoTemplate
} from '../shared/video-templates'

export { lookStyle, templateStage } from './template-gallery-parts'
export type { GalleryState, GalleryUse } from './template-gallery-parts'
export { templateResults } from './template-gallery-lists'

/** Where the creator appears in a slot, said to them. */
const PLACES: Record<SpeakerPlace, string> = {
  off: 'Off camera',
  corner: 'You in the corner',
  beside: 'You beside the slide',
  full: 'You full frame',
  over: 'You full frame, words over you'
}
/** How much of a template puts the creator on camera, in words. */
const onCamera = (template: VideoTemplate) => {
  const share = cameraShare(template)
  return share >= 0.85
    ? 'Throughout'
    : share >= 0.5
      ? 'Most of it'
      : share >= 0.2
        ? 'Some of it'
        : share > 0
          ? 'A little'
          : 'Not at all'
}

/** Said once, in the rail, when the previews take a notebook's look. */
const lookNote = (branding?: Branding) =>
  branding
    ? `<p class="tpl-rail-foot">${
        branding.look?.name
          ? `Previews use ${escape(branding.look.name)}, this notebook’s look.`
          : 'Previews use this notebook’s look.'
      }</p>`
    : ''

const useButton = (state: GalleryState, template: VideoTemplate) =>
  state.current === template.id
    ? '<p class="tpl-use-note">This video uses this template.</p>'
    : state.use
      ? `<button type="button" class="primary" data-tpl-use="${template.id}">${
          state.use === 'make'
            ? 'Use for this video →'
            : 'Switch this video to it →'
        }</button><p class="tpl-use-note">${
          state.use === 'make'
            ? 'You choose the camera and voice next.'
            : 'Every scene is planned again in this shape.'
        }</p>`
      : '<p class="tpl-use-note">Open a notebook with finished wireframes to use a template.</p>'

/**
 * The storyboard player: one slot large with its controls, and beside it
 * what the slot does and how the template feels.
 */
export const templatePlayer = (
  state: GalleryState,
  template: VideoTemplate
) => {
  const slot = template.slots[state.slot]
  const story = storyById(template.story)
  return html`<section
    class="tpl-player"
    aria-label="Storyboard"
    data-playing="${state.playing}"
  >
    <div class="tpl-player-main">
      ${templateStage(template, state.slot, { large: true, clickable: true })}
      <div class="tpl-player-bar">
        <button
          type="button"
          class="tpl-round"
          data-tpl-step="-1"
          aria-label="Previous slot"
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
          aria-label="Next slot"
        >
          ›
        </button>
        <span class="tpl-player-where"
          >Slot ${state.slot + 1} of ${template.slots.length}</span
        >
        <span class="tpl-player-time"
          >${mmss(slot.from)}–${mmss(slot.to)} of
          ${mmss(template.seconds)}</span
        >
      </div>
    </div>
    <div class="tpl-player-side">
      <div class="tpl-now">
        <h2>${escape(slot.role)}</h2>
        <p>${escape(slot.move)}</p>
        <p class="tpl-now-meta">
          ${typeDot(slot.type)}${SLOT_TYPES[slot.type].label} ·
          ${PLACES[slot.speaker]} · ${seamLine(slot.seam)}
        </p>
      </div>
      <dl class="tpl-facts">
        <dt>For</dt>
        <dd>${escape(story.audience)}</dd>
        <dt>Tone</dt>
        <dd>${escape(template.tone)}</dd>
        <dt>Pacing</dt>
        <dd>${escape(template.pacing)}</dd>
        <dt>On camera</dt>
        <dd>${onCamera(template)}</dd>
      </dl>
    </div>
  </section>`
}

/** The other ways to tell the same story, as tabs above the player. */
const variantTabs = (template: VideoTemplate) => {
  const siblings = storyTemplates(template.story)
  return siblings.length < 2
    ? ''
    : html`<div
        class="tpl-variants"
        role="tablist"
        aria-label="Ways to tell it"
      >
        ${siblings
          .map(
            (item) =>
              html`<button
                type="button"
                role="tab"
                aria-selected="${item.id === template.id}"
                data-tpl-open="${item.id}"
              >
                ${escape(item.name)}
              </button>`
          )
          .join('')}
      </div>`
}

const detail = (state: GalleryState, template: VideoTemplate) => {
  const story = storyById(template.story)
  return html`<div class="tpl-detail">
    <div class="tpl-detail-head">
      <div>
        <button type="button" class="tpl-crumb" data-tpl-story="${story.id}">
          ‹ ${escape(story.name)}
        </button>
        <h1>${escape(template.name)}</h1>
        <p class="tpl-lede">${escape(template.purpose)}</p>
      </div>
      <div class="tpl-use">${useButton(state, template)}</div>
    </div>
    ${variantTabs(template)} ${templatePlayer(state, template)}
    <section class="tpl-slots" aria-label="Slots">
      <div class="tpl-slots-head">
        <h2>The slots</h2>
        <p>Your scenes take them in order.</p>
      </div>
      <ol>
        ${template.slots
          .map(
            (item, index) =>
              html`<li>
                <button
                  type="button"
                  data-tpl-slot="${index}"
                  aria-current="${index === state.slot}"
                >
                  <span class="tpl-slot-n">${index + 1}</span>
                  <b class="tpl-slot-role">${escape(item.role)}</b>
                  <span class="tpl-slot-type"
                    >${typeDot(item.type)}${SLOT_TYPES[item.type].label}</span
                  >
                  <span class="tpl-slot-time"
                    >${mmss(item.from)}–${mmss(item.to)}</span
                  >
                </button>
              </li>`
          )
          .join('')}
      </ol>
    </section>
  </div>`
}

/** The group the rail lights: the open template's, the story's, or chosen. */
const litGroup = (state: GalleryState, template?: VideoTemplate) => {
  const story = template ? template.story : state.story
  return (
    TEMPLATE_STORIES.find((item) => item.id === story)?.group ?? state.group
  )
}

export const templateGalleryPage = (state: GalleryState) => {
  const template = VIDEO_TEMPLATES.find((item) => item.id === state.templateId)
  const lit = litGroup(state, template)
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
      <nav class="tpl-rail" aria-label="Groups of stories">
        ${item('all', 'All templates', VIDEO_TEMPLATES.length)}
        ${STORY_GROUPS.map((group) =>
          item(
            group.id,
            group.name,
            VIDEO_TEMPLATES.filter(
              (entry) => storyById(entry.story).group === group.id
            ).length
          )
        ).join('')}
        ${lookNote(state.look)}
      </nav>
      <section class="tpl-panel">
        ${template ? detail(state, template) : listPage(state)}
      </section>
    </main>`
}
