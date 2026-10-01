import {practiceControls} from './practice-controls'
import {followTranscript} from './transcript-follow'
import {standInPlayback,standInControls} from './stand-in-playback'
import {syncPresenterLayout} from './presenter-motion'
import {layeredPlayback} from './layered-playback'
import {workspacePosition,workspaceUrl} from './workspace-position'
import {seekSavedMedia} from './media-seek'
import {savedMediaRecovery} from './media-recovery'
import {videoSettingsPreview} from './video-settings-preview'
import {takeReviewPosition,reviewLayoutSecond} from './take-review-clock'
import {NotebookOpening,notebookOpeningView} from './notebook-opening'
import {momentViewKey} from '../shared/model'
import {replacePlayerView} from './player-view'
import {recordingTarget} from './recording-target'
import {syncRehearsalAnimation} from './rehearsal-animation'
import {animationSecond} from '../shared/scene-time'
import {recordingSetup,recordingPassSetup,recordingRecovery,practiceSetup} from './recording-setup'
import {movePlayhead} from './moment-timeline'
import {gear,sceneSettings} from './camera-settings'
import {stageStatus} from './stage-status'
import {updateProgressTimes} from './progress'
import {presentationScreen} from './presentation-screen'
import {downloadPresentation,downloadVideo} from './download'
import {chooseAiDialog,modelOptions,type HarnessChoices} from './choose-ai'
import {PracticePlayback} from './practice'
import { Settings } from './settings'
import { parseVoice } from './voice-choice'
import { Recording } from './recording'
import { api } from './api'
import type { Snapshot,NotebookSummary } from '../shared/api'
import { escape, button } from './ui'
import { videoHeader, videoScreen, makeVideoDialog } from './video-screen'
import type { Presence, Transition } from '../shared/model'
import { sceneAt, videoSecond } from '../shared/video-clock'
import { cameraAt } from '../shared/camera-window'
import './style.css'
import incredibleLogo from './assets/incredible-logo.svg'
const root = document.querySelector<HTMLDivElement>('#app')!
const syncMediaRecovery=savedMediaRecovery(root)
let snapshot: Snapshot | null = null
let notebooks:NotebookSummary[]=[]
const refreshNotebooks=async()=>{notebooks=await api.notebooks();if(!snapshot && !settingsScreen.isOpen) render()}
let selected = 0
const requestedStage=new URL(location.href).searchParams.get('view')
let stage: 'notebook' | 'presentation' | 'video' = requestedStage==='notebook' || requestedStage==='video'?requestedStage:'presentation'
let closeStream: (() => void) | null = null
let pending = false
let pendingSource=''
let aiChoices:HarnessChoices|null=null
let momentIndex = 0
let second = 0
let wholeVideo = false
let startRehearsal:(()=>Promise<void>)|null=null
let practiceStopAfter:number|null=null
let practiceMomentIds:string[]=[]
let practiceCountdown=0
let practiceStarted=0
let practiceOpen=false
let practiceLoading=false
let practiceLines=''
const practice = new PracticePlayback((clip,at)=>{
  if(practiceStopAfter!==null && (performance.now()-practiceStarted)/1000>=practiceStopAfter){stopPractice();render();return}
  const changed=practiceLines!==clip.lines;practiceLines=clip.lines;second=at
  const scene=snapshot?.project.video?.scenes[selected];momentIndex=Math.max(0,scene?.moments.findIndex(moment=>moment.id===clip.momentId) ?? 0)
  if(changed) render()
  const presenter=root.querySelector<HTMLElement>('.presenter-preview');if(presenter) presenter.hidden=!clip.camera
  syncAnimation();paintAnimationProgress()
  syncLayeredPlayback()
  followTranscript(root,snapshot?.project.video?.scenes[selected]?.moments || [],second,momentIndex)
  followTranscript(root,scene?.moments || [],second,momentIndex)
  movePlayhead(root,scene?.moments || [],second)
  const cue=root.querySelector('.practice-cue>span');if(cue) cue.textContent=clip.lines
  const rehearsalClock=root.querySelector('[data-practice-clock]');if(rehearsalClock)rehearsalClock.textContent=`Practice · ${((performance.now()-practiceStarted)/1000).toFixed(1)}s · Esc to stop`
  const chip=root.querySelector('.anchor-chip');if(chip) chip.textContent=`${second.toFixed(1)}s · moment ${momentIndex+1}`
},()=>{const moment=snapshot?.project.video?.scenes[selected]?.moments[momentIndex];if(moment)second=moment.start;render()},reason=>{stopPractice();render();error(reason)})
let practiceRequest = 0
let practiceStream: MediaStream | null = null
const stopPractice = () => { practiceRequest++; practiceOpen=false;startRehearsal=null;practiceCountdown=0; practice.stop();practiceLoading=false;practiceLines=''; practiceStream?.getTracks().forEach(track => track.stop()); practiceStream = null }
let recordingSceneId = ''
let recordingProjectId = ''
let recordingAttempt:import('../shared/model').Moment[]=[]
const recordingFailed=(reason:unknown)=>{if(snapshot?.project.id===recordingProjectId && capture.phase==='idle')showDialog(recordingRecovery(reason));else error(reason)}
const capture = new Recording(() => {
  if (capture.phase === 'recording' || capture.phase === 'countdown') {
    const scene = snapshot?.project.video?.scenes.find(scene => scene.id === recordingSceneId)
    const id = capture.moments[Math.min(capture.current,capture.moments.length-1)]?.id
    momentIndex = Math.max(0,scene?.moments.findIndex(moment => moment.id === id) ?? 0)
    second = scene?.moments[momentIndex]?.start || 0
  }
  render()
}, elapsed => {
  const moment = snapshot?.project.video?.scenes.find(scene => scene.id === recordingSceneId)?.moments[momentIndex]
  second = Math.min(moment?.end ?? Infinity,(moment?.start || 0)+elapsed)
  syncAnimation();paintAnimationProgress()
  const clock = root.querySelector('.recording-clock'); if (clock) clock.textContent = `Recording · ${(capture.moments.length>1?capture.elapsed:elapsed).toFixed(1)}s${capture.stopAfter!==null?` / ${capture.stopAfter}s`: ''}`
  followTranscript(root,snapshot?.project.video?.scenes[selected]?.moments || [],second,momentIndex)
  movePlayhead(root,snapshot?.project.video?.scenes[selected]?.moments || [],second)
  const chip = root.querySelector('.anchor-chip'); if (chip) chip.textContent = `${second.toFixed(1)}s · moment ${momentIndex+1}`
}, reason => recordingFailed(reason))
const syncLayeredPlayback=layeredPlayback(root,(time,playing)=>{
 const scene=snapshot?.project.video?.scenes[selected],moment=scene?.moments[momentIndex];if(!scene || !moment)return
 const parts=capture.phase==='reviewing' || capture.phase==='uploading'?capture.parts:[{momentId:moment.id,recordingKey:moment.recordingKey,from:0,to:moment.take?.duration || moment.end-moment.start}]
 const at=takeReviewPosition(scene.moments,parts,time)
 if(at){
  second=at.second
  followTranscript(root,scene.moments,second,at.momentIndex)
  syncPresenterLayout(root,scene.moments,reviewLayoutSecond(scene.moments[at.momentIndex],at.second,playing))
  movePlayhead(root,scene.moments,at.second,at.momentIndex)
  const chip=root.querySelector('.anchor-chip');if(chip)chip.textContent=`${at.second.toFixed(1)}s · moment ${at.momentIndex+1}`
  syncRehearsalAnimation(root,scene,at.momentIndex,at.second,playing)
 }
})
standInPlayback(root,()=>{const scene=snapshot?.project.video?.scenes[selected];return scene?{scene,index:momentIndex}:null},(at,playing)=>{
 second=at
 const scene=snapshot?.project.video?.scenes[selected];if(!scene)return
 const moment=scene.moments[momentIndex]
 syncPresenterLayout(root,scene.moments,!playing && at===moment.start?at+Math.min(.28,(moment.end-moment.start)/3):at)
 followTranscript(root,scene.moments,at,momentIndex)
 movePlayhead(root,scene.moments,at,momentIndex)
 const chip=root.querySelector('.anchor-chip');if(chip)chip.textContent=`${at.toFixed(1)}s · moment ${momentIndex+1}`
})
const paintAnimationProgress=()=>{
 const moment=snapshot?.project.video?.scenes[selected]?.moments[momentIndex];if(!moment)return
 const duration=moment.end-moment.start,elapsed=Math.max(0,second-moment.start),finished=elapsed>=Math.max(0,duration-.3)
 const bar=root.querySelector<HTMLProgressElement>('[data-animation-progress]');if(bar){bar.max=duration;bar.value=finished?duration:elapsed}
 const label=root.querySelector('[data-animation-remaining]');if(label)label.textContent=finished?'Animation finished · keep speaking':`${Math.max(0,duration-elapsed).toFixed(1)}s of animation left`
}
const syncAnimation=()=>{const scene=snapshot?.project.video?.scenes[selected];if(scene)syncRehearsalAnimation(root,scene,momentIndex,second,(practice.active && !practice.paused) || capture.phase==='recording' || !!root.querySelector('[data-stand-in-play]') && root.querySelector<HTMLVideoElement>('[data-rehearsal-animation]')?.paused===false)}
let pendingVideoSettings:import('../shared/model').VideoSettings|null=null
let pendingRecording: import('../shared/model').Moment[] | null = null
const prepareRecording=(moment:import('../shared/model').Moment,index:number)=>{stopPractice();pendingRecording=[moment];const scene=snapshot?.project.video?.scenes[selected];showDialog(recordingSetup(moment,index,scene?snapshot?.views?.scenes[scene.id]?.openMomentIds.length:1))}
const prepareRecordingPass=(moments:import('../shared/model').Moment[])=>{stopPractice();pendingRecording=moments;const scene=snapshot!.project.video!.scenes[selected];showDialog(recordingPassSetup(moments,moments.map(moment=>scene.moments.findIndex(item=>item.id===moment.id))))}
let dialogRevision=0
const dialog = document.createElement('dialog'); dialog.id = 'dialog'; document.body.append(dialog);dialog.addEventListener('close',()=>{dialogRevision++;pendingVideoSettings=null})
const settingsScreen = new Settings(root,()=>snapshot?.project.id || null,()=>render(),async () => {if(snapshot) snapshot=await api.load(snapshot.project.id)})
const pendingChats=new Set<string>()
let liveConnected=true
let openingAutoStage=false
const opening=new NotebookOpening(api.load,value=>{if(openingAutoStage)stage=value.project.video?'video':'presentation';attach(value)},()=>render())
const openNotebook=(id:string,autoStage=false)=>{openingAutoStage=autoStage;const url=new URL(location.href);if(url.searchParams.get('notebook')!==id){url.searchParams.delete('scene');url.searchParams.delete('moment')}url.searchParams.set('notebook',id);url.searchParams.delete('project');history.replaceState(null,'',url);return opening.open(id)}
const render = () => {
  if(settingsScreen.isOpen) return
  const contextKey = [snapshot?.project.id,stage,selected].join(':')
  const sameContext = root.dataset.context === contextKey
  root.dataset.context = contextKey
  const previousPlayer = root.querySelector<HTMLMediaElement>('[data-scene-player],[data-take-player],[data-saved-presenter]') || root.querySelector<HTMLMediaElement>('[data-rehearsal-animation]')
  const playback = previousPlayer ? {src:previousPlayer.getAttribute('src'),time:previousPlayer.currentTime,playing:!previousPlayer.paused} : null
  const focused = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement ? document.activeElement : null
  const focusedId = sameContext ? focused?.id : null
  const drafts = (sameContext ? [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].filter(field => field.id).map(field => ({ id: field.id, value: field.value })) : [])
  if (!snapshot && opening.state) {
    replacePlayerView(root,`<header><a class="brand" href="/" aria-label="Incredible Studio"><img src="${incredibleLogo}" alt="">Incredible</a></header>${notebookOpeningView(opening.state)}`,null)
    syncMediaRecovery()
    return
  }
  if (!snapshot) {
    replacePlayerView(root, `<header><a class="brand" href="/" aria-label="Incredible Studio"><img src="${incredibleLogo}" alt="">Incredible</a>${button('Settings', 'settings')}</header><main class="start"><h1>Turn a blog into slides and a video.</h1><form id="source"><label class="sr" for="source-input">Link or text</label><div class="source-row"><textarea id="source-input" name="source" rows="1" placeholder="Paste a blog link or your text…" required></textarea><button class="primary" ${pending ? 'disabled' : ''}>${pending ? 'Starting…' : 'Make the video →'}</button></div><button type="button" data-action="slides-only" class="quiet slides-only">Only want slides?</button></form><p id="error" role="alert"></p>${notebooks.length?`<section class="saved-notebooks"><h2>Continue a notebook</h2>${notebooks.map(item=>`<button data-notebook="${escape(item.id)}"><span>${escape(item.title)}</span><small>${item.status==='failed'?'Needs another try':item.status==='building'?'Slides in progress':item.hasVideo?'Video in progress':'Slides ready'} →</small></button>`).join('')}</section>`:''}</main>`,previousPlayer)
    const sourceField=root.querySelector<HTMLTextAreaElement>('#source-input')
    syncMediaRecovery()
    if(sourceField) sourceField.value=drafts.find(draft=>draft.id==='source-input')?.value ?? pendingSource
    if(focusedId && !dialog.open) document.getElementById(focusedId)?.focus()
    return
  }
  const { project, status } = snapshot
  selected = Math.max(0, Math.min(selected, project.slides.length - 1))
  const viewUrl=workspaceUrl(new URL(location.href),project,stage,selected,momentIndex)
  if(viewUrl.href!==location.href)history.replaceState(null,'',viewUrl)
  replacePlayerView(root, `<header><a class="brand" href="/" aria-label="Incredible Studio"><img src="${incredibleLogo}" alt="">Incredible</a><div class="notebook-identity"><a class="header-project-title" href="/?notebook=${encodeURIComponent(project.id)}" title="Permanent notebook link">${escape(project.title)}</a>${project.harness?`<span class="notebook-harness" title="AI saved for this notebook">${escape(({kimi:'Kimi','claude-code':'Claude Code',codex:'Codex'})[project.harness.adapter])}${project.harness.model?` · ${escape(project.harness.model.replace(/^kimi-code\//,''))}`:''}</span>`:''}</div><nav aria-label="Stages">${(['notebook','presentation','video'] as const).map(name => `<button data-stage="${name}" aria-current="${stage === name ? 'page' : 'false'}">${name[0].toUpperCase()+name.slice(1)}${stageStatus(snapshot!,name,liveConnected)}</button>`).join('')}</nav><div class="header-actions">${project.video?`<button type="button" data-action="video-settings" class="icon-button" aria-label="Notebook settings" title="Notebook settings">${gear}</button>`:button('Settings', 'settings')}${stage==='notebook'?button('View slides →','view-slides',true,status!=='ready') : stage === 'presentation' ? button('Export slides', 'export', false, status !== 'ready') + button(project.video?'Continue video →':'Make the video →', 'make-video', true, status !== 'ready') : stage === 'video' ? videoHeader(snapshot) : ''}</div></header><main class="workspace workspace-${stage}"><div class="project-heading"><h1>${escape(project.title)}</h1>${stage === 'presentation' ? '<p>Each slide is one scene of your video.</p>' : ''}</div>${stage === 'notebook' ? `<article class="notebook">${project.sourceUrl?`<p>From <a href="${escape(project.sourceUrl)}" target="_blank" rel="noopener">${escape(project.sourceUrl)}</a></p>`:''}<pre>${escape(project.source)}</pre><form id="notebook-chat" class="chat"><label class="sr" for="source-question">Ask about the source</label><input id="source-question" name="instruction" placeholder="Ask about the source…" ${status!=='ready'?'disabled':''}><button aria-label="Send source question" ${status!=='ready' || pendingChats.has(project.id)?'disabled':''}>↑</button></form><div class="reply"><span>${escape([...snapshot.events].reverse().find(event=>event.kind==='chat' && event.anchor?.stage==='notebook')?.message || '')}</span>${button('History','history')}</div><p id="error" role="alert"></p></article>` : stage === 'video' ? videoScreen(snapshot, selected, momentIndex, second, practiceOpen, capture, practiceStream, wholeVideo, liveConnected) : presentationScreen(snapshot,selected,pendingChats.has(project.id))}</main>`,previousPlayer)
  if(snapshot.readOnly){
    for(const input of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')) input.disabled=true
    for(const control of root.querySelectorAll<HTMLButtonElement>('button')){
      const navigation=control.hasAttribute('data-stage') || control.hasAttribute('data-slide') || control.hasAttribute('data-scene') || control.hasAttribute('data-moment')
      const reviewAction=['history','export','download-scene','preview-video','back'].includes(control.dataset.action || '')
      if(!navigation && !reviewAction) control.disabled=true
    }
  }
  if(!liveConnected) root.insertAdjacentHTML('beforeend','<div class="connection-notice" role="status">Live updates disconnected. Reconnecting… Your saved work remains available.</div>')
  const player = root.querySelector<HTMLVideoElement>('[data-scene-player]')
  if (player) {
    const sameSource = previousPlayer === player && playback?.src === player.getAttribute('src')
    if(sameSource) {
      // Keep the loaded media element and its buffer across progress snapshots.
      // Recreating it seeks and reloads on every scene update.
      previousPlayer.toggleAttribute('data-whole-video',player.hasAttribute('data-whole-video'))
      // replacePlayerView retained this connected element and its decoded frame.
      if(playback.playing){void previousPlayer.play().catch(()=>{});animatePlayhead(player)}
    } else {
      const start=player.hasAttribute('data-whole-video') ? videoSecond(project,selected,second) : player.hasAttribute('data-animation-player')?animationSecond(project.video!.scenes[selected],second,true):second
      if(start>0)seekSavedMedia(player,start)
    }
  }
  syncMediaRecovery()
  syncAnimation()
  syncLayeredPlayback()
  followTranscript(root,snapshot?.project.video?.scenes[selected]?.moments || [],second,momentIndex)
  movePlayhead(root,project.video?.scenes[selected]?.moments || [],second)
  const camera = root.querySelector<HTMLVideoElement>('video[data-camera]')
  if (camera && (capture.stream || practiceStream)) { camera.srcObject = capture.stream || practiceStream; void camera.play().catch(() => {}) }
  if(practiceLoading){const button=root.querySelector<HTMLButtonElement>('[data-action="practice"]');if(button) button.textContent='Cancel preparation'}
  if(practiceOpen && startRehearsal){root.querySelector('.video-stage')?.insertAdjacentHTML('beforeend',standInControls());root.querySelector('[data-animation-status]')?.setAttribute('hidden','')}
  paintAnimationProgress()
  if(practiceOpen){
    const phase=startRehearsal?'ready':practiceCountdown?'countdown':practice.active?'running':'finished'
    const actions=root.querySelector('.video-actions>div:last-child')
    if(actions)actions.innerHTML=practiceControls(phase,practiceMomentIds.length>1?(practiceMomentIds.at(-1)===snapshot.project.video?.scenes[selected]?.moments[momentIndex]?.id?'Finish practice':'Next moment'):undefined)
    const label=root.querySelector('[data-practice-clock]');if(label)label.textContent=phase==='ready'?'Your script':phase==='countdown'?`Starting in ${practiceCountdown}…`:phase==='finished'?'Practice complete':'Practice'
  }
  const transport=root.querySelector<HTMLButtonElement>('[data-action="practice-toggle"]');if(transport){transport.textContent=practice.active && !practice.paused?'Ⅱ Pause':'▶ Play';transport.setAttribute('aria-label',practice.active && !practice.paused?'Pause practice':'Play practice')}
  if(practice.active){const cue=root.querySelector('.practice-cue>span');if(cue) cue.textContent=practiceLines}
  root.querySelector<HTMLButtonElement>('#video-chat button')?.toggleAttribute('disabled',pendingChats.has(project.id))
  for (const draft of drafts) { const field = document.getElementById(draft.id); if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = draft.value }
  if (focusedId) document.getElementById(focusedId)?.focus()
  if (status === 'building' && !localStorage.getItem('studio-slides-explained') && !dialog.open) showExplainer()
}
const sendChat=async(request:import('../shared/api').ChatRequest)=>{
  if(!snapshot) return
  const id=snapshot.project.id
  if(pendingChats.has(id)) return
  const fieldId=request.anchor.stage==='notebook'?'source-question':request.anchor.stage==='video'?'video-instruction':'instruction'
  pendingChats.add(id);render()
  try{const updated=await api.chat(id,request);if(snapshot?.project.id===id){snapshot=updated;const field=document.getElementById(fieldId);if(field instanceof HTMLInputElement && field.value.trim()===request.instruction) field.value=''}}
  finally{pendingChats.delete(id);render()}
}
const attach = (value: Snapshot) => {
  liveConnected=true
  if(stage==='video')({selected,momentIndex,second}=workspacePosition(value.project,new URL(location.href)))
  opening.reset();snapshot = value; localStorage.setItem('minimal-studio-project', value.project.id)
  const notebookUrl=new URL(location.href);notebookUrl.searchParams.delete('project');notebookUrl.searchParams.set('notebook',value.project.id);history.replaceState(null,'',notebookUrl)
  closeStream?.(); closeStream = api.subscribe(value.project.id, update => {
    if ((practice.active || practiceLoading) && snapshot?.project.video?.scenes[selected]?.inputKey !== update.project.video?.scenes[selected]?.inputKey) stopPractice()
    snapshot = update; render()
  },connected=>{if(snapshot?.project.id===value.project.id && liveConnected!==connected){liveConnected=connected;render()}}); render()
}
const error = (reason: unknown) => { const target = dialog.open ? dialog.querySelector('#error') : document.querySelector('#error, #settings-message'); if (target) target.textContent = reason instanceof Error ? reason.message : 'Could not complete that change' }
const showDialog = (content: string) => {
  dialogRevision++
  delete dialog.dataset.explainer
  dialog.innerHTML = `${button('×', 'close')}<div class="dialog-body">${content}</div>`; if (!dialog.open) dialog.showModal()
}
const showExplainer = () => {
  showDialog(`<p class="eyebrow">THE FIRST STEP</p><h2>Your video starts as slides.</h2><div class="explain-picture"><span>▤<small>A slide</small></span><b>→</b><span>▷<small>A scene</small></span><b>→</b><span>▶<small>Your video</small></span></div><p>Fixing a slide takes seconds.<br>A finished video takes minutes.</p>${button('Show me the slides', 'understood', true)}`)
  dialog.dataset.explainer = 'yes'
}
document.addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const values = new FormData(form)
  try {
    if(form.id==='practice-setup'){
      const scene=snapshot!.project.video!.scenes[selected],open=snapshot!.views?.scenes[scene.id].openMomentIds || []
      const moments=values.get('scope')==='open'?scene.moments.filter(moment=>open.includes(moment.id)):[scene.moments[momentIndex]]
      const raw=String(values.get('seconds') || '').trim();const seconds=raw?Number(raw):null
      if(seconds!==null && (!Number.isFinite(seconds) || seconds<1 || seconds>600))throw new Error('Choose a stop time between 1 and 600 seconds')
      if(!moments.length)return
      dialog.close();practiceStopAfter=seconds;practiceMomentIds=moments.map(moment=>moment.id)
      const request=++practiceRequest;practiceOpen=true;second=moments[0].start;momentIndex=scene.moments.findIndex(m=>m.id===moments[0].id)
      startRehearsal=async()=>{root.querySelector<HTMLVideoElement>('[data-rehearsal-animation]')?.pause();second=moments[0].start;startRehearsal=null
      for(let count=3;count>0;count--){if(request!==practiceRequest)return;practiceCountdown=count;render();await new Promise(resolve=>setTimeout(resolve,1000))}
      if(request!==practiceRequest)return
      let at=0
      const clips=moments.map(moment=>{const start=at;at+=moment.end-moment.start;return {momentId:moment.id,lines:moment.lines,camera:moment.camera!=='none',start,end:at,sceneStart:moment.start,sceneEnd:moment.end}})
      practiceCountdown=0;practiceStarted=performance.now();practice.start({inputKey:scene.inputKey,clips,duration:at},true);render()
      };render()
    }
    if(form.id==='recording-setup' && pendingRecording){
      const seconds=String(values.get('seconds') || '').trim()
      const moments=pendingRecording;pendingRecording=null;dialog.close()
      recordingAttempt=structuredClone(moments)
      try{await capture.start(moments,{stopAfter:seconds?Number(seconds):null})}catch(reason){recordingFailed(reason)}
    }
    if(form.id==='source'){
      if(pending) return
      pendingSource=String(values.get('source')).trim();if(!pendingSource) return
      pending=true;render()
      try{aiChoices=await api.harnesses();showDialog(chooseAiDialog(aiChoices))}finally{pending=false;render()}
    }
    if(form.id==='choose-ai'){
      if(pending || !pendingSource) return
      const adapter=String(values.get('harness')) as import('../shared/model').HarnessSelection['adapter']
      if(!aiChoices?.available.some(choice=>choice.id===adapter && choice.ok)) throw new Error('Choose an available AI harness')
      const model=String(values.get('model') || ''),harness={adapter,...model?{model}:{}}
      pending=true;const submit=form.querySelector<HTMLButtonElement>('button[type=submit],button.primary');if(submit) submit.disabled=true
      try{await api.saveSettings({harness});const created=await api.create({source:pendingSource,harness});pendingSource='';dialog.close();stage='presentation';attach(created)}finally{pending=false;if(submit) submit.disabled=false}
    }
    if(form.id==='source-recovery' && snapshot){snapshot=await api.replaceSource(snapshot.project.id,String(values.get('text') || ''));dialog.close();stage='presentation';render()}
    if (['video-form','video-settings-form'].includes(form.id) && snapshot) {
      const presence = String(values.get('presence')) as Presence
      const voice = String(values.get('voice'))
      const next={presence,voice:parseVoice(voice)}
      if(form.id==='video-settings-form'){pendingVideoSettings=next;showDialog(videoSettingsPreview(snapshot.project,next));return}
      snapshot = await api.makeVideo(snapshot.project.id,next)
      dialog.close(); stage = 'video'; selected = 0; momentIndex = 0; second = 0; render()
    }
    if (form.id === 'video-chat' && snapshot) {
      if (capture.phase !== 'idle') throw new Error('Finish or discard this take before changing the scene')
      const scene = snapshot.project.video?.scenes[selected]
      const moment = scene?.moments[momentIndex]
      const instruction = String(values.get('instruction') || '').trim()
      if (!scene || !moment || !instruction) return
      stopPractice(); await sendChat({anchor:{stage:'video',sceneId:scene.id,momentId:moment.id,second},instruction})
    }
    if(form.id==='notebook-chat' && snapshot){const instruction=String(values.get('instruction') || '').trim();if(!instruction) return;await sendChat({anchor:{stage:'notebook'},instruction})}
    if (form.id === 'chat' && snapshot) {
      const instruction = String(values.get('instruction') || '').trim()
      const slideId = snapshot.project.slides[selected]?.id
      if (!instruction || !slideId) return
      await sendChat({anchor:{stage:'presentation',slideId},instruction})
    }
  } catch (reason) { error(reason) } finally { pending = false }
})
document.addEventListener('click', async event => {
  if ((event.target as Element).closest('.brand')) {
    if (capture.phase !== 'idle') return
    event.preventDefault(); stopPractice(); closeStream?.(); closeStream = null; snapshot = null; opening.reset();localStorage.removeItem('minimal-studio-project');history.replaceState(null,'','/'); render();void refreshNotebooks().catch(error); return
  }
  const target = (event.target as Element).closest<HTMLButtonElement>('button')
  if (!target) return
  if (capture.phase !== 'idle' && (target.dataset.slide || target.dataset.scene || target.dataset.moment || target.dataset.stage)) return
  if (target.dataset.slide) { selected = Number(target.dataset.slide); render(); return }
  if (target.dataset.scene) { stopPractice(); selected = Number(target.dataset.scene); momentIndex = 0; second = 0; const player = root.querySelector<HTMLVideoElement>('[data-whole-video]'); if (player && snapshot) player.currentTime = videoSecond(snapshot.project,selected,0); render(); return }
  if (target.dataset.moment) { stopPractice(); momentIndex = Number(target.dataset.moment); second = snapshot?.project.video?.scenes[selected]?.moments[momentIndex]?.start || 0; const player = root.querySelector<HTMLVideoElement>('[data-scene-player]'); if (player && snapshot) seekSavedMedia(player,player.hasAttribute('data-whole-video') ? videoSecond(snapshot.project,selected,second) : player.hasAttribute('data-animation-player')?animationSecond(snapshot.project.video!.scenes[selected],second,true):second); render(); return }
  if (target.dataset.stage) { wholeVideo = false; stopPractice(); stage = target.dataset.stage as typeof stage; render(); return }
  const action = target.dataset.action
  try {
    if(target.dataset.notebook) {if(capture.phase!=='idle') throw new Error('Finish this take first');selected=0;momentIndex=0;second=0;await openNotebook(target.dataset.notebook,true);return}
    if (action === 'settings' || action === 'clone-settings') { if(capture.phase!=='idle') throw new Error('Finish or discard this take before opening Settings'); stopPractice(); dialog.close(); await settingsScreen.open(); return }
    if (action === 'close') { if (dialog.dataset.explainer) localStorage.setItem('studio-slides-explained','yes'); dialog.close() }
    if (action === 'understood') { localStorage.setItem('studio-slides-explained','yes'); document.querySelector<HTMLDialogElement>('#dialog')?.close() }
    if (action === 'slides-only') document.querySelector<HTMLTextAreaElement>('#source-input')?.focus()
    if(action==='open-notebook' && opening.state){await openNotebook(opening.state.id,openingAutoStage);return}
    if (!snapshot) return
    if (capture.phase !== 'idle' && ['make-video','video-settings','scene-settings'].includes(action || '')) throw new Error('Finish or discard this take before changing settings')
    const id = snapshot.project.id; const slideId = snapshot.project.slides[selected]?.id
    if(action==='paste-source') showDialog(`<h2>Paste the article text</h2><p>The site blocked automatic reading. Copy its article text here to continue this notebook.</p><form id="source-recovery"><label for="article-text">Article text</label><textarea id="article-text" name="text" required minlength="40"></textarea><button class="primary">Continue with this text →</button><p id="error" role="alert"></p></form>`)
    if (action === 'stop-slides') { target.setAttribute('disabled','');target.textContent='Stopping…';snapshot=await api.stopSlides(id);render() }
    if (action === 'retry-slides') { snapshot = await api.retrySlides(id); render() }
    if (action === 'export') await downloadPresentation(id,target)
    if(action==='confirm-video-settings' && pendingVideoSettings){snapshot=await api.updateVideo(id,pendingVideoSettings);pendingVideoSettings=null;dialog.close();render();return}
    if (action === 'video-settings') {
      showDialog('<h2>Opening notebook settings</h2><p role="status">Loading your voice choices…</p><p id="error" role="alert"></p>')
      const revision=dialogRevision
      let settings:import('../shared/settings').StudioSettings
      try{settings=await api.settings()}catch(reason){
        if(dialog.open && dialogRevision===revision)showDialog(`<h2>Settings could not load</h2><p role="alert">${escape(reason instanceof Error?reason.message:'Check the connection and try again.')}</p>${button('Try again','video-settings',true)}`)
        return
      }
      if(!dialog.open || dialogRevision!==revision)return
      showDialog(makeVideoDialog(settings,pendingVideoSettings || snapshot.project.video!.settings))
      const form = dialog.querySelector<HTMLFormElement>('#video-form, #video-settings-form')!; form.id = 'video-settings-form'
      dialog.querySelector('h2')!.textContent = 'Notebook settings'
      form.querySelector('button[type=submit]')!.textContent = 'Review changes'
      const message = document.createElement('p'); message.textContent = 'On-camera changes re-plan scenes using the video setting. Matching recordings are kept.'; form.prepend(message);form.insertAdjacentHTML('afterend',button('App settings','settings'))
    }
    if(action==='view-slides'){stage='presentation';render()}
    if (action === 'make-video') { if (snapshot.project.video) { stage = 'video'; render() } else showDialog(makeVideoDialog(await api.settings())) }
    if (action === 'produce-video') {
      if (snapshot.views?.video.action === 'export') await downloadVideo(id,target)
      else { snapshot = await api.produceVideo(id); render() }
    }
    if (action === 'preview-video') { stopPractice(); wholeVideo = !wholeVideo; render(); if (wholeVideo) void root.querySelector<HTMLVideoElement>('[data-whole-video]')?.play().catch(() => {}) }
    if (action === 'download-scene') await downloadVideo(id,target,snapshot.project.video!.scenes[selected].id)
    if (target.dataset.transition) {
      const index = Number(target.dataset.transition)
      showDialog(`<h2>Between scenes ${index+1} and ${index+2}</h2><div class="transition-choices">${(['none','crossfade','push-left','push-right','push-up','wipe','zoom'] as const).map(value => `<button data-transition-index="${index}" data-transition-value="${value}">${value.replace(/-/g,' ')}</button>`).join('')}</div>`)
    }
    if (target.dataset.transitionValue) {
      snapshot = await api.transition(id,Number(target.dataset.transitionIndex),target.dataset.transitionValue as Transition); dialog.close(); render()
    }
    if (action === 'back') { stage = 'presentation'; render() }
    if (action === 'history') showDialog(`<h2>Studio history</h2><ol>${snapshot.events.map(item => `<li>${escape(item.message)}</li>`).join('')}</ol>`)
    if(action==='moment-actions'){
      stopPractice();momentIndex=Number(target.dataset.menuMoment);const scene=snapshot.project.video!.scenes[selected],moment=scene.moments[momentIndex]
      if(!moment)return
      second=moment.start
      const player=root.querySelector<HTMLVideoElement>('[data-scene-player]')
      if(player){player.pause();player.currentTime=player.hasAttribute('data-whole-video')?videoSecond(snapshot.project,selected,second):player.hasAttribute('data-animation-player')?animationSecond(scene,second,true):second}
      render()
      const state=snapshot.views?.moments[momentViewKey(scene.id,moment.id)]?.state
      showDialog(`<p class="eyebrow">MOMENT ${momentIndex+1}</p><h2>${escape(moment.title || 'Your part')}</h2><div class="moment-action-list">${button('Practice this moment','practice')}${state==='recorded'?`<button type="button" data-retake="${momentIndex}">Retake this moment</button>`:snapshot.views?.scenes[scene.id].openMomentIds.includes(moment.id)?button('Record this moment','record-moment'):''}</div>`)
    }
    if (action === 'scene-settings') {
      if(target.dataset.settingsScene!==undefined){selected=Number(target.dataset.settingsScene);momentIndex=0;second=0;render()}
      const scene = snapshot.project.video?.scenes[selected]
      if (!scene) return
      showDialog(sceneSettings(scene,snapshot.project.video!.settings,selected))
    }
    if (target.dataset.presence) {
      const scene = snapshot.project.video!.scenes[selected]
      const preview = await api.previewPresence(id, scene.id, target.dataset.presence==='inherit'?null:target.dataset.presence as Presence)
      showDialog(`<h2>Re-plan scene ${selected+1}</h2><p>${escape(preview.message)}</p><button class="primary" data-action="confirm-replan" data-value="${preview.to===null?'inherit':preview.to}">Re-plan scene ${selected+1}</button><p id="error" role="alert"></p>`)
    }
    if (action === 'confirm-replan') {
      snapshot = await api.replan(id, snapshot.project.video!.scenes[selected].id, target.dataset.value==='inherit'?null:target.dataset.value as Presence); dialog.close(); render()
    }
    if(action==='practice-camera'){
      const request=practiceRequest
      try{const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});if(request!==practiceRequest || !practiceOpen){stream.getTracks().forEach(track=>track.stop());return};practiceStream?.getTracks().forEach(track=>track.stop());practiceStream=stream;render()}
      catch{error(new Error('Camera unavailable. Rehearsal continues with the presenter stand-in. Enable camera access in browser site settings to retry.'))}
    }
    if(action==='practice-start'){await startRehearsal?.();return}
    if(action==='practice-next'){practice.advance();render();return}
    if(action==='practice-toggle' && practice.active){if(practice.paused)practice.resume();else practice.pause();render();return}
    if (action === 'practice' || action === 'practice-replay' || action === 'practice-toggle') {
      dialog.close();wholeVideo=false
      if(action==='practice' && (practiceOpen || practiceLoading)){stopPractice();render();return}
      const scene=snapshot.project.video!.scenes[selected],moment=scene.moments[momentIndex]
      if(!moment) return
      showDialog(practiceSetup(moment,momentIndex,snapshot.views?.scenes[scene.id].openMomentIds.length || 0))
    }
    if(action==='record-open'){
      const scene=snapshot.project.video!.scenes[selected],open=snapshot.views?.scenes[scene.id].openMomentIds || []
      const moments=scene.moments.filter(moment=>open.includes(moment.id))
      if(!moments.length)throw new Error('No moments need recording')
      recordingSceneId=scene.id;recordingProjectId=id;prepareRecordingPass(moments)
    }
    if(action==='recording-retry'){
      const scene=snapshot.project.video?.scenes.find(entry=>entry.id===recordingSceneId)
      if(!scene || id!==recordingProjectId || !recordingAttempt.length)throw new Error('Select the moment you want to record.')
      if(!['waiting','produced'].includes(scene.phase))throw new Error('Wait for this scene to finish changing before recording again.')
      const moments=recordingAttempt.map(previous=>scene.moments.find(moment=>moment.id===previous.id && moment.recordingKey===previous.recordingKey))
      if(moments.some(moment=>!moment))throw new Error('The dialogue changed. Close this dialog and select the updated moment to record.')
      selected=snapshot.project.video!.scenes.indexOf(scene)
      momentIndex=scene.moments.findIndex(moment=>moment.id===moments[0]!.id);second=moments[0]!.start
      if(moments.length>1)prepareRecordingPass(moments as import('../shared/model').Moment[]);else prepareRecording(moments[0]!,momentIndex)
    }
    if (action === 'scene-next' || action==='record-moment') {
      const scene = snapshot.project.video!.scenes[selected]
      if (snapshot.views?.scenes[scene.id].action === 'retry') { snapshot = await api.retryScene(id,scene.id); render() }
      else if (snapshot.views?.scenes[scene.id].action === 'record' || action==='record-moment') {
        stopPractice(); recordingSceneId = scene.id; recordingProjectId = id
        const open = snapshot.views?.scenes[scene.id].openMomentIds || []
        const index=recordingTarget(scene.moments,open,momentIndex)
        if(index<0)throw new Error('No moments need recording. Select a saved moment to retake it.')
        prepareRecording(scene.moments[index],index)
      } else if (snapshot.views?.scenes[scene.id].action === 'produce') { stopPractice(); snapshot = await api.produceScene(id,scene.id); render() }
    }
    if (target.dataset.retake) {
      const scene = snapshot.project.video!.scenes[selected]
      stopPractice(); recordingSceneId = scene.id; recordingProjectId = id
      prepareRecording(scene.moments[Number(target.dataset.retake)],Number(target.dataset.retake))
    }
    if (action === 'record-next') capture.next()
    if (action === 'record-stop') capture.stop()
    if (action === 'retake-recording') {const moments=capture.moments;capture.dispose();if(moments.length>1)prepareRecordingPass(moments);else if(moments[0])prepareRecording(moments[0],momentIndex)}
    if (action === 'discard-take') capture.dispose()
    if (action === 'save-take' && capture.blob) {
      capture.phase = 'uploading'; render()
      try { snapshot = await api.saveRecording(recordingProjectId,recordingSceneId,capture.parts,capture.blob); capture.dispose() }
      catch (reason) { capture.phase = 'reviewing'; render(); throw reason }
    }
    if (['add','duplicate','delete','up','down','undo-delete'].includes(action || '')) {
      const restoredIndex = snapshot.deletedSlide?.index || 0
      snapshot = await api.slide(id, { action: action === 'up' || action === 'down' ? 'move' : action as 'add' | 'duplicate' | 'delete' | 'undo-delete', slideId, index: action === 'up' ? selected-1 : selected+1 });
      if (action === 'add') selected = snapshot.project.slides.length-1
      if (action === 'duplicate' || action === 'down') selected++
      if (action === 'up') selected--
      if (action === 'undo-delete') selected = restoredIndex
      render()
    }
  } catch (reason) { error(reason) }
})
render()
const parameters=new URLSearchParams(location.search)
const saved = parameters.get('notebook') || parameters.get('project') || localStorage.getItem('minimal-studio-project')
if (saved) void openNotebook(saved)
else void refreshNotebooks().catch(error)

