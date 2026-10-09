import { sceneDisplay, whyNoRecording } from '../shared/state'
import { api } from './api'
import type { AppContext } from './app-context'
import { dialogueStudio } from './dialogue-studio'
import { movePlayhead } from './moment-timeline'
import { PracticePlayback } from './practice'
import { syncPresenterLayout } from './presenter-motion'
import { Recording } from './recording'
import { recordingRecovery } from './recording-setup'
import { recordingPlan } from './recording-target'
import { momentNeedsRecording } from '../shared/state'
import { time } from './scene-timeline'
import { followTranscript, transcriptWords } from './transcript-follow'
import { practiceControls, recordControl } from './practice-controls'
import { sceneOverlay } from './scene-overlay'
import { workspaceUrl } from './workspace-position'
import { reviewLayoutSecond } from './take-review-clock'

/** Where practice stands: ready, counting down, running or finished. */
export const practicePhase = (app: AppContext) =>
  app.startRehearsal
    ? 'ready'
    : app.practiceCountdown
      ? 'countdown'
      : app.practice.active
        ? 'running'
        : 'finished'

/** The practice actions under the stage, for where practice stands now. */
export const paintPracticeActions = (app: AppContext) => {
  const actions = app.root.querySelector('.video-actions>div:last-child')
  if (!actions || !app.practiceOpen) return
  const phase = practicePhase(app)
  // Record sits beside Start practice, and only when something can be
  // recorded (review 6: it showed, then failed with "No moments need
  // recording").
  const scene = app.snapshot?.project.video?.scenes[app.selected]
  const recordable =
    (phase === 'ready' || phase === 'finished') &&
    !!scene &&
    !!app.snapshot?.views?.scenes[scene.id]?.openMomentIds.length &&
    !whyNoRecording(scene)
  actions.innerHTML = `${practiceControls(
    phase,
    app.practiceMomentIds.length > 1
      ? app.practiceMomentIds.at(-1) ===
        app.snapshot?.project.video?.scenes[app.selected]?.moments[
          app.momentIndex
        ]?.id
        ? 'Finish practice'
        : 'Next moment'
      : undefined,
    app.practiceMomentIds.length
  )}${recordable ? recordControl() : ''}`
}

/**
 * Show another moment of the scene without drawing the page again. Playing
 * the whole scene, a new draw at every moment rebuilt the stage and the
 * timeline, which flickered; now only what names the moment changes.
 */
export const showMoment = (app: AppContext, index: number) => {
  const project = app.snapshot?.project,
    scene = project?.video?.scenes[app.selected],
    moment = scene?.moments[index]
  if (!project || !scene || !moment) return
  app.momentIndex = index
  const heading = app.root.querySelector('.focus-heading span')
  if (heading)
    heading.textContent = `Scene ${app.selected + 1} · Moment ${index + 1}`
  const stage = app.root.querySelector('.video-stage')
  if (stage) {
    stage
      .querySelectorAll(':scope > .scene-overlay, :scope > .preview-name')
      .forEach((overlay) => overlay.remove())
    stage.insertAdjacentHTML('beforeend', sceneOverlay(project, moment))
  }
  if (app.practice.active) paintPracticeActions(app)
  history.replaceState(
    null,
    '',
    workspaceUrl(
      new URL(location.href),
      project,
      app.stage,
      app.selected,
      index
    )
  )
}

