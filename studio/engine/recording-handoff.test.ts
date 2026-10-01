import {expect,it} from 'vitest'
import {recordingHandoff} from '../app/recording-handoff'
import type {Snapshot} from '../shared/api'
import type {Scene} from '../shared/model'
it('explains a saved recording until the scene is finished, including after reload',()=>{
 const scene={id:'s',phase:'waiting'} as Scene
 const snapshot={events:[{kind:'scene',sceneId:'s',message:'1 moment recorded'}],views:{scenes:{s:{produced:false,openMomentIds:[]}}}} as unknown as Snapshot
 expect(recordingHandoff(snapshot,scene)).toContain('Recording saved')
 expect(recordingHandoff(snapshot,scene)).toContain('combine your recording')
 snapshot.views!.scenes.s.openMomentIds=['outro']
 expect(recordingHandoff(snapshot,scene)).toContain('1 moment still needs recording')
 snapshot.views!.scenes.s.produced=true
 expect(recordingHandoff(snapshot,scene)).toBe('')
})
it('does not confuse an older saved take with a current processing or failed operation',()=>{
 const snapshot={events:[{kind:'scene',sceneId:'s',message:'1 moment recorded'}]} as Snapshot
 for(const phase of ['producing','failed'] as const)expect(recordingHandoff(snapshot,{id:'s',phase} as Scene)).toBe('')
 expect(recordingHandoff(snapshot,{id:'other',phase:'waiting'} as Scene)).toBe('')
})
