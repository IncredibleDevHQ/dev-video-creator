// The episode's YouTube thumbnail: a settled picture, never a frame caught
// mid-animation under half a caption (review 8: the bundle's was the video
// at 1.5 s, "One tap." with "How do" below it). A storyboard episode offers
// each frame's still, posed in its landed state with no caption; any other
// video, its picture near the end of each scene, once the scene has played.
import type { Project } from './model'
import { sceneTimes } from './release-plan'

export type CoverChoice = {
  key: string
  label: string
  /** A storyboard frame, by its number: its still. */
  frame?: number
  /** A second of the made video. */
  at?: number
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
  return sceneTimes(project).map((scene) => {
    const length = scene.end - scene.start
    return {
      key: `scene-${scene.index}`,
      label: scene.title || `Scene ${scene.index + 1}`,
      at: round(scene.start + Math.max(length / 2, length - 0.6))
    }
  })
}

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
    choices.find(
      (choice) =>
        cover &&
        (cover.frame === undefined
          ? choice.at === cover.at
          : choice.frame === cover.frame)
    ) || defaultCover(project, choices)
  )
}

/** Where the studio serves a choice's picture. */
export const coverSrc = (projectId: string, choice: CoverChoice) =>
  `/api/projects/${encodeURIComponent(projectId)}/cover?${choice.at === undefined ? `frame=${choice.frame}` : `at=${choice.at}`}`
