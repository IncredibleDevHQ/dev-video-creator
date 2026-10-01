// Runs only against disposable infrastructure provisioned by storage-check.mjs.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import { mkdtemp,rm,readFile,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Pool } from 'pg'
import { S3Client,CreateBucketCommand,GetObjectCommand,PutObjectCommand } from '@aws-sdk/client-s3'
if(process.env.MINIMAL_STORAGE_FIXTURE!=='disposable') throw new Error('This check requires isolated fixture infrastructure')
const {remoteStorageConfig}=await import('../engine/storage/config')
const config=remoteStorageConfig()
assert.match(config.bucket,/^minimal-fixture-/)
const objects=new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:true,credentials:config.credentials})
const database=new Pool({connectionString:config.databaseUrl})
const mode=process.argv[2]
if(mode==='seed') await objects.send(new CreateBucketCommand({Bucket:config.bucket}))
const {storeAsset,writeRow,readRow,readAsset,listRows,closePersistence}=await import('../engine/persistence')
const {saveStageCheckpoint,archiveFiles,loadStageCheckpoint,restoreFiles}=await import('../engine/artifacts')
const {refreshVideoKeys,reconcileVideo}=await import('../engine/scene-model')
const {normalizeMoments}=await import('../engine/moment-plan')
const {runCommand}=await import('../engine/voice')
const {loadProject}=await import('../engine/projects')
const {recoverProjects}=await import('../engine/recovery')
const {produceScene}=await import('../engine/production')
const {prepareSceneAnimation,finishSceneAnimation}=await import('../engine/animation')
const {produceVideo}=await import('../engine/video-export')
const {sceneCover}=await import('../engine/video-cover')
const {exportPresentation}=await import('../engine/presentation-export')
const {createHash}=await import('node:crypto')
const projectId='fixture-notebook'
try {
  if(mode==='seed') {
    const dir=await mkdtemp(join(tmpdir(),'minimal-storage-media-'))
    try {
      const path=join(dir,'scene.mp4')
      await runCommand('ffmpeg',['-y','-f','lavfi','-i','color=c=green:s=160x90:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',path])
      const asset=await storeAsset({body:await readFile(path),contentType:'video/mp4',extension:'.mp4',kind:'produced-scene',projectId,sceneId:'scene-slide'})
      assert.match(asset.objectKey,/^notebooks\/fixture-notebook\/scenes\/scene-slide\//)
      const project:import('../shared/model').Project={id:projectId,title:'Storage fixture',source:'Synthetic media.',slides:[{id:'slide',title:'Storage fixture',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="green"/></svg>'}],video:{settings:{presence:'off',voice:{kind:'ai',id:'default'}},scenes:[],transitions:[],inputKey:'',produced:null}}
      reconcileVideo(project)
      const scene=project.video!.scenes[0]
      scene.moments=normalizeMoments({moments:[{title:'Fixture',lines:'Synthetic fixture.',seconds:2,camera:'none',layout:'corner',overlay:'title-card',cue:'Fixture'}]},scene.id,'off','title')
      refreshVideoKeys(project)
      const moment=scene.moments[0]
      moment.audio={inputKey:moment.audioKey,objectKey:asset.objectKey,duration:2};moment.media={inputKey:moment.audioKey,clips:[{start:0,end:2,camera:false}]}
      refreshVideoKeys(project);scene.phase='producing'
      await saveStageCheckpoint(projectId,scene.id,'animation',scene.animationKey!,{inputKey:scene.animationKey,objectKey:asset.objectKey,moments:scene.moments.map(({id,start,end})=>({id,start,end}))})
      const files={'index.html':'<!doctype html><p>Explicit synthetic composition fixture</p>'}
      await saveStageCheckpoint(projectId,scene.id,'composition',scene.inputKey,null,await archiveFiles(projectId,scene.id,'composition',files))
      await saveStageCheckpoint(projectId,scene.id,'render',scene.inputKey,{objectKey:asset.objectKey})
      await writeRow('projects',projectId,{project,status:'ready',error:null,events:[]})
      const pdf=await exportPresentation(project)
      await writeRow('test-cases','presentation-export',{projectId,sha256:createHash('sha256').update(pdf).digest('hex')})
      await writeRow('sources',projectId,{text:'Synthetic source evidence'})
      const draftFiles={'01_fixture.svg':project.slides[0].svg!,'01_fixture.program.json':'{"version":1,"fixture":true}','design_spec.md':'Synthetic retained design system'}
      await saveStageCheckpoint('draft-notebook',undefined,'creative-page-drafts','fixture-input',{fingerprint:'fixture'},await archiveFiles('draft-notebook',undefined,'page-draft',draftFiles))
      await writeRow('projects','draft-notebook',{project:{id:'draft-notebook',title:'Interrupted deck fixture',source:'Synthetic source',slides:[{...project.slides[0],draft:true}],video:null},status:'failed',plannedSlides:3,error:'Stopped at the stage time limit.',events:[]})
      await writeRow('settings','models',{apiKey:'fixture-server-secret'})
      const rows=await database.query("select a.object_key,a.s3_uri,a.status from minimal_studio_rows r join minimal_studio_artifacts a on a.id=r.artifact_id where r.kind='projects' and r.id=$1",[projectId])
      assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].status,'ready');assert.match(rows.rows[0].s3_uri,/^s3:\/\/minimal-fixture-/)
      const secret=await database.query("select artifact_id from minimal_studio_rows where kind='settings' and id='models'")
      assert.equal(secret.rows[0].artifact_id,null)
      // Simulate a process stopping after upload, before marking it ready.
      await database.query("update minimal_studio_artifacts set status='pending' where id=$1",[asset.id])
      console.log('Stored notebook, composition, render and checkpoints in PostgreSQL + MinIO; settings stay server-only.')
    } finally {await rm(dir,{recursive:true,force:true})}
  } else if(mode==='resume') {
    // This process has a different, empty local folder. Production must use
    // the PostgreSQL pointers and S3 artifacts created by the previous one.
    assert.equal((await readRow<{text:string}>('sources',projectId))?.text,'Synthetic source evidence')
    const savedProject=await loadProject(projectId)
    const recoveredScene=savedProject!.project.video!.scenes[0]
    const animation=await prepareSceneAnimation(savedProject!.project,recoveredScene,async()=>{throw new Error('A saved animation must not invoke generation or rendering')})
    assert.equal(animation.inputKey,recoveredScene.animationKey)
    assert.ok((await readAsset(animation.objectKey)).length>1000)
    assert.deepEqual(animation.moments,recoveredScene.moments.map(({id,start,end})=>({id,start,end})))
    console.log('Content animation and its moment clock resumed from PostgreSQL/S3 without regeneration.')
    const finished=await finishSceneAnimation(projectId,recoveredScene,animation)
    const composited=await storeAsset({body:finished,contentType:'video/mp4',extension:'.mp4',kind:'composited-scene-fixture',projectId,sceneId:recoveredScene.id})
    await writeRow('test-cases','composited-export',{objectKey:composited.objectKey,sha256:createHash('sha256').update(finished).digest('hex')})
    const decodeDir=await mkdtemp(join(tmpdir(),'minimal-remote-finish-'))
    try{const path=join(decodeDir,'finished.mp4');await writeFile(path,finished);await runCommand('ffmpeg',['-v','error','-i',path,'-f','null','-'])}finally{await rm(decodeDir,{recursive:true,force:true})}
    console.log('Finished and decoded a scene from remote animation and measured audio, without model generation.')
    const exported=await exportPresentation(savedProject!.project)
    const originalPdf=await readRow<{sha256:string}>('test-cases','presentation-export')
    assert.equal(createHash('sha256').update(exported).digest('hex'),originalPdf?.sha256)
    const pdfAssets=await database.query("select count(*)::int as count from minimal_studio_artifacts where notebook_id=$1 and content_type='application/pdf'",[projectId])
    assert.equal(pdfAssets.rows[0].count,1)
    console.log('PDF export resumed byte-for-byte from PostgreSQL/S3 in a fresh worker without another render.')
    const draft=(await loadProject('draft-notebook'))!
    assert.equal(draft.status,'failed');assert.equal(draft.plannedSlides,3);assert.equal(draft.project.slides.length,1);assert.equal(draft.project.slides[0].draft,true)
    const checkpoint=await loadStageCheckpoint('draft-notebook',undefined,'creative-page-drafts','fixture-input')
    assert.ok(checkpoint)
    const draftFiles=await restoreFiles(checkpoint.artifacts)
    assert.equal(draftFiles['01_fixture.svg'],draft.project.slides[0].svg)
    assert.equal(draftFiles['01_fixture.program.json'],'{"version":1,"fixture":true}')
    assert.equal(draftFiles['design_spec.md'],'Synthetic retained design system')
    assert.equal(await loadStageCheckpoint('draft-notebook',undefined,'creative-page-drafts','changed-input'),null)
    assert.ok(checkpoint.artifacts.every(artifact=>artifact.objectKey.startsWith('notebooks/draft-notebook/')))
    console.log('Interrupted deck recovered its exact draft SVG, editable program and design system in a fresh worker; changed inputs cannot reuse the checkpoint.')
    let requested=false
    await recoverProjects({slides:()=>{throw new Error('Unexpected slide generation')},planning:()=>{throw new Error('Unexpected planning')},scene:async(id,sceneId)=>{requested=true;return produceScene(id,sceneId)},video:async()=>{throw new Error('Unexpected join')}})
    assert.equal(requested,true)
    const deadline=Date.now()+15000
    while(!(await loadProject(projectId))?.views?.scenes['scene-slide'].produced) {
      if(Date.now()>deadline) throw new Error('Resume did not publish the saved render')
      await new Promise(resolve=>setTimeout(resolve,50))
    }
    const ready=await database.query("select status from minimal_studio_artifacts where notebook_id=$1 and kind='produced-scene'",[projectId])
    assert.equal(ready.rows[0].status,'ready','Restart must reconcile a completed pending upload')
    const snapshot=(await loadProject(projectId))!
    const scene=snapshot.project.video!.scenes[0]
    assert.equal(scene.phase,'produced')
    assert.ok((await readAsset(scene.produced!.objectKey)).length>1000)
    const renders=await database.query("select count(*)::int as count from minimal_studio_artifacts where notebook_id=$1 and kind='produced-scene'",[projectId])
    assert.equal(renders.rows[0].count,1,'Resume must reuse the rendered artifact')
    assert.equal((await loadStageCheckpoint(projectId,scene.id,'composition',scene.inputKey))?.artifacts.length,1)
    const {createStudioServer}=await import('../engine/server')
    const server=createStudioServer().listen(0,'127.0.0.1');await once(server,'listening')
    try {
      const port=(server.address() as {port:number}).port
      const notebooks=await (await fetch(`http://127.0.0.1:${port}/api/projects`)).json() as Array<{id:string}>
      assert.ok(notebooks.some(item=>item.id===projectId))
      const manifest=await (await fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/artifacts`)).json() as {artifacts:Array<{objectKey:string;s3Uri:string}>;stages:unknown[]}
      assert.ok(manifest.artifacts.length>=4);assert.ok(manifest.stages.length>=2)
      assert.ok(manifest.artifacts.every(item=>item.objectKey.startsWith(`notebooks/${projectId}/`) && item.s3Uri.startsWith(`s3://${config.bucket}/`)))
      const range=await fetch(`http://127.0.0.1:${port}/objects/${scene.produced!.objectKey}`,{headers:{Range:'bytes=0-15'}})
      assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,16)
    } finally {await new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections()})}
    await produceVideo(projectId)
    const joinDeadline=Date.now()+15000
    let joined=await loadProject(projectId)
    while(!joined?.project.video?.produced){
      if(Date.now()>joinDeadline || joined?.project.video?.phase==='failed')throw new Error('Remote join did not complete')
      await new Promise(resolve=>setTimeout(resolve,50));joined=await loadProject(projectId)
    }
    const video=joined.project.video.produced
    const coverKeys=[animation.posterKey,scene.produced!.posterKey,video.posterKey]
    assert.ok(coverKeys.every(key=>key?.startsWith(`notebooks/${projectId}/`)))
    const hash=async(key:string)=>createHash('sha256').update(await readAsset(key)).digest('hex')
    await writeRow('test-cases','media-export',{objectKey:video.objectKey,sha256:await hash(video.objectKey),covers:await Promise.all(coverKeys.map(async key=>({key,sha256:await hash(key!)})))})
    console.log('Saved content animation, scene and joined-video covers as notebook-scoped S3 artifacts.')
  } else if(mode==='verify-media') {
    const saved=(await loadProject(projectId))!,scene=saved.project.video!.scenes[0],video=saved.project.video!.produced!
    const expected=(await readRow<{objectKey:string;sha256:string;covers:Array<{key:string;sha256:string}>}>('test-cases','media-export'))!
    const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex')
    assert.equal(video.objectKey,expected.objectKey)
    assert.equal(hash(await readAsset(video.objectKey)),expected.sha256)
    const composited=(await readRow<{objectKey:string;sha256:string}>('test-cases','composited-export'))!
    assert.equal(hash(await readAsset(composited.objectKey)),composited.sha256)
    assert.ok(composited.objectKey.startsWith(`notebooks/${projectId}/scenes/${scene.id}/`))
    const clock=await loadStageCheckpoint<{audioKey:string}>(projectId,scene.id,'creative-clock',scene.inputKey)
    assert.ok(clock?.data.audioKey.startsWith(`notebooks/${projectId}/scenes/${scene.id}/`))
    assert.ok((await readAsset(clock!.data.audioKey)).length>1000)
    const before=await database.query("select count(*)::int as count from minimal_studio_artifacts where notebook_id=$1 and kind in ('video-cover','produced-video','produced-scene')",[projectId])
    for(const cover of expected.covers)assert.equal(hash(await readAsset(cover.key)),cover.sha256)
    assert.equal(hash(await sceneCover(projectId,scene.id)),expected.covers.find(cover=>cover.key===scene.produced!.posterKey)!.sha256)
    const restored=await prepareSceneAnimation(saved.project,scene,async()=>{throw new Error('Remote media recovery must not generate')})
    assert.equal(restored.posterKey,expected.covers[0].key)
    const after=await database.query("select count(*)::int as count from minimal_studio_artifacts where notebook_id=$1 and kind in ('video-cover','produced-video','produced-scene')",[projectId])
    assert.equal(after.rows[0].count,before.rows[0].count,'A third empty worker must reuse retained media and covers')
    // Only corrupt this disposable bucket after the fresh-worker checks.
    await objects.send(new PutObjectCommand({Bucket:config.bucket,Key:scene.produced!.objectKey,Body:Buffer.from('corrupt fixture')}))
    await assert.rejects(readAsset(scene.produced!.objectKey),/checksum/)
    console.log('Third empty worker recovered joined video and all covers byte-for-byte without new artifacts, and rejected corrupt scene bytes.')
  } else throw new Error('Choose seed or resume')
} finally {await closePersistence();await database.end();objects.destroy()}
