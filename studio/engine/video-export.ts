import type { Transition, SceneInterval } from '../shared/model'
import { loadProject, changeProject, addEvent } from './projects'
import { videoView } from './state'
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
