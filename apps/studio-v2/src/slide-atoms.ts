// Slide atomisation: turns an authored SVG page into animation units the
// build-order editor can point at. Every paintable element gets a stable id
// (injected into the stored markup), a rect with the text inside it becomes
// one "box" unit, stroked lines/paths become "connector" units with
// endpoints, and the author's own groups stay as parents. The unit tree is
// recomputed from the markup whenever the editor opens; steps only store
// element ids, which the composition driver already understands.

export type SlideUnitKind = 'group' | 'box' | 'label' | 'connector' | 'shape' | 'frame' | 'image'

export type SlideUnit = {
  id: string
  ids: string[]
  kind: SlideUnitKind
  label: string
  bbox: { x: number; y: number; width: number; height: number }
  chrome: boolean
  children: SlideUnit[]
  // Connectors only: where the stroke starts and where its head lands.
  from?: { x: number; y: number }
  to?: { x: number; y: number }
}

export type AtomizedSlide = {
  svg: string
  units: SlideUnit[]
  viewBox: { width: number; height: number }
}

const PAINT_TAGS = new Set(['rect', 'circle', 'ellipse', 'polygon', 'path', 'line', 'polyline', 'text', 'image'])
const CHROME_IDS = new Set(['bg', 'grid', 'sheet-block', 'background'])
// Groups that frame the page rather than carry a build step.
const CHROME_GROUP = /^(header|page-header|footer|page-footer|sheet|frame|chrome)(-|$)/i

const ensureId = (element: Element, counter: { next: number }) => {
  if (!element.id) element.id = `u${counter.next++}`
  return element.id
}

