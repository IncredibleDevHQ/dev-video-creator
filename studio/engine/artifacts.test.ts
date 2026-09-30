import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterAll,it,expect} from 'vitest'
const root=await mkdtemp(join(tmpdir(),'minimal-artifact-check-'))
process.env.MINIMAL_STUDIO_DATA_DIR=root
const {saveStageCheckpoint,loadStageCheckpoint,archiveFiles,restoreFiles}=await import('./artifacts')
const {readAsset,dataRoot}=await import('./persistence')
afterAll(()=>rm(root,{recursive:true,force:true}))
it('restores every named bundle file from linked object artifacts',async()=>{
 const files={'index.html':'<p>Synthetic fixture</p>','assets/example.svg':'<svg/>','audio/voice.mp3':{base64:Buffer.from('fixture').toString('base64'),contentType:'audio/mpeg'}}
 const refs=await archiveFiles('notebook','scene','composition',files)
 await saveStageCheckpoint('notebook','scene','composition','current-input',null,refs)
 const checkpoint=await loadStageCheckpoint<null>('notebook','scene','composition','current-input')
 expect(await restoreFiles(checkpoint!.artifacts)).toEqual(files)
 expect(await loadStageCheckpoint('notebook','scene','composition','old-input')).toBeNull()
 expect(await loadStageCheckpoint('other-notebook','scene','composition','current-input')).toBeNull()
})
it('refuses corrupt or missing bundle bytes instead of resuming them',async()=>{
 const refs=await archiveFiles('notebook','scene','composition',{'index.html':'correct fixture'})
 await writeFile(join(dataRoot,'objects',refs[0].objectKey),'corrupt fixture')
 await expect(readAsset(refs[0].objectKey)).rejects.toThrow('checksum')
 await expect(restoreFiles(refs)).rejects.toThrow('checksum')
})
it('rejects a bundle path that escapes its output directory',async()=>{
 await expect(archiveFiles('notebook','scene','composition',{'../escaped.html':'invalid'})).rejects.toThrow('Invalid artifact')
})
