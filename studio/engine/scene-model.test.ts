import { it, expect } from 'vitest'
import type { Project } from '../shared/model'
import {
  keepingPlans,
  notePlanKeys,
  planFits,
  reconcileVideo,
  refreshVideoKeys,
  scenePlanKey
} from './scene-model'
const project = (): Project => ({
  id: 'p',
  title: 'Tokens',
  source: 'Text',
  slides: ['a', 'b', 'c'].map((id) => ({ id, title: id, svg: '<svg/>' })),
  video: {
    settings: { presence: 'high', voice: { kind: 'record' } },
    scenes: [],
    transitions: [],
    inputKey: '',
    produced: null
  }
})
it('keeps scenes with slides and invalidates role changes when slides move', () => {
  const p = project()
  reconcileVideo(p, { project: p, events: [] })
  const scene = p.video!.scenes[1]
  scene.phase = 'waiting'
  const key = scene.planKey
  p.slides.unshift(p.slides.splice(1, 1)[0])
  reconcileVideo(p, { project: p, events: [] })
  expect(p.video!.scenes[0].id).toBe(scene.id)
  expect(p.video!.scenes[0].planKey).not.toBe(key)
  expect(p.video!.scenes[0].phase).toBe('queued')
})
it('preserves a transition only while its adjacent slide ids remain together', () => {
  const p = project()
  reconcileVideo(p, { project: p, events: [] })
  p.video!.transitions = ['crossfade', 'wipe']
  p.slides.push({ id: 'd', title: 'd', svg: '<svg/>' })
  reconcileVideo(p, { project: p, events: [] })
  expect(p.video!.transitions).toEqual(['crossfade', 'wipe', 'none'])
  p.slides.splice(1, 1)
  reconcileVideo(p, { project: p, events: [] })
  expect(p.video!.scenes.map((scene) => scene.slideId)).toEqual(['a', 'c', 'd'])
  expect(p.video!.transitions).toEqual(['none', 'none'])
})
it('does not queue an undesigned blank slide for the model', () => {
  const p = project()
  p.slides[1].svg = null
  reconcileVideo(p, { project: p, events: [] })
  expect(p.video!.scenes[1].phase).toBe('failed')
})

it('invalidates an in-flight moment revision when its slide changes', () => {
  const p = project()
  reconcileVideo(p, { project: p, events: [] })
  const scene = p.video!.scenes[1]
  scene.phase = 'changing'
  scene.editMomentId = 'm1'
  p.slides[1].svg = '<svg><text>New artwork</text></svg>'
  expect(() => reconcileVideo(p, { project: p, events: [] })).not.toThrow()
  expect(scene.phase).toBe('queued')
})

it('closes the video on the last scene in the cut', async () => {
  const { sceneRole } = await import('./scene-model')
  const slides = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, svg: '' }))
  const project = (made: string[]) =>
    ({
      id: 'p',
      title: 'P',
      source: '',
      slides,
      video: {
        settings: { presence: 'off', voice: { kind: 'record' } },
        scenes: slides.map((slide) => ({
          id: `s-${slide.id}`,
          slideId: slide.id,
          phase: made.includes(slide.id) ? 'waiting' : 'idle',
          presence: null,
          moments: [],
          inputKey: '',
          produced: null,
          error: null
        })),
        transitions: [],
        inputKey: '',
        produced: null
      }
    }) as never
  // Pages a and c are made: c closes this cut; the last page closes a full one.
  expect(
    [0, 1, 2, 3].map((index) => sceneRole(project(['a', 'c']), index))
  ).toEqual(['title', 'body', 'ending', 'body'])
  expect(
    [0, 2, 3].map((index) => sceneRole(project(['a', 'c', 'd']), index))
  ).toEqual(['title', 'body', 'ending'])
  expect(sceneRole(project([]), 3)).toBe('ending')
})

it('lets a left-out scene take new inputs without saying so', () => {
  const p = project()
  const ledger = { project: p, events: [] as Array<{ message: string }> }
  // Only scene b is made; a and c are left out.
  reconcileVideo(p, ledger as never, new Set(['b']))
  expect(p.video!.scenes.map((scene) => scene.phase)).toEqual([
    'idle',
    'queued',
    'idle'
  ])
  ledger.events.length = 0
  // Every page's role changes when the title changes: one log, for b only.
  p.title = 'Tokens, again'
  reconcileVideo(p, ledger as never)
  const logged = ledger.events.filter(
    (event) => event.message === 'Scene inputs changed'
  )
  expect(logged).toHaveLength(1)
  expect(p.video!.scenes[0].phase).toBe('idle')
  expect(p.video!.scenes[0].planKey).toBeTruthy()
})

