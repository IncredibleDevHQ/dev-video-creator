// The page model: the third grouping. After the atomiser's rows, this pass
// says what the rows depict — which groups are process diagrams and of what
// kind, what verb each relation carries, and which entities have states.
// Declared facts win; rules run over the rows; the caption on the same
// panel supplies a verb when nothing declared one.
import { flattenUnits, inferEdges, leafUnits, type SlideEdge, type SlideUnit } from './slide-atoms'

export const DIAGRAM_KINDS = ['chain', 'pipeline', 'tree', 'network', 'cluster'] as const
export type DiagramKind = (typeof DIAGRAM_KINDS)[number]

export const RELATION_VERBS = ['sends to', 'waits for', 'calls', 'reads', 'writes', 'returns', 'splits into', 'merges into', 'depends on', 'becomes', 'contains', 'compares with', 'feeds', 'triggers', 'passes to'] as const
export type RelationVerb = (typeof RELATION_VERBS)[number]

export const ENTITY_TYPES: Record<string, { match: RegExp; states: string[] }> = {
  server: { match: /\b(server|host|instance|machine|pod|container|fleet|worker)\b/i, states: ['idle', 'running', 'loaded', 'failing'] },
  database: { match: /\b(database|db|store|storage|table|index|postgres|bucket)\b/i, states: ['idle', 'reading', 'writing', 'full'] },
  cache: { match: /\b(cache|redis|memcache|in-memory)\b/i, states: ['idle', 'reading', 'writing', 'full'] },
  queue: { match: /\b(queue|topic|stream|buffer|backlog|channel|pipe)\b/i, states: ['empty', 'flowing', 'backed up'] },
  client: { match: /\b(client|user|browser|app|caller|customer|device)\b/i, states: ['waiting', 'sending', 'served'] },
  service: { match: /\b(service|api|endpoint|handler|controller|limiter|shedder|filter|middleware|proxy|gateway)\b/i, states: ['idle', 'busy', 'rejecting'] },
}

export type PageDiagram = { id: string; kind: DiagramKind; parts: string[]; hops: Array<{ connector: string; from: string; to: string; verb: RelationVerb }>; bbox: SlideUnit['bbox'] }
export type PageEntity = { id: string; label: string; type: string; states: string[] }
export type PageModel = {
  diagrams: PageDiagram[]
  verbs: Record<string, RelationVerb>
  entities: PageEntity[]
  // how the verbs were found, for the badge and the checker
  verbSources: { declared: number; label: number; caption: number; defaulted: number }
}

const VERB_PHRASES: Array<[RegExp, RelationVerb]> = [
  [/\bwaits? (for|on)\b|\bone (word|step) at a time\b|\bsequential/i, 'waits for'],
  [/\bsplits? into\b|\bfan(s|ned)? out\b|\bbroadcast/i, 'splits into'],
  [/\bmerges? into\b|\bconcat|\bcombines?\b|\bjoins?\b|\bfan(s|ned)? in\b/i, 'merges into'],
  [/\bcompares?\b|\bversus\b|\bvs\.?\b/i, 'compares with'],
  [/\breturns?\b|\bresponds?\b|\breplies\b/i, 'returns'],
  [/\breads?\b|\blooks? up\b|\bfetch(es)?\b/i, 'reads'],
  [/\bwrites?\b|\bstores?\b|\bsaves?\b/i, 'writes'],
  [/\bcalls?\b|\binvokes?\b|\brequests?\b/i, 'calls'],
  [/\btriggers?\b|\bfires?\b|\bemits?\b/i, 'triggers'],
  [/\bdepends? on\b|\brequires?\b/i, 'depends on'],
  [/\bfeeds?\b|\bflows? (in)?to\b|\bsends? (to)?\b|\bpasses? (to)?\b/i, 'sends to'],
]
const OPERATION_LABELS: Array<[RegExp, RelationVerb]> = [
  [/softmax|normali[sz]e|scale|divide/i, 'becomes'],
  [/concat|merge|sum|add/i, 'merges into'],
  [/split|head|branch/i, 'splits into'],
  [/compare|diff|contrast/i, 'compares with'],
]

const verbFromText = (text: string): RelationVerb | null => {
  for (const [pattern, verb] of VERB_PHRASES) if (pattern.test(text)) return verb
  return null
}

