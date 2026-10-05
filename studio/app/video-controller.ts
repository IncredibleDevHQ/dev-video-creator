import { dialogueBoundary } from '../shared/dialogue'
import type { Presence, Transition } from '../shared/model'
import { momentViewKey } from '../shared/model'
import { animationSecond } from '../shared/scene-time'
import { sceneDisplay } from '../shared/state'
import { sceneAt, videoSecond } from '../shared/video-clock'
import { api } from './api'
import { activityDialog } from './activity-log'
import type { AppContext } from './app-context'
import { sceneSettings } from './camera-settings'
import { downloadVideo } from './download'
import { layeredPlayback } from './layered-playback'
import { movePlayhead } from './moment-timeline'
import { syncPresenterLayout } from './presenter-motion'
import { syncRehearsalAnimation } from './rehearsal-animation'
import { standInPlayback } from './stand-in-playback'
import { reviewLayoutSecond, takeReviewPosition } from './take-review-clock'
import { followTranscript } from './transcript-follow'
import { button, escape } from './ui'
import { makeVideoDialog } from './video-screen'
import { syncSceneChoice } from './scene-link'
import { videoSettingsPreview } from './video-settings-preview'
import { parseVoice } from './voice-choice'

export const createSyncLayeredPlayback = (app: AppContext) =>
  layeredPlayback(app.root, (time, playing) => {
    const scene = app.snapshot?.project.video?.scenes[app.selected],
      moment = scene?.moments[app.momentIndex]
    if (!scene || !moment) return
    const parts =
      app.capture.phase === 'reviewing' || app.capture.phase === 'uploading'
        ? app.capture.parts
        : [
            {
              momentId: moment.id,
              recordingKey: moment.recordingKey,
              from: 0,
              to: moment.take?.duration || moment.end - moment.start
            }
          ]
    const at = takeReviewPosition(scene.moments, parts, time)
    if (at) {
      app.second = at.second
      followTranscript(app.root, scene.moments, app.second, at.momentIndex)
      syncPresenterLayout(
        app.root,
        scene.moments,
        reviewLayoutSecond(scene.moments[at.momentIndex], at.second, playing)
      )
      movePlayhead(app.root, scene.moments, at.second, at.momentIndex)
      const chip = app.root.querySelector('.anchor-chip')
      if (chip)
        chip.textContent = `${at.second.toFixed(1)}s · moment ${
          at.momentIndex + 1
        }`
      syncRehearsalAnimation(
        app.root,
        scene,
        at.momentIndex,
        at.second,
        playing
      )
    }
  })

export const createPaintAnimationProgress = (app: AppContext) => () => {
  const moment =
    app.snapshot?.project.video?.scenes[app.selected]?.moments[app.momentIndex]
  if (!moment) return
  const duration = dialogueBoundary(moment),
    elapsed = Math.max(0, app.second - moment.start),
    finished = elapsed >= Math.max(0, duration - 0.3)
  const bar = app.root.querySelector<HTMLProgressElement>(
    '[data-animation-progress]'
  )
  if (bar) {
    bar.max = duration
    bar.value = finished ? duration : elapsed
  }
  const label = app.root.querySelector('[data-animation-remaining]')
  if (label)
    label.textContent = finished
      ? 'Animation finished · keep speaking'
      : `${Math.max(0, duration - elapsed).toFixed(1)}s of animation left`
}

export const createSyncAnimation = (app: AppContext) => () => {
  const scene = app.snapshot?.project.video?.scenes[app.selected]
  if (scene)
    syncRehearsalAnimation(
      app.root,
      scene,
      app.momentIndex,
      app.second,
      (app.practice.active && !app.practice.paused) ||
        app.capture.phase === 'recording' ||
        app.dialogue.isPlaying() ||
        (!!app.root.querySelector('[data-stand-in-play]') &&
          app.root.querySelector<HTMLVideoElement>('[data-rehearsal-animation]')
            ?.paused === false)
    )
}

export const createStopPlayhead = (app: AppContext) => () => {
  cancelAnimationFrame(app.playheadFrame)
  app.playheadFrame = 0
}

export const createAnimatePlayhead =
  (app: AppContext) => (player: HTMLMediaElement) => {
    app.stopPlayhead()
    const tick = () => {
      if (
        !player.isConnected ||
        player.paused ||
        player.ended ||
        !app.snapshot
      ) {
        app.stopPlayhead()
        return
      }
      if (player.hasAttribute('data-take-player')) {
        const scene = app.snapshot.project.video?.scenes[app.selected],
          at = scene
            ? takeReviewPosition(
                scene.moments,
                app.capture.parts,
                player.currentTime
              )
            : null
        if (at)
          movePlayhead(app.root, scene!.moments, at.second, at.momentIndex)
        app.playheadFrame = requestAnimationFrame(tick)
        return
      }
      const at = player.hasAttribute('data-whole-video')
        ? sceneAt(app.snapshot.project, player.currentTime)
        : {
            index: app.selected,
            second: player.hasAttribute('data-animation-player')
              ? animationSecond(
                  app.snapshot.project.video!.scenes[app.selected],
                  player.currentTime
                )
              : player.currentTime
          }
      movePlayhead(
        app.root,
        app.snapshot.project.video?.scenes[at.index]?.moments || [],
        at.second
      )
      app.playheadFrame = requestAnimationFrame(tick)
    }
    app.playheadFrame = requestAnimationFrame(tick)
  }
