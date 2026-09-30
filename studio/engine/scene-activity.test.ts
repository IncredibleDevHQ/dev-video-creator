import {expect,it} from 'vitest'
import {sceneActivityRail} from '../app/scene-activity'
import type {Snapshot} from '../shared/api'
import type {Scene} from '../shared/model'
it('shows animation before voice on a first animation run and omits unneeded recording steps',()=>{
 const scene={id:'scene',phase:'producing',moments:[{camera:'none'}],creativePlan:{recordId:'plan',inputKey:'plan'},produced:null} as Scene
 const snapshot={project:{video:{settings:{voice:{kind:'ai'}}}},events:[{kind:'scene',sceneId:'scene',message:'Building the scene',time:'2026-10-01T00:00:00Z'}]} as Snapshot
 const building=sceneActivityRail(snapshot,scene,true)
 expect(building).toContain('<p>Animation</p>');expect(building).not.toContain('<p>Voice</p>')
 snapshot.events.push({...snapshot.events[0],message:'Produced'})
 const finished=sceneActivityRail(snapshot,scene,true)
 expect(finished).not.toContain('Your recordings')
 scene.moments[0].camera='full'
 expect(sceneActivityRail(snapshot,scene,true)).toContain('Your recordings')
})
