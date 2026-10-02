import { animationSecond } from '../shared/scene-time'
import { videoSecond } from '../shared/video-clock'
import { api } from './api'
import type { AppContext } from './app-context'
import { chooseAiDialog, modelOptions } from './choose-ai'
import { seekSavedMedia } from './media-seek'
import { clickRecording, submitRecording } from './recording-controller'
import { clickSlides, submitSlides } from './slides-controller'
import { clickStart, submitStart } from './start-controller'
import { clickVideo, submitVideo } from './video-controller'

export const installAppActions = (app: AppContext) => {
  document.addEventListener('submit', async (event) => {
    const form = event.target as HTMLFormElement
    if (form.closest('[data-confirm]')) return
    event.preventDefault()
    const values = new FormData(form)
    try {
      await submitStart(app, form, values)
      await submitSlides(app, form, values)
      await submitVideo(app, form, values)
      await submitRecording(app, form, values)
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
    if (target.dataset.slide) {
      app.selected = Number(target.dataset.slide)
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
      if (target.dataset.notebook) {
        if (app.capture.phase !== 'idle')
          throw new Error('Finish this take first')
        app.selected = 0
        app.momentIndex = 0
        app.second = 0
        await app.openNotebook(target.dataset.notebook, true)
        return
      }
      if (action === 'settings' || action === 'clone-settings') {
        if (app.capture.phase !== 'idle')
          throw new Error('Finish or discard this take before opening Settings')
        app.stopPractice()
        app.dialog.close()
        await app.settingsScreen.open()
        return
      }
      if (action === 'close') {
        if (app.dialog.dataset.explainer)
          localStorage.setItem('studio-slides-explained', 'yes')
        app.dialog.close()
      }
      if (action === 'understood') {
        localStorage.setItem('studio-slides-explained', 'yes')
        document.querySelector<HTMLDialogElement>('#dialog')?.close()
      }
      if (action === 'slides-only')
        document.querySelector<HTMLTextAreaElement>('#source-input')?.focus()
      if (action === 'choose-ai') {
        app.aiChoices = await api.harnesses()
        app.showDialog(chooseAiDialog(app.aiChoices, true))
        return
      }
      if (action === 'all-recent') {
        app.showAllRecent = true
        app.render()
        return
      }
      if (action === 'open-notebook' && app.opening.state) {
        await app.openNotebook(app.opening.state.id, app.openingAutoStage)
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
      await clickRecording(app, target, action)
    } catch (reason) {
      app.error(reason)
    }
  })
  app.dialog.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement
    if (target.form?.id === 'choose-ai' && target.name === 'harness') {
      const model = target.form.elements.namedItem('model') as HTMLSelectElement
      model.innerHTML = modelOptions(
        app.aiChoices?.available.find((choice) => choice.id === target.value)
      )
      return
    }
    const form = app.dialog.querySelector<HTMLFormElement>(
      '#video-form, #video-settings-form'
    )
    if (!form) return
    const values = new FormData(form)
    const warning = form.querySelector<HTMLElement>('.two-voices')!
    warning.hidden =
      !String(values.get('voice')).startsWith('ai:') ||
      values.get('presence') === 'off'
  })
}
