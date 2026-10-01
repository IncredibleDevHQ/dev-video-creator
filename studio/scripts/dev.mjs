import {preflight} from './preflight.mjs'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {fileURLToPath} from 'node:url'
import {resolve,dirname} from 'node:path'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
try{process.loadEnvFile(resolve(root,'.env'))}catch(error){if(error.code!=='ENOENT') throw error}
const frontendPort=Number(process.env.MINIMAL_STUDIO_WEB_PORT || 4180)
const enginePort=Number(process.env.MINIMAL_STUDIO_PORT || 4320)
for(const port of [frontendPort,enginePort]) if(!Number.isInteger(port) || port<1 || port>65535) throw new Error('Studio ports must be integers between 1 and 65535')
if(frontendPort===enginePort) throw new Error('Studio web and engine ports must differ')
// Refuse collisions before opening notebook storage or starting recovery jobs.
const probe=port=>new Promise((resolve,reject)=>{
 const server=createServer()
 server.once('error',()=>reject(new Error(`Port ${port} is already in use. Stop that app or set MINIMAL_STUDIO_WEB_PORT and MINIMAL_STUDIO_PORT to free ports.`)))
 server.listen(port,'127.0.0.1',()=>server.close(error=>error?reject(error):resolve()))
})
await Promise.all([probe(frontendPort),probe(enginePort)])
try{await preflight()}catch(error){console.error(error.message);process.exit(1)}
const bin=resolve(root,'node_modules/.bin')
const children=[]
let stopping=false
const stop=(code=0)=>{
 if(stopping) return
 stopping=true;process.exitCode=code
 for(const child of children) if(child.exitCode===null) child.kill('SIGTERM')
}
for(const [command,args] of [
 ['vite',['--host','127.0.0.1','--port',String(frontendPort),'--strictPort']],
 ['tsx',['watch','engine/server.ts']],
]){
 const child=spawn(resolve(bin,command),args,{cwd:root,stdio:'inherit'});children.push(child)
 child.once('error',()=>{console.error(`Could not start ${command}. Run yarn install and yarn doctor.`);stop(1)})
 child.once('exit',(code,signal)=>{if(!stopping) stop(code ?? (signal?1:0))})
}
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>stop())
