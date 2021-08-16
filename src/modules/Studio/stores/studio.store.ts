import { atom } from 'recoil'
import { StudioFragmentFragment } from '../../../generated/graphql'
import { RTCUser } from '../hooks/use-agora'

export type StudioState = 'ready' | 'recording' | 'preview' | 'upload'
export interface StudioProviderProps {
  stream: MediaStream
  getBlobs: () => Blob

  reset: () => void
  upload: () => void

  startRecording: () => void
  stopRecording: () => void

  togglePresenterNotes?: (to: boolean) => void

  fragment?: StudioFragmentFragment

  picture?: string

  constraints?: MediaStreamConstraints
  state: StudioState

  users: RTCUser[]
}

const studioStore = atom<StudioProviderProps | null>({
  key: 'studio',
  default: null,
  dangerouslyAllowMutability: true,
})

export default studioStore
