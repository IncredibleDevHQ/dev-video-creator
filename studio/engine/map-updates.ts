// The map's Update and Keep for an episode's copies that wait behind their
// cards, Update all of an episode's at once, and their Undo (review 8 F08:
// each copy needed its own Update, and none could be undone). What a change
// replaced is kept on the episode, as a removal and a move are, so the map's
// Undo puts back these very copies with their scenes.
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import { addEvent } from './activity'
import { pageHash, updatedCopy } from './map-copy'
import { planScenes, scheduleAround } from './map-segues'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { reconcileVideo } from './scene-model'
import { storyboardSources } from './storyboard/source-state'

type Before = NonNullable<Snapshot['updatedCopies']>

/** What a copy shows and says, apart from the lines around it, which are
 * written again after an update: Undo checks a copy is still as left. */
const asLeft = (slide: Slide) => {
  const page: Partial<Slide> = { ...slide }
  for (const key of ['bridge', 'outro', 'bridgeFor', 'outroFor'] as const)
    delete page[key]
  delete page.narration
  return fingerprintOf(page)
}

/**
 * Brings copies up to their map cards, each from its card as it is when it
 * is written (one, or Update all of an episode's), or keeps one as it is.
 * Update all leaves a copy that caught up meanwhile as it is. Returns how
 * many changed; none, and the last change keeps its Undo.
 */
export const updateCopies = async (
  id: string,
  mapId: string,
  ids: string[],
  keep = false
) => {
  const one = ids.length === 1
  let changed: Slide[] = []
  await changeProject(id, async (current) => {
    const map = await loadProject(mapId)
    const cards = new Map((map?.project.slides || []).map((s) => [s.id, s]))
    const video = current.project.video
    const board = video?.storyboard
    const before: Before = {
      copies: [],
      ...(board
        ? {
            board: {
              id: board.id,
              sources: fingerprintOf(storyboardSources(current.project)),
              stale: board.stale,
              replan: board.replan
            }
          }
        : {})
    }
    changed = []
    for (const slideId of ids) {
      const index = current.project.slides.findIndex((s) => s.id === slideId)
      const now = current.project.slides[index]
      if (!now && one)
        throw new Refusal('That page is no longer in this episode')
      const original = now?.copyOf && cards.get(now.copyOf.slide)
      if (!original && one) throw new Refusal('The map no longer has this page')
      if (!original || (!one && pageHash(original) === now.copyOf!.hash))
        continue
      const next = keep
        ? { ...now, copyOf: { ...now.copyOf!, kept: pageHash(original) } }
        : updatedCopy(mapId, now, original)
      const scene = video?.scenes.find((s) => s.slideId === slideId)
      before.copies.push({
        slide: now,
        // Copied: putting the video right moves its scene on.
        ...(scene ? { scene: structuredClone(scene) } : {}),
        left: asLeft(next)
      })
      current.project.slides[index] = next
      changed.push(original)
    }
    if (!changed.length) return
    current.updatedCopies = before
    if (keep) return
    reconcileVideo(current.project, current, new Set())
    addEvent(
      current,
      'slide',
      changed.length === 1
        ? `Updated “${changed[0].title}” from the map`
        : `Updated ${changed.length} pages from the map`
    )
  })
  if (changed.length && !keep) {
    await planScenes(id)
    await scheduleAround(id)
  }
  return changed.length
}

/**
 * The map's Undo of the last Update or Keep in an episode: its copies as
 * they were, with their scenes, and the storyboard's flags once its pages
 * are again what it was made from. A copy changed since refuses it whole.
 */
export const undoUpdate = async (id: string) => {
  let board: Before['board']
  await changeProject(id, (current) => {
    const last = current.updatedCopies
    if (!last) throw new Refusal('That update can no longer be undone')
    const slides = current.project.slides
    if (
      last.copies.some(({ slide, left }) => {
        const now = slides.find((s) => s.id === slide.id)
        return !now || asLeft(now) !== left
      })
    )
      throw new Refusal('That page has changed since: nothing was undone')
    delete current.updatedCopies
    const video = current.project.video
    for (const { slide, scene } of last.copies) {
      slides[slides.findIndex((s) => s.id === slide.id)] = slide
      if (scene && video)
        video.scenes = video.scenes.map((s) =>
          s.slideId === slide.id ? scene : s
        )
    }
    reconcileVideo(current.project, current, new Set())
    const [first] = last.copies
    addEvent(
      current,
      'slide',
      last.copies.length === 1
        ? `Put “${first.slide.title}” back as it was`
        : `Put ${last.copies.length} pages back as they were`
    )
    board = last.board
  })
  // Every change marks the storyboard by its pages; back to what it was
  // made from, its flags are what they were.
  const was = board
  if (was)
    await changeProject(id, (current) => {
      const now = current.project.video?.storyboard
      const sources = fingerprintOf(storyboardSources(current.project))
      if (now?.id !== was.id || sources !== was.sources) return
      if (was.stale) now.stale = true
      else delete now.stale
      if (was.replan) now.replan = true
      else delete now.replan
    })
  await planScenes(id)
  await scheduleAround(id)
  return { undone: true }
}