export const pageModelFor = (units: SlideUnit[]): PageModel => {
  const all = flattenUnits(units)
  const edges = inferEdges(units).filter((edge): edge is SlideEdge & { source: SlideUnit; target: SlideUnit } => Boolean(edge.source && edge.target))
  const verbs: Record<string, RelationVerb> = {}
  const verbSources = { declared: 0, label: 0, caption: 0, defaulted: 0 }
  // the caption on the same panel: the nearest ancestor group's labels
  const parentOf = new Map<string, SlideUnit>()
  const walk = (list: SlideUnit[], parent: SlideUnit | null) => list.forEach(unit => { if (parent) parentOf.set(unit.id, parent); if (unit.kind === 'group') walk(unit.children, unit) })
  walk(units, null)
  const captionOf = (unit: SlideUnit) => {
    let parent = parentOf.get(unit.id)
    while (parent) {
      const captions = leafUnits([parent]).filter(child => child.kind === 'label' && !child.chrome).map(child => child.label).join(' · ')
      if (captions) return captions
      parent = parentOf.get(parent.id)
    }
    return ''
  }
  edges.forEach(edge => {
    const connector = edge.connector
    if (connector.verb && (RELATION_VERBS as readonly string[]).includes(connector.verb)) { verbs[connector.id] = connector.verb as RelationVerb; verbSources.declared += 1; return }
    const operation = OPERATION_LABELS.find(([pattern]) => pattern.test(edge.target.label) || pattern.test(edge.source.label))
    if (operation) { verbs[connector.id] = operation[1]; verbSources.label += 1; return }
    const fromCaption = verbFromText(captionOf(connector) || captionOf(edge.source))
    if (fromCaption) { verbs[connector.id] = fromCaption; verbSources.caption += 1; return }
    verbs[connector.id] = 'passes to'
    verbSources.defaulted += 1
  })
  // A verb found by rule is stamped on the connector, so the planner and the
  // writer read one thing (the connector) whether the page declared it or
  // the model worked it out. The default is not stamped: no verb is a fact.
  edges.forEach(edge => {
    if (!edge.connector.verb && verbs[edge.connector.id] && verbs[edge.connector.id] !== 'passes to') edge.connector.verb = verbs[edge.connector.id]
  })

  // diagrams: a group whose parts are joined by edges, classified by the shape of the graph
  const diagrams: PageDiagram[] = []
  const groups = all.filter(unit => unit.kind === 'group' && !unit.chrome)
  const candidates = groups.length ? groups : [{ id: 'page', kind: 'group', label: 'Page', ids: [], bbox: { x: 0, y: 0, width: 0, height: 0 }, chrome: false, children: units } as SlideUnit]
  candidates.forEach(group => {
    const members = leafUnits([group]).filter(unit => (unit.kind === 'box' || unit.kind === 'shape') && !unit.chrome)
    if (members.length < 2) return
    const memberIds = new Set(members.map(unit => unit.id))
    const inner = edges.filter(edge => memberIds.has(edge.source.id) && memberIds.has(edge.target.id))
    if (!inner.length) return
    const indeg = new Map<string, number>()
    const outdeg = new Map<string, number>()
    inner.forEach(edge => { outdeg.set(edge.source.id, (outdeg.get(edge.source.id) || 0) + 1); indeg.set(edge.target.id, (indeg.get(edge.target.id) || 0) + 1) })
    const linear = members.every(unit => (indeg.get(unit.id) || 0) <= 1 && (outdeg.get(unit.id) || 0) <= 1)
    const numbered = members.filter(unit => /^\s*(\d+|[a-z]|n|[ivx]+)\s*$/i.test(unit.label)).length >= Math.max(3, members.length * 0.6)
    const branching = members.some(unit => (indeg.get(unit.id) || 0) >= 2 || (outdeg.get(unit.id) || 0) >= 2)
    let kind: DiagramKind = 'cluster'
    if (inner.length >= members.length * 1.5 && members.length >= 6) kind = 'network'
    else if (linear && (numbered || inner.length >= 2)) kind = 'chain'
    else if (branching) kind = 'tree'
    else if (inner.length >= 2) kind = 'pipeline'
    // parts in flow order: sources first, then by edge order, then reading order
    const ordered: string[] = []
    const visit = (id: string) => { if (ordered.includes(id)) return; ordered.push(id); inner.filter(edge => edge.source.id === id).forEach(edge => visit(edge.target.id)) }
    members.filter(unit => !(indeg.get(unit.id) || 0)).forEach(unit => visit(unit.id))
    members.forEach(unit => visit(unit.id))
    diagrams.push({
      id: group.id,
      kind,
      parts: ordered,
      hops: inner.map(edge => ({ connector: edge.connector.id, from: edge.source.id, to: edge.target.id, verb: verbs[edge.connector.id] || 'passes to' })),
      bbox: group.bbox,
    })
  })

  // A panel and the group inside it describe the same diagram: keep the
  // tighter one (the same hops, the smaller box).
  const signature = (diagram: PageDiagram) => diagram.hops.map(hop => hop.connector).sort().join(',')
  const tightest = new Map<string, PageDiagram>()
  diagrams.forEach(diagram => {
    const key = signature(diagram)
    const other = tightest.get(key)
    const area = diagram.bbox.width * diagram.bbox.height
    if (!other || area < other.bbox.width * other.bbox.height) tightest.set(key, diagram)
  })
  const unique = diagrams.filter(diagram => tightest.get(signature(diagram)) === diagram)
  diagrams.length = 0
  diagrams.push(...unique)

  const entities: PageEntity[] = leafUnits(units)
    .filter(unit => (unit.kind === 'box' || unit.kind === 'shape') && !unit.chrome)
    .map(unit => {
      // A page that declares what a thing is beats a guess from its words.
      const declared = unit.entityType && ENTITY_TYPES[unit.entityType] ? unit.entityType : ''
      if (declared) return { id: unit.id, label: unit.label, type: declared, states: ENTITY_TYPES[declared].states }
      const found = Object.entries(ENTITY_TYPES).find(([, def]) => def.match.test(unit.label))
      return found ? { id: unit.id, label: unit.label, type: found[0], states: found[1].states } : null
    })
    .filter((entity): entity is PageEntity => Boolean(entity))

  return { diagrams, verbs, entities, verbSources }
}

export const describePageModel = (model: PageModel) => {
  const parts: string[] = []
  model.diagrams.slice(0, 2).forEach(diagram => {
    const verbSet = [...new Set(diagram.hops.map(hop => hop.verb))]
    parts.push(`${diagram.kind} of ${diagram.parts.length}${verbSet.length ? ` · ${verbSet.slice(0, 2).join(', ')}` : ''}`)
  })
  if (model.entities.length) parts.push(`${model.entities.length} typed ${model.entities.length === 1 ? 'entity' : 'entities'}`)
  return parts.join(' · ')
}