export const installVideoController = (app: AppContext) => {
  standInPlayback(
    app.root,
    () => {
      const scene = app.snapshot?.project.video?.scenes[app.selected]
      return scene ? { scene, index: app.momentIndex } : null
    },
    (at, playing) => {
      app.second = at
      const scene = app.snapshot?.project.video?.scenes[app.selected]
      if (!scene) return
      const moment = scene.moments[app.momentIndex]
      syncPresenterLayout(
        app.root,
        scene.moments,
        !playing && at === moment.start
          ? at + Math.min(0.28, (moment.end - moment.start) / 3)
          : at
      )
      followTranscript(app.root, scene.moments, at, app.momentIndex)
      movePlayhead(app.root, scene.moments, at, app.momentIndex)
      const chip = app.root.querySelector('.anchor-chip')
      if (chip)
        chip.textContent = `${at.toFixed(1)}s · moment ${app.momentIndex + 1}`
    }
  )
  app.root.addEventListener(
    'play',
    (event) => {
      const player = event.target
      if (
        player instanceof HTMLMediaElement &&
        player.matches('[data-scene-player],[data-take-player]')
      )
        app.animatePlayhead(player)
    },
    true
  )
  for (const type of ['pause', 'ended', 'emptied'])
    app.root.addEventListener(
      type,
      (event) => {
        if (
          event.target instanceof HTMLMediaElement &&
          event.target.matches('[data-scene-player],[data-take-player]')
        )
          app.stopPlayhead()
      },
      true
    )
  window.addEventListener('pagehide', app.stopPlayhead)
  app.root.addEventListener(
    'timeupdate',
    (event) => {
      const player = event.target as HTMLMediaElement
      if (!player.matches('[data-scene-player],[data-take-player]')) return
      if (!app.snapshot) return
      let changedScene = false
      if (player.hasAttribute('data-take-player')) {
        const scene = app.snapshot.project.video?.scenes[app.selected],
          at = scene
            ? takeReviewPosition(
                scene.moments,
                app.capture.parts,
                player.currentTime
              )
            : null
        if (!at) return
        app.momentIndex = at.momentIndex
        app.second = at.second
        syncRehearsalAnimation(
          app.root,
          scene!,
          app.momentIndex,
          app.second,
          !player.paused
        )
      } else if (player.hasAttribute('data-whole-video')) {
        const at = sceneAt(app.snapshot.project, player.currentTime)
        changedScene = app.selected !== at.index
        app.selected = at.index
        app.second = at.second
      } else
        app.second = player.hasAttribute('data-animation-player')
          ? animationSecond(
              app.snapshot.project.video!.scenes[app.selected],
              player.currentTime
            )
          : player.currentTime
      const scene = app.snapshot.project.video?.scenes[app.selected]
      if (!scene) return
      const clock = scene.moments
      const index = clock.findIndex(
        (moment) => app.second >= moment.start && app.second < moment.end
      )
      if (index >= 0 && !player.hasAttribute('data-take-player'))
        app.momentIndex = index
      if (changedScene) {
        app.render()
        return
      }
      followTranscript(app.root, scene.moments, app.second, app.momentIndex)
      app.root
        .querySelectorAll('.transcript-moment')
        .forEach((entry, index) =>
          entry.classList.toggle('current', index === app.momentIndex)
        )
      app.root
        .querySelectorAll('.moment')
        .forEach((entry, index) =>
          entry.classList.toggle('current', index === app.momentIndex)
        )
      movePlayhead(
        app.root,
        app.snapshot?.project.video?.scenes[app.selected]?.moments || [],
        app.second,
        player.hasAttribute('data-take-player') ? app.momentIndex : undefined
      )
      const chip = app.root.querySelector('.anchor-chip')
      if (chip)
        chip.textContent = `${app.second.toFixed(1)}s · moment ${app.momentIndex + 1}`
    },
    true
  )
  app.root.addEventListener('focusin', (event) => {
    if ((event.target as HTMLElement).id === 'video-instruction')
      app.root.querySelector<HTMLVideoElement>('[data-scene-player]')?.pause()
  })
}

