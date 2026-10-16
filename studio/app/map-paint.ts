// Paints the canvas: every block, page, copy and segue is an element keyed by
// what it shows, placed in world units, so a change of layout glides rather
// than redraws. Lines show the workflow: from the pages into each episode,
// and from each made episode into its place among the socials; what is
// selected draws its own lines, from a page to each of its copies.
import type { Snapshot } from '../shared/api'
import { unusedPages } from '../shared/content-map'
import type { MapCanvas } from './map-canvas'
import type { Box } from './map-layout'
import { mapPages, newPages, type MapMode, type MapPage } from './map-layout'
import {
  colorOf,
  copyCard,
  derivedBlock,
  laneHead,
  mapCard,
  pageState,
  segueCard,
  socialsHead
} from './map-view'
import { directionCard, gapCard, seriesHead } from './map-nodes'
import { escape } from './ui'

type Item = {
  key: string
  cls: string
  box: Box
  html: string
  data?: Record<string, string>
  /** The whole text, for a block that shows it cut short. */
  title?: string
  /** What a keyboard user hears; with it, the block is reached with Tab. */
  label?: string
}
type Node = HTMLElement & { _html?: string }

const selectedKey = (map: MapCanvas) => {
  const sel = map.sel
  return !sel
    ? ''
    : sel.t === 'page'
      ? `m:${sel.id}`
      : sel.t === 'copy'
        ? `c:${sel.id}`
        : sel.t === 'lane'
          ? `L:${sel.id}`
          : sel.t === 'direction'
            ? `d:${sel.id}`
            : 'B:series'
}

/** The map block's line: what it holds, or how far the drawing is. */
const summary = (
  snapshot: Snapshot,
  pages: MapPage[],
  use: { used: number; unused: number; series: boolean } | null
) => {
  if (snapshot.status === 'building' || snapshot.status === 'reading') {
    // The forming card says the phase; the block's line says nothing yet.
    if (!pages.length) return ''
    // A first draft being checked is drawn, as far as the map shows.
    const drawn = pages.filter(
      (page) => page.state === 'drawn' || page.state === 'draft'
    ).length
    return `Drawing ${pages.length} cards · ${drawn} drawn`
  }
  const count = `${pages.length} card${pages.length === 1 ? '' : 's'}`
  return use?.series
    ? `${count} · ${use.used} used · <em>${use.unused} unused</em>`
    : count
}
const formingLabel = (snapshot: Snapshot) =>
  snapshot.status === 'reading'
    ? 'Reading the source…'
    : snapshot.status === 'draft'
      ? 'Create the wireframes to start the map.'
      : snapshot.status === 'failed'
        ? snapshot.error || 'The map could not be drawn.'
        : /understanding/i.test(lastSlideEvent(snapshot))
          ? 'Understanding the source…'
          : 'Planning the story…'
const lastSlideEvent = (snapshot: Snapshot) =>
  [...snapshot.events].reverse().find((event) => event.kind === 'slide')
    ?.message || ''

/** A failed regroup says why where it is seen: in the group of cards with
 * no topic when there is one, else under the Cards heading (review 6). */
export const failedUnderHeading = (
  snapshot: Snapshot,
  groups: Array<{ key: string }>,
  mode: MapMode
) =>
  snapshot.project.grouping?.state === 'failed' &&
  mode === 'topic' &&
  snapshot.status === 'ready' &&
  !groups.some((group) => group.key === 't:')

/**
 * What the cards not grouped yet offer: grouping them, its progress, or,
 * when it failed, its reason and the way to try again (review 6: it went
 * back to "Group by topic" unsaid).
 */
export const groupAction = (snapshot: Snapshot) => {
  const grouping = snapshot.project.grouping
  if (grouping?.state === 'failed')
    return `<span class="map-group-error" role="status" title="${escape(grouping.error || '')}">Grouping failed${grouping.error ? `: ${escape(grouping.error)}` : ''}</span><button type="button" class="map-group-act" data-map="group">Group again</button>`
  const busy = grouping?.state === 'grouping'
  return `<button type="button" class="map-group-act" data-map="group" ${busy ? 'disabled' : ''}>${busy ? 'Grouping… about a minute' : 'Group by topic · about a minute'}</button>`
}

