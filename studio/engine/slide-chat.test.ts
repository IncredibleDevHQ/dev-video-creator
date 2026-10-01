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
const { chatSlide, changeProject, loadProject } = await import('./projects')
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
  const updated = await chatSlide('selected-harness', request)
  expect(direct).not.toHaveBeenCalled()
  expect(revise.mock.calls[0][0].selection).toEqual({
    adapter: 'kimi',
    model: 'fixture-model'
  })
  expect(draw.mock.calls[0][0]).toMatchObject({
    pageOffset: 1,
    reuseStyle: true
  })
  expect(updated.project.slides[1]).toMatchObject({
    id: 'selected',
    title: revised.title,
    svg: '<svg id="designed"/>'
  })
  expect(
    updated.events
      .filter((event) => event.kind === 'chat')
      .map((event) => event.anchor)
  ).toEqual([request.anchor, request.anchor])
  expect(
    (await readRow<any>('slide-artifacts', 'selected')).objectKey
  ).toBeTruthy()
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
  const work = chatSlide('concurrent', request)
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
  await expect(work).rejects.toThrow('changed while')
  expect((await loadProject('concurrent'))?.project.slides[1].title).toBe(
    'Newer edit'
  )
  expect((await loadProject('concurrent'))?.events.at(-1)?.message).toContain(
    'Try again'
  )
})
it('does not replace a slide when its drawing stage fails', async () => {
  await seed('failed-drawing')
  draw.mockRejectedValue(new Error('Fixture drawing refused'))
  await expect(chatSlide('failed-drawing', request)).rejects.toThrow(
    'drawing refused'
  )
  expect(
    (await loadProject('failed-drawing'))?.project.slides[1].svg
  ).toContain('original')
})
