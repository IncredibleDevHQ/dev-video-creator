// Hidden-window atomizer bundle (IIFE → globalThis.StudioAtomize). Reuses the
// studio's own slide atomizer so geometry matches what the editor sees, and
// adds measure/fold helpers for the MCP tools. Everything here runs in the
// hidden window's page context; functions take and return JSON values only.
import {
  atomizeSlideSvg,
  flattenUnits,
  inferEdges,
  leafUnits,
  readingOrder,
  type SlideUnit,
} from '../../../studio-v2/src/slide-atoms'

type Rect = { x: number; y: number; w: number; h: number }

const toRect = (box: { x: number; y: number; width: number; height: number }): Rect => ({
  x: box.x,
  y: box.y,
  w: box.width,
  h: box.height,
})

const mount = (markup: string) => {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const root = parsed.documentElement
  const host = document.createElement('div')
  host.style.cssText =
    'position:absolute;left:0;top:0;width:1600px;height:900px;overflow:hidden;'
  const live = document.importNode(root, true) as unknown as SVGSVGElement
  if (!live.getAttribute('width')) live.setAttribute('width', '1600')
  host.append(live)
  document.body.append(host)
  return { host, live }
}

const unitRole = (unit: SlideUnit) => (unit.chrome ? 'chrome' : undefined)

const flattenForGeometry = (units: SlideUnit[]) =>
  flattenUnits(units).map(unit => ({
    id: unit.id,
    kind: unit.kind,
    label: unit.label,
    role: unitRole(unit),
    bbox: toRect(unit.bbox),
    ids: unit.ids,
    children: unit.kind === 'group' ? unit.children.map(child => child.id) : [],
    ...(unit.from ? { from: unit.from } : {}),
    ...(unit.to ? { to: unit.to } : {}),
  }))

const atomize = (markup: string) => {
  const result = atomizeSlideSvg(markup)
  const leaves = leafUnits(result.units)
  const edges = inferEdges(result.units).map(edge => ({
    connector: edge.connector.id,
    from: edge.source?.id || null,
    to: edge.target?.id || null,
    directed: true,
  }))
  // Reading rows from the reading order with a row tolerance (same rule the
  // studio uses), then readingMode: a connector-resolved flow is a chain.
  const ordered = readingOrder(leaves)
  const rows: string[][] = []
  let lastRowY = Number.NaN
  for (const unit of ordered) {
    if (!rows.length || Math.abs(unit.bbox.y - lastRowY) > 24) {
      rows.push([unit.id])
      lastRowY = unit.bbox.y
    } else {
      rows[rows.length - 1].push(unit.id)
    }
  }
  const resolvedEdges = edges.filter(
    edge => edge.from && edge.to && edge.from !== edge.to,
  )
  const readingMode = resolvedEdges.length >= 2 ? 'chain' : 'ltr-ttb'
  const contains: Record<string, string[]> = {}
  flattenUnits(result.units).forEach(unit => {
    if (unit.kind === 'group') contains[unit.id] = unit.children.map(child => child.id)
  })
  return {
    svg: result.svg,
    viewBox: { x: 0, y: 0, w: result.viewBox.width, h: result.viewBox.height },
    readingMode,
    units: flattenForGeometry(result.units),
    edges,
    contains,
    rows,
  }
}

// Root-space bbox (via getBoundingClientRect, normalized to viewBox units),
// member CTM and smallest text size per element — measured after fonts.ready.
const measure = async (markup: string) => {
  const { host, live } = mount(markup)
  await document.fonts.ready
  const viewBoxAttr = live.getAttribute('viewBox')?.split(/[\s,]+/).map(Number) || []
  const vw = viewBoxAttr[2] > 0 ? viewBoxAttr[2] : 1280
  const rootRect = live.getBoundingClientRect()
  const scale = rootRect.width > 0 ? vw / rootRect.width : 1
  const members: Record<
    string,
    { bbox: Rect; ctm: number[] | null; fontPx?: number }
  > = {}
  live.querySelectorAll('[id]').forEach(element => {
    const rect = element.getBoundingClientRect()
    const graphics = element as SVGGraphicsElement
    const ctm =
      typeof graphics.getCTM === 'function' ? graphics.getCTM() : null
    const entry: { bbox: Rect; ctm: number[] | null; fontPx?: number } = {
      bbox: {
        x: (rect.x - rootRect.x) * scale,
        y: (rect.y - rootRect.y) * scale,
        w: rect.width * scale,
        h: rect.height * scale,
      },
      ctm: ctm ? [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f] : null,
    }
    if (element.tagName.toLowerCase() === 'text') {
      entry.fontPx = parseFloat(getComputedStyle(element).fontSize) * scale
    }
    members[element.id] = entry
  })
  host.remove()
  return { measured: { fontsReady: true, at: 'driver' }, members }
}

// Applies the resolved fold for a review frame: hidden element ids are
// removed from paint, dimmed ones get an explicit opacity, the rest settles.
const renderFold = (markup: string, hidden: string[], dimmed: Record<string, number>) => {
  const { live } = mount(markup)
  hidden.forEach(id => {
    const element = live.querySelector(`#${CSS.escape(id)}`)
    if (element) element.setAttribute('display', 'none')
  })
  Object.entries(dimmed).forEach(([id, opacity]) => {
    const element = live.querySelector(`#${CSS.escape(id)}`)
    if (element) element.setAttribute('opacity', String(opacity))
  })
  return true
}

const api = { atomize, measure, renderFold }
;(globalThis as unknown as { StudioAtomize: typeof api }).StudioAtomize = api
