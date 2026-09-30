import {it,expect,afterAll} from 'vitest'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import type {Project} from '../shared/model'
const root=await mkdtemp(join(tmpdir(),'minimal-pdf-live-'));process.env.MINIMAL_STUDIO_DATA_DIR=root
const {exportPresentation}=await import('../engine/presentation-export')
const {listNotebookRows}=await import('../engine/persistence')
afterAll(()=>rm(root,{recursive:true,force:true}))
it('prints ordered slide pages, marks blank drafts, retains the PDF and invalidates it after edits',async()=>{
 const svg=await readFile(new URL('./fixtures/visual-cast/10_the_token_bucket.svg',import.meta.url),'utf8')
 const project:Project={id:'pdf-fixture',video:null,title:'Presentation export fixture',source:'Synthetic export check',slides:[{id:'one',title:'Token bucket',svg},{id:'two',title:'Draft second slide',svg:''}]}
 const pdf=await exportPresentation(project),file=join(root,'slides.pdf');await writeFile(file,pdf)
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-')
 const info=execFileSync('pdfinfo',[file],{encoding:'utf8'})
 expect(info).toMatch(/Pages:\s+2/);expect(info).toMatch(/Page size:\s+960 x 540 pts/)
 const words=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'})
 expect(words).toContain('Draft · not designed');expect(words).toContain('Draft second slide')
 expect(await listNotebookRows('presentation-exports',project.id)).toHaveLength(1)
 expect(await exportPresentation(project)).toEqual(pdf)
 expect(await listNotebookRows('assets',project.id)).toHaveLength(1)
 project.slides.reverse();const changed=await exportPresentation(project)
 expect(changed).not.toEqual(pdf);expect(await listNotebookRows('presentation-exports',project.id)).toHaveLength(2)
 // Retain only the rendered fixture proof, outside the disposable notebook store.
 await writeFile('/tmp/studio-presentation-export-fixture.pdf',pdf)
 execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1000','-png',file,'/tmp/studio-presentation-export-fixture'])
},60000)
