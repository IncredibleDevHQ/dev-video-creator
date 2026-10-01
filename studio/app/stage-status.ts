import type {Snapshot} from '../shared/api'
export const stageStatus=(snapshot:Snapshot,stage:string,connected=true)=>{
 let label='',active=false
 if(stage==='presentation'){
  label=snapshot.status==='ready'?'Ready':snapshot.status==='failed'?'Needs attention':snapshot.stopping?'Stopping':'Processing'
  active=snapshot.status==='building' && !snapshot.stopping
 }else if(stage==='video' && snapshot.project.video){
  const video=snapshot.project.video
  active=video.phase==='preparing' || video.phase==='joining' || video.scenes.some(scene=>['writing','replanning','changing','producing'].includes(scene.phase))
  const scenesReady=video.scenes.length>0 && video.scenes.every(scene=>snapshot.views?.scenes[scene.id]?.produced)
  const needsRecording=video.scenes.some(scene=>(snapshot.views?.scenes[scene.id]?.openMomentIds.length || 0)>0)
  label=active?'Processing':video.phase==='failed' || video.scenes.some(scene=>scene.phase==='failed')?'Needs attention':snapshot.views?.video.action==='export'?'Ready':video.scenes.some(scene=>scene.phase==='queued')?'Waiting':scenesReady?'Ready to assemble':needsRecording?'Needs recording':'Ready to prepare'
 }
 if(active && snapshot.readOnly){label='Saved';active=false}
 else if(active && !connected){label='Reconnecting';active=false}
 const state=active?'is-processing':label==='Ready'?'is-ready':label==='Needs attention'?'needs-attention':'is-idle'
 const icon=label==='Ready'?'<path d="m3 7 2.5 2.5L11 4"/>':label==='Needs attention'?'<circle cx="7" cy="7" r="5.25"/><path d="M7 4v3M7 9.5v.1"/>':'<circle cx="7" cy="7" r="2" fill="currentColor" stroke="none"/>'
 return label?`<span class="stage-status ${state}" title="${label}"><span class="sr"> · ${label}</span>${active?'':`<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`}</span>`:''
}
