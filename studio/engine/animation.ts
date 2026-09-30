import {ensureVideoCover} from './video-cover'
import {presenterOverlays} from '../render/presenter-overlay'
import {loadProject} from './projects'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import type {Project,Scene} from '../shared/model'
import {loadStageCheckpoint,saveStageCheckpoint} from './artifacts'
import {readAsset,storeAsset} from './persistence'
import {runCommand} from './voice'
import {buildCreativeProduction} from './creative/production'
import {prepareCreativeClock} from './creative/clock'
import {renderProductionBundle} from '../render/production-render'
import {composePresenter} from '../render/presenter'
export const prepareSceneAnimation=async(project:Project,scene:Scene,progress:(message:string)=>Promise<unknown>):Promise<NonNullable<Scene['animation']>>=>{
 const key=scene.animationKey
 if(!key)throw new Error('The scene has no animation inputs')
 const saved=await loadStageCheckpoint<NonNullable<Scene['animation']>>(project.id,scene.id,'animation',key)
 if(saved){await readAsset(saved.data.objectKey);const result={...saved.data,...await ensureVideoCover(project.id,scene.id,saved.data,Math.min(1,saved.data.moments[0].end/2))};if(!saved.data.posterKey)await saveStageCheckpoint(project.id,scene.id,'animation',key,result);return result}
 const source=structuredClone(scene);source.inputKey=`animation-${key}`
 let at=0
 for(const moment of source.moments){
  const seconds=moment.plannedSeconds || moment.segments?.reduce((n,s)=>n+s.estimate,0) || moment.end-moment.start
  moment.start=at;moment.end=at+seconds;at=moment.end
 }
 const dir=await mkdtemp(join(tmpdir(),'studio-animation-clock-'))
 try{
  const path=join(dir,'silence.wav')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',String(at),path])
  const silence=await storeAsset({body:await readFile(path),contentType:'audio/wav',extension:'.wav',kind:'animation-clock',projectId:project.id,sceneId:scene.id})
  for(const moment of source.moments){moment.take=null;moment.audio={inputKey:moment.audioKey,objectKey:silence.objectKey,duration:moment.end-moment.start};moment.media={inputKey:moment.audioKey,clips:[{start:0,end:moment.end-moment.start,camera:false}]}}
  await progress('Building the scene')
  const files=await buildCreativeProduction(project,source,process.env.MINIMAL_STUDIO_HARNESS_ORIGIN || `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`,true)
  await progress('Rendering the animation')
  const bytes=await renderProductionBundle(files,{fps:30})
  const asset=await storeAsset({body:bytes,contentType:'video/mp4',extension:'.mp4',kind:'scene-animation',projectId:project.id,sceneId:scene.id})
  const result={inputKey:key,objectKey:asset.objectKey,moments:source.moments.map(({id,start,end})=>({id,start,end}))}
  await saveStageCheckpoint(project.id,scene.id,'animation',key,result)
  const covered={...result,...await ensureVideoCover(project.id,scene.id,result,Math.min(1,result.moments[0].end/2))}
  await saveStageCheckpoint(project.id,scene.id,'animation',key,covered)
  return covered
 }finally{await rm(dir,{recursive:true,force:true})}
}
export const finishSceneAnimation=async(projectId:string,scene:Scene,animation:NonNullable<Scene['animation']>)=>{
 const clock=await prepareCreativeClock(projectId,scene)
 const project=(await loadProject(projectId))!.project
 const overlays=await presenterOverlays(project,scene)
 for(const [momentId,body] of Object.entries(overlays))await storeAsset({body,contentType:'image/png',extension:'.png',kind:'presenter-overlay',projectId,sceneId:scene.id,momentId})
 return composePresenter({overlays,animation:await readAsset(animation.objectKey),animationMoments:animation.moments,moments:scene.moments,audio:await readAsset(clock.audioKey),...clock.videoKey?{camera:await readAsset(clock.videoKey)}:{}})
}
