// A made video's release: when it goes out, each channel's words drafted in
// the creator's voice, and the YouTube upload bundle (the file, its title,
// a description whose timestamps become chapters, a thumbnail, the
// playlist). Nothing here posts: the creator uploads the bundle.
import { MOVED_LATER } from '../shared/campaign'
import { narrativeById } from '../shared/narratives'
import {
  chapters,
  youtubeDescription,
  youtubeTitle
} from '../shared/release-plan'
import {
  chosenCover,
  coverChoices,
  coverCleared,
  coverStamp
} from '../shared/release-cover'
import { needsShapeCut } from '../shared/teaser-shape'
import {
  CHANNEL_LABELS,
  emptyRelease,
  type Channel,
  type PostWords
} from '../shared/release'
import { addEvent } from './activity'
import {
  askOnce,
  claimNote,
  claimProblem,
  limitsFor,
  overclaims
} from './claims'
import { episodeMaterial } from './claims-material'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { readAsset } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { coverImage } from './release-cover'
import { loadSeries } from './series'
import { zipFiles } from './zip'

/** Each channel's limit for a post. */
export const CHANNEL_LIMITS: Record<Channel, number> = {
  x: 280,
  linkedin: 3000,
  youtube: 5000
}
/** A draft's limit: room is left for the link the launch post adds. */
export const POST_LIMITS: Record<Channel, number> = {
  x: CHANNEL_LIMITS.x - 24,
  linkedin: CHANNEL_LIMITS.linkedin - 120,
  youtube: CHANNEL_LIMITS.youtube
}
/** X counts any link as 23 characters. */
export const xLength = (text: string) =>
  text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length

/** The agent's words for each channel: within limits, never pasted thrice. */
export const validatePosts = (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const words = {} as Record<Channel, string>
  for (const channel of Object.keys(POST_LIMITS) as Channel[]) {
    const text = String(value[channel] ?? '').trim()
    const length = channel === 'x' ? xLength(text) : text.length
    if (!text || length > POST_LIMITS[channel])
      problems.push(
        `Write ${channel} in 1–${POST_LIMITS[channel]} characters${channel === 'youtube' ? '' : ', leaving room for the link the launch post adds'}`
      )
    words[channel] = text
  }
  const same = (a: string, b: string) =>
    a &&
    b &&
    a.toLowerCase().replace(/\W/g, '') === b.toLowerCase().replace(/\W/g, '')
  if (same(words.x, words.linkedin) || same(words.linkedin, words.youtube))
    problems.push('Write each channel its own words, never the same text')
  return { ok: !problems.length, problems, warnings: [], value: words }
}

