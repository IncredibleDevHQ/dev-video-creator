import type {Scene} from '../shared/model'
import {animationSecond} from '../shared/scene-time'

/** Keep the content-only layer on the dialogue clock; camera stays a separate layer. */
export function syncRehearsalAnimation(root: ParentNode, scene: Scene, index: number, second: number, playing: boolean) {
 const player=root.querySelector<HTMLVideoElement>('[data-rehearsal-animation]')
 const moment=scene.moments[index],base=scene.animation?.moments[index]
 if(!player || !moment || !base)return
 const holdAt=Math.max(moment.start,moment.end-.3)
 const holding=second>=holdAt
 const at=animationSecond(scene,Math.max(moment.start,Math.min(holdAt,second)),true)
 const sync=()=>{
  if(Math.abs(player.currentTime-at)>.25 || !playing || holding)player.currentTime=at
  player.playbackRate=Math.max(.25,Math.min(4,(base.end-base.start)/(moment.end-moment.start)))
  if(playing && !holding)void player.play().catch(()=>{})
  else player.pause()
 }
 if(player.readyState)sync()
 else player.onloadedmetadata=sync
}
