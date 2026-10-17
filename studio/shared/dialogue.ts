import type { Moment } from './model'
export const wordsOf = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean)
export const estimateSpeech = (text: string) =>
  text.trim() ? Math.max(2, wordsOf(text).length / 2.5) : 0
/** Where the authored animation ends within a measured recording. */
export const dialogueBoundary = (moment: Moment) => {
  const e = moment.extension
  if (!e) return moment.end - moment.start
  const clips =
    moment.media?.inputKey === moment.audioKey ? moment.media.clips : null
  if (clips?.length && moment.segments?.length === clips.length)
    return clips[clips.length - 1].start
  return (
    ((moment.end - moment.start) * e.baseSeconds) / (e.baseSeconds + e.seconds)
  )
}
export const dialogueWordAt = (moment: Moment, second: number) => {
  const e = moment.extension,
    at = Math.max(0, second - moment.start),
    duration = moment.end - moment.start
  const base = wordsOf(e?.baseLines ?? moment.lines),
    boundary = dialogueBoundary(moment)
  if (e && at >= boundary)
    return (
      base.length +
      Math.min(
        wordsOf(e.text).length - 1,
        Math.floor(
          ((at - boundary) / Math.max(0.01, duration - boundary)) *
            wordsOf(e.text).length
        )
      )
    )
  return Math.min(
    base.length - 1,
    Math.floor((at / Math.max(0.01, boundary)) * base.length)
  )
}
