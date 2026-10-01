import { sceneDisplay, sceneView } from './state'
import type { Snapshot } from './api'
import type { Scene } from './model'
export const sceneActivity = (snapshot: Snapshot, scene: Scene) => {
  const events = snapshot.events.filter(
    (event) => event.kind === 'scene' && event.sceneId === scene.id
  )
  const { active, label } = sceneDisplay(snapshot, scene)
  const lastStep = [...events]
    .reverse()
    .find((event) => event.activity === 'processing' && event.stage)
  return {
    active,
    label,
    stopped: sceneDisplay(snapshot, scene).failed ? lastStep : undefined,
    events: sceneDisplay(snapshot, scene).queued ? [] : events
  }
}
const productionStages = [
  { label: 'Scene artwork', stage: 'artwork' },
  { label: 'Video brief', stage: 'brief' },
  { label: 'Creative plan', stage: 'planning' },
  { label: 'Spoken lines', stage: 'script' },
  { label: 'Voice', stage: 'voice' },
  { label: 'Video composition', stage: 'composition' },
  { label: 'Render', stage: 'render' },
  { label: 'Save video', stage: 'save' }
] as const
export const sceneActivityDisplay = (
  snapshot: Snapshot,
  scene: Scene,
  connected: boolean
) => {
  const { active, events } = sceneActivity(snapshot, scene)
  const view =
    snapshot.views?.scenes[scene.id] ||
    sceneView(scene, snapshot.project.video!.settings.voice, snapshot.events)
  const produced = view.produced
  const animationReady = Boolean(
    scene.animation && scene.animation.inputKey === scene.animationKey
  )
  const needsRecording =
    scene.moments.some((moment) => moment.camera !== 'none') ||
    snapshot.project.video?.settings.voice.kind === 'record'
  const recordings = { label: 'Your recordings', stage: 'recordings' }
  const stages =
    scene.animation ||
    (scene.creativePlan && !scene.produced) ||
    events.some((e) => e.stage === 'animation-render')
      ? [
          ...productionStages.slice(0, 4),
          { label: 'Animation', stage: 'composition' },
          {
            label: 'Animation render',
            stage: 'animation-render'
          },
          ...(needsRecording ? [recordings] : []),
          { label: 'Voice', stage: 'voice' },
          { label: 'Final render', stage: 'render' },
          productionStages[7]
        ]
      : needsRecording
        ? [
            ...productionStages.slice(0, 4),
            recordings,
            ...productionStages.slice(4)
          ]
        : productionStages
  const progress = snapshot.sceneProgress?.[scene.id]
  const reached = stages.map((stage) =>
    events.filter((event) => stage.stage === event.stage).at(-1)
  )
  // The latest run determines the frontier; a retry revisits that row rather
  // than appending another run of steps. Historical errors remain in History.
  const latest = [...events]
    .reverse()
    .find((event) => stages.some((stage) => stage.stage === event.stage))
  const savedFrontier = animationReady ? 5 : scene.moments.length ? 3 : 0
  let frontier = produced
    ? stages.length - 1
    : Math.max(
        latest ? 0 : savedFrontier,
        stages.findIndex((stage) => latest && stage.stage === latest.stage)
      )
  const recordingEvent = events
    .filter((event) => event.stage === recordings.stage)
    .at(-1)
  const openRecordings = view.openMomentIds.length
  const recordingSaved =
    needsRecording && !!recordingEvent && openRecordings === 0
  const waitingForRecordings =
    !produced &&
    !active &&
    !sceneDisplay(snapshot, scene).failed &&
    animationReady &&
    needsRecording
  if (waitingForRecordings)
    frontier = stages.findIndex((stage) => stage.label === 'Your recordings')
  const live = active && connected && !snapshot.readOnly
  const intro = snapshot.readOnly
    ? 'Saved activity. No generation is running in this copy.'
    : produced
      ? 'Video ready'
      : !connected
        ? 'Reconnecting to live activity…'
        : sceneDisplay(snapshot, scene).failed
          ? 'Paused at the step below'
          : active
            ? 'Creating your scene'
            : recordingSaved
              ? 'Recording saved · ready to finish this scene'
              : animationReady
                ? openRecordings
                  ? 'Animation ready · add your recordings when you’re ready'
                  : 'Animation ready · ready to finish this scene'
                : scene.moments.length
                  ? 'Plan ready'
                  : 'Waiting to start'
  return {
    intro,
    progress,
    frontier,
    rows: stages.slice(0, frontier + 1).map((step, index) => {
      const awaiting =
        waitingForRecordings && step.stage === 'recordings' && !!openRecordings
      const state = awaiting
        ? 'awaiting'
        : produced ||
            (recordingSaved && step.stage === 'recordings') ||
            (animationReady && !active && index <= 5) ||
            index < frontier ||
            (!active && !sceneDisplay(snapshot, scene).failed && index === 3)
          ? 'completed'
          : sceneDisplay(snapshot, scene).failed && index === frontier
            ? 'stopped'
            : live && index === frontier
              ? 'current'
              : ''
      const event = reached[index]
      return { ...step, state, awaiting, event, openRecordings }
    })
  }
}
