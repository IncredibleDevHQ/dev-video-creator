// The content map's planning nodes, as markup: the series' head (what a
// viewer can do by the end, who it is for, the lines that run through it,
// its gaps), the creator's direction notes, a gap's dashed card where an
// episode needs it, and the Queue of what the agent is doing. Pure strings.
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import { DEFAULT_LENGTH, windowLabel } from '../shared/length'
import type { Direction, SeriesGap } from '../shared/series'
import type { LengthGoal } from '../shared/storyboard'
import { HEAD, HEAD0, drawnCount, mapPages } from './map-layout'
import { escape } from './ui'

export const LINE_COLORS = ['#e0a33a', '#4f8fe0', '#c56bd6', '#3fb08f']
export const lineColor = (view: MapView, id: string) =>
  LINE_COLORS[
    Math.max(
      0,
      (view.series?.lines || []).findIndex((line) => line.id === id)
    ) % LINE_COLORS.length
  ]

/** A node's ports: wired in on the left, out from the right (a handle). */
export const ports = (input: boolean, output: string | null) =>
  `${input ? '<span class="map-port is-in" aria-hidden="true"></span>' : ''}${
    output
      ? `<span class="map-port is-out" data-port="${escape(output)}" title="Drag to connect" aria-hidden="true">+</span>`
      : ''
  }`

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

/** How long each episode runs, as a chip that opens the slider. */
/** A window as its chip says it: "2–4 min each · must fit". */
export const lengthWords = (length: LengthGoal) =>
  `${windowLabel(length)} each${length.strict ? ' · must fit' : ''}`

export const lengthChip = (length: LengthGoal = DEFAULT_LENGTH) =>
  `<button type="button" class="quiet map-length" data-map="length" data-popover="series-length" title="How long each episode runs">${lengthWords(length)}</button>`

/** What Organise new cards does, and what follows its card either way. */
export const ORGANIZE_SAYS =
  'New cards find their episode; copies you haven’t edited follow their card either way.'

/** A plan has been made once it named the lines through the series. */
export const seriesPlanned = (series: NonNullable<MapView['series']>) =>
  Boolean(series.lines?.length)

/** The series' head: its name, the outcome and audience (the planner's are
 * marked suggested until the creator edits them), the through-lines, the
 * gaps, and the way to plan it again. Its first plan, and the length it
 * plans for, wait in the header, readable at any zoom (review 8). */
export const seriesHead = (view: MapView) => {
  const series = view.series!
  const suggested = new Set(series.suggested || [])
  const copies = view.episodes.reduce((n, e) => n + e.copies.length, 0)
  const planning = series.planning?.state === 'planning'
  const open = series.gaps.filter((gap) => gap.state === 'open')
  const field = (key: 'outcome' | 'audience', label: string) => {
    const value = series[key]
    return `<button type="button" class="map-brief${value ? '' : ' is-empty'}" data-map="brief:${key}" title="${value ? 'Edit' : 'Add'} ${label.toLowerCase()}"><b>${label}</b><span>${escape(value || (key === 'outcome' ? 'What can a viewer do by the end?' : 'Who is it for?'))}</span>${value && suggested.has(key) ? '<em>suggested</em>' : ''}</button>`
  }
  const lines = series.lines.length
    ? `<div class="map-lines">${series.lines
        .map(
          (line) =>
            `<span class="map-line" style="--line:${lineColor(view, line.id)}" title="${escape(line.line)}"><i></i>${escape(line.name)}</span>`
        )
        .join('')}</div>`
    : ''
  const status = planning
    ? '<span class="map-state is-busy">planning the series…</span>'
    : series.planning?.state === 'failed'
      ? `<span class="map-state is-failed" title="${escape(series.planning.error || '')}">planning failed</span>`
      : `<span class="map-state">${view.episodes.length ? `${plural(view.episodes.length, 'episode')} · ${plural(copies, 'card')}` : 'No episodes yet'}${open.length ? ` · <b class="map-gap-count">${plural(open.length, 'gap')}</b>` : ''}</span>`
  const planned = seriesPlanned(series)
  const again = planned
    ? `${lengthChip(series.length)}${planning ? '' : '<button type="button" class="quiet" data-map="plan-series">Plan again</button>'}`
    : ''
  const organize = `<label class="map-organize" title="${ORGANIZE_SAYS}"><input type="checkbox" data-map-organize ${series.organize ? 'checked' : ''}>Organise new cards</label>`
  return `<div class="map-series-head" style="height:${planned ? HEAD : HEAD0}px">${ports(true, null)}<div class="map-series-title"><h2>${escape(series.title)}</h2>${status}<span class="map-series-acts">${again}${organize}</span></div><div class="map-brief-row">${field('outcome', 'By the end')}${field('audience', 'For')}</div>${
    planned
      ? lines
      : '<p class="map-series-hint">The plan reads every card, finds the lines through them, orders episodes so each builds on the last, and names what the cards don’t cover.</p>'
  }</div>`
}

const ANSWERS = {
  followed: 'Followed',
  partly: 'Partly followed',
  not: 'Not followed'
} as const

/** A direction note: the creator's words for the plan, what it is wired
 * to, and how the last plan took it. */
