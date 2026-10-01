import type {Moment} from './model'
import {presenterLayout} from './presenter-layout'
export type PresenterSpan={start:number;end:number;camera:boolean;layout:Moment['layout'];momentId:string}
export function presenterSpans(moments:Moment[]):PresenterSpan[]{
 return moments.flatMap(moment=>{
  const duration=moment.end-moment.start
  const measured=moment.media && moment.media.inputKey===moment.audioKey?moment.media.clips:null
  const total=moment.segments?.reduce((sum,segment)=>sum+segment.estimate,0) || 0
  let cursor=0
  const planned=total>0?moment.segments!.map(segment=>{
   const start=cursor
   cursor+=duration*segment.estimate/total
   return {start,end:cursor,camera:segment.camera}
  }):[{start:0,end:duration,camera:moment.camera==='full'}]
  return (measured || planned).filter(clip=>clip.end>clip.start).map(clip=>({start:moment.start+clip.start,end:Math.min(moment.end,moment.start+clip.end),camera:clip.camera,layout:moment.layout,momentId:moment.id}))
 })
}
export function presenterMotion(spans:PresenterSpan[],index:number){
 const span=spans[index],duration=span.end-span.start,fade=Math.min(.28,duration/3)
 return {duration,enter:span.camera && index>0 && !spans[index-1].camera?fade:0,exit:span.camera && index+1<spans.length && !spans[index+1].camera?fade:0}
}
export function presenterOpacity(motion:ReturnType<typeof presenterMotion>,time:number){
 const amount=Math.max(0,Math.min(1,motion.enter?time/motion.enter:1,motion.exit?(motion.duration-time)/motion.exit:1))
 return amount
}
export function presenterWeight(motion:ReturnType<typeof presenterMotion>,time:number){
 const amount=presenterOpacity(motion,time)
 return amount*amount*(3-2*amount)
}
/** The expression uses the same smoothstep as browser playback. */
export function presenterWeightExpression(motion:ReturnType<typeof presenterMotion>){
 const q=`max(0,min(1,min(${motion.enter?`t/${motion.enter}`:'1'},${motion.exit?`(${motion.duration}-t)/${motion.exit}`:'1'})))`
 return `(${q}*${q}*(3-2*${q}))`
}
export function presenterFrame(spans:PresenterSpan[],index:number,time:number){
 const span=spans[index],layout=presenterLayout(span.layout),weight=span.camera?presenterWeight(presenterMotion(spans,index),time):0
 const target=span.layout==='full-screen'?{x:0,y:0,width:1920,height:1080}:layout.content
 return {content:{x:target.x*weight,y:target.y*weight,width:1920+(target.width-1920)*weight,height:1080+(target.height-1080)*weight},camera:layout.camera,opacity:span.camera?presenterOpacity(presenterMotion(spans,index),time):0}
}
