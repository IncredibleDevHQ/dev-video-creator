// A copy of a map page for an episode, and a page's version: what a copy of
// it shows and says. A copy keeps the map's script as its base, so the
// episode's segues can be written around it.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import { addEvent } from './activity'
import { composeNarration, planScenes, scheduleAround } from './map-segues'
import { readRow, writeRow } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { reconcileVideo } from './scene-model'
import { loadSeries } from './series'

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

/** A copy as it came from the map: nothing in it edited in the episode. */
export const untouched = (copy: Slide) =>
  pageHash({ ...copy, narration: copy.base || '' }) === copy.copyOf?.hash

/** The map's card as it is now, for a copy that is behind it and was never
 * edited nor kept on purpose: same id, the lines written around it kept. */
export const caughtUp = (mapId: string, copy: Slide, original: Slide) => {
  const now = pageHash(original)
  if (
    now === copy.copyOf?.hash ||
    now === copy.copyOf?.kept ||
    !untouched(copy)
  )
    return null
  const fresh: Slide = {
    ...copyOf(mapId, original),
    id: copy.id,
    ...(copy.bridge ? { bridge: copy.bridge } : {}),
    ...(copy.outro ? { outro: copy.outro } : {})
  }
  fresh.narration = composeNarration(fresh)
  return fresh
}

/**
 * A map card changed (a note added to it, say): the episodes not yet in
 * production follow it in every copy no one edited or kept, and their segues
 * are written again around it. An edited or kept copy, or one in an episode
 * whose video is being made, waits for the creator's Update or Keep (review
 * 8 F08: each copy needed its own Update after every note).
 */
export const catchUpCopies = async (mapId: string, slideId: string) => {
  const map = await loadProject(mapId)
  const original = map?.project.slides.find((slide) => slide.id === slideId)
  const series = map?.project.mapSeries
    ? await loadSeries(map.project.mapSeries)
    : null
  if (!original?.svg || !series) return
  for (const { notebookId } of series.episodes) {
    const episode = await loadProject(notebookId)
    const video = episode?.project.video
    const producing = Boolean(
      video &&
      (video.produced ||
        video.storyboard?.approved ||
        video.storyboard?.produced ||
        video.scenes.some((scene) => scene.produced))
    )
    if (!episode || producing) continue
    let updated = false
    await changeProject(notebookId, (current) => {
      current.project.slides = current.project.slides.map((slide) => {
        const fresh =
          slide.copyOf?.slide === slideId && !slide.copyOf.kept
            ? caughtUp(mapId, slide, original)
            : null
        if (!fresh) return slide
        updated = true
        return fresh
      })
      if (!updated) return
      reconcileVideo(current.project, current, new Set())
      addEvent(current, 'slide', `Updated “${original.title}” from the map`)
    })
    if (!updated) continue
    await planScenes(notebookId)
    await scheduleAround(notebookId)
  }
}
