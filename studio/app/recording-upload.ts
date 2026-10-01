import type {RecordedPart,Snapshot} from '../shared/api'
import {requestJson} from './http'

/** Bound one upload attempt. Keep the browser take on failure; never retry a PUT. */
export async function uploadRecording(id:string,sceneId:string,parts:RecordedPart[],blob:Blob):Promise<Snapshot>{
 const controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),120000)
 try{
  return await requestJson<Snapshot>(`/api/projects/${id}/scenes/${sceneId}/recordings`,{
   method:'PUT',signal:controller.signal,
   headers:{'Content-Type':blob.type,'X-Studio-Parts':JSON.stringify(parts)},body:blob,
  })
 }catch(reason){
  if(controller.signal.aborted)throw new Error('Saving took too long to confirm. Your take is still here. Check this scene before saving again.')
  throw reason
 }finally{clearTimeout(timer)}
}
