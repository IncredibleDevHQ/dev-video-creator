const cameraToggle = (on: boolean) =>
  `<button type="button" class="camera-toggle ${
    on ? 'is-on' : ''
  }" data-action="${
    on ? 'practice-camera-off' : 'practice-camera'
  }" aria-label="${
    on ? 'Turn off camera' : 'Turn on camera'
  }" aria-pressed="${on}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
<rect x="3" y="6" width="12" height="12" rx="2"/>
<path d="m15 10 6-3v10l-6-3z"/>${on ? '' : '<path d="m2 2 20 20"/>'}</svg>
<span>${on ? 'Camera on' : 'Camera off'}</span>
</button>`
import { dueCount } from './campaign-view'
import { transcriptWords } from './transcript-follow'
import { standInControls } from './stand-in-playback'
import { layeredControls } from './layered-playback'
import { recordingHandoff } from './recording-handoff'
import { sceneCheck } from './scene-check'
import { presenterLayoutStyle } from '../shared/presenter-layout'
import { recordingPlan } from './recording-target'
import {
  countdownOverlay,
  recordActions,
  recordLabel,
  recordLight,
  recordPlace,
  recordTitle
} from './record-view'
import { cameraCue, microphoneCue } from './camera-cue'
import { gear } from './camera-settings'
import {
  momentNeedsRecording,
  sceneDisplay,
  videoDisplay
} from '../shared/state'
import { sceneActivity, sceneActivityRail } from './scene-activity'
import type { Branding, StudioSettings } from '../shared/settings'
import { momentViewKey } from '../shared/model'
import { videoOpens } from '../shared/state'
import type { Moment, Scene, Slide, VideoSettings } from '../shared/model'
import { voiceRows } from './voice-choice'
import type { Snapshot } from '../shared/api'
import type { Recording } from './recording'
import { cameraAt } from '../shared/camera-window'
import { sceneOverlay } from './scene-overlay'
import { escape, button } from './ui'
import { agentNames } from './agent-setup'
import { wireframeStatus } from './wireframe-copy'
import { sceneChoice } from './scene-link'
import { sceneShotChip } from './shot-picker'
import {
  onCameraChoice,
  sceneBeatChip,
  takePickedTemplate,
  templatePicker
} from './template-picker'
const standIn = new URL('./assets/presenter.jpg', import.meta.url).href
/**
 * What a moment is, one way everywhere (review 6: the strip said Voice and
 * Record, the transcript Graphics only and You full screen): a voice over
 * the wireframe, or you on camera; then whether it waits for a recording.
 */
const momentKind = (moment: Moment, long = false) =>
  moment.camera === 'none'
    ? long
      ? 'Voice over the wireframe'
      : 'Voice over'
    : long
      ? `You on camera, ${moment.layout === 'full-screen' ? 'full screen' : moment.layout === 'beside-slide' ? 'beside the wireframe' : 'in the corner'}`
      : 'You on camera'
const momentWords = (moment: Moment, state?: string) =>
  `${momentKind(moment)}${
    state === 'to record'
      ? ' · to record'
      : state === 'recorded'
        ? moment.take?.number
          ? ` · take ${moment.take.number}`
          : ' · recorded'
        : ''
  }`
