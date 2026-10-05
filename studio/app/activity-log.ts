// Activity: the notebook's steps with their times, once each, in the
// product's words (review 5: a raw log said "presentation" and "slides" and
// repeated "Draft 7 of 10 is available" after every retry).
import type { Snapshot } from '../shared/api'
import { escape } from './ui'
import { wireframeStatus } from './wireframe-copy'

const clock = (iso: string, now = new Date()) => {
  const time = new Date(iso)
  if (!Number.isFinite(time.getTime())) return ''
  const sameDay = time.toDateString() === now.toDateString()
  return time.toLocaleString('en', {
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const activitySteps = (snapshot: Snapshot) => {
  const seen = new Set<string>()
  const steps: Array<{ time: string; message: string; failed: boolean }> = []
  for (const event of snapshot.events) {
    const message = wireframeStatus(event.message)
    // Older decks announced each accepted slide at the end, and each retry
    // re-announced every saved draft: keep a page's first announcement only.
    if (/^Wireframe \d+ of \d+$/.test(message)) continue
    const page =
      /^(?:Draft|Wireframe) (\d+) of \d+ (?:is available|drawn)$/.exec(message)
    if (page) {
      if (seen.has(page[1])) continue
      seen.add(page[1])
    }
    if (steps.at(-1)?.message === message) continue
    steps.push({
      time: event.time,
      message,
      failed: event.activity === 'failed'
    })
  }
  return steps
}

export const activityDialog = (snapshot: Snapshot) => {
  const steps = activitySteps(snapshot)
  return `<h2>Activity</h2>
<p class="activity-steps-intro">What happened in this notebook, oldest first.</p>
<ol class="activity-steps">${steps
    .map(
      (step) =>
        `<li class="${step.failed ? 'is-failed' : ''}"><time datetime="${escape(step.time)}">${escape(clock(step.time))}</time><span>${escape(step.message)}</span></li>`
    )
    .join('')}</ol>`
}
