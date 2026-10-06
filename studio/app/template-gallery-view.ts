// The template gallery: the stories an engineering blog tells, and for each
// the ways to tell it, every card playing its slots in turn, drawn in the
// notebook's own look.
import incredibleLogo from './assets/incredible-logo.svg'
import { themeControl } from './appearance'
import { escape, html } from './ui'
import { templateSketch } from './template-sketches'
import { LOOKS } from '../shared/looks'
import type { Branding } from '../shared/settings'
import {
  SLOT_TYPES,
  STORY_GROUPS,
  TEMPLATE_STORIES,
  VIDEO_TEMPLATES,
  cameraShare,
  coverIndex,
  seamLine,
  storyById,
  storyTemplates,
  type SpeakerPlace,
  type TemplateStory,
  type VideoTemplate
} from '../shared/video-templates'

export type GalleryUse = 'make' | 'settings' | null
export type GalleryState = {
  /** The story the rail shows, or all of them. */
  story: string
  templateId: string | null
  slot: number
  playing: boolean
  look: Branding | undefined
  use: GalleryUse
  current: string | undefined
  /** Where Back goes, in words. */
  back: string
}

const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1)
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

/** The sketches' colours: the notebook's look, else the first named look. */
export const lookStyle = (branding?: Branding) => {
  const palette = branding?.palette || LOOKS[0].palette
  const accent = branding?.useAccent ? branding.accent : null
  const look = LOOKS.find((item) => item.id === branding?.look?.id)
  const value = (key: string) => escape(key).replace(/[;{}]/g, '')
  return [
    `--sk-ground:${value(palette.ground)}`,
    `--sk-text:${value(palette.text)}`,
    `--sk-accent:${value(accent || look?.palette.accent || LOOKS[0].palette.accent)}`,
    `--sk-secondary:${value(palette.secondary)}`
  ].join(';')
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

const typeDot = (type: keyof typeof SLOT_TYPES) =>
  `<i class="tpl-type-dot" data-type="${type}"></i>`

/** A template's slots as proportional segments, the active one filling. */
const segments = (template: VideoTemplate, active: number, clickable = false) =>
  `<div class="tpl-segments" role="${clickable ? 'tablist' : 'presentation'}">${template.slots
    .map((slot, index) => {
      const inner = `<span class="tpl-segment-fill"></span>`
      const attrs = `class="tpl-segment" data-type="${slot.type}" data-state="${
        index < active ? 'done' : index === active ? 'now' : 'next'
      }" style="flex:${slot.to - slot.from}"`
      return clickable
        ? `<button type="button" ${attrs} role="tab" aria-selected="${index === active}" aria-label="${escape(`${index + 1}. ${slot.role}`)}" data-tpl-slot="${index}">${inner}</button>`
        : `<span ${attrs}>${inner}</span>`
    })
    .join('')}</div>`

const PERSON =
  '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7"/><path d="M6 40c0-9 6-14 14-14s14 5 14 14z"/></svg>'

/**
 * The 16:9 stage that plays one slot of a template. A card names the slot
 * on its stage; the player names it beside the stage instead. When the slot
 * puts the speaker in the corner or beside the content and its sketch does
 * not draw them, the stage does.
 */
export const templateStage = (
  template: VideoTemplate,
  index: number,
  options: { large?: boolean; clickable?: boolean; cycle?: boolean } = {}
) => {
  const slot = template.slots[index]
  const sketch = templateSketch(slot.sketch)
  const place =
    (slot.speaker === 'corner' || slot.speaker === 'beside') &&
    !/sk-cam|sk-ring/.test(sketch)
      ? slot.speaker
      : ''
  return html`<div
    class="tpl-stage${options.large ? ' large' : ''}"
    data-template="${template.id}"
    data-slot="${index}"
    ${place ? `data-speaker="${place}"` : ''}
    ${options.cycle ? 'data-tpl-cycle' : ''}
  >
    <div class="tpl-sketch">${sketch}</div>
    ${options.large
      ? ''
      : `<span class="tpl-stage-role"><b>${index + 1}</b>${escape(slot.role)}</span>`}
    ${place ? `<span class="tpl-stage-cam ${place}">${PERSON}</span>` : ''}
    ${segments(template, index, options.clickable)}
  </div>`
}

const templateCard = (template: VideoTemplate, current?: string) =>
  html`<article class="tpl-card">
    <button
      type="button"
      class="tpl-card-open"
      data-tpl-open="${template.id}"
      aria-label="${escape(`Open ${template.name}`)}"
    >
      ${templateStage(template, coverIndex(template), { cycle: true })}
    </button>
    <div class="tpl-card-body">
      <h3>${escape(template.name)}</h3>
      ${current === template.id ? '<span class="tpl-badge">In use</span>' : ''}
      <span class="tpl-card-time">${mmss(template.seconds)}</span>
      <p>${escape(template.tagline)}</p>
    </div>
  </article>`

const cards = (story: TemplateStory, current?: string) =>
  `<div class="tpl-grid">${storyTemplates(story.id)
    .map((item) => templateCard(item, current))
    .join('')}</div>`

const storySection = (story: TemplateStory, current?: string) =>
  html`<section class="tpl-story" data-story="${story.id}">
    <div class="tpl-story-head">
      <h2>
        <button type="button" data-tpl-story="${story.id}">
          ${escape(story.name)}
        </button>
      </h2>
      <p>${escape(story.line)}</p>
    </div>
    ${cards(story, current)}
  </section>`

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

/** The page's heading: all the stories, or the one the rail picked. */
const listHead = (state: GalleryState) => {
  const story = TEMPLATE_STORIES.find((item) => item.id === state.story)
  return story
    ? html`<div class="tpl-head">
          <h1>${escape(story.name)}</h1>
          <p>
            ${escape(story.line)} For ${escape(lowerFirst(story.audience))}.
          </p>
        </div>
        ${cards(story, state.current)}`
    : html`<div class="tpl-head">
          <h1>Templates</h1>
          <p>
            Pick the story your blog tells, then a way to tell it. Your scenes
            take the template’s slots in order.
          </p>
        </div>
        ${TEMPLATE_STORIES.map((item) =>
          storySection(item, state.current)
        ).join('')}`
}

export const templateGalleryPage = (state: GalleryState) => {
  const template = VIDEO_TEMPLATES.find((item) => item.id === state.templateId)
  const lit = template ? template.story : state.story
  const tab = (story: string, label: string, count: number) =>
    html`<button
      type="button"
      data-tpl-story="${story}"
      aria-current="${lit === story ? 'page' : 'false'}"
    >
      <span>${escape(label)}</span><small>${count}</small>
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
      <nav class="tpl-rail" aria-label="Stories">
        ${tab('all', 'All templates', VIDEO_TEMPLATES.length)}
        ${STORY_GROUPS.map(
          (group) =>
            `<p class="tpl-rail-label">${escape(group.name)}</p>${TEMPLATE_STORIES.filter(
              (story) => story.group === group.id
            )
              .map((story) =>
                tab(story.id, story.name, storyTemplates(story.id).length)
              )
              .join('')}`
        ).join('')}
        ${lookNote(state.look)}
      </nav>
      <section class="tpl-panel">
        ${template ? detail(state, template) : listHead(state)}
      </section>
    </main>`
}
