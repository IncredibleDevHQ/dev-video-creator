// Where a direction applies: the whole series, one episode, or some cards.
// Its bar's Apply to… chooses it from the keyboard or a screen reader as
// well as the mouse; dragging its handle onto what it guides stays the
// shortcut (review 8).
import type { Direction } from '../shared/series'
import { mapApi } from './map-api'
import { place, showMenu, type MenuItem } from './map-bar'
import type { MapCanvas } from './map-canvas'
import { colorOf } from './map-view'

const selected = (map: MapCanvas) => {
  const sel = map.sel
  return sel?.t === 'direction'
    ? map.view?.series?.directions.find((d) => d.id === sel.id)
    : undefined
}

/** The series, each episode, then each card, the ones it guides ticked; a
 * ticked card chosen again is taken off. */
export const applyChoices = (
  map: MapCanvas,
  direction: Direction
): MenuItem[] => {
  const view = map.view
  if (!view) return []
  const tick = (yes: boolean) => (yes ? { note: '✓' } : {})
  const pages = direction.to?.pages || []
  return [
    {
      action: 'apply-to:series',
      label: 'The whole series',
      ...tick(!direction.to?.episode && !pages.length)
    },
    ...view.episodes.map((episode) => ({
      action: `apply-to:episode:${episode.notebook}`,
      label: `Ep ${episode.number} · ${episode.title}`,
      color: colorOf(view, episode.notebook),
      ...tick(direction.to?.episode === episode.notebook)
    })),
    ...(map.snapshot?.project.slides || []).map((slide, index) => ({
      action: `apply-to:card:${slide.id}`,
      label: `Card ${index + 1} · ${slide.title || 'Untitled'}`,
      ...(index ? {} : { sep: true }),
      ...tick(pages.includes(slide.id))
    }))
  ]
}

/** Opens the chooser above the bar, its current choice focused, so the
 * keys start from it. */
export const showApply = (map: MapCanvas, anchor: HTMLElement) => {
  const direction = selected(map)
  const menu = map.slot('menu')
  const stage = map.root.querySelector('.map-stage')
  if (!direction || !menu || !stage) return
  const choices = applyChoices(map, direction)
  showMenu(map, anchor, choices)
  menu.classList.add('is-apply')
  place(menu, anchor, stage)
  const now = choices.find((choice) => choice.note) || choices[0]
  menu.querySelector<HTMLElement>(`[data-map="${now.action}"]`)?.focus()
}

/** What a direction guides, said as its card says it. */
const guides = (map: MapCanvas, to: Direction['to'] | null) => {
  const episode = map.view?.episodes.find((e) => e.notebook === to?.episode)
  if (episode) return `Ep ${episode.number}`
  const slides = map.snapshot?.project.slides || []
  const cards = (to?.pages || [])
    .map((id) => slides.findIndex((slide) => slide.id === id) + 1)
    .filter(Boolean)
  return cards.length
    ? `card${cards.length === 1 ? '' : 's'} ${cards.join(', ')}`
    : 'the whole series'
}

/** Applies the selected direction to what was chosen, through the same
 * wiring its handle uses; focus goes back to Apply to… after. */
export const applyTo = async (map: MapCanvas, choice: string) => {
  const series = map.view?.series
  const direction = selected(map)
  if (!series || !direction) return
  const [kind, id] = choice.split(/:(.*)/s)
  const pages = direction.to?.pages || []
  const to =
    kind === 'episode'
      ? { episode: id }
      : kind === 'card'
        ? pages.includes(id)
          ? pages.length > 1
            ? { pages: pages.filter((page) => page !== id) }
            : null
          : { pages: [...pages, id] }
        : null
  if (JSON.stringify(to) !== JSON.stringify(direction.to || null))
    await map.run(
      () => mapApi.direction(series.id, { id: direction.id, to }),
      `It guides ${guides(map, to)} now`
    )
  map.root
    .querySelector<HTMLElement>(
      '[data-map-slot="bar"] [data-map="menu:apply-to"]'
    )
    ?.focus()
}
