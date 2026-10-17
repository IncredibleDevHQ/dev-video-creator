import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// Review 8, round 2: the campaign after the first fixes. Nothing posts: the
// campaign is planned, changed and shown, all on throwaway notebooks.
const { notebook, confirm } = vi.hoisted(() => ({
  notebook: vi.fn(),
  confirm: vi.fn()
}))
vi.mock('../app/studio-api', () => ({
  studioApi: { request: vi.fn(), notebook }
}))
vi.mock('../app/confirm-action', () => ({ confirmAction: confirm }))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-campaign-3-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { parseHTML } = await import('linkedom')
const plan = await import('../shared/campaign')
const { changeItem, planCampaignFor } = await import('./campaign')
const { setYouTubeVideo } = await import('./numbers')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { campaignSection, releaseLabel } = await import('../app/campaign-view')
afterAll(() => rm(root, { recursive: true, force: true }))

const doc = (html: string) => parseHTML(`<div>${html}</div>`).document
// The reviewer's release: 20 October 2026 at 18:00, their time.
const RELEASE = new Date(2026, 9, 20, 18, 0).toISOString()
const EARLY = new Date(2026, 8, 29, 9, 0)
/** The day after the release: YouTube's launch has gone by. */
const AFTER = new Date(2026, 9, 21, 9, 0)
const project = (
  id: string,
  release: Partial<NonNullable<Project['release']>> = {}
): Project => ({
  id,
  title: 'One click, two lattes',
  source: '',
  slides: [{ id: 'a', title: 'a', svg: '', narration: 'One tap. Two.' }],
  video: null,
  release: {
    teasers: [],
    posts: { x: 'One tap.', linkedin: 'One tap?', youtube: 'Why.', at: '' },
    campaign: [],
    at: RELEASE,
    ...release
  }
})
const snapshot = (value: Project): Snapshot => ({
  project: value,
  status: 'ready',
  error: null,
  events: []
})
const save = (value: Project) => writeRow('projects', value.id, snapshot(value))
const youtubeRow = (page: Document) =>
  [...page.querySelectorAll('.campaign-item')].find((item) =>
    item.querySelector('.campaign-when')!.textContent!.includes('YouTube')
  )!
const youtubeLaunch = (value: Project) =>
  value.release!.campaign.find(
    (item) => item.kind === 'launch' && item.channel === 'youtube'
  )!

