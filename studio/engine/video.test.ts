import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, it, expect, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
const { generate,creative } = vi.hoisted(() => ({ generate: vi.fn(),creative:vi.fn() }))
vi.mock('./creative/scene',()=>({planCreativeScene:creative}))
vi.mock('./model-gateway', () => ({ modelFetch: generate }))
const root = await mkdtemp(join(tmpdir(), 'minimal-video-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { makeVideo, planScene, replanPresence, chatVideo, updateVideoSettings } = await import('./video')
const { loadProject, changeProject, editSlide } = await import('./projects')
const { reconcileVideo,refreshVideoKeys } = await import('./scene-model')
const response = (input: string) => {
  const off = input.includes('On camera off'); const low = input.includes('On camera low')
  const title = input.includes('role title'); const ending = input.includes('role ending')
  const moments = [0,1].map(index => ({ title: `Part ${index}`, lines: `The bucket has ${index+1} tokens.`, seconds: 4, camera: off || low && index === 0 ? 'none' : 'full', layout: index === 0 && title || index === 1 && ending ? 'full-screen' : 'corner', overlay: title && index === 0 ? 'title-card' : ending && index === 1 ? 'end-card' : null, cue: 'Explain the bucket' }))
  return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ moments }) }] }] }) }
}
const seed = async (id: string) => {
  const snapshot: Snapshot = { project: { id, title: 'Tokens', source: 'A request spends one token.', slides: [{ id: 'a', title: 'Tokens', svg: '<svg/>' },{ id: 'b', title: 'End', svg: '<svg/>' }], video: null }, status: 'ready', error: null, events: [] }
  await writeRow('projects', id, snapshot)
}
beforeEach(() => { generate.mockReset(); generate.mockImplementation((_task, init) => Promise.resolve(response(JSON.parse(init.body).input))) })
afterAll(() => rm(root, { recursive: true, force: true }))
it('plans every scene with no approval and emits derived recording state', async () => {
  await seed('auto')
  await makeVideo('auto', { presence: 'high', voice: { kind: 'ai', id: 'default' } })
  await vi.waitFor(async () => expect((await loadProject('auto'))!.project.video!.scenes.every(scene => scene.phase === 'waiting')).toBe(true))
  const saved = (await loadProject('auto'))!
  expect(generate).toHaveBeenCalledTimes(2)
  expect(saved.views!.scenes['scene-a'].openMomentIds).toHaveLength(2)
  expect(saved.views!.video.enabled).toBe(false)
  expect(saved.events.filter(event => event.kind === 'scene' && event.message === 'Scene written')).toHaveLength(2)
  expect(saved.events.map(event => event.sequence)).toEqual(saved.events.map((_event,index) => index+1))
  await replanPresence('auto','scene-a','off')
  await vi.waitFor(async () => expect((await loadProject('auto'))!.project.video!.scenes[0].phase).toBe('waiting'))
  expect((await loadProject('auto'))!.views!.scenes['scene-a'].openMomentIds).toEqual([])
})
it('does not land a response made for a slide that changed during planning', async () => {
  await seed('race')
  await changeProject('race', snapshot => { snapshot.project.video = { settings: { presence: 'off', voice: { kind: 'record' } }, scenes: [], transitions: [], inputKey: '', produced: null }; reconcileVideo(snapshot.project) })
  let release!: (value: unknown) => void
  generate.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const work = planScene('race', 'scene-a')
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  await changeProject('race', snapshot => { snapshot.project.slides[0].title = 'Changed'; reconcileVideo(snapshot.project) })
  release(response('role title On camera off'))
  await work
  const saved = (await loadProject('race'))!
  expect(saved.project.video!.scenes[0].phase).toBe('queued')
  expect(saved.project.video!.scenes[0].moments).toEqual([])
})
it('a deleted slide can be restored with its original identity', async () => {
  await seed('undo')
  await editSlide('undo', { action: 'delete', slideId: 'a' })
  const saved = await editSlide('undo', { action: 'undo-delete' })
  expect(saved.project.slides.map(slide => slide.id)).toEqual(['a','b'])
  expect(saved.deletedSlide).toBeUndefined()
})

