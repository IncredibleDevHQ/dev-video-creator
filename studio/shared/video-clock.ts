import type { Project } from './model'
export const videoClock = (project: Project) => project.video?.produced?.clock || []
export const videoSecond = (project: Project, sceneIndex: number, second: number) => (videoClock(project)[sceneIndex]?.start || 0)+second
export const sceneAt = (project: Project, second: number) => {
  const clock = videoClock(project)
  // A scene owns its incoming transition, so seeking to its start also
  // selects its transcript and chat context.
  let index = 0
  for (let next = 1; next < clock.length; next++) {
    if (second < clock[next].start) break
    index = next
  }
  return {index,second:Math.max(0,second-(clock[index]?.start || 0))}
}
