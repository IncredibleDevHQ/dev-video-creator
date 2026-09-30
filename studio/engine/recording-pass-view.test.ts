import {expect,it} from 'vitest'
import {recordingSetup,recordingPassSetup} from '../app/recording-setup'
import type {Moment} from '../shared/model'
const moment={id:'a',title:'Opening',lines:'A short line',camera:'full'} as Moment
it('offers the open pass without changing the single-moment recording default',()=>{
 expect(recordingSetup(moment,2,3)).toContain('Record all 3 open moments instead')
 expect(recordingSetup(moment,2,1)).not.toContain('record-open')
 expect(recordingSetup(moment,2,3)).toContain('YOUR TURN · MOMENT 3')
})
it('explains advancement, stopping, permissions and the exact included moments',()=>{
 const html=recordingPassSetup([moment,{...moment,id:'b',title:'Closing'}],[0,5])
 expect(html).toContain('Moment 1');expect(html).toContain('Moment 6')
 expect(html).toContain('<kbd>Enter</kbd>');expect(html).toContain('<kbd>Esc</kbd>')
 expect(html).toContain('camera and microphone');expect(html).toContain('Stop the pass after')
 expect(html).toContain('saved takes stay unchanged')
})