export const paintWorld = (map: MapCanvas) => {
  const { snapshot, view, layout } = map
  if (!snapshot || !layout) return
  const items: Item[] = []
  const chosen = selectedKey(map)
  const fresh = newPages(snapshot)
  const unused = view
    ? new Set(unusedPages(snapshot.project.slides, view))
    : null
  const pages = snapshot.project.slides
  const used = view
    ? pages.filter((slide) => view.usage[slide.id]?.length).length
    : 0
  const all = mapPages(snapshot)
  // A selected episode's colour marks the map pages it copied.
  const sel = map.sel
  const picked =
    sel?.t === 'lane'
      ? view?.episodes.find((e) => e.notebook === sel.id)
      : undefined
  // Where each lit page sits in the episode: its copies' numbers.
  const sources = new Map<string, number[]>()
  picked?.copies.forEach((copy, index) => {
    const id = copy.copyOf?.slide
    if (id) sources.set(id, [...(sources.get(id) || []), index + 1])
  })
  if (picked && view)
    map.world!.style.setProperty('--sel', colorOf(view, picked.notebook))
  const failedHere = failedUnderHeading(snapshot, layout.groups, map.mode)
  items.push({
    key: 'B:map',
    cls: 'map-block',
    box: layout.map,
    html: `<div class="map-block-head"><h2>Cards</h2>${failedHere ? `<p class="map-block-alert">${groupAction(snapshot)}</p>` : `<p>${summary(snapshot, all, view ? { used, unused: unused?.size ?? 0, series: Boolean(view.series) } : null)}</p>`}</div>`
  })
  // Before the story is planned there is nothing to show but what happens.
  if (!all.length)
    items.push({
      key: 'M:forming',
      cls: 'map-forming',
      box: {
        x: layout.map.x + 20,
        y: layout.map.y + 70,
        w: layout.map.w - 40,
        h: layout.map.h - 90
      },
      html: `<p>${escape(formingLabel(snapshot))}</p><small>Each page appears here as soon as the story plans it, then fills in as it is drawn.</small>`
    })
  for (const group of layout.groups)
    items.push({
      key: `G:${group.key}`,
      cls: 'map-group',
      box: group,
      html: `<b>${escape(group.label)}</b>${group.meta ? `<span>${escape(group.meta)}</span>` : ''}<span>${group.slides.length} page${group.slides.length === 1 ? '' : 's'}</span>${
        group.key === 't:' && snapshot.status === 'ready'
          ? groupAction(snapshot)
          : ''
      }`
    })
  all.forEach((page, index) => {
    const box = layout.cards[page.id]
    if (!box) return
    let cls = 'map-card'
    if (chosen === `m:${page.id}`) cls += ' is-selected'
    if (page.slide?.aside) cls += ' is-aside'
    const planned = page.state === 'planned' || page.state === 'drawing'
    if (planned) cls += ' is-planned'
    if (sources.has(page.id)) cls += ' is-source'
    const state = pageState(snapshot, page.id)
    if (state) cls += ` ${state}`
    if (map.filter === 'unused' && unused && !unused.has(page.id))
      cls += ' is-dim'
    if (map.filter === 'new' && !fresh.has(page.id)) cls += ' is-dim'
    items.push({
      key: `m:${page.id}`,
      cls,
      box,
      html: mapCard(
        snapshot,
        view,
        page,
        index + 1,
        fresh.has(page.id),
        sources.get(page.id)
      ),
      data: { page: page.id },
      ...(planned ? {} : { label: `Page ${index + 1}: ${page.title}` })
    })
  })
  if (view?.series && layout.series) {
    const copies = view.episodes.reduce((n, e) => n + e.copies.length, 0)
    void copies
    items.push({
      key: 'B:series',
      cls: `map-block map-series${chosen === 'B:series' ? ' is-selected' : ''}`,
      box: layout.series,
      html: `${seriesHead(view)}${view.episodes.length ? '' : '<button type="button" class="primary map-series-add" data-map="new-episode">+ Episode</button>'}`,
      label: `Series: ${view.series.title}`
    })
    for (const direction of view.series.directions) {
      const box = layout.directions[direction.id]
      if (!box) continue
      const editing = map.editingDirection === direction.id
      items.push({
        key: `d:${direction.id}`,
        cls: `map-direction${chosen === `d:${direction.id}` ? ' is-selected' : ''}${editing ? ' is-editing' : ''}${direction.answer ? ` is-${direction.answer.state}` : ''}`,
        box: editing ? { ...box, h: box.h + 40 } : box,
        html: directionCard(view, snapshot, direction, editing),
        data: { direction: direction.id },
        label: `Direction: ${direction.text}`
      })
    }
    for (const gap of layout.gaps) {
      const found = view.series.gaps.find((item) => item.id === gap.id)
      if (!found) continue
      items.push({
        key: `g:${gap.id}`,
        cls: 'map-gap',
        box: gap,
        html: gapCard(found),
        title: found.ask
      })
    }
    const pageNo = new Map(pages.map((slide, index) => [slide.id, index + 1]))
    const pageSvg = new Map(pages.map((slide) => [slide.id, slide.svg]))
    view.episodes.forEach((episode, at) => {
      const lane = layout.lanes[episode.notebook]
      const over = map.drag?.over === episode.notebook
      items.push({
        key: `L:${episode.notebook}`,
        cls: `map-lane${chosen === `L:${episode.notebook}` ? ' is-selected' : ''}${over ? ' is-drop' : ''}`,
        box: lane,
        html: laneHead(view, episode),
        data: { lane: episode.notebook },
        label: `Ep ${episode.number}: ${episode.title}`
      })
      const empty = layout.empties[episode.notebook]
      if (empty)
        items.push({
          key: `Z:${episode.notebook}`,
          cls: 'map-empty',
          box: empty,
          html:
            episode.picking?.state === 'picking'
              ? `Choosing pages for “${escape(episode.picking.about)}”…`
              : 'Drop pages here, or select this lane and paste. Nothing is made until you press Make video.',
          data: { lane: episode.notebook }
        })
      episode.copies.forEach((copy, index) => {
        items.push({
          key: `c:${copy.id}`,
          cls: `map-card map-copy${chosen === `c:${copy.id}` ? ' is-selected' : ''}${copy.orphan ? ' is-failed' : copy.stale ? ' is-stale' : ''}`,
          box: layout.copies[copy.id],
          html: copyCard(
            view,
            episode,
            copy,
            index,
            copy.copyOf ? pageNo.get(copy.copyOf.slide) || 0 : 0,
            copy.copyOf ? (pageSvg.get(copy.copyOf.slide) ?? null) : null
          ),
          data: { copy: copy.id },
          label: `Ep ${episode.number}, page ${index + 1}: ${copy.title}`
        })
      })
      for (const segue of layout.segues.filter(
        (s) => s.episode === episode.notebook
      ))
        items.push({
          key: segue.key,
          cls: `map-segue${episode.segues === 'writing' ? ' is-busy' : ''}${picked?.notebook === episode.notebook ? ' is-open' : ''}`,
          box: segue,
          html: segueCard(episode, segue.end, at === view.episodes.length - 1),
          data: { lane: episode.notebook },
          title:
            (segue.end
              ? episode.copies.at(-1)?.outro
              : episode.copies[0]?.bridge) || ''
        })
    })
    for (const bridge of layout.bridges) {
      const episode = map.episodeOf(bridge.copy)
      const copy = episode?.copies.find((c) => c.id === bridge.copy)
      const busy = episode?.segues === 'writing'
      items.push({
        key: bridge.key,
        cls: `map-bridge${busy ? ' is-busy' : ''}${picked && episode?.notebook === picked.notebook ? ' is-open' : ''}`,
        box: bridge,
        html: busy
          ? 'rewriting…'
          : escape(copy?.bridge ? `↳ ${copy.bridge}` : ''),
        title: busy ? '' : copy?.bridge || ''
      })
    }
    for (const connector of layout.connectors)
      items.push({
        key: connector.key,
        cls: 'map-connector',
        box: connector,
        html: ''
      })
    if (layout.socials)
      items.push({
        key: 'S:socials',
        cls: 'map-block map-socials',
        box: layout.socials,
        html: socialsHead(view)
      })
    for (const derived of layout.derived) {
      const episode = view.episodes.find((e) => e.notebook === derived.episode)!
      items.push({
        key: `D:${derived.episode}`,
        cls: 'map-derived-block',
        box: derived,
        html: derivedBlock(view, episode)
      })
    }
  }
  sync(map, items)
  drawWires(map)
}

