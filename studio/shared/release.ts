// What goes out once a video is made: teasers cut for each channel, the
// posts' words, the YouTube upload bundle, the campaign around the release
// and the numbers that come back. Everything is drafted; nothing goes out
// until the creator says so.

export type Channel = 'x' | 'linkedin' | 'youtube'
export type Aspect = '9:16' | '1:1' | '4:5' | '16:9'

export const CHANNEL_LABELS: Record<Channel, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube'
}

/** The shapes each channel takes, the first its default. */
export const CHANNEL_ASPECTS: Record<Channel, Aspect[]> = {
  x: ['1:1', '9:16', '16:9'],
  linkedin: ['4:5', '1:1', '9:16'],
  youtube: ['9:16']
}

/** Teasers run 15–30 seconds: the hook in the first three. */
export const TEASER_SECONDS: [number, number] = [15, 30]

export type Teaser = {
  id: string
  channel: Channel
  aspect: Aspect
  /** The cuts from the produced video, in seconds: the hook, then a beat. */
  segments: Array<{ from: number; to: number }>
  state: 'cutting' | 'ready' | 'failed'
  objectKey?: string
  error?: string
  at: string
}

/** Each channel's words, drafted in the creator's voice. */
export type PostWords = Record<Channel, string> & { at: string }

export type CampaignItem = {
  id: string
  channel: Channel
  /** 'episode', a teaser's id, or 'quote' for a quote card. */
  asset: string
  kind: 'teaser' | 'launch' | 'clip' | 'quote' | 'recap'
  words: string
  /** Days from the release: −14 is two weeks before. */
  offsetDays: number
  /** The time of day, local, as HH:MM. */
  time: string
  /** unknown: no answer came back; it may have gone out. */
  state: 'draft' | 'approved' | 'dropped' | 'posting' | 'posted' | 'unknown'
  postedAt?: string
  postUrl?: string
  /** What went wrong, or needs checking, the last time it was posted. */
  note?: string
}

export type YouTubeUpload = {
  state: 'uploading' | 'uploaded' | 'failed'
  videoId?: string
  publishAt?: string
  error?: string
  /** What YouTube did not do: kept it private, no custom thumbnail. */
  notes?: string[]
  at: string
}

/** The numbers, as read at one moment: the studio keeps its own. */
export type NumbersSnapshot = {
  at: string
  source: 'youtube' | 'x' | 'linkedin' | 'hand'
  views?: number
  watchMinutes?: number
  /** YouTube's audience watch ratio at each hundredth of the video. */
  retention?: number[]
  /** A post's numbers, by campaign item. */
  posts?: Record<
    string,
    { impressions?: number; likes?: number; reposts?: number; replies?: number }
  >
}

export type Release = {
  /** The release, as an ISO date and time. */
  at?: string
  teasers: Teaser[]
  posts?: PostWords
  drafting?: { state: 'drafting' | 'failed'; error?: string; at: string }
  campaign: CampaignItem[]
  youtube?: YouTubeUpload
  numbers?: NumbersSnapshot[]
}

/** A product demo, captured from a page by following steps. */
export type CaptureStep =
  | { do: 'goto'; url: string }
  /** `target` is a CSS selector, or the words on the element. */
  | { do: 'click'; target: string }
  | { do: 'type'; target: string; text: string }
  | { do: 'scroll'; y: number }
  | { do: 'wait'; ms: number }

export type ProductCapture = {
  url: string
  steps: CaptureStep[]
  state: 'planning' | 'capturing' | 'ready' | 'failed'
  objectKey?: string
  seconds?: number
  error?: string
  at: string
  /** The last good capture, kept while a new one is made or if it fails. */
  last?: {
    url: string
    steps: CaptureStep[]
    objectKey: string
    seconds: number
    at: string
  }
}

export const emptyRelease = (): Release => ({ teasers: [], campaign: [] })
