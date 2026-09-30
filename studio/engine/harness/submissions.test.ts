import {it,expect,afterAll} from 'vitest'
import {mkdtemp,writeFile,rm,symlink,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {registerSubmissions,handleEngineRpc,readSubmission,submissionSchema} from './submissions'
const root=await mkdtemp(join(tmpdir(),'minimal-submissions-'))
afterAll(()=>rm(root,{recursive:true,force:true}))
it('offers only run-specific tools and removes access when the run ends',async()=>{
 const session=registerSubmissions(root,[{name:'plan_submit_brief',description:'fixture',inputSchema:submissionSchema,call:async()=>({accepted:true})}])
 const list=await handleEngineRpc(session.token,{id:1,method:'tools/list'})
 expect(JSON.stringify(list.body)).toContain('plan_submit_brief');expect(JSON.stringify(list.body)).not.toContain('produce_submit_scene')
 const blocked=await handleEngineRpc(session.token,{id:2,method:'tools/call',params:{name:'produce_submit_scene',arguments:{}}})
 expect(JSON.stringify(blocked.body)).toContain('isError')
 const wrong=await handleEngineRpc(session.token,{id:3,method:'tools/call',params:{name:'plan_submit_brief',arguments:{projectDir:'/different/run'}}})
 expect(JSON.stringify(wrong.body)).toContain('different run')
 session.dispose();expect((await handleEngineRpc(session.token,{id:4,method:'tools/list'})).httpStatus).toBe(403)
})
it('refuses escaping paths, symlink submissions, and oversized files',async()=>{
 const directory=join(root,'run');await mkdir(directory)
 await writeFile(join(root,'outside.json'),'{}');await symlink(join(root,'outside.json'),join(directory,'linked.json'))
 await expect(readSubmission(directory,'../outside.json')).rejects.toThrow('inside this run')
 await expect(readSubmission(directory,'linked.json')).rejects.toThrow('inside this run')
 await writeFile(join(directory,'inside.json'),'{}')
 expect((await readSubmission(directory,'inside.json')).toString()).toBe('{}')
 await expect(readSubmission(directory,'inside.json',1)).rejects.toThrow('Invalid submission')
})
it('serializes submissions so two tool calls cannot race the stage checkpoint',async()=>{
 const order:string[]=[]
 const session=registerSubmissions(root,[{name:'submit',description:'fixture',inputSchema:submissionSchema,call:async args=>{order.push(`start-${args.index}`);await new Promise(resolve=>setTimeout(resolve,10));order.push(`end-${args.index}`);return{accepted:true}}}])
 await Promise.all([1,2].map(index=>handleEngineRpc(session.token,{id:index,method:'tools/call',params:{name:'submit',arguments:{index}}})))
 expect(order).toEqual(['start-1','end-1','start-2','end-2']);session.dispose()
})