/** Drafts each channel's words in the background. */
export const draftPosts = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot?.project.video?.produced)
    throw new Refusal('Produce the video first')
  if (snapshot.project.video?.storyboard?.stale)
    throw new Refusal(
      'The wireframes changed. Remake the video before exporting it'
    )
  const project = snapshot.project
  const started = await changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    // One draft at a time: a second click while it runs pays for nothing
    // (review 6).
    if (release.drafting?.state === 'drafting')
      throw new Refusal('The posts are being drafted')
    release.drafting = { state: 'drafting', at: new Date().toISOString() }
    current.project.release = release
  })
  // What the creator wrote: the map's source with every note, and the
  // pages' own words, not the lines the studio wrote around them.
  const material = await episodeMaterial(snapshot, { neighbours: true })
  const brief = {
    title: project.title,
    template: narrativeById(project.narrative)?.name || null,
    pages: project.slides.map((slide) => ({
      title: slide.title,
      narration: slide.narration || ''
    })),
    teasers: (project.release?.teasers || [])
      .filter((item) => item.state === 'ready')
      .map((item) => ({ channel: item.channel, aspect: item.aspect })),
    episode: project.episode
      ? {
          number: project.episode.number,
          series: (await loadSeries(project.episode.series))?.title
        }
      : null,
    // The creator's own limits on what the posts may promise.
    // What its pages and the episodes either side say: a post speaks of
    // the next episode too.
    limits: limitsFor(
      material,
      material
        .filter((passage) => passage.from.startsWith('the card'))
        .map((passage) => passage.text)
        .join(' ')
    )
  }
  // Each post that promises more than the material, and where.
  const claimsIn = (words: Record<Channel, string>) =>
    (Object.keys(POST_LIMITS) as Channel[]).flatMap((channel) =>
      overclaims(words[channel] || '', material).map((claim) => ({
        channel,
        claim
      }))
    )
  const asked = new Date().toISOString()
  void (async () => {
    const words = await runValidatedJsonStage<Record<Channel, string>>({
      projectId: id,
      // Each ask is its own run: "Draft again" never replays the last.
      inputKey: fingerprintOf({ brief, asked }),
      checkpoint: 'release-posts',
      stage: 'story',
      route: 'Draft Posts',
      stageContext: { video: brief },
      file: 'story/posts.json',
      tool: 'story_submit_posts',
      packet: {
        'packet/VIDEO.json': JSON.stringify(brief, null, 1),
        // The creator's own writing is their voice.
        'packet/VOICE.md': project.source.slice(0, 8000)
      },
      selection: project.harness ?? (await detectedHarness()),
      origin:
        process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
        `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,
      // A post that promises more than the creator wrote goes back once.
      validate: askOnce(validatePosts, (words) =>
        claimsIn(words).map(({ channel, claim }) =>
          claimProblem(`The ${CHANNEL_LABELS[channel]} post`, claim)
        )
      )
    })
    const left = claimsIn(words)
    await changeProject(id, (current) => {
      const release = current.project.release || emptyRelease()
      release.posts = { ...words, at: new Date().toISOString() }
      delete release.drafting
      current.project.release = release
      addEvent(
        current,
        'video',
        'Drafted the posts for X, LinkedIn and YouTube'
      )
      // Still past the creator's words after the rewrite: flagged beside
      // the post, to write again or keep, and said.
      release.postChecks = Object.fromEntries(
        left.map(({ channel, claim }) => [
          channel,
          { text: words[channel], note: claimNote(claim) }
        ])
      )
      if (!left.length) delete release.postChecks
      for (const { channel, claim } of left)
        addEvent(
          current,
          'video',
          `Check the ${CHANNEL_LABELS[channel]} post. ${claimNote(claim)}`
        )
    })
  })().catch((error: Error) =>
    changeProject(id, (current) => {
      const release = current.project.release || emptyRelease()
      release.drafting = {
        state: 'failed',
        error: error.message || 'The agent could not draft the posts',
        at: new Date().toISOString()
      }
      current.project.release = release
    }).catch(() => {})
  )
  return started
}

/** The release's date, its thumbnail, and the creator's own changes to the
 * words. */
export const updateRelease = (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  return changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    if (value.at !== undefined) {
      const at = value.at ? new Date(String(value.at)) : null
      if (at && Number.isNaN(at.getTime()))
        throw new Refusal('Give the release a date')
      // What the last plan said about its days no longer holds; a squeezed
      // plan moved later says to plan it again (review 8, round 1).
      if (at?.toISOString() !== release.at) {
        const squeezed = Boolean(release.campaignNote)
        const later = Boolean(at && release.at && at > new Date(release.at))
        if (release.campaignNote === MOVED_LATER || (squeezed && later))
          release.campaignNote = MOVED_LATER
        else delete release.campaignNote
      }
      if (at) release.at = at.toISOString()
      else delete release.at
    }
    // The thumbnail the creator picked, one of the pictures offered, with
    // the title over it or not; either asks for approval again.
    if (value.cover === null) delete release.cover
    else if (value.cover && typeof value.cover === 'object') {
      const cover = value.cover as {
        frame?: unknown
        at?: unknown
        poster?: unknown
      }
      const choice = coverChoices(current.project).find((item) =>
        cover.poster
          ? item.poster
          : cover.frame === undefined
            ? item.at !== undefined && item.at === Number(cover.at)
            : item.frame === Number(cover.frame)
      )
      if (!choice) throw new Refusal('Choose one of the thumbnails shown')
      release.cover = {
        ...(choice.poster
          ? { poster: true }
          : choice.frame === undefined
            ? { at: choice.at }
            : { frame: choice.frame }),
        ...(release.cover?.titled ? { titled: true } : {})
      }
    }
    if (typeof value.coverTitle === 'boolean') {
      const picked = { ...release.cover }
      delete picked.approved
      delete picked.titled
      release.cover = {
        ...picked,
        ...(value.coverTitle ? { titled: true } : {})
      }
    }
    // Approved as the creator saw it: the bundle and the upload carry it
    // (review 8, round 2: the bundle's thumbnail went out unseen).
    if (value.approveCover !== undefined) {
      const stamp = coverStamp(current.project)
      if (!stamp) throw new Refusal('The video has no thumbnail to approve')
      if (value.approveCover !== stamp)
        throw new Refusal('The thumbnail changed: look at it again')
      release.cover = { ...release.cover, approved: stamp }
      addEvent(current, 'video', 'Approved the YouTube thumbnail')
    }
    const posts = value.posts as Partial<Record<Channel, unknown>> | undefined
    if (posts && typeof posts === 'object') {
      const next = {
        ...(release.posts || { x: '', linkedin: '', youtube: '' })
      } as PostWords
      for (const channel of Object.keys(POST_LIMITS) as Channel[])
        if (typeof posts[channel] === 'string')
          next[channel] = (posts[channel] as string).slice(
            0,
            POST_LIMITS[channel] + 200
          )
      release.posts = { ...next, at: new Date().toISOString() }
    }
    // A flagged post the creator keeps as it is: the flag goes (review 8).
    const kept = value.keepCheck as Channel | undefined
    if (kept !== undefined) {
      const check = release.postChecks?.[kept]
      if (!check || check.text !== release.posts?.[kept])
        throw new Refusal('That post is no longer flagged')
      check.kept = true
      addEvent(
        current,
        'video',
        `Kept the ${CHANNEL_LABELS[kept]} post as it is`
      )
    }
    current.project.release = release
  })
}

/**
 * The YouTube upload bundle: everything to upload by hand in YouTube Studio
 * while the studio's Google project waits for verification and the audit.
 */
export const uploadBundle = async (id: string) => {
  const snapshot = await loadProject(id)
  const produced = snapshot?.project.video?.produced
  if (!snapshot || !produced) throw new Refusal('Produce the video first')
  if (snapshot.project.video?.storyboard?.stale)
    throw new Refusal(
      'The wireframes changed. Remake the video before exporting it'
    )
  const project = snapshot.project
  // Its thumbnail goes out as the creator approved it, never unseen.
  if (!coverCleared(project))
    throw new Refusal('Approve the thumbnail first: Release shows it')
  const series = project.episode
    ? await loadSeries(project.episode.series)
    : null
  const title = youtubeTitle(project, series?.title)
  const description = youtubeDescription(
    project,
    project.release?.posts?.youtube
  )
  // The thumbnail the dialog shows and the creator approved (review 8);
  // with no picture to offer, YouTube Studio sets one.
  const picture = chosenCover(project)
    ? { name: 'thumbnail.jpg', bytes: await coverImage(project) }
    : null
  // A teaser whose text stays small is a draft: out until drawn again for
  // its shape or kept as it is (review 8, round 1).
  const shorts = (project.release?.teasers || []).filter(
    (item) =>
      item.state === 'ready' &&
      item.channel === 'youtube' &&
      item.objectKey &&
      !needsShapeCut(item)
  )
  const files: Record<string, Buffer | string> = {
    'video.mp4': await readAsset(produced.objectKey),
    'title.txt': title,
    'description.txt': description,
    ...(picture ? { [picture.name]: picture.bytes } : {}),
    ...(series ? { 'playlist.txt': series.title } : {}),
    'README.txt': [
      `Upload “${title}” in YouTube Studio (studio.youtube.com → Create → Upload videos).`,
      '1. Choose video.mp4.',
      '2. Paste title.txt and description.txt. The timestamps in the description become chapters.',
      picture
        ? `3. Set ${picture.name} as the thumbnail.`
        : '3. Choose a thumbnail in YouTube Studio.',
      series
        ? '4. Add it to the playlist named in playlist.txt (create it once).'
        : '',
      chapters(project).length
        ? ''
        : 'There are no chapters: YouTube needs three or more, each at least ten seconds.',
      'A new channel may not have custom thumbnails, videos over 15 minutes or chapters until YouTube verifies it by phone.',
      'The studio prepares this bundle because uploads through the API stay private until its Google project passes verification and the audit.'
    ]
      .filter(Boolean)
      .join('\n')
  }
  for (const [index, short] of shorts.entries())
    files[`short-${index + 1}.mp4`] = await readAsset(short.objectKey!)
  await changeProject(id, (current) =>
    addEvent(current, 'video', 'Prepared the YouTube upload bundle')
  )
  const name =
    project.title
      .replace(/[^\w -]+/g, '')
      .trim()
      .slice(0, 60) || 'video'
  return { name: `${name} - YouTube.zip`, bytes: zipFiles(files) }
}
