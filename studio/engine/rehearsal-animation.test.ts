import {expect,it,vi} from 'vitest'
import {syncRehearsalAnimation} from '../app/rehearsal-animation'
import type {Scene} from '../shared/model'
it('plays saved animation on the moment clock and holds its final frame for a longer take',()=>{
 const player={readyState:1,currentTime:0,playbackRate:1,play:vi.fn(async()=>{}),pause:vi.fn()}
 const root={querySelector:()=>player} as unknown as ParentNode
 const scene={animationKey:'key',animation:{inputKey:'key',moments:[{id:'one',start:0,end:4}]},moments:[{id:'one',start:0,end:8}]} as Scene
 syncRehearsalAnimation(root,scene,0,2,true)
 expect(player.currentTime).toBe(1);expect(player.playbackRate).toBe(.5);expect(player.play).toHaveBeenCalledOnce()
 syncRehearsalAnimation(root,scene,0,10,true)
 expect(player.currentTime).toBe(4);expect(player.pause).toHaveBeenCalledOnce()
 syncRehearsalAnimation(root,scene,0,0,false)
 expect(player.currentTime).toBe(0);expect(player.pause).toHaveBeenCalledTimes(2)
})
