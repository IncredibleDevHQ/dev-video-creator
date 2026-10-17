import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { Series } from '../shared/series'
// Review 8, round 3: the campaign's Plan again asks what the engine will
// leave out, and YouTube's launch row follows a corrected link and can be
// taken back. Nothing posts: all on throwaway notebooks.
const { notebook, confirm, request } = vi.hoisted(() => ({
  notebook: vi.fn(),
  confirm: vi.fn(),
  request: vi.fn()
}))
vi.mock('../app/studio-api', () => ({ studioApi: { request, notebook } }))
vi.mock('../app/confirm-action', () => ({ confirmAction: confirm }))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-campaign-4-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { parseHTML } = await import('linkedom')
const plan = await import('../shared/campaign')
const { campaignLoss, changeItem, planCampaignFor } = await import('./campaign')
const { setYouTubeVideo } = await import('./numbers')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { campaignSection } = await import('../app/campaign-view')
const { clickRelease } = await import('../app/release-controller')
afterAll(() => rm(root, { recursive: true, force: true }))

const doc = (html: string) => parseHTML(`<div>${html}</div>`).document
const RELEASE = new Date(2026, 9, 20, 18, 0).toISOString()
const EARLY = new Date(2026, 8, 29, 9, 0)
const AFTER = new Date(2026, 9, 21, 9, 0)
const project = (id: string, more: Partial<Project> = {}): Project => ({
  id,
  title: 'One click, two lattes',
  source: '',
  slides: [{ id: 'a', title: 'a', svg: '', narration: 'One tap. Two.' }],
  video: null,
  release: {
    teasers: [],
    posts: { x: 'One tap.', linkedin: 'One tap?', youtube: 'Why.', at: '' },
    campaign: [],
    at: RELEASE
  },
  ...more
})
const snapshot = (value: Project): Snapshot => ({
  project: value,
  status: 'ready',
  error: null,
  events: []
})
const save = (value: Project) => writeRow('projects', value.id, snapshot(value))
/** A series whose arc has this many parts. */
const series = (parts: number): Series =>
  ({
    id: 'run',
    title: 'Lattes',
    about: '',
    createdAt: '',
    growth: 'arc',
    episodes: [],
    arc: {
      episodes: [3, 4],
      at: '',
      parts: Array.from({ length: parts }, (_, at) => ({
        title: `Part ${at + 1}`,
        carries: ''
      }))
    }
  }) as unknown as Series
const launch = async (id: string) =>
  (await loadProject(id))!.project.release!.campaign.find(
    (item) => item.kind === 'launch' && item.channel === 'youtube'
  )!
const youtubeRow = (value: Snapshot) =>
  [
    ...doc(campaignSection(value, AFTER)).querySelectorAll('.campaign-item')
  ].find((item) =>
    item.querySelector('.campaign-when')!.textContent!.includes('YouTube')
  )!

it('asks before Plan again leaves out an approved recap once the series has grown, and then plans (round 3)', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(EARLY)
  try {
    // The last of a three-part run: its plan closes the run with a recap.
    await writeRow('series', 'run', series(3))
    await save(project('last', { episode: { series: 'run', number: 3 } }))
    await planCampaignFor('last')
    const recap = (await loadProject('last'))!.project.release!.campaign.find(
      (item) => item.kind === 'recap'
    )!
    await changeItem('last', { item: recap.id, state: 'approved' })
    // The series grows a fourth part: the run no longer ends here.
    await writeRow('series', 'run', series(4))
    expect(
      (await campaignLoss('last')).lost.map(({ item }) => item.id)
    ).toEqual([recap.id])
    // The page asks the engine, says what goes, and sends the yes.
    request.mockImplementation((path: string, _method, body) =>
      body?.action === 'lost' ? campaignLoss(path.split('/')[2]) : undefined
    )
    notebook.mockImplementation((id: string, _action, body) =>
      planCampaignFor(id, body)
    )
    confirm.mockResolvedValueOnce(true)
    const app = {
      snapshot: (await loadProject('last'))!,
      dialog: { open: false, dataset: {}, querySelector: () => null },
      showDialog: vi.fn()
    }
    await clickRelease(app as never, {} as never, 'plan-campaign')
    expect(request.mock.calls.at(-1)).toEqual([
      '/projects/last/campaign',
      'POST',
      { action: 'lost' }
    ])
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0].detail).toMatch(
      /^It leaves out the LinkedIn recap of .+ \(approved\)\./
    )
    expect(notebook.mock.calls.at(-1)).toEqual([
      'last',
      'campaign',
      { action: 'plan', confirmed: true }
    ])
    // Planned, not refused: the recap is gone, and the page shows it.
    const after = (await loadProject('last'))!.project.release!.campaign
    expect(after.some((item) => item.kind === 'recap')).toBe(false)
    expect(
      app.snapshot.project.release!.campaign.some(
        (item) => item.kind === 'recap'
      )
    ).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

