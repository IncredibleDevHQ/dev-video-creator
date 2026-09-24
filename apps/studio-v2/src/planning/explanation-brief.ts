// The Explanation Brief: the video counterpart of the outline that feeds
// presentation design.
//
// It reduces the retained source and the creator's narrative into what needs
// explaining — the question, the evidence, the entities and how the idea
// develops — and says plainly what is still open. It is not a shot plan:
// scene boundaries, camera moves, recipes, coordinates and exact seconds are
// decided later by the creative skills, so a brief that carries them as
// structure is refused. A creator's explicit request for one of those stays
// binding, written as a creator requirement in prose.
//
// Three kinds of statement are kept apart everywhere: what the source says,
// what the creator decided, and what the planner merely suggests. A citation
// is an exact passage of the retained source, checked here, so a brief cannot
// quote an article it did not read.
import { comparableText, quotedIn } from './fingerprint'

export const BRIEF_SCHEMA_VERSION = 1 as const

// Who a statement comes from. A suggestion is revisable; it is never
// promoted to a creator mandate by being written down.
export const STATEMENT_BASES = ['source', 'creator', 'suggestion'] as const
export type StatementBasis = (typeof STATEMENT_BASES)[number]

// The owning production workflows a technical explanation may route to. The
// route follows the requested deliverable, never a slide's kind or the mere
// presence of a URL.
export const BRIEF_WORKFLOWS = ['general-video', 'faceless-explainer', 'motion-graphics', 'talking-head-recut'] as const
export type BriefWorkflow = (typeof BRIEF_WORKFLOWS)[number]

export type BriefEvidence = {
  id: string
  // A passage of the retained source, or something the creator said
  // (their narration, notes or direction). Kept apart on purpose.
  kind: 'source' | 'creator'
  text: string
  // Where it is, when that helps a person find it: a heading or paragraph.
  locator?: string
}

export type BriefEntity = {
  id: string
  name: string
  // Its technical role in ordinary language — never a presentation part kind.
  role: string
  interactions: string[]
  evidenceRefs: string[]
  // Identities it reconciles with in the existing explanation model.
  legacyObjectIds: string[]
}

export type BriefCondition = { text: string; basis: StatementBasis | 'illustrative' }

export type BriefUnit = {
  id: string
  question: string
  explain: string
  evidenceRefs: string[]
  entities: string[]
  conditions: BriefCondition[]
  // Only a demonstration the source or the creator already gave; a proposed
  // one belongs to the creative plan, not the brief.
  demonstration: { text: string; basis: 'source' | 'creator' } | null
  // Only what the creator requires the viewer to notice.
  observations: string[]
  communicationNeeds: Array<{ need: string; why: string; basis: StatementBasis }>
  preserve: string[]
  // Lineage to the base's presentation pages — a link, not a scene boundary.
  originScenes: string[]
  // Causal dependencies on other units, distinct from editorial order.
  dependsOn: string[]
}

export type ExplanationBriefV1 = {
  schemaVersion: typeof BRIEF_SCHEMA_VERSION
  purpose: {
    deliverable: string
    audience: string
    message: string
    language: string
    // The creator's chosen total length, not a sum of page estimates.
    requestedSeconds: number | null
    styleConstraints: string[]
  }
  source: {
    revisionRef: string
    narrativeRef: string | null
    wordingPolicy: 'preserve' | 'assist' | 'draft'
    coverage: 'full' | 'fragments'
    limitations: string[]
  }
  evidence: BriefEvidence[]
  entities: BriefEntity[]
  units: BriefUnit[]
  progression: Array<{ unit: string; note: string; ordering: 'causal' | 'editorial' }>
  narrative: {
    approvedLines: Array<{ scene: string; text: string }>
    terminology: Array<{ term: string; meaning: string }>
    omissions: string[]
  }
  material: {
    themeRef: string | null
    baseNotebookRef: string
    baseRevision: string
    // Selected for this brief; empty means none selected, not none exist.
    assetRefs: string[]
    takeRefs: string[]
  }
  delivery: {
    // Only decisions the creator has already made, per scene.
    sceneDecisions: Array<{ scene: string; voice: 'human' | 'generated' | 'silent' }>
    unresolved: string
  }
  creativeGuidance: Array<{ text: string; basis: StatementBasis }>
  openDecisions: string[]
  uncertainty: Array<{ text: string; kind: 'unsupported-claim' | 'ambiguous-mechanism' | 'gap' }>
  route: { workflow: BriefWorkflow; reason: string }
  // Every inherited presentation page, mapped to the units that carry its
  // material or explicitly left out with a reason.
  coverage: Array<{ scene: string; units: string[]; omittedReason?: string }>
}