document.addEventListener('keydown',event=>{
  if(event.key==='Tab' && root.querySelector('.is-focused')){
    const controls=[...root.querySelectorAll<HTMLElement>('.is-focused .stage-area button:not(:disabled),.is-focused .stage-area input:not(:disabled),.is-focused .stage-area [tabindex="0"]')].filter(el=>el.getClientRects().length)
    const first=controls[0],last=controls.at(-1)
    if(first && (event.shiftKey && (document.activeElement===first || !root.querySelector('.is-focused .stage-area')?.contains(document.activeElement)))){event.preventDefault();last?.focus()}
    else if(first && !event.shiftKey && (document.activeElement===last || !root.querySelector('.is-focused .stage-area')?.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
  if(event.repeat)return
  if(event.key==='Enter' && practice.active && practiceMomentIds.length>1 && !/INPUT|TEXTAREA|SELECT/.test((event.target as Element).tagName)){event.preventDefault();practice.advance();render();return}
  if(event.key==='Enter' && capture.phase==='recording' && capture.moments.length>1 && !/INPUT|TEXTAREA|SELECT/.test((event.target as Element).tagName)){event.preventDefault();try{capture.next()}catch(reason){error(reason)};return}
  if(event.key!=='Escape')return
  if(practiceOpen){event.preventDefault();stopPractice();render();return}
  if(capture.phase==='recording'){event.preventDefault();try{capture.stop()}catch(reason){error(reason)}}
  else if(capture.phase==='countdown' || capture.phase==='preparing'){event.preventDefault();capture.dispose()}
})
root.addEventListener('keydown', event => {
  if (!snapshot || stage !== 'presentation' || /INPUT|TEXTAREA/.test((event.target as Element).tagName)) return
  const command = event.metaKey || event.ctrlKey
  const action = command && event.key.toLowerCase() === 'd' ? 'duplicate' : command && event.key === 'ArrowUp' ? 'up' : command && event.key === 'ArrowDown' ? 'down' : event.key === 'Delete' ? 'delete' : event.key === 'Enter' ? 'add' : null
  if (action) { event.preventDefault(); root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click() }
})
let dragged: number | null = null
root.addEventListener('dragstart', event => {
  const target = (event.target as Element).closest<HTMLElement>('[data-slide]')
  dragged = target ? Number(target.dataset.slide) : null
})
root.addEventListener('dragover', event => { if ((event.target as Element).closest('[data-slide]')) event.preventDefault() })
root.addEventListener('drop', async event => {
  event.preventDefault()
  const target = (event.target as Element).closest<HTMLElement>('[data-slide]')
  if (!target || dragged === null || !snapshot) return
  try { selected = Number(target.dataset.slide); snapshot = await api.slide(snapshot.project.id, { action: 'move', slideId: snapshot.project.slides[dragged].id, index: selected }); render() } catch (reason) { error(reason) }
  dragged = null
})

dialog.addEventListener('change', event => {
  const target=event.target as HTMLSelectElement
  if(target.form?.id==='choose-ai' && target.name==='harness'){const model=target.form.elements.namedItem('model') as HTMLSelectElement;model.innerHTML=modelOptions(aiChoices?.available.find(choice=>choice.id===target.value));return}
  const form = dialog.querySelector<HTMLFormElement>('#video-form, #video-settings-form')
  if (!form) return
  const values = new FormData(form)
  const warning = form.querySelector<HTMLElement>('.two-voices')!
  warning.hidden = !String(values.get('voice')).startsWith('ai:') || values.get('presence') === 'off'
})

// A browser take is not durable until the save response confirms persistence.
window.addEventListener('beforeunload', event => {
 if(capture.phase==='recording' || capture.phase==='reviewing' || capture.phase==='uploading'){event.preventDefault();event.returnValue=''}
})
window.addEventListener('pagehide', () => { stopPractice(); capture.dispose(); if(settingsScreen.isOpen) settingsScreen.close(); closeStream?.() })

let playheadFrame=0
const stopPlayhead=()=>{cancelAnimationFrame(playheadFrame);playheadFrame=0}
const animatePlayhead=(player:HTMLMediaElement)=>{
 stopPlayhead()
 const tick=()=>{
  if(!player.isConnected || player.paused || player.ended || !snapshot){stopPlayhead();return}
  if(player.hasAttribute('data-take-player')){const scene=snapshot.project.video?.scenes[selected],at=scene?takeReviewPosition(scene.moments,capture.parts,player.currentTime):null;if(at)movePlayhead(root,scene!.moments,at.second,at.momentIndex);playheadFrame=requestAnimationFrame(tick);return}
  const at=player.hasAttribute('data-whole-video')?sceneAt(snapshot.project,player.currentTime):{index:selected,second:player.hasAttribute('data-animation-player')?animationSecond(snapshot.project.video!.scenes[selected],player.currentTime):player.currentTime}
  movePlayhead(root,snapshot.project.video?.scenes[at.index]?.moments || [],at.second)
  playheadFrame=requestAnimationFrame(tick)
 }
 playheadFrame=requestAnimationFrame(tick)
}
root.addEventListener('play',event=>{const player=event.target;if(player instanceof HTMLMediaElement && player.matches('[data-scene-player],[data-take-player]'))animatePlayhead(player)},true)
for(const type of ['pause','ended','emptied'])root.addEventListener(type,event=>{if(event.target instanceof HTMLMediaElement && event.target.matches('[data-scene-player],[data-take-player]'))stopPlayhead()},true)
window.addEventListener('pagehide',stopPlayhead)

root.addEventListener('timeupdate',event => {
  const player = event.target as HTMLMediaElement
  if (!player.matches('[data-scene-player],[data-take-player]')) return
  if (!snapshot) return
  let changedScene = false
  if(player.hasAttribute('data-take-player')){
    const scene=snapshot.project.video?.scenes[selected],at=scene?takeReviewPosition(scene.moments,capture.parts,player.currentTime):null
    if(!at)return
    momentIndex=at.momentIndex;second=at.second
    syncRehearsalAnimation(root,scene!,momentIndex,second,!player.paused)
  } else if (player.hasAttribute('data-whole-video')) {
    const at = sceneAt(snapshot.project,player.currentTime)
    changedScene = selected !== at.index; selected = at.index; second = at.second
  } else second = player.hasAttribute('data-animation-player')?animationSecond(snapshot.project.video!.scenes[selected],player.currentTime):player.currentTime
  const scene = snapshot.project.video?.scenes[selected]
  if (!scene) return
  const clock=scene.moments
  const index = clock.findIndex(moment => second >= moment.start && second < moment.end)
  if (index >= 0 && !player.hasAttribute('data-take-player')) momentIndex = index
  if (changedScene) { render(); return }
  followTranscript(root,scene.moments,second,momentIndex)
  root.querySelectorAll('.transcript-moment').forEach((entry,index) => entry.classList.toggle('current',index === momentIndex))
  root.querySelectorAll('.moment').forEach((entry,index) => entry.classList.toggle('current',index === momentIndex))
  movePlayhead(root,snapshot?.project.video?.scenes[selected]?.moments || [],second,player.hasAttribute('data-take-player')?momentIndex:undefined)
  const chip = root.querySelector('.anchor-chip'); if (chip) chip.textContent = `${second.toFixed(1)}s · moment ${momentIndex+1}`
},true)

root.addEventListener('focusin',event => {
  if ((event.target as HTMLElement).id === 'video-instruction') root.querySelector<HTMLVideoElement>('[data-scene-player]')?.pause()
})

// Update only elapsed copy; never rebuild the editor or disturb draft focus.
setInterval(()=>updateProgressTimes(root),10000)
