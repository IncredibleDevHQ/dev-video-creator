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
  // Layered-DAG placement: entities sit on dependency levels (0 = roots);
  // siblings share a level, ordered left to right, and feed the next level.
  level?: number
  order?: number
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
      level: Number.isFinite(Number(raw?.level))
        ? Math.max(0, Math.min(8, Math.round(Number(raw?.level))))
        : undefined,
      order: Number.isFinite(Number(raw?.order))
        ? Math.round(Number(raw?.order))
        : undefined,
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
  // ——— Layered-DAG layout ———
  // Explicit levels from the plan win; otherwise levels derive from arrow
  // topology (longest path from the roots). Siblings share a level, sorted
  // by their order, and the layout spreads levels top-to-bottom so sibling
  // rows feed the level below them.
  const levelById = new Map<string, number>()
  if (entities.some(entity => Number.isFinite(entity.level))) {
    entities.forEach(entity => levelById.set(entity.id, entity.level ?? 0))
  } else {
    const incoming = new Map<string, string[]>(
      entities.map(entity => [entity.id, []]),
    )
    connectors.forEach(connector => {
      if (connector.style === 'arrow') {
        incoming.get(connector.to)?.push(connector.from)
      }
    })
    const resolveLevel = (id: string, trail: Set<string>): number => {
      const known = levelById.get(id)
      if (known !== undefined) return known
      if (trail.has(id)) return 0
      trail.add(id)
      const parents = incoming.get(id) || []
      const level = parents.length
        ? 1 + Math.max(...parents.map(parent => resolveLevel(parent, trail)))
        : 0
      levelById.set(id, level)
      return level
    }
    entities.forEach(entity => resolveLevel(entity.id, new Set()))
  }
  const tiers = new Map<number, ExplainerEntityV1[]>()
  entities.forEach(entity => {
    const level = levelById.get(entity.id) ?? 0
    entity.level = level
    const tier = tiers.get(level) || []
    tier.push(entity)
    tiers.set(level, tier)
  })
  const maxLevel = Math.max(0, ...tiers.keys())
  tiers.forEach((tier, level) => {
    tier.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    tier.forEach((entity, index) => {
      entity.order = index
      entity.x =
        tier.length === 1 ? 50 : 10 + (80 * index) / (tier.length - 1)
      entity.y = maxLevel === 0 ? 50 : 13 + (72 * level) / maxLevel
    })
  })

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
  // Anything never revealed still needs a home. Entities join the earliest
  // step that reveals a same-level sibling (falling back to the last step);
  // connectors join the first step where both endpoints are visible — a
  // connector appearing before its endpoints reads as a floating line.
  const stepOfItem = new Map<string, number>()
  steps.forEach((step, index) =>
    step.reveals.forEach(id => stepOfItem.set(id, index)),
  )
  for (const entity of entities) {
    if (stepOfItem.has(entity.id)) continue
    const siblingStep = steps.findIndex(step =>
      step.reveals.some(id => {
        const sibling = entities.find(item => item.id === id)
        return sibling && sibling.level === entity.level
      }),
    )
    const target = siblingStep >= 0 ? siblingStep : steps.length - 1
    steps[target].reveals.push(entity.id)
    stepOfItem.set(entity.id, target)
  }
  for (const connector of connectors) {
    const endpointStep = Math.max(
      stepOfItem.get(connector.from) ?? 0,
      stepOfItem.get(connector.to) ?? 0,
    )
    const current = stepOfItem.get(connector.id)
    if (current === undefined || current < endpointStep) {
      if (current !== undefined) {
        steps[current].reveals = steps[current].reveals.filter(
          id => id !== connector.id,
        )
      }
      steps[endpointStep].reveals.push(connector.id)
      stepOfItem.set(connector.id, endpointStep)
    }
  }
  return { entities, connectors, steps }
}

export const EXPLAINER_STEP_SECONDS = 4

// A step lasts as long as its narration needs (~145 spoken words a minute,
// plus a beat for the reveal), so long explanations aren't cut off and
// short ones don't drag.
export const explainerStepSeconds = (step: ExplainerStepV1) => {
  const words = step.explanation.split(/\s+/).filter(Boolean).length
  return Math.min(9, Math.max(3, 1.2 + words / 2.4))
}

