const pending=new WeakMap<HTMLMediaElement,EventListener>()

/** A newly opened saved file may not have its duration yet. Latest seek wins. */
export function seekSavedMedia(player:HTMLMediaElement,second:number){
 const previous=pending.get(player)
 if(previous){player.removeEventListener('loadedmetadata',previous);pending.delete(player)}
 if(!Number.isFinite(second) || second<0)return
 const apply=()=>{
  pending.delete(player)
  player.currentTime=Number.isFinite(player.duration)?Math.min(second,player.duration):second
 }
 if(player.readyState>=1){apply();return}
 const ready:EventListener=()=>apply()
 pending.set(player,ready);player.addEventListener('loadedmetadata',ready,{once:true})
}
