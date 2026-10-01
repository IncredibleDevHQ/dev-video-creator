import type {Moment} from '../shared/model'
export const movePlayhead=(root:HTMLElement,moments:Moment[],second:number,recordedIndex?:number)=>{
 const playhead=root.querySelector<HTMLElement>('.moment-playhead')
 if(!playhead || !moments.length)return
 const index=Math.max(0,moments.findIndex(moment=>second<moment.end))
 const at=recordedIndex!==undefined && recordedIndex>=0 && recordedIndex<moments.length?recordedIndex:second>=moments.at(-1)!.end?moments.length-1:index
 const moment=moments[at],card=root.querySelector<HTMLElement>(`[data-moment="${at}"]`)
 if(!card)return
 const fraction=Math.min(1,Math.max(0,(second-moment.start)/(moment.end-moment.start || 1)))
 const previous=at>0?root.querySelector<HTMLElement>(`[data-moment="${at-1}"]`):null
 const next=root.querySelector<HTMLElement>(`[data-moment="${at+1}"]`)
 const from=previous?(previous.offsetLeft+previous.offsetWidth+card.offsetLeft)/2:card.offsetLeft
 const to=next?(card.offsetLeft+card.offsetWidth+next.offsetLeft)/2:card.offsetLeft+card.offsetWidth
 playhead.style.left='0'
 playhead.style.transform=`translate3d(${from+(to-from)*fraction-1}px,0,0)`
}
