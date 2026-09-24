// Actual compiler and UI functions, with deterministic recorder/network boundaries.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build, transform } from 'esbuild'
import ts from 'typescript'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const dir = await mkdtemp(join(tmpdir(), 'studio-reliability-'))
let checks = 0
const check = (label, value) => { assert.ok(value, label); console.log(`PASS ${label}`); checks++ }
try {
  await build({stdin:{contents:`export * from './packages/markdown-composition/src/index.ts'; export * from './apps/studio-v2/src/scene-program.ts';`,resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:join(dir,'compile.mjs')})
  const {compileSceneProgram,compileProject,createDefaultBlockConfig,defaultBrand} = await import(pathToFileURL(join(dir,'compile.mjs')))
  const units = ['request','service'].map((id,i)=>({id,ids:[id],kind:'box',label:id,bbox:{x:60+i*490,y:60,width:240,height:140},chrome:false,children:[],actorRole:'actor'}))
  for (const duration of [200, 2000]) {
    const program={version:1,clock:'take',cast:[{id:'request'}],beats:[{say:'The client retries',durationMs:duration,words:[{word:'retries',startMs:duration-20,endMs:duration}],events:[{actor:'request',action:'travel',to:'service',cue:'retries'},{actor:'service',action:'highlight',holdMs:4000}]},{say:'Next sentence',durationMs:2000,events:[]}]}
    const steps=compileSceneProgram(program,units,{viewBox:{width:1280,height:720}}).plan.steps
    check(`late cues preserve ${duration}ms next-beat boundary`, steps[0].motionWindowMs+steps[0].holdMs===duration)
    check('every action fits the measured beat',steps[0].actions.every(a=>a.startMs+a.durationMs<=duration))
  }
  const source=await readFile(join(root,'apps/studio-v2/src/main.ts'),'utf8')
  const ast=ts.createSourceFile('main.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  const defs=new Map()
  for(const s of ast.statements) if(ts.isVariableStatement(s)) for(const d of s.declarationList.declarations) if(ts.isIdentifier(d.name)) defs.set(d.name.text,`const ${d.getText(ast)};`)
  const install=async(ctx,names)=>{vm.createContext(ctx);vm.runInContext((await transform(names.map(n=>defs.get(n)).join('\n'),{loader:'ts'})).code,ctx)}
  const a={role:'presenter',blockId:'scene',recordingId:'A',durationMs:4000,videoUrl:'http://fixture/take-A.webm',recordedAt:'2026-09-20T00:00:00Z',storage:'minio'}
  const b={...a,recordingId:'B',videoUrl:'http://fixture/take-B.webm'}
  const node={type:'scene',attrs:{id:'scene',svg:'<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',motion:{version:2,steps:[{id:'b1',motionWindowMs:400,holdMs:3600,actions:[]}]}}}
  const project={version:1,id:'probe',title:'Retake',brand:defaultBrand,notebook:{type:'doc',content:[node]},blocks:{scene:createDefaultBlockConfig('scene',node)},presenterTracks:{scene:[{kind:'narration',audioUrl:'http://fixture/aligned-B.mp3',audioKind:'recorded-mic',recordingId:'B'},{kind:'human-camera',videoUrl:b.videoUrl,audioUrl:b.videoUrl,audioKind:'recorded-mic'}]},recordedBlocks:{scene:b},recordedBlockTakes:{scene:[a,b]},width:1920,height:1080,fps:30}
  const ctx={project,projectSaveQueues:new Map(),acknowledgedProjects:new Map(),take:a,fetchJson:async()=>({}),renderCanvasBlockTimeline(){},syncProject(){},syncCanvasViewSwitch(){},refreshPickupNotes:async()=>{},showToast(){},console}
  await install(ctx,['acknowledgeTakeMutation','selectRecordedTake']);vm.runInContext('selectRecordedTake("scene",take)',ctx)
  const html=compileProject(project).html
  check('select A removes B picture and aligned voice',!html.includes(b.videoUrl)&&!html.includes('aligned-B.mp3')&&html.includes(a.videoUrl))
  project.presenterTracks.scene=[{kind:'narration',audioUrl:'http://fixture/aligned-B.mp3',audioKind:'recorded-mic',recordingId:'B'},{kind:'human-camera',videoUrl:b.videoUrl,audioUrl:b.videoUrl,audioKind:'recorded-mic'}]
  const staleHtml=compileProject(project).html
  check('compiler refuses stale media even in a hydrated document',!staleHtml.includes(b.videoUrl)&&!staleHtml.includes('aligned-B.mp3')&&staleHtml.includes(a.videoUrl))
  const cache=new Map(), pending=[]
  const drafts={structuredClone,sanitizeNotebookMedia(){},DRAFT_STORAGE_PREFIX:'draft-',window:{localStorage:{setItem:(k,v)=>cache.set(k,v),getItem:k=>cache.get(k),removeItem:k=>cache.delete(k)}},fetchJson:async(_url,o)=>new Promise((resolve,reject)=>pending.push({snapshot:JSON.parse(o.body),resolve,reject}))}
  await install(drafts,['acknowledgedProjects','rememberDraft','projectSaveQueues','persistProjectNow','persistProjectSnapshot'])
  drafts.old={version:1,id:'p',title:'OLD',notebook:{type:'doc',content:[]}};drafts.newer={...drafts.old,title:'NEW'}
  const oldSave=vm.runInContext('persistProjectNow(old)',drafts), newSave=vm.runInContext('persistProjectNow(newer).catch(()=>{})',drafts)
  await new Promise(r=>setImmediate(r))
  check('writes are serialized',pending.length===1)
  check('pending newest edit is recoverable immediately',JSON.parse(cache.get('draft-p')).title==='NEW')
  pending[0].resolve({saved:true});await oldSave;await new Promise(r=>setImmediate(r))
  check('old acknowledgement preserves newer draft',JSON.parse(cache.get('draft-p')).title==='NEW')
  pending[1].reject(new Error('offline'));await newSave
  check('failed newer save remains recoverable',JSON.parse(cache.get('draft-p')).title==='NEW')
  let stops=0, releases=0, closed=0
  const handlers = {}
  const capture={guideAudio:{pause(){}},cameraPreview:{pause(){}},teardownRehearsal(){},mediaRecorder:{state:'recording',stop(){stops++;this.state='inactive'}},stopCameraStream(){releases++},cameraDialog:{close(){closed++},addEventListener(type,fn){handlers[type]=fn}},pendingTakeBlob:{bytes:'unkept'}}
  await install(capture,['requestCameraClose']);vm.runInContext('requestCameraClose()',capture)
  check('close recording stops and releases devices into review',stops===1&&releases===1&&closed===0)
  vm.runInContext('requestCameraClose()',capture)
  check('leaving review preserves the pending take',closed===1&&capture.pendingTakeBlob)
  const listeners=ast.statements.filter(s=>ts.isExpressionStatement(s)&&s.getText(ast).startsWith('cameraDialog.addEventListener')).map(s=>s.getText(ast)).join('\n')
  vm.runInContext((await transform(listeners,{loader:'ts'})).code,capture)
  capture.mediaRecorder.state='recording'
  let cancelled=false
  handlers.cancel({preventDefault(){cancelled=true}})
  check('native Escape uses the capture lifecycle',cancelled&&stops===2&&closed===1)

  console.log(`RELIABILITY REGRESSIONS CHECK PASS (${checks})`)
} finally { await rm(dir,{recursive:true,force:true}) }
