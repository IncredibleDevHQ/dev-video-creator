// The template gallery's building blocks: its state, the notebook's look for
// the sketches, the 16:9 stage that plays one beat of a template as one
// direction tells it, and the cards. A template is a narrative: its beats
// say what the viewer must know, and the stage only shows one way it could
// look.
import { escape, html } from './ui'
import { templateSketch } from './template-sketches'
import { LOOKS } from '../shared/looks'
import type { Branding } from '../shared/settings'
import {
  allocateBeats,
  directionSettings,
  lengthLabel,
  narrativeById,
  presetFor,
  speakerFor,
  type Narrative,
  type PresetId,
  type StoryGroupId
} from '../shared/narratives'

export type GalleryUse = 'make' | 'settings' | null
export type GalleryState = {
  /** The group the rail shows, or all of them. */
  group: 'all' | StoryGroupId
  /** Words to find templates by. */
  query: string
  /** The template opened, its direction and the beat the player shows. */
  narrative: string | null
  preset: PresetId | null
  beat: number
  playing: boolean
  look: Branding | undefined
  use: GalleryUse
  /** The open video's template and direction, when it has one. */
  current: { narrative?: string; preset?: PresetId }
  /** Where Back goes, in words. */
  back: string
}

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

/** A beat's narrative function as a coloured dot. */
export const beatDot = (fn: string) =>
  `<i class="tpl-beat-dot" data-function="${fn}"></i>`

/** The beats one direction tells, with their time and the whole length. */
export const telling = (narrative: Narrative, preset?: string | null) => {
  const settings = directionSettings(narrative, {
    preset: presetFor(narrative, preset)
  })
  const plans = allocateBeats(narrative, settings)
  return { settings, plans, told: plans.filter((plan) => plan.told) }
}

/** The told beats as segments by their time, the shown one filling. */
const segments = (
  told: ReturnType<typeof telling>['told'],
  active: number,
  clickable = false
) =>
  `<div class="tpl-segments" role="${clickable ? 'tablist' : 'presentation'}">${told
    .map((plan, index) => {
      const inner = `<span class="tpl-segment-fill"></span>`
      const attrs = `class="tpl-segment" data-function="${plan.beat.function}" data-state="${
        index < active ? 'done' : index === active ? 'now' : 'next'
      }" style="flex:${plan.seconds[0] + plan.seconds[1] || 1}"`
      return clickable
        ? `<button type="button" ${attrs} role="tab" aria-selected="${index === active}" aria-label="${escape(`${index + 1}. ${plan.beat.name}`)}" data-tpl-beat="${index}">${inner}</button>`
        : `<span ${attrs}>${inner}</span>`
    })
    .join('')}</div>`

const PERSON =
  '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7"/><path d="M6 40c0-9 6-14 14-14s14 5 14 14z"/></svg>'

/**
 * The 16:9 stage that plays one told beat of a template in one direction:
 * the beat's example sketch, and the speaker where that direction puts
 * them: in the corner, beside it, or full frame with words over them. A
 * card names the beat on its stage; the player names it beside the stage.
 */
export const beatStage = (
  narrative: Narrative,
  preset: string | null | undefined,
  index: number,
  options: { large?: boolean; clickable?: boolean; cycle?: boolean } = {}
) => {
  const { settings, told } = telling(narrative, preset)
  const at = ((index % told.length) + told.length) % told.length
  const beat = told[at].beat
  const place = speakerFor(
    settings.onCamera,
    [beat],
    at === 0,
    at === told.length - 1
  )
  return html`<div
    class="tpl-stage${options.large ? ' large' : ''}"
    data-narrative="${narrative.id}"
    data-preset="${presetFor(narrative, preset)}"
    data-beat="${at}"
    ${place === 'off' ? '' : `data-speaker="${place}"`}
    ${options.cycle ? 'data-tpl-cycle' : ''}
  >
    <div class="tpl-sketch">${templateSketch(beat.example)}</div>
    ${place === 'off'
      ? ''
      : `<span class="tpl-stage-cam ${place}">${PERSON}</span>`}
    ${place === 'over'
      ? `<span class="tpl-stage-words">${escape(beat.name)}</span>`
      : ''}
    ${options.large || place === 'over'
      ? ''
      : `<span class="tpl-stage-role"><b>${at + 1}</b>${escape(beat.name)}</span>`}
    ${segments(told, at, options.clickable)}
  </div>`
}

/** The stage a card shows next: its following beat. */
export const nextStage = (stage: HTMLElement) => {
  const narrative = narrativeById(stage.dataset.narrative)
  return narrative
    ? beatStage(
        narrative,
        stage.dataset.preset,
        Number(stage.dataset.beat) + 1,
        {
          cycle: true
        }
      )
    : null
}

export const narrativeCard = (
  narrative: Narrative,
  current?: string,
  withGroup?: string
) => {
  const { settings } = telling(narrative)
  return html`<article class="tpl-card">
    <button
      type="button"
      class="tpl-card-open"
      data-tpl-open="${narrative.id}"
      aria-label="${escape(`Open ${narrative.name}`)}"
    >
      ${beatStage(narrative, narrative.preset, 0, { cycle: true })}
    </button>
    <div class="tpl-card-body">
      ${withGroup ? `<p class="tpl-card-story">${escape(withGroup)}</p>` : ''}
      <h3>${escape(narrative.name)}</h3>
      ${current === narrative.id ? '<span class="tpl-badge">In use</span>' : ''}
      <span class="tpl-card-time">${lengthLabel(settings.length)}</span>
      <p>${escape(narrative.line)}</p>
    </div>
  </article>`
}
