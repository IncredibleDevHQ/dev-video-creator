// Where everything sits on the content map's canvas, in world units: the map
// block of pages (by the order they were added, or by topic), the series to
// its right with one lane per episode, and what each made episode was cut
// into. Pure, so the canvas can move things by diffing two layouts.
import type { Snapshot } from '../shared/api'
import { topicGroups, type MapView } from '../shared/content-map'

export type MapMode = 'order' | 'topic'
export type MapFilter = 'all' | 'unused' | 'new'
export type Box = { x: number; y: number; w: number; h: number }
export type MapGroup = Box & {
  key: string
  label: string
  meta: string
  slides: string[]
}
export type MapLayout = {
  map: Box
  groups: MapGroup[]
  cards: Record<string, Box>
  series: Box | null
  lanes: Record<string, Box & { rowY: number }>
  copies: Record<string, Box & { episode: string; index: number }>
  segues: Array<Box & { key: string; episode: string; end: boolean }>
  bridges: Array<Box & { key: string; copy: string }>
  connectors: Array<Box & { key: string }>
  empties: Record<string, Box>
  derived: Array<Box & { episode: string }>
}

export const MX = 40,
  MY = 40,
  MP = 20,
  CW = 220,
  CH = 176,
  CG = 18,
  COLS = 3
export const MH = 64,
  GH = 30
export const MW = MP * 2 + COLS * CW + (COLS - 1) * CG
export const SH = 58,
  SP = 16,
  LH = 44,
  QW = 184,
  QH = 160,
  QG = 40,
  SW = 136
export const LPAD = 14,
  LGAP = 14,
  LANEH = LH + QH + 40

const dayOf = (at: string) =>
  new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** The map's groups: the source, then each note, in order; or its topics. */
export const mapGroups = (snapshot: Snapshot, mode: MapMode) => {
  const slides = snapshot.project.slides
  if (mode === 'topic')
    return topicGroups(slides, snapshot.project.topics).map((group) => ({
      key: `t:${group.name}`,
      label: group.name || 'Not grouped yet',
      meta: '',
      slides: group.slides
    }))
  const notes = snapshot.project.notes || []
  const known = new Set(notes.map((note) => note.id))
  const groups = [
    {
      key: 'source',
      label: 'From the source',
      meta: '',
      slides: slides
        .filter((slide) => !slide.fromNote || !known.has(slide.fromNote))
        .map((slide) => slide.id)
    }
  ]
  for (const note of notes)
    groups.push({
      key: `n:${note.id}`,
      label: 'Note',
      meta: dayOf(note.at),
      slides: slides.filter((s) => s.fromNote === note.id).map((s) => s.id)
    })
  return groups.filter((group) => group.slides.length)
}

/** Pages the latest note added or changed: the "New" filter. */
export const newPages = (snapshot: Snapshot) => {
  const last = snapshot.project.notes?.at(-1)
  if (!last) return new Set<string>()
  return new Set([
    ...snapshot.project.slides
      .filter((slide) => slide.fromNote === last.id)
      .map((slide) => slide.id),
    ...(last.results || [])
      .filter((result) => result.kind === 'adds')
      .map((result) => result.slideId)
  ])
}

