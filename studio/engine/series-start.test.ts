import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// Starting a series from home (review 8, F03). The planner is a stand-in
// that stops once asked: these checks prove which series starts and that
// its plan is asked for, with the creator's words, not what a model plans.
const { stage } = vi.hoisted(() => ({ stage: vi.fn() }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./notebook-intake', () => ({
  detectedHarness: async () => ({ adapter: 'kimi' })
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-series-start-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { loadSeries } = await import('./series')
const { settledSeriesPlan } = await import('./series-plan')
const { startSeries } = await import('./series-start')
afterAll(() => rm(root, { recursive: true, force: true }))
beforeEach(() => {
  stage.mockReset()
  stage.mockRejectedValue(new Error('The stand-in planner stops here'))
})

const notes = async (id: string, status: Snapshot['status'] = 'ready') => {
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Learning log: APIs that survive retries',
      source: 'A retry must not pour a second latte.',
      slides: [
        { id: `${id}-1`, title: 'One click, one latte', svg: '<svg/>' },
        { id: `${id}-2`, title: 'Idempotency keys', svg: '<svg/>' }
      ],
      video: null
    },
    status,
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
}
const asked = () =>
  stage.mock.calls
    .map(([input]) => input as Record<string, unknown>)
    .filter((input) => input.route === 'Plan Series')
const about = 'What I learn about retries, for backend developers'

it('starts a series from a notebook, and the studio plans it from the notes', async () => {
  await notes('learning')
  const started = await startSeries({
    from: 'learning',
    title: '',
    about,
    growth: 'arc'
  })
  // The notebook's pages are the episodes'; it names the series.
  expect(started).toMatchObject({
    map: 'learning',
    title: 'Learning log: APIs that survive retries',
    about
  })
  expect((await loadProject('learning'))?.project.mapSeries).toBe(started.id)
  await settledSeriesPlan(started.id)
  // The plan is the map's own, asked with what the series is about.
  expect(asked()).toHaveLength(1)
  const packet = asked()[0].packet as Record<string, string>
  expect(JSON.parse(packet['packet/SERIES.json']).about).toBe(about)
  // Started again from the same notebook: its series as it is, not planned
  // a second time.
  const again = await startSeries({ from: 'learning', about, growth: 'arc' })
  expect(again.id).toBe(started.id)
  await settledSeriesPlan(started.id)
  expect(asked()).toHaveLength(1)
})

it('one episode at a time asks for no plan; no notebook starts from what it is about', async () => {
  await notes('by-hand')
  const byHand = await startSeries({
    from: 'by-hand',
    title: 'Retries, by hand',
    about,
    growth: 'one'
  })
  expect(byHand).toMatchObject({ map: 'by-hand', title: 'Retries, by hand' })
  expect((await loadSeries(byHand.id))?.planning).toBeUndefined()
  expect(asked()).toHaveLength(0)
  // Without a notebook it is the series as before: a title is asked.
  await expect(startSeries({ from: '', about, growth: 'one' })).rejects.toThrow(
    'Give the series a title'
  )
  const fresh = await startSeries({
    from: '',
    title: 'Retries',
    about,
    growth: 'one',
    repos: []
  })
  expect(fresh).toMatchObject({ title: 'Retries', about, growth: 'one' })
  expect(fresh.map).toBeUndefined()
})

it('home’s Start the series reaches the notebook through the route', async () => {
  await notes('routed')
  const { studioRoute } = await import('./studio-routes')
  const reply = await studioRoute(
    new URL('http://studio.test/api/series'),
    { method: 'POST' } as never,
    { from: 'routed', title: '', about, growth: 'one' },
    {} as never
  )
  expect(reply).toMatchObject({ status: 200, value: { map: 'routed' } })
})

it('refuses a notebook still drawn, or one that is not the creator’s', async () => {
  await notes('drawing', 'building')
  await expect(
    startSeries({ from: 'drawing', about, growth: 'arc' })
  ).rejects.toThrow('Start a series once the wireframes are drawn')
  await expect(
    startSeries({ from: '../projects', about, growth: 'arc' })
  ).rejects.toThrow('Choose one of your notebooks')
  await expect(
    startSeries({ from: 'nowhere', about, growth: 'arc' })
  ).rejects.toThrow('Notebook not found')
  expect(asked()).toHaveLength(0)
})
