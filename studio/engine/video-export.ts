import {planScene,waitForPlanning} from './video'
import {produceScene,waitForSceneProduction} from './production'
import type { Transition, SceneInterval } from '../shared/model'
import { loadProject, changeProject, addEvent } from './projects'
import { videoView, momentState } from './state'
import { refreshVideoKeys } from './scene-model'
import { joinScenes } from '../render/join'
import { storeAsset } from './persistence'
import {loadStageCheckpoint,saveStageCheckpoint} from './artifacts'
import {readAsset} from './persistence'
const running = new Map<string,Promise<void>>()
export const updateTransition = (id: string, index: number, transition: unknown) => changeProject(id,current => {
  const video = current.project.video
  if (!video || !Number.isInteger(index) || index < 0 || index >= video.transitions.length || !['none','crossfade','push-left','push-right','push-up','wipe','zoom'].includes(String(transition))) throw new Error('Choose a scene transition')
  video.transitions[index] = transition as Transition
  refreshVideoKeys(current.project); addEvent(current,'video','Transition updated')
})
export const produceVideo = async (id: string) => {
  if (running.has(id)) return (await loadProject(id))!
  const initial=await loadProject(id)
  if(initial && videoView(initial.project).state==='Prepare scenes'){
    const started=await changeProject(id,s=>{s.project.video!.phase='preparing';s.project.video!.error=null;addEvent(s,'video','Preparing scenes; recordings can be added later')})
    const work=(async()=>{
      await waitForPlanning(id)
      for(const item of started.project.video!.scenes){
        let current=(await loadProject(id))!.project.video!.scenes.find(s=>s.id===item.id)
        if(current?.phase==='queued'){await planScene(id,item.id);current=(await loadProject(id))!.project.video!.scenes.find(s=>s.id===item.id)}
        if(!current || current.phase!=='waiting')continue
        if(current.animation?.inputKey===current.animationKey && current.animation && current.moments.some(m=>momentState(m,started.project.video!.settings.voice)==='to record'))continue
        await produceScene(id,item.id);await waitForSceneProduction(id,item.id)
      }
      await changeProject(id,s=>{const failed=s.project.video!.scenes.filter(scene=>scene.phase==='failed').length;s.project.video!.phase=failed?'failed':'idle';s.project.video!.error=failed?`${failed} scenes need attention. Other saved animations are ready.`:null;addEvent(s,'video',failed?'Scene preparation finished with scenes needing attention.':'Scene preparation finished. Add remaining recordings in any order.')})
    })().catch(async reason=>{await changeProject(id,s=>{s.project.video!.phase='failed';s.project.video!.error=reason instanceof Error?reason.message:'Could not prepare scenes'})}).finally(()=>running.delete(id))
    running.set(id,work);return started
  }
  let expected = ''
  const snapshot = await changeProject(id,current => {
    if (!videoView(current.project).enabled || videoView(current.project).action !== 'produce-video') throw new Error('Produce every scene first')
    const video = current.project.video!
    expected = video.inputKey; video.phase = 'joining'; video.error = null
    addEvent(current,'video','Producing video')
  })
  const video = snapshot.project.video!
  const work = (async () => {
    try {
      let clock: SceneInterval[] = []
      const saved=await loadStageCheckpoint<{objectKey:string;clock:SceneInterval[]}>(id,undefined,'join',expected)
      let asset:{objectKey:string}
      if(saved) {await readAsset(saved.data.objectKey);asset=saved.data;clock=saved.data.clock}
      else {
        const bytes = await joinScenes(video.scenes.map(scene => scene.produced!.objectKey),video.transitions,intervals => { clock = intervals.map((interval,index) => ({...interval,sceneId:video.scenes[index].id})) })
        asset = await storeAsset({body:bytes,contentType:'video/mp4',kind:'produced-video',extension:'.mp4',projectId:id})
        await saveStageCheckpoint(id,undefined,'join',expected,{objectKey:asset.objectKey,clock})
      }
      await changeProject(id,current => {
        const target = current.project.video
        if (!target || target.inputKey !== expected) { if (target) target.phase = 'idle'; return }
        target.produced = {inputKey:expected,objectKey:asset.objectKey,clock}; target.phase = 'idle'
        addEvent(current,'video','Video produced')
      })
    } catch {
      await changeProject(id,current => {
        const target = current.project.video
        if (!target) return
        if (target.inputKey !== expected) { target.phase = 'idle'; return }
        target.phase = 'failed'; target.error = 'Could not produce the video. Try again.'
        addEvent(current,'video',target.error)
      })
    }
  })().finally(() => running.delete(id))
  running.set(id,work); void work.catch(() => {})
  return snapshot
}
