import { api } from './api'
import type { AppContext } from './app-context'
import { downloadPresentation } from './download'
import { flushNotebookEdits } from './notebook-editor'
import { createPresentation } from './start-controller'
import { closePopover, openPopover } from './popover'

export const installSlidesController = (app: AppContext) => {
  app.root.addEventListener('keydown', (event) => {
    // The content map, open over the wireframes, has keys of its own.
    if (!app.snapshot || app.stage !== 'presentation' || app.mapCanvas.isOpen)
      return
    // Keys pressed in a field or on a control are that control's: Enter on a
    // tab or a header button presses it. A wireframe in the rail, or nothing
    // in particular, takes the wireframe keys.
    const target = event.target as Element
    const onTile = Boolean(target.closest?.('.rail .thumbnail'))
    if (
      !onTile &&
      target.closest?.(
        'input, textarea, select, button, a, summary, [role="tab"], [role="button"], [contenteditable="true"], [contenteditable=""]'
      )
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
    if (!action) return
    event.preventDefault()
    if (action === 'add')
      app.root.querySelector<HTMLButtonElement>('[data-action="add"]')?.click()
    // The wireframe menu is a popover, so its shortcuts act directly.
    else if (
      app.snapshot.status === 'ready' &&
      app.snapshot.project.slides[app.selected]
    )
      void clickSlides(app, document.createElement('button'), action).catch(
        app.error
      )
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
  if (form.matches('.evidence-ask') && app.snapshot) {
    const answer = String(values.get('answer') || '').trim()
    if (!answer) return
    app.snapshot = await api.answerEvidence(app.snapshot.project.id, {
      slideId: form.dataset.evidenceSlide || '',
      what: form.dataset.evidenceWhat || '',
      answer
    })
    app.render()
  }
  if (form.id === 'chat' && app.snapshot) {
    const instruction = String(values.get('instruction') || '').trim()
    const slideId = app.snapshot.project.slides[app.selected]?.id
    if (!instruction || !slideId) return
    const target = app.pin || undefined
    app.pin = null
    await app.sendChat({
      anchor: { stage: 'presentation', slideId },
      instruction,
      ...(target ? { target } : {})
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
    if (app.pending) return
    target.disabled = true
    try {
      await flushNotebookEdits(app)
      if (app.snapshot?.status === 'draft') {
        await createPresentation(app)
        return
      }
      app.pending = true
      app.snapshot = await api.retrySlides(id)
      app.stage = 'presentation'
    } finally {
      app.pending = false
      target.disabled = false
      app.render()
    }
  }
  if (action === 'add-beat' && target.dataset.beat) {
    // A page for a beat no wireframe carries, drawn from what it must say.
    const beat = target.dataset.beat
    app.snapshot = await api.slide(id, { action: 'add', beat })
    const slides = app.snapshot.project.slides
    const added = slides.findIndex(
      (slide) =>
        !slide.svg && slide.beats?.length === 1 && slide.beats[0] === beat
    )
    if (added >= 0) {
      app.selected = added
      app.snapshot = await api.chat(id, {
        anchor: { stage: 'presentation', slideId: slides[added].id },
        instruction: `A page for the beat "${slides[added].title}": the viewer comes away knowing ${(slides[added].idea || '').toLowerCase()} Draw on the source for its evidence.`
      })
    }
    app.render()
  }
  if (action === 'export') await downloadPresentation(id, target)
  if (action === 'slide-menu') {
    // A popover is never clipped by the scrolling area under the wireframe
    // (review 5: Delete was cut off at a 900 px window).
    const ready = app.snapshot.status === 'ready'
    const last = app.selected === app.snapshot.project.slides.length - 1
    const item = (label: string, name: string, disabled: boolean) =>
      `<button type="button" data-action="${name}" ${disabled ? 'disabled' : ''}>${label}</button>`
    openPopover(
      target,
      'slide-menu',
      `<div class="slide-menu-list" role="menu" aria-label="Wireframe actions">${item('Duplicate', 'duplicate', !ready)}${item('Move up', 'up', app.selected === 0 || !ready)}${item('Move down', 'down', last || !ready)}${item('Delete', 'delete', !ready)}</div>`,
      'slide-menu-popover'
    )
    return
  }
  if (action === 'unpin') {
    app.pin = null
    app.render()
    return
  }
  if (action?.startsWith('resend-change:')) {
    const change = app.snapshot.changes?.find(
      (item) => item.id === action.slice(14)
    )
    if (!change) return
    app.pin = change.target || null
    app.render()
    const field = app.root.querySelector<HTMLInputElement>('#instruction')
    if (field) {
      field.value = change.instruction
      field.focus()
    }
    return
  }
  if (action === 'view-slides') {
    await flushNotebookEdits(app)
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
    closePopover()
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
