import type { Snapshot } from '../shared/api'
import { agentNames } from './agent-setup'
import { choicesRow } from './notebook-choices'
import { button, escape } from './ui'

export const notebookNextStep = (snapshot: Snapshot) => {
  if (snapshot.status === 'reading')
    return {
      title: 'Reading your article',
      description: 'Your notes will appear here when the article is ready.',
      label: 'Reading source…',
      action: 'view-slides',
      disabled: true
    }
  if (snapshot.status === 'failed' && snapshot.sourceOnly)
    return {
      title: 'Your article needs another try',
      description: 'Paste the article text to continue with your notebook.',
      label: 'Paste article text →',
      action: 'paste-source',
      disabled: !!snapshot.readOnly
    }
  if (snapshot.status === 'failed')
    return {
      title: 'Let’s finish your wireframes',
      description:
        'The last attempt stopped. Try again, or change the model before continuing.',
      label: 'Try again →',
      action: 'retry-slides',
      disabled: !!snapshot.readOnly
    }
  if (snapshot.status === 'draft')
    return {
      title: 'Ready to shape your ideas into wireframes?',
      description:
        'Review your notes, then let your agent create your wireframes.',
      label: 'Create wireframes →',
      action: 'create-presentation',
      disabled: !!snapshot.readOnly
    }
  if (snapshot.status === 'building')
    return {
      title: 'Your wireframes are taking shape',
      description: 'Follow the progress and see wireframes as they’re created.',
      label: 'View progress →',
      action: 'view-slides',
      disabled: false
    }
  return {
    title: 'Your wireframes are ready',
    description:
      'Review your wireframes, then turn them into a motion graphics video.',
    label: 'Review wireframes →',
    action: 'view-slides',
    disabled: false
  }
}
export const notebookNextAction = (snapshot: Snapshot, pending = false) => {
  const next = notebookNextStep(snapshot)
  if (pending && next.action === 'create-presentation')
    return `<button type="button" data-action="create-presentation" class="primary" disabled aria-busy="true">Creating…</button>`
  return button(next.label, next.action, true, pending || next.disabled)
}
/**
 * One line under the notebook's title: what happens next, with the choices
 * Create will use. The header holds the only Create button (review 5).
 */
export const notebookHint = (snapshot: Snapshot, editable: boolean) => {
  const agent = snapshot.project.harness
    ? agentNames[snapshot.project.harness.adapter]
    : 'Your agent'
  const line = (text: string, tone = '') =>
    `<section class="notebook-next${tone ? ` is-${tone}` : ''}" aria-label="Next step"><p>${text}</p>${
      editable ? choicesRow(snapshot, editable) : ''
    }</section>`
  if (snapshot.status === 'reading') return line('Reading your article…')
  if (snapshot.status === 'failed' && snapshot.sourceOnly) return ''
  if (snapshot.status === 'failed')
    return line(
      `<b>Stopped.</b> ${escape(snapshot.error || 'The last attempt stopped.')}`,
      'stopped'
    )
  if (snapshot.status === 'draft')
    return line('<b>Next:</b> Create wireframes, top right.')
  if (snapshot.status === 'building')
    return line(
      `<b>${escape(agent)} is drawing your wireframes.</b> Watch them arrive in Wireframe.`
    )
  return line(
    '<b>Your wireframes are ready.</b> Review them in Wireframe, then make the video.'
  )
}
