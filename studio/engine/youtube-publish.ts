// Publishing an episode to the creator's YouTube channel from the studio:
// a resumable upload with its title and description (chapters from the
// beats), its thumbnail, the series as a playlist, and a time YouTube
// publishes it at on its own servers. Until the studio's Google project
// passes Google's verification and YouTube's audit, YouTube keeps API
// uploads private; the studio says so, and the bundle stays the way out.
import { youtubeDescription } from '../shared/release-plan'
import { emptyRelease, type YouTubeUpload } from '../shared/release'
import { accountFetch, canEditPlaylists } from './accounts'
import { addEvent } from './activity'
import { readAsset } from './persistence'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { loadSeries } from './series'

const API = 'https://www.googleapis.com/youtube/v3'
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3'
const PRIVACY = ['private', 'unlisted', 'public'] as const
type Privacy = (typeof PRIVACY)[number]

const ok = async (response: Response, what: string) => {
  if (!response.ok)
    throw new Refusal(`YouTube refused the ${what} (${response.status})`)
  const text = await response.text()
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

/** The series' playlist on the channel: found by its title, or made. */
const playlistFor = async (title: string) => {
  const found = await ok(
    await accountFetch(
      'google',
      `${API}/playlists?part=snippet&mine=true&maxResults=50`
    ),
    'playlists'
  )
  const items = (found.items || []) as Array<{
    id: string
    snippet: { title: string }
  }>
  const same = items.find((item) => item.snippet.title === title)
  if (same) return same.id
  const made = await ok(
    await accountFetch('google', `${API}/playlists?part=snippet,status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        snippet: { title },
        status: { privacyStatus: 'public' }
      })
    }),
    'playlist'
  )
  return String(made.id)
}

/** Uploads the video and its parts; returns what YouTube kept. */
export const uploadToYouTube = async (
  id: string,
  options: { privacy: Privacy; publishAt?: string },
  /** Told the video's id the moment YouTube has it, before the extras. */
  uploaded: (videoId: string) => Promise<unknown> = async () => {}
) => {
  const snapshot = await loadProject(id)
  const project = snapshot?.project
  const produced = project?.video?.produced
  if (!project || !produced) throw new Refusal('Produce the video first')
  const series = project.episode
    ? await loadSeries(project.episode.series)
    : null
  const bytes = await readAsset(produced.objectKey)
  // A scheduled video is private until YouTube publishes it at its time.
  const privacyStatus = options.publishAt ? 'private' : options.privacy
  const start = await accountFetch(
    'google',
    `${UPLOAD}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': 'video/mp4',
        'x-upload-content-length': String(bytes.length)
      },
      body: JSON.stringify({
        snippet: {
          title: project.title.slice(0, 100),
          description: youtubeDescription(
            project,
            project.release?.posts?.youtube
          ).slice(0, 5000),
          categoryId: '28'
        },
        status: {
          privacyStatus,
          ...(options.publishAt ? { publishAt: options.publishAt } : {}),
          selfDeclaredMadeForKids: false
        }
      })
    }
  )
  if (!start.ok)
    throw new Refusal(`YouTube refused the upload (${start.status})`)
  const location = start.headers.get('location')
  if (!location) throw new Refusal('YouTube did not say where to upload')
  const video = await ok(
    await accountFetch('google', location, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(30 * 60_000)
    }),
    'video'
  )
  const videoId = String(video.id || '')
  if (!videoId) throw new Refusal('YouTube did not say which video it made')
  await uploaded(videoId)
  const notes: string[] = []
  const kept = (video.status as { privacyStatus?: string } | undefined)
    ?.privacyStatus
  if (privacyStatus !== 'private' && kept === 'private')
    notes.push(
      'YouTube kept it private: uploads from the studio stay private until its Google project passes verification and the audit. Change it in YouTube Studio.'
    )
  if (produced.posterKey) {
    const thumb = await accountFetch(
      'google',
      `${UPLOAD}/thumbnails/set?videoId=${videoId}`,
      {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg' },
        body: new Uint8Array(await readAsset(produced.posterKey))
      }
    )
    if (!thumb.ok)
      notes.push(
        'The thumbnail was not set: custom thumbnails need a channel verified by phone.'
      )
  }
  // The video is up: a playlist YouTube refuses is a note, never a reason
  // to lose the video or upload it twice.
  if (series && !(await canEditPlaylists()))
    notes.push(
      `It was not added to the “${series.title}” playlist: sign in to YouTube again, so the studio may add videos to playlists.`
    )
  else if (series)
    try {
      const playlistId = await playlistFor(series.title)
      await ok(
        await accountFetch('google', `${API}/playlistItems?part=snippet`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            snippet: {
              playlistId,
              resourceId: { kind: 'youtube#video', videoId }
            }
          })
        }),
        'playlist item'
      )
    } catch {
      notes.push(
        `It was not added to the “${series.title}” playlist: add it in YouTube Studio.`
      )
    }
  return { videoId, notes }
}

