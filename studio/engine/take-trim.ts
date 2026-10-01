import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import type {ChatAnchor} from '../shared/model'
import {loadProject,changeProject,addEvent} from './projects'
import {readAsset,storeAsset,writeRow} from './persistence'
import {composeTakes,pictureSize} from './take-clock'
import {refreshVideoKeys} from './scene-model'

/** Only an explicit, whole-message edit is executed without creative planning. */
export function takeTrimRange(instruction:string):{from:number;to:number}|null {
 const match=instruction.trim().match(/^(?:please\s+)?trim\s+(?:(?:this|my|the)\s+)?take\s+(?:from|to)\s+(\d+(?:\.\d+)?)\s*(?:s|seconds)?\s*(?:to|through|[-–—])\s*(\d+(?:\.\d+)?)\s*(?:s|seconds)?[.!]?$/i)
 return match?{from:Number(match[1]),to:Number(match[2])}:null
}
export async function trimTake(id:string,anchor:Extract<ChatAnchor,{stage:'video'}>,range:{from:number;to:number},instruction:string){
 const before=await loadProject(id)
 const scene=before?.project.video?.scenes.find(entry=>entry.id===anchor.sceneId)
 const moment=scene?.moments.find(entry=>entry.id===anchor.momentId)
 if(!scene || !moment || !Number.isFinite(anchor.second) || anchor.second<moment.start || anchor.second>moment.end)throw new Error('Choose a moment in this scene')
 if(!['waiting','produced','failed'].includes(scene.phase))throw new Error('Wait for this scene to finish changing')
 const take=moment.take
 if(!take || take.recordingKey!==moment.recordingKey)throw new Error('Record this moment before trimming its take')
 if(!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.from<0 || range.to-range.from<.4 || !take.duration || range.to>take.duration)throw new Error(`Keep at least 0.4 seconds within this take (${take.duration?.toFixed(2) || 'unknown'} seconds).`)
 const temporary=await mkdtemp(join(tmpdir(),'studio-trim-take-'))
 try{
  const input=join(temporary,'input.webm'),output=join(temporary,'trimmed.webm')
  await writeFile(input,await readAsset(take.objectKey))
  const size=await pictureSize(input)
  const duration=await composeTakes([{path:input,...range}],output,size)
  const asset=await storeAsset({body:await readFile(output),contentType:size?'video/webm':'audio/webm',projectId:id,sceneId:scene.id,momentId:moment.id,kind:'moment-take',extension:'.webm'})
  const trimmed={id:randomUUID(),...(take.number?{number:take.number}:{}),recordingKey:take.recordingKey,objectKey:asset.objectKey,duration}
  await writeRow('takes',trimmed.id,{...trimmed,projectId:id,sceneId:scene.id,momentId:moment.id,parentTakeId:take.id,trim:range,recordedAt:new Date().toISOString()})
  return await changeProject(id,current=>{
   const target=current.project.video?.scenes.find(entry=>entry.id===scene.id)
   const selected=target?.moments.find(entry=>entry.id===moment.id)
   if(!target || !selected || selected.take?.id!==take.id || selected.recordingKey!==take.recordingKey || !['waiting','produced','failed'].includes(target.phase))throw new Error('This moment changed while trimming. Your current take was kept.')
   selected.take=trimmed;target.phase='waiting';target.error=null;delete target.failure
   target.produced=null;current.project.video!.produced=null
   refreshVideoKeys(current.project)
   addEvent(current,'chat',instruction,{sceneId:scene.id,anchor})
   addEvent(current,'chat',`Take trimmed to ${range.from.toFixed(2)}–${range.to.toFixed(2)} seconds. The original recording is kept; finish this scene to use the trimmed take.`,{sceneId:scene.id,anchor})
  })
 }finally{await rm(temporary,{recursive:true,force:true})}
}
