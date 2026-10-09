// The campaign around a release: teasers in the two weeks before, the
// launch posts on the day, a clip and a quote card in the week after, and a
// recap when a series finishes a run. Dates are relative to the release, so
// moving the release moves the plan; links carry tracking tags.
import type { Project } from './model'
import type { CampaignItem, Channel, Release } from './release'

/** The link token in an item's words, filled in when it is posted. */
export const LINK = '{link}'

const firstLine = (text = '') => text.split(/\n+/)[0]?.trim() || ''
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'video'

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
  const coming = (channel: Channel) =>
    `${firstLine(posts?.[channel]) || project.title} Out soon.`
  const plan = [
    item('teaser', 'x', -14, teaserFor('x'), coming('x')),
    item('teaser', 'linkedin', -7, teaserFor('linkedin'), coming('linkedin')),
    item('teaser', 'x', -2, teaserFor('x'), `${project.title}: in two days.`),
    item(
      'launch',
      'youtube',
      0,
      'episode',
      posts?.youtube || project.title,
      '08:00'
    ),
    item('launch', 'x', 0, 'episode', `${posts?.x || project.title} ${LINK}`),
    item(
      'launch',
      'linkedin',
      0,
      'episode',
      `${posts?.linkedin || project.title}\n\n${LINK}`,
      '10:00'
    ),
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
  return [
    ...kept,
    ...plan.filter((entry) => !kept.some((done) => done.id === entry.id))
  ].sort((a, b) => a.offsetDays - b.offsetDays || a.time.localeCompare(b.time))
}

/** When an item goes out: the release's date, moved by its days, at its time. */
export const dueAt = (releaseAt: string, item: CampaignItem) => {
  const at = new Date(releaseAt)
  at.setDate(at.getDate() + item.offsetDays)
  const [hours, minutes] = item.time.split(':').map(Number)
  at.setHours(hours, minutes, 0, 0)
  return at
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