/** A stop names the agent that stopped: "Kimi ran out of time…". */
const agentWords = (snapshot: Snapshot, message?: string | null) => {
  const words = wireframeStatus(message || '')
  return snapshot.project.harness
    ? words.replace(
        /^The agent\b/,
        agentNames[snapshot.project.harness.adapter]
      )
    : words
}
const sceneRailStatus = (snapshot: Snapshot, scene: Scene) => {
  const view = snapshot.views?.scenes[scene.id],
    activity = sceneActivity(snapshot, scene)
  const label = sceneDisplay(snapshot, scene).railLabel
  const open = view?.openMomentIds || []
  if (
    open.length &&
    !activity.active &&
    !sceneDisplay(snapshot, scene).failed
  ) {
    const icon = scene.moments.some(
      (moment) => moment.camera !== 'none' && open.includes(moment.id)
    )
      ? cameraCue('full')
      : microphoneCue
    return `<span class="scene-state scene-recording-needed">${icon}<span>${escape(
      label
    )}</span>
</span>`
  }
  return label ? `<span class="scene-state">${escape(label)}</span>` : ''
}
export const videoHeader = (snapshot: Snapshot) => {
  const video = snapshot.project.video
  if (!video)
    return button(
      'Make the video →',
      'make-video',
      true,
      // The same test as the Wireframe header's (review 6).
      !videoOpens(snapshot)
    )
  const view = snapshot.views?.video
  return `${
    video.produced
      ? button(
          dueCount(snapshot)
            ? `Release · ${dueCount(snapshot)} due`
            : 'Release',
          'release-dialog'
        )
      : ''
  }${button(videoDisplay(snapshot).actionLabel, 'produce-video', true, !view?.enabled)}`
}
export const videoScreen = (
  snapshot: Snapshot,
  selected: number,
  momentIndex: number,
  second: number,
  practicing: boolean,
  capture: Recording,
  practiceStream: MediaStream | null = null,
  wholeVideo = false,
  connected = true,
  /** Practising the whole scene rather than one moment. */
  practiceScene = false
) => {
  const { project, views } = snapshot
  const video = project.video
  if (!video)
    return `<section class="empty">
<h2>Ready to make your video?</h2>${button(
      'Make the video →',
      'make-video',
      true,
      // The same test as the Wireframe header's (review 6).
      !videoOpens(snapshot)
    )}</section>`
  const scene = video.scenes[selected]
  const slide = project.slides[selected]
  if (!scene)
    return '<section class="empty">Add a wireframe to begin.</section>'
  const view = views?.scenes[scene.id]
  const moment = scene.moments[momentIndex] || scene.moments[0]
  // Practising the whole scene, the stage is drawn once for every moment:
  // the presenter stays on it and fades in and out with the camera, so one
  // moment following another rebuilds nothing.
  const wholeScene = practicing && practiceScene && scene.moments.length > 1
  // Getting ready to record, the camera shows if any moment to record uses
  // it, so the creator can check their framing before the countdown.
  const framing = ['preparing', 'ready', 'countdown'].includes(capture.phase)
    ? capture.moments.find((entry) => entry.camera !== 'none')
    : undefined
  const presenter = wholeScene
    ? scene.moments.find((entry) => entry.camera !== 'none')
    : (framing ?? (moment?.camera !== 'none' ? moment : undefined))
  const showVideo =
    wholeVideo &&
    views?.video.action === 'export' &&
    video.produced?.clock?.length &&
    !practicing &&
    capture.phase === 'idle'
  const display = sceneDisplay(snapshot, scene)
  const selectedActive = display.active
  const activity = !connected
    ? 'Connection lost · live processing status is unavailable. Reconnecting…'
    : snapshot.readOnly
      ? 'Saved review · generation is not running in this copy.'
      : selectedActive
        ? `Processing scene ${selected + 1} · no action needed.`
        : sceneDisplay(snapshot, scene).queued &&
            !video.scenes.some((entry) => sceneDisplay(snapshot, entry).active)
          ? 'No scene is processing right now. Remaining scenes have not started.'
          : ''
  const activeLabel = display.label
  const showActivity =
    sceneActivity(snapshot, scene).events.length > 0 ||
    display.busy ||
    sceneDisplay(snapshot, scene).failed
  const record = recordLabel(
    scene,
    recordingPlan(scene.moments, view?.openMomentIds || [], momentIndex, {
      whole: practiceScene,
      here: false,
      needs: (entry) => momentNeedsRecording(entry, video.settings.voice)
    })
  )
  const mainLabel =
    view?.action === 'record'
      ? record
      : display.actionLabel +
        (display.actionLabel === 'Finish scene' ? ` ${selected + 1}` : '')
  const busy = display.busy
  // A left-out scene offers only Make this scene (review 6: its other
  // controls failed).
  const leftOut = sceneDisplay(snapshot, scene).inVideo === false
  const reply = [...snapshot.events]
    .reverse()
    .find(
      (event) =>
        event.kind === 'chat' &&
        event.anchor?.stage === 'video' &&
        event.anchor.sceneId === scene.id &&
        event.anchor.momentId === moment?.id
    )
  const reviewing =
    ['reviewing', 'uploading'].includes(capture.phase) && !!capture.url
  const focused = practicing || capture.phase !== 'idle'
  const cameraTake =
    reviewing && capture.moments.some((entry) => entry.camera !== 'none')
  // The scenes in the video first, in order; the left-out ones after them.
  const inVideo = video.scenes.map(
    (entry) => sceneDisplay(snapshot, entry).inVideo !== false
  )
  const inScenes = video.scenes.filter((_, index) => inVideo[index])
  const inCount = inScenes.length
  const lastIn = inVideo.lastIndexOf(true)
  const railOrder = [
    ...video.scenes.map((_, index) => index).filter((index) => inVideo[index]),
    ...video.scenes.map((_, index) => index).filter((index) => !inVideo[index])
  ]
  return `<section class="video-workspace ${focused ? 'is-focused' : ''}" data-capture-phase="${capture.phase}">
<aside class="rail scene-rail" ${focused ? 'inert' : ''} aria-label="Scenes">
<div class="rail-heading">
<strong>Scenes</strong>
<small>${
    // How many are in the video, and how long they run (review 6: "15
    // scenes" when one was in it).
    inCount === video.scenes.length
      ? `${video.scenes.length} ${video.scenes.length === 1 ? 'scene' : 'scenes'}`
      : `${inCount} of ${video.scenes.length} in the video`
  }${
    inScenes.length && inScenes.every((entry) => entry.moments.length)
      ? ` · ${Math.round(
          inScenes.reduce(
            (total, entry) => total + (entry.moments.at(-1)?.end || 0),
            0
          )
        )}s`
      : ''
  }</small>
</div>${railOrder
    .map((index, at) => {
      const entry = video.scenes[index]
      // A scene left out reads from its dimmed picture, not a label on each.
      const left = sceneDisplay(snapshot, entry).inVideo === false
      const nextLeft =
        index < video.scenes.length - 1 &&
        sceneDisplay(snapshot, video.scenes[index + 1]).inVideo === false
      // The left-out scenes follow the video's, under their own line.
      const divider =
        left && at === inCount && inCount < video.scenes.length
          ? `<p class="rail-divider">Left out · ${video.scenes.length - inCount}</p>`
          : ''
      return `${divider}<div class="scene-card">
<button class="thumbnail ${
        connected && !snapshot.readOnly && sceneActivity(snapshot, entry).active
          ? 'scene-processing'
          : ''
      } ${index === selected ? 'selected' : ''} ${
        left ? 'is-left-out' : ''
      }" data-scene="${index}" aria-label="Scene ${index + 1}: ${escape(
        project.slides[index]?.title || ''
      )}${left ? ', not in the video' : ''}">
