import {expect,it} from 'vitest'
import {editScopeProblems,scriptEditProblems} from './moment-edit-scope'
import {normalizeMoments} from './moment-plan'
const raw={moments:[0,1].map(index=>({id:`m${index}`,title:`Moment ${index}`,lines:`Line ${index}.`,seconds:4,camera:'none',layout:'corner',overlay:null,cue:'Speak'}))}
const previous=normalizeMoments(raw,'scene','off','body')
it('allows a target duration change and derived clock shifts without changing its neighbor',()=>{
 const candidate=normalizeMoments({moments:raw.moments.map((moment,index)=>({...moment,seconds:index===0?8:4}))},'scene','off','body',previous)
 expect(candidate[1].start).toBe(8)
 expect(scriptEditProblems(previous,candidate,'m0')).toEqual([])
})
it('rejects unrelated words, duration, staging and identity changes',()=>{
 for(const patch of [{lines:'Changed.'},{plannedSeconds:8},{layout:'beside-slide' as const}]) {
  const candidate=structuredClone(previous);Object.assign(candidate[1],patch)
  expect(scriptEditProblems(previous,candidate,'m0')).toEqual(['Keep unrelated moment m1 unchanged'])
 }
 expect(scriptEditProblems(previous,[...previous].reverse(),'m0')).toHaveLength(1)
 expect(scriptEditProblems(previous,previous.slice(0,1),'m0')).toHaveLength(1)
})
it('enforces treatment preservation but permits full scene settings replans',()=>{
 const plan=[{id:'a',purpose:'Explain'},{id:'b',purpose:'Resolve'}]
 expect(editScopeProblems(plan,[plan[0],{id:'b',purpose:'Changed'}],'a')).toHaveLength(1)
 expect(editScopeProblems(plan,[plan[0],{id:'b',purpose:'Changed'}])).toEqual([])
})
