import assert from 'node:assert/strict'
import {once} from 'node:events'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import type {Snapshot} from '../shared/api'
import type {EngineRun} from '../engine/harness/runtime'
if(process.env.MINIMAL_STORAGE_FIXTURE!=='disposable' || !process.env.MINIMAL_STUDIO_S3_BUCKET?.startsWith('minimal-fixture-')) throw new Error('This check requires disposable infrastructure')
const mode=process.argv[2],evidence=process.env.MINIMAL_BLOG_EVIDENCE!
const {initializePersistence,readRow,writeRow,listNotebookRows,readAsset,closePersistence,listRows}=await import('../engine/persistence')
await initializePersistence()
const {createStudioServer}=await import('../engine/server')
const {recoverEngineRuns,cancelEngineRun}=await import('../engine/harness/runtime')
const {recoverProjects}=await import('../engine/recovery')
const {scheduleSlides,loadProject,changeProject}=await import('../engine/projects')
const {schedulePlanning}=await import('../engine/video')
const {produceScene}=await import('../engine/production')
const {produceVideo}=await import('../engine/video-export')
const {notebookArtifacts}=await import('../engine/artifacts')
const server=createStudioServer().listen(0,'127.0.0.1');await once(server,'listening')
const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN=origin
await recoverEngineRuns();if(!['resume-planning','resume-slides'].includes(mode)) await recoverProjects({slides:scheduleSlides,planning:schedulePlanning,scene:produceScene,video:produceVideo})
const api=async<T>(path:string,method='GET',body?:unknown):Promise<T>=>{
 const response=await fetch(`${origin}/api${path}`,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
 const result=await response.json();if(!response.ok) throw new Error(result.error || `HTTP ${response.status}`);return result
}
let projectId=(await readRow<{projectId:string}>('test-cases','kimi-blog'))?.projectId || ''
const wait=async(label:string,ready:(snapshot:Snapshot)=>boolean)=>{
 const deadline=Date.now()+2*60*60*1000;let previous=''
 while(Date.now()<deadline){
  const snapshot=(await loadProject(projectId))!
  const phase=JSON.stringify({slides:snapshot.status,scenes:snapshot.project.video?.scenes.map(scene=>scene.phase),video:snapshot.project.video?.phase})
  if(phase!==previous){console.log(`${label}: ${phase}`);previous=phase}
  if(snapshot.status==='failed' && !snapshot.sourceFailure || snapshot.project.video?.scenes.some(scene=>scene.phase==='failed') || snapshot.project.video?.phase==='failed') throw new Error(`${label} failed; inspect the retained run report`)
  if(ready(snapshot)) return snapshot
  await new Promise(resolve=>setTimeout(resolve,1000))
 }
 throw new Error(`${label} timed out`)
}
const saveEvidence=async()=>{
 if(!projectId) return
 const snapshot=await loadProject(projectId)
 const runIds=await listNotebookRows('engine-runs',projectId)
 const runs=await Promise.all(runIds.map(id=>readRow<EngineRun>('engine-runs',id)))
 await writeFile(join(evidence,`${mode}-report.json`),JSON.stringify({mode,projectId,sourceUrl:'https://openai.com/index/introducing-canvas/',harness:'kimi',requestedModel:'kimi-code/k3',physicalCapture:false,speaker:'Labelled bundled still-photo avatar with synthetic system speech',snapshot,runs,checkpoints:await Promise.all((await listNotebookRows('stage-checkpoints',projectId)).map(id=>readRow('stage-checkpoints',id))),attempts:await Promise.all((await listNotebookRows('creative-attempts',projectId)).map(id=>readRow('creative-attempts',id))),artifacts:await notebookArtifacts(projectId)},null,2),{mode:0o600})
}
try{
 if(mode==='resume-slides'){
  assert(projectId,'The retained fixture has no notebook')
  const snapshot=(await loadProject(projectId))!
  const outline=await readRow<any>('outlines',projectId)
  assert(outline?.outline?.scenes?.length,'Retained outline missing')
  const brief=await readRow<any>('source-briefs',projectId)
  const {fingerprintOf}=await import('../engine/planning/fingerprint')
  const {saveStageCheckpoint,restoreFiles}=await import('../engine/artifacts')
  const runs=await Promise.all((await listNotebookRows('engine-runs',projectId)).map(id=>readRow<EngineRun>('engine-runs',id)))
  const drawing=runs.filter((run):run is EngineRun=>!!run && run.stage==='drawing').sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]
  assert(drawing,'Retained drawing run missing')
  const archive=await readRow<{artifacts:import('../engine/artifacts').ArtifactRef[]}>('engine-artifacts',drawing.id)
  const refs=(archive?.artifacts || []).filter(ref=>ref.name.startsWith('pages/')).map(ref=>({...ref,name:ref.name.slice(6)}))
  const files=await restoreFiles(refs)
  assert(Object.keys(files).filter(name=>name.endsWith('.svg')).length>=4,'Expected four actual retained slides')
  const brand=snapshot.project.branding?.useAccent?{...outline.brand,accent:snapshot.project.branding.accent}:outline.brand
  const inputKey=fingerprintOf({source:outline.source,outline:outline.outline,brand,pageOffset:0,style:null,brief:brief?.brief})
  await saveStageCheckpoint(projectId,undefined,'creative-page-drafts',inputKey,{fingerprint:fingerprintOf(files)},refs)
  console.log('Resuming only the retained Canvas deck: four candidates supplied, ten-minute stage ceiling, no video stages.')
  const {retrySlides}=await import('../engine/projects')
  await retrySlides(projectId)
  const complete=await wait('Resumed Canvas deck',snapshot=>snapshot.status==='ready')
  assert.equal(complete.project.slides.length,outline.outline.scenes.length)
 }else if(mode==='resume-planning'){
  assert(projectId,'The retained fixture has no notebook')
  await changeProject(projectId,current=>{current.status='ready';current.error=null;for(const scene of current.project.video!.scenes){if(scene.failure==='planning' || ['writing','replanning'].includes(scene.phase)){scene.phase='queued';scene.error=null;delete scene.failure}}})
  schedulePlanning(projectId)
  await wait('Resumed Kimi scene plans',snapshot=>!!snapshot.project.video?.scenes.every(scene=>scene.phase==='waiting' && scene.moments.length))
 }else if(mode==='outline'){
  const created=await api<Snapshot>('/projects','POST',{source:'https://openai.com/index/introducing-canvas/',harness:{adapter:'kimi',model:'kimi-code/k3'}})
  projectId=created.project.id;await writeRow('test-cases','kimi-blog',{projectId})
  let snapshot=await wait('Reading blog',snapshot=>snapshot.status==='ready' || !!snapshot.sourceFailure)
  if(snapshot.sourceFailure){
   console.log('Source blocked automatic reading; testing the pasted-text recovery path.')
   const article=await readFile(process.env.MINIMAL_BLOG_SOURCE_FILE!,'utf8')
   await api(`/projects/${projectId}/source`,'PATCH',{text:`Introducing canvas\n${article}`})
   snapshot=await wait('Kimi source outline',snapshot=>snapshot.status==='ready')
  }
  assert.ok(snapshot.project.slides.length>=6)
  assert.equal(snapshot.project.harness?.model,'kimi-code/k3')
  console.log(`Outline complete: ${snapshot.project.slides.length} slides. Restarting with a fresh local worker folder.`)
 }else if(mode==='planning'){
  assert.ok(projectId);const saved=(await loadProject(projectId))!
  assert.equal(saved.status,'ready');assert.equal(saved.project.harness?.adapter,'kimi')
  await api(`/projects/${projectId}/video`,'POST',{presence:'high',voice:{kind:'ai',id:'system:Samantha'}})
  const snapshot=await wait('Kimi scene plans',snapshot=>!!snapshot.project.video?.scenes.length && snapshot.project.video.scenes.every(scene=>scene.phase==='waiting'))
  assert.ok(snapshot.project.video!.scenes.every(scene=>scene.creativePlan && scene.moments.length))
  console.log(`Planning complete: ${snapshot.project.video!.scenes.length} accepted treatments and scripts. Restarting again before production.`)
 }else if(mode==='production'){
  const {prepareCreativePreview}=await import('../engine/creative/preview')
  const initial=(await loadProject(projectId))!
  for(const scene of initial.project.video!.scenes){
   console.log(`Creative preview: scene ${initial.project.video!.scenes.indexOf(scene)+1}/${initial.project.video!.scenes.length}`)
   const record=await readRow<import('../engine/creative/scene').CreativeSceneRecord>('creative-scenes',scene.id)
   assert(record && record.id===scene.creativePlan?.recordId)
   const preview=await prepareCreativePreview(initial.project,record,origin)
   assert(preview.proof.reseeks.every(sample=>sample.same))
   await changeProject(projectId,current=>{const target=current.project.video!.scenes.find(item=>item.id===scene.id)!;target.preview={planKey:target.planKey!,objectKey:preview.objectKey,moments:preview.manifest.moments.map(({id,start,end})=>({id,start,end}))}})
  }
  const {runCommand,probeSeconds}=await import('../engine/voice')
  const {saveRecording}=await import('../engine/takes')
  const scratch=await mkdtemp(join(tmpdir(),'studio-labelled-avatar-'))
  try{
   let snapshot=(await loadProject(projectId))!
   for(const scene of snapshot.project.video!.scenes){
    for(const moment of scene.moments.filter(moment=>moment.camera!=='none')){
     const text=join(scratch,'words.txt'),audio=join(scratch,'speech.aiff'),video=join(scratch,'avatar.mp4')
     await writeFile(text,moment.lines)
     await runCommand('/usr/bin/say',['-v','Samantha','-f',text,'-o',audio])
     await runCommand('ffmpeg',['-y','-loop','1','-i',join(process.cwd(),'app/assets/presenter.jpg'),'-i',audio,'-vf',"scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:text='TEST AVATAR - SYNTHETIC VOICE':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.8:x=10:y=h-th-12",'-shortest','-r','30','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac',video])
     await saveRecording(projectId,scene.id,[{momentId:moment.id,recordingKey:moment.recordingKey,from:0,to:await probeSeconds(video)}],await readFile(video),'video/mp4')
    }
    await api(`/projects/${projectId}/scenes/${scene.id}/produce`,'POST',{})
    snapshot=await wait('Kimi composition',snapshot=>snapshot.project.video!.scenes.find(item=>item.id===scene.id)?.phase==='produced')
   }
   await api(`/projects/${projectId}/produce`,'POST',{})
   snapshot=await wait('Joined export',snapshot=>!!snapshot.project.video?.produced && snapshot.project.video.produced.inputKey===snapshot.project.video.inputKey)
   const response=await fetch(`${origin}/api/projects/${projectId}/download`)
   assert.equal(response.status,200)
   await writeFile(join(evidence,'canvas-test-video.mp4'),Buffer.from(await response.arrayBuffer()))
   console.log('Actual Kimi source → plans → composition → joined MP4 completed. This proves no physical capture.')
  }finally{await rm(scratch,{recursive:true,force:true})}
 }else throw new Error('Unknown check mode')
 const runs=await Promise.all((await listNotebookRows('engine-runs',projectId)).map(id=>readRow<EngineRun>('engine-runs',id)))
 assert.ok(runs.length>0 && runs.every(run=>run?.adapter==='kimi' && run.model==='kimi-code/k3'))
 assert.ok(runs.some(run=>run?.status==='done'),'At least one actual Kimi run must complete')
 assert.ok(runs.every(run=>run && !['preparing','running'].includes(run.status)),'No model request should remain active at a completed checkpoint')
 await saveEvidence()
}catch(error){
 // Prevent queued lanes from starting more model requests after this check fails.
 if(projectId) await changeProject(projectId,snapshot=>{for(const scene of snapshot.project.video?.scenes || []) if(!['produced','failed'].includes(scene.phase)){scene.phase='failed';scene.failure='planning';scene.error='The disposable check stopped after another stage failed.'}}).catch(()=>{})
 const runIds=projectId?await listNotebookRows('engine-runs',projectId):[]
 for(const id of runIds) cancelEngineRun(id)
 for(let attempt=0;attempt<300;attempt++){
  const runs=await Promise.all(runIds.map(id=>readRow<EngineRun>('engine-runs',id)))
  if(runs.every(run=>!run || !['preparing','running'].includes(run.status))) break
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 await saveEvidence();throw error
}
finally{await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections()});await closePersistence()}
