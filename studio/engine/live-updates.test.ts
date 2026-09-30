import {expect,it,vi} from 'vitest'
import {api} from '../app/api'
it('reports disconnection, recovers on a valid update, and ignores closed subscriptions',()=>{
 let stream:any
 class FakeSource {onopen:any;onerror:any;onmessage:any;close=vi.fn();constructor(){stream=this}}
 vi.stubGlobal('EventSource',FakeSource)
 try{
  const update=vi.fn(),connected=vi.fn(),close=api.subscribe('p',update,connected)
  stream.onopen();expect(connected).toHaveBeenLastCalledWith(false)
  stream.onerror();expect(connected).toHaveBeenLastCalledWith(false)
  stream.onmessage({data:'invalid'});expect(update).not.toHaveBeenCalled()
  stream.onmessage({data:JSON.stringify({project:{id:'other'}})});expect(update).not.toHaveBeenCalled()
  stream.onmessage({data:JSON.stringify({project:{id:'p'}})});expect(update).toHaveBeenCalledOnce();expect(connected).toHaveBeenLastCalledWith(true)
  close();connected.mockClear();stream.onerror();stream.onmessage({data:JSON.stringify({project:{id:'p'}})})
  expect(connected).not.toHaveBeenCalled();expect(update).toHaveBeenCalledOnce();expect(stream.close).toHaveBeenCalledOnce()
 }finally{vi.unstubAllGlobals()}
})

it('reconnects a silent stream without starting any generation',()=>{
 vi.useFakeTimers();const streams:any[]=[]
 class FakeSource {onopen:any;onerror:any;onmessage:any;close=vi.fn();constructor(){streams.push(this)}}
 vi.stubGlobal('EventSource',FakeSource)
 try{
  const update=vi.fn(),connected=vi.fn(),close=api.subscribe('p',update,connected)
  vi.advanceTimersByTime(15000)
  expect(streams).toHaveLength(2);expect(streams[0].close).toHaveBeenCalledOnce()
  streams[1].onmessage({data:JSON.stringify({project:{id:'p'}})})
  expect(connected).toHaveBeenLastCalledWith(true);expect(update).toHaveBeenCalledOnce()
  close();vi.advanceTimersByTime(30000);expect(streams).toHaveLength(2)
 }finally{vi.useRealTimers();vi.unstubAllGlobals()}
})
