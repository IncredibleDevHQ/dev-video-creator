import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import type { Project } from '../../shared/model'
// The agents are stand-ins: this proves what the scene step sends them.
const { treatment } = vi.hoisted(() => ({ treatment: vi.fn() }))
vi.mock('./cast-packet', () => ({
  prepareCastPacket: vi.fn(async () => ({
    assetKeys: [],
    assets: [],
    visualCast: {},
    media: {}
  }))
}))
vi.mock('./brief', () => ({
  prepareCreativeBrief: vi.fn(async () => ({ coverage: [] }))
}))
vi.mock('./treatment', () => ({ prepareCreativeTreatment: treatment }))
vi.mock('./script', () => ({ prepareCreativeScript: vi.fn(async () => []) }))
const root = await mkdtemp(join(tmpdir(), 'minimal-scene-orchestration-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { planCreativeScene } = await import('./scene')
afterAll(() => rm(root, { recursive: true, force: true }))

it('sends the planner its story, its shot in SCENE.md and its presence', async () => {
  treatment.mockResolvedValue({ moments: [], objects: [] })
  const project = {
    id: 'p',
    title: 'Limits',
    source: 'Text.',
    narrative: 'how-it-works',
    slides: ['a', 'b', 'c'].map((id, index) => ({
      id,
      title: id,
      svg: '<svg/>',
      pageKind: index === 0 ? 'title' : index === 2 ? 'close' : 'diagram',
      beats: [['question'], ['example'], ['pattern']][index]
    })),
    video: {
      settings: {
        presence: 'low',
        voice: { kind: 'record' },
        narrative: 'how-it-works',
        direction: { preset: 'briefing' }
      },
      scenes: ['a', 'b', 'c'].map((id) => ({
        id: `scene-${id}`,
        slideId: id,
        phase: 'writing',
        presence: null,
        moments: [],
        inputKey: '',
        planKey: `key-${id}`,
        produced: null,
        error: null
      })),
      transitions: ['push-left', 'push-left'],
      inputKey: '',
      produced: null
    }
  } as unknown as Project
  await planCreativeScene(
    project,
    project.video!.scenes[1],
    { adapter: 'kimi' },
    'http://127.0.0.1'
  )
  const input = treatment.mock.calls[0][0]
  expect(input.context.presence).toBe('off')
  expect(input.context.story.beats[0].name).toBe('One example')
  expect(input.context.shot).toMatchObject({ id: 'flow-trace' })
  expect(input.context.castSize).toBeUndefined()
  // SCENE.md renders from the scene packet: the shot must be there too.
  expect(input.scenePacket.shot).toMatchObject({
    id: 'flow-trace',
    entry: 'push-left',
    exit: 'push-left'
  })
  expect(input.scenePacket.castSize).toBe(0)
  expect(input.orchestration.cast).toEqual([])
})
