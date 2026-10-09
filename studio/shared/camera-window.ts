import type { Moment } from './model'
export const cameraAt = (moment: Moment, second: number) => {
  const local = second - moment.start
  if (local < 0 || second >= moment.end) return false
  if (moment.media?.inputKey === moment.audioKey)
    return moment.media.clips.some(
      (clip) => clip.camera && local >= clip.start && local < clip.end
    )
  if (!moment.segments?.length) return moment.camera === 'full'
  const estimate = moment.segments.reduce(
    (sum, segment) => sum + segment.estimate,
    0
  )
  const scale = (moment.end - moment.start) / estimate
  let at = 0
  for (const segment of moment.segments) {
    at += segment.estimate * scale
    if (local < at) return segment.camera
  }
  return false
}