const sync = (map: MapCanvas, items: Item[]) => {
  const world = map.world!
  const seen = new Set<string>()
  for (const item of items) {
    seen.add(item.key)
    let node = map.els.get(item.key) as Node | undefined
    if (!node) {
      node = document.createElement('div') as Node
      node.dataset.k = item.key
      map.els.set(item.key, node)
      // A new copy flies in from the page it was copied from.
      const lane = item.key.startsWith('c:')
        ? map.episodeOf(item.key.slice(2))?.notebook
        : undefined
      const from =
        map.fly[item.key] || (lane ? map.fly[`pending:${lane}`] : undefined)
      if (lane && map.fly[`pending:${lane}`]) delete map.fly[`pending:${lane}`]
      delete map.fly[item.key]
      node.className = `map-el is-still ${item.cls}`
      node.style.transform = `translate(${(from || item.box).x}px,${(from || item.box).y}px)`
      if (from) node.style.opacity = '0'
      world.appendChild(node)
      void node.offsetWidth
    }
    for (const [key, value] of Object.entries(item.data || {}))
      node.dataset[key] = value
    const dragging = map.drag?.moved && map.drag.key === item.key
    const cls = `map-el ${item.cls}${dragging ? ' is-dragging' : ''}`
    if (node.className !== cls) node.className = cls
    node.style.width = `${item.box.w}px`
    node.style.height = `${item.box.h}px`
    if (!dragging)
      node.style.transform = `translate(${item.box.x}px,${item.box.y}px)`
    node.style.opacity = ''
    const title = item.title || ''
    if (node.title !== title) node.title = title
    const label = item.label || ''
    if ((node.getAttribute('aria-label') || '') !== label) {
      if (label) {
        node.tabIndex = 0
        node.setAttribute('role', 'button')
        node.setAttribute('aria-label', label)
      } else {
        node.removeAttribute('tabindex')
        node.removeAttribute('role')
        node.removeAttribute('aria-label')
      }
    }
    if (node._html !== item.html) {
      node.innerHTML = item.html
      node._html = item.html
    }
  }
  for (const [key, node] of map.els)
    if (!seen.has(key)) {
      map.els.delete(key)
      node.style.opacity = '0'
      setTimeout(() => node.remove(), 300)
    }
}