export const createPractice = (app: AppContext) =>
  new PracticePlayback(
    (clip, at) => {
      if (
        app.practiceStopAfter !== null &&
        (performance.now() - app.practiceStarted) / 1000 >=
          app.practiceStopAfter
      ) {
        app.finishPractice()
        return
      }
      const changed = app.practiceLines !== clip.lines
      app.practiceLines = clip.lines
      app.second = at
      const scene = app.snapshot?.project.video?.scenes[app.selected]
      const index = Math.max(
        0,
        scene?.moments.findIndex((moment) => moment.id === clip.momentId) ?? 0
      )
      // Practising the whole scene, the next moment shows in place and the
      // presenter moves with it; a new draw would rebuild the stage.
      const whole = app.practiceMomentIds.length > 1
      if (whole) {
        if (index !== app.momentIndex) showMoment(app, index)
        if (scene) syncPresenterLayout(app.root, scene.moments, app.second)
      } else {
        app.momentIndex = index
        if (changed) app.render()
        const presenter =
          app.root.querySelector<HTMLElement>('.presenter-preview')
        if (presenter) presenter.hidden = !clip.camera
      }
      app.syncAnimation()
      app.paintAnimationProgress()
      app.dialogue.paint(app.second)
      app.syncLayeredPlayback()
      followTranscript(
        app.root,
        app.snapshot?.project.video?.scenes[app.selected]?.moments || [],
        app.second,
        app.momentIndex
      )
      followTranscript(
        app.root,
        scene?.moments || [],
        app.second,
        app.momentIndex
      )
      movePlayhead(app.root, scene?.moments || [], app.second)
      const cue = app.root.querySelector('.practice-cue>span')
      if (cue && cue.textContent !== clip.lines)
        cue.innerHTML = transcriptWords(clip.lines)
      const rehearsalClock = app.root.querySelector('[data-practice-clock]')
      if (rehearsalClock)
        rehearsalClock.textContent = `Practice · ${(
          (performance.now() - app.practiceStarted) /
          1000
        ).toFixed(1)}s · Esc to stop`
      const chip = app.root.querySelector('.anchor-chip')
      if (chip)
        chip.textContent = `${app.second.toFixed(1)}s · moment ${app.momentIndex + 1}`
    },
    () => {
      const moment =
        app.snapshot?.project.video?.scenes[app.selected]?.moments[
          app.momentIndex
        ]
      if (moment) app.second = moment.start
      app.render()
    },
    (reason) => {
      app.stopPractice()
      app.render()
      app.error(reason)
    }
  )

export const createFinishPractice = (app: AppContext) => () => {
  app.practiceRequest++
  app.cameraStarting = false
  app.practiceCountdown = 0
  app.startRehearsal = null
  app.practice.stop()
  app.practiceLoading = false
  app.root
    .querySelector<HTMLVideoElement>('[data-rehearsal-animation]')
    ?.pause()
  app.render()
}

export const createStopPractice = (app: AppContext) => () => {
  app.practiceRequest++
  app.practiceOpen = false
  app.cameraStarting = false
  app.startRehearsal = null
  app.practiceCountdown = 0
  app.practice.stop()
  app.practiceLoading = false
  app.practiceLines = ''
  app.practiceStream?.getTracks().forEach((track) => track.stop())
  app.practiceStream = null
}

/** The moments practice plays: the one on show, or every moment of the scene. */
export const practiceMoments = (
  scene: import('../shared/model').Scene,
  index: number,
  scope: AppContext['practiceScope']
) =>
  scope === 'scene' && scene.moments.length > 1
    ? scene.moments.map((moment) => moment.id)
    : scene.moments[index]
      ? [scene.moments[index].id]
      : []

