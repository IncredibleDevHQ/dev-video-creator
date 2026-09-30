import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll,expect,it,vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { ScenePhase } from '../shared/model'
const { generate } = vi.hoisted(() => ({generate:vi.fn()}))
vi.mock('./creative/pages',()=>({prepareCreativePages:vi.fn(async(input:any)=>input.outline.scenes.map(()=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><text>Retained designed-page fixture</text></svg>'))}))
vi.mock('./model-gateway',() => ({modelFetch:generate}))
const root = await mkdtemp(join(tmpdir(),'minimal-recovery-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { recoverProjects } = await import('./recovery')
const { loadProject,scheduleSlides } = await import('./projects')
const { refreshVideoKeys } = await import('./scene-model')
const {readSourceNarrative,pageBrandFrom,sanitizeOutline} = await import('./source')
afterAll(() => rm(root,{recursive:true,force:true}))
const seed = async (id: string,phases: ScenePhase[],joining=false): Promise<Snapshot> => {
  const snapshot: Snapshot = {project:{id,title:'Fixture',source:'Fixture',slides:phases.map((_phase,index) => ({id:`slide-${index}`,title:'Fixture',svg:'<svg/>'})),video:{settings:{presence:'high',voice:{kind:'ai',id:'default'}},phase:joining?'joining':'idle',inputKey:'',transitions:phases.slice(1).map(() => 'none'),produced:null,scenes:phases.map((phase,index) => ({id:`scene-${index}`,slideId:`slide-${index}`,phase,presence:null,inputKey:'',planKey:'plan',error:null,produced:null,instructions:[{momentId:'moment',second:1,instruction:'Keep this change.'}],moments:[{id:'moment',lines:'Recorded fixture.',start:0,end:2,plannedSeconds:2,camera:'full',layout:'corner',overlay:null,recordingKey:'recording',take:{id:'saved-take',recordingKey:'recording',objectKey:'take.webm',duration:2},audioKey:'',audio:null}]}))}},status:'ready',error:null,events:[]}
  refreshVideoKeys(snapshot.project)
  for (const scene of snapshot.project.video!.scenes) if (scene.phase === 'produced') scene.produced={inputKey:scene.inputKey,objectKey:'scene.mp4'}
  await writeRow('projects',id,snapshot);return snapshot
}
const jobs = () => ({slides:vi.fn(),planning:vi.fn(),scene:vi.fn().mockResolvedValue(null),video:vi.fn().mockResolvedValue(null)})
it('resumes interrupted jobs and retains takes, instructions and finished renders',async () => {
  const original = await seed('mixed',['writing','replanning','changing','producing','produced','failed'])
  const run = jobs();await recoverProjects(run)
  const saved = (await loadProject('mixed'))!
  expect(saved.project.video!.scenes.map(scene => scene.phase)).toEqual(['queued','queued','queued','waiting','produced','failed'])
  expect(run.planning).toHaveBeenCalledWith('mixed')
  expect(run.scene).toHaveBeenCalledExactlyOnceWith('mixed','scene-3')
  for (const [index,scene] of saved.project.video!.scenes.entries()) {expect(scene.moments[0].take).toEqual(original.project.video!.scenes[index].moments[0].take);expect(scene.instructions).toEqual(original.project.video!.scenes[index].instructions)}
  expect(saved.project.video!.scenes[4].produced).toEqual(original.project.video!.scenes[4].produced)
  const again = jobs();await recoverProjects(again)
  expect(again.scene).not.toHaveBeenCalled()
  expect((await loadProject('mixed'))!.events).toEqual(saved.events)
})
it('resumes a join only when all current scene outputs exist',async () => {
  await seed('finished',['produced','produced'],true)
  await seed('unfinished',['produced','waiting'],true)
  const run=jobs();await recoverProjects(run)
  expect(run.video).toHaveBeenCalledExactlyOnceWith('finished')
  expect((await loadProject('unfinished'))!.project.video!.phase).toBe('idle')
})
it('resumes slide rendering from the saved outline and retained designed pages without duplicate slides',async () => {
  const source=readSourceNarrative('Requests spend a token. Empty buckets reject requests.')
  const outline=sanitizeOutline({title:'Tokens',scenes:[{title:'Tokens',kind:'title'},{title:'Requests',kind:'diagram'}]},'Tokens',source.text)
  await writeRow('outlines','slides',{source,outline,brand:pageBrandFrom(source.palette,source.fonts),slideIds:['first','second']})
  await writeRow('projects','slides',{project:{id:'slides',title:'Tokens',source:source.text,slides:[{id:'first',title:'Tokens',svg:'<svg id="preserved"/>'}],video:null},status:'building',error:null,events:[]})
  const run=jobs();run.slides.mockImplementation(scheduleSlides);await recoverProjects(run)
  await vi.waitFor(async () => expect((await loadProject('slides'))!.status).toBe('ready'))
  const saved=(await loadProject('slides'))!
  expect(saved.project.slides.map(slide => slide.id)).toEqual(['first','second'])
  expect(saved.project.slides[0].svg).toBe('<svg id="preserved"/>')
  expect(saved.project.slides[1].svg).toContain('<svg')
  expect(generate).not.toHaveBeenCalled()
  expect(saved.events.filter(event => event.message.startsWith('Slide '))).toHaveLength(1)
})

it('does not resume a stop request interrupted by a worker restart',async()=>{
 const saved=await seed('stopped-deck',[])
 saved.status='building';saved.stopping=true
 await writeRow('projects','stopped-deck',saved)
 const work=jobs();await recoverProjects(work)
 expect(work.slides).not.toHaveBeenCalledWith('stopped-deck')
 const result=await loadProject('stopped-deck')
 expect(result?.status).toBe('failed');expect(result?.stopping).toBe(true)
 expect(result?.error).toContain('Generation stopped')
})
