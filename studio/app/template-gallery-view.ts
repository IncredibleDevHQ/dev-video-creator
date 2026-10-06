// The template gallery: every shape an engineering explainer can take, each
// card playing its slots in turn, drawn in the notebook's own look.
import incredibleLogo from './assets/incredible-logo.svg'
import { themeControl } from './appearance'
import { escape, html } from './ui'
import { templateSketch } from './template-sketches'
import { LOOKS } from '../shared/looks'
import type { Branding } from '../shared/settings'
import {
  SEAM_LABELS,
  SLOT_TYPES,
  SPEAKER_LABELS,
  TEMPLATE_FAMILIES,
  VIDEO_TEMPLATES,
  familyById,
  type TemplateFamilyId,
  type VideoTemplate
} from '../shared/video-templates'

export type GalleryUse = 'make' | 'settings' | null
export type GalleryState = {
  family: 'all' | TemplateFamilyId
  templateId: string | null
  slot: number
  playing: boolean
  look: Branding | undefined
  use: GalleryUse
  current: string | undefined
  /** Where Back goes, in words. */
  back: string
}

export const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

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
export const lookName = (branding?: Branding) =>
  branding?.look?.name || (branding?.palette ? 'your look' : LOOKS[0].name)

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

/** The 16:9 stage that plays one slot of a template. */
export const templateStage = (
  template: VideoTemplate,
  index: number,
  options: { large?: boolean; clickable?: boolean; cycle?: boolean } = {}
) => {
  const slot = template.slots[index]
  return html`<div
    class="tpl-stage${options.large ? ' large' : ''}"
    data-template="${template.id}"
    data-slot="${index}"
    ${options.cycle ? 'data-tpl-cycle' : ''}
  >
    <div class="tpl-sketch">${templateSketch(slot.sketch)}</div>
    <span class="tpl-stage-role"><b>${index + 1}</b>${escape(slot.role)}</span>
    <span class="tpl-stage-type"
      >${typeDot(slot.type)}${SLOT_TYPES[slot.type].label}</span
    >
    ${options.large
      ? `<span class="tpl-stage-seam">${SEAM_LABELS[slot.seam]} →</span>`
      : ''}
    ${segments(template, index, options.clickable)}
  </div>`
}

const templateCard = (template: VideoTemplate, current?: string) =>
  html`<article class="tpl-card" data-family="${template.family}">
    <button
      type="button"
      class="tpl-card-open"
      data-tpl-open="${template.id}"
      aria-label="${escape(`Open ${template.name}`)}"
    >
      ${templateStage(template, 0, { cycle: true })}
    </button>
    <div class="tpl-card-body">
      <div class="tpl-card-title">
        <h3>${escape(template.name)}</h3>
        ${current === template.id
          ? '<span class="tpl-badge">In use</span>'
          : ''}
      </div>
      <p>${escape(template.purpose)}</p>
      <div class="tpl-meta">
        <span>${mmss(template.seconds)}</span
        ><span>${template.slots.length} slots</span
        ><span>${escape(familyById(template.family).short)}</span>
      </div>
    </div>
  </article>`

