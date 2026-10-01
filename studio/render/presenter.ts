import {dialogueBoundary} from '../shared/dialogue'
import {presenterMotion,presenterWeightExpression} from '../shared/presenter-motion'
import {presenterLayout} from '../shared/presenter-layout'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {runCommand} from '../engine/voice'
import type {Moment} from '../shared/model'
import {sceneTimeMap} from '../shared/scene-time'
export type AnimationMoment={id:string;start:number;end:number}
/** The animation stays immutable; only its clock and the separately recorded media change. */
export const composePresenter=async(input:{animation:Buffer;animationMoments:AnimationMoment[];moments:Moment[];audio:Buffer;camera?:Buffer;overlays?:Record<string,Buffer>})=>{
 if(input.animationMoments.length!==input.moments.length || input.moments.some((m,i)=>m.id!==input.animationMoments[i].id))throw new Error('The animation does not match this scene’s moments')
 const spans=input.moments.map((m,i)=>({start:m.start,end:m.end,sceneStart:input.animationMoments[i].start,sceneEnd:input.animationMoments[i].end}))
 const animationTime=sceneTimeMap(spans)
 const duration=input.moments.at(-1)!.end
 const dir=await mkdtemp(join(tmpdir(),'studio-presenter-'))
 try{
  await writeFile(join(dir,'animation.mp4'),input.animation);await writeFile(join(dir,'audio.wav'),input.audio)
  if(input.camera)await writeFile(join(dir,'camera.mp4'),input.camera)
  const overlayKeys=Object.keys(input.overlays || {})
  for(const [i,key] of overlayKeys.entries())await writeFile(join(dir,`overlay-${i}.png`),input.overlays![key])
  const parts:Array<{start:number;end:number;camera:boolean;layout:Moment['layout'];momentId:string}> = []
  for(const moment of input.moments){
   const clips=moment.media?.clips
   if(!clips?.length)throw new Error('The scene needs measured media intervals')
   let at=0
   for(const clip of clips){
    if(!Number.isFinite(clip.start) || !Number.isFinite(clip.end) || Math.abs(clip.start-at)>.05 || clip.end<=clip.start)throw new Error('The recording intervals are not continuous')
    if(clip.camera && !input.camera)throw new Error('The presenter recording is missing')
    parts.push({momentId:moment.id,start:moment.start+clip.start,end:Math.min(moment.end,moment.start+clip.end),camera:clip.camera,layout:moment.layout});at=clip.end
   }
   if(Math.abs(at-(moment.end-moment.start))>.1)throw new Error('The recording intervals do not cover this moment')
  }
  const filters:string[]=[]
  for(const [i,part] of parts.entries()){
   const moment=input.moments.find(m=>m.id===part.momentId)!,base=input.animationMoments.find(m=>m.id===part.momentId)!
   const length=part.end-part.start,boundary=moment.start+dialogueBoundary(moment)
   const map=(t:number)=>base.start+Math.min(1,Math.max(0,(t-moment.start)/(boundary-moment.start)))*(base.end-base.start)
   const from=moment.extension?Math.min(base.end-1/30,map(part.start)):animationTime(part.start)
   const to=moment.extension?Math.min(base.end,map(part.end)):animationTime(part.end)
   const moving=moment.extension?Math.max(0,Math.min(part.end,boundary)-part.start):length
   if(!(length>0 && to>from))throw new Error('The scene has an empty interval')
   filters.push(`[0:v]trim=start=${from}:end=${to},setpts=(PTS-STARTPTS)*${moving>0?moving/(to-from):1},tpad=stop_mode=clone:stop_duration=${Math.max(0,length-moving)},trim=duration=${length},fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[content${i}]`)
   if(!part.camera){filters.push(`[content${i}]null[part${i}]`);continue}
   const full=part.layout==='full-screen'
   const {content,camera}=presenterLayout(part.layout)
   const {width:cw,height:ch,x:cx,y:cy}=camera
   filters.push(`[2:v]trim=start=${part.start}:end=${part.end},setpts=PTS-STARTPTS,fps=30,scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},setsar=1[presenter${i}]`)
   const motion=presenterMotion(parts,i),weight=presenterWeightExpression(motion)
   const cwExpression=full?'1920':`trunc((1920+(${content.width}-1920)*${weight})/2)*2`
   const chExpression=full?'1080':`trunc((1080+(${content.height}-1080)*${weight})/2)*2`
   filters.push(`color=c=0x101817:s=1920x1080:r=30:d=${length}[background${i}]`)
   filters.push(`[content${i}]scale=w='${cwExpression}':h='${chExpression}':eval=frame[scaled${i}]`)
   filters.push(`[background${i}][scaled${i}]overlay=x='${full?0:content.x}*${weight}':y='${full?0:content.y}*${weight}':eval=frame:shortest=1[layout${i}]`)
   const overlay=full?overlayKeys.indexOf(part.momentId):-1
   if(overlay>=0)filters.push(`[presenter${i}][${2+Number(!!input.camera)+overlay}:v]overlay=0:0:shortest=1[cameraOverlay${i}]`)
   const fades=[motion.enter?`fade=t=in:st=0:d=${motion.enter}:alpha=1`:'',motion.exit?`fade=t=out:st=${length-motion.exit}:d=${motion.exit}:alpha=1`:''].filter(Boolean)
   filters.push(`[${overlay>=0?'cameraOverlay':'presenter'}${i}]format=yuva420p${fades.length?','+fades.join(','):''}[faded${i}]`)
   filters.push(`[layout${i}][faded${i}]overlay=x=${cx}:y=${cy}:shortest=1[part${i}]`)
  }
  filters.push(`${parts.map((_,i)=>`[part${i}]`).join('')}concat=n=${parts.length}:v=1:a=0[video]`)

  const output=join(dir,'scene.mp4')
  await runCommand('ffmpeg',['-y','-loglevel','error','-i',join(dir,'animation.mp4'),'-i',join(dir,'audio.wav'),...input.camera?['-i',join(dir,'camera.mp4')]:[],...overlayKeys.flatMap((_,i)=>['-loop','1','-i',join(dir,`overlay-${i}.png`)]),'-filter_complex',filters.join(';'),'-map','[video]','-map','1:a','-t',String(duration),'-r','30','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output],600_000)
  return await readFile(output)
 }finally{await rm(dir,{recursive:true,force:true})}
}
