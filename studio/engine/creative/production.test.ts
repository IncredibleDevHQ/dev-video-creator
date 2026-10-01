import {vi as mocker} from 'vitest'
mocker.mock('./cast-packet',()=>({prepareCastPacket:mocker.fn(async()=>({visualCast:{status:'synthetic-fixture'},media:{},assets:[],assetKeys:[]}))}))
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterAll,expect,it} from 'vitest'
import {collectProduction,mediaBindingInstructions} from './production'
const root=await mkdtemp(join(tmpdir(),'studio-production-input-'))
afterAll(()=>rm(root,{recursive:true,force:true}))
const supplied={'media/scene-audio.wav':Buffer.from('labelled synthetic audio fixture')}
const fixture=async(name:string)=>{
 const dir=join(root,name)
 await mkdir(join(dir,'production','media'),{recursive:true})
 await writeFile(join(dir,'production','index.html'),'<!doctype html><html></html>')
 await writeFile(join(dir,'production','manifest.json'),'{}')
 await writeFile(join(dir,'production','media','scene-audio.wav'),supplied['media/scene-audio.wav'])
 return dir
}
it('collects production output and keeps supplied audio bytes unchanged',async()=>{
 const files=await collectProduction(await fixture('accepted'),supplied)
 expect(files['index.html']).toContain('<!doctype html>')
 expect(files['media/scene-audio.wav']).toEqual({base64:supplied['media/scene-audio.wav'].toString('base64'),contentType:'application/octet-stream'})
})
it('refuses modified or missing product clock media',async()=>{
 const dir=await fixture('tampered')
 await writeFile(join(dir,'production','media','scene-audio.wav'),'changed')
 await expect(collectProduction(dir,supplied)).rejects.toThrow('unchanged')
 await rm(join(dir,'production','media','scene-audio.wav'))
 await expect(collectProduction(dir,supplied)).rejects.toThrow('Copy the product-supplied media')
})
it('refuses symlink output that could escape the run',async()=>{
 const dir=await fixture('symlink')
 await writeFile(join(root,'outside.txt'),'outside fixture')
 await symlink(join(root,'outside.txt'),join(dir,'production','outside.txt'))
 await expect(collectProduction(dir,supplied)).rejects.toThrow('inside this run')
})

it('keeps camera assembly out of animation-only generation instructions',()=>{
 expect(mediaBindingInstructions(true)).toContain('do not implement them')
 expect(mediaBindingInstructions(true)).not.toContain('show it only inside')
 expect(mediaBindingInstructions(false)).toContain('show it only inside')
})
