// Read-only setup checks: never connects to notebook stores or runs a model.
import {spawnSync} from 'node:child_process'
import {access} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
try{process.loadEnvFile(resolve(root,'.env'))}catch(error){if(error.code!=='ENOENT') throw error}
let failures=0
const report=(ok,label,fix)=>{console.log(`${ok?'PASS':'FAIL'} ${label}${ok?'':` — ${fix}`}`);if(!ok) failures++}
report(Number(process.versions.node.split('.')[0])>=22,'Node 22 or later','Install Node 22+ and rerun yarn install.')
for(const [command,args,fix] of [
 ['ffmpeg',['-version'],'Install FFmpeg for recording and MP4 export.'],
 ['ffprobe',['-version'],'Install FFmpeg, including ffprobe.'],
 ['python3',['--version'],'Install Python 3 for the presentation checker.'],
 ['uv',['--version'],'Install uv for speech alignment.'],
]) report(spawnSync(command,args,{stdio:'ignore',timeout:10000}).status===0,command,fix)
const harnesses=['kimi','claude','codex'].filter(command=>spawnSync(command,['--version'],{stdio:'ignore',timeout:10000}).status===0)
report(harnesses.length>0,`AI harness${harnesses.length?`: ${harnesses.join(', ')}`:''}`,'Install and sign in to Kimi, Claude Code, or Codex. No model calls are made by this check.')
try{const {default:puppeteer}=await import('puppeteer');await access(await puppeteer.executablePath());report(true,'Presentation and preview browser')}catch{report(false,'Presentation and preview browser','Run yarn puppeteer browsers install chrome.')}
for(const name of ['story-master','page-master','video-planner','scene-producer']){
 const found=await access(resolve(root,`skills/${name}/SKILL.md`)).then(()=>true,()=>false)
 report(found,`${name} skill`,'Restore the bundled skills folder.')
}
const storage=process.env.MINIMAL_STUDIO_PERSISTENCE || (process.env.MINIMAL_STUDIO_DATABASE_URL?'postgres-s3':'local')
report(['local','postgres-s3'].includes(storage),'Storage mode','Use local or postgres-s3.')
if(storage==='postgres-s3'){
 for(const name of ['MINIMAL_STUDIO_DATABASE_URL','MINIMAL_STUDIO_S3_BUCKET']) report(Boolean(process.env[name]),name,`Set ${name} in .env. Values are never printed.`)
 console.log('INFO PostgreSQL/S3 configuration present; connectivity and existing notebook data were not accessed.')
}
console.log('INFO Harness sign-in, voice-provider access and physical devices require their own flow checks.')
process.exitCode=failures?1:0