const bboxOf = (element: SVGGraphicsElement) => {
  try {
    const box = element.getBBox()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
}

const center = (box: SlideUnit['bbox']) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

const contains = (outer: SlideUnit['bbox'], point: { x: number; y: number }) =>
  point.x >= outer.x && point.x <= outer.x + outer.width && point.y >= outer.y && point.y <= outer.y + outer.height

const pathEndpoints = (element: SVGGraphicsElement) => {
  const tag = element.tagName.toLowerCase()
  if (tag === 'line') {
    return {
      from: { x: Number(element.getAttribute('x1')), y: Number(element.getAttribute('y1')) },
      to: { x: Number(element.getAttribute('x2')), y: Number(element.getAttribute('y2')) },
    }
  }
  if (typeof (element as SVGGeometryElement).getTotalLength === 'function') {
    const geometry = element as SVGGeometryElement
    try {
      const length = geometry.getTotalLength()
      const start = geometry.getPointAtLength(0)
      const end = geometry.getPointAtLength(length)
      return { from: { x: start.x, y: start.y }, to: { x: end.x, y: end.y } }
    } catch {
      return null
    }
  }
  return null
}

const isStroke = (element: Element, view: Window) => {
  const tag = element.tagName.toLowerCase()
  if (tag === 'line' || tag === 'polyline') return true
  if (tag !== 'path') return false
  return view.getComputedStyle(element).fill === 'none'
}

const labelFor = (element: Element, fallback: string) => {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim()
  if (text) return text.slice(0, 40)
  return fallback
}

const humanize = (id: string) =>
  id.replace(/^s\d+-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/**
 * Parses and measures the SVG inside a hidden host, injecting ids as needed.
 * Must run in a browser (needs layout for getBBox).
 */
export const atomizeSlideSvg = (markup: string): AtomizedSlide => {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const root = parsed.documentElement
  if (root.tagName.toLowerCase() !== 'svg') {
    return { svg: markup, units: [], viewBox: { width: 1280, height: 720 } }
  }
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-100000px;top:0;width:1280px;height:720px;overflow:hidden;visibility:hidden;'
  const live = document.importNode(root, true) as unknown as SVGSVGElement
  host.append(live)
  document.body.append(host)
  const view = window
  const counter = { next: 1 }
  // Stable ids: keep authored ones, number the rest in document order.
  const used = new Set<string>()
  live.querySelectorAll('[id]').forEach(el => used.add(el.id))
  while (used.has(`u${counter.next}`)) counter.next += 1
  const viewBoxAttr = live.getAttribute('viewBox')?.split(/[\s,]+/).map(Number) || []
  const viewBox = {
    width: viewBoxAttr[2] > 0 ? viewBoxAttr[2] : 1280,
    height: viewBoxAttr[3] > 0 ? viewBoxAttr[3] : 720,
  }
  const pageArea = viewBox.width * viewBox.height

  const buildUnits = (parent: Element, inheritedChrome: boolean): SlideUnit[] => {
    const units: SlideUnit[] = []
    const texts: SVGGraphicsElement[] = []
    const rects: SVGGraphicsElement[] = []
    const loose: SVGGraphicsElement[] = []
    Array.from(parent.children).forEach(child => {
      const tag = child.tagName.toLowerCase()
      if (tag === 'defs' || tag === 'metadata' || tag === 'style' || tag === 'title' || tag === 'desc') return
      if (tag === 'g') {
        const id = child.id
        const chrome = inheritedChrome || CHROME_IDS.has(id) || CHROME_GROUP.test(id) || child.getAttribute('data-pptx-role') === 'decoration'
        const children = buildUnits(child, chrome)
        if (!id && children.length) {
          // Anonymous groups are transparent: their children join the parent.
          units.push(...children)
          return
        }
        if (!children.length) return
        ensureId(child, counter)
        while (used.has(`u${counter.next}`)) counter.next += 1
        const box = bboxOf(child as SVGGraphicsElement)
        units.push({
          id: child.id,
          ids: children.flatMap(unit => unit.ids),
          kind: 'group',
          label: humanize(child.id),
          bbox: box,
          chrome,
          children,
        })
        return
      }
      if (!PAINT_TAGS.has(tag)) return
      const element = child as SVGGraphicsElement
      ensureId(element, counter)
      while (used.has(`u${counter.next}`)) counter.next += 1
      if (tag === 'text') texts.push(element)
      else if (tag === 'rect') rects.push(element)
      else loose.push(element)
    })
    // Boxes: a rect that frames text becomes one unit with the text.
    const claimed = new Set<Element>()
    // Smaller rects claim their text first, so a frame around several boxes
    // does not swallow the labels of the boxes inside it.
    const rectBoxes = rects.map(rect => ({ rect, box: bboxOf(rect) })).sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)
    rectBoxes.forEach(({ rect, box }) => {
      const chrome = inheritedChrome || CHROME_IDS.has(rect.id) || box.width * box.height > pageArea * 0.6
      const outlineOnly = view.getComputedStyle(rect).fill === 'none'
      const large = box.width * box.height > pageArea * 0.08
      const inside = outlineOnly && large ? [] : texts.filter(text => !claimed.has(text) && contains(box, center(bboxOf(text))))
      inside.forEach(text => claimed.add(text))
      const kind: SlideUnitKind = inside.length ? 'box' : outlineOnly || large ? 'frame' : 'shape'
      units.push({
        id: rect.id,
        ids: [rect.id, ...inside.map(text => text.id)],
        kind,
        label: inside.length ? labelFor(inside[0], humanize(rect.id)) : kind === 'frame' ? 'Frame' : 'Shape',
        bbox: box,
        chrome,
        children: [],
      })
    })
    texts.filter(text => !claimed.has(text)).forEach(text => {
      units.push({
        id: text.id,
        ids: [text.id],
        kind: 'label',
        label: labelFor(text, humanize(text.id)),
        bbox: bboxOf(text),
        chrome: inheritedChrome,
        children: [],
      })
    })
    loose.forEach(element => {
      const tag = element.tagName.toLowerCase()
      const box = bboxOf(element)
      const chrome = inheritedChrome || CHROME_IDS.has(element.id) || element.getAttribute('data-pptx-role') === 'decoration'
      if (tag === 'image') {
        units.push({ id: element.id, ids: [element.id], kind: 'image', label: 'Image', bbox: box, chrome, children: [] })
        return
      }
      if (isStroke(element, view)) {
        const ends = pathEndpoints(element)
        units.push({
          id: element.id,
          ids: [element.id],
          kind: 'connector',
          label: `Connector ${element.id.replace(/^u/, '#')}`,
          bbox: box,
          chrome,
          children: [],
          from: ends?.from,
          to: ends?.to,
        })
        return
      }
      units.push({ id: element.id, ids: [element.id], kind: 'shape', label: tag === 'circle' ? 'Circle' : tag === 'polygon' ? 'Polygon' : 'Shape', bbox: box, chrome, children: [] })
    })
    // Document order for the mixed list: by first appearance in the parent.
    const order = new Map<string, number>()
    Array.from(parent.querySelectorAll('[id]')).forEach((el, index) => {
      if (!order.has(el.id)) order.set(el.id, index)
    })
    return units.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }

  const units = buildUnits(live, false)
  pairLabelsAcrossPage(units, pageArea)
  markPageTitle(units, viewBox)
  const svg = new XMLSerializer().serializeToString(live)
  host.remove()
  return { svg, units, viewBox }
}

/**
 * The page title (the largest text, sitting in the top fifth of the page) is
 * context, not a build step: it stays visible from the start.
 */
const markPageTitle = (units: SlideUnit[], viewBox: { width: number; height: number }) => {
  const labels = flattenUnits(units).filter(unit => unit.kind === 'label' && !unit.chrome)
  if (labels.length < 2) return
  const tallest = labels.reduce((best, unit) => (unit.bbox.height > best.bbox.height ? unit : best))
  if (tallest.bbox.y + tallest.bbox.height / 2 < viewBox.height * 0.2) tallest.chrome = true
}

/**
 * Pairs every loose label with the smallest filled shape that encloses it,
 * wherever the two sit in the tree: authored SVGs often keep card rects and
 * their text in different groups.
 */
const pairLabelsAcrossPage = (units: SlideUnit[], pageArea: number) => {
  const all = flattenUnits(units)
  const containers = all.filter(unit => (unit.kind === 'shape' || unit.kind === 'box') && unit.bbox.width * unit.bbox.height < pageArea * 0.08)
  const labels = all.filter(unit => unit.kind === 'label')
  const merged = new Set<string>()
  labels.forEach(label => {
    const c = center(label.bbox)
    let best: SlideUnit | null = null
    let bestArea = Infinity
    containers.forEach(container => {
      if (!contains(container.bbox, c)) return
      const area = container.bbox.width * container.bbox.height
      if (area < bestArea) {
        bestArea = area
        best = container
      }
    })
    if (!best) return
    const host = best as SlideUnit
    if (host.kind === 'shape') {
      host.kind = 'box'
      host.label = label.label
    }
    host.ids = [...host.ids, ...label.ids]
    merged.add(label.id)
  })
  if (!merged.size) return
  const prune = (list: SlideUnit[]) => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const unit = list[i]
      if (unit.kind === 'group') {
        prune(unit.children)
        unit.ids = unit.children.flatMap(child => child.ids)
      } else if (merged.has(unit.id)) {
        list.splice(i, 1)
      }
    }
  }
  prune(units)
}