it('keeps made scenes when only the name shown for their model changes', async () => {
  const { scenePlanKey } = await import('./scene-model')
  const p = project()
  p.video!.settings.harness = { adapter: 'codex', model: 'gpt-6.1-sol' }
  reconcileVideo(p, { project: p, events: [] })
  const scene = p.video!.scenes[0]
  const key = scenePlanKey(p, scene)
  // The engine names the model as the agent's list does: nothing to write
  // again (review 6: every made scene went back to be written).
  p.video!.settings.harness = {
    ...p.video!.settings.harness,
    label: 'GPT-6.1-Sol'
  }
  expect(scenePlanKey(p, scene)).toBe(key)
  // Another model does write it again.
  p.video!.settings.harness = { adapter: 'codex', model: 'gpt-6.2' }
  expect(scenePlanKey(p, scene)).not.toBe(key)
})

// Planned, animated and produced, every key as refreshVideoKeys left it:
// under the key 32b14a0c made (the model's shown name in it), or as now.
const made = (legacy: boolean) => {
  const p = project()
  p.video!.settings.harness = {
    adapter: 'codex',
    model: 'gpt-6.1-sol',
    label: 'GPT-6.1-Sol'
  }
  reconcileVideo(p, { project: p, events: [] })
  for (const scene of p.video!.scenes) {
    scene.planKey = scenePlanKey(p, scene, legacy)
    scene.creativePlan = { recordId: `r-${scene.id}`, inputKey: scene.planKey }
    scene.moments = [
      {
        id: `${scene.id}-m`,
        lines: 'Words.',
        start: 0,
        end: 2,
        camera: 'none',
        layout: 'full-screen',
        overlay: null,
        recordingKey: 'r',
        take: null,
        audio: null,
        audioKey: ''
      }
    ]
  }
  refreshVideoKeys(p)
  for (const scene of p.video!.scenes) {
    scene.animation = {
      inputKey: scene.animationKey!,
      objectKey: 'a.mp4',
      moments: [{ id: `${scene.id}-m`, start: 0, end: 2 }]
    }
    scene.phase = 'produced'
    scene.produced = { inputKey: scene.inputKey, objectKey: 'final.mp4' }
  }
  refreshVideoKeys(p)
  p.video!.produced = { inputKey: p.video!.inputKey, objectKey: 'v.mp4' }
  return p
}
const keys = (p: Project) =>
  p.video!.scenes.map((scene) => ({
    phase: scene.phase,
    plan: scene.planKey,
    animation: scene.animation?.inputKey === scene.animationKey,
    produced: scene.produced?.inputKey === scene.inputKey
  }))

it('keeps a scene planned while its model’s name went into the key, and all it made', () => {
  const p = made(true)
  const before = keys(p)
  const old = p.video!.scenes[1].planKey
  const video = p.video!.inputKey
  // Its first reconcile under the new form: an edit to another page.
  p.slides[2].narration = 'New words for c.'
  reconcileVideo(p, { project: p, events: [] })
  expect(keys(p).slice(0, 2)).toEqual(before.slice(0, 2))
  expect(keys(p)[2].phase).toBe('queued')
  expect(planFits(old, p.video!.scenes[1])).toBe(true)
  // A later name, or none, never counts against it.
  p.video!.settings.harness = { ...p.video!.settings.harness!, label: 'Sol' }
  reconcileVideo(p, { project: p, events: [] })
  delete p.video!.settings.harness!.label
  reconcileVideo(p, { project: p, events: [] })
  expect(keys(p).slice(0, 2)).toEqual(before.slice(0, 2))
  expect(p.video!.inputKey).not.toBe(video)
  // Another model writes it again: the old plan no longer counts.
  p.video!.settings.harness = { adapter: 'codex', model: 'gpt-6.2' }
  reconcileVideo(p, { project: p, events: [] })
  expect(p.video!.scenes[1].phase).toBe('queued')
  expect(planFits(old, p.video!.scenes[1])).toBe(false)
  expect(p.video!.scenes[1].legacyPlanKey).toBeUndefined()
})

it('keeps an older plan when the model’s name changes before any reconcile', () => {
  const p = made(true)
  const before = keys(p)
  // As the notebook's agent or the video's settings change it: the scenes
  // note what their keys stand for first.
  notePlanKeys(p)
  p.video!.settings.harness = { ...p.video!.settings.harness!, label: 'Sol' }
  reconcileVideo(p, { project: p, events: [] })
  expect(keys(p)).toEqual(before)
})

