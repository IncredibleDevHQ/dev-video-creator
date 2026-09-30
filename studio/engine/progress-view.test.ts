import {expect,it} from 'vitest'
import {presentationProgress,progressElapsed} from '../app/progress'
import type {Snapshot} from '../shared/api'
const snapshot=(status:Snapshot['status']):Snapshot=>({project:{id:'fixture',title:'Fixture',source:'',slides:[],video:null},status,error:null,events:[]})
it('never shows activity or return-later promises for a failed or empty ready notebook',()=>{
 for(const status of ['failed','ready'] as const){const html=presentationProgress(snapshot(status));expect(html).not.toContain('spinner');expect(html).not.toContain('data-progress-since')}
})
it('shows the real stage and escapes source-controlled error text',()=>{
 const input=snapshot('building');input.events=[{projectId:'fixture',kind:'slide',sequence:1,time:new Date().toISOString(),message:'Planning the story'}]
 expect(presentationProgress(input)).toContain('Planning the story')
 input.status='failed';input.error='<script>bad</script>';expect(presentationProgress(input)).toContain('&lt;script&gt;')
})
it('reports elapsed time without inventing remaining time',()=>{
 expect(progressElapsed('2026-10-01T00:00:00Z',Date.parse('2026-10-01T00:03:00Z'))).toBe('This step started 3 minutes ago.')
 expect(progressElapsed('bad')).toBe('')
})
