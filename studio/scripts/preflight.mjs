import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {access} from 'node:fs/promises'
const execute=promisify(execFile)

// No credentials, storage connections, model calls or device access.
export async function preflight(){
 const missing=[]
 if(Number(process.versions.node.split('.')[0])<22)missing.push('Install Node 22 or later.')
 const tools=[['ffmpeg','Install FFmpeg for video export.'],['ffprobe','Install FFmpeg including ffprobe.'],['python3','Install Python 3 for presentation validation.'],['uv','Install uv for recorded-speech alignment.']]
 await Promise.all(tools.map(async([command,fix])=>{
  try{await execute(command,[command==='ffmpeg' || command==='ffprobe'?'-version':'--version'],{timeout:10000,maxBuffer:128*1024})}catch{missing.push(`${command}: ${fix}`)}
 }))
 try{const {default:puppeteer}=await import('puppeteer');await access(await puppeteer.executablePath())}catch{missing.push('Rendering browser: run yarn puppeteer browsers install chrome.')}
 if(missing.length)throw new Error(`Studio cannot start yet:\n${missing.map(message=>`  • ${message}`).join('\n')}\nRun yarn doctor after fixing these prerequisites. Notebook storage has not been opened.`)
}
