import {dialogueBoundary} from './dialogue'
/** A recorded/rehearsed interval and the animation interval it drives. */
export type SceneTimeSpan={start:number;end:number;sceneStart:number;sceneEnd:number}
/** Map media time to animation time without changing either track's source. */
export const sceneTimeMap=(spans:readonly SceneTimeSpan[])=>{
 if(!spans.length) throw new Error('The scene clock needs at least one interval')
 const clock=spans.map(span=>({...span}))
 for(const [index,span] of clock.entries()){
  if(!Object.values(span).every(Number.isFinite) || span.start<0 || span.sceneStart<0 || span.end<=span.start || span.sceneEnd<=span.sceneStart) throw new Error('The scene clock contains an invalid interval')
  const previous=clock[index-1]
  if(previous && (Math.abs(previous.end-span.start)>1e-6 || Math.abs(previous.sceneEnd-span.sceneStart)>1e-6)) throw new Error('The scene clock intervals must be continuous')
 }
 return (second:number)=>{
  if(!Number.isFinite(second)) throw new Error('The scene clock needs a finite time')
  if(second<=clock[0].start)return clock[0].sceneStart
  if(second>=clock.at(-1)!.end)return clock.at(-1)!.sceneEnd
  const span=clock.find(span=>second<span.end)!
  return span.sceneStart+(second-span.start)/(span.end-span.start)*(span.sceneEnd-span.sceneStart)
 }
}

export const animationSecond=(scene:import('./model').Scene,second:number,toAnimation=false)=>{
 const animation=scene.animation
 if(!animation || animation.inputKey!==scene.animationKey)return second
 if(animation.moments.length!==scene.moments.length || scene.moments.some((m,i)=>m.id!==animation.moments[i].id))throw new Error('The animation clock does not match this scene')
 if(scene.moments.some(m=>m.extension)){
  const index=Math.max(0,(toAnimation?scene.moments:animation.moments).findIndex((m,i,all)=>second<m.end || i===all.length-1))
  const m=scene.moments[index],a=animation.moments[index],boundary=dialogueBoundary(m)
  return toAnimation?a.start+Math.min(1,Math.max(0,(second-m.start)/boundary))*(a.end-a.start):m.start+Math.max(0,Math.min(1,(second-a.start)/(a.end-a.start)))*boundary
 }
 return sceneTimeMap(scene.moments.map((m,i)=>{const a=animation.moments[i];return toAnimation?{start:m.start,end:m.end,sceneStart:a.start,sceneEnd:a.end}:{start:a.start,end:a.end,sceneStart:m.start,sceneEnd:m.end}}))(second)
}
