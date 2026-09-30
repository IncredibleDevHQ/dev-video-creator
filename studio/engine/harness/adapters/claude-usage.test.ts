import {expect,it} from 'vitest'
import {claudeUsage,type UsageState} from './claude-usage'
import {sumUsage} from '../../../shared/usage'
it('deduplicates assistant usage and uses final run totals without adding them twice',()=>{
 const state:UsageState={}
 const msg={type:'assistant',message:{id:'one',usage:{input_tokens:10,output_tokens:2,cache_read_input_tokens:20}}}
 expect(claudeUsage(msg,state)?.input).toBe(10)
 expect(claudeUsage(msg,state)?.input).toBe(10)
 const final=claudeUsage({type:'result',usage:{input_tokens:15,output_tokens:8,cache_read_input_tokens:25}},state)!
 expect(final).toEqual({input:15,output:8,cacheRead:25,cacheWrite:0,final:true})
 const totals=sumUsage([{sceneId:'a',usage:final},{sceneId:'a'},{usage:{...final,input:5}}])
 expect(totals.scenes.a.tokens).toBe(48)
 expect(totals.scenes.a.partial).toBe(true)
 expect(totals.total.tokens).toBe(86)
 expect(totals.total.totalRuns).toBe(3)
})
it('keeps missing usage unknown and ignores invalid token counts',()=>{
 expect(claudeUsage({type:'result'},{})).toBeNull()
 expect(claudeUsage({type:'result',usage:{input_tokens:-2,output_tokens:Infinity}},{})).toBeNull()
 expect(sumUsage([{}]).total.reportedRuns).toBe(0)
})
