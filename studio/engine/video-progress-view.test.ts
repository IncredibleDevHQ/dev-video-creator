import {presentationScreen} from '../app/presentation-screen'
import {stageStatus} from '../app/stage-status'
import {expect,it} from 'vitest'
import {videoScreen} from '../app/video-screen'
import {Recording} from '../app/recording'
import type {Snapshot} from '../shared/api'
const fixture=():Snapshot=>({status:'ready',error:null,events:[{projectId:'p',sceneId:'scene',kind:'scene',sequence:1,time:'2026-10-01T00:00:00Z',message:'Scene written'}],project:{id:'p',title:'Fixture',source:'',slides:[{id:'slide',title:'Fixture',svg:'<svg/>'}],video:{settings:{presence:'off',voice:{kind:'ai',id:'default'}},transitions:[],inputKey:'',produced:null,scenes:[{id:'scene',slideId:'slide',phase:'queued',presence:null,moments:[],inputKey:'',produced:null,error:null}]}}})
const render=(snapshot:Snapshot)=>videoScreen(snapshot,0,0,0,false,new Recording(()=>{},()=>{}))
it('does not present an old completion event as queued work progress',()=>{
 const html=render(fixture());expect(html).toContain('Waiting for the next available slot');expect(html).not.toContain('Scene written');expect(html).not.toContain('data-progress-since')
})
it('shows active stage feedback and removes elapsed status on failure',()=>{
 const input=fixture(),scene=input.project.video!.scenes[0];scene.phase='writing';input.events[0].message='Creating the scene preview'
 expect(render(input)).toContain('Creating the scene preview');expect(render(input)).toContain('aria-label="Scene activity"')
 scene.phase='failed';scene.error='Could not finish the preview. Try again.'
 expect(render(input)).toContain(scene.error);expect(render(input)).not.toContain('data-progress-since')
})

it('animates only active work, leaving queued and failed scenes still',()=>{
 const input=fixture(),scene=input.project.video!.scenes[0]
 expect(render(input)).not.toContain('thumbnail scene-processing')
 scene.phase='producing';expect(render(input)).toContain('thumbnail scene-processing')
 scene.phase='failed';expect(render(input)).not.toContain('thumbnail scene-processing')
})

it('does not invent timing or a moment anchor before planning finishes',()=>{
 const html=render(fixture())
 expect(html).not.toContain('0s')
 expect(html).not.toContain('anchor-chip')
 expect(html).not.toContain('Practice moment 1')
})

it('does not expose a separate legacy preview player or readiness state',()=>{
 const input=fixture(),scene=input.project.video!.scenes[0]
 scene.phase='waiting';scene.planKey='plan';scene.preview={planKey:'plan',objectKey:'preview.mp4',moments:[]}
 expect(render(input)).not.toContain('Visual preview')
 expect(render(input)).not.toContain('Preview ready')
 expect(render(input)).not.toContain('data-preview')
 expect(videoScreen(input,0,0,0,true,new Recording(()=>{},()=>{}))).not.toContain('preview-caption')
})

it('distinguishes active work, an idle queue, and a saved review',()=>{
 const input=fixture()
 expect(render(input)).toContain('No scene is processing right now')
 input.project.video!.scenes[0].phase='writing'
 expect(render(input)).toContain('activity-orbit')
 input.readOnly=true
 expect(render(input)).toContain('Saved review · generation is not running in this copy')
 expect(render(input)).not.toContain('no action needed')
})

it('does not promise processing when the live connection is lost',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='writing'
 const html=videoScreen(input,0,0,0,false,new Recording(()=>{},()=>{}),null,false,false)
 expect(html).toContain('live processing status is unavailable')
 expect(html).not.toContain('no action needed')
})

it('uses the same specific stage in the scene rail, canvas and activity log',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='writing';input.events[0].message='Planning the scene'
 const html=render(input)
 expect(html.match(/Planning the scene/g)!.length).toBeGreaterThanOrEqual(2)
 expect(html).toContain('Scene 1 · activity')
 expect(html).toContain('aria-label="Scene activity"')
 expect(html).toContain('activity-orbit')
})

it('keeps presentation ready while video processing appears only in its own status',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='writing';input.events[0].message='Creating the scene preview'
 const html=presentationScreen(input,0)
 expect(html).toContain('Presentation ready')
 expect(html).not.toContain('Creating the scene preview')
 expect(stageStatus(input,'presentation')).toContain('Ready')
 expect(stageStatus(input,'presentation')).not.toContain('is-processing')
 expect(stageStatus(input,'video')).toContain('Processing')
 expect(stageStatus(input,'video',false)).toContain('Reconnecting')
 input.readOnly=true
 expect(stageStatus(input,'video')).toContain('Saved')
})

