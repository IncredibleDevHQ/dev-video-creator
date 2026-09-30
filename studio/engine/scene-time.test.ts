import {expect,it} from 'vitest'
import {sceneTimeMap} from '../shared/scene-time'
it('keeps content aligned across longer and shorter recorded moments, including reverse seeks',()=>{
 const map=sceneTimeMap([{start:0,end:6,sceneStart:0,sceneEnd:3},{start:6,end:8,sceneStart:3,sceneEnd:7}])
 expect([0,3,6,7,8].map(map)).toEqual([0,1.5,3,5,7])
 expect([8,7,6,3,0].map(map)).toEqual([7,5,3,1.5,0])
 expect(map(-1)).toBe(0);expect(map(100)).toBe(7)
})
it('preserves absolute scene position when rehearsing only one later moment',()=>{
 const map=sceneTimeMap([{start:0,end:4,sceneStart:20,sceneEnd:26}])
 expect(map(2)).toBe(23)
})
it('refuses missing, overlapping, zero-length, or discontinuous intervals',()=>{
 expect(()=>sceneTimeMap([])).toThrow()
 expect(()=>sceneTimeMap([{start:0,end:0,sceneStart:0,sceneEnd:1}])).toThrow()
 const first={start:0,end:2,sceneStart:0,sceneEnd:2}
 expect(()=>sceneTimeMap([first,{start:1,end:4,sceneStart:2,sceneEnd:4}])).toThrow('continuous')
 expect(()=>sceneTimeMap([first,{start:2,end:4,sceneStart:3,sceneEnd:4}])).toThrow('continuous')
 expect(()=>sceneTimeMap([{...first,end:Infinity}])).toThrow()
 expect(()=>sceneTimeMap([first])(NaN)).toThrow('finite')
})
