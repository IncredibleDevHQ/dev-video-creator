import { animationSecond } from '../shared/scene-time'
import { videoSecond } from '../shared/video-clock'
import { api } from './api'
import { saveBeforeLeaving } from './notebook-editor'
import type { AppContext } from './app-context'
import { seekSavedMedia } from './media-seek'
import { clickRecording } from './recording-controller'
import { clickRepos, submitRepos } from './repo-controller'
import { clickSeries, submitSeries } from './series-controller'
import { clickRelease, submitRelease } from './release-controller'
import { clickAccounts, submitAccounts } from './accounts-controller'
import { clickSlides, submitSlides } from './slides-controller'
import {
  clickStart,
  submitStart,
  createPresentation,
  showHowItWorks
} from './start-controller'
import { openAgentMenu } from './agent-menu'
import { openDirectionMenu, openLengthMenu } from './notebook-choices'
import {
  directionSettings,
  lengthForPages,
  narrativeById,
  suggestedDirection
} from '../shared/narratives'
import { STORY_SCENES } from '../shared/model'
import { closeLookPanel, openLookPanel } from './look-panel'
import { closePopover, openPopover } from './popover'
import { headerMore } from './workspace-header'
import { openPresenter } from './presenter-view'
import { clickVideo, submitVideo } from './video-controller'
import { syncSceneChoice } from './scene-link'
import { clickTemplates, openTemplates } from './template-controller'
import { syncTemplateFields } from './template-picker'

