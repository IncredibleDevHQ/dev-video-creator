// One bounded composition using a copied diagnostic and its saved presenter take.
import {mkdtemp,cp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {once} from 'node:events'
import assert from 'node:assert/strict'
const source=process.argv[2],sceneId=process.argv[3]
if(!source || !sceneId || !process.argv.includes('--live'))throw new Error('Pass an isolated diagnostic, scene ID and --live')
const report=JSON.parse(await readFile(join(source,'diagnostic-report.json'),'utf8'))
assert.equal(report.storage,'isolated-local-diagnostic-not-S3-proof')
const root=await mkdtemp(join(tmpdir(),'studio-presenter-finish-live-'))
await cp(source,root,{recursive:true,filter:path=>!path.includes('/engine-workspaces')})
process.env.MINIMAL_STUDIO_DATA_DIR=root;process.env.MINIMAL_STUDIO_PERSISTENCE='local'
delete process.env.MINIMAL_STUDIO_DATABASE_URL;delete process.env.VITEST
process.env.OPENAI_API_KEY='';process.env.FISH_AUDIO_API_KEY=''
const {createStudioServer}=await import('../engine/server.ts')
const {loadProject}=await import('../engine/projects.ts')
const {produceScene,waitForSceneProduction}=await import('../engine/production.ts')
const {readAsset}=await import('../engine/persistence.ts')
const {stopEngineRuns}=await import('../engine/harness/runtime.ts')
const before=await loadProject(report.projectId),scene=before.project.video.scenes.find(s=>s.id===sceneId)
assert.equal(scene.phase,'waiting');assert.ok(scene.moments.some(m=>m.take?.duration>20))
const server=createStudioServer().listen(0,'127.0.0.1');await once(server,'listening')
process.env.MINIMAL_STUDIO_HARNESS_ORIGIN=`http://127.0.0.1:${server.address().port}`
console.log(`Bounded presenter finish in isolated copy ${root}`)
try{
 await produceScene(report.projectId,sceneId)
 await waitForSceneProduction(report.projectId,sceneId)
 const after=await loadProject(report.projectId),finished=after.project.video.scenes.find(s=>s.id===sceneId)
 await writeFile(join(root,'presenter-finish-proof.json'),JSON.stringify({sceneId,phase:finished.phase,error:finished.error,animation:finished.animation,produced:finished.produced,takes:finished.moments.map(m=>({id:m.id,take:m.take}))},null,2))
 assert.equal(finished.phase,'produced',finished.error || 'Scene did not finish')
 assert.ok(after.views.scenes[sceneId].produced)
 await writeFile(join(root,'recorded-scene.mp4'),await readAsset(finished.produced.objectKey))
 console.log(`Finished recorded scene: ${root}/recorded-scene.mp4`)
}finally{await stopEngineRuns();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}
