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

it('counts down before capture and stops a timed take once for review',async()=>{
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now())
 const stopTrack=vi.fn()
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:stopTrack}],getVideoTracks:()=>[]})}})
 class Recorder{
  static isTypeSupported=()=>true
  static latest:Recorder
  state='inactive';mimeType='audio/webm';onstop:(()=>void)|null=null;ondataavailable:((event:{data:Blob})=>void)|null=null
  constructor(){Recorder.latest=this}
  start=vi.fn(()=>{this.state='recording'})
  stop=vi.fn(()=>{this.state='inactive';this.ondataavailable?.({data:new Blob(['test take'])});this.onstop?.()})
 }
 vi.stubGlobal('MediaRecorder',Recorder)
 const recording=new Recording(()=>{},()=>{})
 try{
  await recording.start([moment],{stopAfter:2})
  expect(recording.phase).toBe('countdown');expect(Recorder.latest.start).not.toHaveBeenCalled()
  vi.advanceTimersByTime(3000);expect(recording.phase).toBe('recording')
  vi.advanceTimersByTime(2000);expect(recording.phase).toBe('reviewing')
  expect(recording.parts).toEqual([{momentId:'moment',recordingKey:'record',from:0,to:2}])
  recording.stop();vi.advanceTimersByTime(10000);expect(Recorder.latest.stop).toHaveBeenCalledOnce()
  expect(stopTrack).toHaveBeenCalledOnce();expect(recording.blob?.size).toBeGreaterThan(0)
 }finally{recording.dispose();vi.useRealTimers();vi.restoreAllMocks()}
})

it.each(['start','device'])('releases capture after a %s failure and reports a recoverable error',async failure=>{
 vi.useFakeTimers()
 const stopTrack=vi.fn(),failed=vi.fn()
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:stopTrack}],getVideoTracks:()=>[]})}})
 class Recorder {
  static isTypeSupported=()=>true
  static latest:Recorder
  state='inactive';mimeType='audio/webm';onstop:(()=>void)|null=null;ondataavailable:unknown=null;onerror:(()=>void)|null=null
  constructor(){Recorder.latest=this}
  start(){if(failure==='start')throw new Error('Device unavailable');this.state='recording'}
  stop(){this.state='inactive';this.onstop?.()}
 }
 vi.stubGlobal('MediaRecorder',Recorder)
 const recording=new Recording(()=>{},()=>{},failed)
 try {
  await recording.start([moment]);vi.advanceTimersByTime(3000)
  if(failure==='device')Recorder.latest.onerror?.()
  expect(recording.phase).toBe('idle');expect(recording.stream).toBeNull();expect(recording.blob).toBeNull()
  expect(stopTrack).toHaveBeenCalledOnce();expect(failed).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0)
  expect(Recorder.latest.onstop).toBeNull()
 }finally{recording.dispose();vi.useRealTimers()}
})

it.each([false,true])('records distinct moments in one pass and safely stops at the deadline (%s)',async timed=>{
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now())
 const stopTrack=vi.fn()
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:stopTrack}],getVideoTracks:()=>[]})}})
 class Recorder {
  static isTypeSupported=()=>true
  static latest:Recorder
  state='inactive';mimeType='audio/webm';onstop:(()=>void)|null=null;ondataavailable:((event:{data:Blob})=>void)|null=null
  constructor(){Recorder.latest=this}
  start(){this.state='recording'}
  stop=vi.fn(()=>{this.state='inactive';this.ondataavailable?.({data:new Blob(['Synthetic pass'])});this.onstop?.()})
 }
 vi.stubGlobal('MediaRecorder',Recorder)
 const recording=new Recording(()=>{},()=>{})
 try{
  await recording.start([moment,{...moment,id:'second',recordingKey:'second-key'}],{stopAfter:timed?2:null})
  vi.advanceTimersByTime(3000);vi.advanceTimersByTime(timed?1800:1200);recording.next()
  expect(recording.current).toBe(1);expect(recording.phase).toBe('recording')
  vi.advanceTimersByTime(timed?200:800)
  if(!timed)recording.next()
  expect(recording.phase).toBe('reviewing');expect(Recorder.latest.stop).toHaveBeenCalledOnce()
  expect(recording.parts[0]).toMatchObject({momentId:'moment',recordingKey:'record',from:0,to:timed?1.8:1.2})
  if(timed)expect(recording.parts).toHaveLength(1)
  else expect(recording.parts[1]).toEqual({momentId:'second',recordingKey:'second-key',from:1.2,to:2})
  expect(stopTrack).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0)
 }finally{recording.dispose();vi.useRealTimers();vi.restoreAllMocks()}
})
