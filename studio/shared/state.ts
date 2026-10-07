import { momentViewKey } from './model'
import type {
  Moment,
  Project,
  Scene,
  SceneView,
  ProjectEvent,
  Voice
} from './model'

export const takeFits = (moment: Moment) =>
  Boolean(moment.take && moment.take.recordingKey === moment.recordingKey)
export const momentNeedsRecording = (moment: Moment, voice: Voice) =>
  moment.camera !== 'none' || voice.kind === 'record'
export const momentState = (
  moment: Moment,
  voice: Voice
): 'auto' | 'to record' | 'recorded' =>
  momentNeedsRecording(moment, voice)
    ? takeFits(moment)
      ? 'recorded'
      : 'to record'
    : 'auto'

export const sceneView = (
  scene: Scene,
  voice: Voice,
  events: ProjectEvent[] = []
): SceneView => {
  const openMomentIds = scene.moments
    .filter((moment) => momentState(moment, voice) === 'to record')
    .map((moment) => moment.id)
  const active = ['writing', 'changing', 'replanning', 'producing'].includes(
    scene.phase
  )
  const busy = active || scene.phase === 'queued'
  const needsAnimation = Boolean(
    scene.creativePlan && scene.animation?.inputKey !== scene.animationKey
  )
  const latest = events
    .filter((event) => event.kind === 'scene' && event.sceneId === scene.id)
    .at(-1)
  // Asked for while its wireframe was still drawn: in the video, waiting.
  const waiting = scene.phase === 'idle' && Boolean(scene.afterDrawing)
  const label = waiting
    ? 'Waiting for its wireframe'
    : active && latest && latest.activity !== 'complete'
      ? latest.message
      : scene.phase === 'producing'
        ? 'Producing the scene'
        : scene.phase === 'queued'
          ? 'Queued'
          : 'Planning the scene'
  const view = (
    state: string,
    action: SceneView['action'],
    produced = false
  ): SceneView => ({
    state,
    action,
    openMomentIds,
    produced,
    display: {
      active,
      busy,
      queued: scene.phase === 'queued',
      failed: scene.phase === 'failed',
      canRecord: ['waiting', 'produced'].includes(scene.phase),
      needsAnimation,
      label,
      inVideo: scene.phase !== 'idle' || waiting,
      actionLabel: waiting
        ? 'Starts once drawn'
        : action === 'make'
          ? 'Make this scene'
          : action === 'record'
            ? 'Record moment'
            : action === 'retry'
              ? 'Try again'
              : needsAnimation &&
                  !scene.moments.some((moment) => takeFits(moment))
                ? 'Prepare scene'
                : 'Finish scene',
      // A scene left out says nothing: its dimmed picture says it.
      railLabel: waiting
        ? label
        : scene.phase === 'idle'
          ? ''
          : scene.phase === 'failed'
            ? 'Needs attention'
            : active
              ? label
              : produced
                ? 'Complete'
                : openMomentIds.length
                  ? `${openMomentIds.length} ${
                      openMomentIds.length === 1 ? 'moment' : 'moments'
                    } to record`
                  : state
    }
  })
  if (waiting) return view('Starts once its wireframe is done', 'wait')
  if (scene.phase === 'idle') return view('Not in the video yet', 'make')
  if (scene.phase === 'failed')
    return view(scene.error || 'Needs attention', 'retry')
  if (scene.phase === 'queued') return view('Queued', 'wait')
  if (scene.phase === 'writing') return view('Writing the scene', 'wait')
  if (scene.phase === 'changing') return view('Changing', 'wait')
  if (scene.phase === 'replanning') return view('Re-planning', 'wait')
  if (scene.phase === 'producing') return view('Producing', 'wait')
  // Never report an empty or stale plan as ready to produce.
  if (!scene.moments.length) return view('Writing the scene', 'wait')
  if (
    scene.creativePlan &&
    !scene.produced &&
    (!scene.animation || scene.animation.inputKey !== scene.animationKey)
  )
    return view('Ready to animate', 'produce')
  if (openMomentIds.length) return view('Needs recording', 'record')
  if (scene.phase === 'produced' && scene.produced?.inputKey === scene.inputKey)
    return view('Complete', 'download', true)
  return view('Ready to produce', 'produce')
}

export const videoView = (project: Project) => {
  const video = project.video
  if (!video)
    return {
      action: 'make-video' as const,
      enabled: project.slides.length > 0,
      producedScenes: 0
    }
  // The video is the scenes the creator made; a scene left out is not in it.
  const made = video.scenes.filter((scene) => scene.phase !== 'idle')
  const madeScenes = made.length
  const producedScenes = made.filter(
    (scene) => sceneView(scene, video.settings.voice).produced
  ).length
  const allProduced =
    madeScenes > 0 &&
    video.scenes.length === project.slides.length &&
    video.scenes.every(
      (scene, index) => scene.slideId === project.slides[index]?.id
    ) &&
    producedScenes === madeScenes
  if (video.phase === 'preparing')
    return {
      action: 'produce-video' as const,
      enabled: false,
      producedScenes,
      madeScenes,
      state: 'Preparing scenes'
    }
  if (video.phase === 'joining')
    return {
      action: 'produce-video' as const,
      enabled: false,
      producedScenes,
      madeScenes,
      state: 'Producing video'
    }
  if (
    !allProduced &&
    video.scenes.some(
      (s) =>
        s.phase === 'queued' ||
        (s.creativePlan &&
          s.phase === 'waiting' &&
          !sceneView(s, video.settings.voice).produced &&
          (!s.animation ||
            s.animation.inputKey !== s.animationKey ||
            !sceneView(s, video.settings.voice).openMomentIds.length))
    )
  )
    return {
      action: 'produce-video' as const,
      enabled: true,
      producedScenes,
      madeScenes,
      state: 'Prepare scenes'
    }
  const current = allProduced && video.produced?.inputKey === video.inputKey
  return {
    action: current ? ('export' as const) : ('produce-video' as const),
    enabled: allProduced,
    producedScenes,
    madeScenes
  }
}

