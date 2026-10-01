import { api } from './api'
import type { AppContext } from './app-context'
import { downloadPresentation } from './download'

export const installSlidesController = (app: AppContext) => {
  app.root.addEventListener('keydown', (event) => {
    if (
      !app.snapshot ||
      app.stage !== 'presentation' ||
      /INPUT|TEXTAREA/.test((event.target as Element).tagName)
    )
      return
    const command = event.metaKey || event.ctrlKey
    const action =
      command && event.key.toLowerCase() === 'd'
        ? 'duplicate'
        : command && event.key === 'ArrowUp'
          ? 'up'
          : command && event.key === 'ArrowDown'
            ? 'down'
            : event.key === 'Delete'
              ? 'delete'
              : event.key === 'Enter'
                ? 'add'
                : null
    if (action) {
      event.preventDefault()
      app.root
        .querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
        ?.click()
    }
  })
  app.root.addEventListener('dragstart', (event) => {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-slide]'
    )
    app.dragged = target ? Number(target.dataset.slide) : null
  })
  app.root.addEventListener('dragover', (event) => {
    if ((event.target as Element).closest('[data-slide]'))
      event.preventDefault()
  })
  app.root.addEventListener('drop', async (event) => {
    event.preventDefault()
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-slide]'
    )
    if (!target || app.dragged === null || !app.snapshot) return
    try {
      app.selected = Number(target.dataset.slide)
      app.snapshot = await api.slide(app.snapshot.project.id, {
        action: 'move',
        slideId: app.snapshot.project.slides[app.dragged].id,
        index: app.selected
      })
      app.render()
    } catch (reason) {
      app.error(reason)
    }
    app.dragged = null
  })
}

export const submitSlides = async (
  app: AppContext,
  form: HTMLFormElement,
  values: FormData
) => {
  if (form.id === 'notebook-chat' && app.snapshot) {
    const instruction = String(values.get('instruction') || '').trim()
    if (!instruction) return
    await app.sendChat({ anchor: { stage: 'notebook' }, instruction })
  }
  if (form.id === 'chat' && app.snapshot) {
    const instruction = String(values.get('instruction') || '').trim()
    const slideId = app.snapshot.project.slides[app.selected]?.id
    if (!instruction || !slideId) return
    await app.sendChat({
      anchor: { stage: 'presentation', slideId },
      instruction
    })
  }
}

export const clickSlides = async (
  app: AppContext,
  target: HTMLButtonElement,
  action: string | undefined
) => {
  if (!app.snapshot) return
  const id = app.snapshot.project.id
  const slideId = app.snapshot.project.slides[app.selected]?.id
  if (action === 'stop-slides') {
    target.setAttribute('disabled', '')
    target.textContent = 'Stopping…'
    app.snapshot = await api.stopSlides(id)
    app.render()
  }
  if (action === 'retry-slides') {
    app.snapshot = await api.retrySlides(id)
    app.render()
  }
  if (action === 'export') await downloadPresentation(id, target)
  if (action === 'view-slides') {
    app.stage = 'presentation'
    app.render()
  }
  if (action === 'back') {
    app.stage = 'presentation'
    app.render()
  }
  if (
    ['add', 'duplicate', 'delete', 'up', 'down', 'undo-delete'].includes(
      action || ''
    )
  ) {
    const restoredIndex = app.snapshot.deletedSlide?.index || 0
    app.snapshot = await api.slide(id, {
      action:
        action === 'up' || action === 'down'
          ? 'move'
          : (action as 'add' | 'duplicate' | 'delete' | 'undo-delete'),
      slideId,
      index: action === 'up' ? app.selected - 1 : app.selected + 1
    })
    if (action === 'add') app.selected = app.snapshot.project.slides.length - 1
    if (action === 'duplicate' || action === 'down') app.selected++
    if (action === 'up') app.selected--
    if (action === 'undo-delete') app.selected = restoredIndex
    app.render()
  }
}
