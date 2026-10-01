import {button} from './ui'
export function practiceControls(phase:'ready'|'countdown'|'running'|'finished',next?:string){
 if(phase==='ready')return `${button('<span aria-hidden="true">▶</span> Start practice','practice-start',true)}<span class="practice-action-hint">3-second countdown</span>`
 if(phase==='countdown')return button('Cancel countdown','practice')
 if(phase==='running')return `${next?button(next,'practice-next',true):button('<span aria-hidden="true">■</span> Finish practice','practice',true)}<span class="practice-action-hint">${next?'Enter to advance · ':''}Esc to stop</span>`
 return `${button('Practice again','practice-replay',true)}`
}

export const recordControl=()=>'<button type="button" class="record-entry" data-action="record-moment" aria-label="Record this moment" title="Open recording setup"><span class="record-entry-dot" aria-hidden="true"></span><span>Record</span></button>'
