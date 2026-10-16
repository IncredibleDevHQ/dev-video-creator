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
  /** What the episode does in the series, from the last plan. */
  outline?: EpisodeOutline
}

/** An episode's place in what the series teaches: what the viewer can do
 * after it, what it teaches, and what it needs from earlier (an episode
 * that taught it, or a gap no card fills yet). */
export type EpisodeOutline = {
  win: string
  teaches: string[]
  needs: Array<{ what: string; from?: string; gap?: string }>
  /** The through-lines it carries, by id. */
  lines: string[]
}

/** A line that runs through the series, from episode to episode. */
export type ThroughLine = { id: string; name: string; line: string }

/** Something the series needs that no card covers. */
export type SeriesGap = {
  id: string
  missing: string
  /** The episode that needs it (its notebook), when one does. */
  episode?: string
  why: string
  /** The question that would fill it, put to the creator. */
  ask: string
  state: 'open' | 'explained' | 'ignored' | 'closed'
  /** The card that closed it. */
  closedBy?: string
  /** Why a later plan no longer needed it, when no card closed it. */
  resolved?: string
}

/** The creator's guidance for the plan, as a note on the canvas: about the
 * whole series, one episode, or some cards. */
export type Direction = {
  id: string
  text: string
  at: string
  /** What it is wired to; neither means the whole series. */
  to?: { episode?: string; pages?: string[] }
  /** Where it sits on the canvas, in world units. */
  spot?: { x: number; y: number }
  /** How the last plan took it. */
  answer?: { state: 'followed' | 'partly' | 'not'; why: string; at: string }
}

/** A viewer's-eye note on one episode of the plan. */
export type ViewerFlag = {
  episode: string
  kind: 'confusing' | 'slow' | 'overloaded' | 'assumes'
  line: string
}

/** One organising run: the new cards it placed, and how to take them out. */
export type OrganizeRun = {
  id: string
  at: string
  moves: Array<{
    page: string
    title: string
    kind: 'into' | 'new' | 'closes' | 'left'
    /** The episode it went into (or started), when it went in. */
    episode?: string
    /** The copy made in it, for Undo. */
    copy?: string
    why?: string
  }>
  /** Episodes this run started, taken out again by Undo. */
  started: string[]
  /** Directions this run answered again, with their answer before. */
  answered?: Array<{ id: string; before?: Direction['answer'] }>
  undone?: boolean
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
  /** The notebook whose wireframes the episodes copy (the content map). */
  map?: string
  /** The creator's own ideas for the episodes, in their words. */
  ideas?: string
  /** How long each episode runs: a range, and whether it must fit. */
  length?: import('./storyboard').LengthGoal
  /** Keep planning: pages drawn later are placed into the episodes.
   * Read with `organizes()`; `organize` is the current name. */
  autoplan?: boolean
  organize?: boolean
  /** The series' through-line and the pages the last plan left out. */
  through?: string
  left?: string[]
  /** What a viewer can do by the end, and who the series is for; the
   * planner's proposals are listed in `suggested` until the creator edits. */
  outcome?: string
  audience?: string
  suggested?: Array<'outcome' | 'audience'>
  directions?: Direction[]
  lines?: ThroughLine[]
  gaps?: SeriesGap[]
  flags?: ViewerFlag[]
  /** The last organising runs, newest last. */
  organized?: OrganizeRun[]
  /** New cards being organised into the episodes, or why they were not. */
  organizing?: { state: 'organizing' | 'failed'; error?: string; at: string }
  /** Cards the creator took back from organising: they wait unused until
   * placed by hand or by a new plan. */
  held?: string[]
}

/** New cards organise themselves into the episodes, unless turned off. */
export const organizes = (series: Pick<Series, 'organize' | 'autoplan'>) =>
  series.organize ?? series.autoplan ?? true

/** On a notebook: the series it belongs to and what it carries over. */
export type EpisodeRef = {
  series: string
  number: number
  /** What the viewer saw last time, said in a line or two. */
  previously?: string
  threads?: string[]
  part?: SeriesPart
  /** The creator named it: plans keep its name. */
  named?: boolean
  /** What the last episode's numbers suggest for this one. */
  lessons?: string[]
  /** The length the series asks of each episode. */
  length?: import('./storyboard').LengthGoal
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
