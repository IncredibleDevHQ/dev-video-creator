// The campaign in the release dialog: each item's day, channel, asset and
// words; approve, change or drop it; post it when its time comes. X and
// LinkedIn cannot schedule, so a due item waits for the creator's click.
import type { Snapshot } from '../shared/api'
import {
  beforeLaunch,
  byDue,
  clockOf,
  dueAt,
  dueItems,
  launchWords,
  nextDay,
  overdueItems,
  ownLaunchTime,
  timed,
  whenWords,
  type Timed
} from '../shared/campaign'
import { CHANNEL_LABELS, type CampaignItem } from '../shared/release'
import { escape } from './ui'

const KIND_WORDS: Record<CampaignItem['kind'], string> = {
  teaser: 'Teaser',
  launch: 'Launch',
  clip: 'Clip',
  quote: 'Quote card',
  recap: 'Recap'
}

/** "Tue, Oct 20 · 18:00", in the creator's own way of writing dates. */
export const dayAndTime = (at: Date) =>
  `${at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`

/** An item's words, time and day, with the time it goes out: the form says
 * what it showed, so a launch post that follows the release is sent a day
 * and a time only when they were changed. */
const editForm = (item: CampaignItem, clock: string) =>
  `<form class="campaign-edit" data-item="${escape(item.id)}" data-time="${clock}" data-days="${item.offsetDays}"${item.afterRelease === undefined ? '' : ' data-follows'}>` +
  `<textarea name="words" rows="2" aria-label="The words">${escape(item.words)}</textarea>` +
  `<input name="time" value="${clock}" aria-label="Time" pattern="[0-2][0-9]:[0-5][0-9]" size="5"><input name="offsetDays" type="number" value="${item.offsetDays}" aria-label="Days from the release" min="-60" max="60"><button class="quiet">Keep</button></form>`

const itemRow = (
  item: CampaignItem,
  release: Timed,
  mark: { due: boolean; overdue: boolean; now: Date }
) => {
  const { due, overdue } = mark
  const publishAt = release.youtube?.publishAt
  const at = dueAt(release, item)
  const clock = clockOf(release, item)
  const when = `${dayAndTime(at)} · ${item.afterRelease === undefined ? whenWords(item.offsetDays) : launchWords(release, item)}`
  // Its day gone by, approved or not: moved to the soonest day it can still
  // go out, or dropped; a launch post moves with the release instead
  // (review 8; round 1: an approved teaser past its day had no Move).
  const move =
    (overdue || due) && item.afterRelease === undefined
      ? nextDay(release, item, mark.now)
      : null
  const moveTo =
    move === null
      ? ''
      : `<button type="button" class="quiet" data-action="campaign-move" data-item="${escape(item.id)}" data-days="${move}">Move to ${escape(dueAt(release, { ...item, offsetDays: move }).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }))}</button>`
  // A launch post away from the release says so, and can go back to it.
  const own =
    ['draft', 'approved', 'dropped'].includes(item.state) &&
    ownLaunchTime(release, item)
  // YouTube publishes a scheduled upload at its own time: one away from the
  // campaign's launch is said (review 8).
  const scheduled =
    item.channel === 'youtube' &&
    item.kind === 'launch' &&
    publishAt &&
    Math.abs(Date.parse(publishAt) - at.getTime()) >= 60_000
      ? new Date(publishAt)
      : null
  const feed =
    item.channel === 'x'
      ? 'https://x.com/home'
      : 'https://www.linkedin.com/feed/'
  const actions =
    item.state === 'posting'
      ? '<small role="status">Posting…</small>'
      : // No answer came back: look before posting again (review 6).
        item.state === 'unknown'
        ? `<a href="${feed}" target="_blank" rel="noopener">Check your feed</a><button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="posted">It went out</button><button type="button" class="quiet" data-action="campaign-post" data-item="${escape(item.id)}" data-channel="${item.channel}" data-again="1">Post again</button>`
        : item.state === 'posted'
          ? item.postUrl
            ? `<a href="${escape(item.postUrl)}" target="_blank" rel="noopener">Posted</a>`
            : '<small>Posted</small>'
          : item.state === 'dropped'
            ? `<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="draft">Restore</button>`
            : `${moveTo}${
                own
                  ? `<button type="button" class="quiet" data-action="campaign-follow" data-item="${escape(item.id)}">Move with the release</button>`
                  : ''
              }${
                item.state === 'approved'
                  ? `<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="draft">Unapprove</button>`
                  : `<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="approved">Approve</button>`
              }<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="dropped">Drop</button>${
                item.channel === 'youtube'
                  ? // Uploaded by hand, the launch is up when the creator
                    // says so, or pastes its link (review 8, round 2).
                    item.kind === 'launch'
                    ? `<button type="button" ${overdue ? 'class="primary"' : 'class="quiet"'} data-action="campaign-state" data-item="${escape(item.id)}" data-state="posted">It is up</button>`
                    : ''
                  : `<button type="button" ${due ? 'class="primary"' : 'class="quiet"'} data-action="campaign-post" data-item="${escape(item.id)}" data-channel="${item.channel}">Post now</button>`
              }`
  return `<li class="campaign-item is-${item.state}${due ? ' is-due' : ''}${overdue ? ' is-overdue' : ''}">
<p class="campaign-when"><b>${KIND_WORDS[item.kind]}</b> ${CHANNEL_LABELS[item.channel]} · ${escape(when)}${own ? ' <small class="campaign-own">its own time</small>' : ''}${due ? ' <small>due</small>' : ''}${overdue ? ' <small class="campaign-overdue">overdue</small>' : ''}</p>
${
  ['posted', 'dropped', 'posting', 'unknown'].includes(item.state)
    ? `<p class="campaign-words">${escape(item.words)}</p>`
    : editForm(item, clock)
}
${item.note ? `<p class="campaign-note">${escape(item.note)}</p>` : ''}
${scheduled ? `<p class="campaign-note">YouTube publishes it ${escape(dayAndTime(scheduled))}, not at this time.</p>` : ''}
${beforeLaunch(release, item) ? '<p class="campaign-note">Before YouTube’s launch: the video it links to is not out yet.</p>' : ''}
<div class="campaign-actions">${actions}</div></li>`
}

