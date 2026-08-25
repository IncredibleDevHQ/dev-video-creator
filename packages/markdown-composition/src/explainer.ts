// The explainer block: an AI-planned diagram of entities, connectors and
// steps, rendered as SVG primitives and revealed step by step on the video
// timeline. This module is shared by the compiler (export-real rendering)
// and the studio wizard (live preview), so both draw pixel-identical
// diagrams from the same plan.

export type ExplainerConnectorStyle = 'line' | 'arrow' | 'dashed'

export type ExplainerEntityV1 = {
  id: string
  label: string
  shape: string
  x: number
  y: number
}

export type ExplainerConnectorV1 = {
  id: string
  from: string
  to: string
  style: ExplainerConnectorStyle
  label?: string
}

export type ExplainerStepV1 = {
  title: string
  explanation: string
  reveals: string[]
}

export type ExplainerPlanV1 = {
  entities: ExplainerEntityV1[]
  connectors: ExplainerConnectorV1[]
  steps: ExplainerStepV1[]
}

export type ShapeDefV1 = {
  key: string
  label: string
  // Inner SVG markup for a 160×110 box centred on the origin (x −80..80,
  // y −55..55). Fill and stroke read the --ex-fill / --ex-stroke variables.
  svg: string
  builtin?: boolean
}

const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

// The atomic shape vocabulary. Projects can extend or override it via
// project.shapeCollection; these ship with every project.
export const BUILTIN_SHAPES: ShapeDefV1[] = [
  { key: 'box', label: 'Box', builtin: true, svg: '<rect x="-80" y="-55" width="160" height="110" rx="6" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'rounded', label: 'Rounded box', builtin: true, svg: '<rect x="-80" y="-55" width="160" height="110" rx="26" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'pill', label: 'Pill', builtin: true, svg: '<rect x="-80" y="-42" width="160" height="84" rx="42" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'circle', label: 'Circle', builtin: true, svg: '<circle r="54" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'ellipse', label: 'Ellipse', builtin: true, svg: '<ellipse rx="80" ry="48" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'diamond', label: 'Diamond', builtin: true, svg: '<polygon points="0,-58 84,0 0,58 -84,0" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'hexagon', label: 'Hexagon', builtin: true, svg: '<polygon points="-46,-52 46,-52 84,0 46,52 -46,52 -84,0" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'cylinder', label: 'Cylinder', builtin: true, svg: '<path d="M -62 -38 v 76 a 62 20 0 0 0 124 0 v -76" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/><ellipse cy="-38" rx="62" ry="20" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'cloud', label: 'Cloud', builtin: true, svg: '<path d="M -52 34 a 26 26 0 0 1 -6 -51 a 34 34 0 0 1 64 -14 a 28 28 0 0 1 46 22 a 24 24 0 0 1 -8 43 z" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>' },
  { key: 'note', label: 'Note', builtin: true, svg: '<path d="M -70 -55 h 112 l 28 28 v 82 h -140 z" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/><path d="M 42 -55 v 28 h 28" fill="none" stroke="var(--ex-stroke)" stroke-width="3"/>' },
]

export const mergedShapeCollection = (
  custom: ShapeDefV1[] | undefined,
): ShapeDefV1[] => {
  const merged = new Map<string, ShapeDefV1>()
  for (const shape of BUILTIN_SHAPES) merged.set(shape.key, shape)
  for (const shape of custom || []) {
    if (shape?.key && typeof shape.svg === 'string') {
      merged.set(shape.key, { ...shape, builtin: false })
    }
  }
  return Array.from(merged.values())
}

const cleanId = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const clampPercent = (value: unknown, fallback: number) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(94, Math.max(6, numeric))
}

