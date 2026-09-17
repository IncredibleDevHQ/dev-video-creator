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
  // What the page declared, when it did (the contract): a role on a group, a
  // kind on a node, and for connectors the ids they join and the verb
  // between them. Declared facts are believed before geometry is.
  role?: string
  declaredKind?: string
  // What the page says this thing IS (server, database, queue, client,
  // service, cache, worker, browser, cdn …): the appearance layer draws it
  // and the driver gives it its own motion.
  entityType?: string
  // A thing the page drew to be moved: a request, a token, a packet. It
  // starts hidden and only a scene program brings it on and travels it.
  actorRole?: string
  // The drawn object this thing asked for by name (data-object): the studio
  // looks the brief up under it, draws it once, and reuses it wherever the
  // same object is named.
  objectName?: string
  // The artwork this thing wears: the pieces the scene may move by name
  // (the bucket's tokens, the server's indicator), and the box the drawing
  // occupies while it plays — which is not always its box at rest.
  appearance?: {
    key?: string
    parts: Record<string, string>
    envelope?: { x: number; y: number; width: number; height: number }
  }
  verb?: string
  declared?: { from?: string; to?: string }
}

export type AtomizedSlide = {
  svg: string
  units: SlideUnit[]
  viewBox: { width: number; height: number }
  // What the page says it is, when its generator said so: cover, toc,
  // content, ending (ppt-master) or title, list, diagram, numbers, quote,
  // close (the studio's own generator). Empty when undeclared.
  pageRole: string
  // A world larger than the frame, when the page declared one
  // (data-world="x y w h"): the camera may travel there.
  world?: { x: number; y: number; width: number; height: number }
}

