import { it, expect } from 'vitest'
import type { Project } from '../shared/model'
import { reconcileVideo } from './scene-model'
const project = (): Project => ({ id: 'p', title: 'Tokens', source: 'Text', slides: ['a','b','c'].map(id => ({ id, title: id, svg: '<svg/>' })), video: { settings: { presence: 'high', voice: { kind: 'record' } }, scenes: [], transitions: [], inputKey: '', produced: null } })
it('keeps scenes with slides and invalidates role changes when slides move', () => {
  const p = project(); reconcileVideo(p)
  const scene = p.video!.scenes[1]; scene.phase = 'waiting'
  const key = scene.planKey
  p.slides.unshift(p.slides.splice(1,1)[0]); reconcileVideo(p)
  expect(p.video!.scenes[0].id).toBe(scene.id)
  expect(p.video!.scenes[0].planKey).not.toBe(key)
  expect(p.video!.scenes[0].phase).toBe('queued')
})
it('preserves a transition only while its adjacent slide ids remain together', () => {
  const p = project(); reconcileVideo(p); p.video!.transitions = ['crossfade','wipe']
  p.slides.push({ id: 'd', title: 'd', svg: '<svg/>' }); reconcileVideo(p)
  expect(p.video!.transitions).toEqual(['crossfade','wipe','none'])
  p.slides.splice(1,1); reconcileVideo(p)
  expect(p.video!.scenes.map(scene => scene.slideId)).toEqual(['a','c','d'])
  expect(p.video!.transitions).toEqual(['none','none'])
})
it('does not queue an undesigned blank slide for the model', () => {
  const p = project(); p.slides[1].svg = null; reconcileVideo(p)
  expect(p.video!.scenes[1].phase).toBe('failed')
})

it('invalidates an in-flight moment revision when its slide changes', () => {
  const p = project(); reconcileVideo(p)
  const scene = p.video!.scenes[1]
  scene.phase = 'changing'; scene.editMomentId = 'm1'
  p.slides[1].svg = '<svg><text>New artwork</text></svg>'
  expect(() => reconcileVideo(p)).not.toThrow()
  expect(scene.phase).toBe('queued')
})
