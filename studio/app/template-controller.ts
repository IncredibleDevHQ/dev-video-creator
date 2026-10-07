// What template controls do: open the gallery, give a scene another beat,
// and carry a template chosen in the gallery into the dialog that uses it.
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { confirmAction } from './confirm-action'
import { pickTemplate, sceneBeatMenu } from './template-picker'
import { narrativeById, type PresetId } from '../shared/narratives'
import { clickVideo } from './video-controller'

/** Where the gallery returns to, and what it may do there. */
export const galleryContext = (app: AppContext) => {
  const project = app.snapshot?.project
  const settings = project?.video?.settings
  return {
    look: project?.branding,
    use: !project
      ? null
      : project.video
        ? ('settings' as const)
        : project.slides.length && project.slides.every((slide) => slide.svg)
          ? ('make' as const)
          : null,
    current: {
      narrative: settings?.narrative,
      preset: settings?.direction?.preset
    },
    back: project ? 'Back to notebook' : 'Back home'
  }
}

export const openTemplates = (app: AppContext, narrative?: string) => {
  app.stopPractice()
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