it('puts a corrected YouTube link on the launch row, and takes back an “It is up” said too soon (round 3)', async () => {
  const value = project('link')
  value.release!.campaign = plan.planCampaign(value, { now: EARLY })
  await save(value)
  // A wrong link pasted, then the right one: the row links to the right one.
  await setYouTubeVideo('link', { video: 'https://youtu.be/dQw4w9WgXcQ' })
  const first = await launch('link')
  const fixed = await setYouTubeVideo('link', {
    video: 'https://youtu.be/aBcDeFgHiJk'
  })
  expect(await launch('link')).toMatchObject({
    state: 'posted',
    postedAt: first.postedAt,
    postUrl: 'https://www.youtube.com/watch?v=aBcDeFgHiJk'
  })
  expect(youtubeRow(fixed).querySelector('a')?.getAttribute('href')).toBe(
    'https://www.youtube.com/watch?v=aBcDeFgHiJk'
  )
  // Up by its link, it is not the creator's to take back.
  expect(youtubeRow(fixed).textContent).not.toContain('Not up yet')
  await expect(
    changeItem('link', { item: 'launch-youtube-0', state: 'draft' })
  ).rejects.toThrow('It has gone out already')
  // Said up by hand, approved before: "Not up yet" takes it back as it was.
  const said = project('said')
  said.release!.campaign = plan.planCampaign(said, { now: EARLY })
  await save(said)
  await changeItem('said', { item: 'launch-youtube-0', state: 'approved' })
  const up = await changeItem('said', {
    item: 'launch-youtube-0',
    state: 'posted'
  })
  expect((await launch('said')).state).toBe('posted')
  const undo = youtubeRow(up).querySelector<HTMLElement>(
    '[data-action="campaign-state"]'
  )!
  expect(undo.textContent).toBe('Not up yet')
  expect(undo.dataset.state).toBe('draft')
  const back = await changeItem('said', {
    item: 'launch-youtube-0',
    state: undo.dataset.state
  })
  const item = await launch('said')
  expect(item.state).toBe('approved')
  expect(item.postedAt).toBeUndefined()
  expect(item.saidUp).toBeUndefined()
  // Overdue again the day after, its "It is up" offered once more.
  expect(
    plan.overdueItems(back.project.release, AFTER).map((entry) => entry.id)
  ).toContain('launch-youtube-0')
  expect(
    youtubeRow(back).querySelector('[data-state="posted"]')?.textContent
  ).toBe('It is up')
  // Said up, then its link pasted: the link holds, and the row links to it.
  await changeItem('said', { item: 'launch-youtube-0', state: 'posted' })
  const linked = await setYouTubeVideo('said', {
    video: 'https://youtu.be/dQw4w9WgXcQ'
  })
  expect(youtubeRow(linked).querySelector('a')?.getAttribute('href')).toBe(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  )
  expect(youtubeRow(linked).textContent).not.toContain('Not up yet')
})
