import {readdirSync,readFileSync} from 'node:fs'
import {writeFile,mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {expect,it} from 'vitest'
import {renderProductionBundle} from '../render/production-render'
import {probeSeconds} from '../engine/voice'
it('renders the copied sketch without narration into seekable preview video',async()=>{
 const root=fileURLToPath(new URL('./fixtures/sketch-runtime/token-bucket/',import.meta.url))
 const walk=(relative=''):Record<string,string>=>Object.assign({},...readdirSync(join(root,relative),{withFileTypes:true}).map(entry=>{const name=relative?`${relative}/${entry.name}`:entry.name;return entry.isDirectory()?walk(name):{[name]:readFileSync(join(root,name),'utf8')}}))
 const {'plan.json':_plan,...files}=walk()
 const duration=JSON.parse(files['manifest.json']).composition.duration
 const scratch=await mkdtemp(join(tmpdir(),'studio-preview-render-check-'))
 try{
  const bytes=await renderProductionBundle(files,{fps:30})
  expect(bytes.length).toBeGreaterThan(1000)
  const video=join(scratch,'preview.mp4');await writeFile(video,bytes)
  expect(await probeSeconds(video)).toBeCloseTo(duration,1)
 }finally{await rm(scratch,{recursive:true,force:true})}
},120000)
