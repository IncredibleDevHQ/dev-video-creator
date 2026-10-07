// A series: notebooks as its episodes, the repos they share, and what carries
// from one episode to the next (one look, threads, a short "previously").
// It stays open: one episode at a time, or an arc the agent proposes first.
import type { RepoLink } from './repos'
import type { Branding } from './settings'

/** One part of a planned arc: a working title and what it carries. */
export type SeriesPart = {
  title: string
  carries: string
  /** A template from the catalog that suits it, when the planner chose. */
  narrative?: string
}

export type SeriesEpisode = {
  notebookId: string
  number: number
  /** The arc part it was planned from, zero-based. */
  part?: number
  /** Each repo's branch head when the episode was started. */
  commits?: Record<string, string>
}

export type Series = {
  id: string
  title: string
  createdAt: string
  /** One episode at a time, or an arc planned up front. */
  growth: 'one' | 'arc'
  /** What the series is about, in the creator's words. */
  about: string
  arc?: { episodes: [number, number]; parts: SeriesPart[]; at: string }
  /** Set while the agent plans the arc, or when it could not. */
  planning?: { state: 'planning' | 'failed'; error?: string; at: string }
  episodes: SeriesEpisode[]
  repos: RepoLink[]
  /** Threads carried from one episode to the next. */
  threads: string[]
  /** The look every episode keeps, from the first. */
  branding?: Branding
}

/** On a notebook: the series it belongs to and what it carries over. */
export type EpisodeRef = {
  series: string
  number: number
  /** What the viewer saw last time, said in a line or two. */
  previously?: string
  threads?: string[]
  part?: SeriesPart
  /** What the last episode's numbers suggest for this one. */
  lessons?: string[]
}

export type SeriesSummary = {
  id: string
  title: string
  episodes: number
  planned: number | null
  updatedAt: string
}

export const ARC_RANGE: [number, number] = [3, 5]

/** The arc's next part: the first one no episode has taken. */
export const nextPart = (series: Series) => {
  const taken = new Set(series.episodes.map((item) => item.part))
  const index = series.arc?.parts.findIndex((_, at) => !taken.has(at)) ?? -1
  return index < 0 ? null : { index, part: series.arc!.parts[index] }
}