export const flattenUnits = (units: SlideUnit[]): SlideUnit[] =>
  units.flatMap(unit => (unit.kind === 'group' ? [unit, ...flattenUnits(unit.children)] : [unit]))

/** Leaf units only (no groups), excluding chrome. */
export const leafUnits = (units: SlideUnit[]): SlideUnit[] =>
  flattenUnits(units).filter(unit => unit.kind !== 'group' && !unit.chrome)

/** Top-to-bottom, left-to-right, with a row tolerance so aligned rows read as rows. */
export const readingOrder = (units: SlideUnit[], rowTolerance = 24) =>
  [...units].sort((a, b) => {
    const ay = a.bbox.y
    const by = b.bbox.y
    if (Math.abs(ay - by) > rowTolerance) return ay - by
    return a.bbox.x - b.bbox.x
  })

export type OrderedStepDraft = {
  title: string
  reveals: string[]
  verb: 'reveal' | 'trace' | 'focus'
}

/**
 * Follows the arrows: boxes become steps in flow order (sources first),
 * each connector joins the step of the box it points at, and labels ride
 * with the nearest box. Anything the graph cannot place falls back to
 * reading order at the end.
 */
export type SlideEdge = { connector: SlideUnit; source: SlideUnit | null; target: SlideUnit | null }

const distanceBetween = (a: SlideUnit['bbox'], b: SlideUnit['bbox']) => {
  const ca = center(a)
  const cb = center(b)
  return Math.hypot(ca.x - cb.x, ca.y - cb.y)
}

/** Flow nodes: boxes and small shapes (the "+" circles), never frames or labels. */
const flowNodes = (leaves: SlideUnit[]) => leaves.filter(unit => unit.kind === 'box' || unit.kind === 'shape')

/** Distance from a point to the boundary of a box (0 when on the edge). */
const boundaryDistance = (box: SlideUnit['bbox'], point: { x: number; y: number }) => {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width))
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height))
  if (dx === 0 && dy === 0) {
    // Inside: distance to the nearest edge.
    return Math.min(point.x - box.x, box.x + box.width - point.x, point.y - box.y, box.y + box.height - point.y)
  }
  return Math.hypot(dx, dy)
}

/**
 * Matches connector endpoints to flow nodes by the nearest boundary — an
 * arrow's tail sits on the edge of the node it leaves and its head on the
 * edge of the node it enters. One tolerance, relative to the page size, so
 * the rule holds for any diagram scale.
 */
