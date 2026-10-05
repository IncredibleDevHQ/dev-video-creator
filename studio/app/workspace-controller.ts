import { themeControl } from './appearance'
import { animationSecond } from '../shared/scene-time'
import { videoSecond } from '../shared/video-clock'
import { api } from './api'
import type { AppContext } from './app-context'
import incredibleLogo from './assets/incredible-logo.svg'
import { seekSavedMedia } from './media-seek'
import { movePlayhead } from './moment-timeline'
import { notebookOpeningView } from './notebook-opening'
import { notebookScreen } from './notebook-screen'
import { replacePlayerView } from './player-view'
import { practiceControls, recordControl } from './practice-controls'
import { presentationScreen } from './presentation-screen'
import { standInControls } from './stand-in-playback'
import { followTranscript, transcriptWords } from './transcript-follow'
import { escape } from './ui'
import { videoScreen } from './video-screen'
import { workspaceHeader } from './workspace-header'
import { workspaceUrl } from './workspace-position'
import { syncLookPreview } from './look-panel'
import { markPin } from './wireframe-pin'
import { syncPlayerBar } from './player-bar'

export const createRender = (app: AppContext) => () => {
  if (app.settingsScreen.isOpen) return
  const selection = getSelection()
  const editSelection =
    document.activeElement?.closest('.dialogue-studio') && selection?.anchorNode
      ? {
          anchor: selection.anchorNode,
          offset: selection.anchorOffset,
          focus: selection.focusNode,
          end: selection.focusOffset
        }
      : null
  const contextKey = [app.snapshot?.project.id, app.stage, app.selected].join(
    ':'
  )
  const sameContext = app.root.dataset.context === contextKey
  app.root.dataset.context = contextKey
  const previousPlayer =
    app.root.querySelector<HTMLMediaElement>(
      '[data-scene-player],[data-take-player],[data-saved-presenter]'
    ) || app.root.querySelector<HTMLMediaElement>('[data-rehearsal-animation]')
  const playback = previousPlayer
    ? {
        src: previousPlayer.getAttribute('src'),
        time: previousPlayer.currentTime,
        playing: !previousPlayer.paused
      }
    : null
  const focused =
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
      ? document.activeElement
      : null
  const focusedId = sameContext ? focused?.id : null
  const drafts = sameContext
    ? [
        ...app.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input,textarea'
        )
      ]
        .filter((field) => field.id)
        .map((field) => ({ id: field.id, value: field.value }))
    : []
  if (!app.snapshot && app.opening.state) {
    replacePlayerView(
      app.root,
      `<header>
<a class="brand" href="/" aria-label="Incredible Studio">
<img src="${incredibleLogo}" alt="">Incredible</a>
<div class="header-actions">${themeControl()}</div></header>
${notebookOpeningView(app.opening.state)}`,
      null
    )
    app.syncMediaRecovery()
    return
  }
  if (!app.snapshot) {
    app.renderStartScreen()
    const sourceField =
      app.root.querySelector<HTMLTextAreaElement>('#source-input')
    app.syncMediaRecovery()
    if (sourceField) {
      sourceField.value =
        drafts.find((draft) => draft.id === 'source-input')?.value ??
        app.pendingSource
      app.fitSource(sourceField)
    }
    if (focusedId && !app.dialog.open)
      document.getElementById(focusedId)?.focus()
    return
  }
  const { project } = app.snapshot
  if (app.snapshot.sourceOnly && !project.slides.length) app.stage = 'notebook'
  // An outline scene that has since been drawn opens as its wireframe.
  if (app.selectedPlan) {
    const drawn = project.slides.findIndex(
      (slide) => slide.id === app.selectedPlan
    )
    if (
      drawn >= 0 ||
      !app.snapshot.plan?.some((p) => p.id === app.selectedPlan)
    ) {
      if (drawn >= 0) app.selected = drawn
      app.selectedPlan = null
    }
  }
  app.selected = Math.max(0, Math.min(app.selected, project.slides.length - 1))
  const viewUrl = workspaceUrl(
    new URL(location.href),
    project,
    app.stage,
    app.selected,
    app.momentIndex
  )
  if (viewUrl.href !== location.href) history.replaceState(null, '', viewUrl)
  replacePlayerView(
    app.root,
    `${workspaceHeader(
      app.snapshot,
      app.stage,
      app.liveConnected
    )}<main class="workspace workspace-${app.stage}">
${
  app.stage !== 'notebook'
    ? `<div class="project-heading">
<h1>
${escape(project.title)}</h1>
</div>`
    : ''
}${
      app.stage === 'notebook'
        ? notebookScreen(app.snapshot, app.pendingChats.has(project.id))
        : app.stage === 'video'
          ? videoScreen(
              app.snapshot,
              app.selected,
              app.momentIndex,
              app.second,
              app.practiceOpen,
              app.capture,
              app.practiceStream,
              app.wholeVideo,
              app.liveConnected
            )
          : presentationScreen(
              app.snapshot,
              app.selected,
              app.pendingChats.has(project.id),
              app.liveConnected,
              { plan: app.selectedPlan, pin: app.pin }
            )
    }</main>`,
    previousPlayer
  )
  if (app.snapshot.readOnly) {
    for (const input of app.root.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input,textarea,select'))
      input.disabled = true
    for (const control of app.root.querySelectorAll<HTMLButtonElement>(
      'button'
    )) {
      const navigation =
        control.hasAttribute('data-stage') ||
        control.hasAttribute('data-slide') ||
        control.hasAttribute('data-scene') ||
        control.hasAttribute('data-moment')
      const reviewAction = [
        'history',
        'export',
        'download-scene',
        'preview-video',
        'back'
      ].includes(control.dataset.action || '')
      if (!navigation && !reviewAction) control.disabled = true
    }
  }
  if (!app.liveConnected)
    app.root.insertAdjacentHTML(
      'beforeend',
      '<div class="connection-notice" role="status">Live updates disconnected. Reconnecting… Your saved work remains available.</div>'
    )
  const player = app.root.querySelector<HTMLVideoElement>('[data-scene-player]')
  if (player) {
    const sameSource =
      previousPlayer === player && playback?.src === player.getAttribute('src')
    if (sameSource) {
      // Keep the loaded media element and its buffer across progress snapshots.
      // Recreating it seeks and reloads on every scene update.
      previousPlayer.toggleAttribute(
        'data-whole-video',
        player.hasAttribute('data-whole-video')
      )
      // replacePlayerView retained this connected element and its decoded frame.
      if (playback.playing) {
        void previousPlayer.play().catch(() => {})
        app.animatePlayhead(player)
      }
    } else {
      const start = player.hasAttribute('data-whole-video')
        ? videoSecond(project, app.selected, app.second)
        : player.hasAttribute('data-animation-player')
          ? animationSecond(
              project.video!.scenes[app.selected],
              app.second,
              true
            )
          : app.second
      if (start > 0) seekSavedMedia(player, start)
    }
  }
  app.syncMediaRecovery()
  app.syncAnimation()
  app.syncLayeredPlayback()
  followTranscript(
    app.root,
    app.snapshot?.project.video?.scenes[app.selected]?.moments || [],
    app.second,
    app.momentIndex
  )
  movePlayhead(
    app.root,
    project.video?.scenes[app.selected]?.moments || [],
    app.second
  )
  const camera = app.root.querySelector<HTMLVideoElement>('video[data-camera]')
  const paintCameraStarting = () => {
    app.root.querySelector('.camera-starting')?.remove()
    const control = app.root.querySelector<HTMLButtonElement>(
      '[data-action="practice-camera"]'
    )
    if (app.cameraStarting) {
      if (control) {
        control.disabled = true
        control.textContent = 'Starting camera…'
      }
      const label = app.root.querySelector<HTMLButtonElement>(
        '[data-action="practice-camera-off"]'
      )
      if (label) label.querySelector('span')!.textContent = 'Starting…'
      app.root
        .querySelector('.presenter-preview')
        ?.insertAdjacentHTML(
          'beforeend',
          '<div class="camera-starting" role="status"><span class="activity-orbit" aria-hidden="true"></span><span>Starting camera…</span></div>'
        )
    }
  }
  if (camera && (app.capture.stream || app.practiceStream)) {
    const stream = app.capture.stream || app.practiceStream
    if (camera.srcObject !== stream) camera.srcObject = stream
    if (app.practiceStream) {
      app.cameraStarting = camera.readyState < 2
      camera.onplaying = () => {
        app.cameraStarting = false
        app.root.querySelector('.camera-starting')?.remove()
        const label = app.root.querySelector(
          '[data-action="practice-camera-off"]'
        )
        if (label) label.querySelector('span')!.textContent = 'Camera on'
      }
    }
    void camera.play().catch(() => {
      app.cameraStarting = false
      app.root.querySelector('.camera-starting')?.remove()
      app.error(
        new Error(
          'Camera preview could not start. Exit practice and try again.'
        )
      )
    })
  }
  paintCameraStarting()
  if (app.practiceLoading) {
    const button = app.root.querySelector<HTMLButtonElement>(
      '[data-action="practice"]'
    )
    if (button) button.textContent = 'Cancel preparation'
  }
  if (app.practiceOpen && app.startRehearsal) {
    app.root
      .querySelector('.video-stage')
      ?.insertAdjacentHTML('beforeend', standInControls())
    app.root
      .querySelector('[data-animation-status]')
      ?.setAttribute('hidden', '')
  }
  app.paintAnimationProgress()
  if (app.practiceOpen) {
    const phase = app.startRehearsal
      ? 'ready'
      : app.practiceCountdown
        ? 'countdown'
        : app.practice.active
          ? 'running'
          : 'finished'
    if (phase === 'ready' || phase === 'finished')
      app.root
        .querySelector('.practice-panel-heading')
        ?.insertAdjacentHTML('beforeend', recordControl())
    const panel = app.root.querySelector('.practice-panel')
    const toolbar = document.createElement('div')
    toolbar.className = 'capture-toolbar'
    toolbar.setAttribute('aria-label', 'Camera and recording controls')
    panel
      ?.querySelectorAll('.practice-panel-heading>button')
      .forEach((control) => toolbar.append(control))
    if (toolbar.childElementCount) panel?.before(toolbar)
    const actions = app.root.querySelector('.video-actions>div:last-child')
    if (actions)
      actions.innerHTML = practiceControls(
        phase,
        app.practiceMomentIds.length > 1
          ? app.practiceMomentIds.at(-1) ===
            app.snapshot.project.video?.scenes[app.selected]?.moments[
              app.momentIndex
            ]?.id
            ? 'Finish practice'
            : 'Next moment'
          : undefined
      )
    const label = app.root.querySelector('[data-practice-clock]')
    if (label)
      label.textContent =
        phase === 'ready'
          ? 'Teleprompter'
          : phase === 'countdown'
            ? `Starting in ${app.practiceCountdown}…`
            : phase === 'finished'
              ? 'Practice complete'
              : 'Practice'
  }
  const transport = app.root.querySelector<HTMLButtonElement>(
    '[data-action="practice-toggle"]'
  )
  if (transport) {
    transport.textContent =
      app.practice.active && !app.practice.paused ? 'Ⅱ Pause' : '▶ Play'
    transport.setAttribute(
      'aria-label',
      app.practice.active && !app.practice.paused
        ? 'Pause practice'
        : 'Play practice'
    )
  }
  if (app.practice.active) {
    const cue = app.root.querySelector('.practice-cue>span')
    if (cue && cue.textContent !== app.practiceLines)
      cue.innerHTML = transcriptWords(app.practiceLines)
  }
  app.root
    .querySelector<HTMLButtonElement>('#video-chat button')
    ?.toggleAttribute('disabled', app.pendingChats.has(project.id))
  for (const draft of drafts) {
    const field = document.getElementById(draft.id)
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    )
      field.value = draft.value
  }
  if (focusedId) document.getElementById(focusedId)?.focus()
  app.dialogue.mount()
  if (editSelection?.anchor.isConnected && editSelection.focus?.isConnected) {
    app.root
      .querySelector<HTMLElement>('[data-ds=input]')
      ?.focus({ preventScroll: true })
    getSelection()?.setBaseAndExtent(
      editSelection.anchor,
      editSelection.offset,
      editSelection.focus,
      editSelection.end
    )
  }
  syncLookPreview(app.root)
  markPin(app.root, app.pin)
  syncPlayerBar(app.root)
}
