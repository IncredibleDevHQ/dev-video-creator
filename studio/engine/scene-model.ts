import type { Project, Scene, Moment, Voice } from '../shared/model'
import { fingerprintOf } from './planning/fingerprint'
export const roleOf = (index: number, count: number) => index === 0 ? 'title' : index === count - 1 ? 'ending' : 'body'
export const scenePlanKey = (project: Project, scene: Scene) => {
  const index = project.slides.findIndex(slide => slide.id === scene.slideId)
  return fingerprintOf({ harness: project.video!.settings.harness, slide: project.slides[index], title: project.title, role: roleOf(index, project.slides.length), presence: scene.presence || project.video!.settings.presence, instructions: scene.instructions || [] })
}
export const recordingKeyOf = (moment: Pick<Moment, 'lines' | 'camera' | 'start' | 'end' | 'plannedSeconds' | 'segments'>) => fingerprintOf({ lines: moment.lines, camera: moment.camera, segments: moment.segments?.map(segment => ({ lines: segment.lines, camera: segment.camera, estimate: segment.estimate })), duration: moment.plannedSeconds ?? Math.round((moment.end - moment.start)*1000)/1000 })
export const momentAudioKey = (moment: Moment, voice: Voice) => fingerprintOf({ voice, lines: moment.lines, segments: moment.segments, take: moment.take?.id })
export const refreshVideoKeys = (project: Project) => {
  const video = project.video
  if (!video) return
  for (const scene of video.scenes) {
    for (const moment of scene.moments) moment.audioKey = momentAudioKey(moment,video.settings.voice)
    synchronizeClock(scene)
    scene.inputKey = fingerprintOf({ branding: project.branding, plan: scene.planKey, creativePlan: scene.creativePlan, slide: project.slides.find(slide => slide.id === scene.slideId)?.svg, voice: video.settings.voice, moments: scene.moments.map(moment => ({ id: moment.id, lines: moment.lines, start: moment.start, end: moment.end, camera: moment.camera, layout: moment.layout, overlay: moment.overlay, segments: moment.segments, media: moment.media?.inputKey, take: moment.take?.id, audio: moment.audio?.inputKey })) })
  }
  video.inputKey = fingerprintOf({ scenes: video.scenes.map(scene => ({ id: scene.id, input: scene.inputKey })), transitions: video.transitions })
}
export const reconcileVideo = (project: Project) => {
  const video = project.video
  if (!video) return
  const previous = new Map(video.scenes.map(scene => [scene.slideId, scene]))
  const oldOrder = [...previous.values()]
  const seams = new Map(oldOrder.slice(0,-1).map((scene,index) => [`${scene.slideId}/${oldOrder[index+1].slideId}`, video.transitions[index]]))
  video.scenes = project.slides.map(slide => {
    const scene: Scene = previous.get(slide.id) || { id: `scene-${slide.id}`, slideId: slide.id, phase: 'queued', presence: null, moments: [], inputKey: '', produced: null, error: null }
    const key = scenePlanKey(project, scene)
    if (scene.planKey !== key) { scene.planKey = key; scene.phase = 'queued'; scene.produced = null; scene.error = null }
    if (!slide.svg) { scene.phase = 'failed'; scene.error = 'Tell the studio what this slide is about' }
    return scene
  })
  video.transitions = video.scenes.slice(0,-1).map((scene,index) => seams.get(`${scene.slideId}/${video.scenes[index+1].slideId}`) || 'none')
  refreshVideoKeys(project)
}

export const synchronizeClock = (scene: Scene) => {
  let clock = 0
  for (const moment of scene.moments) {
    const duration = moment.audio?.inputKey === moment.audioKey ? moment.audio.duration : moment.take?.recordingKey === moment.recordingKey ? moment.take.duration : null
    const seconds = duration || moment.plannedSeconds || moment.end-moment.start
    moment.start = clock; moment.end = Math.round((clock+seconds)*1000)/1000; clock = moment.end
  }
}
