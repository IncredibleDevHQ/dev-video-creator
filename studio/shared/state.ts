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
  const label =
    active && latest && latest.activity !== 'complete'
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
      actionLabel:
        action === 'record'
          ? 'Record moment'
          : action === 'retry'
            ? 'Try again'
            : needsAnimation &&
                !scene.moments.some((moment) => takeFits(moment))
              ? 'Prepare scene'
              : 'Finish scene',
      railLabel:
        scene.phase === 'failed'
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
  const producedScenes = video.scenes.filter(
    (scene) => sceneView(scene, video.settings.voice).produced
  ).length
  const allProduced =
    video.scenes.length > 0 &&
    video.scenes.length === project.slides.length &&
    video.scenes.every(
      (scene, index) => scene.slideId === project.slides[index]?.id
    ) &&
    producedScenes === video.scenes.length
  if (video.phase === 'preparing')
    return {
      action: 'produce-video' as const,
      enabled: false,
      producedScenes,
      state: 'Preparing scenes'
    }
  if (video.phase === 'joining')
    return {
      action: 'produce-video' as const,
      enabled: false,
      producedScenes,
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
      state: 'Prepare scenes'
    }
  const current = allProduced && video.produced?.inputKey === video.inputKey
  return {
    action: current ? ('export' as const) : ('produce-video' as const),
    enabled: allProduced,
    producedScenes
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
  const scenesReady =
    video.scenes.length > 0 &&
    video.scenes.every((scene) => views.scenes[scene.id]?.produced)
  const needsRecording = video.scenes.some(
    (scene) => views.scenes[scene.id]?.openMomentIds.length
  )
  const label = active
    ? 'Processing'
    : video.phase === 'failed' ||
        video.scenes.some((scene) => scene.phase === 'failed')
      ? 'Needs attention'
      : views.video.action === 'export'
        ? 'Ready'
        : video.scenes.some((scene) => scene.phase === 'queued')
          ? 'Waiting'
          : scenesReady
            ? 'Ready to assemble'
            : needsRecording
              ? 'Needs recording'
              : 'Ready to prepare'
  const actionLabel =
    views.video.state ||
    (views.video.action === 'export'
      ? 'Export MP4'
      : `Produce video · ${views.video.producedScenes}/${video.scenes.length}`)
  return { label, active, actionLabel }
}
export const presentationDisplay = (
  snapshot: Pick<import('./api').Snapshot, 'status' | 'stopping' | 'views'>
): import('./model').StatusDisplay =>
  snapshot.views?.presentation || {
    label:
      snapshot.status === 'ready'
        ? 'Ready'
        : snapshot.status === 'failed'
          ? 'Needs attention'
          : snapshot.stopping
            ? 'Stopping'
            : 'Processing',
    active: snapshot.status === 'building' && !snapshot.stopping
  }
