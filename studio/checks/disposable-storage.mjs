import {spawnSync} from 'node:child_process'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
export const disposableStorage=async()=>{
 const suffix=randomUUID().slice(0,8),containers=[]
 const root=await mkdtemp(join(tmpdir(),'minimal-blog-check-'))
 const docker=args=>{const result=spawnSync('docker',args,{encoding:'utf8',timeout:15000,killSignal:'SIGKILL'});if(result.status!==0) throw new Error(result.error?.code==='ETIMEDOUT'?'Docker did not respond within 15 seconds':String(result.stderr || result.error?.message || 'Docker failed').slice(0,300));return result.stdout.trim()}
 const cleanup=async()=>{for(const id of containers.reverse()) spawnSync('docker',['rm','-f',id],{stdio:'ignore',timeout:5000,killSignal:'SIGKILL'});await rm(root,{recursive:true,force:true})}
 try{
  const pgName=`minimal-blog-pg-${suffix}`,s3Name=`minimal-blog-s3-${suffix}`
  containers.push(pgName)
  const pg=docker(['run','-d','--rm','--name',`minimal-blog-pg-${suffix}`,'--tmpfs','/var/lib/postgresql/data:rw,size=1g','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD=disposable-fixture-password','-e','POSTGRES_DB=minimal_fixture','postgres:17-alpine'])
  containers.push(s3Name)
  const minio=docker(['run','-d','--rm','--name',`minimal-blog-s3-${suffix}`,'--tmpfs','/data:rw,size=4g','-p','127.0.0.1::9000','-e','MINIO_ROOT_USER=fixture-user','-e','MINIO_ROOT_PASSWORD=disposable-fixture-password','minio/minio:RELEASE.2025-09-07T16-13-09Z','server','/data'])
  const pgPort=docker(['port',pg,'5432/tcp']).split(':').at(-1),s3Port=docker(['port',minio,'9000/tcp']).split(':').at(-1)
  const endpoint=`http://127.0.0.1:${s3Port}`
  const deadline=Date.now()+45000
  while(true){
   if(spawnSync('docker',['exec',pg,'pg_isready','-U','postgres'],{stdio:'ignore',timeout:2000,killSignal:'SIGKILL'}).status===0 && await fetch(`${endpoint}/minio/health/ready`,{signal:AbortSignal.timeout(2000)}).then(response=>response.ok).catch(()=>false)) break
   if(Date.now()>=deadline) throw new Error('Disposable storage did not start')
   await new Promise(resolve=>setTimeout(resolve,200))
  }
  return{root,suffix,cleanup,env:{MINIMAL_STORAGE_FIXTURE:'disposable',MINIMAL_STUDIO_PERSISTENCE:'postgres-s3',MINIMAL_STUDIO_DATABASE_URL:`postgres://postgres:disposable-fixture-password@127.0.0.1:${pgPort}/minimal_fixture`,MINIMAL_STUDIO_S3_ENDPOINT:endpoint,MINIMAL_STUDIO_S3_BUCKET:`minimal-fixture-${suffix}`,MINIMAL_STUDIO_S3_ACCESS_KEY_ID:'fixture-user',MINIMAL_STUDIO_S3_SECRET_ACCESS_KEY:'disposable-fixture-password',MINIMAL_STUDIO_S3_FORCE_PATH_STYLE:'true',MINIMAL_STUDIO_S3_REGION:'us-east-1',MINIMAL_STUDIO_S3_PREFIX:'notebooks',MINIMAL_STUDIO_S3_SESSION_TOKEN:'',OPENAI_API_KEY:'',FISH_AUDIO_API_KEY:''}}
 }catch(error){await cleanup();throw error}
}
