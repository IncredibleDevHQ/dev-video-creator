import type {Snapshot} from '../shared/api'
import type {UsageTotal} from '../shared/usage'
export const compactTokens=(value:number)=>value>=1_000_000?`${Number((value/1_000_000).toFixed(1))}M`:value>=1_000?`${Number((value/1_000).toFixed(1))}K`:String(value)
const count=(value:number)=>`<span title="${value.toLocaleString('en-US')} tokens">${compactTokens(value)}</span>`
const label=(value?:UsageTotal)=>!value?.reportedRuns?'Unavailable':`${count(value.tokens)}${value.partial?' · partial':''}`
const breakdown=(value?:UsageTotal)=>!value?.reportedRuns?'No token usage reported by this harness.':`${count(value.input)} input · ${count(value.output)} output · ${count(value.cacheRead)} cache read · ${count(value.cacheWrite)} cache write. Usage reported for ${value.reportedRuns} of ${value.totalRuns} runs.`
export const tokenUsage=(snapshot:Snapshot,sceneId:string)=>{
 const usage=snapshot.tokenUsage
 return `<details class="token-usage"><summary>Token usage <span>${label(usage?.scenes[sceneId])}</span></summary><dl><div><dt>This scene</dt><dd>${label(usage?.scenes[sceneId])}</dd></div><div><dt>Notebook total</dt><dd>${label(usage?.total)}</dd></div></dl><p>${breakdown(usage?.scenes[sceneId])}</p><p>Notebook total includes shared planning, slides, scenes and retries. Cached tokens are included; token counts are not a cost estimate.</p></details>`
}
