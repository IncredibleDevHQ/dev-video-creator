// Read-only inspection of real retained outputs; never starts paid generation.
import {spawn} from 'node:child_process'
import {join,resolve} from 'node:path'
import {createServer} from 'node:http'
import {disposableStorage} from './disposable-storage.mjs'
import {restoreBlogFixture} from './restore-blog-fixture.mjs'
const backup=resolve(process.argv[2] || ''),projectId=process.argv[3]
if(!projectId || !/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('Supply a backup directory and notebook ID')
const storage=await disposableStorage()
let vite,server,stopping=false
const stop=async()=>{if(stopping)return;stopping=true;vite?.kill('SIGTERM');server?.close();await storage.cleanup();process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
try {
 await restoreBlogFixture(backup,storage.env)
 Object.assign(process.env,storage.env,{MINIMAL_STUDIO_DATA_DIR:join(storage.root,'preview'),MINIMAL_STUDIO_PORT:'4324',VITEST:'read-only-preview'})
 delete process.env.MINIMAL_STUDIO_ALLOW_LIVE_HARNESS
 const {readRow,readAsset,writeRow,listNotebookRows}=await import('../engine/persistence.ts')
 const {pageSvgProblems}=await import('../engine/creative/pages.ts')
 const snapshot=await readRow('projects',projectId),outline=await readRow('outlines',projectId)
 if(!snapshot || !outline) throw new Error('Retained notebook or outline missing')
 const candidates=new Map()
 for(const id of await listNotebookRows('engine-artifacts',projectId)) {
  const run=await readRow('engine-artifacts',id)
  if(run?.stage!=='drawing') continue
  for(const ref of run.artifacts || []) {
   const match=ref.name.match(/(?:^|\/)(\d+)[_-].*\.svg$/)
   if(!match)continue
   const index=Number(match[1])-1,scene=outline.outline.scenes[index]
   if(!scene)continue
   const svg=(await readAsset(ref.objectKey)).toString()
   if(pageSvgProblems(svg).length)continue
   candidates.set(index,{id:outline.slideIds[index],title:scene.title,svg,draft:true,narration:scene.narration})
  }
 }
 snapshot.project.slides=[...candidates].sort(([a],[b])=>a-b).map(([,slide])=>slide)
 snapshot.readOnly=true
 snapshot.plannedSlides=outline.outline.scenes.length;snapshot.status='failed'
 snapshot.error='Generation stopped. Saved drafts are available for review. This preview is read-only.'
 await writeRow('projects',projectId,snapshot)
 const {createStudioServer}=await import('../engine/server.ts')
 const handler=createStudioServer().listeners('request')[0]
 server=createServer((request,response)=>{
  if(request.method!=='GET'){response.writeHead(403,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'Read-only preview: generation is disabled.'}));return}
  handler(request,response)
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4324,'127.0.0.1',resolve)})
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4184','--strictPort'],{env:process.env,stdio:'inherit'})
 vite.on('exit',stop)
 console.log(`Real retained drafts (${candidates.size}): http://127.0.0.1:4184/?notebook=${projectId}`)
}catch(error){console.error(error.message);await stop()}
