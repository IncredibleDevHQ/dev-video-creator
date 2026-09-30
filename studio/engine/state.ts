import {momentViewKey} from '../shared/model'
import type { Moment, Project, Scene, SceneView, Voice } from '../shared/model'

export const takeFits = (moment: Moment) => Boolean(moment.take && moment.take.recordingKey === moment.recordingKey)
export const momentNeedsRecording = (moment: Moment, voice: Voice) => moment.camera !== 'none' || voice.kind === 'record'
export const momentState = (moment: Moment, voice: Voice): 'auto' | 'to record' | 'recorded' =>
  momentNeedsRecording(moment, voice) ? takeFits(moment) ? 'recorded' : 'to record' : 'auto'

export const sceneView = (scene: Scene, voice: Voice): SceneView => {
  const openMomentIds = scene.moments.filter(moment => momentState(moment, voice) === 'to record').map(moment => moment.id)
  const view = (state: string, action: SceneView['action'], produced = false): SceneView => ({ state, action, openMomentIds, produced })
  if (scene.phase === 'failed') return view(scene.error || 'Needs attention', 'retry')
  if (scene.phase === 'queued') return view('Queued', 'wait')
  if (scene.phase === 'writing') return view('Writing the scene', 'wait')
  if (scene.phase === 'changing') return view('Changing', 'wait')
  if (scene.phase === 'replanning') return view('Re-planning', 'wait')
  if (scene.phase === 'producing') return view('Producing', 'wait')
  // Never report an empty or stale plan as ready to produce.
  if (!scene.moments.length) return view('Writing the scene', 'wait')
  if(scene.creativePlan && !scene.produced && (!scene.animation || scene.animation.inputKey!==scene.animationKey))return view('Ready to animate','produce')
  if (openMomentIds.length) return view(scene.animation && scene.animation.inputKey===scene.animationKey?'Animation ready':`Your turn · ${openMomentIds.length} to record`, 'record')
  if (scene.phase === 'produced' && scene.produced?.inputKey === scene.inputKey) return view('Produced', 'download', true)
  return view('Ready to produce', 'produce')
}

export const videoView = (project: Project) => {
  const video = project.video
  if (!video) return { action: 'make-video' as const, enabled: project.slides.length > 0, producedScenes: 0 }
  const producedScenes = video.scenes.filter(scene => sceneView(scene, video.settings.voice).produced).length
  const allProduced = video.scenes.length > 0 && video.scenes.length === project.slides.length && video.scenes.every((scene, index) => scene.slideId === project.slides[index]?.id) && producedScenes === video.scenes.length
  if(video.phase==='preparing')return {action:'produce-video' as const,enabled:false,producedScenes,state:'Preparing scenes'}
  if (video.phase === 'joining') return { action: 'produce-video' as const, enabled: false, producedScenes, state: 'Producing video' }
  if(!allProduced && video.scenes.some(s=>s.phase==='queued' || s.creativePlan && s.phase==='waiting' && !sceneView(s,video.settings.voice).produced && (!s.animation || s.animation.inputKey!==s.animationKey || !sceneView(s,video.settings.voice).openMomentIds.length)))return {action:'produce-video' as const,enabled:true,producedScenes,state:'Prepare scenes'}
  const current = allProduced && video.produced?.inputKey === video.inputKey
  return { action: current ? 'export' as const : 'produce-video' as const, enabled: allProduced, producedScenes }
}

export const projectViews = (project: Project) => {
  const voice = project.video?.settings.voice || { kind: 'record' as const }
  return {
    video: videoView(project),
    scenes: Object.fromEntries((project.video?.scenes || []).map(scene => [scene.id, sceneView(scene, voice)])),
    moments: Object.fromEntries((project.video?.scenes || []).flatMap(scene => scene.moments.map(moment => [momentViewKey(scene.id,moment.id), { id: moment.id, state: momentState(moment, voice) }]))),
  }
}
