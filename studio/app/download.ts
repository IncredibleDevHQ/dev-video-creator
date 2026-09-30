const active=new Set<string>()
// Keep export failures in the editor; direct navigation would replace it
// with an API error document. The current PDF is small enough to buffer.
export const downloadPresentation=async(projectId:string,button:HTMLButtonElement)=>{
 if(active.has(projectId)) return
 active.add(projectId)
 const label=button.textContent;button.disabled=true;button.textContent='Preparing PDF…'
 try{
  let response:Response
  try{response=await fetch(`/api/projects/${encodeURIComponent(projectId)}/export`)}catch{throw new Error('Studio is unavailable. Try exporting again when it is running.')}
  if(!response.ok || !response.headers.get('content-type')?.includes('application/pdf')){
   const result=await response.json().catch(()=>null)
   throw new Error(typeof result?.error==='string'?result.error:'Could not export this presentation. Try again.')
  }
  const url=URL.createObjectURL(await response.blob())
  const link=document.createElement('a');link.href=url;link.download='slides.pdf';link.hidden=true
  document.body.append(link);link.click();link.remove()
  // Give the browser time to consume the download before releasing its bytes.
  setTimeout(()=>URL.revokeObjectURL(url),60000)
 }finally{active.delete(projectId);button.disabled=false;button.textContent=label}
}

export const downloadVideo=async(projectId:string,button:HTMLButtonElement,sceneId?:string)=>{
 const key=`${projectId}:${sceneId || 'video'}`
 if(active.has(key)) return
 active.add(key)
 const label=button.textContent;button.disabled=true;button.textContent='Downloading…'
 try{
  const path=`/api/projects/${encodeURIComponent(projectId)}${sceneId?`/scenes/${encodeURIComponent(sceneId)}`:''}/download`
  const response=await fetch(path)
  if(!response.ok || !response.headers.get('content-type')?.includes('video/mp4')){
   const result=await response.json().catch(()=>null)
   throw new Error(result?.error || 'Could not download the video. Try again.')
  }
  const link=document.createElement('a');link.href=path;link.download=sceneId?'scene.mp4':'video.mp4';link.hidden=true
  document.body.append(link);link.click();link.remove()
 }finally{active.delete(key);button.disabled=false;button.textContent=label}
}
