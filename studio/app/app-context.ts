import type { NotebookSummary, Snapshot } from '../shared/api'
import type { Moment, VideoSettings } from '../shared/model'
import { type HarnessChoices } from '../shared/api'
import { NotebookOpening } from './notebook-opening'
import { PracticePlayback } from './practice'
import { Recording } from './recording'
import { Settings } from './settings'

// Shared navigation/session state. Controllers own screen behavior; main composes them.
export interface AppContext {
  root: HTMLDivElement
  syncMediaRecovery: () => void
  snapshot: Snapshot | null
  notebooks: NotebookSummary[]
  refreshNotebooks: () => Promise<void>
  selected: number
  requestedStage: string | null
  stage: 'video' | 'notebook' | 'presentation'
  closeStream: (() => void) | null
  pending: boolean
  pendingSource: string
  aiChoices: HarnessChoices | null
  aiLoading: boolean
  showAllRecent: boolean
  ago: (iso: string) => string
  sourceHint: (value: string) => string
  fitSource: (field: HTMLTextAreaElement) => void
  momentIndex: number
  second: number
  wholeVideo: boolean
  startRehearsal: (() => Promise<void>) | null
  practiceStopAfter: number | null
  practiceMomentIds: string[]
  practiceCountdown: number
  practiceStarted: number
  practiceOpen: boolean
  practiceLoading: boolean
  practiceLines: string
  practice: PracticePlayback
  practiceRequest: number
  practiceStream: MediaStream | null
  cameraStarting: boolean
  finishPractice: () => void
  stopPractice: () => void
  replayPractice: () => Promise<void>
  recordingSceneId: string
  recordingProjectId: string
  recordingAttempt: Moment[]
  recordingFailed: (reason: unknown) => void
  capture: Recording
  dialogue: {
    mount: () => void
    paint: (at?: number) => void
    stop: () => void
    isPlaying: () => boolean
    isEditing: () => boolean
  }
  syncLayeredPlayback: () => void
  paintAnimationProgress: () => void
  syncAnimation: () => void
  pendingVideoSettings: VideoSettings | null
  pendingRecording: Moment[] | null
  prepareRecording: (
    moment: import('../shared/model').Moment,
    index: number
  ) => void
  prepareRecordingPass: (moments: import('../shared/model').Moment[]) => void
  dialogRevision: number
  dialog: HTMLDialogElement
  settingsScreen: Settings
  pendingChats: Set<string>
  liveConnected: boolean
  openingAutoStage: boolean
  opening: NotebookOpening
  openNotebook: (id: string, autoStage?: boolean) => Promise<void>
  renderStartScreen: () => void
  render: () => void
  sendChat: (request: import('../shared/api').ChatRequest) => Promise<void>
  attach: (value: Snapshot) => void
  error: (reason: unknown) => void
  showDialog: (content: string) => void
  showExplainer: () => void
  parameters: URLSearchParams
  saved: string | null
  dragged: number | null
  playheadFrame: number
  stopPlayhead: () => void
  animatePlayhead: (player: HTMLMediaElement) => void
}
