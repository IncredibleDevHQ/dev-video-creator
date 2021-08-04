import { atom } from 'recoil'
import { FlickFragment } from '../generated/graphql'

export const currentFlickStore = atom<FlickFragment | null>({
  key: 'flick',
  default: null,
})