// Model output is untrusted: sanitize ids, clamp geometry, drop dangling
// references, and make sure every item is revealed by some step.
export const sanitizeExplainerPlan = (
  plan: Partial<ExplainerPlanV1> | null | undefined,
  shapes: ShapeDefV1[],
): ExplainerPlanV1 => {
  const shapeKeys = new Set(shapes.map(shape => shape.key))
  const fallbackShape = shapes[0]?.key || 'box'
  const entities: ExplainerEntityV1[] = []
  const seen = new Set<string>()
  for (const raw of (plan?.entities || []).slice(0, 10)) {
    const id = cleanId(raw?.id) || `entity-${entities.length + 1}`
    if (seen.has(id)) continue
    seen.add(id)
    entities.push({
      id,
      label: String(raw?.label || id).slice(0, 60),
      shape: shapeKeys.has(String(raw?.shape)) ? String(raw?.shape) : fallbackShape,
      x: clampPercent(raw?.x, 12 + (entities.length % 4) * 25),
      y: clampPercent(raw?.y, 22 + Math.floor(entities.length / 4) * 32),
    })
  }
  const entityIds = new Set(entities.map(entity => entity.id))
  const connectors: ExplainerConnectorV1[] = []
  for (const raw of (plan?.connectors || []).slice(0, 14)) {
    const from = cleanId(raw?.from)
    const to = cleanId(raw?.to)
    if (!entityIds.has(from) || !entityIds.has(to) || from === to) continue
    const id = cleanId(raw?.id) || `link-${connectors.length + 1}`
    if (seen.has(id)) continue
    seen.add(id)
    connectors.push({
      id,
      from,
      to,
      style: (['line', 'arrow', 'dashed'] as const).includes(
        raw?.style as ExplainerConnectorStyle,
      )
        ? (raw?.style as ExplainerConnectorStyle)
        : 'arrow',
      label: raw?.label ? String(raw.label).slice(0, 40) : undefined,
    })
  }
  const itemIds = new Set([...entityIds, ...connectors.map(c => c.id)])
  const steps: ExplainerStepV1[] = []
  const revealed = new Set<string>()
  for (const raw of (plan?.steps || []).slice(0, 8)) {
    const reveals = (Array.isArray(raw?.reveals) ? raw.reveals : [])
      .map(cleanId)
      .filter(id => itemIds.has(id) && !revealed.has(id))
    reveals.forEach(id => revealed.add(id))
    steps.push({
      title: String(raw?.title || `Step ${steps.length + 1}`).slice(0, 80),
      explanation: String(raw?.explanation || '').slice(0, 400),
      reveals,
    })
  }
  if (!steps.length) {
    steps.push({ title: 'Overview', explanation: '', reveals: [] })
  }
  // Anything never revealed appears with the first step.
  const missing = [...itemIds].filter(id => !revealed.has(id))
  steps[0].reveals = [...missing, ...steps[0].reveals]
  return { entities, connectors, steps }
}

export const EXPLAINER_STEP_SECONDS = 4

export const explainerDurationSeconds = (plan: ExplainerPlanV1) =>
  Math.max(5, plan.steps.length * EXPLAINER_STEP_SECONDS)

const revealStepFor = (plan: ExplainerPlanV1) => {
  const map = new Map<string, number>()
  plan.steps.forEach((step, index) => {
    step.reveals.forEach(id => {
      if (!map.has(id)) map.set(id, index)
    })
  })
  return map
}

export const EXPLAINER_VIEW_WIDTH = 1600
export const EXPLAINER_VIEW_HEIGHT = 860

// Draws the diagram exactly as the export renders it. Items carry
// data-ex-item (identity) and data-ex-step-reveal (which step shows them);
// the compiler tweens them on the composition timeline and the wizard
// toggles them per previewed step.
export const renderExplainerDiagram = (
  plan: ExplainerPlanV1,
  shapes: ShapeDefV1[],
): string => {
  const shapeByKey = new Map(shapes.map(shape => [shape.key, shape]))
  const reveal = revealStepFor(plan)
  const centers = new Map(
    plan.entities.map(entity => [
      entity.id,
      {
        x: (entity.x / 100) * EXPLAINER_VIEW_WIDTH,
        y: (entity.y / 100) * EXPLAINER_VIEW_HEIGHT,
      },
    ]),
  )
  const connectorMarkup = plan.connectors
    .map(connector => {
      const from = centers.get(connector.from)
      const to = centers.get(connector.to)
      if (!from || !to) return ''
      const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1
      const trim = Math.min(96, distance * 0.28)
      const unitX = (to.x - from.x) / distance
      const unitY = (to.y - from.y) / distance
      const startX = from.x + unitX * trim
      const startY = from.y + unitY * trim
      const endX = to.x - unitX * trim
      const endY = to.y - unitY * trim
      const dash = connector.style === 'dashed' ? ' stroke-dasharray="14 12"' : ''
      const marker =
        connector.style === 'arrow' ? ' marker-end="url(#ex-arrow)"' : ''
      const label = connector.label
        ? `<text class="ex-connector-label" x="${(startX + endX) / 2}" y="${(startY + endY) / 2 - 14}">${escape(connector.label)}</text>`
        : ''
      return `<g class="ex-item ex-connector" data-ex-item="${connector.id}" data-ex-step-reveal="${reveal.get(connector.id) ?? 0}"><line x1="${startX.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="var(--ex-stroke)" stroke-width="4" stroke-linecap="round"${dash}${marker}/>${label}</g>`
    })
    .join('')
  const entityMarkup = plan.entities
    .map(entity => {
      const center = centers.get(entity.id)
      if (!center) return ''
      const shape = shapeByKey.get(entity.shape) || shapes[0]
      return `<g class="ex-item ex-entity" data-ex-item="${entity.id}" data-ex-step-reveal="${reveal.get(entity.id) ?? 0}" transform="translate(${center.x.toFixed(1)}, ${center.y.toFixed(1)})">${shape?.svg || ''}<text class="ex-entity-label" y="86">${escape(entity.label)}</text></g>`
    })
    .join('')
  return `<svg class="explainer-diagram" viewBox="0 0 ${EXPLAINER_VIEW_WIDTH} ${EXPLAINER_VIEW_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Explainer diagram"><defs><marker id="ex-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11 z" fill="var(--ex-stroke)"/></marker></defs>${connectorMarkup}${entityMarkup}</svg>`
}
