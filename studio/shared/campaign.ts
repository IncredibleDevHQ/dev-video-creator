// The campaign around a release: teasers in the two weeks before, the
// launch posts on the day, a clip and a quote card in the week after, and a
// recap when a series finishes a run. Dates are relative to the release, so
// moving the release moves the plan; YouTube's launch keeps its time of day
// too, and the X and LinkedIn launch posts follow YouTube's. Links carry
// tracking tags.
import type { Project } from './model'
import type { CampaignItem, Channel, Release } from './release'

/** The link token in an item's words, filled in when it is posted. */
export const LINK = '{link}'

/** Minutes after the release each channel's launch post goes out: YouTube's
 * is the release itself, then X and LinkedIn an hour apart after YouTube's
 * launch, once the video they link to is out (review 8: YouTube's launch
 * was planned for 08:00 on a release saved for 18:00). */
export const LAUNCH_AFTER: Record<Channel, number> = {
  youtube: 0,
  x: 60,
  linkedin: 120
}

/** The launch times the template set before launch posts moved with the
 * release (review 8, round 1). */
const OLD_LAUNCH: Record<Channel, string> = {
  youtube: '08:00',
  x: '09:00',
  linkedin: '10:00'
}

/** A release with its date set: what every time in the campaign is
 * counted from. */
export type Timed = Pick<Release, 'campaign' | 'youtube'> & { at: string }
export const timed = (release: Release | undefined): Timed | null =>
  release?.at ? (release as Timed) : null

