// Questions in the flow, not in dialogs (review 5, borrowed from Open
// Slide's /create-slide): one row of filled-in choices beside Create — the
// agent, the length and the look — each changed from a small menu.
import type { Snapshot } from '../shared/api'
import { STORY_SCENES, type StoryLength } from '../shared/model'
import { agentNames } from './agent-setup'
import { modelLabel } from './agent-menu'
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { escape } from './ui'

const lengths: Array<[StoryLength, string]> = [
  ['short', 'Short'],
  ['medium', 'Medium'],
  ['long', 'Long']
]

export const lookName = (snapshot: Snapshot) =>
  snapshot.project.branding?.look?.name || 'Paper'

export const choicesRow = (snapshot: Snapshot, editable: boolean) => {
  const { harness, length } = snapshot.project
  const agent = harness
    ? `${agentNames[harness.adapter]}${harness.model ? ` ${modelLabel(harness.model)}` : ''}`
    : 'the agent found on this computer'
  const scenes = STORY_SCENES[length || 'medium']
  return `<p class="choice-row"><span>With</span>
<button type="button" class="choice" data-action="agent-menu" data-popover="agent">${escape(agent)}</button><span aria-hidden="true">·</span>
<button type="button" class="choice" data-action="length-menu" data-popover="length" ${editable ? '' : 'disabled'}>about ${scenes} wireframes</button><span aria-hidden="true">·</span>
<button type="button" class="choice" data-action="look-panel">${escape(lookName(snapshot))} look</button></p>`
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
          `<button type="button" role="radio" aria-checked="${value === current}" data-length="${value}"><span>${label}</span><small>about ${STORY_SCENES[value]} wireframes</small></button>`
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
