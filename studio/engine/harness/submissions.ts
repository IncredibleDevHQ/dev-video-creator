import { randomBytes } from 'node:crypto'
import { realpath,readFile,lstat } from 'node:fs/promises'
import { resolve,sep } from 'node:path'
export type EngineTool={completesRun?:boolean;name:string;description:string;inputSchema:Record<string,unknown>;call:(args:Record<string,unknown>)=>Promise<unknown>}
type SubmissionSession={directory:string;tools:EngineTool[];queue:Promise<unknown>;calls:number}
const sessions=new Map<string,SubmissionSession>()
export const registerSubmissions=(directory:string,tools:EngineTool[])=>{
  const token=randomBytes(32).toString('hex')
  sessions.set(token,{directory,tools,queue:Promise.resolve(),calls:0})
  return{token,dispose:()=>sessions.delete(token)}
}
export const readSubmission=async(directory:string,name:string,maxBytes=40*1024*1024)=>{
  const path=resolve(directory,name),root=await realpath(directory)
  if(!path.startsWith(`${resolve(directory)}${sep}`)) throw new Error('Submission must stay inside this run')
  const actual=await realpath(path)
  if(!actual.startsWith(`${root}${sep}`)) throw new Error('Submission must stay inside this run')
  const stat=await lstat(path)
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size>maxBytes) throw new Error('Invalid submission file')
  return readFile(actual)
}
export const submissionSchema={type:'object',properties:{projectDir:{type:'string'}},additionalProperties:false}
export const handleEngineRpc=async(token:string,message:unknown)=>{
  const session=sessions.get(token)
  if(!session) return {httpStatus:403,body:{error:'This engine run is no longer active'}}
  const rpc=message as {id?:unknown;method?:string;params?:{name?:string;arguments?:Record<string,unknown>;protocolVersion?:string}}
  const reply=(result:unknown)=>({httpStatus:200,body:rpc.id===undefined?{}:{jsonrpc:'2.0',id:rpc.id,result}})
  if(rpc.method==='initialize') return reply({protocolVersion:rpc.params?.protocolVersion || '2024-11-05',capabilities:{tools:{}},serverInfo:{name:'incredible-studio',version:'0.1.0'}})
  if(rpc.method==='notifications/initialized' || rpc.method==='ping') return reply({})
  if(rpc.method==='tools/list') return reply({tools:session.tools.map(({name,description,inputSchema})=>({name,description,inputSchema}))})
  if(rpc.method!=='tools/call') return {httpStatus:200,body:{jsonrpc:'2.0',id:rpc.id ?? null,error:{code:-32601,message:'Method not available'}}}
  const work=session.queue.catch(()=>{}).then(async()=>{
    try {
      const tool=session.tools.find(tool=>tool.name===rpc.params?.name)
      if(!tool) throw new Error('This tool is not available in this engine run')
      if(++session.calls>80) throw new Error('This run reached its tool-call budget')
      const args=rpc.params?.arguments || {}
      if(args.projectDir!==undefined && args.projectDir!==session.directory) throw new Error('Submission belongs to a different run')
      const result=await tool.call(args)
      return reply({content:[{type:'text',text:JSON.stringify(result)}]})
    } catch(error) {
      return reply({isError:true,content:[{type:'text',text:error instanceof Error?error.message:'Submission failed'}]})
    }
  })
  session.queue=work
  return work
}
