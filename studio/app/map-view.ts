// The content map's markup: the page around the canvas (header, notes rail,
// selection bar) and each thing on it — a map page, an episode's lane, a
// copy, a segue, what a made episode was cut into. Pure strings.
import type { Snapshot } from '../shared/api'
import type { MapCopy, MapEpisode, MapView } from '../shared/content-map'
import {
  DEFAULT_LENGTH,
  fitOf,
  lengthLabel,
  windowLabel
} from '../shared/length'
import type { Slide } from '../shared/model'
import type { LengthGoal } from '../shared/storyboard'
import { escape } from './ui'
import { videoOpens } from '../shared/state'
import incredibleLogo from './assets/incredible-logo.svg'
import { lineColor, ports } from './map-nodes'
import { voiceIcon } from './voice-icons'
import {
  noteDay,
  type MapFilter,
  type MapMode,
  type MapPage
} from './map-layout'

const dots =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>'
const closeIcon =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
const chevron =
  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'

/** What Talk says on hover, with its key. */
export const TALK_TIP =
  'Talk to Studio AI · T: it hears you, answers, and works on the canvas'

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
<div class="map-pill map-pill-project">
<a class="brand map-brand" href="/" aria-label="Incredible Studio: all notebooks" title="All notebooks"><img src="${incredibleLogo}" alt=""></a>
<div class="map-title"><strong>Content map</strong><span data-map-slot="title">${escape(title)}</span></div>
<nav class="map-stages" aria-label="Stages" data-map-slot="stages"></nav>
</div>
<button type="button" class="quiet map-back" data-map="close" title="Back to the wireframes">← Wireframe</button>
<div class="map-pill map-pill-tools"><button type="button" class="map-notes-toggle" data-map="notes" aria-expanded="false" aria-controls="map-notes-panel" title="Notes · N"><span>Notes</span><b data-map-slot="note-count"></b></button><div class="map-tools" data-map-slot="tools"></div><button type="button" class="map-more-button" data-map="map-more" aria-label="More" title="More">${dots}</button></div>
</header>
<div class="map-body">
<aside class="map-rail" id="map-notes-panel" aria-label="Notes"><div class="map-rail-head"><strong>Notes</strong><button type="button" class="map-rail-close" data-map="notes" aria-label="Close the notes" title="Close · N">${closeIcon}</button></div>
<div class="map-notes" data-map-slot="notes"></div>
<form class="map-composer" data-map-form="note"><textarea name="note" rows="4" placeholder="Add a note: an idea, a link, a half-thought…" aria-label="A note for the map"></textarea><button type="submit" class="primary">Add</button></form>
</aside>
<section class="map-stage">
<div class="map-canvas" data-map-canvas><div class="map-world" data-map-world><svg class="map-wires" data-map-wires></svg></div></div>
<nav class="map-toolpill" aria-label="Canvas tools">
<button type="button" class="map-tool-talk" data-voice="talk" title="${TALK_TIP}" aria-label="Talk to Studio AI">${voiceIcon('spark', 17)}</button>
<button type="button" class="map-tool-add" data-map="add" title="Add a direction, a note or an episode · or double-click the canvas" aria-label="Add">+</button>
<button type="button" data-comment="tool" title="Comment · C: say it or type it" aria-label="Comment" aria-pressed="false">${voiceIcon('comment')}</button>
</nav>
<div class="map-queue" data-map-slot="queue"></div>
<div class="map-zoom"><button type="button" data-map="zoom-out" aria-label="Zoom out">−</button><span data-map-slot="zoom">100%</span><button type="button" data-map="zoom-in" aria-label="Zoom in">+</button><button type="button" data-map="fit" title="Fit everything · double-click a block to zoom to it">Fit</button><button type="button" data-map="help" aria-label="Shortcuts" title="Shortcuts">?</button></div>
<div class="map-dock"><div class="map-toast" data-map-slot="toast" hidden></div><div class="map-bar" data-map-slot="bar" hidden></div></div>
<div class="map-menu" data-map-slot="menu" hidden></div>
<div class="map-dragtip" data-map-slot="dragtip" hidden></div>
</section>
</div>
</div>`

/** A map that can't open: one line, what to do, and the way back to the
 * notebook it was opened from or home (review 7: its link stayed on
 * Loading…). */
const mapStop = (title: string, back: string, more = '') => `<header>
<a class="brand" href="/" aria-label="Incredible Studio"><img src="${incredibleLogo}" alt="">Incredible</a>
</header>
<main class="notebook-opening"><section role="status" aria-live="polite"><h1>${title}</h1>${more}${
  back
    ? `<a class="${more ? '' : 'primary '}opening-home" href="/?notebook=${encodeURIComponent(back)}">Back to the notebook</a>`
    : `<a class="${more ? '' : 'primary '}opening-home" href="/">Back to your notebooks</a>`
}</section></main>`

/** A map that no longer exists. */
export const mapGone = (back = '') => mapStop('This map is gone', back)

/** A map that couldn't be read just now, the studio offline perhaps: why,
 * and a way to try again. */
export const mapFailed = (id: string, back = '', why = '') =>
  mapStop(
    'The map didn’t open',
    back,
    `${why ? `<p>${escape(why)}</p>` : ''}<a class="primary opening-retry" href="/?map=${encodeURIComponent(id)}">Try again</a>`
  )

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
        `<button type="button" data-map="stage:${stage}"  ${stage === 'video' && !videoOpens(snapshot) ? 'disabled title="Make the wireframes first"' : ''}>${label}</button>`
    )
    .join('')

/** The header's tools: one View menu for how the map is arranged and
 * filtered (Figma and Miro keep such choices behind one control), and the
 * series' one next step. Nothing while the map forms. */
export const mapTools = (
  snapshot: Snapshot,
  view: MapView | null,
  mode: MapMode,
  filter: MapFilter
) => {
  if (snapshot.status !== 'ready') return ''
  const grouping = snapshot.project.grouping
  const shown = [
    mode === 'topic' ? 'By topic' : 'By order',
    filter === 'unused' ? 'unused' : filter === 'new' ? 'from notes' : '',
    mode === 'topic' && grouping?.state === 'grouping' ? 'grouping…' : '',
    mode === 'topic' && grouping?.state === 'failed' ? 'grouping failed' : ''
  ]
    .filter(Boolean)
    .join(' · ')
  const failed =
    mode === 'topic' && grouping?.state === 'failed'
      ? `Grouping failed${grouping.error ? `: ${grouping.error}` : ''}`
      : ''
  return `<button type="button" class="map-view-button${filter !== 'all' ? ' is-filtered' : ''}" data-map="view-menu" aria-haspopup="menu" title="${escape(failed || 'Arrange and filter the map')}">${escape(shown)}${chevron}</button>${view?.series ? `<button type="button" class="primary" data-map="new-episode">+ Episode</button>` : `<button type="button" class="primary" data-map="start-series">Start a series</button>`}`
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
      : `<p class="map-hint">Add notes here any time. They are kept, and sorted into the map once the wireframes are drawn.</p>`
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
        note.state === 'waiting'
          ? '<p class="map-note-state">Saved · sorted into the map once the wireframes are drawn</p>'
          : note.state === 'sorting'
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
    return `<div class="map-node-label"><b>${escape(slide.title || 'A new card')}</b><span>card ${number}</span></div>${thumb(null, drawing ? 'drawing…' : 'planned', drawing)}`
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
  return `<div class="map-node-label"><b>${escape(slide.title || 'Untitled card')}</b><span>${number}${said ? ` · ${said}` : ''}${place}${use}</span></div>${thumb(slide.svg, change ? 'drawing…' : slide.idea || 'Blank card', Boolean(change))}${ports(true, slide.svg ? 'card' : null)}`
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

const fitArrow = (fit: 'short' | 'long') =>
  `<svg class="map-runs-arrow" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${fit === 'short' ? 'M12 5v14m-6-6 6 6 6-6' : 'M12 19V5m-6 6 6-6 6 6'}"/></svg>`

