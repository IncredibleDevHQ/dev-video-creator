import { mkdtemp,rm,readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll,beforeEach,expect,it,vi } from 'vitest'
import {generationStops} from './generation-errors'
import type { Snapshot } from '../shared/api'
const {render,audio,bundle,joinVideo,creative} = vi.hoisted(() => ({render:vi.fn(),audio:vi.fn(),bundle:vi.fn(),joinVideo:vi.fn(),creative:vi.fn()}))
vi.mock('./animation',async original=>({...await original<typeof import('./animation')>(),finishSceneAnimation:vi.fn(async()=>Buffer.from('synthetic final scene'))}))
vi.mock('./creative/production',()=>({buildCreativeProduction:creative}))
vi.mock('../render/production-render',() => ({renderProductionBundle:render}))
vi.mock('./scene-audio',() => ({prepareMomentAudio:audio}))
vi.mock('../render/scene',() => ({buildSceneBundle:bundle}))
vi.mock('../render/join',() => ({joinScenes:joinVideo}))
const root = await mkdtemp(join(tmpdir(),'minimal-production-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { loadProject,changeProject } = await import('./projects')
const { refreshVideoKeys } = await import('./scene-model')
const { produceScene } = await import('./production')
const { produceVideo,updateTransition } = await import('./video-export')
const seed = async (id: string,produced=false) => {
  const snapshot: Snapshot = {project:{id,title:'Fixture',source:'Fixture',slides:['a','b'].map(id => ({id,title:id,svg:'<svg/>'})),video:{settings:{presence:'off',voice:{kind:'ai',id:'default'}},transitions:['none'],inputKey:'',produced:null,scenes:['a','b'].map(id => ({id:`scene-${id}`,slideId:id,phase:'waiting',presence:null,inputKey:'',produced:null,error:null,moments:[{id:`moment-${id}`,lines:'Fixture.',start:0,end:2,camera:'none',layout:'corner',overlay:null,recordingKey:'recording',take:null,audio:null,audioKey:''}]}))}},status:'ready',events:[],error:null}
  refreshVideoKeys(snapshot.project)
  if (produced) for (const scene of snapshot.project.video!.scenes) {scene.phase='produced';scene.produced={inputKey:scene.inputKey,objectKey:`${scene.id}.mp4`}}
  await writeRow('projects',id,snapshot)
}
beforeEach(() => {render.mockReset();joinVideo.mockReset();audio.mockImplementation((_p,_s,moment) => Promise.resolve(moment));bundle.mockResolvedValue({'index.html':'fixture'})})
afterAll(() => rm(root,{recursive:true,force:true}))
it('discards a render when its inputs change while rendering',async () => {
  await seed('race')
  let release!: (bytes: Buffer) => void
  render.mockImplementation(() => new Promise(resolve => {release=resolve}))
  await produceScene('race','scene-a')
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  await changeProject('race',current => {const scene=current.project.video!.scenes[0];scene.moments[0].lines='Updated.';scene.phase='waiting';refreshVideoKeys(current.project)})
  release(Buffer.from('old fixture'))
  await vi.waitFor(async () => expect((await loadProject('race'))!.project.video!.scenes[0].phase).toBe('waiting'))
  await vi.waitFor(async () => expect(await readdir(join(root,'renders'))).toHaveLength(1))
  await changeProject('race',() => {})
  expect((await loadProject('race'))!.project.video!.scenes[0].produced).toBeNull()
})
it('publishes a render only for current inputs',async () => {
  await seed('success');render.mockResolvedValue(Buffer.from('synthetic MP4 fixture'))
  await produceScene('success','scene-a')
  await vi.waitFor(async () => expect((await loadProject('success'))!.views!.scenes['scene-a'].produced).toBe(true))
  const scene=(await loadProject('success'))!.project.video!.scenes[0]
  expect(scene.produced!.inputKey).toBe(scene.inputKey)
  const messages=(await loadProject('success'))!.events.filter(event=>event.sceneId==='scene-a').map(event=>event.message)
  expect(messages).toEqual(['Producing','Preparing voice · moment 1 of 1','Building the scene','Rendering the scene','Saving the scene','Produced'])
})
it('keeps export disabled until every scene is produced',async () => {
  await seed('unfinished')
  await expect(produceVideo('unfinished')).rejects.toThrow('Produce every scene first')
  expect(joinVideo).not.toHaveBeenCalled()
})
it('does not publish a join made for old transitions',async () => {
  await seed('join-race',true)
  let release!: (bytes: Buffer) => void
  joinVideo.mockImplementation(() => new Promise(resolve => {release=resolve}))
  await produceVideo('join-race')
  await updateTransition('join-race',0,'crossfade')
  release(Buffer.from('old joined fixture'))
  await vi.waitFor(async () => expect((await loadProject('join-race'))!.project.video!.phase).toBe('idle'))
  expect((await loadProject('join-race'))!.project.video!.produced).toBeNull()
})

it('resumes a saved composition and render without rebuilding or rendering them',async()=>{
 await seed('render-checkpoint');render.mockResolvedValue(Buffer.from('Synthetic checkpoint bytes'))
 await produceScene('render-checkpoint','scene-a')
 await vi.waitFor(async()=>expect((await loadProject('render-checkpoint'))!.project.video!.scenes[0].phase).toBe('produced'))
 const key=(await loadProject('render-checkpoint'))!.project.video!.scenes[0].produced!.objectKey
 await changeProject('render-checkpoint',saved=>{const scene=saved.project.video!.scenes[0];scene.phase='failed';scene.failure='production';scene.produced=null})
 render.mockClear();bundle.mockClear();render.mockRejectedValue(new Error('Should reuse the stored render'))
 await produceScene('render-checkpoint','scene-a')
 await vi.waitFor(async()=>expect((await loadProject('render-checkpoint'))!.project.video!.scenes[0].phase).toBe('produced'))
 expect((await loadProject('render-checkpoint'))!.project.video!.scenes[0].produced!.objectKey).toBe(key)
 expect(render).not.toHaveBeenCalled();expect(bundle).not.toHaveBeenCalled()
})

it('uses a saved creative treatment to build the scene instead of the slide renderer',async()=>{
 await seed('creative')
 await changeProject('creative',current=>{current.project.video!.scenes[0].creativePlan={recordId:'accepted-treatment',inputKey:current.project.video!.scenes[0].planKey || 'fixture'};refreshVideoKeys(current.project)})
 creative.mockResolvedValue({'index.html':'creative composition'})
 render.mockResolvedValue(Buffer.from('synthetic render'))
 await produceScene('creative','scene-a')
 await vi.waitFor(async()=>expect((await loadProject('creative'))!.project.video!.scenes[0].phase).toBe('produced'))
 expect(creative).toHaveBeenCalledOnce()
 expect(bundle).not.toHaveBeenCalled()
 expect(render.mock.calls[0][0]['index.html']).toBe('creative composition')
})


it('reports budget stops without losing other scenes',async()=>{
 await seed('bounded-render')
 render.mockRejectedValue(new Error(generationStops.time))
 await produceScene('bounded-render','scene-a')
 await vi.waitFor(async()=>expect((await loadProject('bounded-render'))!.project.video!.scenes[0].phase).toBe('failed'))
 const scenes=(await loadProject('bounded-render'))!.project.video!.scenes
 expect(scenes[0].error).toBe(generationStops.time)
 expect(scenes[0].failure).toBe('production')
 expect(scenes[1].phase).toBe('waiting')
 expect(render).toHaveBeenCalledOnce()
})

it('prepares animation before recording and reuses it after a take arrives',async()=>{
 await seed('animation-before-take')
 await changeProject('animation-before-take',current=>{
  const scene=current.project.video!.scenes[0]
  scene.creativePlan={recordId:'accepted-treatment',inputKey:scene.planKey || 'fixture'}
  scene.moments[0].camera='full';scene.moments[0].plannedSeconds=2;refreshVideoKeys(current.project)
 })
 creative.mockClear();creative.mockResolvedValue({'index.html':'synthetic animation source'})
 render.mockResolvedValue(Buffer.from('synthetic animation bytes'))
 await produceScene('animation-before-take','scene-a')
 await vi.waitFor(async()=>expect((await loadProject('animation-before-take'))!.project.video!.scenes[0].animation).toBeDefined())
 let snapshot=(await loadProject('animation-before-take'))!
 expect(snapshot.project.video!.scenes[0].phase).toBe('waiting')
 expect(snapshot.views!.scenes['scene-a'].action).toBe('record')
 expect(snapshot.views!.scenes['scene-a'].produced).toBe(false)
 expect(snapshot.project.video!.scenes[1].phase).toBe('waiting')
 const animationKey=snapshot.project.video!.scenes[0].animation!.inputKey
 await changeProject('animation-before-take',current=>{const scene=current.project.video!.scenes[0];scene.moments[0].take={id:'real-take',objectKey:'fixture.webm',recordingKey:'recording',duration:3};refreshVideoKeys(current.project)})
 expect((await loadProject('animation-before-take'))!.project.video!.scenes[0].animationKey).toBe(animationKey)
 await produceScene('animation-before-take','scene-a')
 await vi.waitFor(async()=>expect((await loadProject('animation-before-take'))!.views!.scenes['scene-a'].produced).toBe(true))
 expect(creative).toHaveBeenCalledTimes(1)
 expect(render).toHaveBeenCalledTimes(1)
})

it('prepares the next scene even when an earlier scene still needs recording',async()=>{
 await seed('prepare-all')
 await changeProject('prepare-all',current=>{
  for(const scene of current.project.video!.scenes){scene.creativePlan={recordId:`accepted-${scene.id}`,inputKey:scene.planKey || 'fixture'};scene.moments[0].camera='full';scene.moments[0].plannedSeconds=2}
  refreshVideoKeys(current.project)
 })
 creative.mockClear();creative.mockResolvedValue({'index.html':'synthetic animation'})
 render.mockResolvedValue(Buffer.from('synthetic rendered animation'))
 await produceVideo('prepare-all')
 await vi.waitFor(async()=>expect((await loadProject('prepare-all'))!.project.video!.phase).toBe('idle'))
 const snapshot=(await loadProject('prepare-all'))!
 expect(snapshot.project.video!.scenes.every(s=>s.animation && s.phase==='waiting')).toBe(true)
 expect(Object.values(snapshot.views!.scenes).every(s=>s.action==='record' && !s.produced)).toBe(true)
 expect(creative).toHaveBeenCalledTimes(2)
 expect(joinVideo).not.toHaveBeenCalled()
})

it('stops a preparation batch at a shared harness limit instead of charging later scenes',async()=>{
 await seed('prepare-quota')
 await changeProject('prepare-quota',current=>{
  for(const scene of current.project.video!.scenes)scene.creativePlan={recordId:`accepted-${scene.id}`,inputKey:scene.planKey || 'fixture'}
  refreshVideoKeys(current.project)
 })
 const {HarnessStageError}=await import('./generation-errors')
 creative.mockClear();creative.mockRejectedValue(new HarnessStageError({category:'quota',message:'Fixture quota limit',harness:'fixture',at:new Date().toISOString(),recovery:[]},'Quota'))
 await produceVideo('prepare-quota')
 await vi.waitFor(async()=>expect((await loadProject('prepare-quota'))!.project.video!.phase).toBe('failed'))
 const video=(await loadProject('prepare-quota'))!.project.video!
 expect(video.scenes[0].phase).toBe('failed');expect(video.scenes[1].phase).toBe('waiting')
 expect(video.error).toContain('usage limit');expect(creative).toHaveBeenCalledOnce()
})
