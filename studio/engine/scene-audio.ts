import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Moment, Voice, MediaClip } from '../shared/model'
import { readAsset, storeAsset } from './persistence'
import { narrationClock, runCommand, probeSeconds } from './voice'
import { alignTake, takeClockOf } from './take-clock'
import { resolveVoice } from './voice-library'
import { momentAudioKey } from './scene-model'
import { loadStageCheckpoint,saveStageCheckpoint } from './artifacts'
import { fingerprintOf } from './planning/fingerprint'
import { takeFits } from './state'
export const prepareMomentAudio = async (projectId: string, sceneId: string, moment: Moment, voice: Voice): Promise<Moment> => {
  const inputKey = momentAudioKey(moment,voice)
  if (moment.audio?.inputKey === inputKey && moment.media?.inputKey === inputKey) return moment
  if ((voice.kind === 'record' || moment.camera !== 'none') && !takeFits(moment)) throw new Error('Record this moment first')
  const checkpoint=await loadStageCheckpoint<Moment>(projectId,sceneId,`audio-${moment.id}`,inputKey)
  if(checkpoint) {await readAsset(checkpoint.data.audio!.objectKey);return checkpoint.data}
  const take = moment.take
  // Entirely recorded moments use the normalized take directly, with its clock.
  if (moment.camera === 'full' || voice.kind === 'record' && moment.camera === 'none') {
    if (!take?.duration) throw new Error('The recording has no measured clock')
    return { ...moment, audioKey: inputKey, audio: { inputKey, objectKey: take.objectKey, duration: take.duration }, media: { inputKey, clips: [{ start: 0, end: take.duration, camera: moment.camera !== 'none', ...(moment.camera !== 'none' ? { videoKey: take.objectKey, videoFrom: 0 } : {}) }] } }
  }
  const segments = moment.segments || [{ id: `${moment.id}-segment-1`, lines: moment.lines, camera: false, estimate: moment.plannedSeconds || moment.end-moment.start }]
  const temporary = await mkdtemp(join(tmpdir(),'minimal-moment-audio-'))
  try {
    const takePath=join(temporary,'take.webm')
    if(take) await writeFile(takePath,await readAsset(take.objectKey))
    let cameraTimes: Array<{ id: string; start: number; end: number }> = []
    if (segments.some(segment => segment.camera)) {
      if (!take?.duration) throw new Error('Record this moment first')
      const saved=await loadStageCheckpoint<ReturnType<typeof takeClockOf>>(projectId,sceneId,`alignment-${moment.id}`,inputKey)
      const clock=saved?.data || takeClockOf(segments.map(segment => ({ id: segment.id,say: segment.lines })),await alignTake(takePath,segments.map(segment => ({ id: segment.id,say: segment.lines }))),take.duration)
      if(!saved) await saveStageCheckpoint(projectId,sceneId,`alignment-${moment.id}`,inputKey,clock)
      if (clock.problems.length) throw new Error('The recording does not cover this moment. Record it again.')
      cameraTimes = clock.moments
    }
    const paths: string[] = []; const clips: MediaClip[] = []; let at = 0
    for (const [index,segment] of segments.entries()) {
      const path = join(temporary,`segment-${index}.wav`)
      let videoFrom: number | undefined
      if (segment.camera || voice.kind === 'record') {
        const timing = cameraTimes.find(time => time.id === segment.id)
        if (!timing || !take) throw new Error('The recording has no timing for this segment')
        await runCommand('ffmpeg',['-y','-i',takePath,'-ss',String(timing.start),'-t',String(timing.end-timing.start),'-vn','-ar','44100','-ac','1','-c:a','pcm_s16le',path])
        videoFrom = timing.start
      } else {
        const segmentKey=fingerprintOf({voice,segment})
        const saved=await loadStageCheckpoint<{objectKey:string}>(projectId,sceneId,`voice-${segment.id}`,segmentKey)
        let bytes:Buffer
        if(saved) bytes=await readAsset(saved.data.objectKey)
        else {
          const generated=await narrationClock([{id:segment.id,text:segment.lines,estimate:segment.estimate}],await resolveVoice(voice))
          bytes=generated.audio
          const asset=await storeAsset({body:bytes,contentType:'audio/mpeg',kind:'segment-voice',extension:'.mp3',projectId,sceneId,momentId:moment.id})
          await saveStageCheckpoint(projectId,sceneId,`voice-${segment.id}`,segmentKey,{objectKey:asset.objectKey})
        }
        const mp3 = join(temporary,`segment-${index}.mp3`)
        await writeFile(mp3,new Uint8Array(bytes))
        await runCommand('ffmpeg',['-y','-i',mp3,'-ar','44100','-ac','1','-c:a','pcm_s16le',path])
      }
      const duration = await probeSeconds(path)
      clips.push({ start: at,end: at+duration,camera: segment.camera,...(segment.camera && take ? { videoKey: take.objectKey,videoFrom } : {}) })
      at += duration; paths.push(path)
    }
    const list = join(temporary,'parts.txt'); const output = join(temporary,'moment.mp3')
    await writeFile(list,paths.map(path => `file '${path.replace(/'/g,"'\\''")}'`).join('\n'))
    await runCommand('ffmpeg',['-y','-f','concat','-safe','0','-i',list,'-c:a','libmp3lame','-q:a','2',output])
    const duration = await probeSeconds(output)
    const asset = await storeAsset({ body: await readFile(output),contentType:'audio/mpeg',kind:'moment-voice',extension:'.mp3',projectId,sceneId,momentId:moment.id })
    const prepared={ ...moment,audioKey:inputKey,audio:{inputKey,objectKey:asset.objectKey,duration},media:{inputKey,clips} }
    await saveStageCheckpoint(projectId,sceneId,`audio-${moment.id}`,inputKey,prepared)
    return prepared
  } finally { await rm(temporary,{recursive:true,force:true}) }
}
