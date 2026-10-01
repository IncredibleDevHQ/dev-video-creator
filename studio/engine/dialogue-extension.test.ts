import {it,expect,afterAll} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {normalizeMoments} from './moment-plan'
import {refreshVideoKeys} from './scene-model'
import {animationSecond} from '../shared/scene-time'
import {dialogueBoundary,dialogueWordAt} from '../shared/dialogue'
import type {Snapshot} from '../shared/api'
const root=await mkdtemp(join(tmpdir(),'dialogue-extension-'))
process.env.MINIMAL_STUDIO_DATA_DIR=root
const {writeRow}=await import('./persistence')
const {saveDialogueExtension}=await import('./dialogue-extension')
const {loadProject}=await import('./projects')
afterAll(()=>rm(root,{recursive:true,force:true}))
it('persists an extension, holds animation, retains old take and rejects stale edits',async()=>{
 const moments=normalizeMoments({moments:[{title:'Hello',lines:'One two three four.',seconds:6,camera:'full',layout:'beside-slide',overlay:null,cue:''},{title:'Next',lines:'Next scene.',seconds:3,camera:'full',layout:'corner',overlay:null,cue:''}]},'s','high','body')
 const snapshot:Snapshot={status:'ready',error:null,events:[],project:{id:'extension',title:'Test',source:'Text',slides:[{id:'a',title:'A',svg:'<svg/>'}],video:{settings:{presence:'high',voice:{kind:'record'}},scenes:[{id:'s',slideId:'a',phase:'waiting',presence:null,moments,inputKey:'',produced:null,error:null}],transitions:[],inputKey:'',produced:null}}}
 refreshVideoKeys(snapshot.project)
 const scene=snapshot.project.video!.scenes[0],key=scene.animationKey!,recordingKey=moments[0].recordingKey
 scene.animation={inputKey:key,objectKey:'retained.mp4',moments:moments.map(({id,start,end})=>({id,start,end}))}
 moments[0].take={id:'old',objectKey:'old.webm',recordingKey,duration:6}
 await writeRow('projects','extension',snapshot)
 const result=await saveDialogueExtension('extension','s',moments[0].id,{text:'More words for the speaker.',recordingKey})
 const updated=result.project.video!.scenes[0],m=updated.moments[0]
 expect(updated.animationKey).toBe(key);expect(updated.animation?.objectKey).toBe('retained.mp4')
 expect(m.take?.id).toBe('old');expect(m.take?.recordingKey).not.toBe(m.recordingKey)
 expect(dialogueBoundary(m)).toBe(6);expect(animationSecond(updated,7,true)).toBe(6)
 expect(dialogueWordAt(m,6)).toBe(4);expect(updated.moments[1].start).toBe(8)
 expect((await loadProject('extension'))!.project.video!.scenes[0].moments[0].extension?.text).toBe('More words for the speaker.')
 await expect(saveDialogueExtension('extension','s',m.id,{text:'Stale change',recordingKey})).rejects.toThrow('dialogue changed')
 const removed=await saveDialogueExtension('extension','s',m.id,{text:'',recordingKey:m.recordingKey})
 expect(removed.project.video!.scenes[0].animationKey).toBe(key)
 expect(removed.project.video!.scenes[0].moments[0].lines).toBe('One two three four.')
})
