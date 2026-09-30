import {it,expect,vi,afterEach} from 'vitest'
import {PracticePlayback} from '../app/practice'
import type {PracticeTrack} from '../shared/practice'
class FakeAudio{
 static instances:FakeAudio[]=[]
 currentTime=0;onended:(()=>void)|null=null;onerror:(()=>void)|null=null
 pause=vi.fn();play=vi.fn(async()=>{});removeAttribute=vi.fn();load=vi.fn();remove=vi.fn()
 constructor(public src:string){FakeAudio.instances.push(this)}
}
const track:PracticeTrack={inputKey:'key',duration:5,clips:[{momentId:'m',lines:'Read this',camera:true,start:0,end:2,sceneStart:10,sceneEnd:12},{momentId:'m',lines:'Listen here',camera:false,start:2,end:5,sceneStart:12,sceneEnd:16,objectKey:'audio.mp3'}]}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();FakeAudio.instances=[]})
it('lets the speaker rehearse, then uses media time rather than the wall clock while sound buffers',()=>{
 vi.useFakeTimers();vi.stubGlobal('Audio',FakeAudio);vi.stubGlobal('document',{body:{append:vi.fn()}});vi.spyOn(performance,'now').mockImplementation(()=>Date.now())
 const frame=vi.fn(),ended=vi.fn(),failed=vi.fn(),player=new PracticePlayback(frame,ended,failed)
 player.start(track);expect(FakeAudio.instances).toHaveLength(0)
 vi.advanceTimersByTime(2100);expect(FakeAudio.instances).toHaveLength(1)
 const audio=FakeAudio.instances[0];vi.advanceTimersByTime(6000)
 expect(player.active).toBe(true);expect(frame.mock.lastCall?.[1]).toBe(12)
 audio.currentTime=1.5;vi.advanceTimersByTime(100);expect(frame.mock.lastCall?.[1]).toBe(14)
 audio.onended?.();expect(player.active).toBe(false);expect(ended).toHaveBeenCalledOnce();expect(audio.remove).toHaveBeenCalledOnce();expect(failed).not.toHaveBeenCalled()
 vi.restoreAllMocks()
})
it('stops and releases sound on navigation, ignoring late media completion',()=>{
 vi.useFakeTimers();vi.stubGlobal('Audio',FakeAudio);vi.stubGlobal('document',{body:{append:vi.fn()}})
 const ended=vi.fn(),player=new PracticePlayback(vi.fn(),ended,vi.fn())
 player.start({...track,clips:[track.clips[1]]});const audio=FakeAudio.instances[0],late=audio.onended
 player.stop();late?.();expect(audio.pause).toHaveBeenCalled();expect(audio.removeAttribute).toHaveBeenCalledWith('src');expect(ended).not.toHaveBeenCalled();expect(player.active).toBe(false)
})
