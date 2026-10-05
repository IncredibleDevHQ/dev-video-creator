import type { ActivityLedger } from './activity'
import { transitionScene } from './autopilot'
import type { Project, Scene, Moment, Voice } from '../shared/model'
import { fingerprintOf } from './planning/fingerprint'
export const roleOf = (index: number, count: number) =>
  index === 0 ? 'title' : index === count - 1 ? 'ending' : 'body'
export const scenePlanKey = (project: Project, scene: Scene) => {
  const index = project.slides.findIndex((slide) => slide.id === scene.slideId)
  return fingerprintOf({
    harness: project.video!.settings.harness,
    slide: project.slides[index],
    title: project.title,
    role: roleOf(index, project.slides.length),
    presence: scene.presence || project.video!.settings.presence,
    instructions: scene.instructions || []
  })
}
export const recordingKeyOf = (
  moment: Pick<
    Moment,
    'lines' | 'camera' | 'start' | 'end' | 'plannedSeconds' | 'segments'
  >
) =>
  fingerprintOf({
    lines: moment.lines,
    camera: moment.camera,
    segments: moment.segments?.map((segment) => ({
      lines: segment.lines,
      camera: segment.camera,
      estimate: segment.estimate
    })),
    duration:
      moment.plannedSeconds ??
      Math.round((moment.end - moment.start) * 1000) / 1000
  })
export const momentAudioKey = (moment: Moment, voice: Voice) =>
  fingerprintOf({
    voice,
    lines: moment.lines,
    segments: moment.segments,
    take: moment.take?.id
  })
export const refreshVideoKeys = (project: Project) => {
  const video = project.video
  if (!video) return
  for (const scene of video.scenes) {
    for (const moment of scene.moments)
      moment.audioKey = momentAudioKey(moment, video.settings.voice)
    synchronizeClock(scene)
    scene.animationKey = fingerprintOf({
      branding: project.branding,
      plan: scene.planKey,
      creativePlan: scene.creativePlan,
      slide: project.slides.find((slide) => slide.id === scene.slideId)?.svg,
      moments: scene.moments.map((m) => ({
        id: m.id,
        lines: m.extension?.baseLines ?? m.lines,
        seconds:
          m.extension?.baseSeconds ||
          m.plannedSeconds ||
          m.segments?.reduce((n, s) => n + s.estimate, 0) ||
          m.end - m.start,
        camera: m.extension?.baseCamera ?? m.camera,
        layout: m.layout,
        overlay: m.overlay
      }))
    })
    scene.inputKey = fingerprintOf({
      branding: project.branding,
      plan: scene.planKey,
      creativePlan: scene.creativePlan,
      slide: project.slides.find((slide) => slide.id === scene.slideId)?.svg,
      voice: video.settings.voice,
      moments: scene.moments.map((moment) => ({
        id: moment.id,
        lines: moment.lines,
        start: moment.start,
        end: moment.end,
        camera: moment.camera,
        layout: moment.layout,
        overlay: moment.overlay,
        segments: moment.segments,
        media: moment.media?.inputKey,
        take: moment.take?.id,
        audio: moment.audio?.inputKey
      }))
    })
  }
  // The joined video is the scenes the creator made; leaving one out or
  // making another changes it.
  video.inputKey = fingerprintOf({
    scenes: video.scenes
      .filter((scene) => scene.phase !== 'idle')
      .map((scene) => ({
        id: scene.id,
        input: scene.inputKey
      })),
    transitions: video.transitions
  })
}
/**
 * One scene per wireframe, in the wireframes' order. `make` names the
 * wireframes whose new scenes are made; the rest start left out. Without it, a
 * new wireframe's scene is made unless the creator has left scenes out.
 */
export const reconcileVideo = (
  project: Project,
  ledger: ActivityLedger,
  make?: Set<string>
) => {
  const video = project.video
  if (!video) return
  const partial = video.scenes.some((scene) => scene.phase === 'idle')
  const previous = new Map(video.scenes.map((scene) => [scene.slideId, scene]))
  const oldOrder = [...previous.values()]
  const seams = new Map(
    oldOrder
      .slice(0, -1)
      .map((scene, index) => [
        `${scene.slideId}/${oldOrder[index + 1].slideId}`,
        video.transitions[index]
      ])
  )
  video.scenes = project.slides.map((slide) => {
    const scene: Scene = previous.get(slide.id) || {
      id: `scene-${slide.id}`,
      slideId: slide.id,
      phase: (make ? make.has(slide.id) : !partial) ? 'queued' : 'idle',
      presence: null,
      moments: [],
      inputKey: '',
      produced: null,
      error: null
    }
    const key = scenePlanKey(project, scene)
    if (scene.planKey !== key) {
      scene.planKey = key
      transitionScene(scene, 'invalidate', ledger)
      scene.produced = null
    }
    if (
      !slide.svg &&
      (scene.phase !== 'failed' ||
        scene.error !== 'Tell the studio what this slide is about')
    ) {
      scene.error = 'Tell the studio what this slide is about'
      transitionScene(scene, 'fail', ledger)
    }
    return scene
  })
  video.transitions = video.scenes
    .slice(0, -1)
    .map(
      (scene, index) =>
        seams.get(`${scene.slideId}/${video.scenes[index + 1].slideId}`) ||
        'none'
    )
  refreshVideoKeys(project)
}

export const synchronizeClock = (scene: Scene) => {
  let clock = 0
  for (const moment of scene.moments) {
    const duration =
      moment.audio?.inputKey === moment.audioKey
        ? moment.audio.duration
        : moment.take?.recordingKey === moment.recordingKey
          ? moment.take.duration
          : null
    const seconds =
      duration || moment.plannedSeconds || moment.end - moment.start
    moment.start = clock
    moment.end = Math.round((clock + seconds) * 1000) / 1000
    clock = moment.end
  }
}
