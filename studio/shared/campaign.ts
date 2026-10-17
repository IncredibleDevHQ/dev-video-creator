// The campaign around a release: teasers in the two weeks before, the
// launch posts on the day, a clip and a quote card in the week after, and a
// recap when a series finishes a run. Dates are relative to the release, so
// moving the release moves the plan, and the launch posts keep its time of
// day as well; links carry tracking tags.
import type { Project } from './model'
import type { CampaignItem, Channel, Release } from './release'

/** The link token in an item's words, filled in when it is posted. */
export const LINK = '{link}'

/** Minutes after the release each channel's launch post goes out: YouTube's
 * is the release itself, then X and LinkedIn an hour apart, once the video
 * they link to is out (review 8: YouTube's launch was planned for 08:00 on a
 * release saved for 18:00). */
export const LAUNCH_AFTER: Record<Channel, number> = {
  youtube: 0,
  x: 60,
  linkedin: 120
}

const firstLine = (text = '') => text.split(/\n+/)[0]?.trim() || ''
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'video'
const pad = (value: number) => String(value).padStart(2, '0')
const clockAt = (at: Date) => `${pad(at.getHours())}:${pad(at.getMinutes())}`

/** When an item goes out: a launch post its minutes after the release, any
 * other on the release's date moved by its days, at its own time. */
export const dueAt = (releaseAt: string, item: CampaignItem) => {
  const at = new Date(releaseAt)
  at.setDate(at.getDate() + item.offsetDays)
  if (item.afterRelease !== undefined) {
    at.setMinutes(at.getMinutes() + item.afterRelease)
    return at
  }
  const [hours, minutes] = item.time.split(':').map(Number)
  at.setHours(hours, minutes, 0, 0)
  return at
}

/** An item's time of day as it goes out, local, as HH:MM. */
export const clockOf = (releaseAt: string, item: CampaignItem) =>
  clockAt(dueAt(releaseAt, item))

/** The default plan; posted items are the creator's and stay as they are. */
export const planCampaign = (
  project: Project,
  options: { lastOfRun?: boolean } = {}
): CampaignItem[] => {
  const release: Release = project.release || { teasers: [], campaign: [] }
  const posts = release.posts
  const ready = release.teasers.filter((item) => item.state === 'ready')
  const teaserFor = (channel: Channel) =>
    ready.find((item) => item.channel === channel)?.id ||
    ready[0]?.id ||
    'teaser'
  const quote =
    project.slides
      .find((slide) => slide.narration)
      ?.narration?.split(/(?<=\.)\s/)[0] || project.title
  const item = (
    kind: CampaignItem['kind'],
    channel: Channel,
    offsetDays: number,
    asset: string,
    words: string,
    time = '09:00'
  ): CampaignItem => ({
    id: `${kind}-${channel}-${offsetDays}`,
    channel,
    asset,
    kind,
    words,
    offsetDays,
    time,
    state: 'draft'
  })
  // The launch keeps the release's own time: YouTube's goes out with it.
  const launch = (channel: Channel, words: string): CampaignItem => {
    const after = LAUNCH_AFTER[channel]
    const time = release.at
      ? clockAt(new Date(Date.parse(release.at) + after * 60_000))
      : '09:00'
    return {
      ...item('launch', channel, 0, 'episode', words, time),
      afterRelease: after
    }
  }
  const coming = (channel: Channel) =>
    `${firstLine(posts?.[channel]) || project.title} Out soon.`
  const plan = [
    item('teaser', 'x', -14, teaserFor('x'), coming('x')),
    item('teaser', 'linkedin', -7, teaserFor('linkedin'), coming('linkedin')),
    item('teaser', 'x', -2, teaserFor('x'), `${project.title}: in two days.`),
    launch('youtube', posts?.youtube || project.title),
    launch('x', `${posts?.x || project.title} ${LINK}`),
    launch('linkedin', `${posts?.linkedin || project.title}\n\n${LINK}`),
    item(
      'clip',
      'x',
      2,
      teaserFor('x'),
      `In case you missed it: ${project.title} ${LINK}`
    ),
    item('quote', 'linkedin', 7, 'quote', `“${quote}”\n\n${LINK}`)
  ]
  if (options.lastOfRun)
    plan.push(
      item(
        'recap',
        'linkedin',
        10,
        'episode',
        `That is the run. ${project.title} closes it. ${LINK}`
      )
    )
  // Posted items stay, and so do ones that may have gone out (review 6: a
  // new plan offered them as drafts to post again).
  const kept = release.campaign.filter(
    (entry) => entry.state === 'posted' || entry.state === 'unknown'
  )
  const all = [
    ...kept,
    ...plan.filter((entry) => !kept.some((done) => done.id === entry.id))
  ]
  return release.at
    ? all.sort(byDue(release.at))
    : all.sort(
        (a, b) => a.offsetDays - b.offsetDays || a.time.localeCompare(b.time)
      )
}

/** The campaign in the order it goes out. */
export const byDue =
  (releaseAt: string) => (a: CampaignItem, b: CampaignItem) =>
    dueAt(releaseAt, a).getTime() - dueAt(releaseAt, b).getTime()

/** A launch post the creator gave a day or a time of its own: it no longer
 * moves with the release, and says so. */
export const ownLaunchTime = (releaseAt: string, item: CampaignItem) =>
  item.kind === 'launch' &&
  item.afterRelease === undefined &&
  dueAt(releaseAt, item).getTime() !==
    dueAt(releaseAt, {
      ...item,
      offsetDays: 0,
      afterRelease: LAUNCH_AFTER[item.channel]
    }).getTime()

/** When YouTube's launch goes out, the campaign's or else the release
 * itself, and whether the creator gave it a time of its own. */
export const youtubeLaunch = (release: Release | undefined) => {
  if (!release?.at) return null
  const launch = release.campaign.find(
    (item) =>
      item.channel === 'youtube' &&
      item.kind === 'launch' &&
      item.state !== 'dropped'
  )
  return launch
    ? { at: dueAt(release.at, launch), own: ownLaunchTime(release.at, launch) }
    : { at: new Date(release.at), own: false }
}

/** Approved items whose time has come and which have not gone out. */
export const dueItems = (release: Release | undefined, now = new Date()) =>
  release?.at
    ? release.campaign.filter(
        (item) =>
          item.state === 'approved' &&
          item.channel !== 'youtube' &&
          dueAt(release.at!, item) <= now
      )
    : []

/** A link tagged so the numbers can say which post sent people. */
export const withUtm = (url: string, project: Project, item: CampaignItem) => {
  const tagged = new URL(url)
  tagged.searchParams.set('utm_source', item.channel)
  tagged.searchParams.set('utm_medium', 'social')
  tagged.searchParams.set('utm_campaign', slug(project.title))
  tagged.searchParams.set('utm_content', `${item.kind}${item.offsetDays}`)
  return tagged.href
}

/** "14 days before", "on the day", "a week after". */
export const whenWords = (offsetDays: number) =>
  offsetDays === 0
    ? 'on the day'
    : offsetDays === 7 || offsetDays === -7
      ? `a week ${offsetDays < 0 ? 'before' : 'after'}`
      : `${Math.abs(offsetDays)} ${Math.abs(offsetDays) === 1 ? 'day' : 'days'} ${offsetDays < 0 ? 'before' : 'after'}`

/** "with the release", "an hour after the release", "2 hours after …". */
export const launchWords = (minutes: number) =>
  minutes === 0
    ? 'with the release'
    : minutes === 60
      ? 'an hour after the release'
      : minutes % 60 === 0
        ? `${minutes / 60} hours after the release`
        : `${minutes} minutes after the release`
