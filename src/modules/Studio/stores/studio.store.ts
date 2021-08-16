import { atom } from 'recoil'
import { StudioFragmentFragment } from '../../../generated/graphql'

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
}

const studioStore = atom<StudioProviderProps | null>({
  key: 'studio',
  default: null,
})

export default studioStore
