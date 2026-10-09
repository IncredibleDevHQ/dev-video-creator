// Where everything sits on the content map's canvas, in world units: the map
// block of pages (in the notebook's order, or by topic), the series under it
// with one lane per episode, the Socials box beside the series with what each
// made episode was cut into, and the workflow's lines between them. Pure, so
// the canvas can move things by diffing two layouts.
import type { Snapshot } from '../shared/api'
import { topicGroups, type MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'

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
  /** The Socials box, outside the series; null without a series. */
  socials: Box | null
  /** Each made episode's place in the Socials box, level with its lane. */
  derived: Array<Box & { episode: string }>
  /** The workflow's lines: the pages into the series, and each made
   * episode into its place among the socials. */
  flows: Flow[]
}
export type Flow = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  episode?: string
  /** A flow into an episode runs down this x, left of the series. */
  trunk?: number
}

export const MX = 40,
  MY = 40,
  MP = 20,
  CW = 220,
  CH = 192,
  CG = 18,
  COLS = 3
export const MH = 64,
  GH = 30
export const MW = MP * 2 + COLS * CW + (COLS - 1) * CG
/** A bigger map gets more columns: with the series under it, the whole
 * stays near the canvas's shape. */
export const columnsFor = (pages: number) =>
  pages <= 9 ? COLS : pages <= 16 ? 4 : pages <= 24 ? 6 : pages <= 40 ? 8 : 10
const widthFor = (cols: number) => MP * 2 + cols * CW + (cols - 1) * CG
export const SH = 58,
  SP = 16,
  LH = 44,
  QW = 184,
  QH = 176,
  QG = 40,
  SW = 136
/** A line into a page wraps to two lines under the connector before it. */
export const BH = 34
export const LPAD = 14,
  LGAP = 14,
  LANEH = LH + QH + BH + 22
/** The Socials box's width, and the room its lines cross to reach it. */
export const SOW = 330,
  SOGAP = 150

const dayOf = (at: string) =>
  new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** A page on the map: drawn, a first draft being checked, being drawn, or
 * only planned yet (its title from the story, its picture still to come). */
export type MapPage = {
  id: string
  title: string
  slide?: Slide
  state: 'drawn' | 'draft' | 'drawing' | 'planned'
}

/**
 * The map's pages in order. While the story is planned and drawn, every
 * planned page is already there by its title, and fills in as it is drawn:
 * the map forms on the canvas, as in the Wireframe stage's rail.
 */
export const mapPages = (snapshot: Snapshot): MapPage[] => {
  const slides = snapshot.project.slides
  const drawn = (slide: Slide): MapPage => ({
    id: slide.id,
    title: slide.title,
    slide,
    state: !slide.svg ? 'planned' : slide.draft ? 'draft' : 'drawn'
  })
  const plan = snapshot.status === 'ready' ? [] : snapshot.plan || []
  if (!plan.length) return slides.map(drawn)
  const drawing = new Set(
    snapshot.stopping
      ? []
      : (snapshot.drawing || []).map((index) => plan[index]?.id)
  )
  const pages: MapPage[] = plan.map((entry) => {
    const slide = slides.find((item) => item.id === entry.id)
    return slide
      ? drawn(slide)
      : {
          id: entry.id,
          title: entry.title,
          state: drawing.has(entry.id) ? 'drawing' : 'planned'
        }
  })
  for (const slide of slides)
    if (!plan.some((entry) => entry.id === slide.id)) pages.push(drawn(slide))
  return pages
}

/**
 * The map's groups. By order, one unlabelled group in the notebook's order
 * (a note's page sits where it was placed, numbered with the rest); by
 * topic, a labelled group per topic. While the map forms, its pages are one
 * group in the story's order.
 */
