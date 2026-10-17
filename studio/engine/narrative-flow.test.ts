import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('./creative/scene', () => ({ planCreativeScene: vi.fn() }))
vi.mock('./model-gateway', () => ({ modelFetch: generate }))
const root = await mkdtemp(join(tmpdir(), 'minimal-narrative-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const {
  makeVideo,
  setSceneBeats,
  setSceneShot,
  updateVideoSettings,
  validateVideoSettings
} = await import('./video')
const { loadProject } = await import('./projects')
const { scenePlanKey } = await import('./scene-model')
const { renderScenePacket } = await import('./creative/brief-adapter')
const { narrativeBrief, sceneNarrative } = await import('../shared/narratives')

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

it('keeps a known template and its direction, and refuses others', () => {
  const voice = { kind: 'record' as const }
  expect(
    validateVideoSettings({ presence: 'low', voice, narrative: 'launch' })
  ).toEqual({
    presence: 'low',
    voice,
    narrative: 'launch',
    direction: { preset: 'demo-led' }
  })
  expect(
    validateVideoSettings({
      presence: 'low',
      voice,
      narrative: 'incident',
      direction: { preset: 'deep-dive', length: [1500, 1800] }
    }).direction
  ).toEqual({ preset: 'deep-dive', length: [1500, 1800] })
  expect(
    validateVideoSettings({ presence: 'low', voice, narrative: '' })
  ).toEqual({ presence: 'low', voice })
  expect(() =>
    validateVideoSettings({ presence: 'low', voice, narrative: 'mystery' })
  ).toThrow('Choose one of the templates')
  expect(() =>
    validateVideoSettings({
      presence: 'low',
      voice,
      narrative: 'security',
      direction: { preset: 'short-dramatic' }
    })
  ).toThrow('Choose one of the narrative’s directions')
  expect(() =>
    validateVideoSettings({
      presence: 'low',
      voice,
      narrative: 'incident',
      direction: { preset: 'briefing', length: [240, 240] }
    })
  ).toThrow('Give the length as a range')
})

it('plans each scene for its beats, and a scene can carry another', async () => {
  await seed('shaped')
  await makeVideo('shaped', {
    presence: 'high',
    voice: { kind: 'record' },
    narrative: 'how-it-works'
  })
  await settled('shaped')
  const saved = (await loadProject('shaped'))!.project
  expect(saved.video!.settings).toMatchObject({
    narrative: 'how-it-works',
    direction: { preset: 'explainer' }
  })
  // A plan answers to the scene's beats only when the video has a template.
  const plain = structuredClone(saved)
  delete plain.video!.settings.narrative
  delete plain.video!.settings.direction
  const [first, middle] = saved.video!.scenes
  expect(scenePlanKey(saved, middle)).not.toBe(scenePlanKey(plain, middle))
  const before = middle.planKey
  await setSceneBeats('shaped', middle.id, ['breaks'])
  await settled('shaped')
  const after = (await loadProject('shaped'))!.project.video!.scenes[1]
  expect(after.beats).toEqual(['breaks'])
  expect(after.planKey).not.toBe(before)
  await expect(setSceneBeats('shaped', first.id, ['nope'])).rejects.toThrow(
    'Choose beats of the video’s template'
  )
  await expect(setSceneBeats('shaped', first.id, [])).rejects.toThrow(
    'Choose beats of the video’s template'
  )
  // Taking its share in order again.
  await setSceneBeats('shaped', middle.id, null)
  await settled('shaped')
  expect((await loadProject('shaped'))!.project.video!.scenes[1].planKey).toBe(
    before
  )
  // A direction is part of the plan: a longer telling plans again.
  await updateVideoSettings('shaped', {
    presence: 'high',
    voice: { kind: 'record' },
    narrative: 'how-it-works',
    direction: { preset: 'deep-dive' }
  })
  await settled('shaped')
  expect(
    (await loadProject('shaped'))!.project.video!.scenes[1].planKey
  ).not.toBe(before)
  // Beats chosen in one template are not carried into another.
  await setSceneBeats('shaped', middle.id, ['pattern'])
  await settled('shaped')
  await updateVideoSettings('shaped', {
    presence: 'high',
    voice: { kind: 'record' },
    narrative: 'design-decision'
  })
  await settled('shaped')
  const moved = (await loadProject('shaped'))!.project.video!.scenes[1]
  expect(moved.beats).toBeUndefined()
})

it('changes the template for every scene, and needs one to change beats', async () => {
  await seed('plain')
  await makeVideo('plain', { presence: 'off', voice: { kind: 'record' } })
  await settled('plain')
  const scene = (await loadProject('plain'))!.project.video!.scenes[0]
  await expect(setSceneBeats('plain', scene.id, ['hook'])).rejects.toThrow(
    'Choose a template for the video first'
  )
  const keys = (await loadProject('plain'))!.project.video!.scenes.map(
    (item) => item.planKey
  )
  await updateVideoSettings('plain', {
    presence: 'off',
    voice: { kind: 'record' },
    narrative: 'incident'
  })
  await settled('plain')
  const next = (await loadProject('plain'))!.project.video!
  expect(next.settings.narrative).toBe('incident')
  next.scenes.forEach((item, index) =>
    expect(item.planKey).not.toBe(keys[index])
  )
})

it('opens a video saved with an old template on its narrative', async () => {
  await seed('old')
  await makeVideo('old', { presence: 'off', voice: { kind: 'record' } })
  await settled('old')
  const { readRow, writeRow: write } = await import('./persistence')
  const row = (await readRow<Snapshot>('projects', 'old'))!
  Object.assign(row.project.video!.settings, { template: 'incident-thriller' })
  Object.assign(row.project.video!.scenes[1], { slot: 'cause' })
  await write('projects', 'old', row)
  const opened = (await loadProject('old'))!.project.video!
  expect(opened.settings).toEqual({
    presence: 'off',
    voice: { kind: 'record' },
    narrative: 'incident'
  })
  expect('slot' in opened.scenes[1]).toBe(false)
})

it('tells the planner the story and the beats the scene carries', () => {
  const video = {
    settings: {
      narrative: 'incident',
      direction: { preset: 'explainer' as const }
    },
    scenes: [{ id: 'scene-a' }, { id: 'scene-b' }, { id: 'scene-c' }]
  }
  const story = narrativeBrief(sceneNarrative(video, 'scene-b')!, 'low')
  const text = renderScenePacket({
    videoTitle: 'Tokens',
    scene: { id: 'scene-b', title: 'b', index: 1, originScenes: ['b'] },
    presentation: [],
    script: '',
    units: [],
    adjacent: [],
    direction: { video: '', scene: '' },
    delivery: 'human',
    story,
    reviewed: null,
    assets: []
  })
  expect(text).toContain("## This scene in the video's story")
  expect(text).toContain(
    'The video tells a "Incident walkthrough" story: What users felt, what happened when, why, and what changes now. It is for your team, or your customers.'
  )
  expect(text).toContain('The story insists: Blameless: contributing factors')
  expect(text).toContain(
    'It is told as Explainer, 6–10 min in all: calm and clear'
  )
  expect(text).toContain('The material that leads: diagram, code.')
  expect(text).toContain(
    'Its spine: Impact → Timeline → Cause → Fix → What changes.'
  )
  expect(text).toContain('This scene, 2 of 3, carries:')
  expect(text).toContain(
    '- Cause (Turn): the viewer comes away knowing the contributing factors, not a culprit.'
  )
  expect(text).toContain(
    'In this telling it grows: the false leads, and why they misled.'
  )
  expect(text).toContain('frame them this way: Speaker in the corner.')
})

it('orchestrates the video: seams in one direction, a shot in every plan', async () => {
  await seed('directed')
  await makeVideo('directed', {
    presence: 'low',
    voice: { kind: 'record' },
    narrative: 'how-it-works',
    direction: { preset: 'briefing' }
  })
  await settled('directed')
  const made = (await loadProject('directed'))!.project
  // Three scenes, each a new beat: two pushes forward.
  expect(made.video!.transitions).toEqual(['push-left', 'push-left'])
  const [, middle] = made.video!.scenes
  const before = middle.planKey
  await setSceneShot('directed', middle.id, 'code-focus')
  await settled('directed')
  const shot = (await loadProject('directed'))!.project.video!.scenes[1]
  expect(shot.shot).toBe('code-focus')
  expect(shot.planKey).not.toBe(before)
  await expect(setSceneShot('directed', middle.id, 'zebra')).rejects.toThrow(
    'Choose one of the shots'
  )
  await setSceneShot('directed', middle.id, null)
  await settled('directed')
  expect(
    (await loadProject('directed'))!.project.video!.scenes[1].planKey
  ).toBe(before)
  // A new story starts from the orchestrator's shots again.
  await setSceneShot('directed', middle.id, 'stat-hit')
  await settled('directed')
  await updateVideoSettings('directed', {
    presence: 'low',
    voice: { kind: 'record' },
    narrative: 'incident'
  })
  await settled('directed')
  expect(
    (await loadProject('directed'))!.project.video!.scenes[1].shot
  ).toBeUndefined()
  await seed('plain-shot')
  await makeVideo('plain-shot', { presence: 'off', voice: { kind: 'record' } })
  await settled('plain-shot')
  const plain = (await loadProject('plain-shot'))!.project.video!
  expect(plain.transitions).toEqual(['none', 'none'])
  await expect(
    setSceneShot('plain-shot', plain.scenes[0].id, 'stat-hit')
  ).rejects.toThrow('Choose a template for the video first')
})
