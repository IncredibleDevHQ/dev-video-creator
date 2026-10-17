// What the numbers say, in the story's words: retention drawn against the
// beats, so a drop reads as "people left during the setup", and what that
// suggests for the next episode.
import type { Project } from './model'
import type { NumbersSnapshot } from './release'
import { sceneTimes } from './release-plan'

export type BeatRetention = {
  title: string
  /** Seconds into the video. */
  start: number
  end: number
  /** The share of viewers still watching as the part starts and ends. */
  from: number
  to: number
}

/**
 * YouTube's retention, a hundred points across the video, read for each
 * part of the story: who was there when it began, and when it ended.
 */
export const retentionByBeat = (project: Project, retention: number[]) => {
  const parts = sceneTimes(project)
  const total = parts.at(-1)?.end || 0
  if (!total || retention.length < 2) return []
  const at = (second: number) => {
    const index = Math.min(
      retention.length - 1,
      Math.round((second / total) * (retention.length - 1))
    )
    return Math.round(retention[index] * 100) / 100
  }
  const merged: BeatRetention[] = []
  for (const part of parts) {
    const title = part.beats[0]?.name || part.title || 'Part'
    const last = merged.at(-1)
    if (last?.title === title) {
      last.end = part.end
      last.to = at(part.end)
    } else
      merged.push({
        title,
        start: part.start,
        end: part.end,
        from: at(part.start),
        to: at(part.end)
      })
  }
  return merged
}

/** Where the most viewers left, said in the story's words. */
export const biggestDrop = (beats: BeatRetention[]) => {
  const worst = [...beats].sort((a, b) => b.from - b.to - (a.from - a.to))[0]
  return worst && worst.from - worst.to > 0.05
    ? `People left during ${worst.title.toLowerCase()}: ${Math.round((worst.from - worst.to) * 100)} of every hundred`
    : null
}

/** What the numbers suggest for the next episode's plan. */
export const numberLessons = (beats: BeatRetention[]) => {
  if (beats.length < 2) return []
  const lessons: string[] = []
  const drop = (beat: BeatRetention) => beat.from - beat.to
  const first = beats[0]
  if (drop(first) >= 0.25) lessons.push('Open with the result: many left early')
  const worst = [...beats.slice(1)].sort((a, b) => drop(b) - drop(a))[0]
  if (worst && drop(worst) >= 0.12)
    lessons.push(
      `Shorten ${worst.title.toLowerCase()}: that is where people left`
    )
  const held = [...beats].sort((a, b) => drop(a) - drop(b))[0]
  if (held && drop(held) <= 0.03 && held !== worst)
    lessons.push(`More of what held: ${held.title.toLowerCase()}`)
  return lessons
}

/** The latest snapshot from a source. */
export const latest = (
  snapshots: NumbersSnapshot[] | undefined,
  source: NumbersSnapshot['source']
) =>
  [...(snapshots || [])]
    .filter((item) => item.source === source)
    .sort((a, b) => b.at.localeCompare(a.at))[0] || null
