import { atom, RecoilState } from 'recoil'

export interface SeriesFlicks {
  id: string
  name: string
  description: string
  isChecked: boolean
}

export type SeriesFlicksTypes = SeriesFlicks[]

export interface SelectedFlicksList {
  seriesFlicksList: SeriesFlicksTypes
}

const blankSeriesFlickList: SelectedFlicksList = {
  seriesFlicksList: [],
}

export const recoilSeriesFlicksArray: RecoilState<SelectedFlicksList> = atom({
  key: 'recoilSeriesFlicksArray',
  default: blankSeriesFlickList,
})
