// The content map's markup: the page around the canvas (header, notes rail,
// selection bar) and each thing on it — a map page, an episode's lane, a
// copy, a segue, what a made episode was cut into. Pure strings.
import type { Snapshot } from '../shared/api'
import type { MapCopy, MapEpisode, MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'
import { themeControl } from './appearance'
import { escape } from './ui'
import { videoOpens } from '../shared/state'
import incredibleLogo from './assets/incredible-logo.svg'
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
// The map's header carries the studio's logo and the notebook's stages, as
// every other screen does (review 6).
export const mapPage = (title: string) => `<div class="map-page">
<header class="map-header">
<a class="brand map-brand" href="/" aria-label="Incredible Studio: all notebooks" title="All notebooks"><img src="${incredibleLogo}" alt=""></a>
<div class="map-title"><strong>Content map</strong><span data-map-slot="title">${escape(title)}</span></div>
<nav class="map-stages" aria-label="Stages" data-map-slot="stages"></nav>
<button type="button" class="quiet map-back" data-map="close" title="Back to the wireframes">← Wireframe</button>
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

/** The notebook's stages; the map is a view of the Wireframe stage. */
export const mapStages = (snapshot: Snapshot) =>
  (
    [
      ['notebook', 'Notebook'],
      ['presentation', 'Wireframe'],
      ['video', 'Video']
    ] as const
  )
    .map(
      ([stage, label]) =>
        `<button type="button" data-map="stage:${stage}" ${stage === 'presentation' ? 'aria-current="page"' : ''} ${stage === 'video' && !videoOpens(snapshot) ? 'disabled title="Make the wireframes first"' : ''}>${label}</button>`
    )
    .join('')

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
      ? '<button type="button" class="quiet" disabled>Grouping… about a minute</button>'
      : grouping?.state === 'failed'
        ? `<span class="map-tool-error" title="${escape(grouping.error || '')}">Grouping failed</span><button type="button" class="quiet" data-map="group">Group again</button>`
        : snapshot.project.topics?.length
          ? '<button type="button" class="quiet" data-map="group">Group again</button>'
          : ''
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
      : ''
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
  fresh: boolean,
  places: number[] = []
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
  // One word beside the page number, never on the drawing (review 6); the
  // card's border carries a change's state too.
  const tag = (kind: string, text: string) =>
    `<span class="map-tag is-${kind}">${escape(text)}</span>`
  const said =
    change?.state === 'failed'
      ? tag('failed', 'change failed')
      : change?.state === 'working'
        ? tag('busy', 'changing…')
        : change
          ? tag('busy', 'queued')
          : only
            ? tag('only', `Ep ${only.number} only`)
            : fresh && slide.fromNote
              ? tag('new', 'new')
              : fresh && added
                ? tag('new', '+ added')
                : slide.aside
                  ? tag('aside', 'set aside')
                  : noteDay(snapshot, slide)
                    ? `<span class="map-from-note" title="From a note, ${escape(noteDay(snapshot, slide))}">note</span>`
                    : ''
  // Used pages wear their episodes' chips; the summary counts the unused.
  const use =
    users.length && view
      ? `<span class="map-uses">${users
          .map((episode) => {
            const ep = view.episodes.find((e) => e.notebook === episode)
            return `<i style="--ep:${colorOf(view, episode)}">E${ep?.number ?? '?'}</i>`
          })
          .join('')}</span>`
      : ''
  const place = places.length
    ? `<span class="map-src" title="Its place in the episode">#${places.join(', #')}</span>`
    : ''
  return `${thumb(slide.svg, change ? 'drawing…' : slide.idea || 'Blank page', Boolean(change))}<div class="map-card-title">${escape(slide.title || 'Untitled page')}</div><div class="map-card-meta">page ${number}${said ? ` · ${said}` : ''}${place}${use}</div>`
}

/** How a page or copy stands, for its card's border. */
export const pageState = (snapshot: Snapshot, slideId: string) => {
  const change = snapshot.changes?.find((item) => item.slideId === slideId)
  return change?.state === 'failed' ? 'is-failed' : change ? 'is-changing' : ''
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
  const made = copy.scene?.made
    ? '<span class="map-made" title="Its scene is made">✓ made</span>'
    : ''
  const svg = copy.svg === undefined ? mapSvg : copy.svg
  // Where it came from, or how it differs from it, beside the drawing.
  const from = copy.orphan
    ? '<span class="map-tag is-failed">original deleted</span>'
    : copy.stale
      ? `<span class="map-tag is-stale">page ${page} changed</span>`
      : page
        ? `from page ${page}`
        : 'its own page'
  return `${thumb(svg, 'Blank page')}<div class="map-card-title"><span class="map-num" style="--ep:${colorOf(view, episode.notebook)}">${index + 1}</span>${escape(copy.title)}</div><div class="map-card-meta">${from}${made}${also}</div>`
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
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span>${state}<span class="map-lane-acts"><button type="button" class="quiet" data-map="open:${episode.notebook}">${video ? 'Open' : 'Make video'}</button></span></div>`
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
  // Drafting says so where the button was, and a failure says why.
  const drafting = episode.drafting?.state === 'drafting'
  const failed = episode.drafting?.state === 'failed'
  const posts = drafting
    ? `<li><span>Posts · X, LinkedIn, YouTube</span><em>drafting… about a minute</em></li>`
    : episode.posts
      ? `<li><span>Posts · X, LinkedIn, YouTube</span><button type="button" data-map="read-posts:${episode.notebook}">Read</button></li>`
      : made
        ? `<li><span>${failed ? `Posts could not be drafted${episode.drafting?.error ? `: ${escape(episode.drafting.error)}` : ''}` : 'Posts · X, LinkedIn, YouTube'}</span><button type="button" data-map="posts:${episode.notebook}">${failed ? 'Draft again' : 'Draft'}</button></li>`
        : ''
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span></div><ul class="map-derived">${teasers.join('')}${posts}</ul>`
}
