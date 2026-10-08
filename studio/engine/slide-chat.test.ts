import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
const { revise, draw, direct } = vi.hoisted(() => ({
  revise: vi.fn(),
  draw: vi.fn(),
  direct: vi.fn()
}))
vi.mock('./creative/slide-revision', () => ({
  prepareCreativeSlideRevision: revise
}))
vi.mock('./creative/pages', () => ({ prepareCreativePages: draw }))
vi.mock('./model-gateway', () => ({ modelFetch: direct }))
const root = await mkdtemp(join(tmpdir(), 'studio-slide-chat-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow, readRow } = await import('./persistence')
const { changeProject, loadProject } = await import('./projects')
const { chatSlide, settledChanges, scheduleChanges } =
  await import('./slide-changes')
const { readSourceNarrative } = await import('./source-document')
const { pageBrandFrom } = await import('./source-page')
const source = readSourceNarrative(
  'A canvas lets people work together on writing and coding.'
)
const revised = {
  title: 'Working together',
  kind: 'list',
  seconds: 6,
  idea: 'One shared workspace',
  narration: 'Work together on writing and coding.',
  parts: [],
  relations: [],
  source: [source.text]
}
const seed = async (id: string) => {
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Fixture',
      source: source.text,
      harness: { adapter: 'kimi', model: 'fixture-model' },
      slides: [
        { id: 'first', title: 'Opening', svg: '<svg/>' },
        { id: 'selected', title: 'Canvas', svg: '<svg id="original"/>' }
      ],
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
  await writeRow('outlines', id, {
    source,
    brand: pageBrandFrom(source.palette, source.fonts)
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  revise.mockResolvedValue({
    title: 'Fixture',
    scenes: [revised],
    targetSeconds: 6,
    glossary: []
  })
  draw.mockResolvedValue(['<svg id="designed"/>'])
})
afterAll(() => rm(root, { recursive: true, force: true }))
const request = {
  anchor: { stage: 'presentation' as const, slideId: 'selected' },
  instruction: 'Explain the shared workspace more clearly'
}
it('uses the notebook harness for revision and redraw, retaining its selected slide identity', async () => {
  await seed('selected-harness')
  const queued = await chatSlide('selected-harness', request)
  expect(queued.changes).toMatchObject([
    { slideId: 'selected', instruction: request.instruction }
  ])
  await settledChanges('selected-harness')
  const updated = (await loadProject('selected-harness'))!
  expect(direct).not.toHaveBeenCalled()
  expect(revise.mock.calls[0][0].selection).toEqual({
    adapter: 'kimi',
    model: 'fixture-model'
  })
  expect(draw.mock.calls[0][0]).toMatchObject({
    pageOffset: 1,
    reuseStyle: true,
    edit: { instruction: request.instruction, svg: '<svg id="original"/>' }
  })
  expect(updated.project.slides[1]).toMatchObject({
    id: 'selected',
    title: revised.title,
    svg: '<svg id="designed"/>'
  })
  expect(updated.changes).toEqual([])
  expect(
    updated.events
      .filter((event) => event.kind === 'chat')
      .map((event) => [event.anchor, event.message])
  ).toEqual([
    [request.anchor, request.instruction],
    [request.anchor, 'Changed wireframe 2.']
  ])
  expect(
    (await readRow<any>('slide-artifacts', 'selected')).objectKey
  ).toBeTruthy()
})
it('redraws a change pinned to one part without rewriting the story', async () => {
  await seed('pinned')
  await writeRow('outlines', 'pinned', {
    source,
    brand: pageBrandFrom(source.palette, source.fonts),
    outline: {
      title: 'Fixture',
      targetSeconds: 6,
      glossary: [],
      scenes: [revised, revised]
    },
    slideIds: ['first', 'selected']
  })
  const target = { id: 's02-edge-1', label: 'sends to', kind: 'connector' }
  await chatSlide('pinned', { ...request, target })
  await settledChanges('pinned')
  expect(revise).not.toHaveBeenCalled()
  expect(draw.mock.calls[0][0].edit).toMatchObject({ target })
  expect((await loadProject('pinned'))!.project.slides[1].svg).toBe(
    '<svg id="designed"/>'
  )
})
it('queues a change for a drawn wireframe while the rest are drawn, and runs it once the deck is ready', async () => {
  await seed('queued')
  await changeProject('queued', (current) => {
    current.status = 'building'
  })
  await chatSlide('queued', request)
  await settledChanges('queued')
  expect(revise).not.toHaveBeenCalled()
  expect((await loadProject('queued'))!.changes?.[0].state).toBe('queued')
  await changeProject('queued', (current) => {
    current.status = 'ready'
  })
  scheduleChanges('queued')
  await settledChanges('queued')
  expect((await loadProject('queued'))!.project.slides[1].svg).toBe(
    '<svg id="designed"/>'
  )
})
it('lets another change complete while the model runs and refuses to overwrite it', async () => {
  await seed('concurrent')
  let resolve!: (value: unknown) => void
  revise.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  await chatSlide('concurrent', request)
  await vi.waitFor(() => expect(revise).toHaveBeenCalled())
  await changeProject('concurrent', (current) => {
    current.project.slides[1].title = 'Newer edit'
  })
  resolve({
    title: 'Fixture',
    scenes: [revised],
    targetSeconds: 6,
    glossary: []
  })
  await settledChanges('concurrent')
  const saved = (await loadProject('concurrent'))!
  expect(saved.project.slides[1].title).toBe('Newer edit')
  expect(saved.changes?.[0]).toMatchObject({ state: 'failed' })
  expect(saved.events.at(-1)?.message).toContain('Send your request again')
})
it('does not replace a slide when its drawing stage fails, and says who could not change it', async () => {
  await seed('failed-drawing')
  draw.mockRejectedValue(new Error('Fixture drawing refused'))
  await chatSlide('failed-drawing', request)
  await settledChanges('failed-drawing')
  const saved = (await loadProject('failed-drawing'))!
  expect(saved.project.slides[1].svg).toContain('original')
  expect(saved.changes?.[0].message).toBe(
    'Kimi could not change this wireframe. Try again.'
  )
})
it('finishes a change when the map only grouped the page meanwhile', async () => {
  await seed('grouped')
  let resolve!: (value: unknown) => void
  revise.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  await chatSlide('grouped', request)
  await vi.waitFor(() => expect(revise).toHaveBeenCalled())
  // Grouping the map by topic notes a topic on every page.
  await changeProject('grouped', (current) => {
    for (const slide of current.project.slides) slide.topic = 'Canvas'
  })
  resolve({
    title: 'Fixture',
    scenes: [revised],
    targetSeconds: 6,
    glossary: []
  })
  await settledChanges('grouped')
  const saved = (await loadProject('grouped'))!
  expect(saved.changes).toEqual([])
  expect(saved.project.slides[1]).toMatchObject({
    title: 'Working together',
    topic: 'Canvas'
  })
})
