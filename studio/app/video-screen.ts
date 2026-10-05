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
import { transcriptWords } from './transcript-follow'
import { standInControls } from './stand-in-playback'
import { layeredControls } from './layered-playback'
import { recordingHandoff } from './recording-handoff'
import { presenterLayoutStyle } from '../shared/presenter-layout'
import { recordingTarget } from './recording-target'
import { cameraCue, microphoneCue } from './camera-cue'
import { gear } from './camera-settings'
import { sceneDisplay, videoDisplay } from '../shared/state'
import { sceneActivity, sceneActivityRail } from './scene-activity'
import type { StudioSettings } from '../shared/settings'
import { momentViewKey } from '../shared/model'
import type { Scene, Slide, VideoSettings } from '../shared/model'
import { voiceChoices } from './voice-choice'
import type { Snapshot } from '../shared/api'
import type { Recording } from './recording'
import { cameraAt } from '../shared/camera-window'
import { sceneOverlay } from './scene-overlay'
import { escape, button } from './ui'
import { agentNames } from './agent-setup'
import { wireframeStatus } from './wireframe-copy'
import { sceneChoice } from './scene-link'
const standIn = new URL('./assets/presenter.jpg', import.meta.url).href
/** A moment's state in plain words, not "auto" (review 5). */
const momentWords = (state?: string) =>
  state === 'to record' ? 'Record' : state === 'recorded' ? 'Recorded' : 'Voice'
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
      snapshot.status !== 'ready'
    )
  const view = snapshot.views?.video
  return button(
    videoDisplay(snapshot).actionLabel,
    'produce-video',
    true,
    !view?.enabled
  )
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
      snapshot.status !== 'ready'
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
  const presenter = wholeScene
    ? scene.moments.find((entry) => entry.camera !== 'none')
    : moment?.camera !== 'none'
      ? moment
      : undefined
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
  const recordIndex = recordingTarget(
    scene.moments,
    view?.openMomentIds || [],
    momentIndex
  )
  const mainLabel =
    display.actionLabel +
    (view?.action === 'record'
      ? ` ${recordIndex + 1}`
      : display.actionLabel === 'Finish scene'
        ? ` ${selected + 1}`
        : '')
  const busy = display.busy
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
  return `<section class="video-workspace ${focused ? 'is-focused' : ''}">
<aside class="rail scene-rail" ${focused ? 'inert' : ''} aria-label="Scenes">
<div class="rail-heading">
<strong>Scenes</strong>
<small>${video.scenes.length} ${video.scenes.length === 1 ? 'scene' : 'scenes'}${
    video.scenes.every((entry) => entry.moments.length)
      ? ` · ${Math.round(
          video.scenes.reduce(
            (total, entry) => total + (entry.moments.at(-1)?.end || 0),
            0
          )
        )}s`
      : ''
  }</small>
</div>${video.scenes
    .map((entry, index) => {
      // A scene left out reads from its dimmed picture, not a label on each.
      const left = sceneDisplay(snapshot, entry).inVideo === false
      const nextLeft =
        index < video.scenes.length - 1 &&
        sceneDisplay(snapshot, video.scenes[index + 1]).inVideo === false
      return `<div class="scene-card">
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
        index === 0
          ? '<b>TITLE</b>'
          : index === video.scenes.length - 1
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
              : 'Recording studio'
        }</strong>
<span>Scene ${selected + 1} · Moment ${momentIndex + 1}</span>
</div>${
          practicing
            ? button('Exit practice', 'practice')
            : capture.phase === 'recording'
              ? button('Stop recording · Esc', 'record-stop')
              : ['preparing', 'countdown'].includes(capture.phase)
                ? button('Cancel', 'discard-take')
                : ''
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
  }</div>${
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
          !practiceStream && moment.camera !== 'none'
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
<div class="moment-strip" aria-label="Moments">${scene.moments
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
          momentWords(views?.moments[momentViewKey(scene.id, entry.id)]?.state)
        )}${
          views?.moments[momentViewKey(scene.id, entry.id)]?.state ===
            'recorded' && entry.take?.number
            ? ` · take ${entry.take.number}`
            : ''
        }</small>