<span class="thumb-number">${index + 1}</span>
<div>${project.slides[index]?.svg || '<span>Blank wireframe</span>'}</div>
<span class="scene-meta">${
        entry.moments.length ? `${Math.round(entry.moments.at(-1)!.end)}s` : ''
      } ${
        // The title page opens the cut only when it is in it (review 6).
        index === 0 && !left
          ? '<b>TITLE</b>'
          : index === lastIn && !left
            ? '<b>END</b>'
            : ''
      }</span>${sceneRailStatus(snapshot, entry)}</button>
<button type="button" class="scene-card-settings icon-button" data-action="scene-settings" data-settings-scene="${index}" aria-label="Settings for scene ${
        index + 1
      }" title="Scene settings" ${
        sceneDisplay(snapshot, entry).active ? 'disabled' : ''
      }>${gear}</button>
</div>${
        // A transition plays only between two scenes in the video.
        index < video.scenes.length - 1 && !left && !nextLeft
          ? `<button class="transition-control" data-transition="${index}" aria-label="Transition after scene ${
              index + 1
            }">${
              video.transitions[index] === 'none'
                ? '+'
                : escape(video.transitions[index])
            }</button>`
          : ''
      }`
    })
    .join('')}</aside>
<div class="stage-area" ${
    focused
      ? 'role="dialog" aria-modal="true" aria-label="Presenter studio"'
      : ''
  }>${
    focused
      ? `<div class="focus-heading">
<div>
<strong>${
          reviewing
            ? 'Review your take'
            : practicing
              ? 'Practice'
              : recordTitle(capture)
        }</strong>
<span>${
          practicing || reviewing
            ? `Scene ${selected + 1} · Moment ${momentIndex + 1}`
            : recordPlace(capture, selected + 1, momentIndex + 1)
        }</span>${recordLight(capture)}
