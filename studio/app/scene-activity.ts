import type {Snapshot} from '../shared/api'
import type {Scene} from '../shared/model'
import {escape} from './ui'
export const sceneActivity=(snapshot:Snapshot,scene:Scene)=>{
 const events=snapshot.events.filter(event=>event.kind==='scene' && event.sceneId===scene.id)
 const active=['writing','replanning','changing','producing'].includes(scene.phase)
 const fallback=scene.phase==='producing'?'Producing the scene':scene.phase==='queued'?'Queued':'Planning the scene'
 const latest=events.at(-1)
 const label=active && latest && !['Scene written','Produced'].includes(latest.message)?latest.message:fallback
 // Older notebooks predate typed activity events; recognise only known stage labels.
 const lastStep=[...events].reverse().find(event=>event.activity==='processing' || (!event.activity && /^(Writing the scene|Preparing the scene artwork|Preparing the video brief|Planning the scene|Writing the spoken lines|Creating the scene preview|Preparing voice ·|Building the scene|Rendering the scene|Saving the scene|Producing$)/.test(event.message)))
 return {active,label,stopped:scene.phase==='failed'?lastStep:undefined,events:scene.phase==='queued'?[]:events}
}
const legacyStages=[
 {label:'Scene artwork',match:/Preparing the scene artwork/},
 {label:'Video brief',match:/Preparing the video brief/},
 {label:'Creative plan',match:/Planning the scene/},
 {label:'Spoken lines',match:/Writing the spoken lines|Scene written|Transcript ready/},
 {label:'Voice',match:/Preparing voice|^Producing$/},
 {label:'Video composition',match:/Building the scene|Creating the scene preview/},
 {label:'Render',match:/Rendering the scene/},
 {label:'Save video',match:/Saving the scene|^Produced$/},
]
export const sceneActivityRail=(snapshot:Snapshot,scene:Scene,connected:boolean)=>{
 const {active,events}=sceneActivity(snapshot,scene)
 const produced=!!snapshot.views?.scenes[scene.id]?.produced
 const animationReady=Boolean(scene.animation && scene.animation.inputKey===scene.animationKey)
 const needsRecording=scene.moments.some(moment=>moment.camera!=='none') || snapshot.project.video?.settings.voice.kind==='record'
 const stages=scene.animation || scene.creativePlan && !scene.produced || events.some(e=>e.message==='Rendering the animation')?[...legacyStages.slice(0,4),{label:'Animation',match:/Building the scene/},{label:'Animation render',match:/Rendering the animation|Animation ready/},...(needsRecording?[{label:'Your recordings',match:/moments? recorded/}]:[]),{label:'Voice',match:/Preparing voice/},{label:'Final render',match:/Rendering the scene/},legacyStages[7]]:legacyStages
 const reached=stages.map(stage=>events.filter(event=>stage.match.test(event.message)).at(-1))
 // The latest run determines the frontier; a retry revisits that row rather
 // than appending another run of steps. Historical errors remain in History.
 const latest=[...events].reverse().find(event=>stages.some(stage=>stage.match.test(event.message)))
 const frontier=produced?stages.length-1:Math.max(0,stages.findIndex(stage=>latest && stage.match.test(latest.message)))
 const live=active && connected && !snapshot.readOnly
 const intro=snapshot.readOnly?'Saved activity. No generation is running in this copy.':produced?'Video ready':!connected?'Reconnecting to live activity…':scene.phase==='failed'?'Paused at the step below':active?'Creating your scene':animationReady?'Animation ready · add your recordings when you’re ready':scene.moments.length?'Plan ready':'Waiting to start'
 return `<div class="scene-activity"><p class="activity-intro">${intro}</p><ol class="activity-log" aria-label="Scene activity">${stages.slice(0,frontier+1).map((step,index)=>{
  const state=produced || animationReady && !active && index<=5 || index<frontier || !active && scene.phase!=='failed' && index===3?'completed':scene.phase==='failed' && index===frontier?'stopped':live && index===frontier?'current':''
  const event=reached[index]
  return `<li class="${state}"><span class="activity-marker" aria-hidden="true">${state==='completed'?'✓':''}</span><div><p>${step.label}</p>${state==='stopped'?'<span class="activity-stopped-label">Stalled</span>':''}${event?`<time datetime="${escape(event.time)}">${escape(new Date(event.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</time>`:''}</div></li>`
 }).join('')}</ol></div>`
}
