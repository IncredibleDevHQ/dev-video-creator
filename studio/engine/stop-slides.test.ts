import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll,expect,it,vi} from 'vitest'
import type {Snapshot} from '../shared/api'
const {pages,cancel}=vi.hoisted(()=>({pages:vi.fn(),cancel:vi.fn()}))
vi.mock('./creative/pages',()=>({prepareCreativePages:pages}))
vi.mock('./harness/runtime',()=>({cancelEngineRun:cancel}))
const root=await mkdtemp(join(tmpdir(),'studio-stop-slides-'))
process.env.MINIMAL_STUDIO_DATA_DIR=root
const {writeRow}=await import('./persistence')
const {scheduleSlides,stopSlides,retrySlides,loadProject}=await import('./projects')
afterAll(()=>rm(root,{recursive:true,force:true}))
it('stops only this deck, retains arriving drafts and continues only after an explicit retry',async()=>{
 const id='stop-fixture',svg='<svg xmlns="http://www.w3.org/2000/svg"><text>Saved fixture</text></svg>'
 const snapshot:Snapshot={project:{id,title:'Fixture',source:'Fixture',slides:[],video:null,harness:{adapter:'kimi'}},status:'building',error:null,events:[]}
 await writeRow('projects',id,snapshot)
 await writeRow('outlines',id,{source:{},outline:{title:'Fixture',scenes:[{title:'One',narration:'Fixture',idea:'Fixture',source:[]}]},brand:{},slideIds:['slide-one']})
 for(const [runId,projectId,sceneId] of [['deck',id,undefined],['scene',id,'scene-one'],['other','other-notebook',undefined]]) await writeRow('engine-runs',runId!,{id:runId,projectId,sceneId,status:'running'})
 let finish!:(value:string[])=>void
 pages.mockImplementationOnce(async(input)=>{await input.onDraft(0,svg);return new Promise<string[]>(resolve=>{finish=resolve})})
 scheduleSlides(id)
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
 const stopping=await stopSlides(id)
 expect(stopping.stopping).toBe(true);expect(stopping.project.slides[0].svg).toBe(svg)
 expect(cancel.mock.calls).toEqual([['deck']])
 await expect(retrySlides(id)).rejects.toThrow('Wait for generation to stop')
 finish([svg])
 await vi.waitFor(async()=>expect((await loadProject(id))?.status).toBe('failed'))
 expect((await loadProject(id))?.error).toContain('Generation stopped')
 pages.mockResolvedValueOnce([svg])
 await retrySlides(id)
 await vi.waitFor(async()=>expect((await loadProject(id))?.status).toBe('ready'))
 expect((await loadProject(id))?.stopping).toBe(false)
 expect((await loadProject(id))?.project.slides).toHaveLength(1)
})
