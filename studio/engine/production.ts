import {ensureVideoCover} from './video-cover'
type SceneAnimation=NonNullable<import('../shared/model').Scene['animation']>
import {prepareSceneAnimation,finishSceneAnimation} from './animation'
import {generationFailure} from './generation-errors'
import {buildCreativeProduction} from './creative/production'
import { randomUUID } from 'node:crypto'
import { loadProject, changeProject, addEvent } from './projects'
import { refreshVideoKeys } from './scene-model'
import { momentState } from './state'
import { prepareMomentAudio } from './scene-audio'
import { storeAsset, writeRow } from './persistence'
import { buildSceneBundle } from '../render/scene'
import { renderProductionBundle } from '../render/production-render'
import { loadStageCheckpoint,saveStageCheckpoint,archiveFiles,restoreFiles } from './artifacts'
const active = new Map<string,Promise<void>>()
export const produceScene = async (id: string, sceneId: string) => {
  const key = `${id}/${sceneId}`
  if (active.has(key)) return (await loadProject(id))!
  let expected = ''
  const snapshot = await changeProject(id,current => {
    const video = current.project.video
    const scene = video?.scenes.find(scene => scene.id === sceneId)
    if (!scene || !video || !scene.moments.length || !['waiting','produced','failed'].includes(scene.phase)) throw new Error('This scene is not ready to produce')
    if (scene.phase === 'failed' && scene.failure !== 'production') throw new Error('Write this scene first')
    if (!scene.creativePlan && scene.moments.some(moment => momentState(moment,video.settings.voice) === 'to record')) throw new Error('Record the open moments first')
    for(const moment of scene.moments)moment.plannedSeconds ??= moment.segments?.reduce((n,s)=>n+s.estimate,0) || moment.end-moment.start
    scene.phase = 'producing'; scene.error = null; delete scene.failure
    refreshVideoKeys(current.project); expected = scene.inputKey
    addEvent(current,'scene','Producing',{sceneId})
  })
  const progress=async(message:string)=>changeProject(id,current=>{
    const target=current.project.video?.scenes.find(scene=>scene.id===sceneId)
    if(target?.phase==='producing' && target.inputKey===expected) addEvent(current,'scene',message,{sceneId,activity:'processing'})
  })
  const work = (async () => {
    try {
      const frozen = structuredClone(snapshot)
      const scene = frozen.project.video!.scenes.find(scene => scene.id === sceneId)!
      let animation:SceneAnimation|undefined
      if(scene.creativePlan){
        animation=await prepareSceneAnimation(frozen.project,scene,progress)
        let current=false
        await changeProject(id,s=>{const target=s.project.video?.scenes.find(x=>x.id===sceneId);if(target?.phase!=='producing' || target.inputKey!==expected)return;target.animation=animation;current=true
          if(target.moments.some(m=>momentState(m,s.project.video!.settings.voice)==='to record')){target.phase='waiting';addEvent(s,'scene','Animation ready · record your moments when you’re ready',{sceneId,activity:'complete'})}
        })
        if(!current || scene.moments.some(m=>momentState(m,frozen.project.video!.settings.voice)==='to record'))return
      }
      for (let index = 0; index < scene.moments.length; index++) {
        await progress(`Preparing voice · moment ${index+1} of ${scene.moments.length}`)
        scene.moments[index] = await prepareMomentAudio(id,sceneId,scene.moments[index],frozen.project.video!.settings.voice)
        let landed=false
        await changeProject(id,current=>{
          const target=current.project.video?.scenes.find(item=>item.id===sceneId)
          if(!target || target.phase!=='producing' || target.inputKey!==expected) return
          target.moments[index]=scene.moments[index];refreshVideoKeys(current.project);expected=target.inputKey;landed=true
        })
        if(!landed) return
      }
      refreshVideoKeys(frozen.project)
      let accepted = false
      await changeProject(id,current => {
        const target = current.project.video?.scenes.find(scene => scene.id === sceneId)
        if (!target || target.phase !== 'producing' || target.inputKey !== expected) return
        target.moments = scene.moments; refreshVideoKeys(current.project); expected = target.inputKey; accepted = true
      })
      if (!accepted) return
      if(!animation)await progress('Building the scene')
      const savedBundle=await loadStageCheckpoint<null>(id,sceneId,'composition',expected)
      const files=animation?null:savedBundle?await restoreFiles(savedBundle.artifacts):scene.creativePlan?await buildCreativeProduction(frozen.project,scene,process.env.MINIMAL_STUDIO_HARNESS_ORIGIN || `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`):await buildSceneBundle(frozen.project,scene)
      if(!savedBundle && files) await saveStageCheckpoint(id,sceneId,'composition',expected,null,await archiveFiles(id,sceneId,'composition',files))
      const savedRender=await loadStageCheckpoint<{objectKey:string;posterKey?:string}>(id,sceneId,'render',expected)
      let asset:{objectKey:string;posterKey?:string}
      if(savedRender) {await (await import('./persistence')).readAsset(savedRender.data.objectKey);asset=savedRender.data}
      else {
        await progress('Rendering the scene')
        const rendered = animation?await finishSceneAnimation(id,scene,animation):await renderProductionBundle(files!,{fps:30})
        await progress('Saving the scene')
        asset = await storeAsset({body:rendered,contentType:'video/mp4',kind:'produced-scene',extension:'.mp4',projectId:id,sceneId})
        await saveStageCheckpoint(id,sceneId,'render',expected,{objectKey:asset.objectKey})
      }
      asset=await ensureVideoCover(id,sceneId,asset,Math.min(1,(scene.moments[0].end-scene.moments[0].start)/2))
      await saveStageCheckpoint(id,sceneId,'render',expected,asset)
      const renderId = randomUUID()
      await writeRow('renders',renderId,{projectId:id,sceneId,inputKey:expected,objectKey:asset.objectKey,posterKey:asset.posterKey,createdAt:new Date().toISOString()})
      await changeProject(id,current => {
        const target = current.project.video?.scenes.find(scene => scene.id === sceneId)
        if (!target || target.phase !== 'producing' || target.inputKey !== expected) return
        target.produced = {inputKey:expected,objectKey:asset.objectKey,posterKey:asset.posterKey}; target.phase = 'produced'
        addEvent(current,'scene','Produced',{sceneId})
      })
    } catch (error) {
      await changeProject(id,current => {
        const target = current.project.video?.scenes.find(scene => scene.id === sceneId)
        if (!target || target.phase !== 'producing' || target.inputKey !== expected) return
        target.phase = 'failed'; target.failure = 'production'; target.error = generationFailure(error,'Could not produce this scene. Try again.')
        addEvent(current,'scene',target.error,{sceneId,activity:'failed'})
      })
    }
  })().finally(() => active.delete(key))
  active.set(key,work); void work.catch(() => {})
  return snapshot
}

export const waitForSceneProduction=(id:string,sceneId:string)=>active.get(`${id}/${sceneId}`) || Promise.resolve()
