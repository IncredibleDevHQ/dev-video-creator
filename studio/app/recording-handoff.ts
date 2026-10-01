import type {Snapshot} from '../shared/api'
import type {Scene} from '../shared/model'
/** Persisted events, rather than an ephemeral toast, explain the next recording step. */
export function recordingHandoff(snapshot:Snapshot,scene:Scene){
 const view=snapshot.views?.scenes[scene.id]
 if(view?.produced || ['queued','writing','changing','replanning','producing','failed'].includes(scene.phase))return ''
 const saved=snapshot.events.some(event=>event.sceneId===scene.id && event.kind==='scene' && /^\d+ moments? recorded$/.test(event.message))
 if(!saved)return ''
 const remaining=view?.openMomentIds.length || 0
 return `<div class="recording-nudge" role="status"><strong>✓ Recording saved</strong><span>${remaining?`${remaining} ${remaining===1?'moment still needs':'moments still need'} recording. You can record them in any order.`:'Finish this scene to combine your recording with its animation and layout.'}</span></div>`
}