export const mapLayout = (
  snapshot: Snapshot,
  view: MapView | null,
  mode: MapMode
): MapLayout => {
  const layout: MapLayout = {
    map: { x: MX, y: MY, w: MW, h: 0 },
    groups: [],
    cards: {},
    series: null,
    lanes: {},
    copies: {},
    segues: [],
    bridges: [],
    connectors: [],
    empties: {},
    derived: []
  }
  let y = MY + MH
  for (const group of mapGroups(snapshot, mode)) {
    layout.groups.push({ ...group, x: MX + MP, y, w: MW - MP * 2, h: GH - 8 })
    y += GH
    group.slides.forEach((id, index) => {
      layout.cards[id] = {
        x: MX + MP + (index % COLS) * (CW + CG),
        y: y + Math.floor(index / COLS) * (CH + CG),
        w: CW,
        h: CH
      }
    })
    y += Math.ceil(group.slides.length / COLS) * (CH + CG) + 8
  }
  layout.map.h = Math.max(y - MY + MP - 8, 220)
  if (!view?.series) return layout
  const sx = MX + MW + 180
  let ly = MY + SH
  let widest = 640
  for (const episode of view.episodes) {
    const n = episode.copies.length
    const lx = sx + SP
    const x0 = lx + LPAD
    const rowY = ly + LH
    const w = n
      ? LPAD * 2 + SW * 2 + QG * (n + 1) + QW * n
      : LPAD * 2 + QW * 3 + QG * 2
    layout.lanes[episode.notebook] = { x: lx, y: ly, w, h: LANEH, rowY }
    widest = Math.max(widest, w)
    if (!n)
      layout.empties[episode.notebook] = {
        x: x0,
        y: rowY,
        w: QW * 3 + QG * 2,
        h: QH
      }
    else {
      layout.segues.push({
        key: `s:${episode.notebook}`,
        episode: episode.notebook,
        end: false,
        x: x0,
        y: rowY,
        w: SW,
        h: QH
      })
      episode.copies.forEach((copy, index) => {
        const x = x0 + SW + QG + index * (QW + QG)
        layout.copies[copy.id] = {
          x,
          y: rowY,
          w: QW,
          h: QH,
          episode: episode.notebook,
          index
        }
        layout.connectors.push({
          key: `k:${copy.id}`,
          x: x - QG + 6,
          y: rowY + QH / 2,
          w: QG - 12,
          h: 2
        })
        if (index)
          layout.bridges.push({
            key: `b:${copy.id}`,
            copy: copy.id,
            x: x - QG / 2 - 104,
            y: rowY + QH + 8,
            w: 208,
            h: 18
          })
      })
      const ex = x0 + SW + QG + n * (QW + QG)
      layout.connectors.push({
        key: `k:end:${episode.notebook}`,
        x: ex - QG + 6,
        y: rowY + QH / 2,
        w: QG - 12,
        h: 2
      })
      layout.segues.push({
        key: `e:${episode.notebook}`,
        episode: episode.notebook,
        end: true,
        x: ex,
        y: rowY,
        w: SW,
        h: QH
      })
    }
    ly += LANEH + LGAP
  }
  const sw = SP * 2 + widest
  layout.series = { x: sx, y: MY, w: sw, h: Math.max(ly - MY + SP - LGAP, 180) }
  for (const episode of view.episodes) {
    if (!episode.teasers.length && !episode.posts) continue
    const lane = layout.lanes[episode.notebook]
    const rows = episode.teasers.length + (episode.posts ? 1 : 0)
    layout.derived.push({
      episode: episode.notebook,
      x: sx + sw + 80,
      y: lane.y + 8,
      w: 280,
      h: 52 + rows * 30
    })
  }
  return layout
}

/** Everything's outer edge, for fitting the canvas to the window. */
export const extent = (layout: MapLayout, focus?: Box) => {
  const boxes = focus
    ? [focus]
    : [layout.map, ...(layout.series ? [layout.series] : []), ...layout.derived]
  const x0 = Math.min(...boxes.map((b) => b.x)) - 30
  const y0 = Math.min(...boxes.map((b) => b.y)) - 30
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 30
  const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 30
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Where a dragged page would land in an episode's lane, if over one. */
export const dropSpot = (
  layout: MapLayout,
  view: MapView,
  point: { x: number; y: number },
  skip?: string
) => {
  for (const episode of view.episodes) {
    const lane = layout.lanes[episode.notebook]
    if (!lane) continue
    if (point.x < lane.x || point.x > lane.x + lane.w + 40) continue
    if (point.y < lane.y || point.y > lane.y + lane.h) continue
    const copies = episode.copies.filter((copy) => copy.id !== skip)
    let index = copies.length
    for (let i = 0; i < copies.length; i++) {
      const box = layout.copies[copies[i].id]
      if (point.x < box.x + box.w / 2) {
        index = i
        break
      }
    }
    const marker = !copies.length
      ? lane.x + LPAD + 4
      : index < copies.length
        ? layout.copies[copies[index].id].x - QG / 2
        : layout.copies[copies[copies.length - 1].id].x + QW + QG / 2
    return { episode: episode.notebook, index, marker, y: lane.rowY }
  }
  return null
}
