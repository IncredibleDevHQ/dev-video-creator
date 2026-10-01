import { describe, it, expect } from 'vitest'
import type { Moment, Project, Scene, Voice } from '../shared/model'
import { momentState, sceneView, videoView, projectViews } from './state'
import { advanceScene } from './autopilot'
const voice: Voice = { kind: 'ai', id: 'voice-a' }
const moment = (camera: Moment['camera'] = 'none'): Moment => ({ id: 'm1', lines: 'Hello', start: 0, end: 4, camera, layout: 'corner', overlay: null, recordingKey: 'r1', take: null, audio: null, audioKey: 'a1' })
const scene = (moments = [moment()]): Scene => ({ id: 's1', slideId: 'p1', phase: 'waiting', presence: null, moments, inputKey: 'i1', produced: null, error: null })
describe('recording boundaries', () => {
  it('waits only for camera moments with generated narration', () => {
    for (const camera of ['full', 'start', 'end', 'both'] as const) expect(momentState(moment(camera), voice)).toBe('to record')
    expect(momentState(moment(), voice)).toBe('auto')
    expect(momentState(moment(), { kind: 'record' })).toBe('to record')
  })
  it('rejects an old take after wording or camera changes', () => {
    const m = moment('full'); m.take = { id: 't1', recordingKey: 'r1', objectKey: 'take.webm' }
    expect(momentState(m, voice)).toBe('recorded')
    m.recordingKey = 'r2'
    expect(momentState(m, voice)).toBe('to record')
  })
})
describe('scene lifecycle', () => {
  it('does not produce an empty plan', () => expect(sceneView(scene([]), voice).action).toBe('wait'))
  it('moves automatically from writing to the recording boundary', () => {
    let s = { ...scene([moment('full')]), phase: 'queued' as const }
    const written = advanceScene(advanceScene(s, 'start'), 'plan-ready')
    expect(sceneView(written, voice).action).toBe('record')
    expect(sceneView(written, voice).openMomentIds).toEqual(['m1'])
  })
  it('rejects impossible transitions', () => expect(() => advanceScene({ ...scene(), phase: 'queued' }, 'produced')).toThrow())
  it('requires production again after inputs change', () => {
    const s = { ...scene(), phase: 'produced' as const, produced: { inputKey: 'i1', objectKey: 'scene.mp4' } }
    expect(sceneView(s, voice).produced).toBe(true)
    s.inputKey = 'i2'
    expect(sceneView(s, voice).action).toBe('produce')
  })
})
it('exports only a current join of every current scene', () => {
  const s = { ...scene(), phase: 'produced' as const, produced: { inputKey: 'i1', objectKey: 'scene.mp4' } }
  const p: Project = { id: 'p', title: 'Video', source: 'Text', slides: [{ id: 'p1', title: 'One', svg: null }], video: { settings: { presence: 'high', voice }, scenes: [s], transitions: [], inputKey: 'v1', produced: { inputKey: 'v1', objectKey: 'video.mp4' } } }
  expect(videoView(p).action).toBe('export')
  p.video!.inputKey = 'v2'
  expect(videoView(p).action).toBe('produce-video')
  p.video!.scenes[0].inputKey = 'i2'
  expect(videoView(p).enabled).toBe(false)
})

it('scopes semantic moment state to its scene so repeated names cannot overwrite each other',()=>{
 const project={slides:[],video:{settings:{voice},scenes:[{...scene([moment('none')]),id:'first'},{...scene([moment('full')]),id:'second'}],transitions:[]}} as unknown as Project
 const views=projectViews(project)
 expect(views.moments['first/m1'].state).toBe('auto')
 expect(views.moments['second/m1'].state).toBe('to record')
})

it('never completes a rendered scene while a required presenter take is missing or stale',()=>{
 const m=moment('full')
 const s={...scene([m]),phase:'produced' as const,produced:{inputKey:'i1',objectKey:'old.mp4'}}
 expect(sceneView(s,voice)).toMatchObject({state:'Needs recording',action:'record',produced:false,openMomentIds:['m1']})
 m.take={id:'t',recordingKey:'r1',objectKey:'take.webm'}
 expect(sceneView(s,voice)).toMatchObject({state:'Complete',produced:true})
 m.recordingKey='changed'
 expect(sceneView(s,voice).produced).toBe(false)
})

it('keeps a rendered scene incomplete when even one required presenter take is missing',()=>{
 const first=moment('full'),last={...moment('full'),id:'m6'}
 first.take={id:'real-take',recordingKey:first.recordingKey,objectKey:'real.webm'}
 const s=scene([first,last]);s.phase='produced';s.produced={inputKey:s.inputKey,objectKey:'earlier-test-render.mp4'}
 const view=sceneView(s,voice)
 expect(view).toMatchObject({state:'Needs recording',action:'record',openMomentIds:['m6'],produced:false})
 expect(momentState(first,voice)).toBe('recorded')
 expect(momentState(last,voice)).toBe('to record')
})
