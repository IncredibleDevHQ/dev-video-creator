import {vi as mocker} from 'vitest'
mocker.mock('./cast-packet',()=>({prepareCastPacket:mocker.fn(async()=>({visualCast:{status:'synthetic-fixture'},media:{},assets:[],assetKeys:[]}))}))
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterAll,beforeEach,expect,it,vi} from 'vitest'
import type {Project} from '../../shared/model'
import type {CreativeSceneRecord} from './scene'
const {run,verify,render}=vi.hoisted(()=>({run:vi.fn(),verify:vi.fn(),render:vi.fn()}))
vi.mock('../harness/runtime',()=>({runEngineStage:run}))
vi.mock('./sketch-runtime',()=>({verifySketchRuntime:verify}))
vi.mock('../../render/production-render',()=>({renderProductionBundle:render}))
// Protocol fixture: static validator and runtime output are controlled here;
// the separate live runtime tests exercise actual browser validation.
vi.mock('./sketch-bundle',()=>({validateSketch:()=>({ok:true,problems:[],warnings:[],manifest:{version:1,composition:{id:'fixture',duration:2,fps:30,width:640,height:360},moments:[{id:'m1',start:0,end:2}],layers:[],provisional:['estimated timing']}})}))
const root=await mkdtemp(join(tmpdir(),'studio-preview-protocol-'))
process.env.MINIMAL_STUDIO_DATA_DIR=join(root,'store')
const {prepareCreativePreview}=await import('./preview')
const {listNotebookRows,readRow,readAsset}=await import('../persistence')
const {loadStageCheckpoint}=await import('../artifacts')
const {fingerprintOf}=await import('../planning/fingerprint')
const project=(id:string):Project=>({id,title:'Explicit protocol fixture',source:'Synthetic text',slides:[{id:'slide',title:'Fixture',svg:'<svg/>'}],video:null})
const record=(id:string):CreativeSceneRecord=>({id:'plan-'+id,projectId:id,sceneId:'scene-slide',inputKey:'plan-key',selection:{adapter:'kimi',model:'fixture-model'},treatment:{moments:[{id:'m1'}]} as CreativeSceneRecord['treatment'],moments:[],createdAt:new Date().toISOString()})
const proof={version:1,bundle:'fixture-hash',runtime:'0.7.106',checkedAt:new Date().toISOString(),duration:2,timeline:{duration:2,tweens:1},loaded:[],frames:[],reseeks:[{at:1,same:true}],layers:[],changes:[]}
beforeEach(()=>{
 vi.clearAllMocks();render.mockResolvedValue(Buffer.from('Synthetic MP4 protocol bytes'))
 run.mockImplementation(async(input)=>{
  const dir=join(root,input.projectId);await mkdir(join(dir,'sketch/assets'),{recursive:true})
  await writeFile(join(dir,'sketch/index.html'),'Explicit synthetic composition fixture')
  await writeFile(join(dir,'sketch/manifest.json'),'{}')
  await writeFile(join(dir,'sketch/assets/presenter.jpg'),await readFile(new URL('../../app/assets/presenter.jpg',import.meta.url)))
  const result=await input.tools(dir)[0].call({projectDir:dir})
  return{status:result.accepted?'done':'error',failure:{message:result.problems?.join('; ')}}
 })
})
afterAll(()=>rm(root,{recursive:true,force:true}))
it('archives a candidate and its runtime refusal instead of showing it as ready',async()=>{
 verify.mockResolvedValue({problems:['Layer never shows'],warnings:[],proof:null})
 await expect(prepareCreativePreview(project('refused'),record('refused'),'http://fixture')).rejects.toThrow('Layer never shows')
 expect(render).not.toHaveBeenCalled()
 const ids=await listNotebookRows('creative-preview-attempts','refused');expect(ids).toHaveLength(1)
 const attempt=await readRow<any>('creative-preview-attempts',ids[0]);expect(attempt.accepted).toBe(false);expect(attempt.runtime.proof).toBeNull()
 expect((await readAsset(attempt.artifacts.find((ref:any)=>ref.name==='index.html').objectKey)).toString()).toContain('synthetic')
})
it('keeps acceptance, runtime proof and preview media reusable after a worker restart',async()=>{
 verify.mockResolvedValue({problems:[],warnings:[],proof})
 const p=project('accepted'),r=record('accepted')
 const preview=await prepareCreativePreview(p,r,'http://fixture')
 expect(preview.proof).toEqual(proof);expect(await readAsset(preview.objectKey)).toEqual(Buffer.from('Synthetic MP4 protocol bytes'))
 const inputKey=fingerprintOf({plan:r.id,treatment:r.treatment,script:[],branding:p.branding})
 expect((await loadStageCheckpoint<any>(p.id,r.sceneId,'creative-preview',inputKey))?.data.proof).toEqual(proof)
 expect(await prepareCreativePreview(p,r,'http://fixture')).toEqual(preview)
 expect(run).toHaveBeenCalledOnce();expect(render).toHaveBeenCalledOnce()
})

it('passes accepted presenter staging to previews and invalidates cached media when it changes',async()=>{
 verify.mockResolvedValue({problems:[],warnings:[],proof})
 const p=project('staging'),r=record('staging')
 r.moments=[{id:'m1',title:'Explain',lines:'Exact accepted words.',plannedSeconds:4,start:0,end:4,camera:'full',layout:'corner',overlay:'lower-third',recordingKey:'take-input',take:null,audio:null,audioKey:'audio-input'}]
 const first=await prepareCreativePreview(p,r,'http://fixture')
 expect(JSON.parse(run.mock.calls[0][0].packet['packet/SCRIPT.json']).moments[0]).toMatchObject({id:'m1',lines:'Exact accepted words.',camera:'full',layout:'corner',overlay:'lower-third',seconds:4})
 r.moments[0].layout='beside-slide'
 const second=await prepareCreativePreview(p,r,'http://fixture')
 expect(second.inputKey).not.toBe(first.inputKey)
 expect(run).toHaveBeenCalledTimes(2)
 expect(JSON.parse(run.mock.calls[1][0].packet['packet/SCRIPT.json']).moments[0].layout).toBe('beside-slide')
})
