import { ILocalVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng'
import { atom } from 'recoil'
import {
  RecordedBlocksFragment,
  StudioFragmentFragment,
  ThemeFragment,
} from '../../../generated/graphql'
import { AudioType, MusicAction } from '../../../hooks/use-canvas-recorder'
import { CodeTheme } from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { RTCUser } from '../hooks/use-video'

export type StudioState =
  | 'ready'
  | 'start-recording'
  | 'recording'
  | 'preview'
  | 'upload'
  | 'resumed'
  | 'countDown'
  | 'finalSplash'

export interface StaticAssets {
  shortsBackgroundMusic: string
}
export interface StudioProviderProps<T = any, S = any> {
  stream: MediaStream
  getBlobs: () => Promise<Blob | undefined>
  tracks: [IMicrophoneAudioTrack, ILocalVideoTrack] | null
  reset: () => void
  upload: (id: string) => void

  continuousRecording: boolean

  recordingId?: string

  startRecording: () => void
  stopRecording: () => void
  addMusic: ({
    type,
    volume,
    musicURL,
    action,
  }: {
    type?: AudioType
    volume?: number
    musicURL?: string
    action?: MusicAction
  }) => void
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
  theme: ThemeFragment

  participantId?: string
  // config to render controls
  controlsConfig?: any
  shortsMode?: boolean

  staticAssets?: StaticAssets

  preloadedBlobUrls?: {
    [key: string]: string | undefined
  }

  codes?: {
    [key: string]: {
      code: string | undefined
      colorCode: any
      theme: CodeTheme
    }
  }

  recordedBlocks?: RecordedBlocksFragment[]
}

const studioStore = atom<StudioProviderProps>({
  key: 'studio',
  default: {
    theme: {
      name: 'DarkGradient',
      config: {},
    },
  } as StudioProviderProps,
  dangerouslyAllowMutability: true,
})

export default studioStore
