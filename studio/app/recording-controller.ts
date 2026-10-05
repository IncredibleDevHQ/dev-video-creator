import { sceneDisplay } from '../shared/state'
import { api } from './api'
import type { AppContext } from './app-context'
import { dialogueStudio } from './dialogue-studio'
import { movePlayhead } from './moment-timeline'
import { PracticePlayback } from './practice'
import { syncPresenterLayout } from './presenter-motion'
import { Recording } from './recording'
import {
  recordingPassSetup,
  recordingRecovery,
  recordingSetup
} from './recording-setup'
import { recordingTarget } from './recording-target'
import { followTranscript, transcriptWords } from './transcript-follow'

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
      app.momentIndex = Math.max(
        0,
        scene?.moments.findIndex((moment) => moment.id === clip.momentId) ?? 0
      )
      if (changed) app.render()
      const presenter =
        app.root.querySelector<HTMLElement>('.presenter-preview')
      if (presenter) presenter.hidden = !clip.camera
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
  app.practice.start({ inputKey: scene.inputKey, clips, duration: at }, true)
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
        app.capture.phase === 'recording' ||
        app.capture.phase === 'countdown'
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
        moment?.end ?? Infinity,
        (moment?.start || 0) + elapsed
      )
      app.syncAnimation()
      app.paintAnimationProgress()
      app.dialogue.paint(app.second)
      const clock = app.root.querySelector('.recording-clock')
      if (clock)
        clock.textContent = `Recording · ${(app.capture.moments.length > 1
          ? app.capture.elapsed
          : elapsed
        ).toFixed(1)}s${
          app.capture.stopAfter !== null ? ` / ${app.capture.stopAfter}s` : ''
        }`
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
      return scene &&
        (app.practiceOpen ||
          app.capture.phase === 'recording' ||
          app.capture.phase === 'countdown')
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
              : app.capture.phase === 'countdown'
                ? `Ready in ${app.capture.countdown}…`
                : app.capture.phase === 'recording'
                  ? '● Recording'
                  : app.practice.active
                    ? '• Practicing'
                    : '• Read along'
          }
        : null
    },
    (at) => {
      app.second = at
      const scene = app.snapshot?.project.video?.scenes[app.selected]
      if (scene) {
        followTranscript(app.root, scene.moments, at, app.momentIndex)
        syncPresenterLayout(
          app.root,
          scene.moments,
          Math.min(at, scene.moments[app.momentIndex].end - 0.08)
        )
      }
    },
    (value) => {
      app.snapshot = value
      app.startRehearsal = app.replayPractice
      app.render()
    }
  )

export const createPrepareRecording =
  (app: AppContext) =>
  (moment: import('../shared/model').Moment, index: number) => {
    app.stopPractice()
    app.pendingRecording = [moment]
    const scene = app.snapshot?.project.video?.scenes[app.selected]
    app.showDialog(
      recordingSetup(
        moment,
        index,
        scene ? app.snapshot?.views?.scenes[scene.id]?.openMomentIds.length : 1
      )
    )
  }

export const createPrepareRecordingPass =
  (app: AppContext) => (moments: import('../shared/model').Moment[]) => {
    app.stopPractice()
    app.pendingRecording = moments
    const scene = app.snapshot!.project.video!.scenes[app.selected]
    app.showDialog(
      recordingPassSetup(
        moments,
        moments.map((moment) =>
          scene.moments.findIndex((item) => item.id === moment.id)
        )
      )
    )
  }
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
      app.capture.phase === 'countdown' ||
      app.capture.phase === 'preparing'
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

export const submitRecording = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (form.id === 'recording-setup' && app.pendingRecording) {
    const seconds = String(values.get('seconds') || '').trim()
    const moments = app.pendingRecording
    app.pendingRecording = null
    app.dialog.close()
    app.recordingAttempt = structuredClone(moments)
    try {
      await app.capture.start(moments, {
        stopAfter: seconds ? Number(seconds) : null
      })
    } catch (reason) {
      app.recordingFailed(reason)
    }
  }
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
      if (request !== app.practiceRequest || !app.practiceOpen) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      app.practiceStream?.getTracks().forEach((track) => track.stop())
      app.practiceStream = stream
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
    app.practiceMomentIds = [moment.id]
    app.practiceOpen = true
    app.second = moment.start
    app.startRehearsal = app.replayPractice
    app.render()
  }
  if (action === 'record-open') {
    const scene = app.snapshot.project.video!.scenes[app.selected],
      open = app.snapshot.views?.scenes[scene.id].openMomentIds || []
    const moments = scene.moments.filter((moment) => open.includes(moment.id))
    if (!moments.length) throw new Error('No moments need recording')
    app.recordingSceneId = scene.id
    app.recordingProjectId = id
    app.prepareRecordingPass(moments)
  }
  if (action === 'recording-retry') {
    const scene = app.snapshot.project.video?.scenes.find(
      (entry) => entry.id === app.recordingSceneId
    )
    if (!scene || id !== app.recordingProjectId || !app.recordingAttempt.length)
      throw new Error('Select the moment you want to record.')
    if (!sceneDisplay(app.snapshot, scene).canRecord)
      throw new Error(
        'Wait for this scene to finish changing before recording again.'
      )
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
    if (app.snapshot.views?.scenes[scene.id].action === 'make') {
      app.snapshot = await api.makeScene(id, scene.id)
      app.render()
    } else if (app.snapshot.views?.scenes[scene.id].action === 'retry') {
      app.snapshot = await api.retryScene(id, scene.id)
      app.render()
    } else if (
      app.snapshot.views?.scenes[scene.id].action === 'record' ||
      action === 'record-moment'
    ) {
      app.stopPractice()
      app.recordingSceneId = scene.id
      app.recordingProjectId = id
      const open = app.snapshot.views?.scenes[scene.id].openMomentIds || []
      const index = recordingTarget(scene.moments, open, app.momentIndex)
      if (index < 0)
        throw new Error(
          'No moments need recording. Select a saved moment to retake it.'
        )
      app.prepareRecording(scene.moments[index], index)
    } else if (app.snapshot.views?.scenes[scene.id].action === 'produce') {
      app.stopPractice()
      app.snapshot = await api.produceScene(id, scene.id)
      app.render()
    }
  }
  if (target.dataset.retake) {
    const scene = app.snapshot.project.video!.scenes[app.selected]
    app.stopPractice()
    app.recordingSceneId = scene.id
    app.recordingProjectId = id
    app.prepareRecording(
      scene.moments[Number(target.dataset.retake)],
      Number(target.dataset.retake)
    )
  }
  if (action === 'record-next') app.capture.next()
  if (action === 'record-stop') app.capture.stop()
  if (action === 'retake-recording') {
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
