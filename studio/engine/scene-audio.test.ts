import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it,expect,afterAll,vi } from 'vitest'
import { normalizeMoments } from './moment-plan'
const { align } = vi.hoisted(() => ({align:vi.fn()}))
vi.mock('./take-clock',async importOriginal => ({...await importOriginal<typeof import('./take-clock')>(),alignTake:align}))
const root = await mkdtemp(join(tmpdir(),'minimal-audio-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { prepareMomentAudio } = await import('./scene-audio')
const { probeSeconds,runCommand,systemVoiceAvailable } = await import('./voice')
const { dataRoot,storeAsset } = await import('./persistence')
const { readFile } = await import('node:fs/promises')
afterAll(() => rm(root,{recursive:true,force:true}))
const voiceTest=it.skipIf(!(await systemVoiceAvailable()))
// These integration cases use the real local OS voice, available on macOS only.
voiceTest('speaks an auto moment and uses measured sound as its clock',async () => {
  const moment = normalizeMoments({moments:[{title:'One',lines:'Every request spends one token.',seconds:8,camera:'none',layout:'corner',overlay:null,cue:''}]},'s','off','body')[0]
  const made = await prepareMomentAudio('p','s',moment,{kind:'ai',id:'default'})
  expect(made.audio?.duration).toBeGreaterThan(1)
  expect(made.audio?.duration).toBeLessThan(8)
  expect(await probeSeconds(join(dataRoot,'objects',made.audio!.objectKey))).toBeCloseTo(made.audio!.duration!,2)
  expect(made.media?.clips.every(clip => !clip.camera)).toBe(true)
  expect(await prepareMomentAudio('p','s',made,{kind:'ai',id:'default'})).toBe(made)
},20000)
voiceTest('mixes recorded and generated segments and retains camera source offsets',async () => {
  const moments = normalizeMoments({moments:[{title:'One',lines:'Requests arrive. Tokens refill.',seconds:4,camera:'start',layout:'corner',overlay:null,cue:'',segments:[{lines:'Requests arrive.',seconds:2,camera:true},{lines:'Tokens refill.',seconds:2,camera:false}]},{title:'End',lines:'That is the rule.',seconds:2,camera:'full',layout:'corner',overlay:null,cue:''}]},'s','high','body')
  const moment = moments[0]
  const fixture = join(root,'take.webm')
  await runCommand('ffmpeg',['-y','-f','lavfi','-i','color=c=green:s=160x90:r=15','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libvpx','-deadline','realtime','-c:a','libopus',fixture])
  const asset = await storeAsset({body:await readFile(fixture),contentType:'video/webm',kind:'test-fixture',extension:'.webm'})
  moment.take = {id:'take',recordingKey:moment.recordingKey,objectKey:asset.objectKey,duration:4}
  align.mockResolvedValue(moment.segments!.map((segment,index) => ({id:segment.id,say:segment.lines,words:[{word:segment.lines,startMs:index*2000,endMs:(index+1)*2000}],coverage:1,startMs:index*2000,durationMs:2000,review:null})))
  const made = await prepareMomentAudio('p','s',moment,{kind:'ai',id:'default'})
  expect(made.media!.clips.map(clip => clip.camera)).toEqual([true,false])
  expect(made.media!.clips[0].videoFrom).toBe(0)
  expect(made.media!.clips[1].videoKey).toBeUndefined()
  expect(made.media!.clips[1].end).toBeGreaterThan(made.media!.clips[0].end)
  expect(made.audio!.duration).toBeGreaterThan(3)
},20000)
