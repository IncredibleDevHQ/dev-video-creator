import { it, expect } from 'vitest'
import type { Project } from '../shared/model'
import { reconcileVideo } from './scene-model'
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
