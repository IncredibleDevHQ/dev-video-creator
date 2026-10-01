import type {Project,VideoSettings} from '../shared/model'
import {button,escape} from './ui'
export function videoSettingsEffect(project:Project,next:VideoSettings){
 const video=project.video!
 const presenceChanged=video.settings.presence!==next.presence
 const voiceChanged=video.settings.voice.kind!==next.voice.kind || ('id' in video.settings.voice?video.settings.voice.id:null)!==('id' in next.voice?next.voice.id:null)
 const replanned=presenceChanged?video.scenes.flatMap((scene,index)=>scene.presence===null?[index+1]:[]):[]
 return {replanned,voiceChanged,changed:presenceChanged || voiceChanged,custom:video.scenes.filter(scene=>scene.presence!==null).length,recordings:video.scenes.reduce((count,scene)=>count+scene.moments.filter(moment=>moment.take).length,0)}
}
export function videoSettingsPreview(project:Project,next:VideoSettings){
 const effect=videoSettingsEffect(project,next)
 return `<p class="eyebrow">NOTEBOOK SETTINGS</p><h2>${effect.changed?'Review your changes':'No settings changed'}</h2>${effect.replanned.length?`<p>Re-plan ${effect.replanned.length===1?'scene':'scenes'} ${escape(effect.replanned.join(', '))} with the ${escape(next.presence)} on-camera setting.</p>`:''}${effect.changed && !effect.replanned.length && project.video!.settings.presence!==next.presence?`<p>The notebook camera default becomes ${escape(next.presence)}. Existing scenes keep their custom camera choices.</p>`:''}${effect.custom && effect.replanned.length?`<p>${effect.custom} ${effect.custom===1?'scene has its':'scenes have their'} own camera setting and will keep it.</p>`:''}${effect.voiceChanged?'<p>The voice change applies to the whole notebook. Scenes will need finishing again with the new voice; saved animations can be reused.</p>':''}${effect.voiceChanged && next.voice.kind==='record'?'<p>Unrecorded dialogue will need your take before those scenes can finish.</p>':''}${effect.recordings && effect.changed?'<p>Saved recordings are retained. Replanning keeps the takes that still match the dialogue and recording requirements.</p>':''}${effect.changed?button(effect.replanned.length?'Apply and re-plan':'Apply settings','confirm-video-settings',true):''}${button('Back to settings','video-settings')}<p id="error" role="alert"></p>`
}
