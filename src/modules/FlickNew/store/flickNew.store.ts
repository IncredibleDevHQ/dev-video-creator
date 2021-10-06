import { atom } from 'recoil'
import { FlickFragment } from '../../../generated/graphql'

interface NewFlickStore {
  flick: FlickFragment | null
  activeFragmentId: string
}

export const newFlickStore = atom<NewFlickStore>({
  key: 'flick',
  default: {
    flick: null,
    activeFragmentId: '',
  } as NewFlickStore,
})
