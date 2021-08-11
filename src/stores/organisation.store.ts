import { atom } from 'recoil'
import { OrganisationFragment } from '../generated/graphql'

export const organisationsStore = atom<OrganisationFragment[] | null>({
  key: 'organisations',
  default: null,
})
