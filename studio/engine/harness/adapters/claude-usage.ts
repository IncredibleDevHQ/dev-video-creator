import type {TokenUsage} from '../../../shared/usage'
export type UsageState={messages?:Map<string,TokenUsage>}
const parse=(value:unknown,final:boolean):TokenUsage|null=>{
 if(!value || typeof value!=='object')return null
 const raw=value as Record<string,unknown>
 if(!['input_tokens','output_tokens','cache_read_input_tokens','cache_creation_input_tokens'].some(k=>typeof raw[k]==='number' && Number.isSafeInteger(raw[k]) && (raw[k] as number)>=0))return null
 const count=(key:string)=>typeof raw[key]==='number' && Number.isSafeInteger(raw[key]) && raw[key]>=0?raw[key] as number:0
 return {input:count('input_tokens'),output:count('output_tokens'),cacheRead:count('cache_read_input_tokens'),cacheWrite:count('cache_creation_input_tokens'),final}
}
export const claudeUsage=(message:Record<string,unknown>,state:UsageState):TokenUsage|null=>{
 if(message.type==='result')return parse(message.usage,true)
 if(message.type!=='assistant')return null
 const assistant=message.message as Record<string,unknown>|undefined
 if(typeof assistant?.id!=='string')return null
 const usage=parse(assistant.usage,false);if(!usage)return null
 state.messages ||= new Map()
 const previous=state.messages.get(assistant.id)
 if(previous)for(const k of ['input','output','cacheRead','cacheWrite'] as const)usage[k]=Math.max(previous[k],usage[k])
 state.messages.set(assistant.id,usage)
 return [...state.messages.values()].reduce((a,b)=>({input:a.input+b.input,output:a.output+b.output,cacheRead:a.cacheRead+b.cacheRead,cacheWrite:a.cacheWrite+b.cacheWrite,final:false}),{input:0,output:0,cacheRead:0,cacheWrite:0,final:false})
}
