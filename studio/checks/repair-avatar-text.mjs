// One recorded, deterministic layout repair of the isolated Canvas diagnostic.
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const root=process.argv[2],projectId='cc4f18d0-688c-40f4-93ab-a4773bafdabc',sceneId='scene-5f955bda-0b30-489e-8e50-3487bc25b3f6'
const marker=JSON.parse(await readFile(join(root,'diagnostic-report.json'),'utf8'))
if(marker.storage!=='isolated-local-diagnostic-not-S3-proof' || marker.projectId!==projectId)throw Error('Isolated Canvas diagnostic required')
process.env.MINIMAL_STUDIO_PERSISTENCE='local';process.env.MINIMAL_STUDIO_DATA_DIR=root
const {loadProject,changeProject,addEvent}=await import('../engine/projects.ts')
const {loadStageCheckpoint,restoreFiles,archiveFiles,saveStageCheckpoint}=await import('../engine/artifacts.ts')
const {storeAsset,writeRow}=await import('../engine/persistence.ts')
const {renderProductionBundle}=await import('../render/production-render.ts')
const snapshot=await loadProject(projectId),scene=snapshot.project.video.scenes.find(s=>s.id===sceneId),key=scene.inputKey
if(scene.phase!=='produced')throw Error('Wait for the produced scene')
const saved=await loadStageCheckpoint(projectId,sceneId,'composition',key),files=await restoreFiles(saved.artifacts)
const original=files['index.html']
if(typeof original!=='string' || !original.includes('#s2-new .ch, #s2-old .ch { white-space: pre; }'))throw Error('The observed text layout changed; inspect it again')
files['index.html']=original.replace('#s2-new .ch, #s2-old .ch { white-space: pre; }','#s2-new .ch, #s2-old .ch { white-space: pre-wrap; overflow-wrap: anywhere; }')
const evidence=await mkdtemp(join(tmpdir(),'studio-text-repair-'))
await writeFile(join(evidence,'index.html'),files['index.html'])
const bytes=await renderProductionBundle(files,{fps:30});await writeFile(join(evidence,'scene.mp4'),bytes)
const artifacts=await archiveFiles(projectId,sceneId,'composition-layout-repair',files)
const asset=await storeAsset({body:bytes,contentType:'video/mp4',kind:'produced-scene-layout-repair',extension:'.mp4',projectId,sceneId})
await writeRow('layout-repairs',asset.id,{projectId,sceneId,inputKey:key,previous:saved.artifacts,artifacts,reason:'Per-character nonbreaking spaces overflowed the sentence column into the feedback card. Allow wrapping within its existing width.',origin:'Codex deterministic CSS repair; not a new model generation',objectKey:asset.objectKey})
// Avoid racing another process's project write. Rendering and artifact storage
// are independent; publication waits for the live notebook's active work.
for(let tries=0;;tries++){
 const current=await loadProject(projectId)
 if(!current.project.video.scenes.some(s=>['writing','replanning','producing','changing'].includes(s.phase)))break
 if(tries===24)throw Error(`Render retained in ${evidence}; publish after active work finishes`)
 await new Promise(r=>setTimeout(r,5000))
}
await saveStageCheckpoint(projectId,sceneId,'composition',key,null,artifacts)
await saveStageCheckpoint(projectId,sceneId,'creative-production',key,null,artifacts)
await saveStageCheckpoint(projectId,sceneId,'render',key,{objectKey:asset.objectKey})
await changeProject(projectId,current=>{const target=current.project.video.scenes.find(s=>s.id===sceneId);if(target.inputKey!==key)throw Error('Scene changed during repair');target.produced={inputKey:key,objectKey:asset.objectKey};addEvent(current,'scene','Text wrapping corrected; video saved',{sceneId,activity:'complete'})})
console.log(JSON.stringify({evidence,objectKey:asset.objectKey}))
