import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// The planner is a stand-in: these checks prove the plumbing, not a model.
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('./creative/scene', () => ({ planCreativeScene: vi.fn() }))
vi.mock('./model-gateway', () => ({ modelFetch: generate }))
const root = await mkdtemp(join(tmpdir(), 'minimal-video-while-drawing-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { makeVideo } = await import('./video')
const { loadProject } = await import('./projects')
const { scenePlanKey, startWaitingScenes } = await import('./scene-model')
afterAll(() => rm(root, { recursive: true, force: true }))

// As in video.test.ts: two moments that meet each scene's role and presence.
const answer = (input: string) => {
  const title = input.includes('role title')
  const ending = input.includes('role ending')
  const moments = [0, 1].map((index) => ({
    title: `Part ${index}`,
    lines: `The bucket has ${index + 1} tokens.`,
    seconds: 4,
    camera: 'none',
    layout:
      (index === 0 && title) || (index === 1 && ending)
        ? 'full-screen'
        : 'corner',
    overlay:
      title && index === 0
        ? 'title-card'
        : ending && index === 1
          ? 'end-card'
          : null,
    cue: 'Explain the bucket'
  }))
  return {
    ok: true,
    json: async () => ({
      output: [
        {
          content: [{ type: 'output_text', text: JSON.stringify({ moments }) }]
        }
      ]
    })
  }
}
beforeEach(() => {
  generate.mockReset()
  generate.mockImplementation((_task, init) =>
    Promise.resolve(answer(JSON.parse(init.body).input))
  )
})

// A deck still being drawn: three planned pages, the first kept.
const seed = async (id: string, drafts = 3) => {
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Tokens',
      source: 'A request spends one token.',
      slides: ['a', 'b', 'c'].slice(0, drafts).map((slide) => ({
        id: slide,
        title: slide,
        svg: '<svg/>',
        draft: true
      })),
      video: null
    },
    status: 'building',
    plannedSlides: 3,
    plan: ['a', 'b', 'c'].map((slide) => ({
      id: slide,
      title: slide,
      narration: ''
    })),
    kept: [0],
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
}
const voice = { kind: 'record' as const }

it('waits for every page’s first draft before a video opens', async () => {
  await seed('early', 2)
  await expect(makeVideo('early', { presence: 'off', voice })).rejects.toThrow(
    'The video opens once every wireframe has a first draft'
  )
})

it('makes the done pages’ scenes now, and the rest once they are drawn', async () => {
  await seed('drawing')
  await makeVideo('drawing', { presence: 'off', voice })
  const made = (await loadProject('drawing'))!
  const scenes = made.project.video!.scenes
  expect(scenes.map((scene) => scene.afterDrawing ?? null)).toEqual([
    null,
    true,
    true
  ])
  expect(scenes[0].phase).not.toBe('idle')
  expect(scenes.slice(1).map((scene) => scene.phase)).toEqual(['idle', 'idle'])
  // The second page is kept: its scene starts.
  made.kept = [0, 1]
  expect(startWaitingScenes(made, made)).toBe(true)
  expect(made.project.video!.scenes[1]).toMatchObject({ phase: 'queued' })
  expect(made.project.video!.scenes[1].afterDrawing).toBeUndefined()
  // The deck is ready: the last one starts too.
  made.status = 'ready'
  expect(startWaitingScenes(made, made)).toBe(true)
  expect(made.project.video!.scenes[2].phase).toBe('queued')
  expect(startWaitingScenes(made, made)).toBe(false)
  // A page leaving its draft keeps its scene's plan.
  const [first] = made.project.video!.scenes
  const before = scenePlanKey(made.project, first)
  delete made.project.slides[0].draft
  expect(scenePlanKey(made.project, first)).toBe(before)
  // The started scene's planning runs in the background; let it land.
  await vi.waitFor(
    async () =>
      expect(
        (await loadProject('drawing'))!.project.video!.scenes[0].phase
      ).toBe('waiting'),
    { timeout: 5000 }
  )
})

it('leaves out the scenes the creator did not choose, drawn or not', async () => {
  await seed('chosen')
  await makeVideo('chosen', { presence: 'off', voice, scenes: ['b'] })
  const scenes = (await loadProject('chosen'))!.project.video!.scenes
  expect(
    scenes.map((scene) => [scene.phase, scene.afterDrawing ?? null])
  ).toEqual([
    ['idle', null],
    ['idle', true],
    ['idle', null]
  ])
})