/** What a direction guides, as its card and its label say it. */
export const directionAbout = (
  view: MapView,
  snapshot: Snapshot,
  direction: Direction
) => {
  const episode = direction.to?.episode
    ? view.episodes.find((e) => e.notebook === direction.to!.episode)
    : undefined
  const pages = (direction.to?.pages || [])
    .map((id) => snapshot.project.slides.findIndex((s) => s.id === id) + 1)
    .filter(Boolean)
  return episode
    ? `Ep ${episode.number}`
    : pages.length
      ? `card${pages.length === 1 ? '' : 's'} ${pages.join(', ')}`
      : 'the series'
}

export const directionCard = (
  view: MapView,
  snapshot: Snapshot,
  direction: Direction,
  editing: boolean
) => {
  const about = directionAbout(view, snapshot, direction)
  const answer = direction.answer
  const body = editing
    ? `<form class="map-direction-form" data-map-form="direction" data-direction="${escape(direction.id)}"><textarea name="text" rows="3" maxlength="600" placeholder="An idea for the episodes: what to lead with, what to pair, what to cut…">${escape(direction.text)}</textarea><div><button type="submit" class="primary">Save</button><button type="button" class="quiet" data-map="direction-cancel">Cancel</button></div></form>`
    : `<p>${escape(direction.text)}</p>`
  return `<div class="map-node-label"><b>Direction</b><span>for ${escape(about)}</span></div>${body}${
    answer && !editing
      ? `<span class="map-answer is-${answer.state}" title="${escape(answer.why)}">${ANSWERS[answer.state]}${answer.state === 'followed' ? '' : `: ${escape(answer.why)}`}</span>`
      : !editing
        ? '<span class="map-answer">Taken up by the next plan</span>'
        : ''
  }${editing ? '' : ports(false, 'direction')}`
}

/** A gap: what the episode needs that no card covers, why, the question
 * that would fill it, and what to do about it. One a card may already say
 * also shows that card's words and its title, and closes with it; they show
 * whole once the gap is selected (review 8). */
export const gapCard = (gap: SeriesGap, card?: string) => {
  const act = (name: string, cls: string, label: string, title: string) =>
    `<button type="button" class="${cls}" data-map="${name}:${escape(gap.id)}" title="${escape(title)}">${label}</button>`
  const covered = gap.covered
  const says = covered
    ? `<p class="map-gap-says">“${escape(covered.says)}”${card ? `<b>${escape(card)}</b>` : ''}</p>`
    : ''
  const close = covered
    ? act('gap-covered', 'quiet', 'Covered', 'That card says it: close the gap')
    : ''
  return `<div class="map-node-label"><b>Missing</b>${covered ? '<span>a card may say it</span>' : ''}</div><strong>${escape(gap.missing)}</strong><p>${escape(gap.why)}</p>${says}<div class="map-gap-acts">${act('gap-note', 'primary', 'Add a note', gap.ask)}${close}${act('gap-explain', 'quiet', 'Explain here', 'The episode explains it in a line')}${act('gap-ignore', 'quiet', 'Ignore', 'It doesn’t matter for this series')}</div>`
}

/** What the agent is doing now, for the Queue. */
export const queueItems = (snapshot: Snapshot, view: MapView | null) => {
  const items: string[] = []
  // The map's own cards while the story draws them: the Queue said idle
  // with three cards drawing (Jev series run).
  if (snapshot.status === 'building' || snapshot.status === 'reading') {
    const pages = mapPages(snapshot)
    items.push(
      pages.length
        ? `Drawing the map’s cards · ${drawnCount(pages)} of ${pages.length}`
        : 'Planning the map’s cards'
    )
  }
  const sorting = (snapshot.project.notes || []).filter(
    (note) => note.state === 'sorting'
  ).length
  if (sorting) items.push(`Sorting ${plural(sorting, 'note')} into cards`)
  const changing = (snapshot.changes || []).length
  if (changing) items.push(`Drawing ${plural(changing, 'card')}`)
  if (snapshot.project.grouping?.state === 'grouping')
    items.push('Grouping cards by topic')
  const series = view?.series
  if (series?.planning?.state === 'planning') items.push('Planning the series')
  if (series?.organizing?.state === 'organizing')
    items.push('Organising new cards into episodes')
  for (const episode of view?.episodes || []) {
    if (episode.picking?.state === 'picking')
      items.push(`Choosing cards for Ep ${episode.number}`)
    if (episode.segues === 'writing')
      items.push(`Writing Ep ${episode.number}’s segues`)
    if (episode.video && !episode.video.joined && episode.video.scenes)
      items.push(`Making Ep ${episode.number}’s video`)
    if (episode.drafting?.state === 'drafting')
      items.push(`Drafting Ep ${episode.number}’s posts`)
  }
  return items
}

/** The Queue pill: how much is under way; open, what each one is. */
export const queuePill = (items: string[], open: boolean) =>
  `<button type="button" class="map-queue-pill${items.length ? ' is-busy' : ''}" data-map="queue" aria-expanded="${open}"><i></i>Queue<span>${items.length ? `${items.length} active` : 'idle'}</span></button>${
    open && items.length
      ? `<ul class="map-queue-list">${items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`
      : ''
  }`

/** The Add menu, as Flora's: what can be made here, with a key for each. */
export const addMenu = (options: Array<[string, string, string, string]>) =>
  `<div class="map-add-k">Add</div>${options
    .map(
      ([action, label, hint, key]) =>
        `<button type="button" data-map="${escape(action)}"><i>${escape(key)}</i><span><b>${escape(label)}</b><small>${escape(hint)}</small></span><kbd>${escape(key)}</kbd></button>`
    )
    .join('')}<div class="map-add-foot">↑↓ Choose · ↵ Add · Esc</div>`
