import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {runCommand} from '../engine/voice'
import type {Moment} from '../shared/model'
import {sceneTimeMap} from '../shared/scene-time'
export type AnimationMoment={id:string;start:number;end:number}
/** The animation stays immutable; only its clock and the separately recorded media change. */
export const composePresenter=async(input:{animation:Buffer;animationMoments:AnimationMoment[];moments:Moment[];audio:Buffer;camera?:Buffer})=>{
 if(input.animationMoments.length!==input.moments.length || input.moments.some((m,i)=>m.id!==input.animationMoments[i].id))throw new Error('The animation does not match this scene’s moments')
 const spans=input.moments.map((m,i)=>({start:m.start,end:m.end,sceneStart:input.animationMoments[i].start,sceneEnd:input.animationMoments[i].end}))
 const animationTime=sceneTimeMap(spans)
 const duration=input.moments.at(-1)!.end
 const dir=await mkdtemp(join(tmpdir(),'studio-presenter-'))
 try{
  await writeFile(join(dir,'animation.mp4'),input.animation);await writeFile(join(dir,'audio.wav'),input.audio)
  if(input.camera)await writeFile(join(dir,'camera.mp4'),input.camera)
  const parts:Array<{start:number;end:number;camera:boolean;layout:Moment['layout']}> = []
  for(const moment of input.moments){
   const clips=moment.media?.clips
   if(!clips?.length)throw new Error('The scene needs measured media intervals')
   let at=0
   for(const clip of clips){
    if(!Number.isFinite(clip.start) || !Number.isFinite(clip.end) || Math.abs(clip.start-at)>.05 || clip.end<=clip.start)throw new Error('The recording intervals are not continuous')
    if(clip.camera && !input.camera)throw new Error('The presenter recording is missing')
    parts.push({start:moment.start+clip.start,end:Math.min(moment.end,moment.start+clip.end),camera:clip.camera,layout:moment.layout});at=clip.end
   }
   if(Math.abs(at-(moment.end-moment.start))>.1)throw new Error('The recording intervals do not cover this moment')
  }
  const filters:string[]=[]
  for(const [i,part] of parts.entries()){
   const length=part.end-part.start,from=animationTime(part.start),to=animationTime(part.end)
   if(!(length>0 && to>from))throw new Error('The scene has an empty interval')
   filters.push(`[0:v]trim=start=${from}:end=${to},setpts=(PTS-STARTPTS)*${length/(to-from)},fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[content${i}]`)
   if(!part.camera){filters.push(`[content${i}]null[part${i}]`);continue}
   const full=part.layout==='full-screen',corner=part.layout==='corner'
   const cw=full?1920:corner?360:600,ch=full?1080:corner?360:960,cx=full?0:corner?1520:1280,cy=full?0:corner?660:60
   filters.push(`[2:v]trim=start=${part.start}:end=${part.end},setpts=PTS-STARTPTS,fps=30,scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},setsar=1[presenter${i}]`)
   if(full){filters.push(`[content${i}]nullsink`);filters.push(`[presenter${i}]null[part${i}]`)}
   else{
    const width=corner?1480:1240,height=Math.round(width*1080/1920/2)*2
    filters.push(`[content${i}]scale=${width}:${height},pad=1920:1080:20:(oh-ih)/2:color=0x101817,setsar=1[layout${i}]`)
    filters.push(`[layout${i}][presenter${i}]overlay=x=${cx}:y=${cy}:shortest=1[part${i}]`)
   }
  }
  filters.push(`${parts.map((_,i)=>`[part${i}]`).join('')}concat=n=${parts.length}:v=1:a=0[video]`)
  const output=join(dir,'scene.mp4')
  await runCommand('ffmpeg',['-y','-loglevel','error','-i',join(dir,'animation.mp4'),'-i',join(dir,'audio.wav'),...input.camera?['-i',join(dir,'camera.mp4')]:[],'-filter_complex',filters.join(';'),'-map','[video]','-map','1:a','-t',String(duration),'-r','30','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output],600_000)
  return await readFile(output)
 }finally{await rm(dir,{recursive:true,force:true})}
}