const firstLine = (text = '') => text.split(/\n+/)[0]?.trim() || ''
/** Words that end as a sentence does, so another can follow them. */
const sentence = (text: string) =>
  /[.!?…]["”’)]*$/.test(text) ? text : `${text}.`
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'video'
const pad = (value: number) => String(value).padStart(2, '0')
const clockAt = (at: Date) => `${pad(at.getHours())}:${pad(at.getMinutes())}`

/** YouTube's launch in a campaign, unless it was dropped. */
const youtubeItem = (campaign: CampaignItem[]) =>
  campaign.find(
    (item) =>
      item.channel === 'youtube' &&
      item.kind === 'launch' &&
      item.state !== 'dropped'
  )

/** YouTube's launch once the video is up, however it went up: the studio's
 * upload, or the bundle uploaded by hand and its link pasted (review 8,
 * round 2: the hand upload left the launch overdue for good). One up
 * already takes the link given now, a corrected one pasted over a wrong
 * one (round 3: the launch row kept the old link). A link is the video's
 * word, so a launch the creator said was up is no longer theirs to undo. */
export const markYouTubeUp = (
  campaign: CampaignItem[],
  videoId: string | undefined,
  at: string
) => {
  for (const item of campaign) {
    if (item.channel !== 'youtube' || item.kind !== 'launch') continue
    if (item.state !== 'posted') {
      item.state = 'posted'
      item.postedAt = at
      delete item.note
    }
    if (videoId) {
      item.postUrl = `https://www.youtube.com/watch?v=${videoId}`
      delete item.saidUp
    }
  }
}

/** When the video is out: an upload's own schedule, else the campaign's
 * YouTube launch, else the release. */
export const launchMoment = (release: Timed) =>
  release.youtube?.publishAt
    ? new Date(release.youtube.publishAt)
    : youtubeItem(release.campaign)
      ? dueAt(release, youtubeItem(release.campaign)!)
      : new Date(release.at)

/** When an item goes out: YouTube's launch with the release, the X and
 * LinkedIn launch posts their minutes after YouTube's (review 8, round 1:
 * YouTube at 21:30 left them at 19:00 and 20:00, linking to a video not yet
 * out), any other on the release's date moved by its days, at its time. */
export const dueAt = (release: Timed, item: CampaignItem): Date => {
  const at = new Date(release.at)
  at.setDate(at.getDate() + item.offsetDays)
  if (item.afterRelease !== undefined) {
    const from = item.channel === 'youtube' ? at : launchMoment(release)
    return new Date(from.getTime() + item.afterRelease * 60_000)
  }
  const [hours, minutes] = item.time.split(':').map(Number)
  at.setHours(hours, minutes, 0, 0)
  return at
}

/** An item's time of day as it goes out, local, as HH:MM. */
export const clockOf = (release: Timed, item: CampaignItem) =>
  clockAt(dueAt(release, item))

/**
 * Launch posts planned before they moved with the release, still at the
 * template's times (YouTube 08:00, X 09:00, LinkedIn 10:00, on the day):
 * they follow it now, as a new plan's do (review 8, round 1: YouTube showed
 * 08:00 as "its own time", and the publisher proposed it). Once only: the
 * campaign is marked, and a plan with a launch post that follows the
 * release is no old plan, so a time the creator gives a launch post is
 * never taken for the template's (round 2: YouTube set to 08:00 by hand
 * went back to the release's 18:00 on the next load).
 */
export const followTheRelease = (release: Release | undefined) => {
  if (!release?.campaign?.length || release.launchesFollow) return
  release.launchesFollow = true
  const launches = release.campaign.filter((item) => item.kind === 'launch')
  if (launches.some((item) => item.afterRelease !== undefined)) return
  const old = launches.filter(
    (item) =>
      item.offsetDays === 0 &&
      ['draft', 'approved', 'dropped'].includes(item.state) &&
      item.time === OLD_LAUNCH[item.channel]
  )
  for (const item of old) item.afterRelease = LAUNCH_AFTER[item.channel]
  const when = timed(release)
  if (when) for (const item of old) item.time = clockOf(when, item)
}

/**
 * A teaser's words planned before they ended as a sentence, still unposted
 * ("One click, two lattes Out soon."): the full stop they were missing
 * (review 8, round 1). Words the creator punctuated are left as they are.
 */
export const endOldSentences = (release: Release | undefined) => {
  for (const item of release?.campaign || []) {
    if (item.kind !== 'teaser') continue
    if (!['draft', 'approved', 'dropped'].includes(item.state)) continue
    const old = /^(.*[^\s.!?…,;:"”’)])\s+Out soon\.$/s.exec(item.words)
    if (old) item.words = `${old[1]}. Out soon.`
  }
}

/** How soon a step can still be planned for: an hour from now, time to
 * approve and post it. */
const LEAD_MS = 60 * 60_000
const late = (release: Timed, item: CampaignItem, now: Date) =>
  dueAt(release, item).getTime() <= now.getTime() + LEAD_MS

/** The soonest day an item can still go out at its time, from now: before
 * the release for a teaser, within 60 days of it otherwise; null if none. */
export const nextDay = (
  release: Timed,
  item: CampaignItem,
  now = new Date()
) => {
  for (
    let days = item.offsetDays + 1;
    days <= (item.offsetDays < 0 ? -1 : 60);
    days++
  )
    if (!late(release, { ...item, offsetDays: days }, now)) return days
  return null
}

const midnight = (at: Date) =>
  new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()

/** What a plan made close to the release left out or moved, in a line. */
const fitNote = (releaseAt: string, now: Date, moved: number, left: number) => {
  if (!moved && !left) return undefined
  const days = Math.round(
    (midnight(new Date(releaseAt)) - midnight(now)) / 86_400_000
  )
  const when =
    days < 0
      ? 'The release date has passed'
      : days === 0
        ? 'The release is today'
        : days === 1
          ? 'The release is tomorrow'
          : `The release is in ${days} days`
  const teasers = (count: number) => `${count} teaser${count === 1 ? '' : 's'}`
  return `${when}: ${
    moved && left
      ? `${teasers(moved)} moved closer, ${left} left out`
      : moved
        ? `${teasers(moved)} moved closer`
        : `${teasers(left)} left out`
  }.`
}

/** What a squeezed plan says once the release moves later (review 8,
 * round 1: the note that explained it went, the plan stayed squeezed). */
export const MOVED_LATER =
  'The release moved later: Plan again to spread the lead-up.'

/** What the creator made of a step a plan offered: approved it, wrote its
 * words, or gave it a day or time of its own. */
export type Work = 'approved' | 'words' | 'time'
/** A step of the last plan a new one leaves out, and what the creator had
 * made of it. */
export type Lost = { item: CampaignItem; work: Work[] }

/** What the creator made of a step, against the plan's own for it: a day
 * or time is theirs when they set it (or, saved before that was kept, when
 * it differs from the plan's); a launch post's, when it stopped following
 * the release. */
const workOn = (old: CampaignItem, planned?: CampaignItem): Work[] => [
  ...(old.state === 'approved' ? (['approved'] as const) : []),
  ...(old.edited ? (['words'] as const) : []),
  ...((
    old.kind === 'launch'
      ? old.afterRelease === undefined
      : old.timed ||
        (planned &&
          !old.from &&
          (old.offsetDays !== planned.offsetDays || old.time !== planned.time))
  )
    ? (['time'] as const)
    : [])
]

/**
 * A step planned again, with what the creator made of it the last time
 * kept: approved or dropped, their words, their day and time (review 8,
 * round 2: Plan again put every step back to the template's).
 */
const carry = (planned: CampaignItem, old: CampaignItem): CampaignItem => {
  const work = workOn(old, planned)
  const next: CampaignItem = {
    ...planned,
    state:
      old.state === 'approved' || old.state === 'dropped' ? old.state : 'draft'
  }
  // Approved words are the ones the creator said yes to.
  if (work.includes('words') || work.includes('approved')) {
    next.words = old.words
    if (old.edited) next.edited = true
  }
  if (work.includes('time')) {
    next.offsetDays = old.offsetDays
    next.time = old.time
    if (old.timed) next.timed = true
    delete next.afterRelease
  }
  return next
}

/** The default plan; posted items are the creator's and stay as they are. */
export const planCampaign = (
  project: Project,
  options: { lastOfRun?: boolean; now?: Date } = {}
): CampaignItem[] => campaignPlan(project, options).items

/**
 * The plan, made today: teasers whose day has gone are moved to the soonest
 * day still before the release, one for each channel that has no later one,
 * and the rest left out, with a line saying so (review 8: a plan made three
 * days out offered teasers dated 6 and 13 October as ordinary drafts).
 */
export const campaignPlan = (
  project: Project,
  options: { lastOfRun?: boolean; now?: Date } = {}
): { items: CampaignItem[]; note?: string; lost: Lost[] } => {
  const now = options.now || new Date()
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
    `${sentence(firstLine(posts?.[channel]) || project.title)} Out soon.`
  const countdown = (days: number) =>
    `${project.title}: ${days === -1 ? 'tomorrow' : days === -2 ? 'in two days' : `in ${-days} days`}.`
  const plan = [
    item('teaser', 'x', -14, teaserFor('x'), coming('x')),
    item('teaser', 'linkedin', -7, teaserFor('linkedin'), coming('linkedin')),
    item('teaser', 'x', -2, teaserFor('x'), countdown(-2)),
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
  // A step planned again keeps what the creator made of it; the ones a
  // plan leaves out are said, so the creator is asked first.
  const before = new Map(
    release.campaign
      .filter((entry) => ['draft', 'approved', 'dropped'].includes(entry.state))
      .map((entry) => [entry.id, entry])
  )
  // A step moved closer by an earlier plan is the step it was moved from.
  const origin = new Map<string, string>()
  const carried = new Set<string>()
  let fresh = plan
    .filter((entry) => !kept.some((done) => done.id === entry.id))
    .map((entry) => {
      const old =
        before.get(entry.id) ||
        [...before.values()].find((one) => one.from === entry.id)
      if (!old) return entry
      origin.set(entry.id, old.id)
      carried.add(old.id)
      return carry(entry, old)
    })
  let note: string | undefined
  const at = release.at
  const when = (campaign: CampaignItem[]): Timed => ({
    at: at!,
    campaign,
    youtube: release.youtube
  })
  if (at) {
    const gone = fresh.filter(
      (entry) => entry.offsetDays < 0 && late(when(fresh), entry, now)
    )
    fresh = fresh.filter((entry) => !gone.includes(entry))
    for (const entry of gone) carried.delete(origin.get(entry.id) || '')
    let moved = 0
    for (const channel of new Set(gone.map((entry) => entry.channel))) {
      const covered = [...fresh, ...kept].some(
        (entry) => entry.channel === channel && entry.offsetDays < 0
      )
      const latest = gone.filter((entry) => entry.channel === channel).at(-1)!
      const days = covered ? null : nextDay(when(fresh), latest, now)
      if (days === null) continue
      moved++
      // Moved closer, it is still the step the creator made, on the
      // plan's day now.
      if (origin.has(latest.id)) carried.add(origin.get(latest.id)!)
      const step = { ...latest }
      delete step.timed
      fresh.push({
        ...step,
        id: `${latest.kind}-${channel}-${days}`,
        from: latest.from || latest.id,
        offsetDays: days,
        words:
          latest.words === countdown(latest.offsetDays)
            ? countdown(days)
            : latest.words
      })
    }
    note = fitNote(at, now, moved, gone.length - moved)
  }
  // Planned once the video is up, YouTube's launch has happened.
  const up = release.youtube
  if (up?.state === 'uploaded' && up.videoId)
    markYouTubeUp(fresh, up.videoId, up.publishAt || up.at)
  const all = [...kept, ...fresh]
  const lost = [...before.values()]
    .filter((entry) => !carried.has(entry.id))
    .map((entry) => ({
      item: entry,
      work: workOn(
        entry,
        plan.find((one) => one.id === entry.id)
      )
    }))
    .filter((entry) => entry.work.length)
  return {
    items: at
      ? all.sort(byDue(when(all)))
      : all.sort(
          (a, b) => a.offsetDays - b.offsetDays || a.time.localeCompare(b.time)
        ),
    ...(note ? { note } : {}),
    lost
  }
}

/** The campaign in the order it goes out. */
export const byDue = (release: Timed) => (a: CampaignItem, b: CampaignItem) =>
  dueAt(release, a).getTime() - dueAt(release, b).getTime()

/** A launch post the creator gave a day or a time of its own: it no longer
 * moves with the release, and says so. */
export const ownLaunchTime = (release: Timed, item: CampaignItem) =>
  item.kind === 'launch' &&
  item.afterRelease === undefined &&
  dueAt(release, item).getTime() !==
    dueAt(release, {
      ...item,
      offsetDays: 0,
      afterRelease: LAUNCH_AFTER[item.channel]
    }).getTime()

/** An X or LinkedIn launch post set to go out before the video it links to
 * is: its own time, earlier than YouTube's launch. */
export const beforeLaunch = (release: Timed, item: CampaignItem) =>
  item.kind === 'launch' &&
  item.channel !== 'youtube' &&
  ['draft', 'approved'].includes(item.state) &&
  dueAt(release, item) < launchMoment(release)

/** When YouTube's launch goes out, the campaign's or else the release
 * itself, and whether the creator gave it a time of its own. */
export const youtubeLaunch = (release: Release | undefined) => {
  const when = timed(release)
  if (!when) return null
  const launch = youtubeItem(when.campaign)
  return launch
    ? { at: dueAt(when, launch), own: ownLaunchTime(when, launch) }
    : { at: new Date(when.at), own: false }
}

/** An approved X or LinkedIn item whose time has come: the creator posts it
 * now. A teaser stops being one once the release is out. */
const isDue = (release: Timed, item: CampaignItem, now: Date) =>
  item.state === 'approved' &&
  item.channel !== 'youtube' &&
  dueAt(release, item) <= now &&
  !(item.offsetDays < 0 && new Date(release.at) <= now)

/** Approved items whose time has come and which have not gone out. */
export const dueItems = (release: Release | undefined, now = new Date()) => {
  const when = timed(release)
  return when ? when.campaign.filter((item) => isDue(when, item, now)) : []
}

/** Every other item whose time has gone without it going out, whether it was
 * approved or not: a draft, YouTube's launch, a teaser after the release
 * (review 8: past drafts looked like upcoming work). */
export const overdueItems = (
  release: Release | undefined,
  now = new Date()
) => {
  const when = timed(release)
  return when
    ? when.campaign.filter(
        (item) =>
          (item.state === 'draft' || item.state === 'approved') &&
          dueAt(when, item) <= now &&
          !isDue(when, item, now)
      )
    : []
}

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

/** "with the release", "an hour after YouTube's launch", "2 hours after
 * the release" (when YouTube's launch was dropped). */
export const launchWords = (release: Timed, item: CampaignItem) => {
  const minutes = item.afterRelease || 0
  const from =
    item.channel !== 'youtube' &&
    (release.youtube?.publishAt || youtubeItem(release.campaign))
      ? 'YouTube’s launch'
      : 'the release'
  return minutes === 0
    ? `with ${from}`
    : minutes === 60
      ? `an hour after ${from}`
      : minutes % 60 === 0
        ? `${minutes / 60} hours after ${from}`
        : `${minutes} minutes after ${from}`
}
