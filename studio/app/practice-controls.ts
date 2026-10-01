import {button} from './ui'
export function practiceControls(phase:'ready'|'countdown'|'running'|'finished',next?:string){
 if(phase==='ready')return `${button('Start practice','practice-start',true)}<span class="practice-action-hint">3-second countdown</span>${button('Record instead','record-moment')}`
 if(phase==='countdown')return button('Cancel countdown','practice')
 if(phase==='running')return `${next?button(next,'practice-next',true):button('Finish practice','practice',true)}<span class="practice-action-hint">${next?'Enter to advance · ':''}Esc to stop</span>`
 return `${button('Practice again','practice-replay',true)}${button('Record instead','record-moment')}`
}
