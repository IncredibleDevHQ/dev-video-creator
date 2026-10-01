export type MediaState = 'ready' | 'loading' | 'stalled' | 'failed'

/** Observes one saved file. Recovery is explicit and never starts generation. */
export class MediaRecovery {
 state:MediaState='ready'
 private player:HTMLMediaElement|null=null
 private timer:ReturnType<typeof setTimeout>|null=null
 private restore:(()=>void)|null=null
 private listeners:Array<[string,EventListener]>=[]
 constructor(private changed:()=>void){}
 private set(state:MediaState){this.state=state;this.changed()}
 private clear(){if(this.timer)clearTimeout(this.timer);this.timer=null}
 private waiting=()=>{
  if(this.timer || this.state==='stalled')return
  this.clear();this.set('loading')
  this.timer=setTimeout(()=>{this.timer=null;this.set('stalled')},12000)
 }
 private ready=()=>{this.clear();this.set('ready')}
 private failed=()=>{this.clear();this.set('failed')}
 bind(player:HTMLMediaElement|null){
  if(this.player===player)return
  this.dispose();this.state='ready';this.player=player
  if(!player){this.set('ready');return}
  this.listeners=[['waiting',this.waiting],['stalled',this.waiting],['loadstart',this.waiting],['canplay',this.ready],['playing',this.ready],['error',this.failed]]
  for(const [type,listener] of this.listeners)player.addEventListener(type,listener)
  if(player.error)this.failed();else if(player.readyState>=3)this.ready();else this.waiting()
 }
 retry(){
  const player=this.player;if(!player)return
  if(this.restore)player.removeEventListener('loadedmetadata',this.restore)
  const time=player.currentTime
  this.restore=()=>{
   this.restore=null
   if(Number.isFinite(time) && time>0 && Number.isFinite(player.duration))player.currentTime=Math.min(time,player.duration)
  }
  player.addEventListener('loadedmetadata',this.restore,{once:true})
  this.clear();this.state='ready';this.waiting();player.load()
 }
 dispose(){
  this.clear()
  if(this.player){for(const [type,listener] of this.listeners)this.player.removeEventListener(type,listener);if(this.restore)this.player.removeEventListener('loadedmetadata',this.restore)}
  this.restore=null;this.listeners=[];this.player=null
 }
}

export function mediaRecoveryView(state:MediaState){
 if(state==='ready')return ''
 return `<div class="media-recovery" role="status"><span>${state==='loading'?'Loading video…':state==='stalled'?'Video loading is taking longer than expected.':'This video could not load.'}</span>${state==='loading'?'': '<button type="button" data-reload-media>Reload video</button>'}</div>`
}

export function savedMediaRecovery(root:HTMLElement){
 const paint=()=>{
  root.querySelector('.media-recovery')?.remove()
  const player=root.querySelector<HTMLMediaElement>('[data-scene-player],[data-take-player]')
  if(player)player.closest('.video-stage,.take-review')?.insertAdjacentHTML('afterend',mediaRecoveryView(recovery.state))
 }
 const recovery=new MediaRecovery(paint)
 root.addEventListener('click',event=>{if((event.target as Element).closest('[data-reload-media]'))recovery.retry()})
 return ()=>{recovery.bind(root.querySelector('[data-scene-player],[data-take-player]'));paint()}
}
