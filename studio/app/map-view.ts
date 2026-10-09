// The content map's markup: the page around the canvas (header, notes rail,
// selection bar) and each thing on it — a map page, an episode's lane, a
// copy, a segue, what a made episode was cut into. Pure strings.
import type { Snapshot } from '../shared/api'
import type { MapCopy, MapEpisode, MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'
import { themeControl } from './appearance'
import { escape } from './ui'
import {
  noteDay,
  type MapFilter,
  type MapMode,
  type MapPage
} from './map-layout'

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
<button type="button" class="quiet map-notes-toggle" data-map="notes" aria-expanded="false">Notes</button>
<div class="map-tools" data-map-slot="tools"></div>
${themeControl()}
</header>
<div class="map-body">
<aside class="map-rail" aria-label="Notes"><div class="map-rail-head"><strong>Notes</strong></div>
<div class="map-notes" data-map-slot="notes"></div>
<form class="map-composer" data-map-form="note"><textarea name="note" rows="4" placeholder="Add a note: an idea, a link, a half-thought…" aria-label="A note for the map"></textarea><button type="submit" class="primary">Add</button></form>
</aside>
<section class="map-stage">
<div class="map-canvas" data-map-canvas><div class="map-world" data-map-world><svg class="map-wires" data-map-wires></svg></div></div>
<div class="map-zoom"><button type="button" data-map="zoom-out" aria-label="Zoom out">−</button><span data-map-slot="zoom">100%</span><button type="button" data-map="zoom-in" aria-label="Zoom in">+</button><button type="button" data-map="fit" title="Fit everything · double-click a block to zoom to it">Fit</button><button type="button" data-map="help" aria-label="Shortcuts" title="Shortcuts">?</button></div>
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
  // Only what can be used now: nothing while the map forms; Unused once a
  // series uses pages; From notes once a note has landed. A filter pressed
  // again shows every page.
  if (snapshot.status !== 'ready') return ''
  const filters = [
    ...(view?.series ? [chip('unused', 'Unused')] : []),
    ...(snapshot.project.notes?.length ? [chip('new', 'From notes')] : [])
  ]
  return `<div class="map-seg" role="group" aria-label="Arrange the map">${seg('order', 'By order')}${seg('topic', 'By topic')}</div>
${filters.join('')}
${
  mode !== 'topic'
    ? ''
    : grouping?.state === 'grouping'
      ? '<button type="button" class="quiet" disabled>Grouping…</button>'
      : snapshot.project.topics?.length
        ? '<button type="button" class="quiet map-regroup" data-map="group" aria-label="Group again" title="Group again">↻</button>'
        : '<button type="button" class="quiet" data-map="group">Group by topic</button>'
}
${view?.series ? `<button type="button" class="primary" data-map="new-episode">+ Episode</button>` : `<button type="button" class="primary" data-map="start-series">Start a series</button>`}`
}

const kindLabel = {
  new: 'new page',
  adds: 'adds to',
  covered: 'covered by'
} as const
/** The notes rail: each note and what it became in the map; a long note
 * opens with More. */
export const mapNotes = (snapshot: Snapshot, open: Set<string> = new Set()) => {
  const notes = snapshot.project.notes || []
  if (!notes.length)
    return snapshot.status === 'ready'
      ? `<p class="map-hint">Add notes here any time. Each one is sorted into the map: a new page, an addition to a page, or already covered.</p>`
      : `<p class="map-hint">Once the map is drawn, notes added here are sorted into it.</p>`
  const page = (id: string) =>
    snapshot.project.slides.findIndex((slide) => slide.id === id) + 1
  return notes
    .map((note) => {
      // Each result shows its page on the map, while the page is there.
      const results = (note.results || [])
        .map((result) => {
          const at = page(result.slideId)
          const said = `<b>${kindLabel[result.kind]}</b><span>${at ? `p.${at} · ` : ''}${escape(result.title)}</span>`
          return `<li class="is-${result.kind}">${at ? `<button type="button" class="map-reveal" data-map="reveal:${result.slideId}" title="${escape(result.line ? `“${result.line}” · show the page` : 'Show the page')}">${said}</button>` : said}</li>`
        })
        .join('')
      const state =
        note.state === 'sorting'
          ? '<p class="map-note-state">Sorting into the map…</p>'
          : note.state === 'failed'
            ? `<p class="map-note-state is-failed">${escape(note.error || 'Could not sort this note')} <button type="button" class="quiet" data-map="resort:${note.id}">Sort again</button></p>`
            : ''
      const long = note.text.length > 220
      const text =
        long && !open.has(note.id) ? `${note.text.slice(0, 219)}…` : note.text
      const more = long
        ? `<button type="button" class="map-more-note" data-map="note-more:${note.id}">${open.has(note.id) ? 'Less' : 'More'}</button>`
        : ''
      return `<article class="map-note" data-map-note="${note.id}"><time>${new Date(note.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time><p>${escape(text)}</p>${more}${state}${results ? `<ul>${results}</ul>` : ''}</article>`
    })
    .join('')
}

const thumb = (svg: string | null | undefined, empty: string, busy = false) =>
  svg
    ? `<div class="map-thumb">${svg}</div>`
    : `<div class="map-thumb is-empty${busy ? ' is-busy' : ''}"><span>${escape(empty)}</span></div>`

/** A page of the map, with where it is used; while the map forms, a page
 * planned or being drawn shows its title and fills in when it is drawn. */
