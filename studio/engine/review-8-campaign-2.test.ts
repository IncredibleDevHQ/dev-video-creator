import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { CampaignItem } from '../shared/release'
// Review 8, round 1: the campaign's launch times. Nothing posts: campaigns
// are saved, loaded and shown on a throwaway notebook.
vi.mock('../app/studio-api', () => ({
  studioApi: { request: vi.fn(), notebook: vi.fn() }
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-campaign-2-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { parseHTML } = await import('linkedom')
const plan = await import('../shared/campaign')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { campaignSection } = await import('../app/campaign-view')
const { youtubeSection } = await import('../app/release-view')
afterAll(() => rm(root, { recursive: true, force: true }))

const doc = (html: string) => parseHTML(`<div>${html}</div>`).document
const RELEASE = new Date(2026, 9, 20, 18, 0).toISOString()
const EARLY = new Date(2026, 8, 29, 9, 0)
const launch = (
  channel: CampaignItem['channel'],
  time: string,
  extra: Partial<CampaignItem> = {}
): CampaignItem => ({
  id: `launch-${channel}-0`,
  channel,
  asset: 'episode',
  kind: 'launch',
  words: `Out now on ${channel} {link}`,
  offsetDays: 0,
  time,
  state: 'draft',
  ...extra
})
const project = (campaign: CampaignItem[], extra = {}): Project => ({
  id: 'legacy',
  title: 'One click, two lattes',
  source: '',
  slides: [],
  video: null,
  release: { teasers: [], campaign, at: RELEASE, ...extra }
})
const snapshot = (value: Project): Snapshot => ({
  project: value,
  status: 'ready',
  error: null,
  events: []
})
const rowOf = (page: Document, channel: string) =>
  [...page.querySelectorAll('.campaign-item')].find((item) =>
    item.querySelector('.campaign-when')!.textContent!.includes(channel)
  )!

it('turns a campaign planned before launch posts moved with the release into one that does (F17, round 1)', async () => {
  // Planned before the fix: the old template's 08:00, 09:00 and 10:00.
  await writeRow(
    'projects',
    'legacy',
    snapshot(
      project([
        launch('youtube', '08:00'),
        launch('x', '09:00', { state: 'approved' }),
        launch('linkedin', '10:00', {
          state: 'posted',
          postUrl: 'https://www.linkedin.com/feed/'
        })
      ])
    )
  )
  const loaded = (await loadProject('legacy'))!
  const items = loaded.project.release!.campaign
  expect(items.map((item) => [item.channel, item.afterRelease])).toEqual([
    ['youtube', 0],
    ['x', 60],
    // A post that went out stays as it went.
    ['linkedin', undefined]
  ])
  const page = doc(campaignSection(loaded, EARLY))
  expect(rowOf(page, 'Launch YouTube').textContent).toContain(
    '· 18:00 · with the release'
  )
  expect(page.querySelector('.campaign-own')).toBeNull()
  // The publisher offers the release's own time, not 08:00.
  const fill = doc(youtubeSection(loaded)).querySelector<HTMLElement>(
    '[data-action="use-release-date"]'
  )!
  expect(fill.dataset.at).toBe('2026-10-20T18:00')
  expect(fill.textContent).toBe('Use the release date')
  // A time the template never set stays the creator's own.
  const own = { release: project([launch('youtube', '07:30')]).release }
  plan.followTheRelease(own.release)
  expect(own.release!.campaign[0].afterRelease).toBeUndefined()
})

it('posts on X and LinkedIn after YouTube’s launch, and warns of one set before it (F17, round 1)', () => {
  const items = plan.planCampaign(project([]), { now: EARLY })
  const youtube = items.find(
    (item) => item.channel === 'youtube' && item.kind === 'launch'
  )!
  // YouTube given 21:30: the launch posts follow it, never before.
  delete youtube.afterRelease
  youtube.time = '21:30'
  const value = project(items)
  const at = (channel: string, release = value.release!) =>
    plan.clockOf(
      { at: RELEASE, ...release },
      release.campaign.find(
        (item) => item.kind === 'launch' && item.channel === channel
      )!
    )
  expect([at('youtube'), at('x'), at('linkedin')]).toEqual([
    '21:30',
    '22:30',
    '23:30'
  ])
  const page = doc(campaignSection(snapshot(value), EARLY))
  expect(rowOf(page, 'Launch X').textContent).toContain(
    '· 22:30 · an hour after YouTube’s launch'
  )
  // An X post given its own 19:00, before YouTube's 21:30, says so.
  const x = items.find(
    (item) => item.channel === 'x' && item.kind === 'launch'
  )!
  delete x.afterRelease
  x.time = '19:00'
  const warned = doc(campaignSection(snapshot(value), EARLY))
  expect(
    rowOf(warned, 'Launch X').querySelector('.campaign-note')?.textContent
  ).toBe('Before YouTube’s launch: the video it links to is not out yet.')
  expect(
    rowOf(warned, 'Launch LinkedIn').querySelector('.campaign-note')
  ).toBeNull()
  // An upload scheduled for 22:00: the following posts count from it.
  const scheduled = project(items, {
    youtube: {
      state: 'uploaded',
      videoId: 'v',
      publishAt: new Date(2026, 9, 20, 22, 0).toISOString(),
      at: ''
    }
  })
  expect(at('linkedin', scheduled.release!)).toBe('00:00')
  // YouTube's launch dropped: they count from the release.
  youtube.state = 'dropped'
  expect(at('linkedin')).toBe('20:00')
  expect(
    rowOf(doc(campaignSection(snapshot(value), EARLY)), 'Launch LinkedIn')
      .textContent
  ).toContain('2 hours after the release')
})

const TODAY = new Date(2026, 9, 17, 8, 53)
it('offers Move to an approved teaser past its day, marks overdue apart from due, and counts both on the Release button (F18, round 1)', async () => {
  const { releaseLabel } = await import('../app/campaign-view')
  const { videoHeader } = await import('../app/video-screen')
  const items = plan.planCampaign(project([]), { now: EARLY })
  items.find((item) => item.id === 'teaser-x--14')!.state = 'approved'
  const value = project(items)
  const page = doc(campaignSection(snapshot(value), TODAY))
  const row = (id: string) =>
    page
      .querySelector(`.campaign-edit[data-item="${id}"]`)!
      .closest('.campaign-item')!
  // Approved and past its day: due, and it can still move to Sun, Oct 18.
  expect(row('teaser-x--14').classList.contains('is-due')).toBe(true)
  expect(
    row('teaser-x--14').querySelector<HTMLElement>(
      '[data-action="campaign-move"]'
    )?.dataset.days
  ).toBe('-2')
  // A draft past its day is overdue, marked as a warning of its own.
  expect(
    row('teaser-linkedin--7').querySelector('.campaign-when small')?.className
  ).toBe('campaign-overdue')
  expect(releaseLabel(snapshot(value), TODAY)).toBe(
    'Release · 1 due · 1 overdue'
  )
  expect(releaseLabel(snapshot(project([])), TODAY)).toBe('Release')
  // The header uses it.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
  try {
    const made = snapshot({
      ...value,
      video: {
        settings: { presence: 'off', voice: { kind: 'record' } },
        scenes: [],
        transitions: [],
        inputKey: '',
        produced: { inputKey: '', objectKey: 'v.mp4', clock: [] }
      } as never
    })
    expect(
      doc(videoHeader(made)).querySelector('[data-action="release-dialog"]')
        ?.textContent
    ).toBe('Release · 1 due · 1 overdue')
  } finally {
    vi.useRealTimers()
  }
})

it('ends a teaser’s first words as a sentence before "Out soon." (F18, round 1)', () => {
  const words = plan
    .planCampaign(project([]), { now: EARLY })
    .slice(0, 2)
    .map((item) => item.words)
  expect(words).toEqual([
    'One click, two lattes. Out soon.',
    'One click, two lattes. Out soon.'
  ])
  // A drafted line that ends already keeps its own mark.
  const asked = project([], {
    posts: { x: 'One tap?', linkedin: 'Why two lattes!', youtube: 'Y', at: '' }
  })
  expect(
    plan
      .planCampaign(asked, { now: EARLY })
      .slice(0, 2)
      .map((item) => item.words)
  ).toEqual(['One tap? Out soon.', 'Why two lattes! Out soon.'])
})

it('gives a teaser’s words planned before the fix their full stop, when it opens (F18, round 1)', async () => {
  const teaser = (id: string, words: string, extra = {}): CampaignItem => ({
    id,
    channel: 'x',
    asset: 'teaser-x',
    kind: 'teaser',
    words,
    offsetDays: -3,
    time: '18:00',
    state: 'draft',
    ...extra
  })
  const old = project([
    teaser('a', 'One click, two lattes Out soon.'),
    teaser('b', 'One tap? Out soon.'),
    teaser('c', 'Two lattes Out soon.', { state: 'posted' }),
    teaser('d', 'My own words, Out soon.'),
    { ...teaser('e', 'One click Out soon.'), kind: 'clip' }
  ])
  old.id = 'old-words'
  await writeRow('projects', 'old-words', snapshot(old))
  const words = (await loadProject('old-words'))!.project.release!.campaign.map(
    (item) => item.words
  )
  // Only the template's words, still to go out: what went out, what the
  // creator punctuated, and other kinds stay as they are.
  expect(words).toEqual([
    'One click, two lattes. Out soon.',
    'One tap? Out soon.',
    'Two lattes Out soon.',
    'My own words, Out soon.',
    'One click Out soon.'
  ])
})
