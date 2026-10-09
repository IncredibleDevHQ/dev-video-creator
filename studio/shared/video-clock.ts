import type { Project } from './model'
// The joined video's clock lists only the scenes that were made, each by its
// id. A scene is found by its id, never by its place in the list (review 6:
// with only scene 6 made, playback jumped to the left-out scene 1).
export const videoClock = (project: Project) =>
  project.video?.produced?.clock || []

/** Where a scene's second falls in the joined video; a left-out scene has
 * no place in it, so its start is the video's. */
export const videoSecond = (
  project: Project,
  sceneIndex: number,
  second: number
) => {
  const scene = project.video?.scenes[sceneIndex]
  const entry = videoClock(project).find((item) => item.sceneId === scene?.id)
  return (entry?.start || 0) + second
}

/** The scene playing at a second of the joined video, and the second within
 * it; the index is the scene's place among all the video's scenes. */
export const sceneAt = (project: Project, second: number) => {
  const clock = videoClock(project)
  // A scene owns its incoming transition, so seeking to its start also
  // selects its transcript and chat context.
  let at = 0
  for (let next = 1; next < clock.length; next++) {
    if (second < clock[next].start) break
    at = next
  }
  const entry = clock[at]
  const scenes = project.video?.scenes || []
  const found = scenes.findIndex((scene) => scene.id === entry?.sceneId)
  return {
    index: found >= 0 ? found : 0,
    second: Math.max(0, second - (entry?.start || 0))
  }
}