export const installAppActions = (app: AppContext) => {
  document.addEventListener('submit', async (event) => {
    const form = event.target as HTMLFormElement
    if (form.closest('[data-confirm]')) return
    event.preventDefault()
    if (
      app.settingsScreen.isOpen ||
      app.templateGallery.isOpen ||
      app.mapCanvas.isOpen
    )
      return
    const values = new FormData(form)
    try {
      await submitStart(app, form, values)
      await submitSlides(app, form, values)
      await submitVideo(app, form, values)
      await submitRepos(app, form, values)
      await submitSeries(app, form, values)
      await submitRelease(app, form, values)
      await submitAccounts(app, form, values)
    } catch (reason) {
      app.error(reason)
    } finally {
      app.pending = false
    }
  })
  document.addEventListener('click', async (event) => {
    if ((event.target as Element).closest('.brand')) {
      if (app.capture.phase !== 'idle') return
      event.preventDefault()
      closePopover()
      closeLookPanel(app)
      app.templateGallery.dismiss()
      app.mapCanvas.dismiss()
      if (!(await saveBeforeLeaving(app))) return
      app.stopPractice()
      app.closeStream?.()
      app.closeStream = null
      app.snapshot = null
      app.opening.reset()
      localStorage.removeItem('minimal-studio-project')
      history.replaceState(null, '', '/')
      app.render()
      void app.refreshNotebooks().catch(app.error)
      return
    }
    // The content map handles its own page.
    if (app.mapCanvas.isOpen && (event.target as Element).closest('.map-page'))
      return
    const target = (event.target as Element).closest<HTMLButtonElement>(
      'button'
    )
    if (!target) return
    if (
      app.capture.phase !== 'idle' &&
      (target.dataset.slide ||
        target.dataset.scene ||
        target.dataset.moment ||
        target.dataset.stage)
    )
      return
    if (
      target.dataset.stage ||
      target.dataset.notebook ||
      ['settings', 'clone-settings', 'agent-settings'].includes(
        target.dataset.action || ''
      )
    ) {
      if (!(await saveBeforeLeaving(app))) return
    }
    if (target.dataset.slide) {
      app.selected = Number(target.dataset.slide)
      app.selectedPlan = null
      app.pin = null
      app.render()
      return
    }
    if (target.dataset.plan) {
      app.selectedPlan = target.dataset.plan
      app.pin = null
      app.render()
      return
    }
    if (target.dataset.scene) {
      app.stopPractice()
      app.selected = Number(target.dataset.scene)
      app.momentIndex = 0
      app.second = 0
      const player =
        app.root.querySelector<HTMLVideoElement>('[data-whole-video]')
      if (player && app.snapshot)
        player.currentTime = videoSecond(app.snapshot.project, app.selected, 0)
      app.render()
      return
    }
    if (target.dataset.moment) {
      app.stopPractice()
      app.momentIndex = Number(target.dataset.moment)
      app.second =
        app.snapshot?.project.video?.scenes[app.selected]?.moments[
          app.momentIndex
        ]?.start || 0
      const player = app.root.querySelector<HTMLVideoElement>(
        '[data-scene-player]'
      )
      if (player && app.snapshot)
        seekSavedMedia(
          player,
          player.hasAttribute('data-whole-video')
            ? videoSecond(app.snapshot.project, app.selected, app.second)
            : player.hasAttribute('data-animation-player')
              ? animationSecond(
                  app.snapshot.project.video!.scenes[app.selected],
                  app.second,
                  true
                )
              : app.second
        )
      app.render()
      return
    }
    if (target.dataset.stage) {
      app.wholeVideo = false
      app.stopPractice()
      app.stage = target.dataset.stage as typeof app.stage
      app.render()
      return
    }
    const action = target.dataset.action
    try {
      if (action === 'agent-menu') {
        openAgentMenu(app, target)
        return
      }
      if (
        action === 'take-suggestion' &&
        app.snapshot &&
        target.dataset.narrative
      ) {
        const suggestion = app.snapshot.suggestion
        const narrative = narrativeById(target.dataset.narrative)
        const direction = suggestion
          ? suggestedDirection(target.dataset.narrative, suggestion)
          : undefined
        // The creator's length stays: the template tells the same number of
        // pages; its suggested length waits in the direction menu.
        const pages = STORY_SCENES[app.snapshot.project.length || 'medium']
        const kept =
          narrative &&
          lengthForPages(
            pages,
            directionSettings(narrative, direction).elaboration
          )
        app.snapshot = await api.setTemplate(app.snapshot.project.id, {
          narrative: target.dataset.narrative,
          ...(narrative && kept
            ? {
                direction: {
                  ...(direction || { preset: narrative.preset }),
                  length: kept
                }
              }
            : direction
              ? { direction }
              : {})
        })
        app.render()
        return
      }
      if (action === 'length-menu') {
        openLengthMenu(app, target)
        return
      }
      if (action === 'direction-menu') {
        openDirectionMenu(app, target)
        return
      }
      if (action === 'look-panel') {
        openLookPanel(app)
        return
      }
      if (action === 'rehearse') {
        openPresenter(app)
        return
      }
      if (action === 'header-more' && app.snapshot) {
        openPopover(
          target,
          'header-more',
          headerMore(app.snapshot, app.stage),
          'header-more-popover'
        )
        return
      }
      if (action === 'open-map-of' && target.dataset.map) {
        app.dialog.close()
        void app.mapCanvas.open(target.dataset.map)
        return
      }
      if (action === 'open-map' && app.snapshot) {
        app.stopPractice()
        const { project } = app.snapshot
        void app.mapCanvas.open(project.copyOfMap || project.id, project.id)
        return
      }
      if (action === 'how-it-works') {
        showHowItWorks(app)
        return
      }
      if (target.dataset.notebook) {
        if (app.capture.phase !== 'idle')
          throw new Error('Finish this take first')
        app.selected = 0
        app.momentIndex = 0
        app.second = 0
        if (app.dialog.open) app.dialog.close()
        await app.openNotebook(target.dataset.notebook, true)
        return
      }
      if (
        action === 'settings' ||
        action === 'clone-settings' ||
        action === 'agent-settings'
      ) {
        if (app.capture.phase !== 'idle')
          throw new Error('Finish or discard this take before opening Settings')
        app.stopPractice()
        app.dialog.close()
        closePopover()
        closeLookPanel(app)
        await app.settingsScreen.open(
          action === 'agent-settings' ? 'agent' : undefined
        )
        return
      }
      if (action === 'close') app.dialog.close()
      if (action === 'slides-only')
        document.querySelector<HTMLTextAreaElement>('#source-input')?.focus()
      if (action === 'all-recent') {
        app.showAllRecent = true
        app.render()
        return
      }
      if (action === 'open-notebook' && app.opening.state) {
        await app.openNotebook(app.opening.state.id, app.openingAutoStage)
        return
      }
      if (await clickSeries(app, target, action)) return
      if (await clickAccounts(app, target, action)) return
      if (action === 'open-templates') {
        if (app.capture.phase !== 'idle')
          throw new Error(
            'Finish or discard this take before browsing templates'
          )
        openTemplates(app)
        return
      }
      if (!app.snapshot) return
      if (
        app.capture.phase !== 'idle' &&
        ['make-video', 'video-settings', 'scene-settings'].includes(
          action || ''
        )
      )
        throw new Error('Finish or discard this take before changing settings')
      const id = app.snapshot.project.id
      const slideId = app.snapshot.project.slides[app.selected]?.id

      await clickStart(app, target, action)
      await clickSlides(app, target, action)
      await clickVideo(app, target, action)
      await clickTemplates(app, target, action)
      await clickRecording(app, target, action)
      await clickRepos(app, target, action)
      await clickRelease(app, target, action)
    } catch (reason) {
      app.error(reason)
    }
  })
  app.dialog.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement
    const form = app.dialog.querySelector<HTMLFormElement>(
      '#video-form, #video-settings-form'
    )
    if (!form) return
    if (app.settingsScreen.isOpen) return
    syncSceneChoice(form, event.target)
    syncTemplateFields(form, event.target)
    const values = new FormData(form)
    const warning = form.querySelector<HTMLElement>('.two-voices')!
    warning.hidden =
      !String(values.get('voice')).startsWith('ai:') ||
      (values.get('presence') ?? values.get('oncamera')) === 'off' ||
      values.get('oncamera') === 'none'
  })
}
