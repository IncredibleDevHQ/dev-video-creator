import { atom } from 'recoil'

interface FragmentTemplate {
  id: string
  template: string
}

export const fragmentTemplateStore = atom<FragmentTemplate[]>({
  key: 'fragmentTemplates',
  default: [],
})
