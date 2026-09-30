import {afterEach,expect,it,vi} from 'vitest'
import {liveNotebook} from '../app/live-notebook'
const sources:any[]=[],workers:any[]=[]
class Source {onopen:any;onerror:any;onmessage:any;close=vi.fn();constructor(){sources.push(this)}}
class Worker {
 onerror:any
 port={postMessage:vi.fn(),start:vi.fn(),close:vi.fn(),onmessage:null as any}
 constructor(){workers.push(this)}
}
function setup(){
 vi.useFakeTimers();sources.length=0;workers.length=0
 vi.stubGlobal('EventSource',Source);vi.stubGlobal('SharedWorker',Worker)
 const document=Object.assign(new EventTarget(),{visibilityState:'visible'})
 vi.stubGlobal('document',document);vi.stubGlobal('window',new EventTarget())
 return document
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
it('uses worker updates, rejects another notebook, and releases the worker on close',()=>{
 const doc=setup(),update=vi.fn(),connected=vi.fn(),close=liveNotebook('p',update,connected),worker=workers[0]
 expect(sources).toHaveLength(0);expect(worker.port.postMessage).toHaveBeenCalledWith({type:'watch',id:'p'})
 worker.port.onmessage({data:{snapshot:{project:{id:'other'}}}});expect(update).not.toHaveBeenCalled()
 worker.port.onmessage({data:{connected:true}});expect(connected).toHaveBeenLastCalledWith(true)
 worker.port.onmessage({data:{snapshot:{project:{id:'p'}}}});expect(update).toHaveBeenCalledOnce()
 worker.port.onmessage({data:{snapshot:{project:{id:'p'}}}});expect(update).toHaveBeenCalledOnce()
 doc.dispatchEvent(new Event('visibilitychange'));expect(worker.port.postMessage).toHaveBeenLastCalledWith({type:'watch',id:'p'})
 vi.advanceTimersByTime(30000);expect(worker.port.postMessage).toHaveBeenLastCalledWith({type:'ping'})
 close();expect(worker.port.postMessage).toHaveBeenLastCalledWith({type:'stop'});expect(worker.port.close).toHaveBeenCalledOnce()
 const calls=worker.port.postMessage.mock.calls.length;vi.advanceTimersByTime(60000);doc.dispatchEvent(new Event('visibilitychange'))
 expect(worker.port.postMessage).toHaveBeenCalledTimes(calls)
})
it('falls back once if a worker cannot start, without leaving its heartbeat or port open',()=>{
 setup();const update=vi.fn(),connected=vi.fn(),close=liveNotebook('p',update,connected),worker=workers[0]
 worker.onerror();worker.onerror();expect(sources).toHaveLength(1);expect(worker.port.close).toHaveBeenCalledOnce()
 sources[0].onmessage({data:JSON.stringify({project:{id:'p'}})});expect(update).toHaveBeenCalledOnce()
 const calls=worker.port.postMessage.mock.calls.length;vi.advanceTimersByTime(5000);expect(worker.port.postMessage).toHaveBeenCalledTimes(calls)
 close();expect(sources[0].close).toHaveBeenCalledOnce()
})