export const projectViews = (project: Project, events: ProjectEvent[] = []) => {
  const voice = project.video?.settings.voice || { kind: 'record' as const }
  return {
    video: videoView(project),
    scenes: Object.fromEntries(
      (project.video?.scenes || []).map((scene) => [
        scene.id,
        sceneView(scene, voice, events)
      ])
    ),
    moments: Object.fromEntries(
      (project.video?.scenes || []).flatMap((scene) =>
        scene.moments.map((moment) => [
          momentViewKey(scene.id, moment.id),
          { id: moment.id, state: momentState(moment, voice) }
        ])
      )
    )
  }
}

// Display contracts are computed with the engine snapshot. The shared fallback
// supports older saved snapshots; app components do not carry their own rules.
export const sceneDisplay = (
  snapshot: import('./api').Snapshot,
  scene: Scene
) => {
  const saved = snapshot.views?.scenes[scene.id]?.display
  if (
    saved &&
    typeof saved.canRecord === 'boolean' &&
    typeof saved.queued === 'boolean' &&
    typeof saved.failed === 'boolean'
  )
    return saved
  return {
    ...sceneView(scene, snapshot.project.video!.settings.voice, snapshot.events)
      .display!,
    ...saved
  }
}

export const videoDisplay = (
  snapshot: import('./api').Snapshot
): import('./model').VideoDisplay => {
  if (snapshot.views?.video.display) return snapshot.views.video.display
  const video = snapshot.project.video
  if (!video)
    return { label: '', active: false, actionLabel: 'Make the video →' }
  const views =
    snapshot.views || projectViews(snapshot.project, snapshot.events)
  const active =
    video.phase === 'preparing' ||
    video.phase === 'joining' ||
    video.scenes.some((scene) => sceneDisplay(snapshot, scene).active)
  const made = video.scenes.filter((scene) => scene.phase !== 'idle')
  const scenesReady =
    made.length > 0 && made.every((scene) => views.scenes[scene.id]?.produced)
  const needsRecording = video.scenes.some(
    (scene) => views.scenes[scene.id]?.openMomentIds.length
  )
  const label = active
    ? 'Processing'
    : video.phase === 'failed' ||
        video.scenes.some((scene) => scene.phase === 'failed')
      ? 'Needs attention'
      : !made.length
        ? 'No scenes made'
        : views.video.action === 'export'
          ? 'Ready'
          : video.scenes.some((scene) => scene.phase === 'queued')
            ? 'Waiting'
            : scenesReady
              ? 'Ready to assemble'
              : needsRecording
                ? 'Needs recording'
                : 'Ready to prepare'
  // One name for finishing the video, whatever step is next (review 5: the
  // button read "Prepare scenes", then "Produce video · 0/1").
  const count = `${views.video.producedScenes}/${views.video.madeScenes ?? made.length}`
  const actionLabel =
    views.video.state === 'Preparing scenes'
      ? 'Preparing scenes…'
      : views.video.state === 'Producing video'
        ? 'Producing the video…'
        : views.video.action === 'export'
          ? 'Export MP4'
          : !made.length
            ? 'Finish the video'
            : `Finish the video · ${count}`
  return { label, active, actionLabel }
}
export const presentationDisplay = (
  snapshot: Pick<import('./api').Snapshot, 'status' | 'stopping' | 'views'>
): import('./model').StatusDisplay =>
  snapshot.views?.presentation || {
    label:
      snapshot.status === 'draft' || snapshot.status === 'reading'
        ? 'Not started'
        : snapshot.status === 'ready'
          ? 'Ready'
          : snapshot.status === 'failed'
            ? 'Needs attention'
            : snapshot.stopping
              ? 'Stopping'
              : 'Processing',
    active: snapshot.status === 'building' && !snapshot.stopping
  }

type DeckState = {
  status: string
  plannedSlides?: number
  plan?: Array<{ id: string }>
  kept?: number[]
  project: Pick<Project, 'slides' | 'video'>
}
/**
 * The wireframes that are done: every one once the deck is ready; while it
 * is drawn, the pages its checks kept.
 */
export const donePages = (snapshot: DeckState) =>
  new Set(
    snapshot.status === 'building' || snapshot.status === 'failed'
      ? [
          ...(snapshot.kept || []).flatMap((index) =>
            snapshot.plan?.[index] ? [snapshot.plan[index].id] : []
          ),
          ...snapshot.project.slides
            .filter((slide) => slide.svg && !slide.draft)
            .map((slide) => slide.id)
        ]
      : snapshot.project.slides
          .filter((slide) => slide.svg)
          .map((slide) => slide.id)
  )
/**
 * Whether a video can be made: the deck ready, or, while it is still drawn
 * (or stopped), every planned page with at least a first draft, so each
 * scene keeps its place. Scenes for pages not done yet wait for them.
 */
export const videoOpens = (snapshot: DeckState) => {
  const { slides } = snapshot.project
  if (snapshot.project.video) return true
  if (!slides.length || slides.some((slide) => !slide.svg)) return false
  if (snapshot.status === 'ready') return true
  return (
    (snapshot.status === 'building' || snapshot.status === 'failed') &&
    !!snapshot.plannedSlides &&
    slides.length >= snapshot.plannedSlides
  )
}
