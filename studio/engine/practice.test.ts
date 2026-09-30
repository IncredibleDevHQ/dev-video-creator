import {it,expect,afterAll,vi} from 'vitest'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {normalizeMoments} from './moment-plan'
const {speak}=vi.hoisted(()=>({speak:vi.fn(async()=>({audio:Buffer.from('synthetic test audio'),duration:3,moments:[],provider:'test'}))}))
vi.mock('./voice',()=>({narrationClock:speak}))
vi.mock('./voice-library',()=>({resolveVoice:vi.fn(async()=>({kind:'system',voice:'Samantha'}))}))
const root=await mkdtemp(join(tmpdir(),'minimal-practice-test-'));process.env.MINIMAL_STUDIO_DATA_DIR=root
const {writeRow,readRow,listRows,readAsset}=await import('./persistence')
const {preparePractice}=await import('./practice')
afterAll(()=>rm(root,{recursive:true,force:true}))
it('persists only off-camera rehearsal sound, reuses it, and leaves takes and final scene clocks untouched',async()=>{
 const moments=normalizeMoments({moments:[{title:'One',lines:'A request arrives. Tokens refill.',seconds:6,camera:'start',layout:'corner',overlay:null,cue:'Explain',segments:[{lines:'A request arrives.',camera:true,seconds:2},{lines:'Tokens refill.',camera:false,seconds:4}]},{title:'End',lines:'That is the rule.',seconds:2,camera:'full',layout:'corner',overlay:null,cue:''}]},'s','high','body')
 const saved={project:{id:'p',slides:[],video:{settings:{presence:'high',voice:{kind:'ai',id:'default'}},scenes:[{id:'s',moments}],transitions:[]}},status:'ready',events:[]}
 await writeRow('projects','p',saved)
 const track=await preparePractice('p','s',moments[0].id)
 expect(track.clips.map(clip=>clip.camera)).toEqual([true,false]);expect(track.duration).toBe(5)
 expect(track.clips[1].sceneStart).toBe(2);expect(track.clips[1].sceneEnd).toBe(6)
 expect(track.clips[0].objectKey).toBeUndefined();expect(await readAsset(track.clips[1].objectKey!)).toEqual(Buffer.from('synthetic test audio'))
 expect(await readRow('projects','p')).toEqual(saved)
 expect(await preparePractice('p','s',moments[0].id)).toEqual(track);expect(speak).toHaveBeenCalledTimes(1)
 const assets=await Promise.all((await listRows('assets')).map(id=>readRow<any>('assets',id)));expect(assets.filter(row=>row.kind==='practice-voice').every(row=>row.projectId==='p' && row.sceneId==='s')).toBe(true)
})
it('record-your-own voice rehearsal stays silent and rejects unknown moments',async()=>{
 const moments=normalizeMoments({moments:[{title:'Read',lines:'Your own words.',seconds:4,camera:'none',layout:'corner',overlay:null,cue:''}]},'s2','off','body')
 await writeRow('projects','p2',{project:{id:'p2',slides:[],video:{settings:{presence:'off',voice:{kind:'record'}},scenes:[{id:'s2',moments}],transitions:[]}},status:'ready',events:[]})
 const track=await preparePractice('p2','s2',moments[0].id);expect(track.duration).toBe(4);expect(track.clips[0].objectKey).toBeUndefined()
 await expect(preparePractice('p2','s2','missing')).rejects.toThrow('does not exist')
})
