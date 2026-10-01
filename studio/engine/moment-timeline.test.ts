import {describe,it,expect} from 'vitest'
import {movePlayhead} from '../app/moment-timeline'
import type {Moment} from '../shared/model'

describe('moment playhead',()=>{
 const moments=Array.from({length:6},(_,i)=>({start:i*10,end:(i+1)*10})) as Moment[]
 const fixture=()=>{
  const playhead={style:{left:'',transform:''},parentElement:{clientLeft:0,scrollLeft:0,getBoundingClientRect:()=>({left:200})}}
  const cards=moments.map((_,i)=>({offsetLeft:0,getBoundingClientRect:()=>({left:200+i*110,right:300+i*110})}))
  const root={querySelector:(selector:string)=>selector==='.moment-playhead'?playhead:cards[Number(selector.match(/\d+/)?.[0])] } as unknown as HTMLElement
  return {root,playhead}
 }
 it('places selection at the sixth card start despite nested positioned wrappers',()=>{
  const {root,playhead}=fixture()
  movePlayhead(root,moments,50)
  expect(playhead.style.transform).toBe('translate3d(549px,0,0)')
 })
 it('advances through playback and returns to an earlier selected moment',()=>{
  const {root,playhead}=fixture()
  movePlayhead(root,moments,55)
  expect(playhead.style.transform).toBe('translate3d(599px,0,0)')
  movePlayhead(root,moments,10)
  expect(playhead.style.transform).toBe('translate3d(109px,0,0)')
 })
})
