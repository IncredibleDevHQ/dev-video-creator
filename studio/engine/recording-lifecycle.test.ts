import {afterEach,expect,it,vi} from 'vitest'
import {Recording} from '../app/recording'
import type {Moment} from '../shared/model'
const moment:Moment={id:'moment',lines:'Fixture',start:0,end:2,camera:'none',layout:'corner',overlay:null,recordingKey:'record',take:null,audio:null,audioKey:'audio'}
afterEach(() => vi.unstubAllGlobals())
it('releases a late microphone stream when the user closed the recorder',async () => {
  let resolve!:(stream:MediaStream)=>void
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:() => new Promise<MediaStream>(done => {resolve=done})}})
  const recorder=new Recording(()=>{},()=>{})
  const pending=recorder.start([moment]);recorder.dispose()
  const stop=vi.fn();resolve({getTracks:()=>[{stop}]} as unknown as MediaStream)
  await pending
  expect(stop).toHaveBeenCalledOnce();expect(recorder.phase).toBe('idle');expect(recorder.stream).toBeNull()
})
it('an older denied request cannot cancel a new recording request',async () => {
  let reject!:(error:Error)=>void
  let resolve!:(stream:MediaStream)=>void
  const getUserMedia=vi.fn().mockImplementationOnce(() => new Promise((_done,fail) => {reject=fail})).mockImplementationOnce(() => new Promise(done => {resolve=done}))
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}})
  const recorder=new Recording(()=>{},()=>{})
  const old=recorder.start([moment]);recorder.dispose();const next=recorder.start([moment])
  reject(new Error('Microphone denied'));await old;expect(recorder.phase).toBe('preparing')
  recorder.dispose();const stop=vi.fn();resolve({getTracks:()=>[{stop}]} as unknown as MediaStream);await next;expect(stop).toHaveBeenCalledOnce()
})

it('leaves recording available for retry after permission denial',async()=>{
  const denied=new Error('Permission denied');denied.name='NotAllowedError'
  const getUserMedia=vi.fn().mockRejectedValue(denied)
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}})
  const recorder=new Recording(()=>{},()=>{})
  await expect(recorder.start([moment])).rejects.toThrow('site settings')
  expect(recorder.phase).toBe('idle');expect(recorder.stream).toBeNull()
  await expect(recorder.start([moment])).rejects.toThrow('Record again')
  expect(getUserMedia).toHaveBeenCalledTimes(2)
})