export const inferEdges = (units: SlideUnit[]): SlideEdge[] => {
  const leaves = leafUnits(units)
  const nodes = flowNodes(leaves)
  const extent = leaves.reduce(
    (max, unit) => Math.max(max, unit.bbox.x + unit.bbox.width, unit.bbox.y + unit.bbox.height),
    0,
  )
  const tolerance = Math.max(6, extent * 0.02)
  const nodeAt = (point: { x: number; y: number }, exclude?: SlideUnit | null) => {
    let best: SlideUnit | null = null
    let bestDistance = tolerance
    nodes.forEach(node => {
      if (exclude && node.id === exclude.id) return
      const distance = boundaryDistance(node.bbox, point)
      if (distance < bestDistance) {
        bestDistance = distance
        best = node
      }
    })
    return best as SlideUnit | null
  }
  return leaves
    .filter(unit => unit.kind === 'connector')
    .map(connector => {
      const target = connector.to ? nodeAt(connector.to) : null
      const source = connector.from ? nodeAt(connector.from, target) : null
      return { connector, source, target }
    })
}

export const orderByArrows = (units: SlideUnit[]): OrderedStepDraft[] => {
  const leaves = leafUnits(units)
  const connected = new Set<string>()
  inferEdges(units).forEach(({ source, target }) => {
    if (source && target && source.id !== target.id) {
      connected.add(source.id)
      connected.add(target.id)
    }
  })
  // Nodes that take part in the flow lead; an unconnected shape (a bullet
  // dot, a decoration) rides along with whatever it sits next to.
  const boxes = flowNodes(leaves).filter(unit => unit.kind === 'box' || connected.has(unit.id))
  const connectors = leaves.filter(unit => unit.kind === 'connector')
  const labels = leaves.filter(unit => unit.kind === 'label' || unit.kind === 'image')
  const frames = leaves.filter(unit => unit.kind === 'frame')
  const incoming = new Map<string, Set<string>>()
  const outgoing = new Map<string, Set<string>>()
  const connectorTarget = new Map<string, SlideUnit>()
  inferEdges(units).forEach(({ connector, source, target }) => {
    // A dangling arrow rides with whichever end it touches.
    const rider = target || source
    if (rider) connectorTarget.set(connector.id, rider)
    if (source && target && source.id !== target.id) {
      if (!outgoing.has(source.id)) outgoing.set(source.id, new Set())
      if (!incoming.has(target.id)) incoming.set(target.id, new Set())
      outgoing.get(source.id)!.add(target.id)
      incoming.get(target.id)!.add(source.id)
    }
  })
  // Kahn's algorithm with reading-order tie breaks; cycles resolve by reading order.
  const remaining = new Map(boxes.map(box => [box.id, new Set(incoming.get(box.id) || [])]))
  const ordered: SlideUnit[] = []
  const placed = new Set<string>()
  while (remaining.size) {
    const ready = readingOrder(boxes.filter(box => remaining.has(box.id) && remaining.get(box.id)!.size === 0))
    const next = ready[0] || readingOrder(boxes.filter(box => remaining.has(box.id)))[0]
    if (!next) break
    ordered.push(next)
    placed.add(next.id)
    remaining.delete(next.id)
    remaining.forEach(set => set.delete(next.id))
  }
  const byBox = new Map<string, SlideUnit[]>()
  const attach = (box: SlideUnit, unit: SlideUnit) => {
    if (!byBox.has(box.id)) byBox.set(box.id, [])
    byBox.get(box.id)!.push(unit)
  }
  connectors.forEach(connector => {
    const target = connectorTarget.get(connector.id)
    if (target) attach(target, connector)
  })
  labels.forEach(label => {
    const c = center(label.bbox)
    let best: SlideUnit | null = null
    let bestDistance = Infinity
    boxes.forEach(box => {
      const bc = center(box.bbox)
      const distance = Math.hypot(bc.x - c.x, bc.y - c.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = box
      }
    })
    if (best && bestDistance < 260) attach(best, label)
  })
  // A frame appears with the first box it encloses, so the outline is on
  // screen before the content it groups.
  frames.forEach(frame => {
    const first = ordered.find(box => contains(frame.bbox, center(box.bbox)))
    if (first) attach(first, frame)
  })
  const titleFor = (box: SlideUnit) => {
    if (box.kind === 'box') return box.label
    // An unlabelled node borrows the closest label's words.
    const reach = Math.max(box.bbox.width, box.bbox.height) * 1.5 + 8
    let best: SlideUnit | null = null
    let bestDistance = reach
    labels.forEach(label => {
      const distance = distanceBetween(label.bbox, box.bbox)
      if (distance < bestDistance) {
        bestDistance = distance
        best = label
      }
    })
    return best ? (best as SlideUnit).label : box.label
  }
  const steps: OrderedStepDraft[] = ordered.map(box => {
    const riders = byBox.get(box.id) || []
    const hasConnector = riders.some(unit => unit.kind === 'connector')
    return {
      title: titleFor(box),
      reveals: [
        ...riders.filter(u => u.kind === 'frame').flatMap(u => u.ids),
        ...riders.filter(u => u.kind === 'connector').flatMap(u => u.ids),
        ...box.ids,
        ...riders.filter(u => u.kind !== 'connector' && u.kind !== 'frame').flatMap(u => u.ids),
      ],
      verb: hasConnector ? 'trace' : 'reveal',
    }
  })
  return steps
}

