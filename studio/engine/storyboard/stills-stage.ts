import { generationFailure, stopsPreparationBatch } from '../generation-errors'
// The stills step: every frame posed at its key moment before anything is
// voiced or animated, the board shown to the creator, and a note on a still
// posing that frame again (storyboard-master's Pose Frame route).
import type { Snapshot } from '../../shared/api'
import type { Storyboard } from '../../shared/storyboard'
import { addEvent } from '../activity'
import { readAsset } from '../persistence'
import { writeBoard } from './board'
import { writeFramePackets } from './frames'
import {
  LAYOUTS,
  MOTION,
  clearFailure,
  concurrency,
  origin,
  pageTitles,
  selectionOf,
  stopAsked,
  summaryNow,
  update,
  type StageInput
} from './run'
import { buildFiles } from './shots'
import { episodeFrames, writeInternal, writeProjectFiles } from './state'
import { poseFrame, sceneStandIn, type StandIn } from './stills'

/** The stand-in each scene's stills show for its media: a picture from the
 * camera scene's take or the screen scene's capture, or a plain block. */
const standIns = async (
  snapshot: Snapshot,
  storyboard: Storyboard,
  dir: string
) => {
  const found = new Map<string, StandIn | undefined>()
  for (const scene of storyboard.plan?.scenes || []) {
    const take = scene.take
    const capture = snapshot.project.slides.find(
      (slide) => slide.id === scene.pageId
    )?.capture
    const key = capture?.objectKey || capture?.last?.objectKey
    const media =
      scene.build === 'camera' && take
        ? { key: take.objectKey, seconds: take.duration }
        : scene.build === 'screen' && key
          ? { key, seconds: 2 }
          : undefined
    found.set(
      scene.pageId,
      await sceneStandIn({
        dir,
        pageId: scene.pageId,
        build: scene.build,
        ...(media
          ? { media: { ...media, read: () => readAsset(media.key) } }
          : {})
      })
    )
  }
  return found
}

/**
 * Poses every frame that has no still yet, and every frame the creator left
 * a note on; then the board waits for the creator's go. A note that comes in
 * while stills are posed is taken in the next round.
 */
export const stillsStage = async ({
  snapshot,
  storyboard,
  dir,
  internal
}: StageInput) => {
  const frames = episodeFrames(internal.plan!)
  internal.statuses ||= {}
  internal.problems ||= {}
  internal.stills ||= {}
  const notes = { ...storyboard.frameNotes }
  const titles = pageTitles(snapshot)
  await writeProjectFiles(dir, internal)
  await writeBoard(dir, internal, titles)
  await writeFramePackets(dir)
  const selection = await selectionOf(snapshot)
  const stand = await standIns(snapshot, storyboard, dir)
  const todo = frames.filter(
    (frame) => !internal.stills![frame.number] || notes[frame.number]
  )
  let cursor = 0
  let batchFailure: unknown
  // Posed in this round: a frame Stop cut short keeps its old still, and its
  // note, for the next round (review 8, round 2: it counted as posed).
  const accepted = new Set<number>()
  const save = async () => {
    await writeInternal(dir, internal)
    await update(snapshot.project.id, (current, ledger) => {
      current.plan = summaryNow(internal, current, ledger)
    })
  }
  const lane = async () => {
    while (cursor < todo.length) {
      if (
        batchFailure ||
        (await stopAsked(snapshot.project.id)) ||
        batchFailure
      )
        return
      const frame = todo[cursor++]
      const at = frames.indexOf(frame)
      if (internal.statuses![frame.number] === 'failed') {
        clearFailure(internal, frame.number)
        await save()
      }
      try {
        await poseFrame({
          projectId: snapshot.project.id,
          dir,
          frameId: frame.id,
          number: frame.number,
          build: frame.build,
          duration: internal.durations?.[frame.number] ?? frame.duration,
          standIn: stand.get(frame.pageId),
          logo: frame.logo ? internal.logo : undefined,
          direction: internal.plan!.direction,
          neighbours: [frames[at - 1], frames[at + 1]]
            .filter(Boolean)
            .map((other) => ({
              number: other.number,
              title: other.title,
              scene: other.scene
            })),
          note: notes[frame.number],
          extraFiles: buildFiles(frame.build, LAYOUTS, MOTION),
          selection,
          origin: origin(),
          onAccepted: async () => {
            accepted.add(frame.number)
            internal.stills![frame.number] = new Date().toISOString()
            internal.statuses![frame.number] = 'built'
            delete internal.problems![frame.number]
            await save()
          }
        })
      } catch (error) {
        if (await stopAsked(snapshot.project.id))
          clearFailure(internal, frame.number)
        else {
          if (stopsPreparationBatch(generationFailure(error, '')))
            batchFailure ||= error
          internal.statuses![frame.number] = 'failed'
          internal.problems![frame.number] = [
            error instanceof Error ? error.message : String(error)
          ]
        }
        await save()
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency(), todo.length) }, lane)
  )
  await writeProjectFiles(dir, internal)
  const posed = todo.filter((frame) => accepted.has(frame.number))
  const failed = todo.length - posed.length
  await update(snapshot.project.id, (current, ledger) => {
    // A note is done once its frame is posed with it; one that came in or
    // changed meanwhile stays, and poses its frame in the next round.
    for (const frame of posed)
      if (
        current.frameNotes &&
        notes[frame.number] &&
        current.frameNotes[frame.number] === notes[frame.number]
      )
        delete current.frameNotes[frame.number]
    if (current.frameNotes && !Object.keys(current.frameNotes).length)
      delete current.frameNotes
    if (failed || current.frameNotes) return
    current.stage = 'board'
    current.status = 'waiting'
    current.waitingFor = 'approval'
    const again = posed.filter((frame) => notes[frame.number])
    addEvent(
      ledger,
      'video',
      again.length && again.length === posed.length
        ? `Posed again with your note: frame${again.length === 1 ? '' : 's'} ${again.map((frame) => frame.number).join(', ')}`
        : `The stills are ready: ${frames.length} frames`,
      { activity: 'complete' }
    )
  })
  if (batchFailure) throw batchFailure
  if (failed)
    throw new Error(
      `${failed} still${failed === 1 ? '' : 's'} could not be posed: ${todo
        .filter((frame) => !accepted.has(frame.number))
        .map((frame) => frame.number)
        .join(', ')}`
    )
}
