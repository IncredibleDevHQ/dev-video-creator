/** A recorded/rehearsed interval and the animation interval it drives. */
export type SceneTimeSpan={start:number;end:number;sceneStart:number;sceneEnd:number}
/** Map media time to animation time without changing either track's source. */
export const sceneTimeMap=(spans:readonly SceneTimeSpan[])=>{
 if(!spans.length) throw new Error('The scene clock needs at least one interval')
 const clock=spans.map(span=>({...span}))
 for(const [index,span] of clock.entries()){
  if(!Object.values(span).every(Number.isFinite) || span.start<0 || span.sceneStart<0 || span.end<=span.start || span.sceneEnd<=span.sceneStart) throw new Error('The scene clock contains an invalid interval')
  const previous=clock[index-1]
  if(previous && (Math.abs(previous.end-span.start)>1e-6 || Math.abs(previous.sceneEnd-span.sceneStart)>1e-6)) throw new Error('The scene clock intervals must be continuous')
 }
 return (second:number)=>{
  if(!Number.isFinite(second)) throw new Error('The scene clock needs a finite time')
  if(second<=clock[0].start)return clock[0].sceneStart
  if(second>=clock.at(-1)!.end)return clock.at(-1)!.sceneEnd
  const span=clock.find(span=>second<span.end)!
  return span.sceneStart+(second-span.start)/(span.end-span.start)*(span.sceneEnd-span.sceneStart)
 }
}
