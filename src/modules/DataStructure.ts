import { atom, RecoilState } from 'recoil'

export interface Flick {
  id: string
  name: string
}
export type FlicksTypes = Flick[]

export interface FlicksList {
  userFlicksList: FlicksTypes
}

export interface SeriesFlicks {
  id: string
  name: string
  isChecked: boolean
}

export type SeriesFlicksTypes = SeriesFlicks[]

export interface SelectedFlicksList {
  seriesFlicksList: SeriesFlicksTypes
}

const BlankFlickList: FlicksList = {
  userFlicksList: [],
}

export const recoilFlicksArray: RecoilState<FlicksList> = atom({
  key: 'recoilFlicksArray',
  default: BlankFlickList,
})

const BlankSeriesFlickList: SelectedFlicksList = {
  seriesFlicksList: [],
}

export const recoilSeriesFlicksArray: RecoilState<SelectedFlicksList> = atom({
  key: 'recoilSeriesFlicksArray',
  default: BlankSeriesFlickList,
})
