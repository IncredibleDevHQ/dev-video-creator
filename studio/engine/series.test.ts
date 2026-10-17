import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// The agent is a stand-in: these checks prove the plumbing, not a model.
const { stage, created } = vi.hoisted(() => ({
  stage: vi.fn(),
  created: [] as string[]
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./notebook-intake', () => ({
  detectedHarness: async () => ({ adapter: 'kimi' })
}))
vi.mock('./projects', async (original) => {
  const actual = await original<typeof import('./projects')>()
  const { writeRow } = await import('./persistence')
  return {
    ...actual,
    // A notebook as it is when its source is read: no agent runs.
    createProject: async (source: string) => {
      const id = `episode-${created.length + 1}`
      created.push(source)
      const snapshot: Snapshot = {
        project: {
          id,
          title: 'Untitled notebook',
          source,
          slides: [],
          video: null
        },
        status: 'reading',
        sourceOnly: true,
        error: null,
        events: []
      }
      await writeRow('projects', id, snapshot)
      return snapshot
    }
  }
})
const root = await mkdtemp(join(tmpdir(), 'minimal-series-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const repo = join(root, 'limiter')
const { changeProject } = await import('./projects')
const series = await import('./series')
const { episodeBrief } = await import('./creative/story')
afterAll(() => rm(root, { recursive: true, force: true }))

const run = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
beforeAll(async () => {
  execFileSync('git', ['init', '-q', '-b', 'main', repo])
  run('config', 'user.email', 'test@example.com')
  run('config', 'user.name', 'Test')
  await writeFile(join(repo, 'bucket.ts'), 'export const size = 10\n')
  run('add', '.')
  run('commit', '-qm', 'A bucket')
  run('checkout', '-qb', 'limits')
  await writeFile(join(repo, 'bucket.ts'), 'export const size = 20\n')
  run('commit', '-qam', 'A bigger bucket')
})

const arc = {
  episodes: [3, 4],
  parts: [
    {
      title: 'Why limits',
      carries: 'The outage that started it',
      narrative: 'incident'
    },
    { title: 'The bucket', carries: 'How a token bucket works' },
    { title: 'Bursts', carries: 'Letting a burst through' },
    { title: 'Per tenant', carries: 'Fairness between tenants' }
  ]
}

it('checks the agent’s arc: a range, and a part for each episode', () => {
  expect(series.validateArc(arc)).toMatchObject({ ok: true })
  expect(
    series.validateArc({ episodes: [5, 3], parts: [{ title: 'x' }] }).problems
  ).toEqual([
    'Set episodes to a range such as [3, 5]',
    'Give every part a title and what it carries',
    'Write one part for each episode up to the most'
  ])
  expect(
    series.validateArc({
      ...arc,
      parts: arc.parts.map((part) => ({ ...part, narrative: 'made-up' }))
    }).problems
  ).toContain('made-up is not a template in the catalog')
})

it('plans an arc, then adds episodes from what changed on the branch', async () => {
  stage.mockImplementation(async (input) => {
    expect(input.packet['packet/BRANCH.md']).toContain('A bigger bucket')
    return input.validate(arc).value
  })
  const started = await series.createSeries({
    title: 'Rate limits',
    about: 'How we limit requests',
    growth: 'arc',
    repos: [{ path: repo }]
  })
  await vi.waitFor(async () =>
    expect((await series.loadSeries(started.id))!.arc?.parts).toHaveLength(4)
  )
  expect((await series.listSeries())[0]).toMatchObject({
    title: 'Rate limits',
    episodes: 0,
    planned: 4
  })
  // The first episode: the arc's first part, its template, the repo.
  const first = await series.addEpisode(started.id, {})
  expect(first.notebook.project).toMatchObject({
    narrative: 'incident',
    repos: [expect.objectContaining({ branch: 'limits' })],
    episode: { series: started.id, number: 1, part: arc.parts[0] }
  })
  expect(created[0]).toContain('# Rate limits: Why limits')
  expect(created[0]).toContain('A bigger bucket')
  await changeProject(first.notebook.project.id, (current) => {
    current.project.title = 'The outage'
    current.project.slides = [{ id: 'a', title: 'Five minutes down', svg: '' }]
    current.project.branding = {
      name: 'Acme',
      tagline: '',
      accent: '#e11d48',
      useAccent: true,
      logoKey: null,
      look: { id: 'midnight', name: 'Midnight' }
    } as never
  })
  // New work on the branch, then the next episode picks up from it.
  await writeFile(
    join(repo, 'bucket.ts'),
    'export const size = 20\nexport const burst = 40\n'
  )
  run('commit', '-qam', 'Allow a burst')
  await series.updateSeries(started.id, { threads: ['The 14:02 outage', ''] })
  const second = await series.addEpisode(started.id, {})
  expect(created[1]).toContain('# Rate limits: The bucket')
  expect(created[1]).toContain('Allow a burst')
  expect(created[1]).not.toContain('A bigger bucket')
  expect(second.notebook.project.episode).toEqual({
    series: started.id,
    number: 2,
    previously: 'Last time, “The outage”: Five minutes down.',
    threads: ['The 14:02 outage'],
    part: arc.parts[1]
  })
  // One look through the series.
  expect(second.notebook.project.branding?.look?.id).toBe('midnight')
  expect(second.series.episodes.map((item) => item.part)).toEqual([0, 1])
  // The creator's own source wins over the branch.
  await series.addEpisode(started.id, { source: 'https://example.com/bursts' })
  expect(created[2]).toBe('https://example.com/bursts')
  const page = await series.seriesPage(started.id)
  expect(page.episodes.map((item) => item.title)).toEqual([
    'The outage',
    'Untitled notebook',
    'Untitled notebook'
  ])
  expect(episodeBrief(second.notebook.project.episode!)).toBe(
    [
      '# Episode 2',
      'This episode is "The bucket": How a token bucket works',
      'Previously: Last time, “The outage”: Five minutes down.',
      'Threads carried through the series:\n- The 14:02 outage'
    ].join('\n\n')
  )
})

it('adds one episode at a time, never two as the same number', async () => {
  const started = await series.createSeries({
    title: 'Once',
    about: 'One at a time'
  })
  const [first, second] = await Promise.allSettled([
    series.addEpisode(started.id, { source: 'First' }),
    series.addEpisode(started.id, { source: 'Second' })
  ])
  expect(first.status).toBe('fulfilled')
  expect(second).toMatchObject({
    status: 'rejected',
    reason: expect.objectContaining({ message: 'An episode is being added' })
  })
  expect((await series.loadSeries(started.id))!.episodes).toHaveLength(1)
})

it('plans the arc afresh when asked again', async () => {
  stage.mockReset()
  stage.mockImplementation(async (input) => input.validate(arc).value)
  const started = await series.createSeries({
    title: 'Again',
    about: 'Twice',
    growth: 'arc'
  })
  await vi.waitFor(async () =>
    expect((await series.loadSeries(started.id))!.arc).toBeDefined()
  )
  await new Promise((done) => setTimeout(done, 5))
  await series.planArc(started.id)
  await vi.waitFor(() => expect(stage).toHaveBeenCalledTimes(2))
  expect(stage.mock.calls[0][0].inputKey).not.toBe(
    stage.mock.calls[1][0].inputKey
  )
})

it('says when the arc could not be planned', async () => {
  stage.mockRejectedValue(new Error('The agent stopped'))
  const started = await series.createSeries({
    title: 'Alone',
    about: 'One at a time'
  })
  expect(started.growth).toBe('one')
  await series.planArc(started.id)
  await vi.waitFor(async () =>
    expect((await series.loadSeries(started.id))!.planning).toMatchObject({
      state: 'failed',
      error: 'The agent stopped'
    })
  )
  await expect(series.createSeries({ title: '', about: 'x' })).rejects.toThrow(
    'Give the series a title'
  )
})