const PAINT_TAGS = new Set(['rect', 'circle', 'ellipse', 'polygon', 'path', 'line', 'polyline', 'text', 'image'])
const CHROME_IDS = new Set(['bg', 'grid', 'sheet-block', 'background'])
// Groups that frame the page rather than carry a build step.
const CHROME_GROUP = /^(header|page-header|footer|page-footer|sheet|frame|chrome)(-|$)/i
// Pages that declare their roles (the studio's own generator does) are read, not guessed.
const CHROME_ROLES = new Set(['background', 'decoration', 'header', 'footer', 'chrome'])

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
    return { svg: markup, units: [], viewBox: { width: 1280, height: 720 }, pageRole: '' }
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
      // An actor is a unit of its own, never page ink: it is not part of
      // what the page shows at rest, so it never counts for layout.
      if (child.hasAttribute('data-actor')) {
        ensureId(child, counter)
        while (used.has(`u${counter.next}`)) counter.next += 1
        const box = bboxOf(child as SVGGraphicsElement)
        units.push({
          id: child.id,
          ids: [child.id, ...Array.from(child.querySelectorAll('[id]')).map(node => node.id).filter(Boolean)],
          kind: 'shape',
          label: humanize(child.id),
          bbox: box,
          chrome: false,
          children: [],
          actorRole: (child.getAttribute('data-actor') || 'actor').trim().toLowerCase(),
        })
        return
      }
      // Artwork the page drew for a thing belongs to that thing, whole. Its
      // shapes are not parts of the page: a gauge's needle is not a node and
      // a rack's rails are not arrows.
      if (child.hasAttribute('data-appearance-for')) return
      if (tag === 'g') {
        const id = child.id
        const chrome = inheritedChrome || CHROME_IDS.has(id) || CHROME_GROUP.test(id) || child.getAttribute('data-pptx-role') === 'decoration' || CHROME_ROLES.has(child.getAttribute('data-role') || '')
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
        const role = child.getAttribute('data-role') || child.getAttribute('data-pptx-role') || undefined
        const declaredKind = child.getAttribute('data-kind') || undefined
        const entityType = (child.getAttribute('data-entity') || '').trim().toLowerCase() || undefined
        // A declared node is one part: its box carries the group's label and
        // its declared kind, so a connector can point at the group's id.
        const only = children.length === 1 && children[0].kind !== 'group' ? children[0] : null
        if (role === 'node' && only) {
          units.push({ ...only, id: child.id, ids: [child.id, ...only.ids], role, declaredKind, ...(entityType ? { entityType } : {}), bbox: box })
          return
        }
        units.push({
          id: child.id,
          ids: children.flatMap(unit => unit.ids),
          kind: 'group',
          label: humanize(child.id),
          bbox: box,
          chrome,
          children,
          ...(role ? { role } : {}),
          ...(entityType ? { entityType } : {}),
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
      // An appearance image is fidelity on top of a unit, not a unit: it is
      // attached to the unit it dresses once every unit is known.
      if (element.hasAttribute('data-appearance-for')) return
      const box = bboxOf(element)
      const chrome = inheritedChrome || CHROME_IDS.has(element.id) || element.getAttribute('data-pptx-role') === 'decoration' || CHROME_ROLES.has(element.getAttribute('data-role') || '')
      if (tag === 'image') {
        units.push({ id: element.id, ids: [element.id], kind: 'image', label: 'Image', bbox: box, chrome, children: [] })
        return
      }
      if (isStroke(element, view)) {
        const ends = pathEndpoints(element)
        const verb = element.getAttribute('data-verb') || undefined
        const declaredFrom = element.getAttribute('data-from') || undefined
        const declaredTo = element.getAttribute('data-to') || undefined
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
          ...(verb ? { verb } : {}),
          ...(declaredFrom || declaredTo ? { declared: { ...(declaredFrom ? { from: declaredFrom } : {}), ...(declaredTo ? { to: declaredTo } : {}) } } : {}),
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
  attachAppearance(live, units)
  // A title-like page may keep all its words in header chrome: with nothing
  // else on the page, those words are the subject. The eyebrow and the
  // footer badge stay chrome; the title and its support line come forward.
  if (!leafUnits(units).some(unit => !unit.chrome)) {
    const badge = /^§\s|\bSHEET\s+\d|^[a-z0-9.-]+\.(com|io|org|net|dev|ai)\b/i
    flattenUnits(units).forEach(leaf => {
      if (leaf.kind === 'label' && leaf.label && !badge.test(leaf.label.trim())) leaf.chrome = false
    })
  }
  const svg = new XMLSerializer().serializeToString(live)
  host.remove()
  const pageRole = String(root.getAttribute('data-page-role') || root.getAttribute('data-pptx-page-role') || '').trim().toLowerCase()
  const worldParts = String(root.getAttribute('data-world') || '').trim().split(/[\s,]+/).map(Number)
  const world = worldParts.length === 4 && worldParts.every(Number.isFinite) && worldParts[2] > 0 && worldParts[3] > 0 ? { x: worldParts[0], y: worldParts[1], width: worldParts[2], height: worldParts[3] } : undefined
  return { svg, units, viewBox, pageRole, ...(world ? { world } : {}) }
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
  // Declared endpoints resolve by id, through a group to its one part.
  const all = flattenUnits(units)
  const byId = new Map(all.map(unit => [unit.id, unit]))
  const declaredNode = (id?: string) => {
    if (!id) return null
    const unit = byId.get(id)
    if (!unit) return null
    if (unit.kind !== 'group') return unit
    const inside = leafUnits([unit]).find(child => child.kind === 'box' || child.kind === 'shape')
    return inside || null
  }
  return leaves
    .filter(unit => unit.kind === 'connector')
    .map(connector => {
      const declaredTarget = declaredNode(connector.declared?.to)
      const declaredSource = declaredNode(connector.declared?.from)
      const target = declaredTarget || (connector.to ? nodeAt(connector.to) : null)
      const source = declaredSource || (connector.from ? nodeAt(connector.from, target) : null)
      return { connector, source, target }
    })
}

// The appearance layer rides with its unit: every element marked as the
// appearance of a unit joins that unit's ids, so it reveals, dims and
// moves with it and never counts as ink of its own.
const attachAppearance = (root: Element, units: SlideUnit[]) => {
  const byId = new Map(flattenUnits(units).map(unit => [unit.id, unit]))
  // What the page asked to be drawn as, whether or not a drawing has arrived.
  Array.from(root.querySelectorAll('[data-object]')).forEach(element => {
    const asked = (element.getAttribute('data-object') || '').trim()
    const unit = byId.get(element.id)
    const owner = unit && unit.kind === 'group' ? leafUnits([unit]).find(leaf => leaf.kind === 'box' || leaf.kind === 'shape') || unit : unit
    if (asked && owner) owner.objectName = asked
  })
  Array.from(root.querySelectorAll('[data-appearance-for]')).forEach(element => {
    // A drawing that has been stood down keeps its place in the page and
    // stops speaking for the thing it used to dress.
    if (element.hasAttribute('data-appearance-replaced')) return
    const named = byId.get(element.getAttribute('data-appearance-for') || '')
    if (!named) return
    // A page may name the node's group; the artwork belongs to the thing
    // inside it, so the group and everything drawn in it reveal and move
    // with the thing itself.
    const owner = named.kind === 'group' ? leafUnits([named]).find(leaf => leaf.kind === 'box' || leaf.kind === 'shape') || named : named
    // The pieces the artwork exposes, by the name the brief gave them. The
    // element id may be prefixed by the composition; the name never is.
    const parts: Record<string, string> = {}
    Array.from(element.querySelectorAll('[data-part]')).forEach(piece => {
      const name = (piece.getAttribute('data-part') || '').trim()
      if (name && piece.id) parts[name] = piece.id
    })
    const ownName = (element.getAttribute('data-part') || '').trim()
    if (ownName && element.id) parts[ownName] = element.id
    const envelope = bboxOf(element as SVGGraphicsElement)
    owner.appearance = {
      ...(element.getAttribute('data-appearance-key') ? { key: element.getAttribute('data-appearance-key') || '' } : {}),
      parts,
      // What it covers while it plays, not only at rest: a drawing whose
      // parts move needs the room they move through.
      ...(envelope.width && envelope.height ? { envelope } : {}),
    }
    ;[element, ...Array.from(element.querySelectorAll('[id]'))]
      .map(node => node.id)
      .filter(Boolean)
      .forEach(id => {
        if (!owner.ids.includes(id)) owner.ids.push(id)
      })
  })
}

/**
 * Dress a thing on the page in accepted artwork.
 *
 * The drawing goes in as that thing's appearance: it reveals, dims and travels
 * with it, never counts as ink of its own, and the pieces the scene animates
 * keep the names the brief gave them. The page's own label and numbers stay
 * where they were — the artwork replaces the picture, not the words.
 */
/** The narrowest column a drawn object can read in, at 1280x720. */
export const MIN_OBJECT_COLUMN = 96

/** Raised when the page left no room for the drawing it asked for. */
export class AppearanceTooSmall extends Error {}

export const wearAppearance = (
  svg: string,
  unitId: string,
  artwork: { svg: string; key?: string; parts: Array<{ id: string; element: string; as?: string; fills?: 'up' | 'right' }>; viewBox: { width: number; height: number } },
) => {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = parsed.documentElement
  const host = root.querySelector(`#${CSS.escape(unitId)}`)
  if (!host) return svg
  // A box can only be measured where the page is laid out, so the fitting
  // happens in the same hidden host the atomiser measures in.
  const measuring = document.createElement('div')
  measuring.style.cssText = 'position:absolute;left:-100000px;top:0;width:1280px;height:720px;overflow:hidden;visibility:hidden;'
  const live = document.importNode(root, true) as unknown as SVGSVGElement
  measuring.append(live)
  document.body.append(measuring)
  const measured = live.querySelector(`#${CSS.escape(unitId)}`) as SVGGraphicsElement | null
  const box = measured?.getBBox ? measured.getBBox() : { x: 0, y: 0, width: 0, height: 0 }
  // The words keep their place; the drawing takes the room left over. A node
  // that already carries text gets the artwork beside it, not on top of it.
  const words = measured ? Array.from(measured.querySelectorAll('text')) : []
  const textLeft = words.reduce((left, word) => {
    const at = (word as SVGGraphicsElement).getBBox?.()
    return at && at.width ? Math.min(left, at.x) : left
  }, Number.POSITIVE_INFINITY)
  const room =
    Number.isFinite(textLeft) && textLeft > box.x + 24
      ? { x: box.x + 8, y: box.y + 8, width: Math.max(24, textLeft - box.x - 16), height: Math.max(24, box.height - 16) }
      : { x: box.x, y: box.y, width: box.width, height: box.height }
  measuring.remove()
  if (!room.width || !room.height) return svg
  // A drawn object is the subject of its node, not a badge in the corner. A
  // column too narrow for it would put a smudge on the page and call it
  // artwork: better to keep the wireframe and say so.
  const wanted = Math.min(room.width / artwork.viewBox.width, room.height / artwork.viewBox.height) * artwork.viewBox.width
  if (room.width < MIN_OBJECT_COLUMN || wanted < MIN_OBJECT_COLUMN) {
    throw new AppearanceTooSmall(
      `${unitId} reserves ${Math.round(room.width)} px for its drawing; a drawn object needs about ${MIN_OBJECT_COLUMN} — widen the node or start its words further right`,
    )
  }
  const drawing = new DOMParser().parseFromString(artwork.svg, 'image/svg+xml').documentElement
  if (drawing.tagName.toLowerCase() !== 'svg') return svg
  const group = parsed.createElementNS('http://www.w3.org/2000/svg', 'g')
  group.setAttribute('data-appearance-for', unitId)
  if (artwork.key) group.setAttribute('data-appearance-key', artwork.key)
  // Fitted into the thing's own box, keeping the drawing's proportions.
  const scale = Math.min(room.width / artwork.viewBox.width, room.height / artwork.viewBox.height)
  const width = artwork.viewBox.width * scale
  const height = artwork.viewBox.height * scale
  group.setAttribute(
    'transform',
    `translate(${(room.x + (room.width - width) / 2).toFixed(2)} ${(room.y + (room.height - height) / 2).toFixed(2)}) scale(${scale.toFixed(4)})`,
  )
  // The wireframe's own picture of this thing steps aside: one drawing per
  // thing, and the richer one wins.
  Array.from(host.querySelectorAll(`[data-appearance-for="${unitId}"]`)).forEach(previous => {
    previous.setAttribute('data-appearance-replaced', '1')
    previous.setAttribute('style', 'display:none')
  })
  Array.from(drawing.childNodes).forEach(node => group.appendChild(parsed.importNode(node, true)))
  // Name the pieces the scene will move, by the brief's own names.
  artwork.parts.forEach(part => {
    const piece = group.querySelector(`#${CSS.escape(part.id)}`)
    if (!piece) return
    // The scene's own name for it, whatever the drawing happened to call it.
    piece.setAttribute('data-part', part.as || part.id.split('-').slice(-1)[0])
    // And which way it fills, so a container's contents drop as it empties
    // rather than sliding off to one side.
    if (part.fills) piece.setAttribute('data-fills', part.fills)
  })
  host.appendChild(group)
  return new XMLSerializer().serializeToString(root)
}

// ——— The contract, scored: what a page declared and what had to be inferred ———
export type ContractReport = {
  groups: number
  namedGroups: number
  roles: number
  connectors: number
  declaredEndpoints: number
  verbs: number
  pageRole: boolean
  // 0..1: the share of facts the page stated rather than the atomiser guessed
  declared: number
}

export const contractReport = (units: SlideUnit[], pageRole: string): ContractReport => {
  const all = flattenUnits(units)
  const groups = all.filter(unit => unit.kind === 'group')
  const namedGroups = groups.filter(unit => !/^u\d+$/.test(unit.id))
  const roles = all.filter(unit => unit.role).length
  const connectors = all.filter(unit => unit.kind === 'connector' && !unit.chrome)
  const declaredEndpoints = connectors.filter(unit => unit.declared?.from && unit.declared?.to).length
  const verbs = connectors.filter(unit => unit.verb).length
  // A page with no groups left nothing to infer about groups.
  const facts = [groups.length ? namedGroups.length / groups.length : 1, connectors.length ? declaredEndpoints / connectors.length : 1, connectors.length ? verbs / connectors.length : 1, pageRole ? 1 : 0]
  return { groups: groups.length, namedGroups: namedGroups.length, roles, connectors: connectors.length, declaredEndpoints, verbs, pageRole: Boolean(pageRole), declared: Math.round((facts.reduce((a, b) => a + b, 0) / facts.length) * 100) / 100 }
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
