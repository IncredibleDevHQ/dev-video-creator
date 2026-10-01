import type {Moment} from '../shared/model'
import {escape} from './ui'
export const transcriptWords=(text:string)=>(text.match(/\S+|\s+/g) || []).map(part=>/^\s+$/.test(part)?part:`<span data-transcript-word>${escape(part)}</span>`).join('')
export function wordAt(lines:string,start:number,end:number,second:number){
 const words=lines.trim().split(/\s+/).filter(Boolean)
 if(!words.length || second<start || end<=start)return -1
 return Math.min(words.length-1,Math.floor(Math.max(0,(second-start)/(end-start))*words.length))
}
export function followTranscript(root:HTMLElement,moments:Moment[],second:number,index:number){
 const moment=moments[index];if(!moment)return
 const active=wordAt(moment.lines,moment.start,moment.end,second)
 let current:HTMLElement|undefined
 root.querySelectorAll<HTMLElement>('[data-transcript-moment]').forEach(section=>{
  const selected=Number(section.dataset.transcriptMoment)===index
  section.classList.toggle('current',selected)
  section.querySelectorAll<HTMLElement>('[data-transcript-word]').forEach((word,i)=>{
   const on=selected && i===active
   word.classList.toggle('spoken-word',on)
   if(on){word.setAttribute('aria-current','true');current=word}else word.removeAttribute('aria-current')
  })
 })
 const scroller=root.querySelector<HTMLElement>('.transcript-scroll')
 if(scroller && current){
  const box=current.getBoundingClientRect(),view=scroller.getBoundingClientRect()
  if(box.top<view.top+16 || box.bottom>view.bottom-16)scroller.scrollTop+=box.top-view.top-view.height/3
 }
}