it('gives a scene d24d80b8 moved its key back, unless it was made again', () => {
  // d24d80b8 moved the key to the new form, and the keys of what the scene
  // had made went stale with it.
  const p = made(true)
  const before = keys(p)
  for (const scene of p.video!.scenes) {
    const to = scenePlanKey(p, scene)
    scene.legacyPlanKey = { from: scene.planKey!, to }
    scene.planKey = to
  }
  refreshVideoKeys(p)
  // Scene c was produced again under the moved key.
  const c = p.video!.scenes[2]
  c.animation = { ...c.animation!, inputKey: c.animationKey! }
  c.produced = { inputKey: c.inputKey, objectKey: 'again-final.mp4' }
  reconcileVideo(p, { project: p, events: [] })
  expect(keys(p).slice(0, 2)).toEqual(before.slice(0, 2))
  expect(c.planKey).toBe(c.legacyPlanKey!.to)
  expect(keys(p)[2]).toMatchObject({ animation: true, produced: true })
  expect(planFits(c.legacyPlanKey!.from, c)).toBe(true)
})

it('lands a plan in flight under the older key', () => {
  const p = made(true)
  const scene = p.video!.scenes[1]
  scene.phase = 'writing'
  // planScene keeps what it expects, and lands only while the key stands.
  const expected = scene.planKey
  reconcileVideo(p, { project: p, events: [] })
  expect(scene.planKey).toBe(expected)
  expect(scene.phase).toBe('writing')
})

it('keeps every plan through a change the plans don’t depend on', () => {
  for (const legacy of [false, true]) {
    const p = made(legacy)
    const stored = p.video!.scenes.map((scene) => scene.planKey!)
    // A look re-colours the pages: the keys move, the plans stay.
    keepingPlans(p, () => {
      for (const slide of p.slides) slide.svg = '<svg fill="#234567"/>'
    })
    refreshVideoKeys(p)
    p.video!.scenes.forEach((scene, index) => {
      expect(planFits(stored[index], scene)).toBe(true)
      expect(scene.planKey).toBe(stored[index])
    })
    reconcileVideo(p, { project: p, events: [] })
    expect(p.video!.scenes.map((scene) => scene.phase)).toEqual(
      Array(3).fill('produced')
    )
    // An edit after it is still an edit.
    p.slides[0].narration = 'New words.'
    reconcileVideo(p, { project: p, events: [] })
    expect(p.video!.scenes[0].phase).toBe('queued')
    expect(planFits(stored[0], p.video!.scenes[0])).toBe(false)
  }
})

it('stops saying the video stopped once a stopped scene goes with its page, from anywhere', () => {
  const p = project()
  reconcileVideo(p, { project: p, events: [] })
  const video = p.video! as typeof p.video & {
    phase?: string
    error?: string | null
  }
  p.video!.scenes[1].phase = 'failed'
  p.video!.scenes[1].failure = 'production'
  video.phase = 'failed'
  video.error = 'A scene stopped. Other saved animations are ready.'
  // Its page removed, as the map's episodes do.
  p.slides.splice(1, 1)
  reconcileVideo(p, { project: p, events: [] }, new Set())
  expect(video.phase).toBe('idle')
  expect(video.error).toBeNull()
})

it('counts a scene stopped for a blank page, and leaves a video’s own stop', () => {
  const p = project()
  reconcileVideo(p, { project: p, events: [] })
  const video = p.video! as typeof p.video & {
    phase?: string
    error?: string | null
  }
  p.video!.scenes[1].phase = 'failed'
  video.phase = 'failed'
  video.error = 'A scene stopped. Other saved animations are ready.'
  // A page added before it is drawn stops its scene here: two now.
  p.slides.push({ id: 'd', title: 'd', svg: null })
  reconcileVideo(p, { project: p, events: [] })
  expect(p.video!.scenes[3].phase).toBe('failed')
  expect(video.error).toBe(
    '2 scenes stopped. Other saved animations are ready.'
  )
  // A video that stopped for its join keeps its own line.
  video.error = 'Could not produce the video. Try again.'
  p.slides.splice(1, 1)
  p.slides.pop()
  reconcileVideo(p, { project: p, events: [] })
  expect(video.phase).toBe('failed')
  expect(video.error).toBe('Could not produce the video. Try again.')
})
