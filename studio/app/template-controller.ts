// What template controls do: open the gallery, give a scene another beat,
// and carry a template chosen in the gallery into the dialog that uses it.
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { confirmAction } from './confirm-action'
import { keepMakeChoices, pickTemplate, sceneBeatMenu } from './template-picker'
import { sceneShotMenu } from './shot-picker'
import { shotById } from '../shared/orchestration'
import { narrativeById, type PresetId } from '../shared/narratives'
import { clickVideo } from './video-controller'

/** Where the gallery returns to, and what it may do there. */
export const galleryContext = (app: AppContext) => {
  const project = app.snapshot?.project
  // Before any wireframe, a template plans them; after, it shapes the video.
  const planning =
    !!project &&
    !project.slides.length &&
    ['draft', 'failed'].includes(app.snapshot!.status)
  const told = project?.video?.settings ?? (planning ? project : undefined)
  return {
    look: project?.branding,
    use: !project
      ? null
      : project.video
        ? ('settings' as const)
        : planning
          ? ('notebook' as const)
          : project.slides.length && project.slides.every((slide) => slide.svg)
            ? ('make' as const)
            : null,
    current: {
      narrative: told?.narrative,
      preset: told?.direction?.preset
    },
    back: project ? 'Back to notebook' : 'Back home',
    // The suggestion for this post leads the gallery (review 6), as sure of
    // each as the notebook's row is.
    suggested: (app.snapshot?.suggestion?.narratives || [])
      .filter(
        ({ id, p }, index) =>
          narrativeById(id) && index < 3 && (index === 0 || p >= 0.1)
      )
      .map(({ id }) => id)
  }
}

export const openTemplates = (app: AppContext, narrative?: string) => {
  app.stopPractice()
  // From the make dialog, its choices wait for it to come back.
  if (app.dialog.open) keepMakeChoices(app.dialog)
  if (app.dialog.open) app.dialog.close()
  closePopover()
  app.templateGallery.open(galleryContext(app), narrative)
}

/**
 * The gallery's "Use": a new video opens the make-video dialog with the
 * template and its direction chosen; an existing one opens its settings
 * with them. A new direction starts from the preset alone.
 */
export const useTemplate = async (
  app: AppContext,
  id: string,
  preset: PresetId
) => {
  const narrative = narrativeById(id)
  if (!narrative || !app.snapshot) return app.render()
  if (galleryContext(app).use === 'notebook') {
    const project = app.snapshot.project
    app.snapshot = await api.setTemplate(project.id, {
      narrative: narrative.id,
      direction:
        project.narrative === id && project.direction?.preset === preset
          ? project.direction
          : { preset }
    })
    return app.render()
  }
  const video = app.snapshot.project.video
  const direction =
    video?.settings.narrative === id &&
    video.settings.direction?.preset === preset
      ? video.settings.direction
      : { preset }
  if (video)
    app.pendingVideoSettings = {
      ...video.settings,
      narrative: narrative.id,
      direction
    }
  else pickTemplate({ narrative: narrative.id, direction })
  app.render()
  const target = document.createElement('button')
  target.dataset.action = video ? 'video-settings' : 'make-video'
  await clickVideo(app, target, target.dataset.action)
}

export const clickTemplates = async (
  app: AppContext,
  target: HTMLElement,
  action: string | undefined
) => {
  if (action === 'open-templates') return openTemplates(app)
  if (!app.snapshot) return
  const sceneId = target.dataset.sceneId
  if (action === 'scene-beats' && sceneId) {
    openPopover(
      target,
      'scene-beats',
      sceneBeatMenu(app.snapshot.project, sceneId),
      'tpl-slot-popover'
    )
    return
  }
  if (action === 'scene-shot' && sceneId) {
    openPopover(
      target,
      'scene-shot',
      sceneShotMenu(app.snapshot.project, sceneId),
      'tpl-slot-popover shot-popover'
    )
    return
  }
  if (action === 'scene-shot-set' && sceneId) {
    const scene = app.snapshot.project.video?.scenes.find(
      (item) => item.id === sceneId
    )
    if (!scene) return
    const shot = target.dataset.shot || null
    if ((scene.shot || null) === shot) return closePopover()
    closePopover()
    if (
      scene.moments.length > 0 &&
      !(await confirmAction({
        title: shot
          ? `Build it as ${shotById(shot)?.name}?`
          : 'Use the suggested shot?',
        detail:
          'This scene is planned again for its new shot: new words and a new animation. Takes whose words still match are kept.',
        action: 'Plan it again'
      }))
    )
      return
    app.snapshot = await api.setSceneShot(
      app.snapshot.project.id,
      sceneId,
      shot
    )
    app.render()
    return
  }
  if (action === 'scene-beats-set' && sceneId) {
    const video = app.snapshot.project.video
    const scene = video?.scenes.find((item) => item.id === sceneId)
    const narrative = narrativeById(video?.settings.narrative)
    if (!scene || !narrative) return
    const beat = target.dataset.beat || null
    const own = scene.beats?.length === 1 ? scene.beats[0] : null
    if (own === beat && (beat || !scene.beats?.length)) return closePopover()
    closePopover()
    const name = beat
      ? narrative.beats.find((item) => item.id === beat)?.name
      : 'its share in order'
    if (
      scene.moments.length > 0 &&
      !(await confirmAction({
        title: `Carry ${name}?`,
        detail:
          'This scene is planned again for its new beat: new words and a new animation. Takes whose words still match are kept.',
        action: 'Plan it again'
      }))
    )
      return
    app.snapshot = await api.setSceneBeats(
      app.snapshot.project.id,
      sceneId,
      beat ? [beat] : null
    )
    app.render()
  }
}
