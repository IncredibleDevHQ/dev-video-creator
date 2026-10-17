import { ProjectShell } from './project-shell'
import { ResearchWorkspace } from './research-workspace'
import { showSeries } from './series-controller'
import { dialogContent } from './dialog-content'
import { TemplateGallery } from './template-gallery'
import { MapCanvas } from './map-canvas'
import { useTemplate } from './template-controller'
import { installAppearance } from './appearance'
import { installTooltips } from './tooltip'
import { showError } from './error-surface'
import type { Snapshot } from '../shared/api'
import { api } from './api'
import { installAppActions } from './app-actions'
import type { AppContext } from './app-context'
import { createSendChat } from './chat-controller'
import './dialogue-studio.css'
import { savedMediaRecovery } from './media-recovery'
import { NotebookOpening } from './notebook-opening'
import { updateProgressTimes } from './progress'
import {
  createCapture,
  createDialogue,
  createFinishPractice,
  createPractice,
  createPrepareRecording,
  createPrepareRecordingPass,
  createRecordingFailed,
  createReplayPractice,
  createStopPractice,
  installRecordingController
} from './recording-controller'
import { Settings } from './settings'
import { installSlidesController } from './slides-controller'
import { installWireframePin } from './wireframe-pin'
import { installPlayerBar } from './player-bar'
import { installStoryboardPlayback } from './storyboard-controller'
import {
  createAgo,
  createFitSource,
  createRefreshNotebooks,
  createRenderStartScreen,
  createSourceHint,
  installStartController
} from './start-controller'
import './style.css'
import { button } from './ui'
import {
  createAnimatePlayhead,
  createPaintAnimationProgress,
  createStopPlayhead,
  createSyncAnimation,
  createSyncLayeredPlayback,
  installVideoController
} from './video-controller'
import { createRender } from './workspace-controller'
import { workspacePosition } from './workspace-position'
import { storyboardViewAt } from './storyboard-controller'
import { syncPublishForm } from './release-controller'
import { keptMakeChoices } from './template-picker'
import { clickVideo } from './video-controller'
installAppearance()
installTooltips()
const app = {} as AppContext
app.projectShell = new ProjectShell(
  app,
  document.querySelector<HTMLDivElement>('#app')!
)
app.root = app.projectShell.editorRoot
app.researchWorkspace = new ResearchWorkspace(
  app.projectShell.researchRoot,
  () => {
    if (new URL(location.href).searchParams.has('space') || !location.search)
      void app.projectShell.go(new URL(location.href), false).catch(app.error)
    else location.reload()
  }
)
app.syncMediaRecovery = savedMediaRecovery(app.root)
app.snapshot = null
app.notebooks = []
app.series = []
app.refreshNotebooks = createRefreshNotebooks(app)
app.selected = 0
app.selectedPlan = null
app.pin = null
app.requestedStage = new URL(location.href).searchParams.get('view')
app.stage =
  app.requestedStage === 'notebook' ||
  app.requestedStage === 'video' ||
  app.requestedStage === 'presentation'
    ? app.requestedStage
    : 'notebook'
