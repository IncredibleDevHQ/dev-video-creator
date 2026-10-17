export type PracticeClip = {
  momentId: string
  lines: string
  camera: boolean
  start: number
  end: number
  sceneStart: number
  sceneEnd: number
  objectKey?: string
}
export type PracticeTrack = {
  inputKey: string
  clips: PracticeClip[]
  duration: number
}
