// Questions in the flow, not in dialogs (review 5, borrowed from Open
// Slide's /create-slide): one row of filled-in choices beside Create — the
// agent, the length and the look — each changed from a small menu.
import type { Snapshot } from '../shared/api'
import { STORY_SCENES, type StoryLength } from '../shared/model'
import { agentNames, foundAgent, modelLabelOf } from './agent-setup'
import { modelLabel } from './agent-menu'
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { repoChip } from './repo-view'
import { episodeChip } from './series-view'
import { escape } from './ui'
import {
  LENGTHS,
  allowedPresets,
  directionSettings,
  lengthLabel,
  minutesForPages,
  narrativeById,
  pageRange,
  presetById,
  presetFor,
  type LengthRange,
  type PresetId
} from '../shared/narratives'

const lengths: Array<[StoryLength, string]> = [
  ['short', 'Short'],
  ['medium', 'Medium'],
  ['long', 'Long']
]

export const lookName = (snapshot: Snapshot) =>
  snapshot.project.branding?.look?.name || 'Paper'

/** The notebook's template and how it is told, in a few words. */
const telling = (snapshot: Snapshot) => {
  const narrative = narrativeById(snapshot.project.narrative)
  if (!narrative) return null
  const direction = snapshot.project.direction
  const preset = presetById(presetFor(narrative, direction?.preset))!
  const length = directionSettings(narrative, direction).length
  return { narrative, label: `${preset.name}, ${lengthLabel(length)}` }
}

export const choicesRow = (snapshot: Snapshot, editable: boolean) => {
  const { harness, length } = snapshot.project
  // The found agent by name, as the header's pill says it.
  const found = foundAgent()
  const agent = harness
    ? `${agentNames[harness.adapter]}${harness.model ? ` ${modelLabelOf(harness)}` : ''}`
    : found
      ? agentNames[found]
      : 'your agent'
  const scenes = STORY_SCENES[length || 'medium']
  const told = telling(snapshot)
  const off = editable ? '' : 'disabled'
  // With a template, its direction sets the length; without, the count does.
  return `<p class="choice-row"><span>With</span>
<button type="button" class="choice" data-action="agent-menu" data-popover="agent">${escape(agent)}</button><span aria-hidden="true">·</span>
<button type="button" class="choice" data-action="open-templates" ${off}>${escape(told ? told.narrative.name : 'No template')}${told && snapshot.suggestion?.preselected && snapshot.suggestion.narratives[0]?.id === told.narrative.id ? ' <small>suggested</small>' : ''}</button><span aria-hidden="true">·</span>
${
  told
    ? `<button type="button" class="choice" data-action="direction-menu" data-popover="direction" ${off}>${escape(told.label)}</button>`
    : `<button type="button" class="choice" data-action="length-menu" data-popover="length" title="≈ ${scenes} wireframes" ${off}>about ${minutesForPages(scenes)} min</button>`
}<span aria-hidden="true">·</span>
<button type="button" class="choice" data-action="look-panel">${escape(lookName(snapshot))} look</button><span aria-hidden="true">·</span>
${repoChip(snapshot, editable)}${episodeChip(snapshot)}</p>${editable ? suggestionRow(snapshot) : ''}`
}

/**
 * What Jev suggests, said once: a template it set says so in its chip; an
 * unsure suggestion offers its top few, one click each.
 */
const suggestionRow = (snapshot: Snapshot) => {
  const suggestion = snapshot.suggestion
  if (!suggestion || snapshot.project.narrative) return ''
  // A long shot is noise: only what Jev gives one chance in ten or more.
  return `<p class="suggest-row${suggestion.stale ? ' is-stale' : ''}"><span>${suggestion.stale ? 'Suggested before your edits' : 'Suggested'}</span>${suggestion.narratives
    .filter(({ p }, index) => index === 0 || p >= 0.1)
    .map(({ id }) => {
      const narrative = narrativeById(id)
      return narrative
        ? `<button type="button" class="choice" data-action="take-suggestion" data-narrative="${id}">${escape(narrative.name)}</button>`
        : ''
    })
    .join('')}</p>`
}

/**
 * How the notebook's template is told: its directions, then the length as a
 * range, and the way back to planning without one.
 */
