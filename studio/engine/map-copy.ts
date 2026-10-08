// A copy of a map page for an episode, and a page's version: what a copy of
// it shows and says. A copy keeps the map's script as its base, so the
// episode's segues can be written around it.
import { randomUUID } from 'node:crypto'
import type { Slide } from '../shared/model'
import { fingerprintOf } from './planning/fingerprint'

/** A page's version: what a copy of it shows and says. */
export const pageHash = (slide: Slide) =>
  fingerprintOf([slide.title, slide.svg, slide.narration, slide.idea])

const MAP_ONLY = ['fromNote', 'topic', 'aside', 'onlyIn'] as const
/** A copy of a map page for an episode: its own id, the map's script kept. */
export const copyOf = (map: string, slide: Slide): Slide => {
  const copy: Slide = JSON.parse(JSON.stringify(slide))
  for (const key of MAP_ONLY) delete copy[key]
  delete copy.draft
  return {
    ...copy,
    id: randomUUID(),
    copyOf: { notebook: map, slide: slide.id, hash: pageHash(slide) },
    base: slide.narration || ''
  }
}
