import type { Snapshot } from '../shared/api'
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
      label: 'Retry wireframes →',
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
  return button(next.label, next.action, true, pending || next.disabled)
}
export const notebookNextBanner = (snapshot: Snapshot, pending: boolean) => {
  const next = notebookNextStep(snapshot)
  return `<section class="notebook-next-step" aria-label="Next step">
<div><span class="next-step-label">NEXT STEP</span><h2>${escape(next.title)}</h2><p>${escape(next.description)}</p>
${snapshot.status === 'failed' && snapshot.error ? `<details class="next-step-error"><summary>What happened?</summary><p>${escape(snapshot.error)}</p></details>` : ''}</div>
<div class="next-step-actions">${notebookNextAction(snapshot, pending)}${snapshot.status === 'failed' && !snapshot.sourceOnly ? button('Change model', 'agent-settings') : ''}</div>
</section>`
}
