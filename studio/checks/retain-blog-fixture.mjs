// Read-only backup of this check's owned disposable infrastructure.
import {spawnSync} from 'node:child_process'
import {mkdir,writeFile,access} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import pg from 'pg'
import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3'
import {createHash} from 'node:crypto'
const suffix=process.argv[2]
if(!/^[a-f0-9]{8}$/.test(suffix || '')) throw new Error('Supply this disposable blog check’s suffix')
const port=(name,service)=>{
 const result=spawnSync('docker',['port',name,service],{encoding:'utf8'})
 if(result.status!==0 || !/^127\.0\.0\.1:\d+\s*$/.test(result.stdout)) throw new Error('Owned fixture is not running on loopback')
 return result.stdout.trim().split(':').at(-1)
}
const pgPort=port(`minimal-blog-pg-${suffix}`,'5432/tcp'),s3Port=port(`minimal-blog-s3-${suffix}`,'9000/tcp')
const root=join(tmpdir(),`studio-kimi-blog-evidence-${suffix}`,'storage-backup')
await mkdir(join(root,'objects'),{recursive:true,mode:0o700})
const pool=new pg.Pool({connectionString:`postgres://postgres:disposable-fixture-password@127.0.0.1:${pgPort}/minimal_fixture`})
const objects=new S3Client({endpoint:`http://127.0.0.1:${s3Port}`,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:'fixture-user',secretAccessKey:'disposable-fixture-password'}})
try{
 const {rows}=await pool.query("select * from minimal_studio_rows where notebook_id is not null or kind='test-cases'")
 const {rows:artifacts}=await pool.query("select * from minimal_studio_artifacts where notebook_id is not null and status='ready'")
 await writeFile(join(root,'rows.json'),JSON.stringify(rows,null,2),{mode:0o600})
 await writeFile(join(root,'artifacts.json'),JSON.stringify(artifacts,null,2),{mode:0o600})
 for(const artifact of artifacts){
  if(!/^minimal-fixture-[a-f0-9]{8}$/.test(artifact.bucket) || !/^[a-zA-Z0-9_-]+$/.test(artifact.id)) throw new Error('Object belongs to another fixture')
  const target=join(root,'objects',artifact.id)
  if(await access(target).then(()=>true,()=>false)) continue
  const object=await objects.send(new GetObjectCommand({Bucket:artifact.bucket,Key:artifact.object_key}))
  const body=Buffer.from(await object.Body.transformToByteArray())
  if(createHash('sha256').update(body).digest('hex')!==artifact.sha256) throw new Error('Fixture object checksum mismatch')
  await writeFile(target,body,{mode:0o600})
 }
 console.log(`Retained ${rows.length} notebook rows and ${artifacts.length} checksummed objects.`)
}finally{objects.destroy();await pool.end()}
