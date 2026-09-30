// Synthetic layout fixture, never evidence of model output.
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
const root = await mkdtemp(join(tmpdir(),'minimal-ui-preview-'))
process.env.MINIMAL_STUDIO_PERSISTENCE='local';delete process.env.MINIMAL_STUDIO_DATABASE_URL;
process.env.VITEST='ui-fixture';delete process.env.MINIMAL_STUDIO_ALLOW_LIVE_HARNESS;
process.env.OPENAI_API_KEY='';process.env.FISH_AUDIO_API_KEY='';
const apiPort=Number(process.env.MINIMAL_STUDIO_PORT || 4322),webPort=Number(process.env.MINIMAL_STUDIO_WEB_PORT || 4182)
process.env.MINIMAL_STUDIO_DATA_DIR = root; process.env.MINIMAL_STUDIO_PORT = String(apiPort)
const { writeRow } = await import('../engine/persistence')
const { normalizeMoments } = await import('../engine/moment-plan')
const { reconcileVideo, refreshVideoKeys } = await import('../engine/scene-model')
const project: import('../shared/model').Project = { id: 'ui-fixture', title: 'UI fixture · A bucket for every burst', source: 'A request spends one token. Tokens refill at a steady rate.', slides: ['A bucket for every burst','Spend one token','The next request'].map((title,index) => ({ id: `slide-${index}`, title, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#f4f1e9"/><text x="80" y="110" fill="#506550" font-size="18" font-family="sans-serif">RATE LIMITING</text><text x="80" y="235" fill="#202d24" font-size="58" font-family="sans-serif">${title}</text><rect x="80" y="335" width="400" height="220" rx="20" fill="#dce6d9"/><text x="130" y="460" fill="#316b50" font-size="46" font-family="sans-serif">3 tokens</text><text x="610" y="425" fill="#202d24" font-size="29" font-family="sans-serif">Every request needs one.</text></svg>` })), video: { settings: { presence: 'high', voice: { kind: 'ai', id: 'default' } }, scenes: [], transitions: [], inputKey: '', produced: null } }
reconcileVideo(project)
for (const [index,scene] of project.video!.scenes.entries()) {
  scene.moments = normalizeMoments({ moments: [
    { title: 'The question', lines: 'How do you keep a sudden burst from overwhelming your service?', seconds: 5, camera: 'full', layout: index === 0 ? 'full-screen' : 'corner', overlay: index === 0 ? 'title-card' : null, cue: 'Welcome the viewer' },
    { title: 'Watch the token', lines: 'A request can pass while a token is available. It consumes that token when admitted.', seconds: 8, camera: 'none', layout: 'corner', overlay: null, cue: 'Let the slide lead' },
    { title: 'The takeaway', lines: 'When the bucket is empty, new requests wait for the next refill.', seconds: 5, camera: 'full', layout: index === 2 ? 'full-screen' : 'beside-slide', overlay: index === 2 ? 'end-card' : null, cue: 'Close with the consequence' },
  ] },scene.id,'high',index === 0 ? 'title' : index === 2 ? 'ending' : 'body'); scene.phase = 'waiting'
}
refreshVideoKeys(project)
if (process.argv.includes('--produced')) {
  const {runCommand} = await import('../engine/voice')
  const {storeAsset} = await import('../engine/persistence')
  const {joinScenes} = await import('../render/join')
  for (const [index,scene] of project.video!.scenes.entries()) {
    const path = join(root,`scene-${index}.mp4`)
    await runCommand('ffmpeg',['-y','-f','lavfi','-i',`color=c=${['green','blue','purple'][index]}:s=640x360:r=30`,'-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','18','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',path])
    const asset=await storeAsset({body:await readFile(path),contentType:'video/mp4',extension:'.mp4',kind:'synthetic-ui-fixture'})
    for (const moment of scene.moments) if (moment.camera !== 'none') moment.take={id:`take-${moment.id}`,recordingKey:moment.recordingKey,objectKey:asset.objectKey,duration:moment.end-moment.start}
    refreshVideoKeys(project);scene.produced={inputKey:scene.inputKey,objectKey:asset.objectKey};scene.phase='produced'
  }
  const video=project.video!;video.transitions=['crossfade','push-left'];refreshVideoKeys(project)
  let clock: import('../shared/model').SceneInterval[]=[]
  const bytes=await joinScenes(video.scenes.map(scene => scene.produced!.objectKey),video.transitions,intervals => {clock=intervals.map((interval,index) => ({...interval,sceneId:video.scenes[index].id}))})
  const asset=await storeAsset({body:bytes,contentType:'video/mp4',extension:'.mp4',kind:'synthetic-ui-fixture'})
  video.produced={inputKey:video.inputKey,objectKey:asset.objectKey,clock}
}
if(process.argv.includes('--partial-video') && project.video) {
 project.video.produced=null
 project.video.scenes[1].phase='writing';project.video.scenes[1].produced=null
 project.video.scenes[2].phase='queued';project.video.scenes[2].produced=null
}
project.harness={adapter:'kimi',model:'kimi-code/k3'}
if(process.argv.includes('--incremental')) {
  project.video=null;project.slides=project.slides.slice(0,1).map(slide=>({...slide,draft:true}))
}
await writeRow('projects',project.id,{ project,status:process.argv.includes('--incremental')?'building':'ready',plannedSlides:3,error:null,events:[] })
const {createStudioServer}=await import('../engine/server')
const server=createStudioServer();server.listen(apiPort,'127.0.0.1')
const children = [spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(webPort),'--strictPort'],{stdio:'inherit',env:process.env})]
let stopping = false
const stop = async () => { if (stopping) return; stopping = true; server.close();children.forEach(child => child.kill('SIGTERM')); await rm(root,{recursive:true,force:true}) }
process.on('SIGINT',() => void stop()); process.on('SIGTERM',() => void stop()); children.forEach(child => child.on('exit',() => void stop()))
console.log(`Synthetic layout fixture: http://127.0.0.1:${webPort}/?notebook=ui-fixture`)
