import {parseHTML} from 'linkedom'
import {afterEach,expect,it,vi} from 'vitest'
import {standInControls,standInPlayback} from '../app/stand-in-playback'
import type {Scene} from '../shared/model'
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
function setup(){
 const {document,window,Event}=parseHTML(`<html><body><div id="app"><video data-rehearsal-animation></video>${standInControls()}<button data-moment="0">Moment</button></div></body></html>`)
 const frames=new Map<number,FrameRequestCallback>();let id=0
 vi.stubGlobal('window',window);vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id});vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id))
 const root=document.querySelector('#app') as unknown as HTMLElement,player=root.querySelector('video')!
 Object.assign(player,{currentTime:30,paused:true,ended:false,play:vi.fn(async()=>{Object.assign(player,{paused:false});player.dispatchEvent(new Event('play',{bubbles:true}))}),pause:vi.fn(()=>{Object.assign(player,{paused:true})})})
 const scene={animationKey:'a',animation:{inputKey:'a',moments:[{id:'m',start:30,end:36}]},moments:[{id:'m',start:48,end:60}]} as Scene
 const update=vi.fn();standInPlayback(root,()=>({scene,index:0}),update)
 return {root,player,update,frames,Event}
}
it('maps animation seeks to the recorded scene clock and stops at the moment boundary',()=>{
 const {root,player,update,frames,Event}=setup()
 const seek=root.querySelector<HTMLInputElement>('[data-stand-in-seek]')!;seek.value='50';seek.dispatchEvent(new Event('input',{bubbles:true}))
 expect(player.currentTime).toBe(33);expect(update).toHaveBeenLastCalledWith(54,false)
 root.querySelector<HTMLElement>('[data-stand-in-play]')!.click()
 player.currentTime=36
 const tick=[...frames.values()][0];frames.clear();tick(0)
 expect(player.paused).toBe(true);expect(frames.size).toBe(0)
 root.querySelector<HTMLElement>('[data-stand-in-play]')!.click();expect(player.currentTime).toBe(30)
})
it('suspends animation frames during buffering and resumes on actual playback',()=>{
 const {root,player,frames,Event}=setup()
 root.querySelector<HTMLElement>('[data-stand-in-play]')!.click();expect(frames.size).toBe(1)
 player.dispatchEvent(new Event('waiting',{bubbles:true}));expect(frames.size).toBe(0)
 expect(root.querySelector('[data-stand-in-status]')!.textContent).toBe('Loading animation…')
 player.dispatchEvent(new Event('playing',{bubbles:true}));expect(frames.size).toBe(1)
 player.dispatchEvent(new Event('error',{bubbles:true}));expect(frames.size).toBe(0)
 expect(root.querySelector('[data-stand-in-status]')!.textContent).toBe('Animation could not load.')
})
