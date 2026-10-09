// The campaign in the release dialog: each item's day, channel, asset and
// words; approve, change or drop it; post it when its time comes. X and
// LinkedIn cannot schedule, so a due item waits for the creator's click.
import type { Snapshot } from '../shared/api'
import { dueAt, dueItems, whenWords } from '../shared/campaign'
import { CHANNEL_LABELS, type CampaignItem } from '../shared/release'
import { escape } from './ui'

const KIND_WORDS: Record<CampaignItem['kind'], string> = {
  teaser: 'Teaser',
  launch: 'Launch',
  clip: 'Clip',
  quote: 'Quote card',
  recap: 'Recap'
}

const itemRow = (item: CampaignItem, releaseAt: string, due: boolean) => {
  const at = dueAt(releaseAt, item)
  const when = `${at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${item.time} · ${whenWords(item.offsetDays)}`
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
          ? `<a href="${escape(item.postUrl || '#')}" target="_blank" rel="noopener">Posted</a>`
          : item.state === 'dropped'
            ? `<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="draft">Restore</button>`
            : `${
                item.state === 'approved'
                  ? `<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="draft">Unapprove</button>`
                  : `<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="approved">Approve</button>`
              }<button type="button" class="quiet" data-action="campaign-state" data-item="${escape(item.id)}" data-state="dropped">Drop</button>${
                item.channel === 'youtube'
                  ? ''
                  : `<button type="button" ${due ? 'class="primary"' : 'class="quiet"'} data-action="campaign-post" data-item="${escape(item.id)}" data-channel="${item.channel}">Post now</button>`
              }`
  return `<li class="campaign-item is-${item.state}${due ? ' is-due' : ''}">
<p class="campaign-when"><b>${KIND_WORDS[item.kind]}</b> ${CHANNEL_LABELS[item.channel]} · ${escape(when)}${due ? ' <small>due</small>' : ''}</p>
${
  ['posted', 'dropped', 'posting', 'unknown'].includes(item.state)
    ? `<p class="campaign-words">${escape(item.words)}</p>`
    : `<form class="campaign-edit" data-item="${escape(item.id)}"><textarea name="words" rows="2" aria-label="The words">${escape(item.words)}</textarea><input name="time" value="${escape(item.time)}" aria-label="Time" pattern="[0-2][0-9]:[0-5][0-9]" size="5"><input name="offsetDays" type="number" value="${item.offsetDays}" aria-label="Days from the release" min="-60" max="60"><button class="quiet">Keep</button></form>`
}
${item.note ? `<p class="campaign-note">${escape(item.note)}</p>` : ''}
<div class="campaign-actions">${actions}</div></li>`
}

export const campaignSection = (snapshot: Snapshot) => {
  const release = snapshot.project.release
  if (!release?.at)
    return `<section class="release-section"><h3>Campaign</h3><p class="release-state">Set when it goes out to plan the campaign around it.</p></section>`
  const due = new Set(dueItems(release).map((item) => item.id))
  return `<section class="release-section campaign"><h3>Campaign <small>nothing posts on its own</small></h3>
${
  release.campaign.length
    ? `<ol class="campaign-list">${release.campaign.map((item) => itemRow(item, release.at!, due.has(item.id))).join('')}</ol>`
    : ''
}
<p class="release-note">Only YouTube schedules on its own. An approved X or LinkedIn item waits here when its time comes; ${'{link}'} becomes the video’s tagged link.</p>
<button type="button" class="quiet" data-action="plan-campaign">${release.campaign.length ? 'Plan again' : 'Plan the campaign'}</button></section>`
}

/** How many approved items are due, for the Release button. */
export const dueCount = (snapshot: Snapshot) =>
  dueItems(snapshot.project.release).length
