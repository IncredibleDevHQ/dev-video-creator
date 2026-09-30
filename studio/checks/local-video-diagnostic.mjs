// Real harness diagnostic using copied fixtures; this does not prove S3/Postgres integration.
import {mkdtemp,readFile,mkdir,writeFile,readdir} from 'node:fs/promises'
import {join,basename} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {once} from 'node:events'
const backup=process.argv[2]
const claudeProduction=process.argv[3]==='--produce-claude'
const production=process.argv[3]==='--produce' || claudeProduction
const next=process.argv[3]==='--next'
const retryPreview=process.argv[3]==='--retry-preview'
if(!backup) throw new Error('Supply a retained disposable blog backup')
let rows,artifacts,local=false
try{
 const report=JSON.parse(await readFile(join(backup,'diagnostic-report.json'),'utf8'))
 if(report.storage!=='isolated-local-diagnostic-not-S3-proof')throw new Error('Not a local diagnostic')
 local=true;rows=[]
 for(const entry of await readdir(backup,{withFileTypes:true})){
  if(!entry.isDirectory() || !/^[a-zA-Z0-9_-]+$/.test(entry.name) || ['objects','engine-workspaces'].includes(entry.name))continue
  for(const file of await readdir(join(backup,entry.name)))if(/^[a-zA-Z0-9_-]+\.json$/.test(file))rows.push({kind:entry.name,id:file.slice(0,-5),document:JSON.parse(await readFile(join(backup,entry.name,file),'utf8'))})
 }
 artifacts=rows.filter(row=>row.kind==='assets').map(row=>({id:row.id,object_key:row.document.objectKey,sha256:row.document.sha256}))
}catch(error){
 if(error.code!=='ENOENT')throw error
 rows=JSON.parse(await readFile(join(backup,'rows.json'),'utf8'))
 artifacts=JSON.parse(await readFile(join(backup,'artifacts.json'),'utf8'))
 if(!artifacts.length || artifacts.some(a=>!/^minimal-fixture-[a-f0-9]{8}$/.test(a.bucket)))throw new Error('Only retained disposable fixtures are supported')
}
const root=await mkdtemp(join(tmpdir(),'studio-local-video-diagnostic-'))
process.env.MINIMAL_STUDIO_PERSISTENCE='local';process.env.MINIMAL_STUDIO_DATA_DIR=root
process.env.OPENAI_API_KEY='';process.env.FISH_AUDIO_API_KEY='';delete process.env.MINIMAL_STUDIO_DATABASE_URL
const keys=new Map(artifacts.map(a=>[a.object_key,basename(a.object_key)]))
const rewrite=value=>typeof value==='string'?(keys.get(value) || value):Array.isArray(value)?value.map(rewrite):value && typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)])):value
await mkdir(join(root,'objects'),{recursive:true,mode:0o700})
for(const a of artifacts){
 if(!/^[a-zA-Z0-9_-]+$/.test(a.id))throw new Error('Invalid fixture artifact')
 const bytes=await readFile(join(backup,'objects',local?basename(a.object_key):a.id))
 if(!local && bytes.length!==Number(a.byte_size) || createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw new Error('Fixture checksum mismatch')
 await writeFile(join(root,'objects',keys.get(a.object_key)),bytes,{mode:0o600})
}
const {writeRow,listNotebookRows,readRow}=await import('../engine/persistence.ts')
for(const row of rows){
 if(!/^[a-zA-Z0-9_-]+$/.test(row.kind) || !/^[a-zA-Z0-9_-]+$/.test(row.id))throw new Error('Invalid fixture row')
 await writeRow(row.kind,row.id,rewrite(row.document))
}
const {projectId}=await readRow('test-cases','kimi-blog')
const {loadProject,changeProject}=await import('../engine/projects.ts')
const {planScene}=await import('../engine/video.ts')
const {reconcileVideo}=await import('../engine/scene-model.ts')
const {stopEngineRuns}=await import('../engine/harness/runtime.ts')
const {createStudioServer}=await import('../engine/server.ts')
const server=createStudioServer().listen(0,'127.0.0.1');await once(server,'listening')
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN=`http://127.0.0.1:${server.address().port}`
const before=new Set(await listNotebookRows('engine-runs',projectId))
console.log(`LOCAL video diagnostic only. Evidence: ${root}. Notebook: ${projectId}`)
let selectedSceneId
try{
 if(claudeProduction){
  const saved=await loadProject(projectId)
  const target=saved.project.video?.scenes.find(scene=>scene.phase==='failed' && scene.creativePlan && scene.moments.length)
  if(!target)throw new Error('Expected a failed scene with a saved creative plan')
  const record=await readRow('creative-scenes',target.id)
  if(record?.id!==target.creativePlan.recordId)throw new Error('Saved creative plan mismatch')
  const selection={adapter:'claude-code',model:'claude-opus-5-5'}
  await writeRow('creative-scenes',target.id,{...record,selection})
  await changeProject(projectId,current=>{
   current.project.harness=selection;current.project.video.settings.harness=selection
   const scene=current.project.video.scenes.find(item=>item.id===target.id)
   scene.phase='waiting';scene.error=null;delete scene.failure
  })
 }
 const snapshot=await loadProject(projectId)
 if(snapshot.status!=='ready' || snapshot.project.slides.length!==9)throw new Error('Expected the accepted nine-slide Canvas deck')
 if(production){
  const scene=snapshot.project.video?.scenes.find(scene=>scene.phase==='waiting' && scene.creativePlan)
  if(!scene?.creativePlan || scene.phase!=='waiting')throw new Error('Expected an accepted scene plan')
  const {produceScene}=await import('../engine/production.ts')
  selectedSceneId=scene.id
  await produceScene(projectId,scene.id)
  let last=''
  while(true){
   const current=await loadProject(projectId),target=current.project.video.scenes.find(item=>item.id===scene.id)
   const message=current.events.at(-1)?.message
   if(message!==last){console.log(message);last=message}
   if(target.phase!=='producing')break
   await new Promise(resolve=>setTimeout(resolve,1000))
  }
 }else{
  if(snapshot.project.video && !next && !retryPreview)throw new Error('Expected a deck without a video')
  // Set up all slide identities but run one scene to bound diagnostic cost.
  if(!snapshot.project.video) await changeProject(projectId,current=>{
   current.project.video={settings:{presence:'off',voice:{kind:'ai',id:'default'},harness:current.project.harness},scenes:[],transitions:[],inputKey:'',produced:null}
   reconcileVideo(current.project)
  })
  const scene=(await loadProject(projectId)).project.video.scenes.find(scene=>retryPreview?scene.phase==='failed' && scene.creativePlan && scene.moments.length && !scene.preview:scene.phase==='queued')
  if(!scene)throw new Error(retryPreview?'No failed preview with a saved plan remains':'No queued scene remains')
  if(retryPreview){
   const {loadStageCheckpoint}=await import('../engine/artifacts.ts')
   const checkpoint=await loadStageCheckpoint(projectId,scene.id,'planning',scene.planKey)
   if(!checkpoint?.data?.moments?.length || !checkpoint.data.creativePlan)throw new Error('Saved planning checkpoint required; refusing to regenerate the plan')
   const {advanceScene}=await import('../engine/autopilot.ts')
   await changeProject(projectId,current=>Object.assign(current.project.video.scenes.find(item=>item.id===scene.id),advanceScene(scene,'retry')))
  }
  selectedSceneId=scene.id
  await planScene(projectId,scene.id)
 }
 const result=(await loadProject(projectId)).project.video.scenes.find(scene=>scene.id===selectedSceneId)
 console.log(JSON.stringify({scene:result.id,phase:result.phase,moments:result.moments.length,preview:Boolean(result.preview),produced:Boolean(result.produced),error:result.error}))
 if(result.phase==='failed')process.exitCode=1
}finally{
 await stopEngineRuns()
 const runs=await Promise.all((await listNotebookRows('engine-runs',projectId)).filter(id=>!before.has(id)).map(id=>readRow('engine-runs',id)))
 await writeFile(join(root,'diagnostic-report.json'),JSON.stringify({storage:'isolated-local-diagnostic-not-S3-proof',scope:production?'scene-production':'scene-planning-and-preview',selectedSceneId,projectId,snapshot:await loadProject(projectId),runs},null,2),{mode:0o600})
 server.closeAllConnections();server.close()
}