export const mapGroups = (snapshot: Snapshot, mode: MapMode) => {
  const slides = snapshot.project.slides
  if (snapshot.status !== 'ready' && snapshot.plan?.length)
    return [
      {
        key: 'pages',
        label: '',
        meta: '',
        slides: mapPages(snapshot).map((page) => page.id)
      }
    ]
  if (mode === 'topic')
    return topicGroups(slides, snapshot.project.topics).map((group) => ({
      key: `t:${group.name}`,
      label: group.name || 'Not grouped yet',
      meta: '',
      slides: group.slides
    }))
  return [
    { key: 'pages', label: '', meta: '', slides: slides.map((s) => s.id) }
  ].filter((group) => group.slides.length)
}

/** When a page came from a note: the note's day. */
export const noteDay = (snapshot: Snapshot, slide: Slide) => {
  const note = slide.fromNote
    ? snapshot.project.notes?.find((item) => item.id === slide.fromNote)
    : undefined
  return note ? dayOf(note.at) : ''
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
    map: { x: MX, y: MY, w: 0, h: 0 },
    groups: [],
    cards: {},
    series: null,
    lanes: {},
    copies: {},
    segues: [],
    bridges: [],
    connectors: [],
    empties: {},
    socials: null,
    derived: [],
    flows: []
  }
  const cols = columnsFor(mapPages(snapshot).length)
  const mw = widthFor(cols)
  layout.map.w = mw
  let y = MY + MH
  for (const group of mapGroups(snapshot, mode)) {
    if (group.label) {
      layout.groups.push({ ...group, x: MX + MP, y, w: mw - MP * 2, h: GH - 8 })
      y += GH
    }
    group.slides.forEach((id, index) => {
      layout.cards[id] = {
        x: MX + MP + (index % cols) * (CW + CG),
        y: y + Math.floor(index / cols) * (CH + CG),
        w: CW,
        h: CH
      }
    })
    y += Math.ceil(group.slides.length / cols) * (CH + CG) + 8
  }
  layout.map.h = Math.max(y - MY + MP - 8, 220)
  if (!view?.series) return layout
  // The series sits under the map: pages are dragged down into its lanes.
  const sx = MX
  const sy = MY + layout.map.h + 80
  let ly = sy + SH
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
            h: BH
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
  layout.series = {
    x: sx,
    y: sy,
    w: SP * 2 + widest,
    h: Math.max(ly - sy + SP - LGAP, 180)
  }
  // From the pages into each episode: down a trunk left of the series, then
  // into the lane, crossing no card (review 6).
  const trunk = sx - 28
  for (const episode of view.episodes) {
    const lane = layout.lanes[episode.notebook]
    layout.flows.push({
      key: `f:in:${episode.notebook}`,
      episode: episode.notebook,
      trunk,
      x1: MX,
      y1: MY + layout.map.h - 28,
      x2: lane.x,
      y2: lane.y + 22
    })
  }
  // What a made episode was cut into: the Socials box, beside the series,
  // each episode's place level with its lane and a line into it.
  const ox = sx + layout.series.w + SOGAP
  let bottom = sy + SH
  for (const episode of view.episodes) {
    if (!episode.video?.joined && !episode.teasers.length && !episode.posts)
      continue
    const lane = layout.lanes[episode.notebook]
    // Its teasers (or a row to cut one), then its posts.
    const rows = Math.max(1, episode.teasers.length) + 1
    const y = Math.max(bottom, lane.y)
    const place = {
      episode: episode.notebook,
      x: ox + SP,
      y,
      w: SOW - SP * 2,
      h: 44 + rows * 32
    }
    layout.derived.push(place)
    bottom = y + place.h + 14
    layout.flows.push({
      key: `f:${episode.notebook}`,
      episode: episode.notebook,
      x1: lane.x + lane.w,
      y1: lane.y + 22,
      x2: place.x,
      y2: place.y + 22
    })
  }
  layout.socials = {
    x: ox,
    y: sy,
    w: SOW,
    h: Math.max(bottom - sy + SP - 14, 180)
  }
  return layout
}

/** Everything's outer edge, for fitting the canvas to the window. */
export const extent = (layout: MapLayout, focus?: Box) => {
  const boxes = focus
    ? [focus]
    : [
        layout.map,
        ...(layout.series ? [layout.series] : []),
        ...(layout.socials ? [layout.socials] : [])
      ]
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
