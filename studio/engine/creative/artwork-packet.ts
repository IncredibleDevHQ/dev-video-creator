// The build's packet for drawn artwork: each drawing as it goes into the
// page (its poses' values on its shapes, its idle loop around the parts it
// moves, the group its pop scales), and ARTWORK.json, which says what was
// drawn and how to use it.
import { readAsset } from '../persistence'
import { posedDrawing, withPop, type PoseReport } from './artwork-poses'
import { idleLoop, withIdle } from './artwork-idle'
import {
  cleanDrawing,
  drawnKey,
  viewBoxOf,
  type DrawnObject,
  type DrawnPose
} from './artwork'

const POSE_RULE = [
  'A pose is a state of a drawing that the app drew by editing the drawing itself, shape for shape, so it tweens smoothly.',
  'Load <script src="compositions/artwork-poses.js"></script> after GSAP; then artworkPose(tl, ENTITY, POSE, at, seconds) turns the drawing into that pose on your timeline from second `at`, ending within `seconds` (0.6 to 1.2 s reads as smooth; the ease defaults to power2.inOut), and artworkPose(tl, ENTITY, "rest", at, seconds) turns it back.',
  'A pose is a whole state: another pose returns what it does not change to rest.',
  'Start each on the cue that says it, and never tween the parts a pose moves (its moves) yourself while it plays.',
  'Give a posed drawing room to be seen: a pose inside an icon-sized drawing changes nothing the viewer can read.',
  'A pose with an error was not drawn: show that change with the parts instead.'
].join(' ')

const IDLE_RULE = [
  'A drawing whose idle is "its own loop" is alive by itself, as a Lottie icon is: its loop is in the drawing and plays on the scene’s clock from the start.',
  'Add no idle motion of your own to it (no wobble, float or pulse); give it its entrance, its moves and its poses.'
].join(' ')

/** A pose as the build's packet lists it: what it moves, or why it is not there. */
const poseEntry = (pose: DrawnPose, reports?: PoseReport[]) => {
  const report = reports?.find((item) => item.id === pose.id)
  return report && !report.problems.length
    ? {
        id: pose.id,
        what: pose.what,
        moves: report.parts,
        motion: report.smooth
          ? 'smooth'
          : 'smooth, with some changes switching halfway'
      }
    : {
        id: pose.id,
        what: pose.what,
        error:
          pose.error ||
          `It could not be tweened from the drawing: ${report?.problems.join('; ') || 'it was not drawn'}`
      }
}

/** The drawings and what to do with them, for the build's packet. */
export const artworkPacket = async (drawn: DrawnObject[]) => {
  const files: Record<string, Buffer> = {}
  const posed = new Map<string, PoseReport[]>()
  const idles = new Set<string>()
  // Kept drawings are cleaned again, so one drawn before a cleaning rule
  // existed meets it without being drawn again.
  for (const item of drawn) {
    if (!item.objectKey) continue
    const clean = async (key: string) =>
      cleanDrawing((await readAsset(key)).toString(), item.entity, item.parts)
    let svg = await clean(item.objectKey)
    // Each pose's values go onto the shapes it changes, for the pose player.
    const poses: Array<{ id: string; svg: string }> = []
    for (const pose of item.poses || [])
      if (pose.objectKey)
        poses.push({ id: pose.id, svg: await clean(pose.objectKey) })
    const base = svg
    if (poses.length) {
      const result = posedDrawing(svg, poses)
      svg = result.svg
      posed.set(item.entity, result.poses)
    }
    // Its idle loop goes on next, around the parts it moves.
    if (item.idle?.objectKey) {
      const animated = (await readAsset(item.idle.objectKey)).toString()
      const { loop, problem } = idleLoop(base, animated, item.entity)
      if (loop) {
        svg = withIdle(svg, loop)
        idles.add(item.entity)
      } else
        item.idle = { error: `The idle loop could not be used: ${problem}` }
    }
    // Last, the group the pose player pops as a pose arrives.
    if (posed.get(item.entity)?.some((report) => !report.problems.length))
      svg = withPop(svg)
    files[`packet/${item.file}`] = Buffer.from(svg)
  }
  if (!drawn.length) return files
  const posing = [...posed.values()].some((reports) =>
    reports.some((report) => !report.problems.length)
  )
  files['packet/ARTWORK.json'] = Buffer.from(
    JSON.stringify(
      {
        rule: [
          'These objects were drawn for this scene from the plan.',
          'Place each one with an empty <div data-artwork="ENTITY"></div>, sized and positioned where the object goes, in the aspect of its viewBox: when you submit, the app puts the drawing into it exactly as drawn, sized to fill it, so never paste or retype its path data.',
          'Its manifest layer names it as asset { "libraryKey": "generated-ENTITY" }, with no path: the drawing is inline.',
          'Animate each named part by its data-part attribute ([data-artwork="ENTITY"] [data-part="PART"]; a part may be several groups that move together), never redraw a drawn object from plain shapes, and keep it clear of text and other layers.',
          'A part listed as missing is not separable: move the whole drawing instead.',
          'An object with an error has no drawing: draw it yourself and say so in manifest.unmet.',
          ...(posing ? [POSE_RULE] : []),
          ...(idles.size ? [IDLE_RULE] : [])
        ].join(' '),
        objects: drawn.map((item) => ({
          entity: item.entity,
          ...(item.objectKey
            ? {
                file: item.file,
                libraryKey: drawnKey(item.entity),
                place: `<div data-artwork="${item.entity}"></div>`,
                viewBox: viewBoxOf(
                  files[`packet/${item.file}`]?.toString() || ''
                )
              }
            : {}),
          parts: item.parts,
          missing: item.missing,
          ...(item.poses?.length
            ? {
                poses: item.poses.map((pose) =>
                  poseEntry(pose, posed.get(item.entity))
                )
              }
            : {}),
          ...(idles.has(item.entity)
            ? { idle: 'its own loop, in the drawing' }
            : item.idle?.error
              ? { idle: { error: item.idle.error } }
              : {}),
          ...(item.error ? { error: item.error } : {})
        }))
      },
      null,
      2
    )
  )
  return files
}