const setUpload = (id: string, upload: YouTubeUpload & { notes?: string[] }) =>
  changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    release.youtube = upload
    current.project.release = release
  })

/**
 * Publishes the episode in the background, on the creator's click: now, or
 * scheduled for a time YouTube keeps on its own servers.
 */
export const publishToYouTube = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const privacy = (PRIVACY as readonly string[]).includes(String(value.privacy))
    ? (value.privacy as Privacy)
    : 'private'
  const publishAt = value.publishAt ? new Date(String(value.publishAt)) : null
  if (
    publishAt &&
    (Number.isNaN(publishAt.getTime()) ||
      publishAt.getTime() < Date.now() + 60_000)
  )
    throw new Refusal('Schedule it for a time in the future')
  const at = new Date().toISOString()
  // Claimed inside the notebook's queue: two clicks never upload twice.
  const started = await changeProject(id, (current) => {
    if (!current.project.video?.produced)
      throw new Refusal('Produce the video first')
    const release = current.project.release || emptyRelease()
    if (release.youtube?.state === 'uploading')
      throw new Refusal('It is uploading now')
    if (release.youtube?.state === 'uploaded' && release.youtube.videoId)
      throw new Refusal('It is on YouTube already: change it in YouTube Studio')
    release.youtube = {
      state: 'uploading',
      ...(publishAt ? { publishAt: publishAt.toISOString() } : {}),
      at
    }
    current.project.release = release
  })
  let videoId = ''
  void (async () => {
    const { notes } = await uploadToYouTube(
      id,
      { privacy, ...(publishAt ? { publishAt: publishAt.toISOString() } : {}) },
      async (made) => {
        // Kept the moment YouTube has it: a later failure never loses it.
        videoId = made
        await changeProject(id, (current) => {
          const release = current.project.release || emptyRelease()
          release.youtube = { ...release.youtube!, videoId: made }
          current.project.release = release
        })
      }
    )
    await changeProject(id, (current) => {
      const release = current.project.release || emptyRelease()
      release.youtube = {
        state: 'uploaded',
        videoId,
        ...(publishAt ? { publishAt: publishAt.toISOString() } : {}),
        ...(notes.length ? { notes } : {}),
        at: new Date().toISOString()
      }
      // The launch on YouTube is this upload: YouTube publishes it itself.
      for (const item of release.campaign)
        if (item.channel === 'youtube' && item.kind === 'launch') {
          item.state = 'posted'
          item.postedAt = publishAt?.toISOString() || new Date().toISOString()
          item.postUrl = `https://www.youtube.com/watch?v=${videoId}`
        }
      current.project.release = release
      addEvent(
        current,
        'video',
        publishAt
          ? `Scheduled on YouTube for ${publishAt.toISOString()}`
          : 'Uploaded to YouTube'
      )
    })
  })().catch((error: Error) =>
    setUpload(id, {
      // With the video up, it is uploaded, and what failed after is a note.
      ...(videoId
        ? {
            state: 'uploaded' as const,
            videoId,
            notes: [
              'The upload finished, but the studio could not finish its extras.'
            ]
          }
        : {
            state: 'failed' as const,
            error:
              error instanceof Refusal
                ? error.message
                : 'The upload did not finish'
          }),
      ...(publishAt ? { publishAt: publishAt.toISOString() } : {}),
      at: new Date().toISOString()
    }).catch(() => {})
  )
  return started
}