</button>
<button type="button" class="moment-card-menu" data-action="moment-actions" data-menu-moment="${index}" aria-label="Actions for moment ${
          index + 1
        }" aria-haspopup="dialog" ${
          capture.phase !== 'idle' || busy ? 'disabled' : ''
        }>⋯</button>
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
    view?.openMomentIds.length && capture.phase === 'idle'
      ? `<div class="recording-nudge">
<strong>Your turn</strong>
<span>${view.openMomentIds.length} ${
          view.openMomentIds.length === 1 ? 'moment needs' : 'moments need'
        } your recording to finish this scene.</span>
</div>`
      : ''
  }<div class="video-actions">
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
    capture.phase === 'recording'
      ? `<span class="recording-clock">Recording · 0.0s</span>${
          capture.moments.length > 1
            ? button(
                capture.current + 1 < capture.moments.length
                  ? 'Next moment · Enter'
                  : 'Finish recording · Enter',
                'record-next',
                true
              )
            : ''
        }${button(
          'Stop recording · Esc',
          'record-stop',
          capture.moments.length === 1
        )}`
      : capture.phase === 'countdown'
        ? `<span class="recording-clock">Starting in ${
            capture.countdown
          }…</span>${button('Cancel', 'discard-take')}`
        : capture.phase === 'preparing'
          ? `<span>Allow ${
              capture.moments.some((moment) => moment.camera !== 'none')
                ? 'camera and microphone'
                : 'microphone'
            } access in your browser to record.</span>${button(
              'Waiting for access…',
              'scene-next',
              true,
              true
            )}${button('Cancel', 'discard-take')}`
          : capture.phase === 'reviewing'
            ? `${button('Discard', 'discard-take')}${button(
                'Retake',
                'retake-recording'
              )}${button('Save take', 'save-take', true)}`
            : capture.phase === 'uploading'
              ? button('Saving…', 'save-take', true, true)
              : `${button(
                  practicing
                    ? 'Stop practice'
                    : moment
                      ? `Practice moment ${momentIndex + 1}`
                      : 'Practice',
                  'practice',
                  false,
                  !scene.moments.length
                )}${
                  view?.openMomentIds.length && view.action !== 'record'
                    ? button(
                        `Record moment ${recordIndex + 1}`,
                        'record-moment'
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
<h3>Review your ${capture.parts.length > 1 ? 'recording' : 'take'}</h3>
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
  }" ${moment && !busy ? '' : 'disabled'}>
<button aria-label="Send instruction" ${
    moment && !busy ? '' : 'disabled'
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
<h2>Scene ${selected + 1}</h2>
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
<small class="moment-layout">${
          entry.camera === 'none'
            ? 'Graphics only'
            : entry.layout === 'full-screen'
              ? 'You full screen'
              : entry.layout === 'beside-slide'
                ? 'You beside the wireframe'
                : 'You in the corner'
        }</small>
<p>${transcriptWords(entry.lines)}</p>${
          views?.moments[momentViewKey(scene.id, entry.id)]?.state ===
            'recorded' && capture.phase === 'idle'
            ? `<button data-retake="${index}" class="retake-moment">Retake</button>`
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
  choice?: { slides: Slide[]; selected: number | null; only: boolean }
) => {
  const presence = current?.presence || 'high'
  const voice = current?.voice || settings.voice.selected
  return `<h2>Make the video</h2>
<form id="video-form">
<fieldset>
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
<label>Voice when you are off camera<select name="voice">${voiceChoices(
    settings,
    voice
  )}</select>
</label><p class="two-voices" ${
    voice.kind !== 'ai' || presence === 'off' ? 'hidden' : ''
  }>Your voice on camera and an AI voice elsewhere will sound different.</p>${
    choice ? sceneChoice(choice.slides, choice.selected, choice.only) : ''
  }
<button type="submit" class="primary">Make the video →</button>

</form>`
}
