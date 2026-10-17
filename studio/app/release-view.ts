// A made video's release, in one dialog: when it goes out, the teasers cut
// for each channel, the words for each, the YouTube bundle; then the
// campaign, the numbers and publishing (campaign-view.ts).
import type { Snapshot } from '../shared/api'
import { youtubeLaunch } from '../shared/campaign'
import {
  CHANNEL_ASPECTS,
  CHANNEL_LABELS,
  type Channel,
  type Teaser
} from '../shared/release'
import { chapters } from '../shared/release-plan'
import {
  chosenCover,
  coverChoices,
  coverSrc,
  type CoverChoice
} from '../shared/release-cover'
import { dayAndTime } from './campaign-view'
import { escape } from './ui'

const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[]
const LIMITS: Record<Channel, number> = {
  x: 280,
  linkedin: 3000,
  youtube: 5000
}

/** A datetime-local value for an ISO time, in the creator's time zone. */
export const localTime = (iso?: string) => {
  if (!iso) return ''
  const at = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

const length = (teaser: Teaser) =>
  Math.round(
    teaser.segments.reduce((sum, part) => sum + part.to - part.from, 0)
  )

const teaserRow = (teaser: Teaser) =>
  `<li class="teaser-row"><span>${CHANNEL_LABELS[teaser.channel]} · ${teaser.aspect} · ${length(teaser)}s</span>${
    teaser.state === 'cutting'
      ? '<small role="status">Cutting…</small>'
      : teaser.state === 'failed'
        ? `<small class="release-failed">${escape(teaser.error || 'Could not cut it')}</small>`
        : `<video src="/objects/${escape(teaser.objectKey || '')}" muted controls playsinline preload="metadata"></video><a href="/objects/${escape(teaser.objectKey || '')}" download="teaser-${teaser.channel}-${teaser.aspect.replace(':', 'x')}.mp4">Download</a>`
  }</li>`

export const teasersSection = (snapshot: Snapshot) => {
  const teasers = snapshot.project.release?.teasers || []
  return `<section class="release-section"><h3>Teasers <small>15–30 s, the hook first, words burned in</small></h3>
<form id="teaser-form" class="teaser-form">
<select name="cut" aria-label="Channel and shape">${CHANNELS.flatMap(
    (channel) =>
      CHANNEL_ASPECTS[channel].map(
        (aspect) =>
          `<option value="${channel} ${aspect}">${CHANNEL_LABELS[channel]} · ${aspect}</option>`
      )
  ).join('')}</select>
<input name="moment" type="number" min="0" step="0.5" placeholder="From second (optional)" aria-label="Start the beat at this second">
<button class="primary">Cut a teaser</button></form>
${teasers.length ? `<ul class="teaser-list">${teasers.map(teaserRow).join('')}</ul>` : ''}</section>`
}

export const postsSection = (snapshot: Snapshot) => {
  const release = snapshot.project.release
  const posts = release?.posts
  const drafting = release?.drafting
  return `<section class="release-section"><h3>Social posts <small>Draft a post for each channel, then review before publishing</small></h3>
${
  drafting?.state === 'drafting'
    ? '<p class="release-state" role="status">Drafting…</p>'
    : `${drafting?.state === 'failed' ? `<p class="release-failed">${escape(drafting.error || 'Could not draft them')}</p>` : ''}<button type="button" class="primary" data-action="draft-posts">${posts ? 'Draft again' : 'Draft the posts'}</button>`
}
${
  posts
    ? `<form id="posts-form" class="posts-form">${CHANNELS.map(
        (channel) =>
          `<label for="post-${channel}">${CHANNEL_LABELS[channel]} <small>${posts[channel].length}/${LIMITS[channel]}</small></label><textarea id="post-${channel}" name="${channel}" rows="${channel === 'x' ? 3 : 5}">${escape(posts[channel])}</textarea>`
      ).join('')}<button class="quiet">Save posts</button></form>`
    : ''
}</section>`
}

const uploadState = (snapshot: Snapshot) => {
  const upload = snapshot.project.release?.youtube
  if (!upload) return ''
  if (upload.state === 'uploading')
    return '<p class="release-state" role="status">Uploading to YouTube…</p>'
  if (upload.state === 'failed')
    return `<p class="release-failed">${escape(upload.error || 'The upload did not finish')}</p>`
  return `<p class="release-state">On YouTube: <a href="https://www.youtube.com/watch?v=${escape(upload.videoId || '')}" target="_blank" rel="noopener">${escape(upload.videoId || '')}</a>${
    upload.publishAt
      ? ` · publishes ${escape(new Date(upload.publishAt).toLocaleString())}`
      : ''
  }</p>${(upload.notes || []).map((note) => `<p class="release-note">${escape(note)}</p>`).join('')}`
}

/** The thumbnail the bundle and the upload carry, at about the size YouTube
 * lists it, and the other pictures it can be (review 8: the bundle's was a
 * frame mid-animation, under half a caption, and nothing showed it). */
const thumbnailPicker = (snapshot: Snapshot) => {
  const { project } = snapshot
  const chosen = chosenCover(project)
  if (!chosen) return ''
  const choices = coverChoices(project)
  const tile = (choice: CoverChoice) =>
    `<button type="button" class="cover-choice" data-action="choose-cover" ${choice.at === undefined ? `data-frame="${choice.frame}"` : `data-at="${choice.at}"`} aria-pressed="${choice.key === chosen.key}" title="${escape(choice.label)}">` +
    `<img src="${coverSrc(project.id, choice)}" alt="${escape(choice.label)}" loading="lazy"></button>`
  return `<figure class="release-cover"><img src="${coverSrc(project.id, chosen)}" alt="The thumbnail, ${escape(chosen.label)}" width="240" height="135"><figcaption>Thumbnail · ${escape(chosen.label)}</figcaption></figure>
${choices.length > 1 ? `<details class="cover-choices"><summary>Choose another thumbnail</summary><div class="cover-grid">${choices.map(tile).join('')}</div></details>` : ''}`
}

export const youtubeSection = (snapshot: Snapshot) => {
  const marks = chapters(snapshot.project)
  const upload = snapshot.project.release?.youtube
  // One launch time for the release, the campaign and the upload: the
  // campaign's YouTube launch, which is the release's unless the creator
  // gave it its own (review 8: the campaign said 08:00, the release 18:00).
  const launch = youtubeLaunch(snapshot.project.release)
  const launchAt = launch ? localTime(launch.at.toISOString()) : ''
  return `<section class="release-section"><h3>YouTube</h3>
<p class="release-state">${marks.length ? `${marks.length} chapters from the beats` : 'No chapters: YouTube needs three or more, ten seconds each'}</p>
${thumbnailPicker(snapshot)}
<a class="button" href="/api/projects/${encodeURIComponent(snapshot.project.id)}/bundle" download>Download the upload bundle</a>
<p class="release-note">The video, title, description with chapters, thumbnail${snapshot.project.episode ? ' and playlist' : ''}, to upload in YouTube Studio.</p>
${uploadState(snapshot)}
${
  upload?.state === 'uploading' || upload?.state === 'uploaded'
    ? ''
    : `<details class="youtube-publish"><summary>Publish from the studio</summary>
<form id="youtube-publish-form" class="youtube-publish-form"${launch ? ` data-launch="${launchAt}"` : ''}>
<label>Who sees it<select name="privacy"><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>
<label>Publish at <small>optional: it goes up private, and YouTube makes it public then</small><span class="publish-at"><input name="publishAt" type="datetime-local" value="">${
        launch
          ? `<button type="button" class="quiet" data-action="use-release-date" data-at="${launchAt}">${launch.own ? 'Use the campaign’s time' : 'Use the release date'}</button>`
          : ''
      }</span></label>
${launch ? `<p class="release-note publish-differs" hidden>The campaign launches it ${escape(dayAndTime(launch.at))}.</p>` : ''}
<button>Upload to YouTube</button></form>
<p class="release-note">Needs YouTube connected (Accounts). Until the studio’s Google project passes verification and YouTube’s audit, YouTube keeps these uploads private.</p></details>`
}</section>`
}

export const releaseDialog = (snapshot: Snapshot, more = '') => {
  const release = snapshot.project.release
  return `<h2>Share your video</h2><p>Prepare a short clip and social posts, then download or publish when you are ready. Nothing posts automatically.</p>
<form id="release-form" class="release-when"><label for="release-at">Release date and time</label><input id="release-at" name="at" type="datetime-local" value="${localTime(release?.at)}"><button class="button">Save date</button></form>
${teasersSection(snapshot)}${postsSection(snapshot)}${youtubeSection(snapshot)}${more}
<div class="dialog-actions"><button type="button" class="quiet" data-action="close">Close</button></div>`
}

/** Whether anything in the release is still being made. */
export const releaseBusy = (snapshot: Snapshot) => {
  const release = snapshot.project.release
  return Boolean(
    release?.drafting?.state === 'drafting' ||
    release?.teasers.some((item) => item.state === 'cutting') ||
    release?.youtube?.state === 'uploading' ||
    release?.campaign.some((item) => item.state === 'posting')
  )
}
