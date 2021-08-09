import { atom, RecoilState } from 'recoil'

// This is the structure of item of user flicks
export interface Flick {
  id: string
  name: string
  discription: string
}

// This is the list of user flicks
export type FlicksTypes = Flick[]
export interface FlicksList {
  userFlicksList: FlicksTypes
}

const BlankFlickList: FlicksList = {
  userFlicksList: [],
}

// Atom containing the user flicks

export const recoilFlicksArray: RecoilState<FlicksList> = atom({
  key: 'recoilFlicksArray',
  default: BlankFlickList,
})

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

const BlankSeriesFlickList: SelectedFlicksList = {
  seriesFlicksList: [],
}

// This is for Series Flick, with structure -> id, name, isChecked
// Atom for updating the series flick list

export const recoilSeriesFlicksArray: RecoilState<SelectedFlicksList> = atom({
  key: 'recoilSeriesFlicksArray',
  default: BlankSeriesFlickList,
})
