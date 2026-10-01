import type {Snapshot} from '../shared/api'

export function notebookStream(id:string,update:(snapshot:Snapshot)=>void,connected:(value:boolean)=>void){
 let stream:EventSource,closed=false,lastUpdate=Date.now(),lastSnapshot=''
 let disconnectTimer:ReturnType<typeof setTimeout>|undefined
 const clearDisconnect=()=>{clearTimeout(disconnectTimer);disconnectTimer=undefined}
 const reconnecting=()=>{if(disconnectTimer===undefined)disconnectTimer=setTimeout(()=>{disconnectTimer=undefined;if(!closed)connected(false)},4000)}
 const open=()=>{
  const source=new EventSource(`/api/projects/${encodeURIComponent(id)}/events`);stream=source
  // Only a valid snapshot confirms recovery; opening a socket does not.
  source.onerror=()=>{if(!closed && stream===source)reconnecting()}
  source.onmessage=event=>{
   if(closed || stream!==source)return
   let snapshot:Snapshot
   try{
    snapshot=JSON.parse(event.data) as Snapshot
    if(snapshot?.project?.id!==id)throw new Error('Invalid notebook update')
   }catch{connected(false);return}
   clearDisconnect();lastUpdate=Date.now();connected(true)
   // Delivery errors are not transport failures. Retry the same snapshot on the
   // next heartbeat if its consumer throws before accepting it.
   if(event.data!==lastSnapshot){update(snapshot);lastSnapshot=event.data}
  }
 }
 connected(false);open()
 const watchdog=setInterval(()=>{
  if(Date.now()-lastUpdate<15000)return
  connected(false);stream.close();lastUpdate=Date.now();open()
 },5000)
 return ()=>{closed=true;clearDisconnect();clearInterval(watchdog);stream.close()}
}

/** Share one live connection per notebook across browser tabs. */
export class NotebookStreams {
 private streams=new Map<string,{ports:Set<MessagePort>,close:()=>void,snapshot?:Snapshot,connected:boolean}>()
 private clients=new Map<MessagePort,{id:string,seen:number}>()
 constructor(private subscribe=notebookStream){}
 watch(port:MessagePort,id:string){
  if(!/^[a-zA-Z0-9_-]+$/.test(id))return
  if(this.clients.get(port)?.id===id){
   this.touch(port);const current=this.streams.get(id)!
   port.postMessage({connected:current.connected});if(current.snapshot)port.postMessage({snapshot:current.snapshot})
   return
  }
  this.unwatch(port)
  let entry=this.streams.get(id)
  if(!entry){
   entry={ports:new Set(),close:()=>{},connected:false};this.streams.set(id,entry)
   const current=entry
   current.close=this.subscribe(id,snapshot=>{current.snapshot=snapshot;for(const client of current.ports)client.postMessage({snapshot})},connected=>{current.connected=connected;for(const client of current.ports)client.postMessage({connected})})
  }
  entry.ports.add(port);this.clients.set(port,{id,seen:Date.now()})
  port.postMessage({connected:entry.connected})
  if(entry.snapshot)port.postMessage({snapshot:entry.snapshot})
 }
 touch(port:MessagePort){const client=this.clients.get(port);if(client)client.seen=Date.now()}
 unwatch(port:MessagePort){
  const client=this.clients.get(port);if(!client)return
  this.clients.delete(port)
  const entry=this.streams.get(client.id)!
  entry.ports.delete(port)
  if(!entry.ports.size){entry.close();this.streams.delete(client.id)}
 }
 expire(){for(const [port,client] of this.clients)if(Date.now()-client.seen>180000)this.unwatch(port)}
}