// What a brief is checked against: the pinned inputs of the fork it serves.
export type BriefContext = {
  baseSceneIds: string[]
  sourceRevision: string | null
  // The retained source's full text; empty when only fragments survive.
  sourceText: string
  // Everything the creator wrote: narration, scripts, notes, direction.
  creatorText: string
  wordingPolicy: 'preserve' | 'assist' | 'draft'
  // Approved lines, per base scene, when the wording is preserved.
  scripts: Array<{ scene: string; text: string }>
  baseNotebookRef: string
  baseRevision: string
  themeRef: string | null
  sceneDecisions: Array<{ scene: string; voice: 'human' | 'generated' | 'silent' }>
  // The creator's chosen total length, when the notebook has one.
  requestedSeconds?: number | null
}

export type BriefReport = { ok: boolean; problems: string[]; warnings: string[] }

// Fields that belong to presentation pages or to execution, not to a
// reduction of meaning. They are refused as structure wherever they appear.
const PRESENTATION_ONLY_KEYS = new Set(['kind', 'parts', 'seconds', 'durationMs', 'camera', 'recipe', 'recipes', 'blueprint', 'shot', 'shots', 'x', 'y', 'width', 'height', 'selector', 'layout'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const text = (value: unknown, limit = 4000) => (typeof value === 'string' ? value.trim().slice(0, limit) : '')
const texts = (value: unknown, limit = 600) =>
  (Array.isArray(value) ? value : []).map(entry => text(entry, limit)).filter(Boolean)
const ids = (value: unknown) => texts(value, 120)
const basisOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(String(value)) ? (value as T) : fallback

// Reads a harness-written brief into the typed shape, keeping what is there
// and never inventing what is not. Validation says what is wrong with it.
export const normalizeBrief = (raw: unknown): ExplanationBriefV1 => {
  const value = isRecord(raw) ? raw : {}
  const purpose = isRecord(value.purpose) ? value.purpose : {}
  const source = isRecord(value.source) ? value.source : {}
  const narrative = isRecord(value.narrative) ? value.narrative : {}
  const material = isRecord(value.material) ? value.material : {}
  const delivery = isRecord(value.delivery) ? value.delivery : {}
  const route = isRecord(value.route) ? value.route : {}
  const records = (list: unknown) => (Array.isArray(list) ? list.filter(isRecord) : [])
  const seconds = Number(purpose.requestedSeconds)
  return {
    schemaVersion: value.schemaVersion === BRIEF_SCHEMA_VERSION ? BRIEF_SCHEMA_VERSION : (value.schemaVersion as typeof BRIEF_SCHEMA_VERSION),
    purpose: {
      deliverable: text(purpose.deliverable, 200),
      audience: text(purpose.audience, 400),
      message: text(purpose.message, 600),
      language: text(purpose.language, 20) || 'en',
      requestedSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null,
      styleConstraints: texts(purpose.styleConstraints),
    },
    source: {
      revisionRef: text(source.revisionRef, 120),
      narrativeRef: text(source.narrativeRef, 120) || null,
      wordingPolicy: basisOf(source.wordingPolicy, ['preserve', 'assist', 'draft'] as const, 'draft'),
      coverage: basisOf(source.coverage, ['full', 'fragments'] as const, 'fragments'),
      limitations: texts(source.limitations),
    },
    evidence: records(value.evidence).map(entry => ({
      id: text(entry.id, 80),
      kind: basisOf(entry.kind, ['source', 'creator'] as const, 'source'),
      text: text(entry.text, 1600),
      ...(text(entry.locator, 200) ? { locator: text(entry.locator, 200) } : {}),
    })),
    entities: records(value.entities).map(entry => ({
      id: text(entry.id, 80),
      name: text(entry.name, 160),
      role: text(entry.role, 600),
      interactions: texts(entry.interactions),
      evidenceRefs: ids(entry.evidenceRefs),
      legacyObjectIds: ids(entry.legacyObjectIds),
    })),
    units: records(value.units).map(entry => {
      const demonstration = isRecord(entry.demonstration) ? entry.demonstration : null
      return {
        id: text(entry.id, 80),
        question: text(entry.question, 600),
        explain: text(entry.explain, 2000),
        evidenceRefs: ids(entry.evidenceRefs),
        entities: ids(entry.entities),
        conditions: records(entry.conditions).map(condition => ({
          text: text(condition.text, 600),
          basis: basisOf(condition.basis, [...STATEMENT_BASES, 'illustrative'] as const, 'suggestion'),
        })),
        demonstration: demonstration && text(demonstration.text)
          ? { text: text(demonstration.text, 1200), basis: demonstration.basis as 'source' | 'creator' }
          : null,
        observations: texts(entry.observations),
        communicationNeeds: records(entry.communicationNeeds).map(need => ({
          need: text(need.need, 600),
          why: text(need.why, 600),
          basis: basisOf(need.basis, STATEMENT_BASES, 'suggestion'),
        })),
        preserve: texts(entry.preserve),
        originScenes: ids(entry.originScenes),
        dependsOn: ids(entry.dependsOn),
      }
    }),
    progression: records(value.progression).map(entry => ({
      unit: text(entry.unit, 80),
      note: text(entry.note, 600),
      ordering: basisOf(entry.ordering, ['causal', 'editorial'] as const, 'editorial'),
    })),
    narrative: {
      approvedLines: records(narrative.approvedLines).map(entry => ({ scene: text(entry.scene, 120), text: text(entry.text, 4000) })),
      terminology: records(narrative.terminology).map(entry => ({ term: text(entry.term, 120), meaning: text(entry.meaning, 600) })),
      omissions: texts(narrative.omissions),
    },
    material: {
      themeRef: text(material.themeRef, 120) || null,
      baseNotebookRef: text(material.baseNotebookRef, 120),
      baseRevision: text(material.baseRevision, 120),
      assetRefs: ids(material.assetRefs),
      takeRefs: ids(material.takeRefs),
    },
    delivery: {
      sceneDecisions: records(delivery.sceneDecisions).map(entry => ({
        scene: text(entry.scene, 120),
        voice: basisOf(entry.voice, ['human', 'generated', 'silent'] as const, 'generated'),
      })),
      unresolved: text(delivery.unresolved, 600),
    },
    creativeGuidance: records(value.creativeGuidance).map(entry => ({
      text: text(entry.text, 600),
      basis: basisOf(entry.basis, STATEMENT_BASES, 'suggestion'),
    })),
    openDecisions: texts(value.openDecisions),
    uncertainty: records(value.uncertainty).map(entry => ({
      text: text(entry.text, 600),
      kind: basisOf(entry.kind, ['unsupported-claim', 'ambiguous-mechanism', 'gap'] as const, 'gap'),
    })),
    route: {
      workflow: route.workflow as BriefWorkflow,
      reason: text(route.reason, 600),
    },
    coverage: records(value.coverage).map(entry => ({
      scene: text(entry.scene, 120),
      units: ids(entry.units),
      ...(text(entry.omittedReason, 600) ? { omittedReason: text(entry.omittedReason, 600) } : {}),
    })),
  }
}

// The brief's own fields that happen to share a name with a presentation
// field: which kind of evidence, which kind of uncertainty.
const OWN_KEYS = new Set(['evidence[].kind', 'uncertainty[].kind'])

// Structural keys a reduction of meaning must not carry, found anywhere in
// the raw document the harness wrote.
const presentationKeysIn = (raw: unknown, path = '', shape = ''): string[] => {
  if (Array.isArray(raw)) return raw.flatMap((entry, index) => presentationKeysIn(entry, `${path}[${index}]`, `${shape}[]`))
  if (!isRecord(raw)) return []
  return Object.entries(raw).flatMap(([key, value]) => {
    const here = path ? `${path}.${key}` : key
    const form = shape ? `${shape}.${key}` : key
    const refused = PRESENTATION_ONLY_KEYS.has(key) && !OWN_KEYS.has(form)
    return [...(refused ? [here] : []), ...presentationKeysIn(value, here, form)]
  })
}

const duplicates = (values: string[]) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

const dependencyCycle = (units: BriefUnit[]): string[] | null => {
  const byId = new Map(units.map(unit => [unit.id, unit]))
  const state = new Map<string, 'visiting' | 'done'>()
  const walk = (id: string, trail: string[]): string[] | null => {
    if (state.get(id) === 'done') return null
    if (state.get(id) === 'visiting') return [...trail, id]
    state.set(id, 'visiting')
    for (const next of byId.get(id)?.dependsOn || []) {
      if (!byId.has(next)) continue
      const cycle = walk(next, [...trail, id])
      if (cycle) return cycle
    }
    state.set(id, 'done')
    return null
  }
  for (const unit of units) {
    const cycle = walk(unit.id, [])
    if (cycle) return cycle
  }
  return null
}

export const validateBrief = (raw: unknown, context: BriefContext): BriefReport & { brief: ExplanationBriefV1 } => {
  const brief = normalizeBrief(raw)
  const problems: string[] = []
  const warnings: string[] = []

  if (brief.schemaVersion !== BRIEF_SCHEMA_VERSION) problems.push(`schemaVersion must be ${BRIEF_SCHEMA_VERSION}`)
  for (const key of presentationKeysIn(raw)) {
    problems.push(`${key}: a brief reduces meaning; it does not carry presentation or execution structure (scene kinds, parts, seconds, camera, recipes, coordinates). Write a creator's explicit request as creator guidance instead`)
  }

  // Purpose.
  if (!brief.purpose.deliverable) problems.push('purpose.deliverable is missing')
  if (!brief.purpose.audience) problems.push('purpose.audience is missing')
  if (!brief.purpose.message) problems.push('purpose.message — the one thing the video must communicate — is missing')
  if (context.requestedSeconds !== undefined && (brief.purpose.requestedSeconds ?? null) !== (context.requestedSeconds ?? null)) {
    problems.push(`purpose.requestedSeconds must be the creator's chosen length (${context.requestedSeconds ?? 'none'}), not an estimate from the slides`)
  }

  // Source: the brief names exactly the revisions its fork pinned.
  if (context.sourceRevision && brief.source.revisionRef !== context.sourceRevision) {
    problems.push(`source.revisionRef is "${brief.source.revisionRef}", but this fork pinned source revision "${context.sourceRevision}"`)
  }
  if (brief.source.wordingPolicy !== context.wordingPolicy) {
    problems.push(`source.wordingPolicy is "${brief.source.wordingPolicy}", but the notebook's policy is "${context.wordingPolicy}"`)
  }
  if (!context.sourceText.trim() && brief.source.coverage === 'full') {
    problems.push('source.coverage says the full source was read, but only fragments of it were retained — record the limitation instead')
  }
  if (brief.source.coverage === 'fragments' && !brief.source.limitations.length) {
    warnings.push('source.coverage is fragments but no limitation is recorded')
  }

  // Evidence: every quotation is really there.
  const evidenceIds = brief.evidence.map(entry => entry.id)
  for (const id of duplicates(evidenceIds)) problems.push(`evidence id "${id}" is used twice`)
  for (const entry of brief.evidence) {
    if (!entry.id) problems.push('an evidence entry has no id')
    if (comparableText(entry.text).length < 12) {
      problems.push(`evidence ${entry.id || '?'} is too short to identify a passage`)
      continue
    }
    const pool = entry.kind === 'source' ? context.sourceText : context.creatorText
    if (!quotedIn(entry.text, pool)) {
      problems.push(
        entry.kind === 'source'
          ? `evidence ${entry.id} is not a passage of the retained source — quote it exactly (an ellipsis may join fragments)`
          : `evidence ${entry.id} is not something the creator wrote — quote their narration, notes or direction exactly`,
      )
    }
  }
  const knownEvidence = new Set(evidenceIds)
  const checkRefs = (where: string, refs: string[]) => {
    for (const ref of refs) if (!knownEvidence.has(ref)) problems.push(`${where} cites evidence "${ref}", which the brief does not contain`)
  }

  // Entities.
  const entityIds = brief.entities.map(entity => entity.id)
  for (const id of duplicates(entityIds)) problems.push(`entity id "${id}" is used twice`)
  for (const entity of brief.entities) {
    if (!entity.id || !entity.name) problems.push('an entity needs an id and a name')
    if (!entity.role) problems.push(`entity ${entity.id} has no role — say what it does, in ordinary language`)
    checkRefs(`entity ${entity.id}`, entity.evidenceRefs)
  }
  const knownEntities = new Set(entityIds)

  // Units: the meaning, each tied to evidence.
  if (!brief.units.length) problems.push('the brief has no explanation units')
  const unitIds = brief.units.map(unit => unit.id)
  for (const id of duplicates(unitIds)) problems.push(`unit id "${id}" is used twice`)
  const knownUnits = new Set(unitIds)
  const baseScenes = new Set(context.baseSceneIds)
  for (const unit of brief.units) {
    const where = `unit ${unit.id || '?'}`
    if (!unit.id) problems.push('a unit has no id')
    if (!unit.question) problems.push(`${where} has no question`)
    if (!unit.explain) problems.push(`${where} does not say what it explains`)
    if (!unit.evidenceRefs.length) problems.push(`${where} cites no evidence — link each unit's claims to the source or to the creator`)
    checkRefs(where, unit.evidenceRefs)
    for (const entity of unit.entities) if (!knownEntities.has(entity)) problems.push(`${where} names entity "${entity}", which the brief does not define`)
    for (const dependency of unit.dependsOn) if (!knownUnits.has(dependency)) problems.push(`${where} depends on "${dependency}", which is not a unit`)
    for (const origin of unit.originScenes) if (!baseScenes.has(origin)) problems.push(`${where} comes from scene "${origin}", which is not a page of the base`)
    if (!unit.communicationNeeds.length) problems.push(`${where} lists no communication needs — what must the viewer hear, see or read, and why?`)
    for (const need of unit.communicationNeeds) if (!need.need || !need.why) problems.push(`${where} has a communication need without both the need and why it matters`)
    if (unit.demonstration && !['source', 'creator'].includes(unit.demonstration.basis)) {
      problems.push(`${where} proposes a demonstration: only a source or creator demonstration belongs in the brief; leave the choice open for the creative plan`)
    }
  }
  const cycle = dependencyCycle(brief.units)
  if (cycle) problems.push(`units depend on each other in a circle: ${cycle.join(' → ')}`)

  // Progression: every unit once, in a suggested order.
  const ordered = brief.progression.map(step => step.unit)
  for (const id of duplicates(ordered)) problems.push(`progression lists unit "${id}" twice`)
  for (const id of ordered) if (!knownUnits.has(id)) problems.push(`progression names "${id}", which is not a unit`)
  for (const id of unitIds) if (!ordered.includes(id)) problems.push(`progression leaves out unit "${id}"`)

  // Coverage: every inherited page is accounted for.
  const covered = brief.coverage.map(entry => entry.scene)
  for (const id of duplicates(covered)) problems.push(`coverage lists scene "${id}" twice`)
  for (const scene of context.baseSceneIds) {
    const entry = brief.coverage.find(candidate => candidate.scene === scene)
    if (!entry) problems.push(`coverage does not account for base scene "${scene}" — map it to units or say why it is left out`)
    else if (!entry.units.length && !entry.omittedReason) problems.push(`base scene "${scene}" maps to no unit and gives no reason`)
    for (const unit of entry?.units || []) if (!knownUnits.has(unit)) problems.push(`coverage maps scene "${scene}" to "${unit}", which is not a unit`)
  }
  for (const scene of covered) if (!baseScenes.has(scene)) problems.push(`coverage names "${scene}", which is not a page of the base`)

  // Wording: preserved lines are the creator's, verbatim.
  if (context.wordingPolicy === 'preserve') {
    for (const line of brief.narrative.approvedLines) {
      const script = context.scripts.find(entry => entry.scene === line.scene)
      if (!script) problems.push(`narrative.approvedLines names scene "${line.scene}", which has no approved script`)
      else if (!quotedIn(line.text, script.text)) problems.push(`narrative.approvedLines changes scene "${line.scene}"'s approved wording — carry it verbatim`)
    }
    if (!brief.narrative.approvedLines.length && context.scripts.some(entry => entry.text.trim())) {
      problems.push('the wording is preserved, but narrative.approvedLines carries none of the approved scripts')
    }
  }

  // Material: the pinned references, exactly.
  if (brief.material.baseNotebookRef !== context.baseNotebookRef) problems.push(`material.baseNotebookRef must be "${context.baseNotebookRef}"`)
  if (brief.material.baseRevision !== context.baseRevision) problems.push(`material.baseRevision must be the pinned "${context.baseRevision}"`)
  if ((brief.material.themeRef || null) !== (context.themeRef || null)) problems.push(`material.themeRef must be ${context.themeRef ? `"${context.themeRef}"` : 'empty (no saved theme)'}`)

  // Delivery: only decisions already made.
  for (const decision of brief.delivery.sceneDecisions) {
    const made = context.sceneDecisions.find(entry => entry.scene === decision.scene)
    if (!made) problems.push(`delivery.sceneDecisions records a choice for "${decision.scene}" that the creator has not made — leave it unresolved`)
    else if (made.voice !== decision.voice) problems.push(`delivery.sceneDecisions says "${decision.voice}" for "${decision.scene}", but the creator chose "${made.voice}"`)
  }
  if (!brief.delivery.unresolved && context.sceneDecisions.length < context.baseSceneIds.length) {
    warnings.push('delivery.unresolved does not say what is still undecided')
  }

  // Route: one owning workflow, for a stated reason.
  if (!(BRIEF_WORKFLOWS as readonly string[]).includes(String(brief.route.workflow))) {
    problems.push(`route.workflow must be one of ${BRIEF_WORKFLOWS.join(', ')}`)
  }
  if (!brief.route.reason) problems.push('route.reason is missing — say why this workflow owns the video')

  return { ok: problems.length === 0, problems, warnings, brief }
}
