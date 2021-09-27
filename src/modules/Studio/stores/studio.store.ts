import { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng'
import { atom } from 'recoil'
import { StudioFragmentFragment } from '../../../generated/graphql'
import { RTCUser } from '../hooks/use-agora'

export type StudioState =
  | 'ready'
  | 'recording'
  | 'preview'
  | 'upload'
  | 'countDown'
  | 'finalSplash'
export interface StudioProviderProps<T = any, S = any> {
  stream: MediaStream
  getBlobs: () => Promise<Blob>
  tracks: [IMicrophoneAudioTrack, ICameraVideoTrack] | null
  reset: () => void
  upload: () => void

  startRecording: () => void
  stopRecording: () => void
  showFinalTransition: () => void

  togglePresenterNotes?: (to: boolean) => void

  fragment?: StudioFragmentFragment

  picture?: string
  cameraDevices: MediaDeviceInfo[]
  microphoneDevices: MediaDeviceInfo[]
  selectedCameraDeviceId: string
  selectedMicrophoneDeviceId: string

  mute: (type: 'audio' | 'video') => Promise<void>

  constraints?: MediaStreamConstraints
  state: StudioState

  users: RTCUser[]

  payload: S | null
  participants: T | null
  isHost: boolean
  updatePayload?: (value: S) => void
  updateParticipant?: (value: T) => void

  participantId?: string
}

const studioStore = atom<StudioProviderProps>({
  key: 'studio',
  default: {} as StudioProviderProps,
  dangerouslyAllowMutability: true,
})

export default studioStore