export const openDirectionMenu = (app: AppContext, anchor: HTMLElement) => {
  const snapshot = app.snapshot
  const narrative = narrativeById(snapshot?.project.narrative)
  if (!snapshot || !narrative) return
  const id = snapshot.project.id
  const direction = snapshot.project.direction
  const preset = presetFor(narrative, direction?.preset)
  const length = directionSettings(narrative, direction).length.join(',')
  // The template's suggested length for this post is offered, not imposed.
  const suggested = snapshot.suggestion?.length
  const lengths = [
    ...new Map(
      [
        ...LENGTHS,
        directionSettings(narrative, { preset }).length,
        directionSettings(narrative, direction).length,
        ...(suggested ? [suggested] : [])
      ].map((range) => [range.join(','), range])
    ).values()
  ].sort((a, b) => a[0] - b[0])
  const pagesFor = (range: LengthRange) => {
    const [low, high] = pageRange(
      directionSettings(narrative, { ...direction, preset, length: range })
    )
    return `≈ ${low}–${high} wireframes${suggested && range.join(',') === suggested.join(',') ? ' · suggested for this post' : ''}`
  }
  const radio = (attrs: string, checked: boolean, label: string, note = '') =>
    `<button type="button" role="radio" aria-checked="${checked}" ${attrs}><span>${escape(label)}</span>${note ? `<small>${escape(note)}</small>` : ''}</button>`
  const panel = openPopover(
    anchor,
    'direction',
    `<div class="length-menu" role="radiogroup" aria-label="How to tell it"><p class="popover-title">${escape(narrative.name)}</p>${allowedPresets(
      narrative
    )
      .map((item) =>
        radio(
          `data-preset="${item.id}"`,
          item.id === preset,
          item.name,
          item.line
        )
      )
      .join('')}<p class="popover-title">Length</p>${lengths
      .map((range) =>
        radio(
          `data-length="${range.join(',')}"`,
          range.join(',') === length,
          lengthLabel(range),
          pagesFor(range)
        )
      )
      .join(
        ''
      )}<p class="popover-note">The agent plans the wireframes from the template’s beats, for this length.</p><button type="button" class="quiet" data-template-none>Plan without a template</button></div>`,
    'length-popover'
  )
  panel?.addEventListener('click', async (event) => {
    const choice = (event.target as Element).closest<HTMLElement>(
      '[data-preset],[data-length],[data-template-none]'
    )
    if (!choice) return
    const next = choice.dataset.preset
      ? { preset: choice.dataset.preset as PresetId }
      : choice.dataset.length
        ? {
            ...direction,
            preset,
            length: choice.dataset.length.split(',').map(Number) as LengthRange
          }
        : null
    try {
      const changed = await api.setTemplate(id, {
        narrative: next ? narrative.id : null,
        ...(next ? { direction: next } : {})
      })
      if (app.snapshot?.project.id === id) app.snapshot = changed
      closePopover()
      app.render()
    } catch (reason) {
      app.error(reason)
    }
  })
}

export const openLengthMenu = (app: AppContext, anchor: HTMLElement) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const current = app.snapshot.project.length || 'medium'
  const panel = openPopover(
    anchor,
    'length',
    `<div class="length-menu" role="radiogroup" aria-label="Length"><p class="popover-title">Length</p>${lengths
      .map(
        ([value, label]) =>
          `<button type="button" role="radio" aria-checked="${value === current}" data-length="${value}"><span>${label} · about ${minutesForPages(STORY_SCENES[value])} min</span><small>≈ ${STORY_SCENES[value]} wireframes</small></button>`
      )
      .join(
        ''
      )}<p class="popover-note">The agent plans about this many wireframes.</p></div>`,
    'length-popover'
  )
  panel?.addEventListener('click', async (event) => {
    const choice = (event.target as Element).closest<HTMLElement>(
      '[data-length]'
    )
    if (!choice) return
    try {
      const snapshot = await api.setLength(
        id,
        choice.dataset.length as StoryLength
      )
      if (app.snapshot?.project.id === id) app.snapshot = snapshot
      closePopover()
      app.render()
    } catch (reason) {
      app.error(reason)
    }
  })
}
