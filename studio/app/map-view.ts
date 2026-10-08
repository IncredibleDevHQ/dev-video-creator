// The content map's markup: the page around the canvas (header, notes rail,
// selection bar) and each thing on it — a map page, an episode's lane, a
// copy, a segue, what a made episode was cut into. Pure strings.
import type { Snapshot } from '../shared/api'
import type { MapCopy, MapEpisode, MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'
import { themeControl } from './appearance'
import { escape } from './ui'
import type { MapFilter, MapMode } from './map-layout'

export const EPISODE_COLORS = [
  '#3f9e5f',
  '#4f8fe0',
  '#a46bd6',
  '#d99a2b',
  '#2fa8a0',
  '#d9645f',
  '#7aa83a'
]
export const colorOf = (view: MapView, episode: string) =>
  EPISODE_COLORS[
    Math.max(
      0,
      view.episodes.findIndex((e) => e.notebook === episode)
    ) % EPISODE_COLORS.length
  ]
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

/** The page: header, notes rail, the canvas, and its overlays. */
export const mapPage = (title: string) => `<div class="map-page">
<header class="map-header">
<button type="button" class="quiet map-back" data-map="close">← Notebook</button>
<div class="map-title"><strong>Content map</strong><span data-map-slot="title">${escape(title)}</span></div>
<div class="map-tools" data-map-slot="tools"></div>
${themeControl()}
</header>
<div class="map-body">
<aside class="map-rail" aria-label="Notes"><div class="map-rail-head"><strong>Notebook</strong><small>Keep adding: notes pile into the map</small></div>
<div class="map-notes" data-map-slot="notes"></div>
<form class="map-composer" data-map-form="note"><textarea name="note" rows="4" placeholder="Add a note: an idea, a link, a half-thought…" aria-label="A note for the map"></textarea><button type="submit" class="primary">Add</button></form>
</aside>
<section class="map-stage">
<div class="map-canvas" data-map-canvas><div class="map-world" data-map-world><svg class="map-wires" data-map-wires></svg></div></div>
<div class="map-zoom"><button type="button" data-map="zoom-in" aria-label="Zoom in">+</button><button type="button" data-map="zoom-out" aria-label="Zoom out">−</button><button type="button" data-map="fit" title="Fit everything · double-click a block to zoom to it">Fit</button></div>
<div class="map-toast" data-map-slot="toast" hidden></div>
<div class="map-bar" data-map-slot="bar" hidden></div>
<div class="map-menu" data-map-slot="menu" hidden></div>
<div class="map-dragtip" data-map-slot="dragtip" hidden></div>
</section>
</div>
</div>`

/** The header's tools: views, filters, grouping, the series. */
export const mapTools = (
  snapshot: Snapshot,
  view: MapView | null,
  mode: MapMode,
  filter: MapFilter
) => {
  const grouping = snapshot.project.grouping
  const seg = (value: MapMode, label: string) =>
    `<button type="button" data-map="mode:${value}" aria-pressed="${mode === value}">${label}</button>`
  const chip = (value: MapFilter, label: string) =>
    `<button type="button" class="map-chip" data-map="filter:${value}" aria-pressed="${filter === value}">${label}</button>`
  return `<div class="map-seg" role="group" aria-label="Arrange the map">${seg('order', 'By order')}${seg('topic', 'By topic')}</div>
${chip('all', 'All')}${chip('unused', 'Unused')}${chip('new', 'New')}
${mode === 'topic' ? `<button type="button" class="quiet" data-map="group" ${grouping?.state === 'grouping' ? 'disabled' : ''}>${grouping?.state === 'grouping' ? 'Grouping…' : snapshot.project.topics?.length ? 'Group again' : 'Group by topic'}</button>` : ''}
${view?.series ? `<button type="button" class="primary" data-map="new-episode">+ Episode</button>` : `<button type="button" class="primary" data-map="start-series" ${snapshot.status === 'ready' ? '' : 'disabled'}>Start a series</button>`}`
}

const kindLabel = { new: 'new', adds: 'adds to', covered: 'covered' } as const
/** The notes rail: each note and what it became in the map. */
export const mapNotes = (snapshot: Snapshot) => {
  const notes = snapshot.project.notes || []
  if (!notes.length)
    return `<p class="map-hint">Add notes here any time. Each one is sorted into the map: a new page, an addition to a page, or already covered.</p>`
  const page = (id: string) =>
    snapshot.project.slides.findIndex((slide) => slide.id === id) + 1
  return notes
    .map((note) => {
      const results = (note.results || [])
        .map(
          (result) =>
            `<li class="is-${result.kind}"><b>${kindLabel[result.kind]}${result.kind === 'new' ? '' : ` ${page(result.slideId) || ''}`}</b><span>${escape(result.title)}</span></li>`
        )
        .join('')
      const state =
        note.state === 'sorting'
          ? '<p class="map-note-state">Sorting into the map…</p>'
          : note.state === 'failed'
            ? `<p class="map-note-state is-failed">${escape(note.error || 'Could not sort this note')} <button type="button" class="quiet" data-map="resort:${note.id}">Sort again</button></p>`
            : ''
      return `<article class="map-note" data-map-note="${note.id}"><time>${new Date(note.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time><p>${escape(note.text.length > 220 ? `${note.text.slice(0, 219)}…` : note.text)}</p>${state}${results ? `<ul>${results}</ul>` : ''}</article>`
    })
    .join('')
}

const thumb = (svg: string | null | undefined, empty: string) =>
  svg
    ? `<div class="map-thumb">${svg}</div>`
    : `<div class="map-thumb is-empty"><span>${escape(empty)}</span></div>`

/** A page of the map, with where it is used. */
export const mapCard = (
  snapshot: Snapshot,
  view: MapView | null,
  slide: Slide,
  fresh: boolean
) => {
  const index = snapshot.project.slides.indexOf(slide)
  const change = snapshot.changes?.find((item) => item.slideId === slide.id)
  const users = view?.usage[slide.id] || []
  const only =
    slide.onlyIn && view?.episodes.find((e) => e.notebook === slide.onlyIn)
  const added = (snapshot.project.notes?.at(-1)?.results || []).some(
    (result) => result.kind === 'adds' && result.slideId === slide.id
  )
  const flag = only
    ? `<span class="map-flag">Ep ${only.number} only</span>`
    : fresh && slide.fromNote
      ? '<span class="map-flag is-new">new</span>'
      : fresh && added
        ? '<span class="map-flag is-adds">+ added</span>'
        : ''
  const state =
    change?.state === 'working'
      ? '<span class="map-badge is-busy">changing…</span>'
      : change?.state === 'failed'
        ? '<span class="map-badge is-failed">change failed</span>'
        : change
          ? '<span class="map-badge">queued</span>'
          : ''
  const use = slide.aside
    ? '<span class="map-uses is-aside">set aside</span>'
    : users.length && view
      ? `<span class="map-uses">${users
          .map((episode) => {
            const ep = view.episodes.find((e) => e.notebook === episode)
            return `<i style="--ep:${colorOf(view, episode)}">E${ep?.number ?? '?'}</i>`
          })
          .join('')}</span>`
      : // Before a series, every page is unused: saying so is noise.
        view?.series
        ? '<span class="map-uses is-unused">unused</span>'
        : ''
  return `${thumb(slide.svg, change ? 'drawing…' : slide.idea || 'Blank page')}${flag}${state}<div class="map-card-title">${escape(slide.title || 'Untitled page')}</div><div class="map-card-meta">page ${index + 1}${use}</div>`
}

/** An episode's copy of a map page. */
export const copyCard = (
  view: MapView,
  episode: MapEpisode,
  copy: MapCopy,
  index: number,
  page: number,
  mapSvg: string | null = null
) => {
  const repeat = copy.copyOf && (view.usage[copy.copyOf.slide] || []).length > 1
  const badge = copy.orphan
    ? '<span class="map-badge is-failed">original deleted</span>'
    : copy.stale
      ? '<span class="map-badge is-stale">source changed</span>'
      : repeat
        ? '<span class="map-badge is-repeat">repeat</span>'
        : ''
  const made = copy.scene?.made
  const svg = copy.svg === undefined ? mapSvg : copy.svg
  return `${thumb(svg, 'Blank page')}${badge}<span class="map-num${made ? ' is-made' : ''}" style="--ep:${colorOf(view, episode.notebook)}">${made ? '✓' : index + 1}</span><div class="map-card-title">${escape(copy.title)}</div><div class="map-card-meta">${page ? `from page ${page}` : 'its own page'}</div>`
}

/** The episode's first line in, or its last line out. */
export const segueCard = (episode: MapEpisode, end: boolean, last: boolean) => {
  const writing = episode.segues === 'writing'
  const copy = end ? episode.copies.at(-1) : episode.copies[0]
  const text = end ? copy?.outro : copy?.bridge
  const label = end
    ? last
      ? 'Wrap-up'
      : 'Next time'
    : episode.number === 1
      ? 'Cold open'
      : 'Last time'
  return `<div class="map-segue-k">${label}</div><div class="map-segue-s">${writing ? 'writing…' : escape(text || (episode.segues === 'failed' ? 'Could not write it' : '—'))}</div><div class="map-segue-o">episode only</div>`
}

/** The lane's header: the episode, its state, its actions. */
export const laneHead = (view: MapView, episode: MapEpisode) => {
  const video = episode.video
  const state =
    episode.picking?.state === 'picking'
      ? '<span class="map-state is-busy">choosing pages…</span>'
      : episode.picking?.state === 'failed'
        ? '<span class="map-state is-failed">could not choose pages</span>'
        : episode.segues === 'writing'
          ? '<span class="map-state is-busy">writing segues…</span>'
          : video?.joined
            ? '<span class="map-state is-made">made</span>'
            : video && video.scenes
              ? `<span class="map-state is-busy">making ${video.made} of ${video.scenes}</span>`
              : `<span class="map-state">${plural(episode.copies.length, 'page')}</span>`
  const derive = video?.joined
    ? `${episode.teasers.length ? '' : `<button type="button" class="quiet" data-map="teaser:${episode.notebook}">Teaser</button>`}${episode.posts ? '' : `<button type="button" class="quiet" data-map="posts:${episode.notebook}">Posts</button>`}`
    : ''
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span>${state}<span class="map-lane-acts">${derive}<button type="button" class="quiet" data-map="open:${episode.notebook}">${video ? 'Open' : 'Make'}</button></span></div>`
}

/** What a made episode was cut into: teasers and posts. */
export const derivedBlock = (view: MapView, episode: MapEpisode) =>
  `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>From Ep ${episode.number}</b></div><ul class="map-derived">${episode.teasers
    .map(
      (teaser) =>
        `<li><span>Teaser · ${escape(teaser.channel === 'x' ? 'X' : teaser.channel)}</span><em>${teaser.state === 'ready' ? 'ready' : teaser.state === 'cutting' ? 'cutting…' : 'failed'}</em></li>`
    )
    .join(
      ''
    )}${episode.posts ? '<li><span>Posts for X, LinkedIn, YouTube</span><em>drafted</em></li>' : ''}</ul>`
