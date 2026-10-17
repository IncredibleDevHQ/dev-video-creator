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
