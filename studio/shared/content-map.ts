// The content map: a notebook's wireframes, which keep growing as the creator
// adds notes, and the episodes copied from them. An episode never shares a
// page with the map: it holds a copy that remembers where it came from, so
// the map can say which episodes use each page and when an original changed.
import type { Snapshot } from './api'
import type { Slide } from './model'

/** A note added after the wireframes, and what it became in the map. */
export type MapNote = {
  id: string
  at: string
  text: string
  state: 'sorting' | 'sorted' | 'failed'
  results?: NoteResult[]
  error?: string
}
export type NoteResult = {
  kind: 'new' | 'adds' | 'covered'
  slideId: string
  title: string
  /** What the note said about it, in a line. */
  line: string
}

/** Where a copied page came from: the map, its page, and that page then. */
export type SlideCopy = {
  notebook: string
  slide: string
  hash: string
  /** The original's version the creator chose to keep this copy against. */
  kept?: string
}

/** One page of an episode, as the map's canvas shows it. */
export type MapCopy = {
  id: string
  title: string
  /** Left out when it is the map page's own drawing: the canvas has it. */
  svg?: string | null
  copyOf?: SlideCopy
  /** The episode's line into this page, and out of the last one. */
  bridge?: string
  outro?: string
  /** The map's page changed since this copy was made. */
  stale: boolean
  /** The map's page was deleted; the copy keeps its content. */
  orphan: boolean
  /** Its scene, when the episode has a video. */
  scene?: { phase: string; made: boolean }
}

export type MapEpisode = {
  notebook: string
  number: number
  title: string
  status: Snapshot['status']
  /** Writing the segues between its pages. */
  segues?: 'writing' | 'failed'
  /** Choosing its pages from what the creator said it is about. */
  picking?: { state: 'picking' | 'failed'; about: string }
  copies: MapCopy[]
  video: { scenes: number; made: number; joined: boolean } | null
  teasers: Array<{ id: string; channel: string; state: string }>
  posts: boolean
}

/** Everything the canvas needs: the map's pages, its series and episodes. */
export type MapView = {
  notebook: string
  title: string
  series: { id: string; title: string } | null
  episodes: MapEpisode[]
  /** For each page of the map, the episodes that hold a copy of it. */
  usage: Record<string, string[]>
}

/**
 * A page without the map's and the episode's bookkeeping: what a scene is
 * planned from, and what a redraw checks. Grouping, setting aside, cutting,
 * keeping a copy's version or noting what a segue was written for changes
 * none of what the page shows or says (a segue's words are in its script).
 */
export const pageContent = <T extends Slide>(slide: T) => {
  const {
    fromNote,
    topic,
    aside,
    onlyIn,
    copyOf,
    base,
    bridge,
    outro,
    bridgeFor,
    outroFor,
    ...content
  } = slide
  void [fromNote, topic, aside, onlyIn, copyOf, base, bridge, outro]
  void [bridgeFor, outroFor]
  return content
}

/** The topics the map's pages are grouped by, in order, with their pages. */
export const topicGroups = (
  slides: Array<{ id: string; topic?: string }>,
  topics: string[] = []
) => {
  const groups = topics
    .map((name) => ({
      name,
      slides: slides.filter((slide) => slide.topic === name).map((s) => s.id)
    }))
    .filter((group) => group.slides.length)
  const loose = slides.filter(
    (slide) => !slide.topic || !topics.includes(slide.topic)
  )
  if (loose.length)
    groups.push({ name: '', slides: loose.map((slide) => slide.id) })
  return groups
}

/** A page used by more than one episode of the series repeats itself. */
export const repeatsIn = (view: MapView, episode: string, slide?: string) =>
  slide ? (view.usage[slide] || []).filter((other) => other !== episode) : []

/** The map's pages no episode uses, leaving out those set aside. */
export const unusedPages = (
  slides: Array<{ id: string; aside?: boolean }>,
  view: MapView
) =>
  slides
    .filter((slide) => !slide.aside && !view.usage[slide.id]?.length)
    .map((slide) => slide.id)
