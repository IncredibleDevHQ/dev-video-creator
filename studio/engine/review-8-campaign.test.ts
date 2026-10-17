import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// Review 8, the release's campaign. Nothing posts: the campaign is planned,
// changed and shown, all on a throwaway notebook.
const { notebook } = vi.hoisted(() => ({ notebook: vi.fn() }))
vi.mock('../app/studio-api', () => ({
  studioApi: { request: vi.fn(), notebook }
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-campaign-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { parseHTML } = await import('linkedom')
const plan = await import('../shared/campaign')
const { changeItem, planCampaignFor } = await import('./campaign')
const { writeRow } = await import('./persistence')
const { campaignSection } = await import('../app/campaign-view')
const { youtubeSection, localTime } = await import('../app/release-view')
const { submitRelease, syncPublishForm } =
  await import('../app/release-controller')
afterAll(() => rm(root, { recursive: true, force: true }))

const doc = (html: string) => parseHTML(`<div>${html}</div>`).document
// The release the reviewer saved: 20 October 2026 at 18:00, their time.
const RELEASE = new Date(2026, 9, 20, 18, 0).toISOString()
const project = (
  release: Partial<NonNullable<Project['release']>> = {}
): Project => ({
  id: 'r8',
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
const launchOf = (value: Project, channel: string) =>
  value.release!.campaign.find(
    (item) => item.kind === 'launch' && item.channel === channel
  )!

it('launches YouTube at the saved release time, the posts after it, and moves them with the release (F17)', () => {
  const items = plan.planCampaign(project())
  const at = (channel: string) =>
    plan.dueAt(
      RELEASE,
      items.find((item) => item.id === `launch-${channel}-0`)!
    )
  expect(at('youtube')).toEqual(new Date(2026, 9, 20, 18, 0))
  expect(at('x')).toEqual(new Date(2026, 9, 20, 19, 0))
  expect(at('linkedin')).toEqual(new Date(2026, 9, 20, 20, 0))
  // In the order they go out: the launch posts never before YouTube's.
  expect(items.map((item) => item.id).slice(3, 6)).toEqual([
    'launch-youtube-0',
    'launch-x-0',
    'launch-linkedin-0'
  ])
  // A release moved to the next morning takes its launch along, unplanned.
  const moved = new Date(2026, 9, 21, 7, 30).toISOString()
  expect(plan.dueAt(moved, items[3])).toEqual(new Date(2026, 9, 21, 7, 30))
  expect(plan.clockOf(moved, items[4])).toBe('08:30')
  // The publisher fills the same time the campaign shows.
  const page = doc(
    campaignSection(
      snapshot({
        ...project(),
        release: { ...project().release!, campaign: items }
      })
    )
  )
  const youtube = [...page.querySelectorAll('.campaign-when')].find((line) =>
    line.textContent!.includes('YouTube')
  )!
  expect(youtube.textContent).toContain('· 18:00 · with the release')
  expect(youtube.querySelector('.campaign-own')).toBeNull()
  const publisher = doc(
    youtubeSection(
      snapshot({
        ...project(),
        release: { ...project().release!, campaign: items }
      })
    )
  )
  const fill = publisher.querySelector<HTMLElement>(
    '[data-action="use-release-date"]'
  )!
  expect(fill.dataset.at).toBe('2026-10-20T18:00')
  expect(fill.textContent).toBe('Use the release date')
  expect(
    publisher
      .querySelector('#youtube-publish-form')
      ?.getAttribute('data-launch')
  ).toBe('2026-10-20T18:00')
})

it('keeps a launch with the release until its time is changed, labels that, and puts it back (F17)', async () => {
  await save(project())
  await planCampaignFor('r8')
  // Kept with its words only, or its shown time and day: it still follows.
  let after = await changeItem('r8', {
    item: 'launch-youtube-0',
    words: 'Why!'
  })
  expect(launchOf(after.project, 'youtube').afterRelease).toBe(0)
  after = await changeItem('r8', {
    item: 'launch-youtube-0',
    time: '18:00',
    offsetDays: 0
  })
  expect(launchOf(after.project, 'youtube').afterRelease).toBe(0)
  // Its own time: it no longer moves with the release, and says so.
  after = await changeItem('r8', {
    item: 'launch-youtube-0',
    time: '08:00',
    offsetDays: 0
  })
  const own = launchOf(after.project, 'youtube')
  expect(own).toMatchObject({ time: '08:00', offsetDays: 0 })
  expect(own.afterRelease).toBeUndefined()
  const row = [
    ...doc(campaignSection(after)).querySelectorAll('.campaign-item')
  ].find((item) => item.textContent!.includes('YouTube'))!
  expect(row.querySelector('.campaign-own')?.textContent).toBe('its own time')
  expect(
    row.querySelector('[data-action="campaign-follow"]')?.textContent
  ).toBe('Move with the release')
  // The publisher fills the campaign's time, and says it is the campaign's.
  const fill = doc(youtubeSection(after)).querySelector<HTMLElement>(
    '[data-action="use-release-date"]'
  )!
  expect(fill.dataset.at).toBe('2026-10-20T08:00')
  expect(fill.textContent).toBe('Use the campaign’s time')
  // Back with the release.
  after = await changeItem('r8', { item: 'launch-youtube-0', follow: true })
  expect(launchOf(after.project, 'youtube')).toMatchObject({
    afterRelease: 0,
    offsetDays: 0,
    time: '18:00'
  })
  // A plan from before this review, YouTube at 08:00, shows as its own time.
  const legacy = { ...launchOf(after.project, 'youtube'), time: '08:00' }
  delete legacy.afterRelease
  expect(plan.ownLaunchTime(RELEASE, legacy)).toBe(true)
})

it('says when the time chosen to publish is not the campaign’s launch (F17)', () => {
  const { document } = parseHTML(
    `<form data-launch="2026-10-20T18:00"><select name="privacy"><option value="private">Private</option></select><input name="publishAt" value=""><p class="publish-differs" hidden>The campaign launches it Tue, Oct 20 · 18:00.</p></form>`
  )
  const form = document.querySelector('form')!
  const at = form.querySelector('input')!
  const note = form.querySelector<HTMLElement>('.publish-differs')!
  at.value = '2026-10-20T08:00'
  syncPublishForm(form)
  expect(note.hidden).toBe(false)
  at.value = '2026-10-20T18:00'
  syncPublishForm(form)
  expect(note.hidden).toBe(true)
  at.value = ''
  syncPublishForm(form)
  expect(note.hidden).toBe(true)
  // Rendered: hidden until a time is chosen, and naming the launch.
  const publisher = doc(youtubeSection(snapshot(project())))
  const rendered = publisher.querySelector<HTMLElement>('.publish-differs')!
  expect(rendered.hidden).toBe(true)
  expect(rendered.textContent).toContain('18:00')
  expect(localTime(RELEASE)).toBe('2026-10-20T18:00')
})

it('says when YouTube publishes the upload away from the campaign’s launch (F17)', () => {
  const items = plan.planCampaign(project())
  const youtube = items.find((item) => item.id === 'launch-youtube-0')!
  youtube.state = 'posted'
  youtube.postUrl = 'https://www.youtube.com/watch?v=vid123'
  const scheduled = (publishAt: string) =>
    doc(
      campaignSection(
        snapshot(
          project({
            campaign: items,
            youtube: { state: 'uploaded', videoId: 'vid123', publishAt, at: '' }
          })
        )
      )
    )
  const away = scheduled(new Date(2026, 9, 20, 8, 0).toISOString())
  expect(away.querySelector('.is-posted .campaign-note')?.textContent).toMatch(
    /^YouTube publishes it .*08:00, not at this time\.$/
  )
  expect(
    scheduled(RELEASE).querySelector('.is-posted .campaign-note')
  ).toBeNull()
})

it('sends a launch’s day and time only when they were changed (F17)', async () => {
  const items = plan.planCampaign(project())
  const value = project({ campaign: items })
  const app = {
    snapshot: snapshot(value),
    dialog: { open: false, dataset: {}, querySelector: () => null },
    showDialog: vi.fn()
  }
  notebook.mockResolvedValue(snapshot(value))
  const row = doc(
    campaignSection(snapshot(value))
  ).querySelector<HTMLFormElement>(
    'form.campaign-edit[data-item="launch-youtube-0"]'
  )!
  const values = (time: string, days: string) => {
    const data = new FormData()
    data.set('words', 'Why.')
    data.set('time', time)
    data.set('offsetDays', days)
    return data
  }
  await submitRelease(app as never, row, values('18:00', '0'))
  expect(notebook.mock.calls.at(-1)![2]).toEqual({
    action: 'change',
    item: 'launch-youtube-0',
    words: 'Why.'
  })
  await submitRelease(app as never, row, values('17:30', '0'))
  expect(notebook.mock.calls.at(-1)![2]).toMatchObject({
    time: '17:30',
    offsetDays: 0
  })
})