// Wires bend as Flora's do: out of a node's right side and into the next
// one's left; from one episode down into the next.
// A turn in a gutter may lie past both ends: each corner bends its own way.
const across = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mid = (x1 + x2) / 2
) => {
  const r = Math.min(
    12,
    Math.abs(mid - x1) / 2,
    Math.abs(x2 - mid) / 2,
    Math.abs(y2 - y1) / 2
  )
  const d1 = mid >= x1 ? 1 : -1,
    d2 = x2 >= mid ? 1 : -1,
    dy = y2 >= y1 ? 1 : -1
  return `M${x1},${y1} H${mid - r * d1} Q${mid},${y1} ${mid},${y1 + r * dy} V${y2 - r * dy} Q${mid},${y2} ${mid + r * d2},${y2} H${x2}`
}
const down = (x1: number, y1: number, x2: number, y2: number) => {
  const v = Math.max(16, (y2 - y1) * 0.5)
  return `M${x1},${y1} C${x1},${y1 + v} ${x2},${y2 - v} ${x2},${y2}`
}

/** Whether a wire belongs to what is selected: it starts or ends there, or
 * at the episode a selected copy is in. */
const lit = (map: MapCanvas, from: string, to: string) => {
  const key = selectedKey(map)
  if (!key) return false
  if (from === key || to === key) return true
  const sel = map.sel
  if (sel?.t !== 'copy') return false
  const episode = map.episodeOf(sel.id)
  const page = episode?.copies.find((c) => c.id === sel.id)?.copyOf?.slide
  return Boolean(
    episode && page && from === `m:${page}` && to === `L:${episode.notebook}`
  )
}