it('marks YouTube’s launch as up when its link is pasted, and its row can say so (round 2)', async () => {
  const value = project('hand')
  value.release!.campaign = plan.planCampaign(value, { now: EARLY })
  await save(value)
  // The day after: the launch is overdue, and its row offers "It is up".
  const before = (await loadProject('hand'))!
  expect(
    plan.overdueItems(before.project.release, AFTER).map((item) => item.id)
  ).toContain('launch-youtube-0')
  const row = youtubeRow(doc(campaignSection(before, AFTER)))
  const up = row.querySelector<HTMLElement>('[data-state="posted"]')!
  expect(up.textContent).toBe('It is up')
  expect(up.getAttribute('class')).toBe('primary')
  // The bundle uploaded by hand, its link pasted: the launch is posted.
  const pasted = await setYouTubeVideo('hand', {
    video: 'https://youtu.be/dQw4w9WgXcQ'
  })
  expect(youtubeLaunch(pasted.project)).toMatchObject({
    state: 'posted',
    postUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
  expect(
    plan.overdueItems(pasted.project.release, AFTER).map((item) => item.id)
  ).not.toContain('launch-youtube-0')
  // The Release button counts one overdue step fewer.
  expect(releaseLabel(before, AFTER)).toBe('Release · 6 overdue')
  expect(releaseLabel(pasted, AFTER)).toBe('Release · 5 overdue')
  const shown = youtubeRow(doc(campaignSection(pasted, AFTER)))
  expect(shown.querySelector('a')?.getAttribute('href')).toBe(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  )
  // Planned with the video up already, the launch is planned as posted.
  await save(
    project('linked', {
      youtube: { state: 'uploaded', videoId: 'dQw4w9WgXcQ', at: RELEASE }
    })
  )
  const planned = await planCampaignFor('linked')
  expect(youtubeLaunch(planned.project)).toMatchObject({
    state: 'posted',
    postedAt: RELEASE,
    postUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  })
  // Without a link, the creator's word marks it up.
  const said = project('said')
  said.release!.campaign = plan.planCampaign(said, { now: EARLY })
  await save(said)
  const marked = await changeItem('said', {
    item: 'launch-youtube-0',
    state: 'posted'
  })
  expect(youtubeLaunch(marked.project).state).toBe('posted')
  expect(youtubeLaunch(marked.project).postUrl).toBeUndefined()
  expect(
    plan.overdueItems(marked.project.release, AFTER).map((item) => item.id)
  ).not.toContain('launch-youtube-0')
  const posted = youtubeRow(doc(campaignSection(marked, AFTER)))
  expect(posted.querySelector('.campaign-actions')?.textContent).toBe('Posted')
  expect(posted.querySelector('a')).toBeNull()
  // Only YouTube's launch is marked so: an X post goes out by posting it.
  await expect(
    changeItem('said', { item: 'launch-x-0', state: 'posted' })
  ).resolves.toBeTruthy()
  expect(
    (await loadProject('said'))!.project.release!.campaign.find(
      (item) => item.id === 'launch-x-0'
    )!.state
  ).toBe('draft')
})

/** A launch post's time of day as it goes out, read back from disk. */
const clock = async (id: string, channel: string) => {
  const release = (await loadProject(id))!.project.release!
  const item = release.campaign.find(
    (entry) => entry.kind === 'launch' && entry.channel === channel
  )!
  return plan.clockOf({ ...release, at: release.at! }, item)
}

it('keeps a launch time the creator chose, and moves an old plan’s template times once (round 2)', async () => {
  await save(project('own'))
  await planCampaignFor('own')
  // The reviewer's example: the release at 18:00, YouTube set to 08:00.
  await changeItem('own', { item: 'launch-youtube-0', time: '08:00' })
  expect(await clock('own', 'youtube')).toBe('08:00')
  // All three given the old template's times of their own stay too (X and
  // LinkedIn follow YouTube's 08:00 to 09:00 and 10:00, so they are moved
  // away first, then back).
  for (const [item, away, time] of [
    ['launch-x-0', '09:30', '09:00'],
    ['launch-linkedin-0', '10:30', '10:00']
  ]) {
    await changeItem('own', { item, time: away })
    await changeItem('own', { item, time })
  }
  expect(
    (await loadProject('own'))!.project.release!.campaign.filter(
      (item) => item.kind === 'launch' && item.afterRelease !== undefined
    )
  ).toEqual([])
  expect([
    await clock('own', 'youtube'),
    await clock('own', 'x'),
    await clock('own', 'linkedin')
  ]).toEqual(['08:00', '09:00', '10:00'])
  // Saved before the campaign was marked (round 1): a plan whose X and
  // LinkedIn posts follow the release is no old plan.
  const unmarked = project('unmarked')
  unmarked.release!.campaign = plan.planCampaign(unmarked, { now: EARLY })
  const youtube = youtubeLaunch(unmarked)
  delete youtube.afterRelease
  youtube.time = '08:00'
  await save(unmarked)
  expect(await clock('unmarked', 'youtube')).toBe('08:00')
  // An old plan at the template's times follows the release, once.
  const legacy = project('legacy')
  const old = { youtube: '08:00', x: '09:00', linkedin: '10:00' }
  legacy.release!.campaign = plan
    .planCampaign(legacy, { now: EARLY })
    .map((item) => {
      if (item.kind !== 'launch') return item
      const { afterRelease: _, ...rest } = item
      return { ...rest, time: old[item.channel] }
    })
  await save(legacy)
  expect(await clock('legacy', 'youtube')).toBe('18:00')
  await changeItem('legacy', { item: 'launch-youtube-0', time: '08:00' })
  expect(await clock('legacy', 'youtube')).toBe('08:00')
})
