import type {Moment} from '../shared/model'
import type {RecordedPart} from '../shared/api'
/** Review follows recorded boundaries, including passes that skip auto moments. */
export function takeReviewPosition(moments:Moment[],parts:RecordedPart[],time:number){
 if(!Number.isFinite(time) || !parts.length)return null
 const part=parts.find(item=>time>=item.from && time<item.to) || (time>=parts.at(-1)!.to?parts.at(-1):undefined)
 if(!part || !(part.to>part.from))return null
 const momentIndex=moments.findIndex(moment=>moment.id===part.momentId && moment.recordingKey===part.recordingKey)
 if(momentIndex<0)return null
 const moment=moments[momentIndex]
 const fraction=Math.min(1,Math.max(0,(time-part.from)/(part.to-part.from)))
 return {momentIndex,second:moment.start+(moment.end-moment.start)*fraction}
}

/** Freeze a readable camera layout at review boundaries instead of a zero-opacity transition. */
export function reviewLayoutSecond(moment:Moment,second:number,playing:boolean){
 const inset=Math.min(.28,(moment.end-moment.start)/3)
 return playing?Math.min(second,moment.end-.001):Math.max(moment.start+inset,Math.min(second,moment.end-inset))
}