export const createReplayPractice = (app: AppContext) => async () => {
  const scene = app.snapshot?.project.video?.scenes[app.selected]
  if (!scene || !app.practiceOpen) return
  const moments = app.practiceMomentIds
    .map((id) => scene.moments.find((moment) => moment.id === id))
    .filter((moment): moment is import('../shared/model').Moment => !!moment)
  if (!moments.length) return
  const request = ++app.practiceRequest
  app.practice.stop()
  app.root
    .querySelector<HTMLVideoElement>('[data-rehearsal-animation]')
    ?.pause()
  app.second = moments[0].start
  app.momentIndex = scene.moments.findIndex((m) => m.id === moments[0].id)
  app.startRehearsal = null
  for (let count = 3; count > 0; count--) {
    if (request !== app.practiceRequest) return
    app.practiceCountdown = count
    app.render()
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (request !== app.practiceRequest) return
  let at = 0
  const clips = moments.map((moment) => {
    const start = at
    at += moment.end - moment.start
    return {
      momentId: moment.id,
      lines: moment.lines,
      camera: moment.camera !== 'none',
      start,
      end: at,
      sceneStart: moment.start,
      sceneEnd: moment.end
    }
  })
  app.practiceCountdown = 0
  app.practiceStarted = performance.now()
  // One moment holds at its end until finished; the whole scene moves on by
  // itself from moment to moment (Enter skips ahead).
  app.practice.start(
    { inputKey: scene.inputKey, clips, duration: at },
    clips.length === 1
  )
  app.render()
}

export const createRecordingFailed = (app: AppContext) => (reason: unknown) => {
  if (
    app.snapshot?.project.id === app.recordingProjectId &&
    app.capture.phase === 'idle'
  )
    app.showDialog(recordingRecovery(reason))
  else app.error(reason)
}

export const createCapture = (app: AppContext) =>
  new Recording(
    () => {
      if (
        ['preparing', 'ready', 'countdown', 'recording'].includes(
          app.capture.phase
        )
      ) {
        const scene = app.snapshot?.project.video?.scenes.find(
          (scene) => scene.id === app.recordingSceneId
        )
        const id =
          app.capture.moments[
            Math.min(app.capture.current, app.capture.moments.length - 1)
          ]?.id
        app.momentIndex = Math.max(
          0,
          scene?.moments.findIndex((moment) => moment.id === id) ?? 0
        )
        app.second = scene?.moments[app.momentIndex]?.start || 0
      }
      app.render()
    },
    (elapsed) => {
      const moment = app.snapshot?.project.video?.scenes.find(
        (scene) => scene.id === app.recordingSceneId
      )?.moments[app.momentIndex]
      app.second = Math.min(
        (moment?.end ?? Infinity) - 0.01,
        (moment?.start || 0) + elapsed
      )
      app.syncAnimation()
      app.paintAnimationProgress()
      app.dialogue.paint(app.second)
      const clock = app.root.querySelector('.recording-clock')
      if (clock) clock.textContent = time(app.capture.elapsed)
      followTranscript(
        app.root,
        app.snapshot?.project.video?.scenes[app.selected]?.moments || [],
        app.second,
        app.momentIndex
      )
      movePlayhead(
        app.root,
        app.snapshot?.project.video?.scenes[app.selected]?.moments || [],
        app.second
      )
      const chip = app.root.querySelector('.anchor-chip')
      if (chip)
        chip.textContent = `${app.second.toFixed(1)}s · moment ${app.momentIndex + 1}`
    },
    (reason) => app.recordingFailed(reason)
  )

export const createDialogue = (app: AppContext) =>
  dialogueStudio(
    app.root,
    () => {
      const scene = app.snapshot?.project.video?.scenes[app.selected]
      const recording = [
        'preparing',
        'ready',
        'countdown',
        'recording'
      ].includes(app.capture.phase)
      return scene && (app.practiceOpen || recording)
        ? {
            projectId: app.snapshot!.project.id,
            scene,
            index: app.momentIndex,
            second: app.second,
            busy:
              app.practice.active ||
              !!app.practiceCountdown ||
              app.capture.phase !== 'idle',
            recording: app.capture.phase === 'recording',
            animation:
              scene.animation && scene.animation.inputKey === scene.animationKey
                ? 'ready'
                : sceneDisplay(app.snapshot!, scene).active
                  ? 'making'
                  : 'none',
            label: app.practiceCountdown
              ? `Ready in ${app.practiceCountdown}…`
              : ['preparing', 'ready'].includes(app.capture.phase)
                ? '• Ready to record'
                : app.capture.phase === 'countdown'
                  ? `Ready in ${app.capture.countdown}…`
                  : app.capture.phase === 'recording'
                    ? '● Recording'
                    : app.practice.active
                      ? '• Practicing'
                      : '• Read along',
            scope: app.practiceOpen
              ? app.practiceScope
              : recording
                ? app.capture.moments.length > 1
                  ? 'scene'
                  : 'moment'
                : undefined
          }
        : null
    },
    (at) => {
      app.second = at
      const scene = app.snapshot?.project.video?.scenes[app.selected]
      if (scene) {
        followTranscript(app.root, scene.moments, at, app.momentIndex)
        // Paused, the presenter shows where its moment settles, not mid-fade.
        syncPresenterLayout(
          app.root,
          scene.moments,
          reviewLayoutSecond(
            scene.moments[app.momentIndex],
            at,
            app.dialogue.isPlaying()
          )
        )
      }
    },
    (value) => {
      app.snapshot = value
      app.startRehearsal = app.replayPractice
      app.render()
    },
    {
      scope: (next) => {
        app.practiceScope = next
        const scene = app.snapshot?.project.video?.scenes[app.selected]
        if (scene && !app.practice.active && !app.practiceCountdown)
          app.practiceMomentIds = practiceMoments(scene, app.momentIndex, next)
        app.render()
      },
      moment: (index) => showMoment(app, index),
      pick: (index) => {
        const scene = app.snapshot?.project.video?.scenes[app.selected],
          moment = scene?.moments[index]
        if (!scene || !moment) return
        app.momentIndex = index
        app.second = moment.start
        if (!app.practice.active && !app.practiceCountdown)
          app.practiceMomentIds = practiceMoments(
            scene,
            index,
            app.practiceScope
          )
        app.render()
      }
    }
  )

/**
 * Get ready to record, in place. The camera and microphone come on, so the
 * creator sees their framing and hears their level; Start (or Enter) counts
 * down. Nothing is asked first: a form stood between Record and the take.
 */
const armRecording = async (
  app: AppContext,
  moments: import('../shared/model').Moment[]
) => {
  app.stopPractice()
  app.dialog.close()
  app.recordingAttempt = structuredClone(moments)
  try {
    await app.capture.prepare(moments)
  } catch (reason) {
    app.recordingFailed(reason)
  }
}

export const createPrepareRecording =
  (app: AppContext) => (moment: import('../shared/model').Moment) =>
    void armRecording(app, [moment])

export const createPrepareRecordingPass =
  (app: AppContext) => (moments: import('../shared/model').Moment[]) =>
    void armRecording(app, moments)

export const installRecordingController = (app: AppContext) => {
  document.addEventListener('keydown', (event) => {
    if (document.querySelector('dialog[open]')) return
    if (event.key === 'Tab' && app.root.querySelector('.is-focused')) {
      const controls = [
        ...app.root.querySelectorAll<HTMLElement>(
          '.is-focused .stage-area button:not(:disabled),.is-focused .stage-area input:not(:disabled),.is-focused .stage-area [tabindex="0"]'
        )
      ].filter((el) => el.getClientRects().length)
      const first = controls[0],
        last = controls.at(-1)
      if (
        first &&
        event.shiftKey &&
        (document.activeElement === first ||
          !app.root
            .querySelector('.is-focused .stage-area')
            ?.contains(document.activeElement))
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        first &&
        !event.shiftKey &&
        (document.activeElement === last ||
          !app.root
            .querySelector('.is-focused .stage-area')
            ?.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    if (event.repeat) return
    if (
      event.key === 'Enter' &&
      app.practice.active &&
      app.practiceMomentIds.length > 1 &&
      !/INPUT|TEXTAREA|SELECT/.test((event.target as Element).tagName)
    ) {
      event.preventDefault()
      app.practice.advance()
      app.render()
      return
    }
    if (
      event.key === 'Enter' &&
      app.capture.phase === 'ready' &&
      !/INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as Element).tagName)
    ) {
      event.preventDefault()
      app.capture.begin()
      return
    }
    if (
      event.key === 'Enter' &&
      app.capture.phase === 'recording' &&
      app.capture.moments.length > 1 &&
      !/INPUT|TEXTAREA|SELECT/.test((event.target as Element).tagName)
    ) {
      event.preventDefault()
      try {
        app.capture.next()
      } catch (reason) {
        app.error(reason)
      }
      return
    }
    if (event.key !== 'Escape') return
    if (app.practiceOpen) {
      event.preventDefault()
      if (app.practice.active || app.practiceCountdown) app.finishPractice()
      return
    }
    if (app.capture.phase === 'recording') {
      event.preventDefault()
      try {
        app.capture.stop()
      } catch (reason) {
        app.error(reason)
      }
    } else if (
      ['preparing', 'ready', 'countdown'].includes(app.capture.phase)
    ) {
      event.preventDefault()
      app.capture.dispose()
    }
  })
  window.addEventListener('beforeunload', (event) => {
    if (
      app.capture.phase === 'recording' ||
      app.capture.phase === 'reviewing' ||
      app.capture.phase === 'uploading'
    ) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}

export const clickRecording = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const slideId = app.snapshot.project.slides[app.selected]?.id
  if (action === 'practice-camera-off') {
    app.practiceStream?.getTracks().forEach((track) => track.stop())
    app.practiceStream = null
    app.cameraStarting = false
    app.render()
    return
  }
  if (action === 'practice-camera') {
    if (app.cameraStarting) return
    app.cameraStarting = true
    app.render()
    const request = app.practiceRequest
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      // Practice moved on while the browser asked: drop the stream, and the
      // "Starting camera…" with it (review 6: it stuck).
      if (request !== app.practiceRequest || !app.practiceOpen) {
        stream.getTracks().forEach((track) => track.stop())
        app.cameraStarting = false
        app.render()
        return
      }
      app.practiceStream?.getTracks().forEach((track) => track.stop())
      app.practiceStream = stream
      app.cameraStarting = false
      app.render()
    } catch {
      app.cameraStarting = false
      app.render()
      app.error(
        new Error(
          'Camera unavailable. Rehearsal continues with the presenter stand-in. Enable camera access in browser site settings to retry.'
        )
      )
    }
  }
  if (action === 'practice-finish') {
    app.finishPractice()
    return
  }
  if (action === 'practice-replay' && app.practiceOpen) {
    app.dialog.close()
    await app.replayPractice()
    return
  }
  if (action === 'practice-start') {
    await app.startRehearsal?.()
    return
  }
  if (action === 'practice-next') {
    app.practice.advance()
    app.render()
    return
  }
  if (action === 'practice-toggle' && app.practice.active) {
    if (app.practice.paused) app.practice.resume()
    else app.practice.pause()
    app.render()
    return
  }
  if (
    action === 'practice' ||
    action === 'practice-replay' ||
    action === 'practice-toggle'
  ) {
    app.dialog.close()
    app.wholeVideo = false
    if (action === 'practice' && (app.practiceOpen || app.practiceLoading)) {
      app.stopPractice()
      app.render()
      return
    }
    const scene = app.snapshot.project.video!.scenes[app.selected],
      moment = scene.moments[app.momentIndex]
    if (!moment) return
    app.practiceRequest++
    app.practiceStopAfter = null
    // From a moment's menu, practice is that moment's (review 6: it played
    // the whole scene from moment 1).
    if (target.dataset.scope === 'moment') app.practiceScope = 'moment'
    app.practiceMomentIds = practiceMoments(
      scene,
      app.momentIndex,
      app.practiceScope
    )
    app.practiceOpen = true
    app.second = moment.start
    app.startRehearsal = app.replayPractice
    app.render()
  }
  if (action === 'recording-retry') {
    const scene = app.snapshot.project.video?.scenes.find(
      (entry) => entry.id === app.recordingSceneId
    )
    if (!scene || id !== app.recordingProjectId || !app.recordingAttempt.length)
      throw new Error('Select the moment you want to record.')
    if (whyNoRecording(scene)) throw new Error(`${whyNoRecording(scene)}.`)
    const moments = app.recordingAttempt.map((previous) =>
      scene.moments.find(
        (moment) =>
          moment.id === previous.id &&
          moment.recordingKey === previous.recordingKey
      )
    )
    if (moments.some((moment) => !moment))
      throw new Error(
        'The dialogue changed. Close this dialog and select the updated moment to record.'
      )
    app.selected = app.snapshot.project.video!.scenes.indexOf(scene)
    app.momentIndex = scene.moments.findIndex(
      (moment) => moment.id === moments[0]!.id
    )
    app.second = moments[0]!.start
    if (moments.length > 1)
      app.prepareRecordingPass(moments as import('../shared/model').Moment[])
    else app.prepareRecording(moments[0]!, app.momentIndex)
  }
  if (action === 'scene-next' || action === 'record-moment') {
    const scene = app.snapshot.project.video!.scenes[app.selected]
    const next = app.snapshot.views?.scenes[scene.id].action
    // Record goes straight to the recorder: only the scene's own next step
    // makes or retries it (review 6: Record re-made a left-out scene).
    if (action === 'scene-next' && next === 'make') {
      app.snapshot = await api.makeScene(id, scene.id)
      app.render()
    } else if (action === 'scene-next' && next === 'retry') {
      app.snapshot = await api.retryScene(id, scene.id)
      app.render()
    } else if (next === 'record' || action === 'record-moment') {
      // A scene being planned or produced can't take a recording yet: say
      // so before the take, not after it (review 6).
      if (whyNoRecording(scene)) throw new Error(`${whyNoRecording(scene)}.`)
      // What Play plays, Record records: the whole scene, or one moment
      // (in practice, the one on show).
      const voice = app.snapshot.project.video!.settings.voice,
        plan = recordingPlan(
          scene.moments,
          app.snapshot.views?.scenes[scene.id].openMomentIds || [],
          app.momentIndex,
          {
            // From a moment's menu, only that moment is recorded.
            whole:
              target.dataset.scope !== 'moment' &&
              app.practiceScope === 'scene',
            here: app.practiceOpen || target.dataset.scope === 'moment',
            needs: (moment) => momentNeedsRecording(moment, voice)
          }
        )
      if (!plan.length)
        throw new Error(
          'No moments need recording. Select a saved moment to retake it.'
        )
      app.recordingSceneId = scene.id
      app.recordingProjectId = id
      if (plan.length > 1) app.prepareRecordingPass(plan)
      else app.prepareRecording(plan[0], scene.moments.indexOf(plan[0]))
    } else if (app.snapshot.views?.scenes[scene.id].action === 'produce') {
      app.stopPractice()
      app.snapshot = await api.produceScene(id, scene.id)
      app.render()
    }
  }
  if (target.dataset.retake) {
    const scene = app.snapshot.project.video!.scenes[app.selected]
    if (whyNoRecording(scene)) throw new Error(`${whyNoRecording(scene)}.`)
    app.stopPractice()
    app.recordingSceneId = scene.id
    app.recordingProjectId = id
    app.prepareRecording(
      scene.moments[Number(target.dataset.retake)],
      Number(target.dataset.retake)
    )
  }
  if (action === 'record-begin') app.capture.begin()
  if (action === 'record-next') app.capture.next()
  if (action === 'record-stop') app.capture.stop()
  if (action === 'retake-recording') {
    // Taking it again needs a scene that can still take it.
    const scene = app.snapshot.project.video?.scenes.find(
      (entry) => entry.id === app.recordingSceneId
    )
    if (scene && whyNoRecording(scene))
      throw new Error(`${whyNoRecording(scene)}.`)
    const moments = app.capture.moments
    app.capture.dispose()
    if (moments.length > 1) app.prepareRecordingPass(moments)
    else if (moments[0]) app.prepareRecording(moments[0], app.momentIndex)
  }
  if (action === 'discard-take') app.capture.dispose()
  if (action === 'save-take' && app.capture.blob) {
    app.capture.phase = 'uploading'
    app.render()
    try {
      app.snapshot = await api.saveRecording(
        app.recordingProjectId,
        app.recordingSceneId,
        app.capture.parts,
        app.capture.blob
      )
      app.capture.dispose()
    } catch (reason) {
      app.capture.phase = 'reviewing'
      app.render()
      throw reason
    }
  }
}
