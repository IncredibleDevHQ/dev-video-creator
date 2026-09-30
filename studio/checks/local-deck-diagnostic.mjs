// Real harness diagnostic using copied fixtures; this does not prove S3/Postgres integration.
import {mkdtemp,readFile,mkdir,writeFile,readdir} from 'node:fs/promises'
import {join,basename} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {once} from 'node:events'
const backup=process.argv[2]
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
const root=await mkdtemp(join(tmpdir(),'studio-local-deck-diagnostic-'))
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
const {retrySlides,loadProject,stopSlides}=await import('../engine/projects.ts')
const {stopEngineRuns}=await import('../engine/harness/runtime.ts')
const {createStudioServer}=await import('../engine/server.ts')
const server=createStudioServer().listen(0,'127.0.0.1');await once(server,'listening')
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN=`http://127.0.0.1:${server.address().port}`
console.log(`LOCAL diagnostic only. Evidence: ${root}. API: ${process.env.MINIMAL_STUDIO_HARNESS_ORIGIN}. Notebook: ${projectId}`)
const before=new Set(await listNotebookRows('engine-runs',projectId))
const deadline=Date.now()+10*60*1000
try{
 await retrySlides(projectId)
 let last=''
 while(true){
  const snapshot=await loadProject(projectId)
  const progress=JSON.stringify({status:snapshot.status,slides:snapshot.project.slides.length,last:snapshot.events.at(-1)?.message})
  if(progress!==last){console.log(progress);last=progress}
  if(snapshot.status!=='building'){if(snapshot.status!=='ready')process.exitCode=1;break}
  if(Date.now()>deadline){await stopSlides(projectId);process.exitCode=1;break}
  await new Promise(resolve=>setTimeout(resolve,1000))
 }
}finally{
 await stopEngineRuns()
 const runs=await Promise.all((await listNotebookRows('engine-runs',projectId)).filter(id=>!before.has(id)).map(id=>readRow('engine-runs',id)))
 await writeFile(join(root,'diagnostic-report.json'),JSON.stringify({storage:'isolated-local-diagnostic-not-S3-proof',projectId,snapshot:await loadProject(projectId),runs},null,2),{mode:0o600})
 server.closeAllConnections();server.close()
}