export const mapCard = (
  snapshot: Snapshot,
  view: MapView | null,
  page: MapPage,
  number: number,
  fresh: boolean
) => {
  const slide: Slide = page.slide || {
    id: page.id,
    title: page.title,
    svg: null
  }
  if (page.state === 'planned' || page.state === 'drawing') {
    const change = snapshot.changes?.find((item) => item.slideId === slide.id)
    const drawing = page.state === 'drawing' || Boolean(change)
    return `${thumb(null, drawing ? 'drawing…' : 'planned', drawing)}<div class="map-card-title">${escape(slide.title || 'A new page')}</div><div class="map-card-meta">page ${number}</div>`
  }
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
  const day = noteDay(snapshot, slide)
  const from = day
    ? ` <span class="map-from-note" title="From a note, ${escape(day)}">· note</span>`
    : ''
  return `${thumb(slide.svg, change ? 'drawing…' : slide.idea || 'Blank page', Boolean(change))}${flag}${state}<div class="map-card-title">${escape(slide.title || 'Untitled page')}</div><div class="map-card-meta">page ${number}${from}${use}</div>`
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
  // The other episodes that use the same map page, by their colour.
  const others = copy.copyOf
    ? (view.usage[copy.copyOf.slide] || []).filter(
        (id) => id !== episode.notebook
      )
    : []
  const also = others.length
    ? `<span class="map-uses" title="Also in another episode">${others
        .map(
          (id) =>
            `<i style="--ep:${colorOf(view, id)}">E${view.episodes.find((e) => e.notebook === id)?.number ?? '?'}</i>`
        )
        .join('')}</span>`
    : ''
  const badge = copy.orphan
    ? '<span class="map-badge is-failed">original deleted</span>'
    : copy.stale
      ? '<span class="map-badge is-stale">source changed</span>'
      : ''
  const made = copy.scene?.made
    ? '<span class="map-made" title="Its scene is made">✓ made</span>'
    : ''
  const svg = copy.svg === undefined ? mapSvg : copy.svg
  return `${thumb(svg, 'Blank page')}${badge}<span class="map-num" style="--ep:${colorOf(view, episode.notebook)}">${index + 1}</span><div class="map-card-title">${escape(copy.title)}</div><div class="map-card-meta">${page ? `from page ${page}` : 'its own page'}${made}${also}</div>`
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
  return `<div class="map-segue-k">${label}</div><div class="map-segue-s">${writing ? 'writing…' : escape(text || (episode.segues === 'failed' ? 'Could not write it' : '—'))}</div>`
}

/** The lane's header: the episode, its state, and the way into making it;
 * what it is cut into once made is in the Socials box. */
export const laneHead = (view: MapView, episode: MapEpisode) => {
  const video = episode.video
  const state =
    episode.picking?.state === 'picking'
      ? '<span class="map-state is-busy">choosing pages…</span>'
      : episode.picking?.state === 'failed'
        ? '<span class="map-state is-failed">could not choose pages</span>'
        : episode.segues === 'writing'
          ? '<span class="map-state is-busy">writing segues…</span>'
          : video && !video.joined && video.scenes
            ? `<span class="map-state is-busy">making ${video.made} of ${video.scenes}</span>`
            : `<span class="map-state">${plural(episode.copies.length, 'page')}</span>${video?.joined ? '<span class="map-state is-made">· made</span>' : ''}`
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span>${state}<span class="map-lane-acts"><button type="button" class="quiet" data-map="open:${episode.notebook}">${video ? 'Open' : 'Make…'}</button></span></div>`
}

const CHANNELS: Record<string, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube'
}
/** The Socials box's head: what it holds, or what will land in it. */
export const socialsHead = (view: MapView) => {
  const made = view.episodes.filter((e) => e.video?.joined)
  const cut = view.episodes.reduce(
    (n, e) => n + e.teasers.length + (e.posts ? 1 : 0),
    0
  )
  return `<div class="map-block-head"><h2>Socials</h2><p>${
    made.length
      ? `${plural(cut, 'piece')} from ${plural(made.length, 'made episode')}`
      : 'A made episode’s teaser and posts land here'
  }</p></div>`
}

/** A made episode's place among the socials: its teaser to watch, its posts
 * to read, or the button that makes each. */
export const derivedBlock = (view: MapView, episode: MapEpisode) => {
  const made = Boolean(episode.video?.joined)
  const teasers = episode.teasers.length
    ? episode.teasers.map(
        (teaser) =>
          `<li><span>Teaser for ${escape(CHANNELS[teaser.channel] || teaser.channel)} · ${escape(teaser.aspect)}</span>${
            teaser.state === 'ready' && teaser.objectKey
              ? `<a href="/objects/${escape(teaser.objectKey)}" target="_blank" rel="noopener">Watch</a>`
              : `<em>${teaser.state === 'cutting' ? 'cutting…' : teaser.state === 'ready' ? 'ready' : 'failed'}</em>`
          }</li>`
      )
    : made
      ? [
          `<li><span>Teaser for X · 9:16</span><button type="button" data-map="teaser:${episode.notebook}">Cut</button></li>`
        ]
      : []
  const posts = episode.posts
    ? `<li><span>Posts · X, LinkedIn, YouTube</span><button type="button" data-map="read-posts:${episode.notebook}">Read</button></li>`
    : made
      ? `<li><span>Posts · X, LinkedIn, YouTube</span><button type="button" data-map="posts:${episode.notebook}">Draft</button></li>`
      : ''
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span></div><ul class="map-derived">${teasers.join('')}${posts}</ul>`
}