const familySection = (
  family: (typeof TEMPLATE_FAMILIES)[number],
  current?: string
) =>
  html`<section class="tpl-family" data-family="${family.id}">
    <div class="tpl-family-head">
      <div>
        <h2>${escape(family.name)}</h2>
        <p>${escape(family.summary)}</p>
      </div>
      <dl class="tpl-facts">
        <div>
          <dt>For</dt>
          <dd>${escape(family.audience)}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>${escape(family.length)}</dd>
        </div>
        <div>
          <dt>Tone</dt>
          <dd>${escape(family.tone)}</dd>
        </div>
      </dl>
    </div>
    <div class="tpl-grid">
      ${VIDEO_TEMPLATES.filter((item) => item.family === family.id)
        .map((item) => templateCard(item, current))
        .join('')}
    </div>
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

/** The storyboard player: one slot large, the controls, and what it does. */
export const templatePlayer = (
  state: GalleryState,
  template: VideoTemplate
) => {
  const slot = template.slots[state.slot]
  return html`<section
    class="tpl-player"
    aria-label="Storyboard"
    data-playing="${state.playing}"
  >
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
      <span class="tpl-player-where">
        Slot ${state.slot + 1} of ${template.slots.length} ·
        ${mmss(slot.from)}–${mmss(slot.to)}
      </span>
      <span class="tpl-player-look"
        >Drawn in ${escape(lookName(state.look))}</span
      >
    </div>
    <div class="tpl-now">
      <h2>${escape(slot.role)}</h2>
      <p>${escape(slot.move)}</p>
      <div class="tpl-chips">
        <span class="tpl-chip"
          >${typeDot(slot.type)}${SLOT_TYPES[slot.type].label}</span
        >
        <span class="tpl-chip">${SPEAKER_LABELS[slot.speaker]}</span>
        <span class="tpl-chip">${SEAM_LABELS[slot.seam]} into the next</span>
      </div>
      <p class="tpl-builds">
        Built from HyperFrames
        ${slot.builds.map((name) => `<code>${escape(name)}</code>`).join(' ')}
      </p>
    </div>
  </section>`
}

const detail = (state: GalleryState, template: VideoTemplate) => {
  const family = familyById(template.family)
  return html`<div class="tpl-detail">
    <button type="button" class="tpl-crumb" data-tpl-back>
      ‹ All templates
    </button>
    <div class="tpl-detail-head">
      <div>
        <p class="tpl-eyebrow">
          ${escape(family.short)} · ${mmss(template.seconds)} ·
          ${template.slots.length} slots
        </p>
        <h1>${escape(template.name)}</h1>
        <p class="tpl-lede">${escape(template.purpose)}</p>
      </div>
      <div class="tpl-use">${useButton(state, template)}</div>
    </div>
    <div class="tpl-detail-grid">
      ${templatePlayer(state, template)}
      <aside class="tpl-side">
        <h3>Who it's for</h3>
        <p>${escape(family.summary)}</p>
        <dl class="tpl-facts stacked">
          <div>
            <dt>For</dt>
            <dd>${escape(family.audience)}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>${escape(family.length)}</dd>
          </div>
          <div>
            <dt>Tone</dt>
            <dd>${escape(family.tone)}</dd>
          </div>
          <div>
            <dt>Pacing</dt>
            <dd>${escape(family.pacing)}</dd>
          </div>
        </dl>
        <h3>How your scenes take the slots</h3>
        <p>
          Your scenes take these slots in order: the first opens, the last
          closes, and the scenes between spread across the middle. You can move
          any scene to another slot from the video.
        </p>
      </aside>
    </div>
    <section class="tpl-slots" aria-label="Slots">
      <h2>The slots</h2>
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
                  <span class="tpl-slot-main">
                    <b>${escape(item.role)}</b>
                    <span>${escape(item.move)}</span>
                  </span>
                  <span class="tpl-slot-side">
                    <span class="tpl-chip"
                      >${typeDot(item.type)}${SLOT_TYPES[item.type].label}</span
                    >
                    <span class="tpl-slot-time"
                      >${mmss(item.from)}–${mmss(item.to)}</span
                    >
                  </span>
                </button>
              </li>`
          )
          .join('')}
      </ol>
    </section>
  </div>`
}

export const templateGalleryPage = (state: GalleryState) => {
  const template = VIDEO_TEMPLATES.find((item) => item.id === state.templateId)
  const count = (family: 'all' | TemplateFamilyId) =>
    family === 'all'
      ? VIDEO_TEMPLATES.length
      : VIDEO_TEMPLATES.filter((item) => item.family === family).length
  const tab = (family: 'all' | TemplateFamilyId, label: string) =>
    html`<button
      type="button"
      data-tpl-family="${family}"
      aria-current="${(template ? template.family : state.family) === family
        ? 'page'
        : 'false'}"
    >
      ${family === 'all'
        ? ''
        : `<i class="tpl-family-dot" data-family="${family}"></i>`}<span
        >${escape(label)}</span
      ><small>${count(family)}</small>
    </button>`
  const families =
    state.family === 'all'
      ? TEMPLATE_FAMILIES
      : TEMPLATE_FAMILIES.filter((family) => family.id === state.family)
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
      <nav class="tpl-rail" aria-label="Template kinds">
        ${tab('all', 'All templates')}
        <p class="tpl-rail-label">Kinds</p>
        ${TEMPLATE_FAMILIES.map((family) => tab(family.id, family.short)).join(
          ''
        )}
        <p class="tpl-rail-foot">
          Previews are drawn in ${escape(lookName(state.look))}.
        </p>
      </nav>
      <section class="tpl-panel">
        ${template
          ? detail(state, template)
          : html`<div class="tpl-head">
                <h1>Templates <small>${count(state.family)}</small></h1>
                <p>
                  Shapes for engineering explainers. Each template is a run of
                  slots, and every slot has its role, its kind of shot, where
                  you appear and one signature move. Your scenes take the slots
                  in order.
                </p>
              </div>
              ${families
                .map((family) => familySection(family, state.current))
                .join('')}`}
      </section>
    </main>`
}
