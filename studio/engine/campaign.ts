// The campaign, kept with the release: planned from the release date, each
// item approved, changed or dropped by the creator, and posted only when
// they click. X and LinkedIn cannot schedule, so an approved item whose time
// has come waits as a reminder; YouTube's goes out with the upload.
import { LINK, planCampaign, withUtm } from '../shared/campaign'
import { emptyRelease, type CampaignItem } from '../shared/release'
import { addEvent } from './activity'
import { readAsset } from './persistence'
import { postToLinkedIn, postToX } from './posting'
import { CHANNEL_LIMITS, xLength } from './release'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { loadSeries } from './series'

/** Plans (or re-plans) the campaign; posted items stay as they went out. */
export const planCampaignFor = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot) throw new Refusal('Notebook not found')
  if (!snapshot.project.release?.at)
    throw new Refusal('Set when it goes out first')
  const episode = snapshot.project.episode
  const series = episode ? await loadSeries(episode.series) : null
  const lastOfRun = Boolean(
    series?.arc && episode && episode.number >= series.arc.parts.length
  )
  return changeProject(id, (current) => {
    const release = current.project.release || emptyRelease()
    release.campaign = planCampaign(current.project, { lastOfRun })
    current.project.release = release
  })
}

/** The creator's change to one item: words, day, time, or its state. */
export const changeItem = (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  return changeProject(id, (current) => {
    const item = current.project.release?.campaign.find(
      (entry) => entry.id === value.item
    )
    if (!item) throw new Refusal('That item is not in the campaign')
    if (item.state === 'posted') throw new Refusal('It has gone out already')
    if (item.state === 'posting') throw new Refusal('It is being posted now')
    if (typeof value.words === 'string') item.words = value.words.slice(0, 5000)
    if (value.offsetDays !== undefined) {
      const days = Number(value.offsetDays)
      if (!Number.isInteger(days) || Math.abs(days) > 60)
        throw new Refusal('Keep it within 60 days of the release')
      item.offsetDays = days
    }
    if (typeof value.time === 'string') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
        throw new Refusal('Give the time as HH:MM')
      item.time = value.time
    }
    if (['draft', 'approved', 'dropped'].includes(String(value.state)))
      item.state = value.state as CampaignItem['state']
  })
}

/** The item's words with its link filled in and tagged. */
export const itemWords = (
  project: import('../shared/model').Project,
  item: CampaignItem
) => {
  if (!item.words.includes(LINK)) return item.words
  const videoId = project.release?.youtube?.videoId
  if (!videoId)
    throw new Refusal(
      'Add the video’s YouTube link first: the post links to it'
    )
  return item.words.replaceAll(
    LINK,
    withUtm(`https://www.youtube.com/watch?v=${videoId}`, project, item)
  )
}

/** The teaser an item shows: its own, else one cut for its channel since. */
const teaserOf = (
  release: NonNullable<import('../shared/model').Project['release']>,
  item: CampaignItem
) => {
  if (item.asset === 'episode' || item.asset === 'quote') return null
  const ready = release.teasers.filter((entry) => entry.state === 'ready')
  return (
    ready.find((entry) => entry.id === item.asset) ||
    ready.find((entry) => entry.channel === item.channel) ||
    ready[0] ||
    null
  )
}

/**
 * Posts one item, now, because the creator clicked: with its teaser when
 * it shows one. The item is claimed inside the notebook's queue first, so
 * a second click while it uploads is refused, never posted (and charged)
 * twice. Returns the notebook with the item posted.
 */
export const postItem = async (id: string, raw: unknown) => {
  const itemId = String((raw as { item?: unknown })?.item || '')
  let item: CampaignItem | undefined
  let words = ''
  let videoKey: string | undefined
  let title = ''
  let before: CampaignItem['state'] = 'approved'
  await changeProject(id, (current) => {
    const release = current.project.release
    const found = release?.campaign.find((entry) => entry.id === itemId)
    if (!release || !found)
      throw new Refusal('That item is not in the campaign')
    if (found.state === 'posted') throw new Refusal('It has gone out already')
    if (found.state === 'posting') throw new Refusal('It is being posted now')
    if (found.state === 'dropped') throw new Refusal('Restore it first')
    if (found.channel === 'youtube')
      throw new Refusal(
        'YouTube’s goes out with the upload: use the bundle, or publish'
      )
    words = itemWords(current.project, found)
    const length = found.channel === 'x' ? xLength(words) : words.length
    if (length > CHANNEL_LIMITS[found.channel])
      throw new Refusal(
        `It is ${length} characters; ${found.channel === 'x' ? 'X takes 280, a link counting as 23' : 'LinkedIn takes 3000'}`
      )
    const teaser = teaserOf(release, found)
    if (found.kind === 'teaser' && !teaser)
      throw new Refusal('Cut a teaser for it first')
    videoKey = teaser?.objectKey
    title = current.project.title
    before = found.state
    found.state = 'posting'
    delete found.note
    item = { ...found }
  })
  const posting = item!
  try {
    const video = videoKey ? await readAsset(videoKey) : undefined
    const url =
      posting.channel === 'x'
        ? await postToX(words, video)
        : await postToLinkedIn(words, video, title)
    return await changeProject(id, (current) => {
      const kept = current.project.release?.campaign.find(
        (entry) => entry.id === itemId
      )
      if (!kept) return
      kept.state = 'posted'
      kept.postedAt = new Date().toISOString()
      kept.postUrl = url
      addEvent(
        current,
        'video',
        `Posted on ${posting.channel === 'x' ? 'X' : 'LinkedIn'}`
      )
    })
  } catch (error) {
    await changeProject(id, (current) => {
      const kept = current.project.release?.campaign.find(
        (entry) => entry.id === itemId
      )
      if (!kept || kept.state !== 'posting') return
      kept.state = before
      kept.note = error instanceof Refusal ? error.message : 'It did not go out'
    }).catch(() => {})
    throw error
  }
}
