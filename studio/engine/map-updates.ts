// The map's Update and Keep for an episode's copies that wait behind their
// cards, Update all of an episode's at once, and their Undo (review 8 F08:
// each copy needed its own Update, and none could be undone). What a change
// replaced is kept on the episode, as a removal and a move are, so the map's
// Undo puts back these very copies with their scenes.
import type { Snapshot } from '../shared/api'
import type { Scene, Slide } from '../shared/model'
import { addEvent } from './activity'
import { transitionScene } from './autopilot'
import { pageHash, untouched, updatedCopy } from './map-copy'
import { planScenes, restoreAround, scheduleAround } from './map-segues'
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

/** What was made in a scene, or chosen for it: its render, or one being
 * rendered, the creator's takes and choices. The studio planning it again
 * by itself is not counted: an Update's Undo never puts back a scene over
 * this. */
const workOf = (scene?: Scene) =>
  scene
    ? fingerprintOf({
        produced: scene.produced?.objectKey ?? null,
        producing: scene.phase === 'producing',
        presence: scene.presence,
        beats: scene.beats ?? null,
        shot: scene.shot ?? null,
        instructions: scene.instructions ?? [],
        takes: scene.moments.map((moment) => moment.take?.objectKey ?? null)
      })
    : ''
/** A scene put back as it stood mid-run: that run went with the update, so
 * it waits to be run again (a render's inputs keep it, at no new cost). */
const settled = (scene: Scene, ledger: Snapshot) => {
  if (scene.phase === 'producing')
    transitionScene(scene, 'recover-production', ledger)
  else if (['writing', 'changing', 'replanning'].includes(scene.phase))
    transitionScene(scene, 'recover-plan', ledger)
  return scene
}

/**
 * Brings copies up to their map cards, each from its card as it is when it
 * is written (one, or Update all of an episode's), or keeps one as it is.
 * Update all leaves a copy that caught up meanwhile as it is, and one the
 * creator edited in the episode, theirs to update on its own. Returns how
 * many changed, and how many edited were left; none changed, and the last
 * change keeps its Undo.
 */
export const updateCopies = async (
  id: string,
  mapId: string,
  ids: string[],
  keep = false
) => {
  const one = ids.length === 1
  let changed: Slide[] = []
  let edited = 0
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
    edited = 0
    for (const slideId of ids) {
      const index = current.project.slides.findIndex((s) => s.id === slideId)
      const now = current.project.slides[index]
      if (!now && one)
        throw new Refusal('That page is no longer in this episode')
      const original = now?.copyOf && cards.get(now.copyOf.slide)
      if (!original && one) throw new Refusal('The map no longer has this page')
      if (!original || (!one && pageHash(original) === now.copyOf!.hash))
        continue
      // The creator's own words in an episode are theirs (Update all).
      if (!one && !untouched(now)) {
        edited++
        continue
      }
      const next = keep
        ? { ...now, copyOf: { ...now.copyOf!, kept: pageHash(original) } }
        : updatedCopy(mapId, now, original)
      // A Keep leaves the scene as it is; an Update keeps it as it was,
      // copied, as putting the video right moves it on.
      const scene = keep
        ? undefined
        : video?.scenes.find((s) => s.slideId === slideId)
      before.copies.push({
        slide: now,
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
    // What was made in each scene as the update left it: work since is
    // never undone over.
    for (const copy of before.copies)
      if (copy.scene)
        copy.work = workOf(
          video?.scenes.find((s) => s.slideId === copy.slide.id)
        )
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
  return { changed: changed.length, edited }
}

/**
 * The map's Undo of the last Update or Keep in an episode: its copies as
 * they were, with their scenes unless worked on since, the lines around
 * them they had, and the storyboard's flags once its pages are again what
 * it was made from. A copy changed since refuses it whole.
 */
export const undoUpdate = async (id: string) => {
  let board: Before['board']
  let kept = 0
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
    kept = 0
    for (const { slide, scene, work } of last.copies) {
      slides[slides.findIndex((s) => s.id === slide.id)] = slide
      const now = video?.scenes.find((s) => s.slideId === slide.id)
      if (!scene || !video || !now) continue
      // Made or chosen since the update: the newer scene stays.
      if (work !== undefined && workOf(now) !== work) {
        kept++
        continue
      }
      video.scenes = video.scenes.map((s) =>
        s === now ? settled(scene, current) : s
      )
    }
    reconcileVideo(current.project, current, new Set())
    const [first] = last.copies
    const one = last.copies.length === 1
    const stays = !kept
      ? ''
      : one
        ? '; its scene was worked on since, so it stays as it is'
        : kept === 1
          ? '; 1 scene worked on since stays as it is'
          : `; ${kept} scenes worked on since stay as they are`
    addEvent(
      current,
      'slide',
      `${one ? `Put “${first.slide.title}” back as it was` : `Put ${last.copies.length} pages back as they were`}${stays}`
    )
    board = last.board
  })
  // The lines the pages around had come back first (an update rewrote
  // them); then, back to what it was made from, the storyboard's flags are
  // what they were.
  await restoreAround(id)
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
  return { undone: true, ...(kept ? { kept } : {}) }
}
