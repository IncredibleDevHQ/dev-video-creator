// Paints the canvas: every block, page, copy and segue is an element keyed by
// what it shows, placed in world units, so a change of layout glides rather
// than redraws. Lines show the workflow: from the pages into each episode,
// and from each made episode into its place among the socials; what is
// selected draws its own lines, from a page to each of its copies.
import type { Snapshot } from '../shared/api'
import { unusedPages } from '../shared/content-map'
import type { MapCanvas } from './map-canvas'
import type { Box } from './map-layout'
import { mapPages, newPages, type MapPage } from './map-layout'
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
    return `Drawing ${pages.length} pages · ${drawn} drawn`
  }
  const count = `${pages.length} page${pages.length === 1 ? '' : 's'}`
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
  items.push({
    key: 'B:map',
    cls: 'map-block',
    box: layout.map,
    html: `<div class="map-block-head"><h2>Pages</h2><p>${summary(snapshot, all, view ? { used, unused: unused?.size ?? 0, series: Boolean(view.series) } : null)}</p></div>`
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
  const grouping = snapshot.project.grouping?.state === 'grouping'
  for (const group of layout.groups)
    items.push({
      key: `G:${group.key}`,
      cls: 'map-group',
      box: group,
      html: `<b>${escape(group.label)}</b>${group.meta ? `<span>${escape(group.meta)}</span>` : ''}<span>${group.slides.length} page${group.slides.length === 1 ? '' : 's'}</span>${
        group.key === 't:' && snapshot.status === 'ready'
          ? `<button type="button" class="map-group-act" data-map="group" ${grouping ? 'disabled' : ''}>${grouping ? 'Grouping… about a minute' : 'Group by topic · about a minute'}</button>`
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
    items.push({
      key: 'B:series',
      cls: 'map-block map-series',
      box: layout.series,
      html: `<div class="map-block-head"><h2>Series · ${escape(view.series.title)}</h2><p>${view.episodes.length ? `${view.episodes.length} episode${view.episodes.length === 1 ? '' : 's'} · ${copies} page${copies === 1 ? '' : 's'} from the map` : 'No episodes yet'}</p>${view.episodes.length ? '' : '<button type="button" class="primary map-series-add" data-map="new-episode">+ Episode</button>'}</div>`,
      label: `Series: ${view.series.title}`
    })
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
              : 'Drop pages here, or select this lane and paste. Nothing is made until you press Make.',
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
      if (!from) node.style.opacity = '0'
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

// Down from a page to a copy below it, or across from a lane to the socials.
const down = (x1: number, y1: number, x2: number, y2: number) => {
  const v = Math.max(50, (y2 - y1) * 0.5)
  return `M${x1},${y1} C${x1},${y1 + v} ${x2},${y2 - v} ${x2},${y2}`
}
const across = (x1: number, y1: number, x2: number, y2: number) => {
  const h = Math.max(40, (x2 - x1) * 0.5)
  return `M${x1},${y1} C${x1 + h},${y1} ${x2 - h},${y2} ${x2},${y2}`
}

const drawWires = (map: MapCanvas) => {
  const svg = map.root.querySelector<SVGSVGElement>('[data-map-wires]')
  const { layout, view, sel } = map
  if (!svg || !layout) return
  const paths: string[] = []
  const colors = new Set<string>()
  // The copy selected: its map page's wires, its own drawn solid.
  const source =
    sel?.t === 'copy'
      ? map.episodeOf(sel.id)?.copies.find((c) => c.id === sel.id)?.copyOf
          ?.slide
      : undefined
  // Lines to cards only for what is selected: a page, a copy or an episode
  // (review 6: drawn for every copy, they crossed the map).
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
        `<path class="map-wire is-on${sibling ? ' is-sibling' : ''}" stroke="${colorOf(view, episode.notebook)}" d="${down(a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y)}"/>`
      )
    }
  // The workflow's own lines, always, with an arrow where each one lands.
  for (const flow of layout.flows) {
    const color = flow.episode && view ? colorOf(view, flow.episode) : ''
    if (color) colors.add(color)
    const id = color ? `map-arrow-${color.slice(1)}` : 'map-arrow'
    paths.push(
      `<path class="map-flow${color ? '' : ' is-neutral'}"${color ? ` stroke="${color}"` : ''} marker-end="url(#${id})" d="${
        flow.trunk
          ? `M${flow.x1},${flow.y1} H${flow.trunk} V${flow.y2} H${flow.x2}`
          : flow.episode
            ? across(flow.x1, flow.y1, flow.x2, flow.y2)
            : down(flow.x1, flow.y1, flow.x2, flow.y2)
      }"/>`
    )
  }
  const marker = (id: string, fill: string) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0,0 L10,5 L0,10 z"${fill ? ` fill="${fill}"` : ''}/></marker>`
  const defs = `<defs>${marker('map-arrow', '')}${[...colors].map((color) => marker(`map-arrow-${color.slice(1)}`, color)).join('')}</defs>`
  svg.classList.toggle('has-focus', Boolean(sel && sel.t !== 'series'))
  svg.innerHTML = defs + paths.join('')
}
