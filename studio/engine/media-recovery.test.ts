import {afterEach,expect,it,vi} from 'vitest'
import {MediaRecovery,mediaRecoveryView} from '../app/media-recovery'
class Media extends EventTarget {
 readyState=0;error=null;currentTime=3.3;duration=36
 load=vi.fn()
}
afterEach(()=>vi.useRealTimers())
it('bounds waiting despite repeated stalled events and never retries automatically',()=>{
 vi.useFakeTimers();const player=new Media(),recovery=new MediaRecovery(()=>{})
 recovery.bind(player as unknown as HTMLMediaElement)
 vi.advanceTimersByTime(6000);player.dispatchEvent(new Event('stalled'))
 vi.advanceTimersByTime(6000);expect(recovery.state).toBe('stalled')
 vi.advanceTimersByTime(120000);expect(player.load).not.toHaveBeenCalled()
 recovery.dispose();expect(vi.getTimerCount()).toBe(0)
})
it('retries the existing file once and restores its position without autoplay',()=>{
 vi.useFakeTimers();const player=new Media(),recovery=new MediaRecovery(()=>{})
 recovery.bind(player as unknown as HTMLMediaElement);player.dispatchEvent(new Event('error'))
 expect(recovery.state).toBe('failed');expect(vi.getTimerCount()).toBe(0)
 recovery.retry();expect(player.load).toHaveBeenCalledTimes(1)
 player.currentTime=0;player.dispatchEvent(new Event('loadedmetadata'));expect(player.currentTime).toBe(3.3)
 player.dispatchEvent(new Event('canplay'));expect(recovery.state).toBe('ready')
 expect(vi.getTimerCount()).toBe(0);recovery.dispose()
})
it('does not let a replaced player affect another scene or leave a retry listener',()=>{
 vi.useFakeTimers();const first=new Media(),next=new Media(),recovery=new MediaRecovery(()=>{})
 recovery.bind(first as unknown as HTMLMediaElement);recovery.retry()
 next.readyState=4;recovery.bind(next as unknown as HTMLMediaElement)
 first.currentTime=0;first.dispatchEvent(new Event('loadedmetadata'));first.dispatchEvent(new Event('error'))
 expect(first.currentTime).toBe(0);expect(recovery.state).toBe('ready');expect(vi.getTimerCount()).toBe(0)
 recovery.bind(null);recovery.dispose()
})
it('offers recovery only after a failure or bounded wait',()=>{
 expect(mediaRecoveryView('ready')).toBe('')
 expect(mediaRecoveryView('loading')).not.toContain('data-reload-media')
 expect(mediaRecoveryView('stalled')).toContain('data-reload-media')
 expect(mediaRecoveryView('failed')).toContain('data-reload-media')
})
