import { installAppearance } from './appearance'
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
installAppearance()
const app = {} as AppContext
app.root = document.querySelector<HTMLDivElement>('#app')!
app.syncMediaRecovery = savedMediaRecovery(app.root)
app.snapshot = null
app.notebooks = []
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
app.startRehearsal = null
app.practiceStopAfter = null
app.practiceMomentIds = []
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
app.recordingProjectId = ''
app.recordingAttempt = []
app.recordingFailed = createRecordingFailed(app)
app.capture = createCapture(app)
app.dialogue = createDialogue(app)
app.syncLayeredPlayback = createSyncLayeredPlayback(app)
app.paintAnimationProgress = createPaintAnimationProgress(app)
app.syncAnimation = createSyncAnimation(app)
app.pendingVideoSettings = null
app.pendingRecording = null
app.prepareRecording = createPrepareRecording(app)
app.prepareRecordingPass = createPrepareRecordingPass(app)
app.dialogRevision = 0
app.dialog = document.createElement('dialog')
app.dialog.id = 'dialog'
document.body.append(app.dialog)
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
  app.openingAutoStage = autoStage
  const url = new URL(location.href)
  if (url.searchParams.get('notebook') !== id) {
    url.searchParams.delete('scene')
    url.searchParams.delete('moment')
  }
  url.searchParams.set('notebook', id)
  url.searchParams.delete('project')
  history.replaceState(null, '', url)
  return app.opening.open(id)
}
app.renderStartScreen = createRenderStartScreen(app)
app.render = createRender(app)
app.sendChat = createSendChat(app)
app.attach = (value: Snapshot) => {
  app.liveConnected = true
  if (app.stage === 'video')
    ({
      selected: app.selected,
      momentIndex: app.momentIndex,
      second: app.second
    } = workspacePosition(value.project, new URL(location.href)))
  app.opening.reset()
  app.snapshot = value
  localStorage.setItem('minimal-studio-project', value.project.id)
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
  app.dialog.innerHTML = `${button('×', 'close')}<div class="dialog-body">
${content}</div>`
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
app.render()
app.parameters = new URLSearchParams(location.search)
app.saved =
  app.parameters.get('notebook') ||
  app.parameters.get('project') ||
  localStorage.getItem('minimal-studio-project')
if (app.saved) void app.openNotebook(app.saved)
else void app.refreshNotebooks().catch(app.error)
window.addEventListener('pagehide', () => {
  app.stopPractice()
  app.capture.dispose()
  if (app.settingsScreen.isOpen) app.settingsScreen.close()
  app.closeStream?.()
})
setInterval(() => updateProgressTimes(app.root), 10000)
