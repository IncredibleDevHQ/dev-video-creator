// A made video's release, in one dialog: when it goes out, the teasers cut
// for each channel, the words for each, the YouTube bundle; then the
// campaign, the numbers and publishing (campaign-view.ts).
import type { Snapshot } from '../shared/api'
import { youtubeLaunch } from '../shared/campaign'
import { openPostCheck } from '../shared/claims'
import {
  CHANNEL_ASPECTS,
  CHANNEL_LABELS,
  type Channel,
  type Teaser
} from '../shared/release'
import { chapters } from '../shared/release-plan'
import {
  chosenCover,
  coverApproved,
  coverChoices,
  coverCleared,
  coverSrc,
  coverStamp,
  coverTitled,
  type CoverChoice
} from '../shared/release-cover'
import {
  canRebuild,
  framesToDraw,
  needsShapeCut,
  shapeName
} from '../shared/teaser-shape'
import type { Project } from '../shared/model'
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

/** How long a teaser's text stays small on a phone, in a sentence; drawn
 * again for its shape, it says so (measured as the first cut is). */
const smallWords = (teaser: Teaser) => {
  const small = Math.round(teaser.small || 0)
  const again = teaser.rebuild?.state === 'ready'
  if (small >= length(teaser))
    return again
      ? 'Drawn again, its text still stays small on a phone.'
      : 'Its text stays small on a phone: the frames are wide.'
  return `${again ? 'Drawn again, its text still stays small' : 'Its text stays small'} on a phone for ${small} of its ${length(teaser)} seconds.`
}

/** Why a teaser whose text stays small cannot be drawn again for its
 * shape, and what to do instead (review 8, round 2: a video made scene by
 * scene could only keep its blurred strip, and nothing said why). */
const noRebuild = (project: Project, teaser: Teaser) =>
  project.video?.storyboard?.plan
    ? ''
    : `<small class="teaser-why">Made scene by scene, its pictures are drawn for 16:9 only: make the video again as a storyboard for a ${shapeName(teaser.aspect)} cut${CHANNEL_ASPECTS[teaser.channel].includes('16:9') ? ', cut a 16:9 teaser,' : ''} or keep it as it is.</small>`

/** What a rebuild costs: an AI run for each frame it draws, after one that
 * left some small only those. */
const costWords = (teaser: Teaser, frames: number) =>
  teaser.rebuild?.state === 'ready' && teaser.rebuild.smallFrames?.length
    ? `An AI run for ${frames === 1 ? 'the frame' : `each of the ${frames} frames`} still small`
    : `An AI run for each of its ${frames} frame${frames === 1 ? '' : 's'}`

/** The preview at about a phone's width, sized before it loads. */
const PREVIEW: Record<Teaser['aspect'], string> = {
  '9:16': 'width="270" height="480"',
  '4:5': 'width="270" height="338"',
  '1:1': 'width="270" height="270"',
  '16:9': 'width="270" height="152"'
}

/**
 * What a cut teaser offers. One whose text stays small for more than a
 * fifth of it is a draft that needs a cut for its shape: the frame agent
 * can draw its frames again (an AI run for each), or the creator keeps it
 * as it is; until then it is neither downloaded nor bundled (review 8,
 * round 1).
 */
const teaserOffer = (project: Project, teaser: Teaser) => {
  const shape = shapeName(teaser.aspect)
  const id = escape(teaser.id)
  const rebuild = teaser.rebuild
  if (rebuild?.state === 'rebuilding')
    return `<small class="teaser-status" role="status">Drawing its frames again for ${shape}: ${rebuild.done} of ${rebuild.frames}…</small>`
  const draft = needsShapeCut(teaser)
  const frames = framesToDraw(project, teaser)
  const offer = canRebuild(project, teaser)
    ? `<button type="button" class="${draft ? 'primary' : 'quiet'}" data-action="teaser-rebuild" data-teaser="${id}" data-frames="${frames}">Rebuild for ${shape}</button><small class="teaser-cost">${costWords(teaser, frames)}</small>`
    : ''
  const failed =
    rebuild?.state === 'failed'
      ? `<small class="release-failed">${escape(rebuild.error || 'It could not be drawn again')}</small>`
      : ''
  const download = `<a href="/objects/${escape(teaser.objectKey || '')}" download="teaser-${teaser.channel}-${teaser.aspect.replace(':', 'x')}.mp4">Download</a>`
  if (draft)
    return `<p class="teaser-small"><b>Needs a ${shape} cut.</b> ${smallWords(teaser)}</p>${failed}${offer ? '' : noRebuild(project, teaser)}<div class="teaser-actions">${offer}<button type="button" class="quiet" data-action="teaser-keep" data-teaser="${id}">Keep it as it is</button></div>`
  const small = (teaser.small || 0) >= 1
  if (rebuild?.state === 'ready' && !small)
    return `<small class="teaser-note">Its frames drawn again for ${shape}.</small>${download}`
  return `${small ? `<small class="teaser-small">${smallWords(teaser)}</small>` : ''}${failed}${offer ? `<div class="teaser-actions">${offer}</div>` : ''}${download}`
}