</div>${
          // One Cancel, beside Start recording (review 6: there were two).
          practicing ? button('Exit practice', 'practice') : ''
        }</div>`
      : ''
  }${capture.phase === 'idle' ? recordingHandoff(snapshot, scene) : ''}${
    // Scene activity is the one place a scene's progress shows (review 5);
    // notices about the connection, a saved copy or an idle queue stay.
    activity &&
    !(showActivity && connected && selectedActive && !snapshot.readOnly)
      ? `<div class="video-run-status ${
          connected && selectedActive && !snapshot.readOnly ? 'is-active' : ''
        }" role="status">${
          connected && selectedActive && !snapshot.readOnly
            ? `<span class="activity-orbit" aria-hidden="true">
</span>
<div>
<strong>${escape(activeLabel)}</strong>
<span>Scene ${selected + 1}</span>
</div>`
            : escape(activity)
        }</div>`
      : ''
  }<div style="${
    moment ? presenterLayoutStyle((presenter ?? moment).layout) : ''
  }" class="stage video-stage ${
    (!view?.produced || practicing || capture.phase !== 'idle') && presenter
      ? `presenter-layout-${presenter.layout}`
      : ''
  }">${
    cameraTake
      ? `${
          scene.animation && scene.animation.inputKey === scene.animationKey
            ? `<video class="rehearsal-animation" data-rehearsal-animation src="/objects/${scene.animation.objectKey}" muted playsinline>
</video>`
            : slide?.svg || ''
        }<div class="presenter-preview ${moment?.layout || 'corner'}">
<video class="take-player" data-take-player data-review-duration="${
          capture.parts.at(-1)?.to || 0
        }" src="${escape(capture.url!)}" playsinline>
</video>
</div>`
      : showVideo
        ? `<video class="scene-player" data-scene-player data-whole-video src="/objects/${
            video.produced!.objectKey
          }" poster="${
            video.produced!.posterKey
              ? `/objects/${video.produced!.posterKey}`
              : video.scenes[0].produced?.posterKey
                ? `/objects/${video.scenes[0].produced.posterKey}`
                : `/api/projects/${project.id}/scenes/${video.scenes[0].id}/cover?v=${video.scenes[0].produced?.objectKey}`
          }" playsinline>
</video>`
        : !view?.produced &&
            moment?.camera === 'none' &&
            scene.animation &&
            scene.animation.inputKey === scene.animationKey &&
            !practicing &&
            capture.phase === 'idle'
          ? `<video class="scene-player" data-scene-player data-animation-player src="/objects/${
              scene.animation.objectKey
            }" poster="${
              scene.animation.posterKey
                ? `/objects/${scene.animation.posterKey}`
                : `/api/projects/${project.id}/scenes/${scene.id}/cover?v=${scene.animation.objectKey}`
            }" playsinline>
</video>`
          : view?.produced &&
              scene.produced &&
              !practicing &&
              capture.phase === 'idle'
            ? `<video class="scene-player" data-scene-player src="/objects/${
                scene.produced.objectKey
              }" poster="${
                scene.produced.posterKey
                  ? `/objects/${scene.produced.posterKey}`
                  : `/api/projects/${project.id}/scenes/${scene.id}/cover?v=${scene.produced.objectKey}`
              }" playsinline>
</video>`
            : `${
                scene.animation &&
                scene.animation.inputKey === scene.animationKey
                  ? `<video class="rehearsal-animation" data-rehearsal-animation src="/objects/${scene.animation.objectKey}" muted playsinline>
</video>`
                  : slide?.svg || ''
              }${
                presenter
                  ? `<div class="presenter-preview ${presenter.layout}" ${
                      practicing && !wholeScene && !cameraAt(moment, second)
                        ? 'hidden'
                        : ''
                    }>${
                      capture.stream || practiceStream
                        ? '<video data-camera autoplay muted playsinline></video>'
                        : !wholeScene &&
                            moment.take &&
                            moment.take.recordingKey === moment.recordingKey
                          ? `<video data-saved-presenter src="/objects/${escape(
                              moment.take.objectKey
                            )}" ${practicing ? 'muted' : ''} playsinline preload="auto">
</video>`
                          : `<img src="${standIn}" alt="Presenter stand-in">
