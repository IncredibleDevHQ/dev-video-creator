import {sceneCover} from './video-cover'
import {withProgress} from './progress'
import {exportPresentation} from './presentation-export'
import {creativeContext} from './creative/stage'
import {loadHarnessPreference} from './harness/preference'
import {preparePractice} from './practice'
import {chatNotebook} from './notebook-chat'
import { createServer, type ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'
import { configureModelGateway } from './model-gateway'
import { uploadLogo } from './brand-logo'
import { getStudioSettings,saveStudioSettings,validateVoiceChoice } from './settings'
import { createClone,deleteClone,retryClone,previewVoice,listClones } from './voice-library'
import { createProject,replaceBlockedSource, listNotebooks, editSlide, loadProject, subscribe, chatSlide, scheduleSlides, retrySlides, stopSlides } from './projects'
import { makeVideo, retryScene, previewPresence, replanPresence, schedulePlanning, chatVideo, updateVideoSettings } from './video'
import {notebookArtifacts} from './artifacts'
import {handleEngineRpc} from './harness/submissions'
import {recoverEngineRuns,inspectHarnesses,stopEngineRuns} from './harness/runtime'
import { recoverProjects } from './recovery'
import { produceScene } from './production'
import { produceVideo, updateTransition } from './video-export'
import { sceneView, videoView } from './state'
import { saveRecording } from './takes'
import { readAsset, validObjectKey, assetIdOf, readRow,initializePersistence } from './persistence'
import type { SlideEdit } from '../shared/api'
const send = (response: ServerResponse, status: number, value: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)) }
export const createStudioServer = (options:{readOnly?:boolean}={}) => createServer(async (request, response) => {
  try {
    if(options.readOnly && request.method!=='GET') return send(response,403,{error:'This is a saved review. Generation and editing are disabled.'})
    const url = new URL(request.url || '/', 'http://localhost')
    if(url.pathname==='/api/settings/logo' && request.method==='PUT') {
      const chunks:Uint8Array[]=[];let size=0
      for await(const chunk of request) {size+=chunk.length;if(size>5000000) throw new Error('Logo too large');chunks.push(new Uint8Array(chunk))}
      return send(response,201,await uploadLogo(Buffer.concat(chunks),String(request.headers['content-type'] || '')))
    }
    const voiceRoute=url.pathname.match(/^\/api\/settings\/voice(?:\/([a-zA-Z0-9_-]+))?(?:\/(retry))?$/)
    if(voiceRoute && request.method==='PUT') {
      const chunks:Uint8Array[]=[];let size=0
      for await(const chunk of request) {size+=chunk.length;if(size>25000000) throw new Error('Voice recording too large');chunks.push(new Uint8Array(chunk))}
      return send(response,201,await createClone(Buffer.concat(chunks),String(request.headers['content-type'] || ''),request.headers['x-studio-consent']==='own-voice'))
    }
    if(voiceRoute && request.method==='DELETE' && voiceRoute[1]) {await deleteClone(voiceRoute[1]);return send(response,200,await getStudioSettings())}
    const practiceRoute=url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/scenes\/([a-zA-Z0-9_-]+)\/practice$/)
    if(practiceRoute && request.method==='POST') return send(response,200,await preparePractice(practiceRoute[1],practiceRoute[2],url.searchParams.get('moment') || undefined))
    const recordingRoute = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/scenes\/([a-zA-Z0-9_-]+)\/recordings$/)
    if (recordingRoute && request.method === 'PUT') {
      const parts = JSON.parse(String(request.headers['x-studio-parts'] || '[]'))
      const chunks: Uint8Array[] = []; let size = 0
      for await (const chunk of request) { size += chunk.length; if (size > 150_000_000) throw new Error('Recording too large'); chunks.push(new Uint8Array(chunk)) }
      return send(response, 200, await saveRecording(recordingRoute[1], recordingRoute[2], parts, Buffer.concat(chunks), String(request.headers['content-type'] || '')))
    }
    let body: any = null
    if (request.method === 'POST' || request.method === 'PATCH') {
      const chunks: Uint8Array[] = []; let size = 0
      for await (const chunk of request) { size += chunk.length; if (size > 2_000_000) throw new Error('Request too large'); chunks.push(new Uint8Array(chunk)) }
      body = JSON.parse(Buffer.concat(chunks).toString())
    }
    if(url.pathname==='/mcp' && request.method==='POST') {const reply=await handleEngineRpc(url.searchParams.get('run') || '',body);return send(response,reply.httpStatus,reply.body)}
    if(url.pathname==='/api/harnesses' && request.method==='GET') return send(response,200,{selected:await loadHarnessPreference(),available:await inspectHarnesses(creativeContext('http://127.0.0.1'))})
    if (url.pathname === '/api/settings') {
      return send(response,200,request.method==='POST'?await saveStudioSettings(body):await getStudioSettings(url.searchParams.get('refresh')==='voices'))
    }
    if(voiceRoute && request.method==='POST' && voiceRoute[2]==='retry' && voiceRoute[1]) return send(response,200,await retryClone(voiceRoute[1]))
    if(url.pathname==='/api/settings/voice-preview' && request.method==='POST') return send(response,200,{objectKey:await previewVoice(validateVoiceChoice(body))})
    if (url.pathname === '/api/projects' && request.method === 'GET') return send(response,200,await listNotebooks())
    if (url.pathname === '/api/projects' && request.method === 'POST') return send(response, 201, await createProject(String(body?.source || ''),body?.harness))
    const sceneRoute = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/scenes\/([a-zA-Z0-9_-]+)\/(retry|presence-preview|presence|produce|download|cover)$/)
    if(sceneRoute && sceneRoute[3]==='cover' && request.method==='GET'){
      const bytes=await sceneCover(sceneRoute[1],sceneRoute[2],!options.readOnly)
      response.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'no-cache'});response.end(bytes);return
    }
    if (sceneRoute && sceneRoute[3] === 'download' && request.method === 'GET') {
      const snapshot = await loadProject(sceneRoute[1]); const video = snapshot?.project.video
      const scene = video?.scenes.find(scene => scene.id === sceneRoute[2])
      if (!scene || !video || !sceneView(scene,video.settings.voice).produced || !scene.produced) return send(response,409,{error:'Produce this scene before downloading it'})
      const bytes = await readAsset(scene.produced.objectKey)
      response.writeHead(200,{'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="scene.mp4"','Content-Length':bytes.length}); response.end(bytes); return
    }
    if (sceneRoute && request.method === 'POST') {
      const [, id, sceneId, action] = sceneRoute
      if (action === 'produce') return send(response,200,await produceScene(id,sceneId))
      if (action === 'retry') {
        const snapshot = await loadProject(id)
        return send(response,200,snapshot?.project.video?.scenes.find(scene => scene.id === sceneId)?.failure === 'production' ? await produceScene(id,sceneId) : await retryScene(id,sceneId))
      }
      if (action === 'presence-preview') return send(response, 200, await previewPresence(id, sceneId, body?.presence))
      return send(response, 200, await replanPresence(id, sceneId, body?.presence))
    }
    const match = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)(?:\/(events|slides|export|chat|video|produce|download|transitions|retry|stop|artifacts|source))?$/)
    if (match) {
      const [, id, action] = match
      const snapshot = await loadProject(id)
      if (!snapshot) return send(response, 404, { error: 'Project not found' })
      if (action === 'events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering':'no' })
        response.flushHeaders()
        response.write('retry: 2000\n\n')
        let closed=false,refreshing=false,pending=false
        const refresh=async()=>{
          if(closed)return
          if(refreshing){pending=true;return}
          refreshing=true
          try{
            do{
              pending=false
              const value=await withProgress(await loadProject(id))
              if(!closed)response.write(`data: ${JSON.stringify(options.readOnly && value && typeof value==='object'?{...value,readOnly:true}:value)}\n\n`)
            }while(pending && !closed)
          }catch{if(!closed)response.write(': heartbeat\n\n')}
          finally{refreshing=false}
        }
        const unsubscribe=subscribe(id,()=>void refresh())
        const heartbeat=setInterval(()=>void refresh(),3000)
        response.on('close',()=>{closed=true;clearInterval(heartbeat);unsubscribe()})
        await refresh()
        return
      }
      if (action === 'artifacts' && request.method==='GET') return send(response,200,await notebookArtifacts(id))
      if (action === 'stop' && request.method === 'POST') return send(response,200,await stopSlides(id))
      if (action === 'retry' && request.method === 'POST') return send(response,200,await retrySlides(id))
      if (action === 'produce' && request.method === 'POST') return send(response,200,await produceVideo(id))
      if (action === 'transitions' && request.method === 'PATCH') return send(response,200,await updateTransition(id,body?.index,body?.transition))
      if (action === 'download' && request.method === 'GET') {
        const video = snapshot.project.video
        if (videoView(snapshot.project).action !== 'export' || !video?.produced) return send(response,409,{error:'Produce this video before downloading it'})
        const bytes = await readAsset(video.produced.objectKey)
        response.writeHead(200,{'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="video.mp4"','Content-Length':bytes.length}); response.end(bytes); return
      }
      if (action === 'video' && request.method === 'PATCH') return send(response, 200, await updateVideoSettings(id, body))
      if(action==='source' && request.method==='PATCH') return send(response,200,await replaceBlockedSource(id,body?.text))
      if (action === 'video' && request.method === 'POST') return send(response, 200, await makeVideo(id, body))
      if (action === 'chat' && request.method === 'POST') {
        const changed = body?.anchor?.stage === 'video' ? await chatVideo(id, body) : body?.anchor?.stage==='notebook'?await chatNotebook(id,body):await chatSlide(id, body); schedulePlanning(id); return send(response, 200, changed)
      }
      if (action === 'slides' && request.method === 'PATCH') {
        const changed = await editSlide(id, body as SlideEdit); schedulePlanning(id); return send(response, 200, changed)
      }
      if (action === 'export' && request.method==='GET') {
        if(snapshot.status!=='ready') return send(response,409,{error:'Wait for the presentation to finish before exporting'})
        const pdf=await exportPresentation(snapshot.project)
        response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="slides.pdf"', 'Content-Length':pdf.length }); response.end(pdf); return
      }
      return send(response, 200, await withProgress(options.readOnly?{...snapshot,readOnly:true}:snapshot))
    }
    if (url.pathname.startsWith('/objects/')) {
      const name = decodeURIComponent(url.pathname.slice(9))
      if (!validObjectKey(name)) return send(response, 404, { error: 'Not found' })
      const bytes = await readAsset(name)
      const metadata = await readRow<{ contentType: string }>('assets', assetIdOf(name))
      const headers = { 'Content-Type': metadata?.contentType || 'application/octet-stream', 'Accept-Ranges': 'bytes' }
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
      if (range) {
        const from = Number(range[1]); const to = Math.min(range[2] ? Number(range[2]) : bytes.length-1, bytes.length-1)
        if (from > to || from >= bytes.length) { response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }); response.end(); return }
        response.writeHead(206, { ...headers, 'Content-Range': `bytes ${from}-${to}/${bytes.length}`, 'Content-Length': to-from+1 }); response.end(bytes.subarray(from,to+1)); return
      }
      response.writeHead(200, { ...headers, 'Content-Length': bytes.length }); response.end(bytes); return
    }
    send(response, 404, { error: 'Not found' })
  } catch { send(response, 400, { error: 'Unable to complete this request. Check the input and your AI settings.' }) }
})
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  configureModelGateway({ envKey: process.env.OPENAI_API_KEY || '' })
  await initializePersistence()
  await recoverEngineRuns()
  await listClones()
  await recoverProjects({slides:scheduleSlides,planning:schedulePlanning,scene:produceScene,video:produceVideo})
  const server=createStudioServer().listen(Number(process.env.MINIMAL_STUDIO_PORT || 4320), '127.0.0.1', () => console.log(`Minimal Studio engine: http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`))
  let stopping=false
  const stop=async()=>{
    if(stopping)return;stopping=true
    server.close();server.closeAllConnections()
    const finished=await stopEngineRuns()
    const {closePersistence}=await import('./persistence')
    await closePersistence().catch(()=>{})
    process.exit(finished?0:1)
  }
  process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop())
}
