import {videoCover} from '../render/video-cover'
import {readAsset,storeAsset} from './persistence'
export async function ensureVideoCover(projectId:string,sceneId:string|undefined,asset:{objectKey:string;posterKey?:string},second=1){
 if(asset.posterKey){try{await readAsset(asset.posterKey);return asset}catch{ /* A cover can be rebuilt from the retained video. */ }}
 const body=await videoCover(await readAsset(asset.objectKey),second)
 const poster=await storeAsset({body,contentType:'image/jpeg',kind:'video-cover',extension:'.jpg',projectId,sceneId})
 return {...asset,posterKey:poster.objectKey}
}

import {loadProject,changeProject} from './projects'
const pending=new Map<string,Promise<Buffer>>()
/** Older notebooks acquire a cover on demand without producing their video again. */
export async function sceneCover(projectId:string,sceneId:string,cache=true){
 const snapshot=await loadProject(projectId)
 const scene=snapshot?.project.video?.scenes.find(scene=>scene.id===sceneId)
 const produced=scene?.produced?.inputKey===scene?.inputKey?scene?.produced:undefined
 const animation=scene?.animation?.inputKey===scene?.animationKey?scene?.animation:undefined
 const source=produced || animation
 if(!source || !scene)throw new Error('This scene has no video yet')
 if(source.posterKey){try{return await readAsset(source.posterKey)}catch{ /* Rebuild a missing derived cover. */ }}
 const key=`${projectId}/${sceneId}/${source.objectKey}/${cache}`
 if(pending.has(key))return pending.get(key)!
 const work=(async()=>{
  const second=Math.min(1,(produced?scene.moments[0].end-scene.moments[0].start:animation!.moments[0].end)/2)
  if(!cache)return videoCover(await readAsset(source.objectKey),second)
  const covered=await ensureVideoCover(projectId,sceneId,source,second)
  await changeProject(projectId,current=>{
   const target=current.project.video?.scenes.find(item=>item.id===sceneId)
   const asset=produced?target?.produced:target?.animation
   if(asset?.objectKey===source.objectKey)asset.posterKey=covered.posterKey
  })
  return readAsset(covered.posterKey!)
 })().finally(()=>pending.delete(key))
 pending.set(key,work);return work
}