export const campaignSection = (snapshot: Snapshot, now = new Date()) => {
  const release = timed(snapshot.project.release)
  if (!release)
    return `<section class="release-section"><h3>Campaign</h3><p class="release-state">Set when it goes out to plan the campaign around it.</p></section>`
  const due = new Set(
    dueItems(snapshot.project.release, now).map((item) => item.id)
  )
  const overdue = new Set(
    overdueItems(snapshot.project.release, now).map((item) => item.id)
  )
  // In the order things go out: a moved release moves the launch posts.
  const items = [...release.campaign].sort(byDue(release))
  return `<section class="release-section campaign"><h3>Campaign <small>nothing posts on its own</small></h3>
${snapshot.project.release!.campaignNote ? `<p class="release-note">${escape(snapshot.project.release!.campaignNote)}</p>` : ''}
${
  items.length
    ? `<ol class="campaign-list">${items
        .map((item) =>
          itemRow(item, release, {
            due: due.has(item.id),
            overdue: overdue.has(item.id),
            now
          })
        )
        .join('')}</ol>`
    : ''
}
<p class="release-note">Only YouTube schedules on its own. An approved X or LinkedIn item waits here when its time comes; ${'{link}'} becomes the video’s tagged link.</p>
<button type="button" class="quiet" data-action="plan-campaign">${release.campaign.length ? 'Plan again' : 'Plan the campaign'}</button></section>`
}

/** How many approved items are due, for the Release button. */
export const dueCount = (snapshot: Snapshot) =>
  dueItems(snapshot.project.release).length

/** The Release button: what is due, and what is overdue, drafts among it
 * (review 8, round 1: it counted only what was approved). */
export const releaseLabel = (snapshot: Snapshot, now = new Date()) => {
  const due = dueItems(snapshot.project.release, now).length
  const overdue = overdueItems(snapshot.project.release, now).length
  return [
    'Release',
    ...(due ? [`${due} due`] : []),
    ...(overdue ? [`${overdue} overdue`] : [])
  ].join(' · ')
}
