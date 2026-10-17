// The episode's YouTube thumbnail: a settled picture, never a frame caught
// mid-animation under half a caption (review 8: the bundle's was the video
// at 1.5 s, "One tap." with "How do" below it). A storyboard episode offers
// each frame's still, posed in its landed state with no caption; any other
// video, its picture near the end of each scene, once the scene has played.
// A picture taken from the made video leaves its caption band out, the
// title can be set over it, and nothing carries it until the creator
// approves it (round 2).
import type { Project } from './model'
import { sceneTimes } from './release-plan'

export type CoverChoice = {
  key: string
  label: string
  /** A storyboard frame, by its number: its still. */
  frame?: number
  /** A second of the made video. */
  at?: number
  /** The video's own poster, when it offers nothing else. */
  poster?: boolean
}

const round = (value: number) => Math.round(value * 100) / 100

/** A storyboard frame's last picture in the made video: held before the
 * next frame comes in, and after its words are said. */
export const frameHeld = (project: Project, number: number) => {
  let end = 0
  for (const scene of project.video?.storyboard?.plan?.scenes || [])
    for (const frame of scene.frames) {
      end += frame.duration
      if (frame.number === number)
        return round(Math.max(end - frame.duration / 2, end - 0.15))
    }
  return undefined
}

/** What the thumbnail can be, in film order. */
export const coverChoices = (project: Project): CoverChoice[] => {
  if (!project.video?.produced) return []
  const plan = project.video.storyboard?.plan
  if (plan) {
    const frames = plan.scenes.flatMap((scene) => scene.frames)
    const posed = frames.some((frame) => frame.still)
    // Without stills to hand, each frame's last picture in the video.
    return frames
      .filter((frame) => frame.still || !posed)
      .map((frame) => ({
        key: `frame-${frame.number}`,
        label: `Frame ${frame.number}: ${frame.title}`,
        ...(posed
          ? { frame: frame.number }
          : { at: frameHeld(project, frame.number) })
      }))
  }
  // A scene's picture before it gives way to the next (a join's crossfade
  // takes at most its last 0.4 s).
  const scenes = sceneTimes(project).map((scene) => {
    const length = scene.end - scene.start
    return {
      key: `scene-${scene.index}`,
      label: scene.title || `Scene ${scene.index + 1}`,
      at: round(scene.start + Math.max(length / 2, length - 0.6))
    }
  })
  // A video made before its scenes were timed: its poster, the only one.
  return scenes.length || !project.video.produced.posterKey
    ? scenes
    : [{ key: 'poster', label: 'The video’s opening picture', poster: true }]
}

/** Whether a saved cover names this choice. */
const names = (
  cover: NonNullable<NonNullable<Project['release']>['cover']>,
  choice: CoverChoice
) =>
  cover.frame !== undefined
    ? choice.frame === cover.frame
    : cover.at !== undefined
      ? choice.at === cover.at
      : Boolean(cover.poster && choice.poster)

/** The thumbnail unless the creator chose another: the hook, built in the
 * episode's own design (a camera or screen frame's still holds a block
 * where its media plays), else the first picture. */
const defaultCover = (project: Project, choices: CoverChoice[]) => {
  const scenes = project.video?.storyboard?.plan?.scenes || []
  const designed = scenes
    .filter((scene) => scene.build === 'faceless' || scene.build === 'motion')
    .flatMap((scene) => scene.frames)
    .filter((frame) => choices.some((choice) => choice.frame === frame.number))
  const pick = designed.find((frame) => frame.type === 'hook') || designed.at(0)
  return (
    choices.find((choice) => pick && choice.frame === pick.number) ||
    choices.at(0) ||
    null
  )
}

/** The thumbnail the bundle and the upload carry, as the dialog shows it. */
export const chosenCover = (project: Project) => {
  const choices = coverChoices(project)
  const cover = project.release?.cover
  return (
    choices.find((choice) => cover && names(cover, choice)) ||
    defaultCover(project, choices)
  )
}

/** The words a titled thumbnail carries: the episode's title, and above it
 * its number in a series. */
export const coverWords = (project: Project) => ({
  title: project.title,
  kicker: project.episode ? `Episode ${project.episode.number}` : ''
})

/** Whether the title is set over the picture. */
export const coverTitled = (project: Project) =>
  Boolean(project.release?.cover?.titled)

/**
 * What the thumbnail's picture is made from: the choice, its still, the
 * made video, and the title when it is set over it. The creator's approval
 * holds for this, so any change to it asks for approval again.
 */
export const coverStamp = (project: Project) => {
  const chosen = chosenCover(project)
  if (!chosen) return null
  const still = project.video?.storyboard?.plan?.scenes
    .flatMap((scene) => scene.frames)
    .find((frame) => frame.number === chosen.frame)?.still
  const words = coverWords(project)
  return [
    chosen.key,
    still || '',
    project.video?.produced?.objectKey || '',
    coverTitled(project) ? `${words.kicker}/${words.title}` : ''
  ].join('|')
}

/** The creator approved the thumbnail as it is now. */
export const coverApproved = (project: Project) => {
  const stamp = coverStamp(project)
  return Boolean(stamp && project.release?.cover?.approved === stamp)
}

/** Whether the bundle and the upload may go: the thumbnail approved, or no
 * picture to offer (then none goes, and YouTube Studio sets one). */
export const coverCleared = (project: Project) =>
  !chosenCover(project) || coverApproved(project)

/** Where the studio serves a choice's picture, titled or not. */
export const coverSrc = (
  projectId: string,
  choice: CoverChoice,
  titled = false
) =>
  `/api/projects/${encodeURIComponent(projectId)}/cover?${choice.poster ? 'poster=1' : choice.at === undefined ? `frame=${choice.frame}` : `at=${choice.at}`}${titled ? '&title=1' : ''}`
