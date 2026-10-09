// A copy of a map page for an episode, and a page's version: what a copy of
// it shows and says. A copy keeps the map's script as its base, so the
// episode's segues can be written around it.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import { readRow, writeRow } from './persistence'
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

/**
 * The map's evidence and outline, for an episode's own changes and video:
 * its source with every note added so far, and the outline scenes of the
 * pages it has copies of. Run whenever an episode gains copies, and when a
 * note lands on the map.
 */
export const syncEvidence = async (map: string, episode: string) => {
  const retained = await readRow<{
    source: unknown
    brand: unknown
    outline?: { scenes: unknown[] } & Record<string, unknown>
    slideIds?: string[]
  }>('outlines', map)
  const notebook = await readRow<Snapshot>('projects', episode)
  if (retained && notebook) {
    const at = (copy: Slide) =>
      retained.slideIds?.indexOf(copy.copyOf?.slide ?? '') ?? -1
    const kept = notebook.project.slides.filter((copy) => at(copy) >= 0)
    await writeRow('outlines', episode, {
      ...retained,
      ...(retained.outline
        ? {
            outline: {
              ...retained.outline,
              scenes: kept.map((copy) => retained.outline!.scenes[at(copy)])
            }
          }
        : {}),
      slideIds: kept.map((copy) => copy.id)
    })
  }
  for (const table of ['sources', 'source-briefs']) {
    const row = await readRow<object>(table, map)
    if (row) await writeRow(table, episode, row)
  }
}