it('keeps a video chat anchor through its automatic replan', async () => {
  await seed('chat')
  await makeVideo('chat',{ presence:'off', voice:{kind:'ai',id:'default'} })
  await vi.waitFor(async () => expect((await loadProject('chat'))!.project.video!.scenes.every(scene => scene.phase === 'waiting')).toBe(true))
  const original = (await loadProject('chat'))!.project.video!.scenes[0]
  const anchor = { stage:'video' as const, sceneId:original.id, momentId:original.moments[1].id, second:5 }
  const changed=await chatVideo('chat',{ anchor,instruction:'Explain what happens to the rejected request.' })
  expect(changed.project.video!.scenes[0].phase).toBe('changing')
  await vi.waitFor(async () => expect((await loadProject('chat'))!.project.video!.scenes[0].phase).toBe('waiting'))
  const saved = (await loadProject('chat'))!
  expect(saved.events.filter(event => event.kind === 'chat').map(event => event.anchor)).toEqual([anchor,anchor])
  const prompt = JSON.parse(generate.mock.calls.at(-1)![1].body).input
  expect(prompt).toContain('Explain what happens to the rejected request.')
  expect(prompt).toContain(original.moments[1].id)
})

it('video defaults replan followers while preserving a scene override', async () => {
  await seed('defaults')
  await makeVideo('defaults',{ presence:'off', voice:{kind:'ai',id:'default'} })
  await vi.waitFor(async () => expect((await loadProject('defaults'))!.project.video!.scenes.every(scene => scene.phase === 'waiting')).toBe(true))
  await replanPresence('defaults','scene-a','off')
  await vi.waitFor(async () => expect((await loadProject('defaults'))!.project.video!.scenes[0].phase).toBe('waiting'))
  const before = (await loadProject('defaults'))!.project.video!.scenes[0]
  await updateVideoSettings('defaults',{presence:'high',voice:{kind:'ai',id:'default'}})
  await vi.waitFor(async () => expect((await loadProject('defaults'))!.project.video!.scenes.every(scene => scene.phase === 'waiting')).toBe(true))
  const saved = (await loadProject('defaults'))!.project.video!
  expect(saved.scenes[0].planKey).toBe(before.planKey)
  expect(saved.scenes[0].moments.map(moment => moment.camera)).toEqual(['none','none'])
  expect(saved.scenes[1].moments.map(moment => moment.camera)).toEqual(['full','full'])
})

it('undo restores the deleted scene recordings, chat and adjacent transitions',async () => {
  await seed('undo-scene')
  await changeProject('undo-scene',saved => { saved.project.slides.push({id:'c',title:'Closing',svg:'<svg/>'}) })
  await makeVideo('undo-scene',{presence:'high',voice:{kind:'ai',id:'default'}})
  await vi.waitFor(async () => expect((await loadProject('undo-scene'))!.project.video!.scenes.every(scene => scene.phase === 'waiting')).toBe(true))
  await changeProject('undo-scene',saved => {
    const video=saved.project.video!
    const scene=video.scenes[1]
    scene.moments[0].take={id:'kept-take',recordingKey:scene.moments[0].recordingKey,objectKey:'take.webm',duration:4}
    scene.instructions=[{momentId:scene.moments[0].id,second:1,instruction:'Keep my example.'}]
    video.transitions=['push-left','crossfade']
  })
  const original=(await loadProject('undo-scene'))!.project.video!.scenes[1]
  await editSlide('undo-scene',{action:'delete',slideId:'b'})
  const restored=await editSlide('undo-scene',{action:'undo-delete'})
  expect(restored.project.video!.scenes.map(scene => scene.slideId)).toEqual(['a','b','c'])
  expect(restored.project.video!.scenes[1].moments[0].take).toEqual(original.moments[0].take)
  expect(restored.project.video!.scenes[1].instructions).toEqual(original.instructions)
  expect(restored.project.video!.transitions).toEqual(['push-left','crossfade'])
})