<small>Presenter stand-in</small>`
                    }</div>`
                  : ''
              }${sceneOverlay(project, moment)}`
  }${
    (!practicing && cameraTake) ||
    // Only a recorded take has anything to play: a scene still being
    // prepared has no moments, and its controls sat over the slide (review 5).
    (!practicing &&
      capture.phase === 'idle' &&
      !view?.produced &&
      !!moment?.take &&
      moment.camera !== 'none' &&
      moment.take.recordingKey === moment.recordingKey)
      ? layeredControls()
      : capture.phase === 'idle' &&
          !practicing &&
          !view?.produced &&
          moment?.camera !== 'none' &&
          scene.animation?.inputKey === scene.animationKey &&
          scene.animation
        ? standInControls()
        : ''
  }${countdownOverlay(capture)}</div>${
    focused && !reviewing
      ? `<div class="animation-status" data-animation-status>
<progress data-animation-progress aria-label="Animation progress" max="1" value="0">
</progress>
<span data-animation-remaining>Animation ready</span>
</div>`
      : ''
  }${
    (capture.phase === 'recording' || capture.phase === 'countdown') && moment
      ? `<div class="practice-cue recording-script">
<strong>${
          capture.phase === 'countdown'
            ? `Ready in ${capture.countdown}`
            : capture.phase === 'recording'
              ? 'Recording · Esc to stop'
              : escape(moment.cue || moment.title || '')
        }</strong>
<span data-prompter>${transcriptWords(moment.lines)}</span>
</div>`
      : ''
  }${
    practicing && moment
      ? `<section class="practice-panel" aria-label="Practice script">
<div class="practice-panel-heading">
<div>
<strong data-practice-clock>Practice · Esc to stop</strong>
<small>Follow the highlighted word · estimated pacing</small>
</div>${
          // Whole-scene practice offers the camera whenever any of its
          // moments uses it, not only the one on show (review 6).
          !practiceStream &&
          (wholeScene
            ? scene.moments.some((entry) => entry.camera !== 'none')
            : moment.camera !== 'none')
            ? cameraToggle(false)
            : practiceStream
              ? cameraToggle(true)
              : ''
        }</div>
<div class="prompter-window">
<span class="prompter-caret" aria-hidden="true">›</span>
<p data-prompter aria-label="Teleprompter script">${transcriptWords(
          moment.lines
        )}</p>
</div>
</section>`
      : ''
  }<div class="moment-timeline">
<div class="moment-strip${scene.moments.length ? '' : ' is-empty'}" aria-label="Moments">${
    scene.moments.length
      ? ''
      : sceneDisplay(snapshot, scene).active
        ? '<span class="moment-strip-note">Writing the moments…</span>'
        : sceneDisplay(snapshot, scene).queued
          ? '<span class="moment-strip-note">Waiting to be written</span>'
          : ''
  }${scene.moments
    .map(
      (entry, index) =>
        `<div class="moment-item" style="flex-grow:${Math.max(
          0.1,
          entry.end - entry.start
        )}">
<button ${
          capture.phase !== 'idle' ? 'disabled' : ''
        } data-moment="${index}" class="moment ${
          entry.id === moment?.id ? 'current' : ''
        }">
<span class="moment-head"><b class="moment-number">${index + 1}</b>${cameraCue(entry.camera)}</span>
<span class="moment-name" title="${escape(entry.title || `Moment ${index + 1}`)}">${escape(entry.title || `Moment ${index + 1}`)}</span>
<small>${escape(
          momentWords(
            entry,
            views?.moments[momentViewKey(scene.id, entry.id)]?.state
          )
        )}</small>
</button>
${
  leftOut
    ? ''
    : `<button type="button" class="moment-card-menu" data-action="moment-actions" data-menu-moment="${index}" aria-label="Actions for moment ${
        index + 1
      }" aria-haspopup="dialog" ${
        capture.phase !== 'idle' || busy ? 'disabled' : ''
      }>⋯</button>`
}
</div>`
    )
    .join('')}${
    capture.phase === 'idle'
      ? `<span class="moment-playhead" aria-hidden="true" style="left:${Math.min(
          100,
          Math.max(0, (second / (scene.moments.at(-1)?.end || 1)) * 100)
        )}%">
</span>`
      : ''
  }</div>
</div>${
    view?.openMomentIds.length && capture.phase === 'idle' && !leftOut
      ? `<div class="recording-nudge">
<strong>Your turn</strong>
<span>${view.openMomentIds.length} ${
          view.openMomentIds.length === 1 ? 'moment needs' : 'moments need'
        } your recording to finish this scene.</span>