app.closeStream = null
app.pending = false
app.pendingSource = ''
app.showAllRecent = false
app.ago = createAgo(app)
app.sourceHint = createSourceHint(app)
app.fitSource = createFitSource(app)
app.momentIndex = 0
app.second = 0
app.wholeVideo = false
app.pipClosed = false
app.startRehearsal = null
app.practiceStopAfter = null
app.practiceMomentIds = []
// Practice plays the whole scene unless the creator picks one moment.
app.practiceScope = 'scene'
app.practiceCountdown = 0
app.practiceStarted = 0
app.practiceOpen = false
app.practiceLoading = false
app.practiceLines = ''
app.practice = createPractice(app)
app.practiceRequest = 0
app.practiceStream = null
app.cameraStarting = false
app.finishPractice = createFinishPractice(app)
app.stopPractice = createStopPractice(app)
app.replayPractice = createReplayPractice(app)
app.recordingSceneId = ''
app.sbView = null
app.sbSeek = null
app.sbRecord = null
app.recordingProjectId = ''
app.recordingAttempt = []
app.recordingFailed = createRecordingFailed(app)
app.capture = createCapture(app)
app.dialogue = createDialogue(app)
app.syncLayeredPlayback = createSyncLayeredPlayback(app)
app.paintAnimationProgress = createPaintAnimationProgress(app)
app.syncAnimation = createSyncAnimation(app)
app.pendingVideoSettings = null
app.prepareRecording = createPrepareRecording(app)
app.prepareRecordingPass = createPrepareRecordingPass(app)
app.dialogRevision = 0
app.dialog = document.createElement('dialog')
app.dialog.id = 'dialog'
document.body.append(app.dialog)
// A publish time set or cleared: the privacy choice follows it.
app.dialog.addEventListener('input', (event) => {
  const field = event.target as Element
  if (field.matches?.('[name="publishAt"]'))
    syncPublishForm(field.closest('form'))
})
app.dialog.addEventListener('close', () => {
  app.dialogRevision++
  app.pendingVideoSettings = null
})
app.settingsScreen = new Settings(
  app.root,
  () => app.snapshot?.project.id || null,
  () => app.render(),
  async () => {
    if (app.snapshot) app.snapshot = await api.load(app.snapshot.project.id)
  }
)
app.templateGallery = new TemplateGallery(
  app.root,
  // Left without a pick, the make dialog it was opened from comes back.
  () => {
    app.render()
    if (keptMakeChoices() && app.snapshot && !app.snapshot.project.video) {
      const make = document.createElement('button')
      make.dataset.action = 'make-video'
      void clickVideo(app, make, 'make-video').catch(app.error)
    }
  },
  (narrative, preset) =>
    void useTemplate(app, narrative, preset).catch(app.error)
)
app.mapCanvas = new MapCanvas(app.root, {
  close: () => {
    app.stage = 'presentation'
    const back = app.mapCanvas.from || app.mapCanvas.mapId
    if (app.snapshot?.project.id === back) app.render()
    else void app.openNotebook(back)
  },
  openEpisode: (id) => {
    app.mapCanvas.dismiss()
    app.stage = 'presentation'
    void app.openNotebook(id)
  },
  openPage: (id, index) => {
    app.mapCanvas.dismiss()
    app.stage = 'presentation'
    app.selected = index
    app.selectedPlan = null
    void app.openNotebook(id)
  },
  openStage: (stage) => {
    const back = app.mapCanvas.from || app.mapCanvas.mapId
    app.mapCanvas.dismiss()
    app.stage = stage
    if (app.snapshot?.project.id === back) app.render()
    else void app.openNotebook(back)
  },
  openKeys: () => {
    const { mapId, from } = app.mapCanvas
    app.mapCanvas.dismiss()
    void app.settingsScreen
      .open('keys', {
        label: '← Back to the map',
        go: () => void app.mapCanvas.open(mapId, from)
      })
      .catch(app.error)
  },
  project: (snapshot) => app.projectShell.sync(snapshot, true),
  error: showError
})
app.pendingChats = new Set<string>()
app.liveConnected = true
app.openingAutoStage = false
app.opening = new NotebookOpening(
  api.load,
  (value) => {
    if (app.openingAutoStage)
      app.stage = value.project.video
        ? 'video'
        : value.sourceOnly ||
            value.status === 'draft' ||
            value.status === 'reading'
          ? 'notebook'
          : 'presentation'
    app.attach(value)
  },
  () => app.render()
)
app.openNotebook = (id: string, autoStage = false) => {
  app.seriesPage = undefined
  app.openingAutoStage = autoStage
  const url = new URL(location.href)
  if (url.searchParams.get('notebook') !== id) {
    url.searchParams.delete('scene')
    url.searchParams.delete('moment')
  }
  url.searchParams.set('notebook', id)
  url.searchParams.delete('project')
  url.searchParams.delete('series')
  history.replaceState(null, '', url)
  return app.opening.open(id)
}
app.renderStartScreen = createRenderStartScreen(app)
app.render = createRender(app)
app.sendChat = createSendChat(app)
app.attach = (value: Snapshot) => {
  app.seriesPage = undefined
  app.liveConnected = true
  if (app.stage === 'video') {
    ;({
      selected: app.selected,
      momentIndex: app.momentIndex,
      second: app.second
    } = workspacePosition(value.project, new URL(location.href)))
    // A storyboard video opens on the scene its address names.
    app.sbView = storyboardViewAt(value.project, app.selected)
  }
  app.opening.reset()
  app.snapshot = value
  const notebookUrl = new URL(location.href)
  notebookUrl.searchParams.delete('project')
  notebookUrl.searchParams.set('notebook', value.project.id)
  history.replaceState(null, '', notebookUrl)
  app.closeStream?.()
  app.closeStream = api.subscribe(
    value.project.id,
    (update) => {
      if (
        (app.practice.active || app.practiceLoading) &&
        app.snapshot?.project.video?.scenes[app.selected]?.inputKey !==
          update.project.video?.scenes[app.selected]?.inputKey
      )
        app.stopPractice()
      app.snapshot = update
      app.render()
    },
    (connected) => {
      if (
        app.snapshot?.project.id === value.project.id &&
        app.liveConnected !== connected
      ) {
        app.liveConnected = connected
        app.render()
      }
    }
  )
  app.render()
}
app.error = showError
app.showDialog = (content: string) => {
  app.dialogRevision++
  app.dialog.innerHTML = dialogContent(content)
  if (!app.dialog.open) app.dialog.showModal()
}
app.playheadFrame = 0
app.stopPlayhead = createStopPlayhead(app)
app.animatePlayhead = createAnimatePlayhead(app)
app.dragged = null
installStartController(app)
installRecordingController(app)
installVideoController(app)
installAppActions(app)
installSlidesController(app)
installWireframePin(app)
installPlayerBar(app)
installStoryboardPlayback(app)
app.render()
app.parameters = new URLSearchParams(location.search)
app.saved = app.parameters.get('notebook') || app.parameters.get('project')
const mapParameter = app.parameters.get('map')
if (app.parameters.get('space'))
  void app.projectShell.go(new URL(location.href), false).catch(app.error)
else if (
  !mapParameter &&
  !app.saved &&
  !app.parameters.has('series') &&
  !app.parameters.has('legacy')
)
  void app.researchWorkspace.home()
else if (mapParameter) {
  app.projectShell.showStandalone()
  void app.mapCanvas.open(mapParameter)
} else if (app.parameters.get('series')) {
  app.projectShell.showStandalone()
  void showSeries(app, app.parameters.get('series')!, true).catch(app.error)
} else if (app.saved) {
  app.projectShell.showStandalone()
  void app.openNotebook(app.saved)
} else {
  app.projectShell.showStandalone()
  void app.refreshNotebooks().catch(app.error)
}
window.addEventListener('pagehide', () => {
  app.stopPractice()
  app.capture.dispose()
  if (app.settingsScreen.isOpen) app.settingsScreen.close(true)
  app.closeStream?.()
})
setInterval(() => updateProgressTimes(app.root), 10000)
