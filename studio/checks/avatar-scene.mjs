// Explicit still-avatar test against the isolated live notebook, never a real camera.
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {runCommand,probeSeconds} from '../engine/voice.ts'
const [root,origin,projectId,sceneId]=process.argv.slice(2)
const marker=JSON.parse(await readFile(join(root,'diagnostic-report.json'),'utf8'))
if(marker.storage!=='isolated-local-diagnostic-not-S3-proof' || marker.projectId!==projectId)throw Error('Choose an isolated notebook')
const request=async(path,options)=>{const r=await fetch(`${origin}/api/projects/${projectId}${path}`,options);const x=await r.json();if(!r.ok)throw Error(x.error || 'Request failed');return x}
let snapshot=await request(''),scene=snapshot.project.video.scenes.find(s=>s.id===sceneId)
if(scene.phase!=='waiting' || !['high','low'].includes(scene.presence))throw Error('Wait for a speaker-enabled plan')
const dir=await mkdtemp(join(tmpdir(),'studio-avatar-evidence-'))
await writeFile(join(dir,'input.json'),JSON.stringify({sceneId,presence:scene.presence,voice:snapshot.project.video.settings.voice,moments:scene.moments,physicalCapture:false},null,2))
for(const moment of scene.moments.filter(m=>m.camera!=='none')){
 const stem=join(dir,moment.id),text=stem+'.txt',audio=stem+'.aiff',video=stem+'.mp4'
 await writeFile(text,moment.lines)
 await runCommand('/usr/bin/say',['-v','Samantha','-f',text,'-o',audio])
 await runCommand('ffmpeg',['-y','-loop','1','-i',join(process.cwd(),'app/assets/presenter.jpg'),'-i',audio,'-vf',"scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2",'-metadata','title=TEST AVATAR - SYNTHETIC VOICE','-shortest','-r','30','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac',video])
 const parts=[{momentId:moment.id,recordingKey:moment.recordingKey,from:0,to:await probeSeconds(video)}]
 await request(`/scenes/${sceneId}/recordings`,{method:'PUT',headers:{'Content-Type':'video/mp4','X-Studio-Parts':JSON.stringify(parts)},body:await readFile(video)})
}
snapshot=await request('');await writeFile(join(dir,'with-avatar.json'),JSON.stringify(snapshot,null,2))
console.log(`Avatar evidence: ${dir}`)
// Exactly one requested generation, no automatic retry.
await request(`/scenes/${sceneId}/produce`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
console.log('Production started on the same live backend')
