import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { Series } from '../shared/series'
// Review 8, round 3: the campaign's Plan again asks what the engine will
// leave out. Nothing posts: all on throwaway notebooks.
const { notebook, confirm, request } = vi.hoisted(() => ({
  notebook: vi.fn(),
  confirm: vi.fn(),
  request: vi.fn()
}))
vi.mock('../app/studio-api', () => ({ studioApi: { request, notebook } }))
vi.mock('../app/confirm-action', () => ({ confirmAction: confirm }))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-campaign-4-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { campaignLoss, changeItem, planCampaignFor } = await import('./campaign')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { clickRelease } = await import('../app/release-controller')
afterAll(() => rm(root, { recursive: true, force: true }))

const RELEASE = new Date(2026, 9, 20, 18, 0).toISOString()
const EARLY = new Date(2026, 8, 29, 9, 0)
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
