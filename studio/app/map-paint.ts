// Paints the canvas: every block, page, copy and segue is an element keyed by
// what it shows, placed in world units, so a change of layout glides rather
// than redraws. Wires are drawn only for the selection: a page to its copies,
// an episode to the pages it copied.
import { unusedPages } from '../shared/content-map'
import type { MapCanvas } from './map-canvas'
import type { Box } from './map-layout'
import { newPages } from './map-layout'
import {
  colorOf,
  copyCard,
  derivedBlock,
  laneHead,
  mapCard,
  segueCard
} from './map-view'
import { escape } from './ui'

type Item = {
  key: string
  cls: string
  box: Box
  html: string
  data?: Record<string, string>
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
        : `L:${sel.id}`
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
  items.push({
    key: 'B:map',
    cls: 'map-block',
    box: layout.map,
    html: `<div class="map-block-head"><h2>Pages</h2><p>${pages.length} page${pages.length === 1 ? '' : 's'}${view?.series ? ` · ${used} used · <em>${unused?.size ?? 0} unused</em>` : ''}${snapshot.status === 'building' ? ' · drawing' : ''}</p></div>`
  })
  for (const group of layout.groups)
    items.push({
      key: `G:${group.key}`,
      cls: 'map-group',
      box: group,
      html: `<b>${escape(group.label)}</b>${group.meta ? `<span>${escape(group.meta)}</span>` : ''}<span>${group.slides.length} page${group.slides.length === 1 ? '' : 's'}</span>`
    })
  for (const slide of pages) {
    const box = layout.cards[slide.id]
    if (!box) continue
    let cls = 'map-card'
    if (chosen === `m:${slide.id}`) cls += ' is-selected'
    if (slide.aside) cls += ' is-aside'
    if (map.filter === 'unused' && unused && !unused.has(slide.id))
      cls += ' is-dim'
    if (map.filter === 'new' && !fresh.has(slide.id)) cls += ' is-dim'
    items.push({
      key: `m:${slide.id}`,
      cls,
      box,
      html: mapCard(snapshot, view, slide, fresh.has(slide.id)),
      data: { page: slide.id }
    })
  }
  if (view?.series && layout.series) {
    const copies = view.episodes.reduce((n, e) => n + e.copies.length, 0)
    items.push({
      key: 'B:series',
      cls: 'map-block map-series',
      box: layout.series,
      html: `<div class="map-block-head"><h2>Series · ${escape(view.series.title)}</h2><p>${view.episodes.length ? `${view.episodes.length} episode${view.episodes.length === 1 ? '' : 's'} · ${copies} cop${copies === 1 ? 'y' : 'ies'} of map pages` : 'No episodes yet: add one with + Episode'}</p></div>`
    })
    const pageNo = new Map(pages.map((slide, index) => [slide.id, index + 1]))
    view.episodes.forEach((episode, at) => {
      const lane = layout.lanes[episode.notebook]
      const over = map.drag?.over === episode.notebook
      items.push({
        key: `L:${episode.notebook}`,
        cls: `map-lane${chosen === `L:${episode.notebook}` ? ' is-selected' : ''}${over ? ' is-drop' : ''}`,
        box: lane,
        html: laneHead(view, episode),
        data: { lane: episode.notebook }
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
          cls: `map-card map-copy${chosen === `c:${copy.id}` ? ' is-selected' : ''}`,
          box: layout.copies[copy.id],
          html: copyCard(
            view,
            episode,
            copy,
            index,
            copy.copyOf ? pageNo.get(copy.copyOf.slide) || 0 : 0
          ),
          data: { copy: copy.id }
        })
      })
      for (const segue of layout.segues.filter(
        (s) => s.episode === episode.notebook
      ))
        items.push({
          key: segue.key,
          cls: `map-segue${episode.segues === 'writing' ? ' is-busy' : ''}`,
          box: segue,
          html: segueCard(episode, segue.end, at === view.episodes.length - 1),
          data: { lane: episode.notebook }
        })
    })
    for (const bridge of layout.bridges) {
      const episode = map.episodeOf(bridge.copy)
      const copy = episode?.copies.find((c) => c.id === bridge.copy)
      const busy = episode?.segues === 'writing'
      items.push({
        key: bridge.key,
        cls: `map-bridge${busy ? ' is-busy' : ''}`,
        box: bridge,
        html: busy
          ? 'rewriting…'
          : escape(copy?.bridge ? `↳ ${copy.bridge}` : '')
      })
    }
    for (const connector of layout.connectors)
      items.push({
        key: connector.key,
        cls: 'map-connector',
        box: connector,
        html: ''
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

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const d = Math.max(60, Math.abs(x2 - x1) * 0.4)
  const v = Math.max(50, Math.abs(y2 - y1) * 0.5)
  return `M${x1},${y1} C${x1 + d},${y1} ${x2},${y2 - v} ${x2},${y2}`
}

const drawWires = (map: MapCanvas) => {
  const svg = map.root.querySelector('[data-map-wires]')
  const { layout, view, sel } = map
  if (!svg || !layout) return
  const paths: string[] = []
  const wire = (
    page: string,
    copy: string,
    episode: string,
    sibling = false
  ) => {
    const a = layout.cards[page]
    const b = layout.copies[copy]
    if (a && b && view)
      paths.push(
        `<path class="map-wire${sibling ? ' is-sibling' : ''}" stroke="${colorOf(view, episode)}" d="${curve(a.x + a.w, a.y + a.h / 2, b.x + b.w / 2, b.y)}"/>`
      )
  }
  for (const episode of view?.episodes || [])
    for (const copy of episode.copies) {
      const page = copy.copyOf?.slide
      if (!page) continue
      if (sel?.t === 'page' && sel.id === page)
        wire(page, copy.id, episode.notebook)
      if (sel?.t === 'lane' && sel.id === episode.notebook)
        wire(page, copy.id, episode.notebook)
      if (sel?.t === 'copy') {
        const chosen = map
          .episodeOf(sel.id)
          ?.copies.find((c) => c.id === sel.id)
        if (chosen?.copyOf?.slide === page)
          wire(page, copy.id, episode.notebook, copy.id !== sel.id)
      }
    }
  svg.innerHTML = paths.join('')
}
