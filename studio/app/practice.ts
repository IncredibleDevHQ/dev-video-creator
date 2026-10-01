import {sceneTimeMap} from '../shared/scene-time'
import type {PracticeTrack,PracticeClip} from '../shared/practice'
/** Rehearsal owns playback only. It never creates a MediaRecorder or a take. */
export class PracticePlayback{
 private timer:ReturnType<typeof setInterval>|null=null
 private audio:HTMLAudioElement|null=null
 private epoch=0
 paused=false
 private resumeClock=()=>{}
 advance=()=>{}
 active=false
 constructor(private frame:(clip:PracticeClip,sceneSecond:number)=>void,private ended:()=>void,private failed:(error:Error)=>void){}
 start(track:PracticeTrack,manual=false){
  this.stop()
  let sceneTime:ReturnType<typeof sceneTimeMap>
  try{sceneTime=sceneTimeMap(track.clips.map(({start,end,sceneStart,sceneEnd})=>({start,end,sceneStart,sceneEnd})))}catch{this.failed(new Error('This rehearsal has invalid timing. Prepare it again.'));return}
  this.active=true;const epoch=this.epoch
  let index=0,started=performance.now(),pausedAt=0
  this.resumeClock=()=>{started+=performance.now()-pausedAt}
  this.pauseClock=()=>{pausedAt=performance.now()}
  const next=()=>{
   if(epoch!==this.epoch) return
   if(this.audio){this.audio.pause();this.audio.onended=null;this.audio.onerror=null;this.audio.removeAttribute('src');this.audio.load();this.audio.remove()};this.audio=null
   const clip=track.clips[index]
   if(!clip){this.stop();this.ended();return}
   started=performance.now();this.frame(clip,clip.sceneStart)
   if(clip.objectKey){
    const audio=new Audio(`/objects/${clip.objectKey}`);this.audio=audio;audio.hidden=true;audio.className='practice-audio';document.body.append(audio)
    audio.onended=()=>{if(epoch===this.epoch && this.audio===audio){this.frame(clip,clip.sceneEnd);index++;next()}}
    audio.onerror=()=>{if(epoch===this.epoch && this.audio===audio){this.stop();this.failed(new Error('Could not play this rehearsal. Try Practice again.'))}}
    void audio.play().catch(()=>{if(epoch===this.epoch && this.audio===audio){this.stop();this.failed(new Error('Playback was blocked. Try Practice again to enable sound.'))}})
   }
  }
  this.advance=()=>{if(this.active){index++;next()}}
  next()
  if(!this.active) return
  this.timer=setInterval(()=>{
   if(this.paused)return
   const clip=track.clips[index];if(!clip) return
   const duration=clip.end-clip.start
   const elapsed=this.audio?this.audio.currentTime:(performance.now()-started)/1000
   if(!this.audio && elapsed>=duration && !manual){index++;next();return}
   this.frame(clip,sceneTime(clip.start+Math.min(manual?Math.max(0,duration-.3):duration,Math.max(0,elapsed))))
  },100)
 }
 private pauseClock=()=>{}
 pause(){if(!this.active || this.paused)return;this.paused=true;this.pauseClock();this.audio?.pause()}
 resume(){if(!this.active || !this.paused)return;this.resumeClock();this.paused=false;void this.audio?.play().catch(()=>{this.pause();this.failed(new Error("Playback was blocked. Try again."))})}
 stop(){this.paused=false;this.epoch++;if(this.timer) clearInterval(this.timer);this.timer=null;this.audio?.pause();if(this.audio){this.audio.onended=null;this.audio.onerror=null;this.audio.removeAttribute('src');this.audio.load();this.audio.remove()};this.audio=null;this.active=false}
}
