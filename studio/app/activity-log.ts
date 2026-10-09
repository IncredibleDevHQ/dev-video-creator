// Activity: the notebook's steps with their times, once each, in the
// product's words (review 5: a raw log said "presentation" and "slides" and
// repeated "Draft 7 of 10 is available" after every retry).
import type { Snapshot } from '../shared/api'
import type { UsageTotal } from '../shared/usage'
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

// What each agent call was for, in the product's words, in workflow order.
const STAGE_WORDS: Array<[string, string]> = [
  ['brief', 'Reading the source'],
  ['story', 'Story'],
  ['revise-story', 'Story changes'],
  ['page', 'Wireframes'],
  ['revise-page', 'Wireframe changes'],
  ['planning', 'Video plan'],
  ['composition', 'Video scenes'],
  ['chat', 'Questions'],
  ['extension', 'Extension'],
  ['other', 'Other']
]

export const tokens = (count: number) =>
  count < 1000
    ? String(count)
    : count < 1_000_000
      ? `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)} k`
      : `${(count / 1_000_000).toFixed(1)} M`

/** Token use per step, as the agents reported it. */
export const usageTable = (snapshot: Snapshot) => {
  const stages = snapshot.tokenUsage?.stages || {}
  const rows = STAGE_WORDS.filter(([key]) => stages[key]?.totalRuns)
  if (!rows.length) return ''
  const row = (label: string, total: UsageTotal, className = '') =>
    `<tr class="${className}"><th scope="row">${escape(label)}</th><td>${total.totalRuns}</td>${
      total.reportedRuns
        ? `<td>${tokens(total.input + total.cacheWrite)}</td><td>${tokens(total.cacheRead)}</td><td>${tokens(total.output)}</td><td>${tokens(total.tokens)}${total.partial ? '*' : ''}</td>`
        : '<td colspan="4" class="is-unknown">not reported</td>'
    }</tr>`
  const total = snapshot.tokenUsage!.total
  return `<h3 class="activity-usage-title">Token use</h3>
<table class="activity-usage"><thead><tr><th scope="col">Step</th><th scope="col">Calls</th><th scope="col">New input</th><th scope="col">Cached</th><th scope="col">Output</th><th scope="col">Total</th></tr></thead><tbody>${rows
    .map(([key, label]) => row(label, stages[key]))
    .join(
      ''
    )}${rows.length > 1 ? row('All steps', total, 'is-total') : ''}</tbody></table>${
    total.partial
      ? '<p class="activity-usage-note">* Some calls did not report their tokens, or stopped before they could.</p>'
      : ''
  }`
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
    .join('')}</ol>${usageTable(snapshot)}`
}
