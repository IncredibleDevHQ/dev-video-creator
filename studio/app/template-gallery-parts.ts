// The template gallery's building blocks: its state, the notebook's look for
// the sketches, the 16:9 stage that plays a slot, and the cards.
import { escape, html } from './ui'
import { templateSketch } from './template-sketches'
import { LOOKS } from '../shared/looks'
import type { Branding } from '../shared/settings'
import {
  SLOT_TYPES,
  coverIndex,
  storyById,
  type StoryGroupId,
  type VideoTemplate
} from '../shared/video-templates'

export type GalleryUse = 'make' | 'settings' | null
export type GalleryState = {
  /** The group the rail shows, or all of them. */
  group: 'all' | StoryGroupId
  /** The one story shown, or none. */
  story: string
  /** Words to find templates by. */
  query: string
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
export const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1)

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

export const typeDot = (type: keyof typeof SLOT_TYPES) =>
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
 * on its stage, a story's tile names the way of telling it, and the player
 * names it beside the stage instead. When the slot puts the speaker in the
 * corner or beside the content and its sketch does not draw them, the stage
 * does.
 */
export const templateStage = (
  template: VideoTemplate,
  index: number,
  options: {
    large?: boolean
    clickable?: boolean
    cycle?: boolean
    /** A story's tile: it moves through the story's templates instead. */
    variants?: boolean
  } = {}
) => {
  const slot = template.slots[index]
  const sketch = templateSketch(slot.sketch)
  const place =
    (slot.speaker === 'corner' || slot.speaker === 'beside') &&
    !/sk-cam|sk-ring/.test(sketch)
      ? slot.speaker
      : ''
  const name = options.variants
    ? `<span class="tpl-stage-role">${escape(template.name)}</span>`
    : `<span class="tpl-stage-role"><b>${index + 1}</b>${escape(slot.role)}</span>`
  return html`<div
    class="tpl-stage${options.large ? ' large' : ''}"
    data-template="${template.id}"
    data-slot="${index}"
    ${place ? `data-speaker="${place}"` : ''}
    ${options.cycle ? 'data-tpl-cycle' : ''}
    ${options.variants ? 'data-tpl-variants' : ''}
  >
    <div class="tpl-sketch">${sketch}</div>
    ${options.large ? '' : name}
    ${place ? `<span class="tpl-stage-cam ${place}">${PERSON}</span>` : ''}
    ${segments(template, index, options.clickable)}
  </div>`
}

/** A story's tile plays each of its templates in turn, on its cover. */
export const storyStage = (template: VideoTemplate) =>
  templateStage(template, coverIndex(template), {
    cycle: true,
    variants: true
  })

export const templateCard = (
  template: VideoTemplate,
  current?: string,
  withStory = false
) =>
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
      ${withStory
        ? `<p class="tpl-card-story">${escape(storyById(template.story).name)}</p>`
        : ''}
      <h3>${escape(template.name)}</h3>
      ${current === template.id ? '<span class="tpl-badge">In use</span>' : ''}
      <span class="tpl-card-time">${mmss(template.seconds)}</span>
      <p>${escape(template.tagline)}</p>
    </div>
  </article>`
