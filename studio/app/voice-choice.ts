import type { Voice } from '../shared/model'
import type { StudioSettings } from '../shared/settings'
import { escape } from './ui'
export const voiceValue=(voice:Voice) => voice.kind==='record'?'record':`${voice.kind}:${voice.id}`
export const parseVoice=(value:string):Voice => {
  if(value==='record') return {kind:'record'}
  const colon=value.indexOf(':');const kind=value.slice(0,colon);const id=value.slice(colon+1)
  if(!['ai','clone'].includes(kind) || !id) throw new Error('Choose a voice')
  return {kind:kind as 'ai'|'clone',id}
}
export const voiceChoices=(settings:StudioSettings,selected:Voice) => {
  const option=(voice:Voice,label:string) => `<option value="${escape(voiceValue(voice))}" ${voiceValue(voice)===voiceValue(selected)?'selected':''}>${escape(label)}</option>`
  const legacy=selected.kind==='ai' && selected.id==='default'?option(selected,'System default voice'):''
  const available=selected.kind==='record' || legacy || settings.voice.clones.some(clone => clone.state==='ready' && selected.kind==='clone' && clone.id===selected.id) || settings.voice.choices.some(choice => selected.kind==='ai' && choice.id===selected.id)
  const missing=available?'':`<option selected disabled value="${escape(voiceValue(selected))}">Voice unavailable · choose a replacement</option>`
  return missing+option({kind:'record'},'I record it')+legacy+settings.voice.clones.filter(clone => clone.state==='ready').map(clone => option({kind:'clone',id:clone.id},'My voice clone')).join('')+settings.voice.choices.map(choice => option({kind:'ai',id:choice.id},`${choice.name} · ${choice.language}`)).join('')
}
