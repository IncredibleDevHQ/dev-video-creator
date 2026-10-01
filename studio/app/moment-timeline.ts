import type {Moment} from '../shared/model'
let observedStrip:HTMLElement|null=null
let observer:ResizeObserver|undefined
let refresh:(()=>void)|undefined
export const movePlayhead=(root:HTMLElement,moments:Moment[],second:number,recordedIndex?:number)=>{
 const playhead=root.querySelector<HTMLElement>('.moment-playhead')
 if(!playhead || !moments.length)return
 const index=Math.max(0,moments.findIndex(moment=>second<moment.end))
 const at=recordedIndex!==undefined && recordedIndex>=0 && recordedIndex<moments.length?recordedIndex:second>=moments.at(-1)!.end?moments.length-1:index
 const moment=moments[at],card=root.querySelector<HTMLElement>(`[data-moment="${at}"]`)
 if(!card)return
 const fraction=Math.min(1,Math.max(0,(second-moment.start)/(moment.end-moment.start || 1)))
 const strip=playhead.parentElement
 if(!strip)return
 refresh=()=>movePlayhead(root,moments,second,recordedIndex)
 if(typeof ResizeObserver!=='undefined' && observedStrip!==strip){
  observer?.disconnect()
  observedStrip=strip
  observer=new ResizeObserver(()=>refresh?.())
  observer.observe(strip)
  strip.querySelectorAll<HTMLElement>('[data-moment]').forEach(item=>observer!.observe(item))
 }
 const origin=strip.getBoundingClientRect().left+strip.clientLeft-strip.scrollLeft
 const bounds=card.getBoundingClientRect()
 const next=root.querySelector<HTMLElement>(`[data-moment="${at+1}"]`)
 const from=bounds.left-origin
 const to=(next && recordedIndex===undefined?next.getBoundingClientRect().left:bounds.right)-origin
 playhead.style.left='0'
 playhead.style.transform=`translate3d(${from+(to-from)*fraction-1}px,0,0)`
}
