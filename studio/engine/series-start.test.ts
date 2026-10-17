import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import { ledBy, type Series } from '../shared/series'
// Starting a series from home (review 8, F03). The planner and the drawing
// are stand-ins: the planner stops once asked, the drawing finishes when the
// check says. These checks prove which series starts, when, and that its
// plan is asked for with the creator's words, not what a model plans.
const { stage, pages } = vi.hoisted(() => ({ stage: vi.fn(), pages: vi.fn() }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./creative/pages', () => ({ prepareCreativePages: pages }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
vi.mock('./notebook-intake', async (original) => ({
  ...(await original<typeof import('./notebook-intake')>()),
  detectedHarness: async () => ({ adapter: 'kimi' })
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-series-start-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { listNotebooks, loadProject, scheduleSlides } =
  await import('./projects')
const { loadSeries } = await import('./series')
const { settledSeriesPlan } = await import('./series-plan')
const series = await import('./series-start')
const { settleInterruptedWork } = await import('./studio-recovery')
/** The series started, when it starts now. */
const startSeries = async (body: Record<string, unknown>) =>
  (await series.startSeries(body)) as Series
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

it('keeps who presents the series, as the creator said (review 8, F05)', async () => {
  await notes('presented')
  const presented = await startSeries({
    from: 'presented',
    about,
    growth: 'one',
    led: 'presenter'
  })
  expect((await loadSeries(presented.id))?.led).toBe('presenter')
  const fresh = await startSeries({
    title: 'Retries',
    about,
    growth: 'one',
    led: 'notes'
  })
  expect((await loadSeries(fresh.id))?.led).toBe('notes')
  expect(
    (await startSeries({ title: 'Odd', about, growth: 'one', led: 'camera' }))
      .led
  ).toBeUndefined()
  // Started on its map before it was asked: told from its notes. A series
  // from nothing started before it keeps Make as it always started.
  await notes('on-the-map')
  const { startMapSeries } = await import('./map-episodes')
  const mapped = await startMapSeries('on-the-map', {})
  expect([mapped.led, ledBy(mapped)]).toEqual([undefined, 'notes'])
  const before = await startSeries({ title: 'Old', about, growth: 'one' })
  expect(ledBy(before)).toBeUndefined()
  // Changed later, on the series' page: kept; anything else is no choice.
  const { updateSeries } = await import('./series')
  expect((await updateSeries(mapped.id, { led: 'presenter' })).led).toBe(
    'presenter'
  )
  expect((await updateSeries(mapped.id, { led: 'camera' })).led).toBe(
    'presenter'
  )
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

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Page</text></svg>'
/** A notebook whose wireframes are being drawn: one page, by a stand-in. */
const drawing = async (id: string, more = {}) => {
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Payments',
      source: 'Payments retry safely.',
      slides: [],
      video: null,
      harness: { adapter: 'claude-code' },
      ...more
    },
    status: 'building',
    error: null,
    events: []
  } as Snapshot)
  await writeRow('outlines', id, {
    source: { title: 'Payments', text: 'Payments retry safely.' },
    outline: {
      title: 'Payments',
      scenes: [{ title: 'One', narration: 'One.', idea: 'One', source: [] }]
    },
    brand: {},
    slideIds: [`${id}-one`]
  })
  await writeRow('sources', id, {
    title: 'Payments',
    text: 'Payments retry safely.'
  })
}

it('keeps the series asked of a notebook being drawn, and starts it once drawn', async () => {
  await drawing('drawing')
  let finish!: (value: string[]) => void
  pages.mockImplementationOnce(
    () => new Promise<string[]>((resolve) => (finish = resolve))
  )
  scheduleSlides('drawing')
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(
    await series.startSeries({
      from: 'drawing',
      title: '',
      about,
      growth: 'arc',
      led: 'presenter'
    })
  ).toEqual({ waiting: 'drawing' })
  const kept = (await loadProject('drawing'))!
  expect(kept.project.waitingSeries).toMatchObject({
    about,
    growth: 'arc',
    led: 'presenter'
  })
  expect(kept.project.mapSeries).toBeUndefined()
  expect(kept.events.at(-1)?.message).toBe(
    'The series starts once the wireframes are drawn'
  )
  // Home lists it as a series that waits, by its title.
  expect(
    (await listNotebooks()).find((item) => item.id === 'drawing')?.waitingSeries
  ).toBe('Payments')
  expect(asked()).toHaveLength(0)
  finish([svg])
  await vi.waitFor(async () =>
    expect((await loadProject('drawing'))?.project.mapSeries).toBeTruthy()
  )
  const drawn = (await loadProject('drawing'))!
  expect(drawn.project.waitingSeries).toBeUndefined()
  const started = (await loadSeries(drawn.project.mapSeries!))!
  expect(started).toMatchObject({ map: 'drawing', about, led: 'presenter' })
  // Its plan is asked for, as the creator asked, once.
  await settledSeriesPlan(started.id)
  expect(asked()).toHaveLength(1)
  await series.startWaitingSeries('drawing')
  expect(asked()).toHaveLength(1)
})

it('a series that waited for wireframes drawn before a restart starts then', async () => {
  await drawing('restarted', {
    waitingSeries: {
      title: 'Retries, from my log',
      about,
      growth: 'one',
      at: '2026-10-17T00:00:00.000Z'
    }
  })
  // Still drawn at the restart: it waits on.
  await series.startWaitingSeries('restarted')
  expect((await loadProject('restarted'))?.project.mapSeries).toBeUndefined()
  await writeRow('projects', 'restarted', {
    ...(await loadProject('restarted'))!,
    status: 'ready',
    project: {
      ...(await loadProject('restarted'))!.project,
      slides: [{ id: 'restarted-one', title: 'One', svg }]
    }
  })
  await settleInterruptedWork()
  const after = (await loadProject('restarted'))!
  expect(after.project.waitingSeries).toBeUndefined()
  expect(await loadSeries(after.project.mapSeries!)).toMatchObject({
    title: 'Retries, from my log',
    growth: 'one'
  })
  expect(asked()).toHaveLength(0)
})

it('refuses notes with no wireframes coming, or a notebook not the creator’s', async () => {
  await notes('draft', 'draft')
  await expect(
    startSeries({ from: 'draft', about, growth: 'arc' })
  ).rejects.toThrow('Start a series once the wireframes are drawn')
  expect((await loadProject('draft'))?.project.waitingSeries).toBeUndefined()
  await expect(
    startSeries({ from: '../projects', about, growth: 'arc' })
  ).rejects.toThrow('Choose one of your notebooks')
  await expect(
    startSeries({ from: 'nowhere', about, growth: 'arc' })
  ).rejects.toThrow('Notebook not found')
  expect(asked()).toHaveLength(0)
})

// Round 2's audit: a drawing that failed or was stopped left its series
// waiting, the notebook off home's lists, and no way out.
it('a series waiting on a drawing that fails says why, starts once drawn on Try again, or is cancelled', async () => {
  const { retrySlides, settledBuild } = await import('./projects')
  const { studioRoute } = await import('./studio-routes')
  await drawing('failing')
  let fail!: (reason: Error) => void
  pages.mockImplementationOnce(
    () => new Promise<string[]>((_, reject) => (fail = reject))
  )
  scheduleSlides('failing')
  await vi.waitFor(() => expect(fail).toBeTypeOf('function'))
  await series.startSeries({ from: 'failing', about, growth: 'one' })
  fail(new Error('The stand-in agent stops here'))
  await settledBuild('failing')
  const failed = (await loadProject('failing'))!
  expect(failed.status).toBe('failed')
  expect(failed.project.waitingSeries).toBeDefined()
  // Home hears why, by the series it holds.
  expect(
    (await listNotebooks()).find((item) => item.id === 'failing')
  ).toMatchObject({ waitingSeries: 'Payments', waitingStopped: failed.error })
  // Try again: drawn this time, the series starts.
  pages.mockImplementationOnce(async () => [svg])
  await retrySlides('failing')
  await vi.waitFor(async () =>
    expect((await loadProject('failing'))?.project.mapSeries).toBeTruthy()
  )
  expect((await loadProject('failing'))?.project.waitingSeries).toBeUndefined()

  // Stopped, and given up: the notebook is one of the creator's again.
  await drawing('stopped', {
    waitingSeries: { title: 'Queues', about, growth: 'arc', at: '' }
  })
  await writeRow('projects', 'stopped', {
    ...(await loadProject('stopped'))!,
    status: 'failed',
    error: 'Stopped. Saved work is kept; Try again continues where it stopped.'
  })
  const cancel = () =>
    studioRoute(
      new URL('http://studio.test/api/projects/stopped/waiting-series'),
      { method: 'POST' } as never,
      { cancel: true },
      {} as never
    )
  const reply = (await cancel()) as { status: number; value: Snapshot }
  expect(reply.status).toBe(200)
  expect(reply.value.project.waitingSeries).toBeUndefined()
  expect(reply.value.events.at(-1)?.message).toBe(
    'The series it was to start is cancelled'
  )
  expect(
    (await listNotebooks()).find((item) => item.id === 'stopped')?.waitingSeries
  ).toBeUndefined()
  expect(await cancel()).toEqual({
    status: 400,
    value: { error: 'No series waits for this notebook' }
  })
})
