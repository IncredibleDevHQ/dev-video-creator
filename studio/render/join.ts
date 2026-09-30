import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Transition } from '../shared/model'
import { readAsset,validObjectKey } from '../engine/persistence'
import { probeSeconds, runCommand } from '../engine/voice'
const names: Record<Exclude<Transition,'none'>,string> = {crossfade:'fade','push-left':'slideleft','push-right':'slideright','push-up':'slideup',wipe:'wipeleft',zoom:'zoomin'}
export const joinScenes = async (keys: string[], transitions: Transition[], onClock?: (clock: Array<{start: number; duration: number}>) => void) => {
  if (!keys.length || transitions.length !== keys.length-1) throw new Error('Invalid scene order')
  if(keys.some(key=>!validObjectKey(key) || !key.endsWith('.mp4'))) throw new Error('Invalid scene media')
  const temporary = await mkdtemp(join(tmpdir(),'minimal-video-join-'))
  try {
    const paths=await Promise.all(keys.map(async(key,index)=>{const path=join(temporary,`scene-${index}.mp4`);await writeFile(path,await readAsset(key));return path}))
    const output = join(temporary,'video.mp4')
    const durations = await Promise.all(paths.map(probeSeconds))
    let clock = 0
    onClock?.(durations.map((duration,index) => {
      if (index && transitions[index-1] !== 'none') clock -= Math.min(.4,durations[index-1]/3,duration/3)
      const interval = {start:clock,duration}; clock += duration; return interval
    }))
    if (transitions.every(transition => transition === 'none')) {
      const list = join(temporary,'scenes.txt')
      await writeFile(list,paths.map(path => `file '${path.replace(/'/g,"'\\''")}'`).join('\n'))
      await runCommand('ffmpeg',['-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',output],600000)
    } else {
      const filters: string[] = []
      paths.forEach((_path,index) => {
        filters.push(`[${index}:v]fps=30,settb=AVTB,setpts=PTS-STARTPTS[v${index}]`)
        filters.push(`[${index}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${index}]`)
      })
      let video = 'v0'; let audio = 'a0'; let at = durations[0]
      for (let index = 1; index < paths.length; index++) {
        const transition = transitions[index-1]; const nextVideo = `joinedv${index}`; const nextAudio = `joineda${index}`
        if (transition === 'none') {
          filters.push(`[${video}][v${index}]concat=n=2:v=1:a=0,settb=AVTB[${nextVideo}]`)
          filters.push(`[${audio}][a${index}]concat=n=2:v=0:a=1[${nextAudio}]`)
          at += durations[index]
        } else {
          if (!names[transition]) throw new Error('Invalid transition')
          const seconds = Math.min(.4,durations[index-1]/3,durations[index]/3)
          filters.push(`[${video}][v${index}]xfade=transition=${names[transition]}:duration=${seconds}:offset=${Math.max(0,at-seconds)}[${nextVideo}]`)
          filters.push(`[${audio}][a${index}]acrossfade=d=${seconds}:c1=tri:c2=tri[${nextAudio}]`)
          at += durations[index]-seconds
        }
        video = nextVideo; audio = nextAudio
      }
      await runCommand('ffmpeg',['-y',...paths.flatMap(path => ['-i',path]),'-filter_complex',filters.join(';'),'-map',`[${video}]`,'-map',`[${audio}]`,'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',output],600000)
    }
    return await readFile(output)
  } finally { await rm(temporary,{recursive:true,force:true}) }
}