const teaserRow = (project: Project) => (teaser: Teaser) =>
  `<li class="teaser-row${needsShapeCut(teaser) ? ' is-draft' : ''}"><span>${CHANNEL_LABELS[teaser.channel]} · ${teaser.aspect} · ${length(teaser)}s</span>${
    teaser.state === 'cutting'
      ? '<small role="status">Cutting…</small>'
      : teaser.state === 'failed'
        ? `<small class="release-failed">${escape(teaser.error || 'Could not cut it')}</small>`
        : `<video src="/objects/${escape(teaser.objectKey || '')}" ${PREVIEW[teaser.aspect]} muted controls playsinline preload="metadata"></video>${teaserOffer(project, teaser)}`
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
${teasers.length ? `<ul class="teaser-list">${teasers.map(teaserRow(snapshot.project)).join('')}</ul>` : ''}</section>`
}

/** A post that still promises past the creator's words after one rewrite:
 * what to check, beside it, with the two answers (review 8). */
const postCheck = (
  release: Snapshot['project']['release'],
  channel: Channel
) => {
  const note = openPostCheck(release, channel)
  return note
    ? `<p class="page-check">Check this post <small>${escape(note)}</small> <button type="button" class="quiet" data-action="draft-posts">Write it again</button><button type="button" class="quiet" data-action="keep-post-check" data-channel="${channel}">Keep it</button></p>`
    : ''
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
          `<label for="post-${channel}">${CHANNEL_LABELS[channel]} <small>${posts[channel].length}/${LIMITS[channel]}</small></label><textarea id="post-${channel}" name="${channel}" rows="${channel === 'x' ? 3 : 5}">${escape(posts[channel])}</textarea>${postCheck(release, channel)}`
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
 * lists it, the title over it or not, and the other pictures it can be;
 * nothing carries it until the creator approves it (review 8: the bundle's
 * was a frame mid-animation, under half a caption, and nothing showed it;
 * round 2: it went out unseen). */
const thumbnailPicker = (snapshot: Snapshot) => {
  const { project } = snapshot
  const chosen = chosenCover(project)
  if (!chosen) return ''
  const choices = coverChoices(project)
  const titled = coverTitled(project)
  const tile = (choice: CoverChoice) =>
    `<button type="button" class="cover-choice" data-action="choose-cover" ${choice.poster ? 'data-poster="1"' : choice.at === undefined ? `data-frame="${choice.frame}"` : `data-at="${choice.at}"`} aria-pressed="${choice.key === chosen.key}" title="${escape(choice.label)}">` +
    `<img src="${coverSrc(project.id, choice)}" alt="${escape(choice.label)}" loading="lazy"></button>`
  const approve = coverApproved(project)
    ? '<small class="cover-approved">Approved</small>'
    : `<button type="button" class="primary" data-action="approve-cover" data-stamp="${escape(coverStamp(project) || '')}">Approve the thumbnail</button>`
  return `<figure class="release-cover"><img src="${coverSrc(project.id, chosen, titled)}" alt="The thumbnail, ${escape(chosen.label)}${titled ? ', with the title' : ''}" width="240" height="135"><figcaption>Thumbnail · ${escape(chosen.label)}</figcaption></figure>
<div class="cover-actions">${approve}<button type="button" class="quiet" data-action="cover-title" aria-pressed="${titled}">Title on it</button></div>
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
  // The bundle and the upload wait for the thumbnail's approval.
  const cleared = coverCleared(snapshot.project)
  return `<section class="release-section"><h3>YouTube</h3>
<p class="release-state">${marks.length ? `${marks.length} chapters from the beats` : 'No chapters: YouTube needs three or more, ten seconds each'}</p>
${thumbnailPicker(snapshot)}
${
  cleared
    ? `<a class="button" href="/api/projects/${encodeURIComponent(snapshot.project.id)}/bundle" download>Download the upload bundle</a>`
    : '<button type="button" disabled>Download the upload bundle</button>'
}
<p class="release-note">${cleared ? '' : 'Approve the thumbnail first. '}The video, title, description with chapters, thumbnail${snapshot.project.episode ? ' and playlist' : ''}, to upload in YouTube Studio.</p>
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
<button${cleared ? '' : ' disabled'}>Upload to YouTube</button></form>
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
    release?.teasers.some(
      (item) => item.state === 'cutting' || item.rebuild?.state === 'rebuilding'
    ) ||
    release?.youtube?.state === 'uploading' ||
    release?.campaign.some((item) => item.state === 'posting')
  )
}