export const submitVideo = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (['video-form', 'video-settings-form'].includes(form.id) && app.snapshot) {
    const presence = String(values.get('presence')) as Presence
    const voice = String(values.get('voice'))
    const next = { presence, voice: parseVoice(voice) }
    if (form.id === 'video-settings-form') {
      app.pendingVideoSettings = next
      app.showDialog(videoSettingsPreview(app.snapshot.project, next))
      return
    }
    // Only some wireframes ticked: the other scenes start left out.
    const slides = app.snapshot.project.slides
    const ticked = values.getAll('scene').map(String)
    if (form.querySelector('.scene-choice') && !ticked.length)
      throw new Error('Choose at least one wireframe to make')
    const scenes =
      form.querySelector('.scene-choice') && ticked.length < slides.length
        ? ticked
        : undefined
    app.snapshot = await api.makeVideo(app.snapshot.project.id, {
      ...next,
      ...(scenes ? { scenes } : {})
    })
    app.dialog.close()
    app.stage = 'video'
    // Open on the first scene being made.
    app.selected = Math.max(
      0,
      scenes ? slides.findIndex((slide) => scenes.includes(slide.id)) : 0
    )
    app.momentIndex = 0
    app.second = 0
    app.render()
  }
  if (form.id === 'video-chat' && app.snapshot) {
    if (app.capture.phase !== 'idle')
      throw new Error('Finish or discard this take before changing the scene')
    const scene = app.snapshot.project.video?.scenes[app.selected]
    const moment = scene?.moments[app.momentIndex]
    const instruction = String(values.get('instruction') || '').trim()
    if (!scene || !moment || !instruction) return
    app.stopPractice()
    await app.sendChat({
      anchor: {
        stage: 'video',
        sceneId: scene.id,
        momentId: moment.id,
        second: app.second
      },
      instruction
    })
  }
}