it('resumes the saved plan without another model request and keeps a newer matching take',async()=>{
 await seed('saved-plan')
 await makeVideo('saved-plan',{presence:'off',voice:{kind:'ai',id:'default'}})
 await vi.waitFor(async()=>expect((await loadProject('saved-plan'))!.project.video!.scenes.every(scene=>scene.phase==='waiting')).toBe(true))
 await changeProject('saved-plan',saved=>{
  const scene=saved.project.video!.scenes[0];scene.phase='queued'
  scene.moments[0].take={id:'new-take',recordingKey:scene.moments[0].recordingKey,objectKey:'new.webm',duration:4}
 })
 generate.mockClear();generate.mockRejectedValue(new Error('A resumed plan must not spend another model request'))
 await planScene('saved-plan','scene-a')
 const scene=(await loadProject('saved-plan'))!.project.video!.scenes[0]
 expect(scene.phase).toBe('waiting');expect(scene.moments[0].take?.id).toBe('new-take')
 expect(generate).not.toHaveBeenCalled()
})

it('retains the harness selection and accepted creative plan with the scene checkpoint',async()=>{
 await seed('harness')
 const {normalizeMoments}=await import('./moment-plan')
 creative.mockImplementation(async(project,scene,selection)=>{const record={projectId:project.id,sceneId:scene.id,id:'accepted-'+scene.id,inputKey:scene.planKey,selection,treatment:{},moments:normalizeMoments({moments:[{id:'semantic-'+scene.id,title:'Explain',lines:'A request spends one token.',seconds:4,camera:'none',layout:'corner',overlay:scene.slideId==='a'?'title-card':null,cue:'Explain'}]},scene.id,'off',scene.slideId==='a'?'title':'ending')};await writeRow('creative-scenes',scene.id,record);return record})
 await makeVideo('harness',{presence:'off',voice:{kind:'ai',id:'default'},harness:{adapter:'kimi',model:'kimi-code/k3'}})
 await vi.waitFor(async()=>expect((await loadProject('harness'))!.project.video!.scenes.every(scene=>scene.phase==='waiting')).toBe(true))
 const saved=(await loadProject('harness'))!
 expect(saved.project.video!.settings.harness).toEqual({adapter:'kimi',model:'kimi-code/k3'})
 expect(saved.project.video!.scenes[0].creativePlan?.recordId).toBe('accepted-scene-a')
 expect(generate).not.toHaveBeenCalled()
 const {loadStageCheckpoint}=await import('./artifacts')
 expect((await loadStageCheckpoint<any>('harness','scene-a','planning',saved.project.video!.scenes[0].planKey!))?.data.creativePlan?.recordId).toBe('accepted-scene-a')
})

it('rejects a chat time outside its selected moment without launching a replan',async()=>{
 await seed('wrong-anchor');await makeVideo('wrong-anchor',{presence:'off',voice:{kind:'ai',id:'default'}})
 await vi.waitFor(async()=>expect((await loadProject('wrong-anchor'))!.project.video!.scenes.every(scene=>scene.phase==='waiting')).toBe(true))
 const before=(await loadProject('wrong-anchor'))!,scene=before.project.video!.scenes[0],calls=generate.mock.calls.length
 await expect(chatVideo('wrong-anchor',{anchor:{stage:'video',sceneId:scene.id,momentId:scene.moments[1].id,second:1},instruction:'Move this moment'})).rejects.toThrow('Choose a moment')
 expect(generate).toHaveBeenCalledTimes(calls)
 expect((await loadProject('wrong-anchor'))!.events).toEqual(before.events)
})

it('saves the creative plan without a separate preview code-generation pass',async()=>{
 await seed('single-generation')
 await changeProject('single-generation',current=>{current.project.video={settings:{presence:'off',voice:{kind:'ai',id:'default'},harness:{adapter:'kimi'}},scenes:[],transitions:[],inputKey:'',produced:null};reconcileVideo(current.project)})
 const {normalizeMoments}=await import('./moment-plan')
 creative.mockImplementation(async(project,scene,selection)=>{
  const record={projectId:project.id,sceneId:scene.id,id:'accepted-single-generation',inputKey:scene.planKey,selection,treatment:{},moments:normalizeMoments({moments:[{id:'opening',title:'Opening',lines:'A request spends one token.',seconds:4,camera:'none',layout:'corner',overlay:'title-card',cue:'Explain'}]},scene.id,'off','title')}
  await writeRow('creative-scenes',scene.id,record);return record
 })
 await planScene('single-generation','scene-a')
 const scene=(await loadProject('single-generation'))!.project.video!.scenes[0]
 expect(scene.phase).toBe('waiting')
 expect(scene.moments[0].lines).toBe('A request spends one token.')
 expect(scene.creativePlan?.recordId).toBe('accepted-single-generation')
 expect(scene.preview).toBeUndefined()
 const {loadStageCheckpoint}=await import('./artifacts')
 expect((await loadStageCheckpoint<any>('single-generation','scene-a','planning',scene.planKey!))?.data.moments).toHaveLength(1)
})