const drawWires = (map: MapCanvas) => {
  const svg = map.root.querySelector<SVGSVGElement>('[data-map-wires]')
  const { layout, view, sel } = map
  if (!svg || !layout) return
  const paths: string[] = []
  const colors = new Set<string>()
  // A copy selected: its card's wire to it, drawn solid.
  const source =
    sel?.t === 'copy'
      ? map.episodeOf(sel.id)?.copies.find((c) => c.id === sel.id)?.copyOf
          ?.slide
      : undefined
  for (const episode of view?.episodes || [])
    for (const copy of episode.copies) {
      const page = copy.copyOf?.slide
      const a = page ? layout.cards[page] : undefined
      const b = layout.copies[copy.id]
      if (!a || !b || !view) continue
      const on =
        (sel?.t === 'page' && sel.id === page) ||
        (sel?.t === 'lane' && sel.id === episode.notebook) ||
        source === page
      if (!on) continue
      const sibling = sel?.t === 'copy' && copy.id !== sel.id
      paths.push(
        `<path class="map-wire is-on${sibling ? ' is-sibling' : ''}" stroke="${colorOf(view, episode.notebook)}" d="${across(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2)}"/>`
      )
    }
  for (const flow of layout.flows) {
    const color =
      flow.kind !== 'direction' && flow.episode && view
        ? colorOf(view, flow.episode)
        : ''
    if (color) colors.add(color)
    const on = lit(map, flow.from, flow.to)
    const id = color ? `map-arrow-${color.slice(1)}` : 'map-arrow'
    const d =
      flow.kind === 'chain'
        ? down(flow.x1, flow.y1, flow.x2, flow.y2)
        : across(flow.x1, flow.y1, flow.x2, flow.y2, flow.turn)
    const arrow = flow.kind === 'use' ? '' : ` marker-end="url(#${id})"`
    paths.push(
      `<path class="map-flow is-${flow.kind}${on ? ' is-lit' : ''}${color ? '' : ' is-neutral'}"${color ? ` stroke="${color}"` : ''}${arrow} d="${d}"/>`
    )
    if (flow.kind !== 'chain' || !view) continue
    // The hand-off from one episode to the next, beside its wire.
    const episode = view.episodes.find((e) => e.notebook === flow.episode)
    const carries = episode?.carries
    if (carries)
      paths.push(
        `<text class="map-carries${on ? ' is-lit' : ''}" x="${flow.x1 + 14}" y="${(flow.y1 + flow.y2) / 2 + 4}">${escape(carries.length > 96 ? `${carries.slice(0, 95)}…` : carries)}</text>`
      )
  }
  // A selected episode shows what it builds on from further back.
  if (sel?.t === 'lane' && view) {
    const episode = view.episodes.find((e) => e.notebook === sel.id)
    const lane = layout.lanes[sel.id]
    for (const need of episode?.outline?.needs || []) {
      const from = need.from ? layout.lanes[need.from] : undefined
      if (!from || !lane) continue
      const x = (layout.series?.x ?? from.x) + 4
      paths.push(
        `<path class="map-need" d="M${from.x},${from.y + 30} C${x},${from.y + 30} ${x},${lane.y + 30} ${lane.x},${lane.y + 30}"/>`
      )
    }
  }
  const marker = (id: string, fill: string) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0,0 L10,5 L0,10 z"${fill ? ` fill="${fill}"` : ''}/></marker>`
  const defs = `<defs>${marker('map-arrow', '')}${[...colors].map((color) => marker(`map-arrow-${color.slice(1)}`, color)).join('')}</defs>`
  svg.classList.toggle('has-focus', Boolean(sel && sel.t !== 'series'))
  // Lines pass under what a block shows: its cards, copies, segues,
  // directions, gaps and each episode's head (review 7).
  const boxes = [
    ...Object.values(layout.cards),
    ...Object.values(layout.copies),
    ...layout.segues,
    ...Object.values(layout.directions),
    ...layout.gaps,
    // Whole episodes and the series' head, inset a little so an arrow at
    // one keeps its tip: no line crosses what they hold (review 7).
    ...[
      ...Object.values(layout.lanes),
      ...(layout.head ? [layout.head] : [])
    ].map((box) => ({ x: box.x + 3, y: box.y + 3, w: box.w - 6, h: box.h - 6 }))
  ]
  const mask = `<defs><mask id="map-content-mask" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="white"/>${boxes.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="8" fill="black"/>`).join('')}</mask></defs>`
  // The line being dragged stays above everything.
  svg.innerHTML =
    defs +
    mask +
    `<g mask="url(#map-content-mask)">${paths.join('')}</g>${map.connecting || ''}`
}

/** Redraws only the wires, as a connection is dragged. */
export const repaintWires = (map: MapCanvas) => drawWires(map)
