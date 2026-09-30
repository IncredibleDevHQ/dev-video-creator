// Actual model execution against infrastructure owned only by this check.
import {spawn,spawnSync} from 'node:child_process'
import {mkdir,readFile} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {tmpdir} from 'node:os'
import {S3Client,CreateBucketCommand,GetObjectCommand} from '@aws-sdk/client-s3'
import pg from 'pg'
import {writeFile} from 'node:fs/promises'
import {restoreBlogFixture} from './restore-blog-fixture.mjs'
import {disposableStorage} from './disposable-storage.mjs'
const studioRoot=join(dirname(fileURLToPath(import.meta.url)),'..')
if(spawnSync(join(studioRoot,'node_modules/.bin/tsc'),['--noEmit'],{cwd:studioRoot,stdio:'inherit'}).status!==0) throw new Error('Fix TypeScript errors before starting the live check')
const resumeSlides=process.argv.includes('--resume-slides')
const resumeAt=process.argv.indexOf(resumeSlides?'--resume-slides':'--resume')
const backup=resumeAt>=0?resolve(process.argv[resumeAt+1]):null
const sourceFile=resolve(resumeAt===2?'/tmp/studio-openai-canvas-source.txt':process.argv[2] || '/tmp/studio-openai-canvas-source.txt')
if((await readFile(sourceFile,'utf8')).length<1000) throw new Error('Supply the retained public blog text')
const storage=await disposableStorage()
const evidence=join(tmpdir(),`studio-kimi-blog-evidence-${storage.suffix}`)
await mkdir(evidence,{recursive:true,mode:0o700})
const run=mode=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['--import','tsx',join(studioRoot,'checks/kimi-blog.live.ts'),mode],{cwd:studioRoot,env:{...process.env,...storage.env,MINIMAL_STUDIO_DATA_DIR:join(storage.root,`worker-${mode}`),MINIMAL_BLOG_SOURCE_FILE:sourceFile,MINIMAL_BLOG_EVIDENCE:evidence},stdio:'inherit'})
 child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Kimi blog ${mode} failed; retained evidence: ${evidence}`)))
})
try{
 const client=new S3Client({endpoint:storage.env.MINIMAL_STUDIO_S3_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:storage.env.MINIMAL_STUDIO_S3_ACCESS_KEY_ID,secretAccessKey:storage.env.MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY}})
 if(backup) await restoreBlogFixture(backup,storage.env)
 else await client.send(new CreateBucketCommand({Bucket:storage.env.MINIMAL_STUDIO_S3_BUCKET}));client.destroy()
 console.log(`Actual Kimi K3 check. Evidence directory: ${evidence}`)
 for(const mode of resumeSlides?['resume-slides']:backup?['resume-planning','production']:['outline','planning','production']) await run(mode)
 }finally{
 // Keep notebook object bytes for inspecting failed candidates after fixtures
 // are removed. Credentials and CLI homes never enter this evidence directory.
 const pool=new pg.Pool({connectionString:storage.env.MINIMAL_STUDIO_DATABASE_URL})
 const objects=new S3Client({endpoint:storage.env.MINIMAL_STUDIO_S3_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:storage.env.MINIMAL_STUDIO_S3_ACCESS_KEY_ID,secretAccessKey:storage.env.MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY}})
 try{
  const {rows}=await pool.query("select * from minimal_studio_artifacts where notebook_id is not null and status='ready'")
  const backupDir=join(evidence,'storage-backup')
  await mkdir(join(backupDir,'objects'),{recursive:true,mode:0o700})
  const notebookRows=await pool.query("select * from minimal_studio_rows where notebook_id is not null or kind='test-cases'")
  await writeFile(join(backupDir,'rows.json'),JSON.stringify(notebookRows.rows,null,2),{mode:0o600})
  await writeFile(join(backupDir,'artifacts.json'),JSON.stringify(rows,null,2),{mode:0o600})
  await writeFile(join(evidence,'object-manifest.json'),JSON.stringify(rows,null,2),{mode:0o600})
  for(const row of rows){
   if(!/^[a-zA-Z0-9_-]+$/.test(row.id)) throw new Error('Invalid fixture artifact identity')
   const object=await objects.send(new GetObjectCommand({Bucket:row.bucket,Key:row.object_key}))
   await writeFile(join(backupDir,'objects',row.id),await object.Body.transformToByteArray(),{mode:0o600})
  }
  console.log(`Retained ${rows.length} notebook objects with their PostgreSQL manifest.`)
 }catch{console.error('Could not retain all disposable notebook objects; stage reports remain available.')}
 finally{objects.destroy();await pool.end();await storage.cleanup()}
}
