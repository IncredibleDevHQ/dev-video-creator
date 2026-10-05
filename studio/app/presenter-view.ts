// A rehearsal of the wireframes before recording (review 5, borrowed from
// Open Slide's presenter mode): the wireframe, the next one, its script and a
// timer. ← → move, P switches between presenter and full-slide views, F goes
// full screen, Esc leaves.
import type { AppContext } from './app-context'
import { escape } from './ui'

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export const openPresenter = (app: AppContext) => {
  if (!app.snapshot || document.querySelector('.presenter-view')) return
  const slides = app.snapshot.project.slides
  if (!slides.some((slide) => slide.svg)) return
  let index = Math.min(app.selected, slides.length - 1)
  let mode: 'presenter' | 'slide' = 'presenter'
  let started = Date.now()
  const view = document.createElement('div')
  view.className = 'presenter-view'
  view.setAttribute('role', 'dialog')
  view.setAttribute('aria-modal', 'true')
  view.setAttribute('aria-label', 'Rehearse the wireframes')
  const draw = () => {
    const slide = slides[index]
    const next = slides[index + 1]
    view.dataset.mode = mode
    view.innerHTML =
      mode === 'slide'
        ? `<div class="presenter-slide">${slide.svg || ''}</div>`
        : `<div class="presenter-main">
<div class="presenter-slide">${slide.svg || ''}</div>
<p class="presenter-position">Wireframe ${index + 1} of ${slides.length} · ${escape(slide.title || '')}</p></div>
<aside class="presenter-side">
<div class="presenter-timer"><span data-presenter-clock>${clock(Date.now() - started)}</span><button type="button" data-presenter="reset">Restart</button></div>
<h3>Next</h3>
<div class="presenter-next">${next ? next.svg || '' : '<span>The end</span>'}</div>
<h3>Script</h3>
<p class="presenter-script">${escape(slide.narration || 'No script for this wireframe yet.')}</p>
<p class="presenter-keys"><kbd>←</kbd> <kbd>→</kbd> move · <kbd>P</kbd> presenter · <kbd>F</kbd> full screen · <kbd>Esc</kbd> leave</p>
<button type="button" class="presenter-close" data-presenter="close">Leave rehearsal</button>
</aside>`
  }
  const move = (step: number) => {
    index = Math.max(0, Math.min(slides.length - 1, index + step))
    draw()
  }
  const close = () => {
    clearInterval(timer)
    document.removeEventListener('keydown', keys, true)
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {})
    view.remove()
    app.selected = index
    app.selectedPlan = null
    app.render()
  }
  const keys = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (['arrowright', 'pagedown', ' '].includes(key)) move(1)
    else if (['arrowleft', 'pageup'].includes(key)) move(-1)
    else if (key === 'p') {
      mode = mode === 'presenter' ? 'slide' : 'presenter'
      draw()
    } else if (key === 'f') {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void view.requestFullscreen?.().catch(() => {})
    } else if (key === 'escape' && !document.fullscreenElement) close()
    else return
    event.preventDefault()
    event.stopPropagation()
  }
  view.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>(
      '[data-presenter]'
    )?.dataset.presenter
    if (action === 'close') close()
    if (action === 'reset') {
      started = Date.now()
      draw()
    }
  })
  const timer = setInterval(() => {
    const label = view.querySelector('[data-presenter-clock]')
    if (label) label.textContent = clock(Date.now() - started)
  }, 1000)
  document.addEventListener('keydown', keys, true)
  draw()
  document.body.append(view)
}
