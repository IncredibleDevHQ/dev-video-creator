import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('./creative/scene', () => ({ planCreativeScene: vi.fn() }))
vi.mock('./model-gateway', () => ({ modelFetch: generate }))
const root = await mkdtemp(join(tmpdir(), 'minimal-template-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { makeVideo, setSceneSlot, updateVideoSettings, validateVideoSettings } =
  await import('./video')
const { loadProject } = await import('./projects')
const { scenePlanKey } = await import('./scene-model')
const { renderScenePacket } = await import('./creative/brief-adapter')
const { seamLine, slotBrief, templateById } =
  await import('../shared/video-templates')

// The planner's stand-in, as in video.test.ts: two moments that meet each
// scene's role and presence.
const answer = (input: string) => {
  const off = input.includes('On camera off')
  const low = input.includes('On camera low')
  const title = input.includes('role title')
  const ending = input.includes('role ending')
  const moments = [0, 1].map((index) => ({
    title: `Part ${index}`,
    lines: `The bucket has ${index + 1} tokens.`,
    seconds: 4,
    camera: off || (low && index === 0) ? 'none' : 'full',
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
const seed = async (id: string) => {
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Tokens',
      source: 'A request spends one token.',
      slides: ['a', 'b', 'c'].map((slide) => ({
        id: slide,
        title: slide,
        svg: '<svg/>'
      })),
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
}
const settled = (id: string) =>
  vi.waitFor(
    async () =>
      expect(
        (await loadProject(id))!.project.video!.scenes.map(
          (scene) => scene.phase
        )
      ).toEqual(['waiting', 'waiting', 'waiting']),
    { timeout: 5000 }
  )
beforeEach(() => {
  generate.mockReset()
  generate.mockImplementation((_task, init) =>
    Promise.resolve(answer(JSON.parse(init.body).input))
  )
})
afterAll(() => rm(root, { recursive: true, force: true }))

it('keeps a known template in the video settings, and refuses others', () => {
  const voice = { kind: 'record' as const }
  expect(
    validateVideoSettings({ presence: 'low', voice, template: 'launch-demo' })
  ).toEqual({ presence: 'low', voice, template: 'launch-demo' })
  expect(
    validateVideoSettings({ presence: 'low', voice, template: '' })
  ).toEqual({ presence: 'low', voice })
  expect(() =>
    validateVideoSettings({ presence: 'low', voice, template: 'mystery' })
  ).toThrow('Choose one of the templates')
})

it('plans each scene in its slot, and a scene can take another slot', async () => {
  await seed('shaped')
  await makeVideo('shaped', {
    presence: 'high',
    voice: { kind: 'record' },
    template: 'how-it-works'
  })
  await settled('shaped')
  const saved = (await loadProject('shaped'))!.project
  expect(saved.video!.settings.template).toBe('how-it-works')
  // A plan answers to the scene's slot only when the video has a template.
  const plain = structuredClone(saved)
  delete plain.video!.settings.template
  const [first, middle] = saved.video!.scenes
  expect(scenePlanKey(saved, middle)).not.toBe(scenePlanKey(plain, middle))
  const before = middle.planKey
  await setSceneSlot('shaped', middle.id, 'breaking-point')
  await settled('shaped')
  const after = (await loadProject('shaped'))!.project.video!.scenes[1]
  expect(after.slot).toBe('breaking-point')
  expect(after.planKey).not.toBe(before)
  await expect(setSceneSlot('shaped', first.id, 'nope')).rejects.toThrow(
    'Choose one of the template’s slots'
  )
  // Taking its place in order again.
  await setSceneSlot('shaped', middle.id, null)
  await settled('shaped')
  expect((await loadProject('shaped'))!.project.video!.scenes[1].planKey).toBe(
    before
  )
  // A slot chosen in one template is not carried into another.
  await setSceneSlot('shaped', middle.id, 'recap')
  await settled('shaped')
  await updateVideoSettings('shaped', {
    presence: 'high',
    voice: { kind: 'record' },
    template: 'design-decision'
  })
  await settled('shaped')
  const moved = (await loadProject('shaped'))!.project.video!.scenes[1]
  expect(moved.slot).toBeUndefined()
})

it('changes the template for every scene, and needs one to change a slot', async () => {
  await seed('plain')
  await makeVideo('plain', { presence: 'off', voice: { kind: 'record' } })
  await settled('plain')
  const scene = (await loadProject('plain'))!.project.video!.scenes[0]
  await expect(setSceneSlot('plain', scene.id, 'hook')).rejects.toThrow(
    'Choose a template for the video first'
  )
  const keys = (await loadProject('plain'))!.project.video!.scenes.map(
    (item) => item.planKey
  )
  await updateVideoSettings('plain', {
    presence: 'off',
    voice: { kind: 'record' },
    template: 'incident'
  })
  await settled('plain')
  const next = (await loadProject('plain'))!.project.video!
  expect(next.settings.template).toBe('incident')
  next.scenes.forEach((item, index) =>
    expect(item.planKey).not.toBe(keys[index])
  )
})

it('tells the planner which slot the scene plays', () => {
  const template = templateById('how-it-works')!
  const brief = slotBrief(template, template.slots[2], 'low')
  expect(brief).toMatchObject({
    story: 'How it works',
    template: 'One request',
    audience: 'Developers who use it but never looked inside',
    role: 'Mechanism',
    position: '3 of 6',
    type: 'Explainer',
    speaker: 'Speaker off',
    seconds: 35,
    seam: 'Hold'
  })
  const packet = (template: typeof brief) =>
    renderScenePacket({
      videoTitle: 'Tokens',
      scene: { id: 'scene-b', title: 'b', index: 1, originScenes: ['b'] },
      presentation: [],
      script: '',
      units: [],
      adjacent: [],
      direction: { video: '', scene: '' },
      delivery: 'human',
      template,
      reviewed: null,
      assets: []
    })
  expect(packet(brief)).toContain(
    'The video follows the "One request" template of the story "How it works" (for developers who use it but never looked inside). This scene plays its "Mechanism" slot (3 of 6): Explainer.'
  )
  expect(packet(brief)).toContain('hand over to the next scene with a hold.')
  // The closing slot ends the video instead of handing over.
  const last = slotBrief(template, template.slots[5], 'low')
  expect(packet(last)).toContain('and close the video there.')
  expect(seamLine('end')).toBe('Ends the video')
  expect(seamLine('push')).toBe('Push into the next')
})
