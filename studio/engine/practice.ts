import type {PracticeTrack,PracticeClip} from '../shared/practice'
import {loadProject} from './projects'
import {fingerprintOf} from './planning/fingerprint'
import {loadStageCheckpoint,saveStageCheckpoint} from './artifacts'
import {readAsset,storeAsset} from './persistence'
import {narrationClock} from './voice'
import {resolveVoice} from './voice-library'
const pending=new Map<string,Promise<PracticeTrack>>()
export const preparePractice=async(projectId:string,sceneId:string,momentId?:string):Promise<PracticeTrack>=>{
 const snapshot=await loadProject(projectId),video=snapshot?.project.video,scene=video?.scenes.find(item=>item.id===sceneId)
 if(!video || !scene || !scene.moments.length) throw new Error('Finish planning this scene first')
 const moments=momentId?scene.moments.filter(moment=>moment.id===momentId):scene.moments
 if(!moments.length) throw new Error('This moment does not exist')
 const inputKey=fingerprintOf({voice:video.settings.voice,moments:moments.map(({id,lines,segments,start,end,camera})=>({id,lines,segments,start,end,camera}))})
 const key=`${projectId}/${sceneId}/${inputKey}`
 const previous=pending.get(key);if(previous) return previous
 const work=(async()=>{
  const saved=await loadStageCheckpoint<PracticeTrack>(projectId,sceneId,'practice',inputKey)
  if(saved){for(const clip of saved.data.clips) if(clip.objectKey) await readAsset(clip.objectKey);return saved.data}
  const clips:PracticeClip[]=[];let at=0
  for(const moment of moments){
   const segments=moment.segments?.length?moment.segments:[{id:moment.id,lines:moment.lines,camera:moment.camera!=='none',estimate:moment.end-moment.start}]
   const estimated=segments.reduce((sum,segment)=>sum+segment.estimate,0);let sceneAt=moment.start
   for(const segment of segments){
    const sceneEnd=sceneAt+segment.estimate/estimated*(moment.end-moment.start)
    let duration=sceneEnd-sceneAt,objectKey:string|undefined
    if(!segment.camera && video.settings.voice.kind!=='record'){
     const voiceKey=fingerprintOf({voice:video.settings.voice,segment})
     const cached=await loadStageCheckpoint<{objectKey:string;duration?:number}>(projectId,sceneId,`voice-${segment.id}`,voiceKey)
     if(cached?.data.duration){await readAsset(cached.data.objectKey);objectKey=cached.data.objectKey;duration=cached.data.duration}
     else{
      const generated=await narrationClock([{id:segment.id,text:segment.lines,estimate:segment.estimate}],await resolveVoice(video.settings.voice))
      const asset=await storeAsset({body:generated.audio,contentType:'audio/mpeg',kind:'practice-voice',extension:'.mp3',projectId,sceneId,momentId:moment.id})
      objectKey=asset.objectKey;duration=generated.duration
      await saveStageCheckpoint(projectId,sceneId,`voice-${segment.id}`,voiceKey,{objectKey,duration})
     }
    }
    clips.push({momentId:moment.id,lines:segment.lines,camera:segment.camera,start:at,end:at+duration,sceneStart:sceneAt,sceneEnd,...objectKey?{objectKey}:{}});at+=duration;sceneAt=sceneEnd
   }
  }
  const track={inputKey,clips,duration:at}
  await saveStageCheckpoint(projectId,sceneId,'practice',inputKey,track)
  return track
 })().finally(()=>pending.delete(key))
 pending.set(key,work);return work
}