it('limits a scene camera override to that scene and supports returning to the notebook default',async()=>{
 await seed('scoped-presence')
 await changeProject('scoped-presence',s=>{s.project.video={settings:{presence:'off',voice:{kind:'ai',id:'default'}},scenes:[],transitions:[],inputKey:'',produced:null};reconcileVideo(s.project);s.project.video.scenes[1].planKey='historical-plan';refreshVideoKeys(s.project)})
 const before=(await loadProject('scoped-presence'))!.project.video!.scenes[1]
 await replanPresence('scoped-presence','scene-a','high')
 await vi.waitFor(async()=>expect((await loadProject('scoped-presence'))!.project.video!.scenes[0].phase).toBe('waiting'))
 expect(generate).toHaveBeenCalledTimes(1)
 const after=(await loadProject('scoped-presence'))!.project.video!
 expect(after.scenes[1]).toEqual(before);expect(after.scenes[0].presence).toBe('high')
 await replanPresence('scoped-presence','scene-a',null)
 await vi.waitFor(async()=>expect((await loadProject('scoped-presence'))!.project.video!.scenes[0].phase).toBe('waiting'))
 expect((await loadProject('scoped-presence'))!.project.video!.scenes[0].presence).toBeNull()
 expect(generate).toHaveBeenCalledTimes(2)
})

 it('rejects duplicate camera changes while a planning request is in flight',async()=>{
 await seed('duplicate-presence')
 await changeProject('duplicate-presence',s=>{s.project.video={settings:{presence:'off',voice:{kind:'ai',id:'default'}},scenes:[],transitions:[],inputKey:'',produced:null};reconcileVideo(s.project)})
 let release!:(value:unknown)=>void
 generate.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
 const results=await Promise.allSettled([replanPresence('duplicate-presence','scene-a','high'),replanPresence('duplicate-presence','scene-a','low')])
 expect(results.map(result=>result.status)).toEqual(['fulfilled','rejected'])
 await vi.waitFor(()=>expect(generate).toHaveBeenCalledTimes(1))
 const pending=(await loadProject('duplicate-presence'))!
 expect(pending.project.video!.scenes[0].presence).toBe('high')
 expect(pending.events.filter(event=>event.message==='Re-planning this scene')).toHaveLength(1)
 release(response('role title On camera high'))
 await vi.waitFor(async()=>expect((await loadProject('duplicate-presence'))!.project.video!.scenes[0].phase).toBe('waiting'))
 expect(generate).toHaveBeenCalledTimes(1)
 })
 it('keeps an active render intact when a camera-setting request arrives',async()=>{
 await seed('render-presence')
 await changeProject('render-presence',s=>{s.project.video={settings:{presence:'off',voice:{kind:'ai',id:'default'}},scenes:[],transitions:[],inputKey:'',produced:null};reconcileVideo(s.project);s.project.video.scenes[0].phase='producing'})
 const before=(await loadProject('render-presence'))!
 await expect(replanPresence('render-presence','scene-a','high')).rejects.toThrow('Wait for this scene')
 expect((await loadProject('render-presence'))!.project).toEqual(before.project)
 expect(generate).not.toHaveBeenCalled()
 })
it('refuses a global settings change during production without queuing another plan',async()=>{
 await seed('busy-settings')
 const saved=(await loadProject('busy-settings'))!
 saved.project.video={settings:{presence:'off',voice:{kind:'ai',id:'default'}},scenes:[],transitions:[],inputKey:'',produced:null}
 reconcileVideo(saved.project);saved.project.video.scenes[0].phase='producing'
 await writeRow('projects','busy-settings',saved)
 await expect(updateVideoSettings('busy-settings',{presence:'high',voice:{kind:'ai',id:'default'}})).rejects.toThrow('active scene work')
 const after=(await loadProject('busy-settings'))!
 expect(after.project.video?.settings).toEqual(saved.project.video.settings)
 expect(after.project.video?.scenes[0].phase).toBe('producing')
 expect(generate).not.toHaveBeenCalled()
})