export const explainerStepOffsets = (plan: ExplainerPlanV1) => {
  const offsets: number[] = []
  let at = 0
  for (const step of plan.steps) {
    offsets.push(at)
    at += explainerStepSeconds(step)
  }
  return offsets
}

export const explainerDurationSeconds = (plan: ExplainerPlanV1) =>
  Math.max(
    5,
    plan.steps.reduce((total, step) => total + explainerStepSeconds(step), 0),
  )

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
  const levelOf = new Map(
    plan.entities.map(entity => [entity.id, entity.level ?? 0]),
  )
  // Stagger sibling arcs on the same tier so they never trace each other.
  const arcIndexByLevel = new Map<number, number>()
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
      // Sibling dependency (same level): an execution-order arc above the
      // row, visually distinct from the straight level-to-level flow.
      const siblings =
        levelOf.get(connector.from) === levelOf.get(connector.to)
      const tier = levelOf.get(connector.from) ?? 0
      const arcIndex = siblings ? arcIndexByLevel.get(tier) || 0 : 0
      if (siblings) arcIndexByLevel.set(tier, arcIndex + 1)
      const arcLift =
        Math.min(120, Math.max(64, distance * 0.22)) + arcIndex * 38
      const stroke = `stroke="var(--ex-stroke)" stroke-width="4" stroke-linecap="round" fill="none"${dash}${marker}`
      const geometry = siblings
        ? `<path d="M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${((startX + endX) / 2).toFixed(1)} ${(Math.min(startY, endY) - arcLift).toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}" ${stroke}/>`
        : `<line x1="${startX.toFixed(1)}" y1="${startY.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" ${stroke}/>`
      const labelY = siblings
        ? Math.min(startY, endY) - arcLift / 2 - 16
        : (startY + endY) / 2 - 14
      const label = connector.label
        ? `<text class="ex-connector-label" x="${((startX + endX) / 2).toFixed(1)}" y="${labelY.toFixed(1)}">${escape(connector.label)}</text>`
        : ''
      return `<g class="ex-item ex-connector" data-ex-item="${connector.id}" data-ex-step-reveal="${reveal.get(connector.id) ?? 0}">${geometry}${label}</g>`
    })
    .join('')
  // Labels wrap onto up to two lines so long names never smear across
  // neighbouring shapes.
  const wrapLabel = (label: string): string[] => {
    const words = label.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      if (current && (current + ' ' + word).length > 16) {
        lines.push(current)
        current = word
      } else {
        current = current ? `${current} ${word}` : word
      }
    }
    if (current) lines.push(current)
    if (lines.length > 2) {
      lines.length = 2
      lines[1] = `${lines[1].slice(0, 14)}…`
    }
    return lines.length ? lines : [label.slice(0, 16)]
  }
  const entityMarkup = plan.entities
    .map(entity => {
      const center = centers.get(entity.id)
      if (!center) return ''
      const shape = shapeByKey.get(entity.shape) || shapes[0]
      const lines = wrapLabel(entity.label)
      const labelText = lines
        .map(
          (line, index) =>
            `<tspan x="0" dy="${index === 0 ? 0 : 32}">${escape(line)}</tspan>`,
        )
        .join('')
      return `<g class="ex-item ex-entity" data-ex-item="${entity.id}" data-ex-step-reveal="${reveal.get(entity.id) ?? 0}" transform="translate(${center.x.toFixed(1)}, ${center.y.toFixed(1)})">${shape?.svg || ''}<text class="ex-entity-label" y="86">${labelText}</text></g>`
    })
    .join('')
  return `<svg class="explainer-diagram" viewBox="0 0 ${EXPLAINER_VIEW_WIDTH} ${EXPLAINER_VIEW_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Explainer diagram"><defs><marker id="ex-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11 z" fill="var(--ex-stroke)"/></marker></defs>${connectorMarkup}${entityMarkup}</svg>`
}