</div>`
      : ''
  }${sceneCheck(scene)}<div class="video-actions">
<div>${button('← Wireframe', 'open-wireframe')}${
    view?.produced
      ? `<a class="download-scene" href="/api/projects/${encodeURIComponent(
          project.id
        )}/scenes/${encodeURIComponent(scene.id)}/download" download="scene-${
          selected + 1
        }.mp4">↓ Scene</a>`
      : button('↓ Scene', 'download-scene', false, true)
  }${
    views?.video.action === 'export' && video.produced?.clock?.length
      ? button(showVideo ? 'Show scene' : 'Play video', 'preview-video')
      : ''
  }</div>
<div>${
    ['preparing', 'ready', 'countdown', 'recording'].includes(capture.phase)
      ? recordActions(capture)
      : capture.phase === 'reviewing'
        ? `${button('Discard', 'discard-take')}${button(
            'Retake',
            'retake-recording'
          )}${button('Save take', 'save-take', true)}`
        : capture.phase === 'uploading'
          ? button('Saving…', 'save-take', true, true)
          : leftOut
            ? button(mainLabel, 'scene-next', true, false)
            : `${button(
                practicing
                  ? 'Stop practice'
                  : practiceScene && scene.moments.length > 1
                    ? 'Practice scene'
                    : moment
                      ? `Practice moment ${momentIndex + 1}`
                      : 'Practice',
                'practice',
                false,
                !scene.moments.length
              )}${
                // Moments wait for the creator: recording is the next step
                // (review 6: it looked like its neighbours).
                // One primary: a Try again or Make beside it leads instead.
                view?.openMomentIds.length && view.action !== 'record'
                  ? button(
                      record,
                      'record-moment',
                      view.action !== 'retry' && view.action !== 'make',
                      !display.canRecord
                    )
                  : ''
              }${
                // One way to finish (review 5): the header finishes the
                // video; a scene's own button shows only for its own step,
                // or to finish one of several scenes.
                view?.action === 'download' ||
                ((view?.action === 'produce' || view?.action === 'wait') &&
                  (views?.video.madeScenes ?? video.scenes.length) === 1)
                  ? ''
                  : button(
                      mainLabel,
                      'scene-next',
                      view?.action === 'record' ||
                        view?.action === 'retry' ||
                        view?.action === 'make',
                      !view || view.action === 'wait'
                    )
              }`
  }</div>
</div>${
    reviewing
      ? `<div class="take-review">
<p>${
          capture.phase === 'uploading'
            ? 'Saving your recording… Your existing takes stay available until this finishes.'
            : 'Watch or listen, then save it or record it again. Your existing takes stay unchanged until you save.'
        }</p>${
          !cameraTake
            ? `<audio data-take-player data-review-duration="${
                capture.parts.at(-1)?.to || 0
              }" src="${escape(capture.url!)}" controls>
</audio>`
            : ''
        }</div>`
      : ''
  }<form id="video-chat" class="chat">${
    moment
      ? `<span class="anchor-chip">${second.toFixed(1)}s · moment ${
          momentIndex + 1
        }</span>`
      : ''
  }<label class="sr" for="video-instruction">Change this moment</label>
<input id="video-instruction" name="instruction" placeholder="Ask about this moment, like ${
    // Before the scene has moments, the video's own camera setting decides.
    (moment ? moment.camera === 'none' : video.settings.presence === 'off')
      ? '“say this part more slowly”'
      : '“move me left”'
  }" ${moment && !busy && !leftOut ? '' : 'disabled'}>
<button aria-label="Send instruction" ${
    moment && !busy && !leftOut ? '' : 'disabled'
  }>↑</button>
</form>
<div class="reply" role="status" aria-live="polite">
<span class="${scene.error || video.error ? 'is-failed' : ''}">${escape(
    agentWords(snapshot, scene.error) ||
      (!busy
        ? reply?.message
        : sceneDisplay(snapshot, scene).queued
          ? 'Waiting for the next available slot'
          : '') ||
      agentWords(snapshot, video.error) ||
      ''
  )}</span>${button('Activity', 'history')}</div>

</div>
<aside class="transcript" ${focused ? 'inert' : ''}>
<div class="transcript-header">
<h2>Scene ${selected + 1}</h2>${
    // A left-out scene offers only Make this scene (review 6).
    scene.phase === 'idle'
      ? ''
      : sceneBeatChip(project, scene.id) + sceneShotChip(project, scene.id)
  }
