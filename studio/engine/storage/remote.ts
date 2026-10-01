import {Pool} from 'pg'
import {listenForNotebookWrites} from './notifications'
import { createHash,randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {createStorageClients} from './clients'
import { PutObjectCommand,GetObjectCommand,DeleteObjectCommand,HeadBucketCommand } from '@aws-sdk/client-s3'
import { remoteStorageConfig,validStorageId,validObjectKey,assetIdOf } from './config'
const config=remoteStorageConfig()
const {database,objects}=createStorageClients(config)
const operationDatabase=new Pool({connectionString:config.databaseUrl,max:5,connectionTimeoutMillis:5000,query_timeout:30000,statement_timeout:30000})
let ready:Promise<void>|null=null
let stopNotifications: (() => void) | undefined
const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex')
type Artifact={id:string;notebook_id:string|null;scene_id:string|null;moment_id:string|null;kind:string;bucket:string;object_key:string;s3_uri:string;content_type:string;byte_size:string;sha256:string;status:string}
const download=async(row:Artifact) => {
  const response=await objects.send(new GetObjectCommand({Bucket:row.bucket,Key:row.object_key}))
  if(!response.Body) throw new Error('Missing stored artifact')
  const body=Buffer.from(await response.Body.transformToByteArray())
  if(body.length!==Number(row.byte_size) || hash(body)!==row.sha256) throw new Error('Stored artifact checksum mismatch')
  return body
}
export const initializePersistence=()=>{
  ready ||= (async()=>{
    const schema=await readFile(new URL('./schema.sql',import.meta.url),'utf8')
    const client=await database.connect()
    try {await client.query('begin');await client.query("select pg_advisory_xact_lock(hashtext('minimal-studio-schema-v1'))");await client.query(schema);await client.query('commit')}
    catch(error){await client.query('rollback');throw error}finally{client.release()}
    // Bucket creation is an infrastructure responsibility, including for AWS.
    await objects.send(new HeadBucketCommand({Bucket:config.bucket}))
    const pending=await database.query<Artifact>("select * from minimal_studio_artifacts where status='pending'")
    for(const row of pending.rows) {
      try {await download(row);await database.query("update minimal_studio_artifacts set status='ready' where id=$1 and status='pending'",[row.id])}
      catch(error) {
        const status=(error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode
        if(status===404) await database.query("update minimal_studio_artifacts set status='failed' where id=$1 and status='pending'",[row.id])
        else throw error
      }
    }
    stopNotifications ||= await listenForNotebookWrites(database)
  })().catch(error=>{ready=null;throw error})
  return ready
}
const ownerOf=(kind:string,id:string,value:unknown):string|null=>{
  if(['projects','sources','outlines'].includes(kind)) return id
  if(value && typeof value==='object') {const raw=value as {projectId?:string;notebookId?:string};return raw.projectId || raw.notebookId || null}
  return null
}
export type AssetInput={body:Buffer;contentType:string;projectId?:string;kind:string;extension:string;sceneId?:string;momentId?:string}
export const storeAsset=async(input:AssetInput)=>{
  await initializePersistence()
  for(const value of [input.projectId,input.sceneId,input.momentId,input.kind]) if(value && !validStorageId(value)) throw new Error('Invalid artifact identity')
  const id=randomUUID(),extension=/^\.[a-z0-9]+$/i.test(input.extension)?input.extension:'.bin'
  const scope=input.projectId?`${config.prefix}/${input.projectId}`:'studio-shared'
  const objectKey=`${scope}/${input.sceneId?`scenes/${input.sceneId}/`:''}${input.momentId?`moments/${input.momentId}/`:''}${input.kind}/${id}${extension}`
  const s3Uri=`s3://${config.bucket}/${objectKey}`
  const checksum=hash(input.body)
  await database.query(`insert into minimal_studio_artifacts(id,notebook_id,scene_id,moment_id,kind,bucket,object_key,s3_uri,content_type,byte_size,sha256,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,[id,input.projectId || null,input.sceneId || null,input.momentId || null,input.kind,config.bucket,objectKey,s3Uri,input.contentType,input.body.length,checksum])
  await objects.send(new PutObjectCommand({Bucket:config.bucket,Key:objectKey,Body:input.body,ContentType:input.contentType,Metadata:{sha256:checksum}}))
  await database.query("update minimal_studio_artifacts set status='ready' where id=$1",[id])
  const asset={id,objectKey,s3Uri,contentType:input.contentType,projectId:input.projectId,sceneId:input.sceneId,momentId:input.momentId,kind:input.kind,sha256:checksum}
  await upsertRow('assets',id,asset,input.projectId || null,id)
  return asset
}
const upsertRow=async(kind:string,id:string,value:unknown,owner:string|null,artifact:string|null)=>{
  await database.query(`insert into minimal_studio_rows(kind,id,notebook_id,document,artifact_id) values($1,$2,$3,$4::jsonb,$5) on conflict(kind,id) do update set notebook_id=excluded.notebook_id,document=excluded.document,artifact_id=excluded.artifact_id,updated_at=now()`,[kind,id,owner,JSON.stringify(value),artifact])
}
export const writeRow=async(kind:string,id:string,value:unknown)=>{
  if(!validStorageId(kind) || !validStorageId(id)) throw new Error('Invalid storage identity')
  await initializePersistence()
  const owner=ownerOf(kind,id,value)
  // Credentials and global preferences remain server-side database settings.
  const sceneId=value && typeof value==='object'?(value as {sceneId?:string}).sceneId:undefined
  const artifact=owner && kind!=='assets'?await storeAsset({body:Buffer.from(JSON.stringify(value)),contentType:'application/json',extension:'.json',projectId:owner,sceneId,kind:`record-${kind}`}):null
  await upsertRow(kind,id,value,owner,artifact?.id || null)
}
export const readRow=async<T>(kind:string,id:string):Promise<T|null>=>{
  if(!validStorageId(kind) || !validStorageId(id)) throw new Error('Invalid storage identity')
  await initializePersistence()
  const result=await database.query<{document:T;artifact_id:string|null}>('select document,artifact_id from minimal_studio_rows where kind=$1 and id=$2',[kind,id])
  const row=result.rows[0];if(!row) return null
  // Assets metadata is indexed in PostgreSQL; stage rows resume from the
  // checksum-verified JSON artifact, not a machine-local cache.
  if(row.artifact_id && kind!=='assets') {
    const artifact=await database.query<Artifact>("select * from minimal_studio_artifacts where id=$1 and status='ready'",[row.artifact_id])
    if(!artifact.rows[0]) throw new Error('Stage artifact is not ready')
    return JSON.parse((await download(artifact.rows[0])).toString()) as T
  }
  return row.document
}
export const readAsset=async(key:string)=>{
  if(!validObjectKey(key)) throw new Error('Invalid object key')
  await initializePersistence()
  const result=await database.query<Artifact>("select * from minimal_studio_artifacts where bucket=$1 and object_key=$2 and status='ready'",[config.bucket,key])
  if(!result.rows[0]) throw new Error('Stored artifact is not ready')
  return download(result.rows[0])
}
export const listRows=async(kind:string)=>{
  if(!validStorageId(kind)) throw new Error('Invalid storage kind')
  await initializePersistence();const result=await database.query<{id:string}>('select id from minimal_studio_rows where kind=$1 order by id',[kind]);return result.rows.map(row=>row.id)
}
export const deleteRow=async(kind:string,id:string)=>{await initializePersistence();await database.query('delete from minimal_studio_rows where kind=$1 and id=$2',[kind,id])}
export const deleteAsset=async(key:string)=>{
  if(!validObjectKey(key)) throw new Error('Invalid object key')
  await initializePersistence()
  await objects.send(new DeleteObjectCommand({Bucket:config.bucket,Key:key}))
  await database.query("update minimal_studio_artifacts set status='deleted' where bucket=$1 and object_key=$2",[config.bucket,key])
  await deleteRow('assets',assetIdOf(key))
}
export const closePersistence=async()=>{stopNotifications?.();stopNotifications=undefined;await Promise.all([database.end(),operationDatabase.end()]);objects.destroy();ready=null}
export const listNotebookRows=async(kind:string,projectId:string)=>{
  if(!validStorageId(kind) || !validStorageId(projectId)) throw new Error('Invalid storage identity')
  await initializePersistence()
  const result=await database.query<{id:string}>('select id from minimal_studio_rows where kind=$1 and notebook_id=$2 order by id',[kind,projectId])
  return result.rows.map(row=>row.id)
}

/** A non-waiting session lock; PostgreSQL releases it if the worker disconnects. */
export const withOperationLock=async<T>(key:string,work:()=>Promise<T>):Promise<T>=>{
 await initializePersistence()
 const client=await operationDatabase.connect()
 let held=false
 try{
  const result=await client.query<{held:boolean}>('select pg_try_advisory_lock(hashtext($1),hashtext($2)) as held',['minimal-studio-operation',key])
  held=result.rows[0].held
  if(!held)throw new Error('This operation is already running')
  return await work()
 }finally{
  if(held)try{await client.query('select pg_advisory_unlock(hashtext($1),hashtext($2))',['minimal-studio-operation',key])}catch{client.release(true);throw new Error('The operation lock connection was interrupted')}
  client.release()
 }
}
