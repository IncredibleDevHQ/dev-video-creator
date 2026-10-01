import { sceneDisplay } from '../shared/state'
import type { Snapshot } from '../shared/api'
import type { Scene } from '../shared/model'
import { escape } from './ui'
export const sceneActivity = (snapshot: Snapshot, scene: Scene) => {
  const events = snapshot.events.filter(
    (event) => event.kind === 'scene' && event.sceneId === scene.id
  )
  const { active, label } = sceneDisplay(snapshot, scene)
  // Older notebooks predate typed activity events; recognise only known stage labels.
  const lastStep = [...events]
    .reverse()
    .find(
      (event) =>
        event.activity === 'processing' ||
        (!event.activity &&
          /^(Writing the scene|Preparing the scene artwork|Preparing the video brief|Planning the scene|Writing the spoken lines|Creating the scene preview|Preparing voice ·|Building the scene|Rendering the scene|Saving the scene|Producing$)/.test(
            event.message
          ))
    )
  return {
    active,
    label,
    stopped: scene.phase === 'failed' ? lastStep : undefined,
    events: scene.phase === 'queued' ? [] : events
  }
}
const legacyStages = [
  { label: 'Scene artwork', match: /Preparing the scene artwork/ },
  { label: 'Video brief', match: /Preparing the video brief/ },
  { label: 'Creative plan', match: /Planning the scene/ },
  {
    label: 'Spoken lines',
    match: /Writing the spoken lines|Scene written|Transcript ready/
  },
  { label: 'Voice', match: /Preparing voice|^Producing$/ },
  {
    label: 'Video composition',
    match: /Building the scene|Creating the scene preview/
  },
  { label: 'Render', match: /Rendering the scene/ },
  { label: 'Save video', match: /Saving the scene|^Produced$/ }
]
export const sceneActivityRail = (
  snapshot: Snapshot,
  scene: Scene,
  connected: boolean
) => {
  const { active, events } = sceneActivity(snapshot, scene)
  const produced = !!snapshot.views?.scenes[scene.id]?.produced
  const animationReady = Boolean(
    scene.animation && scene.animation.inputKey === scene.animationKey
  )
  const needsRecording =
    scene.moments.some((moment) => moment.camera !== 'none') ||
    snapshot.project.video?.settings.voice.kind === 'record'
  const recordings = { label: 'Your recordings', match: /moments? recorded/ }
  const stages =
    scene.animation ||
    (scene.creativePlan && !scene.produced) ||
    events.some((e) => e.message === 'Rendering the animation')
      ? [
          ...legacyStages.slice(0, 4),
          { label: 'Animation', match: /Building the scene/ },
          {
            label: 'Animation render',
            match: /Rendering the animation|Animation ready/
          },
          ...(needsRecording ? [recordings] : []),
          { label: 'Voice', match: /Preparing voice/ },
          { label: 'Final render', match: /Rendering the scene/ },
          legacyStages[7]
        ]
      : needsRecording
        ? [...legacyStages.slice(0, 4), recordings, ...legacyStages.slice(4)]
        : legacyStages
  const progress = snapshot.sceneProgress?.[scene.id]
  const reached = stages.map((stage) =>
    events.filter((event) => stage.match.test(event.message)).at(-1)
  )
  // The latest run determines the frontier; a retry revisits that row rather
  // than appending another run of steps. Historical errors remain in History.
  const latest = [...events]
    .reverse()
    .find((event) => stages.some((stage) => stage.match.test(event.message)))
  let frontier = produced
    ? stages.length - 1
    : Math.max(
        0,
        stages.findIndex((stage) => latest && stage.match.test(latest.message))
      )
  const recordingEvent = events
    .filter((event) => recordings.match.test(event.message))
    .at(-1)
  const openRecordings = snapshot.views?.scenes[scene.id]?.openMomentIds.length
  const recordingSaved =
    needsRecording && !!recordingEvent && openRecordings === 0
  const waitingForRecordings =
    !produced &&
    !active &&
    scene.phase !== 'failed' &&
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
        : scene.phase === 'failed'
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
  return `<div class="scene-activity"><p class="activity-intro">${intro}</p><ol class="activity-log" aria-label="Scene activity">${stages
    .slice(0, frontier + 1)
    .map((step, index) => {
      const awaiting =
        waitingForRecordings &&
        step.label === 'Your recordings' &&
        !!openRecordings
      const state = awaiting
        ? 'awaiting'
        : produced ||
            (recordingSaved && step.label === 'Your recordings') ||
            (animationReady && !active && index <= 5) ||
            index < frontier ||
            (!active && scene.phase !== 'failed' && index === 3)
          ? 'completed'
          : scene.phase === 'failed' && index === frontier
            ? 'stopped'
            : live && index === frontier
              ? 'current'
              : ''
      const event = reached[index]
      const detail =
        progress &&
        index === frontier &&
        ((state === 'current' && progress.active) || state === 'stopped') &&
        ((progress.stage === 'composition' &&
          ['Animation', 'Video composition'].includes(step.label)) ||
          (progress.stage === 'planning' &&
            ['Creative plan', 'Spoken lines'].includes(step.label)))
          ? `<span class="activity-detail">${escape(
              progress.label
            )}</span><time datetime="${escape(
              progress.updatedAt
            )}">Last update ${escape(
              new Date(progress.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })
            )}</time>`
          : ''
      return `<li class="${state}"><span class="activity-marker" aria-hidden="true">${
        state === 'completed' ? '✓' : ''
      }</span><div><p>${step.label}</p>${
        state === 'stopped'
          ? '<span class="activity-stopped-label">Stalled</span>'
          : ''
      }${
        awaiting
          ? `<span class="activity-detail">${openRecordings} ${
              openRecordings === 1 ? 'moment needs' : 'moments need'
            } your recording</span>`
          : detail ||
            (event
              ? `<time datetime="${escape(event.time)}">${escape(
                  new Date(event.time).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                )}</time>`
              : '')
      }</div></li>`
    })
    .join('')}</ol></div>`
}