</div>${
    showActivity
      ? `<details class="activity-disclosure" data-activity-key="${scene.id}" ${
          selectedActive || display.failed ? 'open' : ''
        }>
<summary>
<span>Scene activity</span>
<span class="activity-toggle-label">
<span class="when-open">Collapse</span>
<span class="when-closed">Expand</span>
<span class="activity-chevron" aria-hidden="true">⌄</span>
</span>
</summary>${sceneActivityRail(snapshot, scene, connected)}</details>`
      : ''
  }<h3 class="activity-transcript-heading">Transcript <small title="Word timing is estimated from each moment’s duration, not speech recognition">Estimated pacing</small>
</h3>
<div class="transcript-scroll" tabindex="0" aria-label="Transcript">${scene.moments
    .map(
      (entry, index) =>
        `<section class="transcript-moment ${
          entry.id === moment?.id ? 'current' : ''
        }" data-transcript-moment="${index}">
<h3>${cameraCue(entry.camera)}<span>${index + 1}</span>${escape(
          entry.title || `Moment ${index + 1}`
        )}</h3>
<small class="moment-layout">${momentKind(entry, true)}</small>
<p>${transcriptWords(entry.lines)}</p>${
          views?.moments[momentViewKey(scene.id, entry.id)]?.state ===
            'recorded' && capture.phase === 'idle'
            ? `<button data-retake="${index}" class="retake-moment" ${display.canRecord ? '' : 'disabled title="Wait for this scene to finish changing"'}>Retake</button>`
            : ''
        }${snapshot.events
          .filter(
            (event) =>
              event.kind === 'chat' &&
              event.anchor?.stage === 'video' &&
              event.anchor.sceneId === scene.id &&
              event.anchor.momentId === entry.id
          )
          .map((event) => `<blockquote>${escape(event.message)}</blockquote>`)
          .join('')}</section>`
    )
    .join('')}</div>
</aside>
</section>`
}
export const makeVideoDialog = (
  settings: StudioSettings,
  current?: VideoSettings,
  /** For a new video: its wireframes, the one in view, and whether only it. */
  choice?: {
    slides: Slide[]
    selected: number | null
    only: boolean
    /** While the deck is drawn: the wireframes that are done. */
    done?: Set<string>
  },
  look?: Branding,
  /** The template the wireframes were planned from, chosen by default. */
  planned?: { narrative?: string; direction?: VideoSettings['direction'] },
  /** A wireframe of this notebook for the template's card, when no
   * wireframes are chosen here (the video's settings). */
  preview?: string
) => {
  const presence = current?.presence || 'high'
  const voice = current?.voice || settings.voice.selected
  // With a template, its direction says how much you are on camera.
  const story = current?.narrative
    ? { narrative: current.narrative, direction: current.direction }
    : (takePickedTemplate() ?? (planned?.narrative ? planned : undefined))
  return `<h2>Make the video</h2>
<form id="video-form">
${templatePicker(story, look, preview ?? choice?.slides.find((slide) => slide.svg)?.svg ?? undefined)}${onCameraChoice(story)}
<fieldset class="tpl-presence"${story?.narrative ? ' hidden disabled' : ''}>
<legend>On camera</legend>${(['off', 'low', 'high'] as const)
    .map(
      (value) =>
        `<label>
<input type="radio" name="presence" value="${value}" ${
          value === presence ? 'checked' : ''
        }> ${value[0].toUpperCase() + value.slice(1)} <small>${
          value === 'off'
            ? 'You stay off camera.'
            : value === 'low'
              ? 'You close each scene.'
              : 'You open, close, and step in where it helps.'
        }</small>
</label>`
    )
    .join('')}</fieldset>
<fieldset class="voice-rows"><legend>Voice when you are off camera</legend><div>${voiceRows(
    settings,
    voice
  )}</div></fieldset><p class="two-voices" ${
    voice.kind !== 'ai' || presence === 'off' ? 'hidden' : ''
  }>Your voice on camera and an AI voice elsewhere will sound different.</p>${
    choice
      ? sceneChoice(choice.slides, choice.selected, choice.only, choice.done)
      : ''
  }
<button type="submit" class="primary">Make the video →</button>

</form>`
}
