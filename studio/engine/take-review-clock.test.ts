import {expect,it} from 'vitest'
import {takeReviewPosition} from '../app/take-review-clock'
import type {Moment} from '../shared/model'
const moments=[{id:'opening',recordingKey:'first',start:0,end:2},{id:'auto',recordingKey:'auto',start:2,end:8},{id:'closing',recordingKey:'last',start:8,end:12}] as Moment[]
const parts=[{momentId:'opening',recordingKey:'first',from:0,to:10},{momentId:'closing',recordingKey:'last',from:10,to:14}]
it('follows recorded time without highlighting skipped auto moments',()=>{
 expect(takeReviewPosition(moments,parts,5)).toEqual({momentIndex:0,second:1})
 expect(takeReviewPosition(moments,parts,10)).toEqual({momentIndex:2,second:8})
 expect(takeReviewPosition(moments,parts,12)).toEqual({momentIndex:2,second:10})
 expect(takeReviewPosition(moments,parts,14)).toEqual({momentIndex:2,second:12})
})
it('holds the last completed part in a partial pass and rejects obsolete recording inputs',()=>{
 expect(takeReviewPosition(moments,parts.slice(0,1),10.2)).toEqual({momentIndex:0,second:2})
 expect(takeReviewPosition(moments,[{...parts[0],recordingKey:'changed'}],5)).toBeNull()
 expect(takeReviewPosition(moments,parts,NaN)).toBeNull()
 expect(takeReviewPosition(moments,[],0)).toBeNull()
})
it('holds the last recorded card when review ends before unrecorded moments',async()=>{
 const {movePlayhead}=await import('../app/moment-timeline')
 const playhead={style:{left:'',transform:''}}
 const cards=[{offsetLeft:10,offsetWidth:100},{offsetLeft:130,offsetWidth:100},{offsetLeft:250,offsetWidth:100}]
 const root={querySelector:(selector:string)=>selector==='.moment-playhead'?playhead:cards[Number(selector.match(/data-moment="(\d+)"/)?.[1])]} as unknown as HTMLElement
 const at=takeReviewPosition(moments,parts.slice(0,1),10.2)!
 movePlayhead(root,moments,at.second,at.momentIndex)
 expect(playhead.style.transform).toBe('translate3d(119px,0,0)')
})
