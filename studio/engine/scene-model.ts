import { readyCapture } from '../shared/capture'
import { inCut } from '../shared/orchestration'
import type { ActivityLedger } from './activity'
import { transitionScene } from './autopilot'
import type { Project, Scene, Moment, Slide, Voice } from '../shared/model'
import { pageContent } from '../shared/content-map'
import { fingerprintOf } from './planning/fingerprint'
import { narrativeAt, plannedPages } from '../shared/narratives'
import { donePages } from '../shared/state'
import { orchestrate, presenceAt } from '../shared/orchestration'
export const roleOf = (index: number, count: number) =>
  index === 0 ? 'title' : index === count - 1 ? 'ending' : 'body'
/**
 * A scene's role in the video's cut: the title page opens, and the last
 * scene in the cut closes, so it never points at a page left out.
 */
export const sceneRole = (project: Project, index: number) => {
  const scenes = project.video?.scenes || []
  const inVideo = project.slides.map((slide) =>
    inCut(scenes.find((scene) => scene.slideId === slide.id))
  )
  if (index === 0 || !inVideo.some(Boolean))
    return roleOf(index, project.slides.length)
  return index === inVideo.lastIndexOf(true) ? 'ending' : 'body'
}
export const scenePlanKey = (project: Project, scene: Scene) => {
  const index = project.slides.findIndex((slide) => slide.id === scene.slideId)
  // By the slide's place: while the video reconciles, its scene list is
  // still being rebuilt, and scenes follow the slides one to one.
  const shape = narrativeAt(
    project.video!.settings,
    index,
    project.slides.length,
    scene.beats,
    plannedPages(project)
  )
  // A page leaving its draft for its final is the same page; a demo counts
  // once it is captured, not while it is planned or recorded.
  const {
    draft: _draft,
    capture,
    ...rest
  } = pageContent(project.slides[index] || ({} as Slide))
  const used = readyCapture(capture)
  const slide = used ? { ...rest, capture: used.objectKey } : rest
  return fingerprintOf({
    harness: project.video!.settings.harness,
    slide: project.slides[index] ? slide : undefined,
    title: project.title,
    role: sceneRole(project, index),
    // With a narrative, the direction gives each scene its presence.
    presence: presenceAt(
      project.video!.settings,
      index,
      project.slides.length,
      scene.presence
    ),
    instructions: scene.instructions || [],
    // Absent without a narrative, so those plans keep their fingerprint.
    ...(shape
      ? {
          narrative: shape.narrative.id,
          direction: shape.settings,
          beats: shape.beats.map((plan) => plan.beat.id),
          shot: orchestrate(project)?.[index]?.shot.id
        }
      : {})
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
    // A scene left out waits for its page quietly: failing it would queue
    // it the moment the page is drawn (a page from a note, say).
    if (
      !slide.svg &&
      scene.phase !== 'idle' &&
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

/**
 * Scenes asked for while their wireframe was still drawn start once it is
 * done. True when one started, for the caller to schedule the planning.
 */
export const startWaitingScenes = (
  snapshot: Parameters<typeof donePages>[0] & {
    project: Project
  },
  ledger: ActivityLedger
) => {
  const video = snapshot.project.video
  if (!video) return false
  const done = donePages(snapshot)
  let started = false
  for (const scene of video.scenes)
    if (
      scene.afterDrawing &&
      scene.phase === 'idle' &&
      done.has(scene.slideId)
    ) {
      delete scene.afterDrawing
      transitionScene(scene, 'make', ledger)
      started = true
    }
  return started
}
