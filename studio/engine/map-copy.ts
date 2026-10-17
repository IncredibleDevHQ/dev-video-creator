// A copy of a map page for an episode, and a page's version: what a copy of
// it shows and says. A copy keeps the map's script as its base, so the
// episode's segues can be written around it.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import { addEvent } from './activity'
import { withDeck } from './deck-lock'
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

/** An episode whose video has started is made: plans keep it as it is. */
export const isMade = (snapshot: Snapshot | null) => {
  const video = snapshot?.project.video
  return Boolean(
    video &&
    (video.produced ||
      video.storyboard ||
      video.scenes.some((scene) => scene.phase !== 'idle' || scene.produced))
  )
}

/**
 * An episode the creator approved or made: its copies wait for their Update.
 * One whose storyboard is still a plan follows its cards like one with no
 * video; its plan is then marked to be made again, never stale, and no paid
 * run starts by itself (review 8 F08: any storyboard made every copy wait).
 */
export const waitsForCreator = (snapshot: Snapshot) => {
  const video = snapshot.project.video
  const board = video?.storyboard
  const planning = board?.stage === 'plan' || board?.stage === 'review'
  return Boolean(
    video &&
    (video.produced ||
      (board && (board.approved || board.produced || !planning)) ||
      video.scenes.some((scene) => scene.phase !== 'idle' || scene.produced))
  )
}

/** A copy as it came from the map: nothing in it edited in the episode. */
export const untouched = (copy: Slide) =>
  pageHash({ ...copy, narration: copy.base || '' }) === copy.copyOf?.hash

/**
 * A copy brought up to its map card, by the map's Update or by itself: the
 * same id, and what the episode added to it kept, its lines in and out, its
 * product capture and the creator's answers (review 8: Update dropped them).
 */
export const updatedCopy = (mapId: string, copy: Slide, original: Slide) => {
  const fresh: Slide = {
    ...copyOf(mapId, original),
    id: copy.id,
    ...(copy.bridge ? { bridge: copy.bridge } : {}),
    ...(copy.outro ? { outro: copy.outro } : {}),
    ...(copy.capture ? { capture: copy.capture } : {}),
    ...(copy.answers ? { answers: copy.answers } : {})
  }
  fresh.narration = composeNarration(fresh)
  return fresh
}

/** The map's card as it is now, for a copy that is behind it and was never
 * edited nor kept on purpose. */
export const caughtUp = (mapId: string, copy: Slide, original: Slide) => {
  const now = pageHash(original)
  if (
    now === copy.copyOf?.hash ||
    now === copy.copyOf?.kept ||
    !untouched(copy)
  )
    return null
  return updatedCopy(mapId, copy, original)
}

/**
 * A map card changed (a note added to it, say): the episodes not approved
 * nor made follow it in every copy no one edited or kept, and their segues
 * are written again around it. An edited or kept copy, or one in an episode
 * approved or made, waits for the creator's Update or Keep (review 8 F08:
 * each copy needed its own Update after every note).
 */
export const catchUpCopies = async (mapId: string, slideId: string) => {
  // Under the map's deck lock, the card read inside it: a hand edit and a
  // redraw close together follow one after the other, so neither leaves a
  // copy on the older card (review 8).
  const followed = await withDeck(mapId, async () => {
    const map = await loadProject(mapId)
    const original = map?.project.slides.find((slide) => slide.id === slideId)
    const series = map?.project.mapSeries
      ? await loadSeries(map.project.mapSeries)
      : null
    const episodes: string[] = []
    if (!original?.svg || !series) return episodes
    for (const { notebookId } of series.episodes) {
      if (!(await loadProject(notebookId))) continue
      let updated = false
      await changeProject(notebookId, (current) => {
        // An episode approved or made keeps its copies until the creator
        // updates them: following would make its video stale.
        if (waitsForCreator(current)) return
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
      if (updated) episodes.push(notebookId)
    }
    return episodes
  })
  for (const notebookId of followed) {
    await planScenes(notebookId)
    await scheduleAround(notebookId)
  }
}

const following = new Set<Promise<void>>()
/** A card's script edited by hand: its copies follow in the background,
 * once the deck is free (a redraw running holds it for minutes). */
export const followCard = (mapId: string, slideId: string) => {
  const job: Promise<void> = catchUpCopies(mapId, slideId)
    .catch(() => {})
    .finally(() => following.delete(job))
  following.add(job)
}
/** Resolves when the copies following a hand edit have (tests and checks). */
export const settledFollowing = async () => {
  while (following.size) await Promise.all([...following])
}
