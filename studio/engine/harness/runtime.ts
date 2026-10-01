import {generationStops} from '../generation-errors'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dataRoot, readRow, writeRow, listRows } from '../persistence'
import { createClaudeCodeAdapter } from './adapters/claude-code'
import { createCodexAdapter } from './adapters/codex'
import { createKimiAdapter } from './adapters/kimi'
import { installSkills } from './skills-install'
import {archiveFiles} from '../artifacts'
import type {SketchFiles} from '../../render/types'
import {registerSubmissions,type EngineTool} from './submissions'
import { describeFailure } from './provider-errors'
import type { HarnessAdapter, HarnessContext, HarnessEvent, RunFailure } from './types'

export type HarnessId = HarnessAdapter['id']
export type HarnessStage = 'story' | 'drawing' | 'planning' | 'composition'
export type EngineRun = {
  id: string; projectId: string; sceneId?: string; stage: HarnessStage; adapter: HarnessId
  status: 'preparing' | 'running' | 'done' | 'error' | 'cancelled'
  model?: string; effort?:'low'|'medium'|'high'|'xhigh'|'max'; reportedModel?: string; resumeId?: string
  usage?:import('../../shared/usage').TokenUsage
  startedAt: string; finishedAt?: string; failure?: RunFailure; events: HarnessEvent[]
}
const skills: Record<HarnessStage,string> = {story:'story-master',drawing:'page-master',planning:'video-planner',composition:'scene-producer'}
export const createAdapters = (context: HarnessContext): HarnessAdapter[] => [createClaudeCodeAdapter(context),createCodexAdapter(context),createKimiAdapter(context)]
export const inspectHarnesses = async (context: HarnessContext) => Promise.all(createAdapters(context).map(async adapter => ({id:adapter.id,...await adapter.available(),models:await adapter.models?.()})))
const active = new Map<string,AbortController>()
let shuttingDown=false
export const stopEngineRuns = async (timeoutMs=8000) => {
  shuttingDown=true
  for(const controller of active.values()) controller.abort()
  const deadline=Date.now()+timeoutMs
  while(active.size && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,25))
  return active.size===0
}
export const cancelEngineRun = (id:string) => { const controller=active.get(id);if(!controller) return false;controller.abort();return true }
export const readEngineRun = (id:string) => readRow<EngineRun>('engine-runs',id)
const validId = (id:string) => /^[a-zA-Z0-9_-]+$/.test(id)
const packetPath = (name:string) => /^(?:packet|media)\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(name) && !name.split('/').some(part => part==='.' || part==='..')
/** A model exit is not acceptance: the owning stage validates its submission. */
export const runEngineStage = async (input: {
  projectId:string;sceneId?:string;stage:HarnessStage;adapter:HarnessId;model?:string;effort?:'low'|'medium'|'high'|'xhigh'|'max';task:string
  productionSeed?:Record<string,string|Buffer>;packet:Record<string,string|Buffer>;context:HarnessContext;tools?:(directory:string)=>EngineTool[];route?:string;stageContext?:unknown
  accept:(directory:string)=>Promise<void>;onEvent?:(event:HarnessEvent)=>Promise<void>|void
  observe?:(directory:string)=>Promise<void>;adapterOverride?:HarnessAdapter;timeoutMs?:number;idleTimeoutMs?:number;maxToolCalls?:number;redact?:string[]
}):Promise<EngineRun> => {
  if(!input.sceneId && (await readRow<{stopping?:boolean}>('projects',input.projectId))?.stopping) throw new Error(generationStops.user)
  if(shuttingDown) throw new Error('The studio is shutting down; no new model requests can start')
  if(process.env.VITEST && !input.adapterOverride && process.env.MINIMAL_STUDIO_ALLOW_LIVE_HARNESS!=='1') throw new Error('Unit tests must not launch a paid harness')
  if(!validId(input.projectId) || input.sceneId && !validId(input.sceneId)) throw new Error('Invalid project or scene')
  if(!Object.hasOwn(skills,input.stage)) throw new Error('Invalid engine stage')
  // Refuse escaping packets before creating files or launching a model.
  for(const name of Object.keys(input.packet)) if(!packetPath(name)) throw new Error('Invalid packet file')
  for(const name of Object.keys(input.productionSeed || {})) if(input.stage!=='composition' || !name.startsWith('production/') || !packetPath(name.replace(/^production\//,'packet/'))) throw new Error('Invalid production seed file')
  const adapter=input.adapterOverride || createAdapters(input.context).find(adapter => adapter.id===input.adapter)
  if(!adapter || adapter.id!==input.adapter) throw new Error('Choose a harness')
  const id=randomUUID();const directory=join(dataRoot,'engine-workspaces',input.projectId,id)
  const record:EngineRun={id,projectId:input.projectId,sceneId:input.sceneId,stage:input.stage,adapter:input.adapter,model:input.model,effort:input.effort,status:'preparing',startedAt:new Date().toISOString(),events:[]}
  await writeRow('engine-runs',id,record)
  const controller=new AbortController();active.set(id,controller)
  if(shuttingDown) controller.abort()
  let limitReason='',toolCalls=0,acceptedSubmission=false
  const stopForLimit=(reason:string)=>{if(controller.signal.aborted) return;limitReason=reason;controller.abort()}
  const timer=setTimeout(() => stopForLimit(generationStops.time),Math.min(input.timeoutMs ?? 10*60*1000,10*60*1000));timer.unref()
  const idleTimer=setTimeout(()=>stopForLimit(generationStops.idle),input.idleTimeoutMs ?? 3*60*1000);idleTimer.unref()
  let queue=Promise.resolve();let reportedError='';let progressFailure:Error|null=null
  let submissions:ReturnType<typeof registerSubmissions>|null=null
  let observer:ReturnType<typeof setInterval>|undefined;let observing=Promise.resolve();let observerBusy=false
  let archived=false
  const archive=async()=>{
    if(archived) return
    const files:SketchFiles={}
    const walk=async(relative:string)=>{
      const entries=await readdir(join(directory,relative),{withFileTypes:true}).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT') return [];throw error})
      for(const entry of entries) {const name=`${relative}/${entry.name}`;if(entry.isDirectory()) await walk(name);else if(entry.isFile()) files[name]={base64:(await readFile(join(directory,name))).toString('base64'),contentType:'application/octet-stream'}}
    }
    // CLI authentication/configuration stays private. Only product inputs and
    // stage outputs are notebook artifacts, including failed candidates.
    for(const folder of ['packet','media','story','pages','production','plan','planning','sketch']) await walk(folder)
    const routeInput=await readFile(join(directory,'motion','inputs.json')).catch(()=>null)
    if(routeInput) files['motion/inputs.json']={base64:routeInput.toString('base64'),contentType:'application/json'}
    const artifacts=await archiveFiles(input.projectId,input.sceneId,input.stage,files)
    await writeRow('engine-artifacts',id,{projectId:input.projectId,sceneId:input.sceneId,runId:id,stage:input.stage,artifacts})
    archived=true
  }
  const scrub=(text:string) => [...(input.redact || []),submissions?.token || ''].filter(Boolean).reduce((safe,secret) => safe.split(secret).join('[redacted]'),text).slice(0,4000)
  const emit=(event:HarnessEvent) => {
    if(controller.signal.aborted) return
    idleTimer.refresh()
    if(event.type==='tool' && ++toolCalls>(input.maxToolCalls ?? 80)) {stopForLimit(generationStops.tools);return}
    const safe=JSON.parse(JSON.stringify(event,(_key,value) => typeof value==='string'?scrub(value):value)) as HarnessEvent
    queue=queue.then(async () => {
      if(progressFailure) return
      if(safe.type==='usage' && safe.usage) record.usage=safe.usage
      if(safe.type==='session' && safe.model) record.reportedModel=safe.model
      if(safe.type==='error') reportedError=safe.error || 'The harness reported an error'
      record.events.push(safe);if(record.events.length>1000) record.events.shift()
      await writeRow('engine-runs',id,record);await input.onEvent?.(safe)
    }).catch(error=>{
      // Handle immediately: the CLI may keep running long after this write.
      progressFailure=error instanceof Error?error:new Error(String(error));controller.abort()
    })
  }
  try {
  if(!input.sceneId && (await readRow<{stopping?:boolean}>('projects',input.projectId))?.stopping) controller.abort()
    const available=await adapter.available();if(!available.ok) throw new Error(available.reason || 'Harness is not available')
    await mkdir(directory,{recursive:true,mode:0o700})
    await installSkills(input.context.skillsDir,directory,{only:input.stage==='composition'?['scene-producer','video-planner']:[skills[input.stage]]})
    for(const [name,body] of Object.entries({...input.packet,...input.productionSeed})) {
      const target=join(directory,name);await mkdir(join(target,'..'),{recursive:true,mode:0o700});await writeFile(target,body,{mode:0o600})
    }
    await mkdir(join(directory,'motion'),{recursive:true,mode:0o700})
    await writeFile(join(directory,'motion','inputs.json'),JSON.stringify({...(input.stageContext && typeof input.stageContext==='object'?input.stageContext:{}),route:input.route,stage:input.stage,runId:id,projectId:input.projectId,sceneId:input.sceneId,context:input.stageContext}),{mode:0o600})
    submissions=input.tools?registerSubmissions(directory,input.tools(directory).map(tool=>({...tool,call:async args=>{
      if(controller.signal.aborted) throw new Error('This run has stopped')
      const result=await tool.call(args)
      if(tool.completesRun && result && typeof result==='object' && (result as {accepted?:unknown}).accepted===true && !controller.signal.aborted) {
        acceptedSubmission=true;controller.abort()
      }
      return result
    }}))):null
    record.status='running';await writeRow('engine-runs',id,record)
    if(input.observe) observer=setInterval(()=>{
      if(observerBusy || controller.signal.aborted) return
      observerBusy=true
      observing=input.observe!(directory).catch(error=>{progressFailure=error;controller.abort()}).finally(()=>{observerBusy=false})
    },1000)
    if(controller.signal.aborted) throw new Error(limitReason || 'The engine run was interrupted')
    const result=await adapter.run({id,skill:skills[input.stage],projectDir:directory,inputs:{task:input.task,model:input.model,effort:input.effort,submissionToken:submissions?.token,capabilityScope:input.stage==='composition'?'production':input.stage==='planning'?'planning':undefined}},emit,controller.signal)
    clearInterval(observer);await observing;await input.observe?.(directory)
    await queue
    if(progressFailure) throw progressFailure
    record.resumeId=result.resumeId
    if(controller.signal.aborted && !acceptedSubmission) throw new Error(limitReason || 'The engine run was interrupted')
    if(!acceptedSubmission && (result.exitCode!==0 || reportedError)) throw new Error(reportedError || `The harness exited with ${result.exitCode}`)
    await archive()
    await input.accept(directory)
    record.status='done'
  } catch(error) {
    await queue.catch(() => {})
    let archiveFailed=false
    await archive().catch(()=>{archiveFailed=true})
    record.status=controller.signal.aborted && !progressFailure && !limitReason && !archiveFailed?'cancelled':'error'
    record.failure=describeFailure({message:archiveFailed?'Could not save run artifacts. Restore storage access before retrying.':scrub(error instanceof Error?error.message:String(error)),harness:input.adapter,requestedModel:input.model,reportedModel:record.reportedModel,...(progressFailure || archiveFailed)?{category:'storage' as const}:controller.signal.aborted?{category:'interrupted' as const}:{}})
  } finally {
    clearInterval(observer);await observing;submissions?.dispose();clearTimeout(timer);clearTimeout(idleTimer);record.finishedAt=new Date().toISOString();try{await writeRow('engine-runs',id,record)}finally{active.delete(id)}
  }
  return record
}
/** Restart never silently repeats a model request that may have spent credits. */
export const recoverEngineRuns = async () => {
  for(const id of await listRows('engine-runs')) {
    const record=await readEngineRun(id)
    if(!record || !['preparing','running'].includes(record.status) || active.has(id)) continue
    record.status='error';record.finishedAt=new Date().toISOString()
    record.failure=describeFailure({message:'The studio restarted before this run finished',harness:record.adapter,category:'interrupted',requestedModel:record.model,reportedModel:record.reportedModel})
    await writeRow('engine-runs',id,record)
  }
}