it('places the active status above the preview, with no duplicate beneath the chat',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='writing';input.events[0].message='Creating the scene preview'
 const html=render(input)
 expect(html.indexOf('video-run-status')).toBeLessThan(html.indexOf('stage video-stage'))
 const belowChat=html.split('<div class="reply"')[1].split('<aside class="transcript">')[0]
 expect(belowChat).not.toContain('Creating the scene preview')
 expect(belowChat).not.toContain('step started')
})

it('keeps tab status accessible without adding a second line of visible text',()=>{
 const input=fixture()
 expect(stageStatus(input,'presentation')).toContain('title="Ready"')
 expect(stageStatus(input,'presentation')).toContain('class="sr"')
 expect(stageStatus(input,'presentation')).toContain('aria-hidden="true"')
 input.project.video!.scenes[0].phase='failed'
 expect(stageStatus(input,'video')).toContain('needs-attention')
})

it('retains the failed step marker after later recovery events',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='failed'
 input.events[0].message='Creating the scene preview'
 input.events.push({...input.events[0],sequence:2,message:'Could not write this scene. Try again.',activity:'failed'},{...input.events[0],sequence:3,message:'Saved transcript recovered'})
 const html=render(input)
 expect(html).toContain('Video composition</p><span class="activity-stopped-label">Stalled')
 expect(html).not.toContain('class="current"')
})
it('does not animate saved or disconnected activity',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='writing';input.events[0].message='Creating the scene preview';input.readOnly=true
 expect(render(input)).not.toContain('thumbnail scene-processing')
 expect(render(input)).not.toContain('class="current"')
 expect(render(input)).toContain('Saved activity. No generation is running')
 input.readOnly=false
 const html=videoScreen(input,0,0,0,false,new Recording(()=>{},()=>{}),null,false,false)
 expect(html).not.toContain('thumbnail scene-processing')
 expect(html).not.toContain('class="current"')
})

it('keeps another scene’s processing out of the selected canvas',()=>{
 const input=fixture(), video=input.project.video!
 video.scenes[0].phase='produced'
 video.scenes.push({...video.scenes[0],id:'other',phase:'producing'})
 video.transitions.push('none')
 const html=render(input)
 expect(html).not.toContain('video-run-status')
 expect(html).toContain('thumbnail scene-processing')
 expect(stageStatus(input,'video')).toContain('Processing')
})

it('shows live harness detail inside the current timeline step and retains it at a stall',()=>{
 const input=fixture();input.project.video!.scenes[0].phase='producing';input.events[0].message='Building the scene'
 input.sceneProgress={scene:{stage:'composition',active:true,label:'Reviewing scene inputs',updatedAt:'2026-10-01T00:01:00Z'}}
 expect(render(input)).toContain('activity-detail">Reviewing scene inputs')
 expect(render(input)).toContain('Last update')
 input.project.video!.scenes[0].phase='failed';input.sceneProgress.scene.active=false
 expect(render(input)).toContain('Stalled')
 expect(render(input)).toContain('activity-detail">Reviewing scene inputs')
 input.project.video!.scenes[0].phase='produced'
 expect(render(input)).not.toContain('activity-detail')
})

it('reviews camera takes in the main canvas and retains the same player while saving',async()=>{
 const {parseHTML}=await import('linkedom')
 const input=fixture(),scene=input.project.video!.scenes[0]
 scene.phase='waiting';scene.moments=[{id:'m',title:'Opening',lines:'Recorded line',start:0,end:2,camera:'full',layout:'beside-slide',overlay:null,recordingKey:'r',audioKey:'a',audio:null,take:null}]
 const capture=new Recording(()=>{},()=>{});capture.moments=scene.moments;capture.url='blob:review';capture.parts=[{momentId:'m',recordingKey:'r',from:0,to:2}]
 for(const phase of ['reviewing','uploading'] as const){
  capture.phase=phase
  const {document}=parseHTML(videoScreen(input,0,0,0,false,capture))
  expect(document.querySelectorAll('[data-take-player]')).toHaveLength(1)
  expect(document.querySelector('.video-stage > video[data-take-player]')?.getAttribute('src')).toBe('blob:review')
  expect(document.querySelector('.presenter-preview')).toBeNull()
  if(phase==='uploading')expect(document.querySelector('[data-action="save-take"]')?.hasAttribute('disabled')).toBe(true)
 }
})
it('uses a single audio player for microphone-only take review',async()=>{
 const {parseHTML}=await import('linkedom'),input=fixture(),capture=new Recording(()=>{},()=>{})
 capture.phase='reviewing';capture.url='blob:audio';capture.moments=[{id:'m',lines:'Audio',camera:'none'} as import('../shared/model').Moment]
 const {document}=parseHTML(videoScreen(input,0,0,0,false,capture))
 expect(document.querySelectorAll('[data-take-player]')).toHaveLength(1)
 expect(document.querySelector('audio[data-take-player]')).not.toBeNull()
 expect(document.querySelector('.take-review')?.textContent).toContain('unchanged until you save')
})
