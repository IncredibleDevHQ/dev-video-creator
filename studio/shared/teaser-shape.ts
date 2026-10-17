// A teaser's shape and whether it reads on a phone (review 8, round 1). A
// storyboard episode's frames are drawn to fill a 16:9 picture, so cropped
// to 9:16 their text mostly stays small; such a teaser is a draft until its
// frames are drawn again for its shape, or the creator keeps it as it is.
// Pure, so the engine and the page agree.
import type { Project } from './model'
import { sceneTimes } from './release-plan'
import type { Aspect, Teaser } from './release'
import type { BuildType, FrameSummary } from './storyboard'

/** Past this share of its seconds with small text, a teaser is a draft. */
export const SMALL_SHARE = 0.2
/** A frame used for less than this is a sliver: the frame beside it holds. */
const SLIVER = 0.75

export const teaserSeconds = (teaser: Pick<Teaser, 'segments'>) =>
  teaser.segments.reduce((sum, part) => sum + part.to - part.from, 0)

/** "portrait" or "square": the shape a teaser's frames are drawn for. */
export const shapeName = (aspect: Aspect) =>
  aspect === '1:1' ? 'square' : 'portrait'

/** A teaser not offered as finished: its text stays small for more than a
 * fifth of it, as cut or as drawn again for its shape (each measured), or
 * drawn again and not measured, and the creator has not kept it (review 8,
 * round 2: a rebuild was taken as readable unmeasured). */
export const needsShapeCut = (teaser: Teaser) =>
  teaser.state === 'ready' &&
  teaser.aspect !== '16:9' &&
  !teaser.kept &&
  (Boolean(teaser.rebuild?.unchecked) ||
    (teaser.small || 0) > SMALL_SHARE * teaserSeconds(teaser))

/** Whether the frame agent can draw a teaser's frames again for its shape:
 * a storyboard episode's, narrower than the video, with small text, drawn
 * again already or not. */
export const canRebuild = (project: Project, teaser: Teaser) =>
  teaser.state === 'ready' &&
  teaser.aspect !== '16:9' &&
  Boolean(project.video?.storyboard?.plan) &&
  (teaser.small || 0) >= 1 &&
  teaser.rebuild?.state !== 'rebuilding'

/** How many frames a rebuild draws: after one that could not measure its
 * words, none (its frames are kept, and measured again); after one that
 * left some small, those; else every frame the teaser shows. */
export const framesToDraw = (project: Project, teaser: Teaser) =>
  teaser.rebuild?.state === 'ready' && teaser.rebuild.unchecked
    ? 0
    : teaser.rebuild?.state === 'ready' && teaser.rebuild.smallFrames?.length
      ? teaser.rebuild.smallFrames.length
      : teaserFrames(project, teaser.segments).frames.length

export type TeaserFrame = Pick<
  FrameSummary,
  'number' | 'title' | 'duration' | 'transition'
> & {
  build: BuildType
  /** Its place in the episode, in seconds. */
  from: number
  to: number
}
/** A stretch of a teaser shown from one frame: its seconds in the episode,
 * and how long the frame's first or last picture holds for a sliver of the
 * frame beside it. */
export type TeaserPiece = {
  segment: number
  frame: number
  from: number
  to: number
  before: number
  after: number
}

/** The storyboard frames a teaser shows, in film order, and the stretches
 * of each it uses; a sliver under 0.75 s (a beat cut just before a frame
 * comes in) is held by the frame beside it, so no frame is drawn for it. */
export const teaserFrames = (
  project: Project,
  segments: Array<{ from: number; to: number }>
) => {
  const scenes = project.video?.storyboard?.plan?.scenes
  if (!scenes) return { frames: [] as TeaserFrame[], pieces: [] }
  const timed: TeaserFrame[] = sceneTimes(project).flatMap((scene) =>
    scene.scene.moments.map((moment, index) => {
      const frame = scenes[scene.index].frames[index]
      return {
        number: frame.number,
        title: frame.title,
        duration: frame.duration,
        transition: frame.transition,
        build: scenes[scene.index].build,
        from: scene.start + moment.start,
        to: scene.start + moment.end
      }
    })
  )
  const pieces: TeaserPiece[] = []
  segments.forEach((segment, index) => {
    const parts: TeaserPiece[] = timed
      .map((frame) => ({
        segment: index,
        frame: frame.number,
        from: Math.max(frame.from, segment.from),
        to: Math.min(frame.to, segment.to),
        before: 0,
        after: 0
      }))
      .filter((part) => part.to - part.from > 0.001)
    for (let at = 0; at < parts.length; at++) {
      const part = parts[at]
      if (part.to - part.from >= SLIVER || parts.length === 1) continue
      const next = parts[at + 1]
      if (next) next.before += part.to - part.from + part.before
      else parts[at - 1].after += part.to - part.from + part.after
      parts.splice(at--, 1)
    }
    pieces.push(...parts)
  })
  const used = new Set(pieces.map((piece) => piece.frame))
  return {
    frames: timed.filter((frame) => used.has(frame.number)),
    pieces
  }
}
