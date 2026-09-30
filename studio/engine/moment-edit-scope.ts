import type {Moment} from '../shared/model'
import {fingerprintOf} from './planning/fingerprint'
export const editScopeProblems=<T extends {id:string}>(previous:T[],candidate:T[],target?:string,content:(moment:T)=>unknown=moment=>moment)=>{
 if(!target || !previous.length) return []
 if(!previous.some(moment=>moment.id===target)) return ['The edited moment no longer exists']
 if(previous.length!==candidate.length || previous.some((moment,index)=>moment.id!==candidate[index]?.id)) return ['A moment edit must preserve the scene’s moment identities and order']
 return previous.flatMap((moment,index)=>moment.id!==target && fingerprintOf(content(moment))!==fingerprintOf(content(candidate[index]))?[`Keep unrelated moment ${moment.id} unchanged`]:[])
}
// Absolute positions can shift when the edited moment changes duration.
// Compare authored content, not derived clocks, audio, or recording pointers.
export const scriptEditProblems=(previous:Moment[],candidate:Moment[],target?:string)=>editScopeProblems(previous,candidate,target,moment=>({id:moment.id,title:moment.title,cue:moment.cue,lines:moment.lines,seconds:moment.plannedSeconds ?? moment.end-moment.start,camera:moment.camera,layout:moment.layout,overlay:moment.overlay,segments:moment.segments?.map(({lines,camera,estimate})=>({lines,camera,estimate}))}))
