// A made video's release: when it goes out, each channel's words drafted in
// the creator's voice, and the YouTube upload bundle (the file, its title,
// a description whose timestamps become chapters, a thumbnail, the
// playlist). Nothing here posts: the creator uploads the bundle.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { narrativeById } from '../shared/narratives'
import { chapters, youtubeDescription } from '../shared/release-plan'
import { emptyRelease, type Channel, type PostWords } from '../shared/release'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { readAsset } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { loadSeries } from './series'
import { runCommand } from './voice'
import { zipFiles } from './zip'

export const POST_LIMITS: Record<Channel, number> = {
  x: 280,
  linkedin: 3000,
  youtube: 5000
}
/** X counts any link as 23 characters. */
const xLength = (text: string) =>
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
        `Write ${channel} in 1–${POST_LIMITS[channel]} characters${channel === 'x' ? ' (a link counts as 23)' : ''}`
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
  const project = snapshot.project
  const started = await changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    release.drafting = { state: 'drafting', at: new Date().toISOString() }
    current.project.release = release
  })
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
      : null
  }
  void (async () => {
    const words = await runValidatedJsonStage<Record<Channel, string>>({
      projectId: id,
      inputKey: fingerprintOf(brief),
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
      validate: validatePosts
    })
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

/** The release's date and the creator's own changes to the words. */
export const updateRelease = (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  return changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    if (value.at !== undefined) {
      const at = value.at ? new Date(String(value.at)) : null
      if (at && Number.isNaN(at.getTime()))
        throw new Refusal('Give the release a date')
      if (at) release.at = at.toISOString()
      else delete release.at
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
    current.project.release = release
  })
}

const thumbnail = async (objectKey: string, posterKey?: string) => {
  if (posterKey)
    return { name: 'thumbnail.jpg', bytes: await readAsset(posterKey) }
  const dir = await mkdtemp(join(tmpdir(), 'studio-thumbnail-'))
  try {
    await writeFile(join(dir, 'video.mp4'), await readAsset(objectKey))
    await runCommand('ffmpeg', [
      '-y',
      '-ss',
      '1.5',
      '-i',
      join(dir, 'video.mp4'),
      '-frames:v',
      '1',
      '-vf',
      'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      join(dir, 'thumbnail.jpg')
    ])
    return {
      name: 'thumbnail.jpg',
      bytes: await readFile(join(dir, 'thumbnail.jpg'))
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * The YouTube upload bundle: everything to upload by hand in YouTube Studio
 * while the studio's Google project waits for verification and the audit.
 */
export const uploadBundle = async (id: string) => {
  const snapshot = await loadProject(id)
  const produced = snapshot?.project.video?.produced
  if (!snapshot || !produced) throw new Refusal('Produce the video first')
  const project = snapshot.project
  const series = project.episode
    ? await loadSeries(project.episode.series)
    : null
  const title = (
    series
      ? `${project.title} | ${series.title}, episode ${project.episode!.number}`
      : project.title
  ).slice(0, 100)
  const description = youtubeDescription(
    project,
    project.release?.posts?.youtube
  )
  const picture = await thumbnail(produced.objectKey, produced.posterKey)
  const shorts = (project.release?.teasers || []).filter(
    (item) =>
      item.state === 'ready' && item.channel === 'youtube' && item.objectKey
  )
  const files: Record<string, Buffer | string> = {
    'video.mp4': await readAsset(produced.objectKey),
    'title.txt': title,
    'description.txt': description,
    [picture.name]: picture.bytes,
    ...(series ? { 'playlist.txt': series.title } : {}),
    'README.txt': [
      `Upload “${title}” in YouTube Studio (studio.youtube.com → Create → Upload videos).`,
      '1. Choose video.mp4.',
      '2. Paste title.txt and description.txt. The timestamps in the description become chapters.',
      `3. Set ${picture.name} as the thumbnail.`,
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
