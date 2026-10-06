// What template controls do: open the gallery, move a scene to another slot,
// and carry a template chosen in the gallery into the dialog that uses it.
import { api } from './api'
import type { AppContext } from './app-context'
import { closePopover, openPopover } from './popover'
import { confirmAction } from './confirm-action'
import { pickTemplate, sceneSlotMenu } from './template-picker'
import { templateById } from '../shared/video-templates'
import { clickVideo } from './video-controller'

/** Where the gallery returns to, and what it may do there. */
export const galleryContext = (app: AppContext) => {
  const project = app.snapshot?.project
  return {
    look: project?.branding,
    use: !project
      ? null
      : project.video
        ? ('settings' as const)
        : project.slides.length && project.slides.every((slide) => slide.svg)
          ? ('make' as const)
          : null,
    current: project?.video?.settings.template,
    back: project ? 'Back to notebook' : 'Back home'
  }
}

export const openTemplates = (app: AppContext, templateId?: string) => {
  app.stopPractice()
  if (app.dialog.open) app.dialog.close()
  closePopover()
  app.templateGallery.open(galleryContext(app), templateId)
}

/**
 * The gallery's "Use": a new video opens the make-video dialog with the
 * template chosen; an existing one opens its settings with it.
 */
export const useTemplate = async (app: AppContext, templateId: string) => {
  if (!templateById(templateId) || !app.snapshot) return app.render()
  const video = app.snapshot.project.video
  if (video)
    app.pendingVideoSettings = { ...video.settings, template: templateId }
  else pickTemplate(templateId)
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
  if (action === 'scene-slot' && sceneId) {
    openPopover(
      target,
      'scene-slot',
      sceneSlotMenu(app.snapshot.project, sceneId),
      'tpl-slot-popover'
    )
    return
  }
  if (action === 'scene-slot-set' && sceneId) {
    const video = app.snapshot.project.video
    const scene = video?.scenes.find((item) => item.id === sceneId)
    const template = templateById(video?.settings.template)
    if (!scene || !template) return
    const slot = target.dataset.slot || null
    if ((scene.slot || null) === slot) return closePopover()
    closePopover()
    const role = slot
      ? template.slots.find((item) => item.id === slot)?.role
      : 'its place in order'
    const planned = scene.moments.length > 0
    if (
      planned &&
      !(await confirmAction({
        title: `Play ${role}?`,
        detail:
          'This scene is planned again in its new slot: new words and a new animation. Takes whose words still match are kept.',
        action: 'Plan it again'
      }))
    )
      return
    app.snapshot = await api.setSceneSlot(
      app.snapshot.project.id,
      sceneId,
      slot
    )
    app.render()
  }
}
