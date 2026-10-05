import { scheduleSource } from './notebook-intake'
import { transitionScene } from './autopilot'
import { generationStops } from './generation-errors'
import { listRows, initializePersistence } from './persistence'
import { changeProject, loadProject, addEvent } from './projects'
import { refreshVideoKeys } from './scene-model'
import { videoView } from '../shared/state'
import { recoverChanges } from './slide-changes'
export type RecoveryJobs = {
  slides: (id: string) => void
  planning: (id: string) => void
  scene: (id: string, sceneId: string) => Promise<unknown>
  video: (id: string) => Promise<unknown>
  changes?: (id: string) => void
}
// Run once before accepting requests. Persisted phases belong to the previous
// worker; this worker has no matching process, so it may safely resume them.
export const recoverProjects = async (jobs: RecoveryJobs) => {
  await initializePersistence()
  for (const id of await listRows('projects')) {
    const saved = await loadProject(id)
    if (!saved) continue
    if (saved.status === 'reading') {
      scheduleSource(id)
      continue
    }
    if (saved.stopping && saved.status === 'building') {
      await changeProject(id, (current) => {
        current.status = 'failed'
        current.error = generationStops.user
        addEvent(current, 'slide', generationStops.user)
      })
      continue
    }
    const resumeSlides = saved.status === 'building'
    const resumeScenes =
      saved.project.video?.scenes
        .filter((scene) => scene.phase === 'producing')
        .map((scene) => scene.id) || []
    const resumePreparation = saved.project.video?.phase === 'preparing'
    const resumeVideo = saved.project.video?.phase === 'joining'
    const interruptedPlan = saved.project.video?.scenes.some((scene) =>
      ['writing', 'changing', 'replanning'].includes(scene.phase)
    )
    let snapshot = saved
    if (saved.changes?.some((change) => change.state === 'working'))
      snapshot = await changeProject(id, (current) => recoverChanges(current))
    // Changes the creator queued and no agent started yet still run.
    if (
      saved.status === 'ready' &&
      snapshot.changes?.some((change) => change.state === 'queued')
    )
      jobs.changes?.(id)
    if (
      resumeSlides ||
      resumeScenes.length ||
      resumeVideo ||
      resumePreparation ||
      interruptedPlan
    )
      snapshot = await changeProject(id, (current) => {
        if (resumeSlides) addEvent(current, 'slide', 'Resuming your slides')
        const video = current.project.video
        if (!video) return
        for (const scene of video.scenes) {
          if (['writing', 'changing', 'replanning'].includes(scene.phase)) {
            transitionScene(scene, 'recover-plan', current)
          } else if (scene.phase === 'producing') {
            transitionScene(scene, 'recover-production', current)
          }
        }
        if (resumeVideo || resumePreparation) {
          video.phase = 'idle'
          video.error = null
          addEvent(
            current,
            'video',
            resumePreparation
              ? 'Resuming scene preparation'
              : 'Resuming your video'
          )
        }
        refreshVideoKeys(current.project)
      })
    if (resumeSlides) jobs.slides(id)
    if (resumePreparation) {
      // The batch owns both planning and production. Starting individual jobs
      // too would race the batch and could leave later scenes unprepared.
      if (videoView(snapshot.project).enabled)
        await jobs.video(id).catch(() => {})
      continue
    }
    if (
      snapshot.project.video?.scenes.some((scene) => scene.phase === 'queued')
    )
      jobs.planning(id)
    for (const sceneId of resumeScenes)
      void jobs.scene(id, sceneId).catch(() => {})
    if (resumeVideo && videoView(snapshot.project).enabled)
      void jobs.video(id).catch(() => {})
  }
}
