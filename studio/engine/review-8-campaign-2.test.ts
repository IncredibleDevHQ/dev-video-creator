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
