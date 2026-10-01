import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {createServer} from 'node:net'
import {resolve,join} from 'node:path'
import {expect,it} from 'vitest'
const execute=promisify(execFile)
const freePort=()=>new Promise<number>((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=(server.address() as {port:number}).port;server.close(error=>error?reject(error):resolve(port))})})
it('refuses missing runtime tools before creating notebook data or starting the engine',async()=>{
 const root=await mkdtemp(join(tmpdir(),'studio-startup-check-'))
 try{
  const enginePort=await freePort();let webPort=await freePort();while(webPort===enginePort)webPort=await freePort()
  const result=await execute(process.execPath,['scripts/dev.mjs'],{cwd:resolve(import.meta.dirname,'..'),timeout:20000,env:{...process.env,PATH:root,MINIMAL_STUDIO_DATA_DIR:join(root,'notebooks'),MINIMAL_STUDIO_PERSISTENCE:'local',MINIMAL_STUDIO_PORT:String(enginePort),MINIMAL_STUDIO_WEB_PORT:String(webPort)}}).catch(error=>error)
  expect(result.code).toBe(1)
  expect(result.stderr).toContain('ffmpeg: Install FFmpeg')
  expect(result.stderr).toContain('Notebook storage has not been opened.')
  expect(await readdir(root)).toEqual([])
 }finally{await rm(root,{recursive:true,force:true})}
})
