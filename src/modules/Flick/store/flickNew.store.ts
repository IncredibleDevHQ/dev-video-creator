import { atom } from 'recoil'
import { FlickFragment } from '../../../generated/graphql'

export enum View {
  Notebook = 'notebook',
  Preview = 'preview',
}

interface NewFlickStore {
  flick: FlickFragment | null
  activeFragmentId: string
  isMarkdown: boolean
  view: View
}

export const newFlickStore = atom<NewFlickStore>({
  key: 'newFlick',
  default: {
    flick: null,
    activeFragmentId: '',
    isMarkdown: true,
    view: View.Notebook,
  } as NewFlickStore,
})