export const clickVideo = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const slideId = app.snapshot.project.slides[app.selected]?.id
  if (action === 'confirm-video-settings' && app.pendingVideoSettings) {
    app.snapshot = await api.updateVideo(id, app.pendingVideoSettings)
    app.pendingVideoSettings = null
    app.dialog.close()
    app.render()
    return
  }
  if (action === 'video-settings') {
    app.showDialog(
      '<h2>Opening notebook settings</h2><p role="status">Loading your voice choices…</p>'
    )
    const revision = app.dialogRevision
    let settings: import('../shared/settings').StudioSettings
    try {
      settings = await api.settings()
    } catch (reason) {
      if (app.dialog.open && app.dialogRevision === revision)
        app.showDialog(
          `<h2>Settings could not load</h2>
<p role="alert">
${escape(
  reason instanceof Error
    ? reason.message
    : 'Check the connection and try again.'
)}</p>
${button('Try again', 'video-settings', true)}`
        )
      return
    }
    if (!app.dialog.open || app.dialogRevision !== revision) return
    app.showDialog(
      makeVideoDialog(
        settings,
        app.pendingVideoSettings || app.snapshot.project.video!.settings
      )
    )
    const form = app.dialog.querySelector<HTMLFormElement>(
      '#video-form, #video-settings-form'
    )!
    form.id = 'video-settings-form'
    app.dialog.querySelector('h2')!.textContent = 'Notebook settings'
    form.querySelector('button[type=submit]')!.textContent = 'Review changes'
    const message = document.createElement('p')
    message.textContent =
      'On-camera changes re-plan scenes using the video setting. Matching recordings are kept.'
    form.prepend(message)
    form.insertAdjacentHTML('afterend', button('App settings', 'settings'))
  }
  if (action === 'make-video' || action === 'make-video-one') {
    if (app.snapshot.project.video) {
      app.stage = 'video'
      app.render()
    } else {
      const onWireframe = app.stage === 'presentation'
      app.showDialog(
        makeVideoDialog(await api.settings(), undefined, {
          slides: app.snapshot.project.slides,
          selected: onWireframe ? app.selected : null,
          only: action === 'make-video-one'
        })
      )
      syncSceneChoice(app.dialog)
    }
  }
  if (action === 'make-scene' && target.dataset.sceneId) {
    app.snapshot = await api.makeScene(id, target.dataset.sceneId)
    if (app.dialog.open) app.dialog.close()
    app.render()
  }
  if (action === 'leave-out-scene') {
    const scene = app.snapshot.project.video?.scenes[app.selected]
    if (scene) {
      app.snapshot = await api.leaveOutScene(id, scene.id)
      if (app.dialog.open) app.dialog.close()
      app.render()
    }
  }
  // The wireframe and its scene, each a click from the other.
  if (action === 'open-scene' || action === 'open-wireframe') {
    app.stopPractice()
    app.stage = action === 'open-scene' ? 'video' : 'presentation'
    app.selectedPlan = null
    app.momentIndex = 0
    app.second = 0
    app.render()
  }
  // From practice: make the scene's animation without leaving practice; the
  // stage shows it when it is ready.
  if (action === 'make-animation') {
    const scene = app.snapshot.project.video?.scenes[app.selected]
    if (scene) {
      app.snapshot = await api.produceScene(id, scene.id)
      app.render()
    }
  }
  if (action === 'pip-toggle') {
    app.pipClosed = !app.pipClosed
    app.render()
  }
  if (action === 'produce-video') {
    if (app.snapshot.views?.video.action === 'export')
      await downloadVideo(id, target)
    else {
      app.snapshot = await api.produceVideo(id)
      app.render()
    }
  }
  if (action === 'preview-video') {
    app.stopPractice()
    app.wholeVideo = !app.wholeVideo
    app.render()
    if (app.wholeVideo)
      void app.root
        .querySelector<HTMLVideoElement>('[data-whole-video]')
        ?.play()
        .catch(() => {})
  }
  if (action === 'download-scene')
    await downloadVideo(
      id,
      target,
      app.snapshot.project.video!.scenes[app.selected].id
    )
  if (target.dataset.transition) {
    const index = Number(target.dataset.transition)
    app.showDialog(
      `<h2>Between scenes ${index + 1} and ${index + 2}</h2>
<div class="transition-choices">
${(
  [
    'none',
    'crossfade',
    'push-left',
    'push-right',
    'push-up',
    'wipe',
    'zoom'
  ] as const
)
  .map(
    (value) =>
      `<button data-transition-index="${index}" data-transition-value="${value}">${value.replace(
        /-/g,
        ' '
      )}</button>`
  )
  .join('')}</div>`
    )
  }
  if (target.dataset.transitionValue) {
    app.snapshot = await api.transition(
      id,
      Number(target.dataset.transitionIndex),
      target.dataset.transitionValue as Transition
    )
    app.dialog.close()
    app.render()
  }
  if (action === 'history') app.showDialog(activityDialog(app.snapshot))
  if (action === 'moment-actions') {
    app.stopPractice()
    app.momentIndex = Number(target.dataset.menuMoment)
    const scene = app.snapshot.project.video!.scenes[app.selected],
      moment = scene.moments[app.momentIndex]
    if (!moment) return
    app.second = moment.start
    const player = app.root.querySelector<HTMLVideoElement>(
      '[data-scene-player]'
    )
    if (player) {
      player.pause()
      player.currentTime = player.hasAttribute('data-whole-video')
        ? videoSecond(app.snapshot.project, app.selected, app.second)
        : player.hasAttribute('data-animation-player')
          ? animationSecond(scene, app.second, true)
          : app.second
    }
    app.render()
    const state =
      app.snapshot.views?.moments[momentViewKey(scene.id, moment.id)]?.state
    app.showDialog(
      `<p class="eyebrow">MOMENT ${app.momentIndex + 1}</p>
<h2>
${escape(moment.title || 'Your part')}</h2>
<div class="moment-action-list">
${button('Practice this moment', 'practice')}${
        state === 'recorded'
          ? `<button type="button" data-retake="${app.momentIndex}">Retake this moment</button>`
          : app.snapshot.views?.scenes[scene.id].openMomentIds.includes(
                moment.id
              )
            ? button('Record this moment', 'record-moment')
            : ''
      }</div>`
    )
  }
  if (action === 'scene-settings') {
    if (target.dataset.settingsScene !== undefined) {
      app.selected = Number(target.dataset.settingsScene)
      app.momentIndex = 0
      app.second = 0
      app.render()
    }
    const scene = app.snapshot.project.video?.scenes[app.selected]
    if (!scene) return
    app.showDialog(
      sceneSettings(
        scene,
        app.snapshot.project.video!.settings,
        app.selected,
        sceneDisplay(app.snapshot, scene).inVideo !== false
      )
    )
  }
  if (target.dataset.presence) {
    const scene = app.snapshot.project.video!.scenes[app.selected]
    const preview = await api.previewPresence(
      id,
      scene.id,
      target.dataset.presence === 'inherit'
        ? null
        : (target.dataset.presence as Presence)
    )
    app.showDialog(
      `<h2>Re-plan scene ${app.selected + 1}</h2>
<p>
${escape(preview.message)}</p>
<button class="primary" data-action="confirm-replan" data-value="${
        preview.to === null ? 'inherit' : preview.to
      }">Re-plan scene ${app.selected + 1}</button>
`
    )
  }
  if (action === 'confirm-replan') {
    app.snapshot = await api.replan(
      id,
      app.snapshot.project.video!.scenes[app.selected].id,
      target.dataset.value === 'inherit'
        ? null
        : (target.dataset.value as Presence)
    )
    app.dialog.close()
    app.render()
  }
}
