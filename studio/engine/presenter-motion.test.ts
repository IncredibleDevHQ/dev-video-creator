import {describe,it,expect} from 'vitest'
import {presenterFrame,presenterSpans,type PresenterSpan} from '../shared/presenter-motion'
import type {Moment} from '../shared/model'

const spans:PresenterSpan[]=[
 {start:0,end:28.466,camera:true,layout:'beside-slide',momentId:'m1'},
 {start:28.466,end:33,camera:false,layout:'full-screen',momentId:'m2'},
 {start:33,end:39,camera:true,layout:'beside-slide',momentId:'m3'},
]
describe('presenter layout timeline',()=>{
 it('meets the graphics frame continuously at both camera boundaries',()=>{
  const graphics={x:0,y:0,width:1920,height:1080}
  expect(presenterFrame(spans,0,28.466)).toMatchObject({content:graphics,opacity:0})
  expect(presenterFrame(spans,1,0)).toMatchObject({content:graphics,opacity:0})
  expect(presenterFrame(spans,2,0)).toMatchObject({content:graphics,opacity:0})
  expect(presenterFrame(spans,2,.28).opacity).toBe(1)
  const middle=presenterFrame(spans,0,28.326)
  expect(middle.content.width).toBeGreaterThan(1240)
  expect(middle.content.width).toBeLessThan(1920)
  expect(middle.opacity).toBeCloseTo(.5)
 })
 it('uses measured recording time and tolerates moments without prepared media',()=>{
  const moment={id:'m1',start:0,end:28.466,camera:'full',layout:'beside-slide'} as Moment
  expect(presenterSpans([moment])).toEqual([spans[0]])
  expect(presenterSpans([{...moment,audioKey:'current',media:{inputKey:'current',clips:[{start:0,end:10,camera:true},{start:10,end:28.466,camera:false}]}}])).toMatchObject([{start:0,end:10,camera:true},{start:10,end:28.466,camera:false}])
 })
})