/** A running time against a window: the time and, outside it, the reason
 * in words with an arrow, never by colour alone (review 7). The slider
 * redraws it as it moves. */
export const runsText = (seconds: number, goal: LengthGoal) => {
  const fit = fitOf(seconds, goal)
  const reason =
    fit === 'within'
      ? ''
      : ` · ${fitArrow(fit)}${fit === 'short' ? `under ${lengthLabel(goal.min)}` : `over ${lengthLabel(goal.max)}`}`
  return `${lengthLabel(seconds)}${reason}`
}

/** The same, said in full for its tooltip. */
export const runsTitle = (seconds: number, goal: LengthGoal) =>
  fitOf(seconds, goal) === 'within'
    ? `About ${lengthLabel(seconds)} spoken, inside ${windowLabel(goal)}`
    : `About ${lengthLabel(seconds)} spoken; each episode asks for ${windowLabel(goal)}`

/** About how long the episode runs, against the series' window. */
const runs = (view: MapView, episode: MapEpisode) => {
  if (!episode.seconds) return ''
  const goal = view.series?.length || DEFAULT_LENGTH
  const fit = fitOf(episode.seconds, goal)
  return ` · <span class="map-runs${fit === 'within' ? '' : ` is-${fit}`}" data-runs="${episode.seconds}" title="${escape(runsTitle(episode.seconds, goal))}">${runsText(episode.seconds, goal)}</span>`
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
            : `<span class="map-state">${plural(episode.copies.length, 'card')}${runs(view, episode)}</span>${video?.joined ? '<span class="map-state is-made">· made</span>' : ''}`
  const outline = episode.outline
  const builds = (outline?.needs || [])
    .map((need) =>
      need.from
        ? view.episodes.find((e) => e.notebook === need.from)?.number
        : undefined
    )
    .filter((n): n is number => Boolean(n))
  const lines = (outline?.lines || [])
    .map(
      (id) =>
        `<i class="map-line-dot" style="--line:${lineColor(view, id)}" title="${escape(view.series?.lines.find((l) => l.id === id)?.name || '')}"></i>`
    )
    .join('')
  const win = outline
    ? `<div class="map-lane-win">${lines}<span><b>Win</b> ${escape(outline.win)}</span>${builds.length ? `<span class="map-builds">builds on ${[...new Set(builds)].map((n) => `Ep ${n}`).join(', ')}</span>` : ''}${episode.made ? '<span class="map-lock" title="Its video has started: plans keep it as it is">made · kept</span>' : ''}</div>`
    : ''
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span>${state}<span class="map-lane-acts"><button type="button" class="quiet" data-map="open:${episode.notebook}">${video ? 'Open' : 'Make video'}</button></span></div>${win}${ports(true, 'episode')}`
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
  return `<div class="map-lane-head"><i class="map-dot" style="--ep:${colorOf(view, episode.notebook)}"></i><b>Ep ${episode.number}</b><span class="map-lane-title">${escape(episode.title)}</span></div><ul class="map-derived">${teasers.join('')}${posts}</ul>${ports(true, null)}`
}
