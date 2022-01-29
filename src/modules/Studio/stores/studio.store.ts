import { ILocalVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng'
import { atom } from 'recoil'
import { StudioFragmentFragment } from '../../../generated/graphql'
import { AudioType } from '../../../hooks/use-canvas-recorder'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { RTCUser } from '../hooks/use-video'

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
  tracks: [IMicrophoneAudioTrack, ILocalVideoTrack] | null
  reset: () => void
  upload: () => void

  startRecording: () => void
  stopRecording: () => void
  showFinalTransition: () => void
  addMusic: (type?: AudioType, volume?: number) => void
  reduceSplashAudioVolume: (volume: number) => void
  stopMusic: () => void

  fragment?: StudioFragmentFragment

  mute: (type: 'audio' | 'video') => Promise<void>

  constraints?: MediaStreamConstraints
  state: StudioState

  users: RTCUser[]

  payload: S | null
  participants: T | null
  isHost: boolean
  updatePayload?: (value: S) => void
  updateParticipant?: (value: T) => void

  branding?: BrandingJSON | null

  participantId?: string
  // config to render controls
  controlsConfig?: any
  shortsMode?: boolean
}

const studioStore = atom<StudioProviderProps>({
  key: 'studio',
  default: {} as StudioProviderProps,
  dangerouslyAllowMutability: true,
})

export default studioStore
