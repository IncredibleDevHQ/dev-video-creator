import type {Snapshot} from '../shared/api'
import {notebookStream} from './notebook-stream'

export function liveNotebook(id:string,update:(snapshot:Snapshot)=>void,connected:(value:boolean)=>void){
 if(typeof SharedWorker==='undefined')return notebookStream(id,update,connected)
 let worker:SharedWorker
 try{worker=new SharedWorker(new URL('./notebook-stream-worker.ts',import.meta.url),{type:'module',name:'studio-notebooks'})}
 catch{return notebookStream(id,update,connected)}
 let closed=false,fallback:(()=>void)|undefined,lastSnapshot=''
 const watch=()=>worker.port.postMessage({type:'watch',id})
 const resume=()=>{if(document.visibilityState==='visible' && !closed && !fallback)watch()}
 const leave=(event:PageTransitionEvent)=>{if(!event.persisted)close()}
 const stopWorker=()=>{clearInterval(heartbeat);document.removeEventListener('visibilitychange',resume);window.removeEventListener('pageshow',resume);window.removeEventListener('pagehide',leave);try{worker.port.postMessage({type:'stop'})}catch{}worker.port.close()}
 worker.onerror=()=>{if(closed || fallback)return;stopWorker();fallback=notebookStream(id,update,connected)}
 worker.port.onmessage=({data})=>{
  if(closed || fallback)return
  if(typeof data?.connected==='boolean')connected(data.connected)
  if(data?.snapshot?.project?.id===id){
   const value=JSON.stringify(data.snapshot)
   if(value!==lastSnapshot){lastSnapshot=value;update(data.snapshot)}
  }
 }
 const close=()=>{if(closed)return;closed=true;if(fallback)fallback();else stopWorker()}
 const heartbeat=setInterval(()=>worker.port.postMessage({type:'ping'}),30000)
 connected(false);worker.port.start();watch()
 document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',resume);window.addEventListener('pagehide',leave)
 return close
}