/**
 * Generic starting plan for any page. Flow pages (enough arrows resolve
 * between nodes) build in arrow order; structured pages use the author's
 * groups; plain pages read top-left to bottom-right. Nothing is dumped into
 * a catch-all: every leftover joins the step of its nearest unit.
 */
export const suggestSteps = (units: SlideUnit[]): OrderedStepDraft[] => {
  const leaves = leafUnits(units)
  if (!leaves.length) return []
  const connectors = leaves.filter(unit => unit.kind === 'connector')
  const resolved = inferEdges(units).filter(edge => edge.source && edge.target && edge.source.id !== edge.target.id)
  // A flow is arrows between labelled boxes; arrows between bare shapes are
  // charts and decorations, which read better by structure.
  const labelledEdges = resolved.filter(edge => edge.source?.kind === 'box' || edge.target?.kind === 'box')
  const flowMode = labelledEdges.length >= 2 && labelledEdges.length >= connectors.length * 0.3
  let steps: OrderedStepDraft[]
  if (flowMode) {
    steps = orderByArrows(units)
  } else {
    const groups = units.filter(unit => unit.kind === 'group' && !unit.chrome && unit.ids.length)
    if (groups.length >= 2) {
      steps = groups.map(group => ({ title: group.label, reveals: [...group.ids], verb: 'reveal' as const }))
    } else {
      steps = readingOrder(leaves.filter(unit => !unit.chrome && unit.kind !== 'connector' && unit.kind !== 'frame')).map(unit => ({
        title: unit.label,
        reveals: [...unit.ids],
        verb: 'reveal' as const,
      }))
    }
  }
  return attachLeftovers(units, steps)
}

/** Every unplaced, non-chrome unit joins the step of its nearest placed unit. */
export const attachLeftovers = (units: SlideUnit[], steps: OrderedStepDraft[]): OrderedStepDraft[] => {
  const leaves = leafUnits(units)
  const placed = new Map<string, number>()
  steps.forEach((step, index) => step.reveals.forEach(id => placed.set(id, index)))
  const placedUnits = leaves.filter(unit => unit.ids.some(id => placed.has(id)))
  leaves
    .filter(unit => !unit.chrome && !unit.ids.some(id => placed.has(id)))
    .forEach(unit => {
      let best: SlideUnit | null = null
      let bestDistance = Infinity
      placedUnits.forEach(candidate => {
        const distance = distanceBetween(candidate.bbox, unit.bbox)
        if (distance < bestDistance) {
          bestDistance = distance
          best = candidate
        }
      })
      const host = best as SlideUnit | null
      const index = host ? placed.get(host.ids[0]) : undefined
      if (index === undefined) {
        steps.push({ title: unit.label, reveals: [...unit.ids], verb: unit.kind === 'connector' ? 'trace' : 'reveal' })
        unit.ids.forEach(id => placed.set(id, steps.length - 1))
        return
      }
      const step = steps[index]
      step.reveals = unit.kind === 'connector' ? [...unit.ids, ...step.reveals] : [...step.reveals, ...unit.ids]
      unit.ids.forEach(id => placed.set(id, index))
    })
  return steps.filter(step => step.reveals.length)
}

/** One step per leaf unit in reading order. */
export const oneStepPerUnit = (units: SlideUnit[]): OrderedStepDraft[] =>
  readingOrder(leafUnits(units)).map(unit => ({
    title: unit.label,
    reveals: unit.ids,
    verb: unit.kind === 'connector' ? 'trace' : 'reveal',
  }))
