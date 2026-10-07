// Reading the numbers back: YouTube's views, watch time and retention for
// the episode's video, X's numbers for the posts the studio sent, and
// LinkedIn's as the creator enters them (its analytics need vetted access).
// The studio keeps its own snapshots: X keeps detail for 30 days only.
import { emptyRelease, type NumbersSnapshot } from '../shared/release'
import { accountFetch } from './accounts'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'

const KEEP = 60

const keep = (id: string, snapshot: NumbersSnapshot) =>
  changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    release.numbers = [...(release.numbers || []), snapshot].slice(-KEEP)
    current.project.release = release
  })

/** A YouTube video's id, from its id or any of its links. */
export const youtubeId = (raw: unknown) => {
  const text = String(raw || '').trim()
  const match =
    text.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([\w-]{11})/) ||
    text.match(/^([\w-]{11})$/)
  if (!match) throw new Refusal('Paste the video’s YouTube link')
  return match[1]
}

/** The video the bundle became, once the creator uploaded it by hand. */
export const setYouTubeVideo = async (id: string, raw: unknown) => {
  const videoId = youtubeId((raw as { video?: unknown })?.video)
  return changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    release.youtube = {
      ...release.youtube,
      state: 'uploaded',
      videoId,
      at: new Date().toISOString()
    }
    current.project.release = release
  })
}

const day = (date: Date) => date.toISOString().slice(0, 10)

/** Views, minutes watched and the hundred-point retention curve. */
export const readYouTube = async (videoId: string, since: string) => {
  const report = async (params: Record<string, string>) => {
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
    url.search = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: since,
      endDate: day(new Date()),
      filters: `video==${videoId}`,
      ...params
    }).toString()
    const response = await accountFetch('google', url.href)
    if (!response.ok)
      throw new Refusal(`YouTube did not give the numbers (${response.status})`)
    return ((await response.json()) as { rows?: number[][] }).rows || []
  }
  const [totals] = await report({ metrics: 'views,estimatedMinutesWatched' })
  const curve = await report({
    metrics: 'audienceWatchRatio',
    dimensions: 'elapsedVideoTimeRatio'
  })
  return {
    views: totals?.[0] ?? 0,
    watchMinutes: totals?.[1] ?? 0,
    retention: curve
      .sort((a, b) => a[0] - b[0])
      .map((row) => Math.round(row[1] * 1000) / 1000)
  }
}

/** Each post's numbers on X, for posts under 30 days old. */
export const readX = async (postIds: string[]) => {
  if (!postIds.length) return {}
  const url = `https://api.x.com/2/tweets?ids=${postIds.slice(0, 100).join(',')}&tweet.fields=public_metrics`
  const response = await accountFetch('x', url)
  if (!response.ok)
    throw new Refusal(`X did not give the numbers (${response.status})`)
  const body = (await response.json()) as {
    data?: Array<{
      id: string
      public_metrics: {
        impression_count?: number
        like_count?: number
        retweet_count?: number
        reply_count?: number
      }
    }>
  }
  return Object.fromEntries(
    (body.data || []).map((post) => [
      post.id,
      {
        impressions: post.public_metrics.impression_count,
        likes: post.public_metrics.like_count,
        reposts: post.public_metrics.retweet_count,
        replies: post.public_metrics.reply_count
      }
    ])
  )
}

const postId = (url?: string) => url?.match(/status\/(\d+)/)?.[1]

/** Reads what each connected source can give, and keeps a snapshot each. */
export const readNumbers = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot) throw new Refusal('Notebook not found')
  const release = snapshot.project.release
  const at = new Date().toISOString()
  const read: string[] = []
  const videoId = release?.youtube?.videoId
  if (videoId) {
    // From the notebook's start: the video cannot be older, and a link
    // pasted days after the upload must not lose those days.
    const since = day(
      new Date(Date.parse(snapshot.events[0]?.time || at) - 86_400_000)
    )
    await keep(id, {
      at,
      source: 'youtube',
      ...(await readYouTube(videoId, since))
    })
    read.push('youtube')
  }
  const posted = (release?.campaign || []).filter(
    (item) =>
      item.channel === 'x' && item.state === 'posted' && postId(item.postUrl)
  )
  if (posted.length) {
    const byPost = await readX(posted.map((item) => postId(item.postUrl)!))
    await keep(id, {
      at,
      source: 'x',
      posts: Object.fromEntries(
        posted.flatMap((item) => {
          const numbers = byPost[postId(item.postUrl)!]
          return numbers ? [[item.id, numbers]] : []
        })
      )
    })
    read.push('x')
  }
  if (!read.length)
    throw new Refusal('Add the video’s YouTube link, or post on X first')
  return (await loadProject(id))!
}

/** LinkedIn's numbers, as the creator reads them off the post. */
export const enterNumbers = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const count = (key: string) => {
    const n = Number(value[key])
    return Number.isInteger(n) && n >= 0 ? n : undefined
  }
  const item = String(value.item || 'linkedin')
  const numbers = {
    impressions: count('impressions'),
    likes: count('likes'),
    reposts: count('reposts'),
    replies: count('replies')
  }
  if (Object.values(numbers).every((n) => n === undefined))
    throw new Refusal('Enter at least one number')
  return keep(id, {
    at: new Date().toISOString(),
    source: 'hand',
    posts: { [item]: numbers }
  })
}
