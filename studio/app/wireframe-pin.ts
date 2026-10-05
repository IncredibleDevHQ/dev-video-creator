// Point at what should change (review 5, borrowed from Open Slide's pinned
// comments): click a box, an arrow or a label on the wireframe, and the
// change box speaks about that part. The script under the wireframe saves
// as you type.
import type { ChangeTarget } from '../shared/model'
import { api } from './api'
import type { AppContext } from './app-context'

const PARTS = '[data-role="node"],[data-role="connector"],[data-actor],text'

/** The part of a drawn page a click landed on, as the agent will be told it. */
export const pinTargetOf = (
  element: Element,
  stage: Element
): ChangeTarget | null => {
  const hit = element.closest(PARTS)
  if (!hit || !stage.contains(hit)) return null
  const part = hit.closest('[data-role="node"]') || hit
  const kind =
    part.getAttribute('data-role') ||
    (part.hasAttribute('data-actor') ? 'actor' : 'label')
  const words = (part.textContent || '').replace(/\s+/g, ' ').trim()
  const label =
    kind === 'connector'
      ? `the “${part.getAttribute('data-verb') || 'arrow'}” arrow`
      : words.slice(0, 80)
  return { id: part.id || hit.id || '', label, kind }
}

/** Mark the pinned part on the drawn page after each render. */
export const markPin = (root: HTMLElement, pin: ChangeTarget | null) => {
  const stage = root.querySelector('.stage[data-pinnable]')
  if (!stage || !pin) return
  const byId = pin.id
    ? stage.querySelector(`[id="${CSS.escape(pin.id)}"]`)
    : null
  const byText =
    byId ||
    [...stage.querySelectorAll('text')].find(
      (text) =>
        (text.textContent || '').replace(/\s+/g, ' ').trim() === pin.label
    )
  if (!byText) return
  byText.classList.add('is-pinned')
  // A selection box over the part, like a design tool's selection.
  const box = byText.getBoundingClientRect()
  const frame = stage.getBoundingClientRect()
  if (!box.width || !frame.width) return
  const mark = document.createElement('span')
  mark.className = 'pin-box'
  mark.setAttribute('aria-hidden', 'true')
  mark.style.left = `${box.left - frame.left - 5}px`
  mark.style.top = `${box.top - frame.top - 5}px`
  mark.style.width = `${box.width + 10}px`
  mark.style.height = `${box.height + 10}px`
  stage.append(mark)
}

export const installWireframePin = (app: AppContext) => {
  app.root.addEventListener('click', (event) => {
    if (app.stage !== 'presentation' || !app.snapshot) return
    const stage = (event.target as Element).closest('.stage[data-pinnable]')
    if (!stage) return
    const target = pinTargetOf(event.target as Element, stage)
    if (!target) return
    app.pin = target
    app.render()
    app.root.querySelector<HTMLInputElement>('#instruction')?.focus()
  })
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const saveScript = async (field: HTMLTextAreaElement) => {
    const slideId = field.dataset.scriptSlide
    if (!slideId || !app.snapshot || field.readOnly) return
    const id = app.snapshot.project.id
    const slide = app.snapshot.project.slides.find(
      (item) => item.id === slideId
    )
    if (!slide || (slide.narration || '') === field.value.trim()) return
    try {
      const snapshot = await api.slide(id, {
        action: 'script',
        slideId,
        narration: field.value
      })
      if (app.snapshot?.project.id === id) app.snapshot = snapshot
    } catch (reason) {
      app.error(reason)
    }
  }
  app.root.addEventListener('input', (event) => {
    const field = event.target as HTMLTextAreaElement
    if (!field.dataset?.scriptSlide) return
    clearTimeout(timers.get(field.dataset.scriptSlide))
    timers.set(
      field.dataset.scriptSlide,
      setTimeout(() => void saveScript(field), 900)
    )
  })
  app.root.addEventListener('focusout', (event) => {
    const field = event.target as HTMLTextAreaElement
    if (!field.dataset?.scriptSlide) return
    clearTimeout(timers.get(field.dataset.scriptSlide))
    void saveScript(field)
  })
}
