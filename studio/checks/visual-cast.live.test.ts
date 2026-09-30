// Reuses the original rich presentation fixture to exercise the copied extractor.
// This checks actual browser/pixel work, not new model quality.
import {it,expect,afterAll} from 'vitest'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const root=await mkdtemp(join(tmpdir(),'minimal-cast-live-'));process.env.MINIMAL_STUDIO_DATA_DIR=root
const {ensureVisualCast}=await import('../engine/creative/visual-cast')
const {readAsset,readRow,listNotebookRows}=await import('../engine/persistence')
afterAll(()=>rm(root,{recursive:true,force:true}))
it('extracts the original page objects, verifies their pixels and rigs, and retains notebook-owned assets',async()=>{
 const svg=await readFile(new URL('./fixtures/visual-cast/10_the_token_bucket.svg',import.meta.url),'utf8')
 const input={notebook:'cast-fixture',revision:'rich-page-v1',pages:[{scene:'slide-1',title:'The token bucket',svg,sourcePassages:['A request spends a token.']}],theme:{brand:{background:'#0e0c17',text:'#ffffff',accent:'#635bff'}}}
 const cast=await ensureVisualCast(input)
 expect(cast.status).toBe('ready');expect(cast.entries.length).toBeGreaterThan(1)
 const bucket=cast.entries.find(entry=>entry.identity.object==='token-bucket')
 expect(bucket?.verification.status).toBe('verified');expect(bucket?.rig.status).toBe('verified');expect(bucket?.rig.inside?.contained).toBe(true)
 expect(bucket?.libraryKey).toBeTruthy();expect((await readAsset(bucket!.artwork.svg.objectKey)).length).toBeGreaterThan(100)
 const ids=await listNotebookRows('assets','cast-fixture');expect(ids.length).toBeGreaterThan(3)
 for(const id of ids){const asset=await readRow<any>('assets',id);expect(asset.projectId).toBe('cast-fixture')}
 expect(await ensureVisualCast(input)).toEqual(cast)
},60000)
