import { it, expect, vi, afterAll } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { brief, story, pages, direct } = vi.hoisted(() => ({
  brief: vi.fn(),
  story: vi.fn(),
  pages: vi.fn(),
  direct: vi.fn(() => {
    throw new Error('Direct fallback is forbidden')
  })
}))
vi.mock('./creative/brief', () => ({ prepareCreativeBrief: brief }))
vi.mock('./creative/story', () => ({ prepareCreativeStory: story }))
vi.mock('./creative/pages', () => ({ prepareCreativePages: pages }))
vi.mock('./model-gateway', () => ({ modelFetch: direct }))
const root = await mkdtemp(join(tmpdir(), 'minimal-pipeline-order-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { createProject, loadProject } = await import('./projects')
const { writeRow } = await import('./persistence')
afterAll(() => rm(root, { recursive: true, force: true }))
it('awaits the source brief, gives it to the story and page skills, and publishes only their artwork', async () => {
  const order: string[] = [],
    accepted = { entities: [], units: [], coverage: [] },
    outline = {
      title: 'Source story',
      scenes: [
        {
          title: 'Source story',
          kind: 'title',
          seconds: 5,
          narration: 'The source says this.',
          parts: [],
          relations: [],
          source: []
        }
      ],
      targetSeconds: 5,
      glossary: []
    }
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  brief.mockImplementation(async (project) => {
    order.push('brief')
    await gate
    await writeRow('source-briefs', project.id, {
      projectId: project.id,
      brief: accepted
    })
    return accepted
  })
  story.mockImplementation(async (...args) => {
    expect(args[4]).toEqual(accepted)
    order.push('story')
    return outline
  })
  pages.mockImplementation(async (input) => {
    expect(input.brief).toEqual(accepted)
    expect(input.outline).toEqual(outline)
    order.push('pages')
    return ['<svg id="designed-by-page-skill"/>']
  })
  const created = await createProject(
    'Retained source text with an explanation to turn into a presentation.'
  )
  expect(created.project.harness).toEqual({
    adapter: 'kimi',
    model: 'kimi-code/k3'
  })
  await vi.waitFor(() => expect(order).toEqual(['brief']))
  expect((await loadProject(created.project.id))?.project.slides).toEqual([])
  release()
  await vi.waitFor(async () =>
    expect((await loadProject(created.project.id))?.status).toBe('ready')
  )
  expect(order).toEqual(['brief', 'story', 'pages'])
  expect((await loadProject(created.project.id))?.project.slides[0].svg).toBe(
    '<svg id="designed-by-page-skill"/>'
  )
  expect(direct).not.toHaveBeenCalled()
})
it('fails visibly when drawing fails, without substituting template pages', async () => {
  brief.mockResolvedValue({ entities: [], units: [], coverage: [] })
  story.mockResolvedValue({
    title: 'Failed',
    scenes: [
      {
        title: 'Failed',
        kind: 'title',
        seconds: 5,
        parts: [],
        relations: [],
        source: []
      }
    ],
    targetSeconds: 5,
    glossary: []
  })
  pages.mockRejectedValue(new Error('Drawing refused'))
  const created = await createProject(
    'Another retained source explanation for the drawing failure check.'
  )
  await vi.waitFor(async () =>
    expect((await loadProject(created.project.id))?.status).toBe('failed')
  )
  expect((await loadProject(created.project.id))?.project.slides).toEqual([])
  expect(direct).not.toHaveBeenCalled()
})
