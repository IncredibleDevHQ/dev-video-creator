import {afterEach,expect,it,vi} from 'vitest'
import {NotebookStreams} from '../app/notebook-stream'
import type {Snapshot} from '../shared/api'
const port=()=>({postMessage:vi.fn()} as unknown as MessagePort)
afterEach(()=>vi.useRealTimers())
it('shares a single connection, replays the current snapshot, and closes after the last tab leaves',()=>{
 let update!:(value:Snapshot)=>void,connected!:(value:boolean)=>void
 const stop=vi.fn(),subscribe=vi.fn((_:string,u:typeof update,c:typeof connected)=>{update=u;connected=c;return stop})
 const hub=new NotebookStreams(subscribe),first=port(),second=port()
 hub.watch(first,'notebook');connected(true);update({project:{id:'notebook'}} as Snapshot)
 hub.watch(second,'notebook');expect(subscribe).toHaveBeenCalledOnce()
 expect(second.postMessage).toHaveBeenCalledWith({connected:true})
 expect(second.postMessage).toHaveBeenCalledWith({snapshot:{project:{id:'notebook'}}})
 hub.watch(second,'notebook');expect(subscribe).toHaveBeenCalledOnce()
 hub.unwatch(first);expect(stop).not.toHaveBeenCalled()
 hub.unwatch(second);expect(stop).toHaveBeenCalledOnce()
})
it('releases abandoned tabs and reconnects when they resume',()=>{
 vi.useFakeTimers();const stop=vi.fn(),subscribe=vi.fn(()=>stop),hub=new NotebookStreams(subscribe),first=port(),second=port()
 hub.watch(first,'p');hub.watch(second,'p')
 vi.advanceTimersByTime(180001);hub.touch(second);hub.expire();expect(stop).not.toHaveBeenCalled()
 vi.advanceTimersByTime(180001);hub.expire();expect(stop).toHaveBeenCalledOnce()
 hub.watch(first,'p');expect(subscribe).toHaveBeenCalledTimes(2)
})
it('switches notebooks without leaking the previous connection or accepting invalid IDs',()=>{
 const stop=vi.fn(),subscribe=vi.fn(()=>stop),hub=new NotebookStreams(subscribe),client=port()
 hub.watch(client,'one');hub.watch(client,'two');expect(stop).toHaveBeenCalledOnce()
 hub.watch(client,'../private');expect(subscribe).toHaveBeenCalledTimes(2)
 hub.unwatch(client);expect(stop).toHaveBeenCalledTimes(2)
})

it('keeps brief renewals quiet but reports an outage until a valid snapshot returns',async()=>{
 vi.useFakeTimers()
 const sources:any[]=[]
 class Source {onopen:any;onerror:any;onmessage:any;close=vi.fn();constructor(){sources.push(this)}}
 vi.stubGlobal('EventSource',Source)
 const {notebookStream}=await import('../app/notebook-stream')
 const connected=vi.fn(),update=vi.fn(),stop=notebookStream('p',update,connected)
 try{
  const source=sources[0],message={data:JSON.stringify({project:{id:'p'}})}
  source.onmessage(message);connected.mockClear()
  source.onerror();vi.advanceTimersByTime(2000);source.onopen?.();source.onmessage(message)
  expect(connected.mock.calls).toEqual([[true]])
  connected.mockClear();source.onerror();vi.advanceTimersByTime(3999)
  expect(connected).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1);expect(connected).toHaveBeenLastCalledWith(false)
  source.onopen?.();expect(connected).toHaveBeenLastCalledWith(false)
  source.onmessage(message);expect(connected).toHaveBeenLastCalledWith(true)
  source.onerror();stop();connected.mockClear();vi.advanceTimersByTime(5000)
  expect(connected).not.toHaveBeenCalled()
 }finally{stop();vi.unstubAllGlobals()}
})
