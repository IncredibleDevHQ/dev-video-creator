// A scene treatment: the creative plan the skills make for one video scene.
//
// It is a matrix of moments and overlapping channels, not a sequence of
// "speaker section, motion section, text section": in one moment the voice can
// explain while an object changes and a label lands. Each moment says why the
// viewer needs to see it and what they should notice; each recipe it names
// says what it is for and which channel it serves.
//
// A treatment is a proposal to review, not an executable plan. It carries no
// selectors or frame-accurate timing — durations are estimates until audio or
// a take exists — and it cannot decide a delivery the creator has not chosen:
// suggesting a presenter does not mandate a recording or switch the voice.
import { findCapability, type CapabilityCatalog, type CapabilityKind } from './capability-catalog'
import type { ExplanationBriefV1 } from './explanation-brief'

export const TREATMENT_SCHEMA_VERSION = 1 as const

export const TREATMENT_CHANNELS = ['narration', 'objects', 'text', 'presenter', 'camera', 'audio'] as const
export type TreatmentChannel = (typeof TREATMENT_CHANNELS)[number]

export const RECIPE_SOURCES = ['rule', 'blueprint', 'technique', 'reference', 'adapted'] as const
export type RecipeSource = (typeof RECIPE_SOURCES)[number]

export type TreatmentRecipe = {
  id: string
  // Where it comes from: a catalogued rule/blueprint/technique, a creative
  // reference of the pinned bundle, or a recipe the plan adapts itself.
  catalog: RecipeSource
  purpose: string
  channel: TreatmentChannel
  // Which actors or layers it drives: one writer per property.
  controls: string[]
}

export type TreatmentMoment = {
  id: string
  title: string
  // Why the viewer needs to see it, and what they should notice.
  purpose: string
  observation: string
  narration: { job: string; guide: string } | null
  objects: { change: string; actors: string[] } | null
  text: { content: string; role: 'term' | 'label' | 'exact' | 'code' | 'takeaway' } | null
  presenter: { visibility: 'full' | 'shared' | 'hidden' | 'undecided'; reason: string } | null
  camera: { treatment: string; subject: string; reason: string } | null
  audio: { cue: string; reason: string } | null
  attention: string
  recipes: TreatmentRecipe[]
  evidenceRefs: string[]
  // A rough length, only ever an estimate before audio exists.
  estimateSeconds: number | null
}

// A countable demonstration's running count (R7): what is counted, what it
// starts at, and every change moment by moment. The product replays it, so
// an illustrative example still obeys its own mechanism — a refused request
// consumes nothing, and nothing is spent that is not there.
export type LedgerEvent = {
  moment: string
  what: string
  change: 'add' | 'consume' | 'refuse'
  amount: number
  // What one admission needs, for a refusal (default 1).
  needs?: number
  // The count after this event, as the plan tells it.
  after: number
}
export type TreatmentLedger = { quantity: string; capacity: number | null; initial: number; events: LedgerEvent[]; final: number }

// How one side of the scene meets its neighbour (R8). self-contained: needs
// nothing from it. agreed: rests on the neighbour's reviewed plan — the
// product records which revision, and the agreement breaks when that plan
// changes. proposed: asks for a boundary the neighbour has not promised; it
// stays provisional until both sides agree.
export const CONTINUITY_KINDS = ['self-contained', 'agreed', 'proposed'] as const
export type ContinuitySide = { kind: (typeof CONTINUITY_KINDS)[number]; scene?: string; record?: string; revision?: number; note?: string }

export const ASSET_DECISIONS = ['reuse', 'adapt', 'enrich', 'native', 'generate', 'omit', 'undecided'] as const
export type AssetDecision = (typeof ASSET_DECISIONS)[number]

export type SceneTreatmentV1 = {
  schemaVersion: typeof TREATMENT_SCHEMA_VERSION
  scene: string
  originScenes: string[]
  units: string[]
  question: string
  takeaway: string
  evidenceRefs: string[]
  // How the idea develops — not a recital of the slide.
  development: string
  demonstration: { text: string; values: Array<{ value: string; basis: 'source' | 'creator' | 'illustrative' }> } | null
  ledger: TreatmentLedger | null
  moments: TreatmentMoment[]
  objects: Array<{
    entity: string
    role: string
    appearance: string
    performance: string
    // What the scene does for its artwork (P1): reuse a library or cast
    // ingredient unchanged, adapt it (recolour, re-rig), enrich it (a richer
    // version from its silhouette, role and parts), build it native (exact
    // shapes, charts, counts, code), generate something new, or omit it —
    // with the reason the viewer needs it.
    asset: { status: AssetDecision; ref?: string; reason?: string }
  }>
  treatments: { presenter: string; text: string; camera: string }
  skills: Array<{ skill: string; references: string[]; why: string }>
  requirements: { assets: string[]; takes: string[]; decisions: string[] }
  continuity: { entry: string; exit: string; incoming: ContinuitySide; outgoing: ContinuitySide }
  unresolved: string[]
  coverage: Array<{ unit: string; need: string; moments: string[]; deferred?: string }>
  rosterProposal: { action: 'split' | 'merge' | 'resequence'; scenes: string[]; reason: string } | null
  delivery: { voice: 'human' | 'generated' | 'silent' | 'undecided'; note: string }
}

export type TreatmentContext = {
  brief: ExplanationBriefV1
  // The video scene being planned, where it came from, and the other scenes
  // a roster proposal may name.
  scene: string
  originScenes: string[]
  videoScenes: string[]
  catalog: Pick<CapabilityCatalog, 'entries'>
  // The pinned bundle: its skill names and reference paths.
  bundleSkills: string[]
  bundleReferences: string[]
  // A delivery choice the creator already made for this scene, if any.
  delivery: 'human' | 'generated' | 'silent' | null
  assetKeys: string[]
  // The adjacent video scenes and their reviewed plans now, when they have
  // one: what an agreed seam can rest on.
  neighbors?: NeighborPlan[]
}

export type NeighborPlan = {
  position: 'before' | 'after'
  scene: string
  reviewed: { recordId: string; revision: number; entry: string; exit: string } | null
}

export type TreatmentReport = {
  ok: boolean
  problems: string[]
  warnings: string[]
  // What construction will have to prove: adapted or not-yet-verified recipes.
  constructionRisks: string[]
  treatment: SceneTreatmentV1
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, limit = 2000) => (typeof value === 'string' ? value.trim().slice(0, limit) : '')
const texts = (value: unknown, limit = 600) =>
  (Array.isArray(value) ? value : []).map(entry => text(entry, limit)).filter(Boolean)
const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : [])
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(String(value)) ? (value as T) : fallback

const channelOrNull = <T>(value: unknown, read: (entry: Record<string, unknown>) => T): T | null =>
  isRecord(value) ? read(value) : null
// A number as given, NaN when it is not one — validation says so.
const numeric = (value: unknown) => (value === null || value === undefined || value === '' ? Number.NaN : Number(value))

const ledgerOf = (value: unknown): TreatmentLedger | null => {
  if (!isRecord(value)) return null
  const capacity = numeric(value.capacity)
  return {
    quantity: text(value.quantity, 200),
    capacity: Number.isFinite(capacity) ? capacity : null,
    initial: numeric(value.initial),
    events: records(value.events).map(event => ({
      moment: text(event.moment, 80),
      what: text(event.what, 300),
      change: text(event.change, 20) as LedgerEvent['change'],
      amount: event.amount === undefined && text(event.change, 20) === 'refuse' ? 0 : numeric(event.amount),
      ...(event.needs !== undefined ? { needs: numeric(event.needs) } : {}),
      after: numeric(event.after),
    })),
    final: numeric(value.final),
  }
}

const sideOf = (value: unknown): ContinuitySide => {
  if (!isRecord(value)) return { kind: '' as ContinuitySide['kind'] }
  const revision = numeric(value.revision)
  return {
    kind: text(value.kind, 40) as ContinuitySide['kind'],
    ...(text(value.scene, 120) ? { scene: text(value.scene, 120) } : {}),
    ...(Number.isFinite(revision) ? { revision } : {}),
    ...(text(value.note, 600) ? { note: text(value.note, 600) } : {}),
  }
}

export const normalizeTreatment = (raw: unknown): SceneTreatmentV1 => {
  const value = isRecord(raw) ? raw : {}
  const demonstration = isRecord(value.demonstration) ? value.demonstration : null
  const treatments = isRecord(value.treatments) ? value.treatments : {}
  const requirements = isRecord(value.requirements) ? value.requirements : {}
  const continuity = isRecord(value.continuity) ? value.continuity : {}
  const roster = isRecord(value.rosterProposal) ? value.rosterProposal : null
  const delivery = isRecord(value.delivery) ? value.delivery : {}
  return {
    schemaVersion: value.schemaVersion as typeof TREATMENT_SCHEMA_VERSION,
    scene: text(value.scene, 120),
    originScenes: texts(value.originScenes, 120),
    units: texts(value.units, 80),
    question: text(value.question, 600),
    takeaway: text(value.takeaway, 600),
    evidenceRefs: texts(value.evidenceRefs, 80),
    development: text(value.development, 4000),
    demonstration: demonstration && text(demonstration.text)
      ? {
          text: text(demonstration.text, 1600),
          values: records(demonstration.values).map(entry => ({
            value: text(entry.value, 200),
            basis: entry.basis as 'source' | 'creator' | 'illustrative',
          })),
        }
      : null,
    ledger: ledgerOf(value.ledger),
    moments: records(value.moments).map(moment => {
      const seconds = Number(moment.estimateSeconds)
      return {
        id: text(moment.id, 80),
        title: text(moment.title, 200),
        purpose: text(moment.purpose, 1000),
        observation: text(moment.observation, 1000),
        narration: channelOrNull(moment.narration, entry => ({ job: text(entry.job, 600), guide: text(entry.guide, 2000) })),
        objects: channelOrNull(moment.objects, entry => ({ change: text(entry.change, 1000), actors: texts(entry.actors, 80) })),
        text: channelOrNull(moment.text, entry => ({
          content: text(entry.content, 600),
          role: oneOf(entry.role, ['term', 'label', 'exact', 'code', 'takeaway'] as const, 'label'),
        })),
        presenter: channelOrNull(moment.presenter, entry => ({
          visibility: oneOf(entry.visibility, ['full', 'shared', 'hidden', 'undecided'] as const, 'undecided'),
          reason: text(entry.reason, 600),
        })),
        camera: channelOrNull(moment.camera, entry => ({ treatment: text(entry.treatment, 200), subject: text(entry.subject, 200), reason: text(entry.reason, 600) })),
        audio: channelOrNull(moment.audio, entry => ({ cue: text(entry.cue, 200), reason: text(entry.reason, 600) })),
        attention: text(moment.attention, 300),
        recipes: records(moment.recipes).map(recipe => ({
          id: text(recipe.id, 120),
          catalog: recipe.catalog as RecipeSource,
          purpose: text(recipe.purpose, 600),
          channel: recipe.channel as TreatmentChannel,
          controls: texts(recipe.controls, 120),
        })),
        evidenceRefs: texts(moment.evidenceRefs, 80),
        estimateSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 10) / 10 : null,
      }
    }),
    objects: records(value.objects).map(entry => {
      const asset = isRecord(entry.asset) ? entry.asset : {}
      return {
        entity: text(entry.entity, 80),
        role: text(entry.role, 600),
        appearance: text(entry.appearance, 1000),
        performance: text(entry.performance, 1000),
        asset: {
          status: oneOf(asset.status, ASSET_DECISIONS, 'undecided'),
          ...(text(asset.ref, 120) ? { ref: text(asset.ref, 120) } : {}),
          ...(text(asset.reason, 600) ? { reason: text(asset.reason, 600) } : {}),
        },
      }
    }),
    treatments: { presenter: text(treatments.presenter, 2000), text: text(treatments.text, 2000), camera: text(treatments.camera, 2000) },
    skills: records(value.skills).map(entry => ({ skill: text(entry.skill, 80), references: texts(entry.references, 200), why: text(entry.why, 800) })),
    requirements: { assets: texts(requirements.assets), takes: texts(requirements.takes), decisions: texts(requirements.decisions) },
    continuity: { entry: text(continuity.entry, 1000), exit: text(continuity.exit, 1000), incoming: sideOf(continuity.incoming), outgoing: sideOf(continuity.outgoing) },
    unresolved: texts(value.unresolved),
    coverage: records(value.coverage).map(entry => ({
      unit: text(entry.unit, 80),
      need: text(entry.need, 600),
      moments: texts(entry.moments, 80),
      ...(text(entry.deferred, 600) ? { deferred: text(entry.deferred, 600) } : {}),
    })),
    rosterProposal: roster
      ? { action: oneOf(roster.action, ['split', 'merge', 'resequence'] as const, 'resequence'), scenes: texts(roster.scenes, 120), reason: text(roster.reason, 1000) }
      : null,
    delivery: { voice: oneOf(delivery.voice, ['human', 'generated', 'silent', 'undecided'] as const, 'undecided'), note: text(delivery.note, 600) },
  }
}

const duplicates = (values: string[]) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

const whole = (value: number) => Number.isInteger(value) && value >= 0

// Replays a ledger in moment order: every stated count must be the count.
export const ledgerProblems = (ledger: TreatmentLedger, momentIds: string[]) => {
  const problems: string[] = []
  const label = `ledger (${ledger.quantity || 'no quantity named'})`
  if (!ledger.quantity) problems.push('ledger.quantity must say what is counted')
  if (!whole(ledger.initial)) problems.push(`${label}: initial must be a whole number`)
  if (ledger.capacity !== null && (!whole(ledger.capacity) || (whole(ledger.initial) && ledger.capacity < ledger.initial))) {
    problems.push(`${label}: a capacity of ${ledger.capacity} cannot hold the initial ${ledger.initial}`)
  }
  if (!ledger.events.length) problems.push(`${label}: events is empty — a counted demonstration changes the count`)
  let count = whole(ledger.initial) ? ledger.initial : 0
  let latest = -1
  ledger.events.forEach((event, index) => {
    const where = `${label} event ${index + 1}${event.what ? ` ("${event.what}")` : ''}`
    const at = momentIds.indexOf(event.moment)
    if (at < 0) problems.push(`${where} happens in moment "${event.moment}", which is not a moment of this plan`)
    else if (at < latest) problems.push(`${where} is listed after an event of a later moment — list events in the order they happen`)
    else latest = at
    if (event.change === 'refuse') {
      const needs = event.needs ?? 1
      if (event.amount !== 0) problems.push(`${where}: a refused request consumes nothing — its amount is 0`)
      if (count >= needs) problems.push(`${where} is refused while ${count} remain — with that supply it would be admitted`)
    } else if (event.change === 'add' || event.change === 'consume') {
      if (!whole(event.amount) || event.amount === 0) problems.push(`${where}: amount must be a whole number above 0`)
      else if (event.change === 'add') {
        if (ledger.capacity !== null && count + event.amount > ledger.capacity) problems.push(`${where} adds ${event.amount} to ${count}, past the capacity of ${ledger.capacity}`)
        count = ledger.capacity !== null ? Math.min(ledger.capacity, count + event.amount) : count + event.amount
      } else {
        if (event.amount > count) problems.push(`${where} consumes ${event.amount} while only ${count} remain — it would be refused`)
        count = Math.max(0, count - event.amount)
      }
    } else {
      problems.push(`${where}: change must be add, consume or refuse`)
    }
    if (event.after !== count) problems.push(`${where} says ${Number.isFinite(event.after) ? event.after : 'nothing'} remain after it, but the count is ${count}`)
  })
  if (ledger.final !== count) problems.push(`${label}: final is ${Number.isFinite(ledger.final) ? ledger.final : 'missing'}, but the events leave ${count}`)
  return problems
}

// Does the plan count things without a ledger? Numbers of countable things
// in the demonstration or the moments' visible changes.
const COUNTED = /\b(\d+)\s+(?:[a-z-]+\s+)?(tokens?|slots?|requests?|calls?|retries|items?|jobs?|connections?|workers?|messages?|packets?|credits?|permits?|seats?|tickets?|units?)\b/gi
const countedMentions = (treatment: SceneTreatmentV1) =>
  [
    treatment.demonstration?.text || '',
    ...(treatment.demonstration?.values.map(value => value.value) || []),
    ...treatment.moments.flatMap(moment => [moment.objects?.change || '', moment.observation]),
  ].flatMap(value => [...value.matchAll(COUNTED)].map(match => match[0].toLowerCase()))

// Where each seam stands now: an agreement holds only while the neighbour's
// reviewed plan is the one it was made with.
export type ContinuityState = { side: 'incoming' | 'outgoing'; kind: ContinuitySide['kind'] | 'unstated'; scene: string | null; state: 'self-contained' | 'agreed' | 'broken' | 'proposed' | 'unstated'; reason: string | null }
export const continuityStatus = (treatment: SceneTreatmentV1, neighbors: NeighborPlan[]): ContinuityState[] =>
  (['incoming', 'outgoing'] as const).map(side => {
    const stated = treatment.continuity[side]
    const neighbor = neighbors.find(entry => entry.position === (side === 'incoming' ? 'before' : 'after')) || null
    const scene = stated?.scene || neighbor?.scene || null
    if (!stated || !(CONTINUITY_KINDS as readonly string[]).includes(stated.kind)) return { side, kind: 'unstated', scene, state: 'unstated', reason: 'The plan does not say how this side meets its neighbour.' }
    if (stated.kind === 'self-contained') return { side, kind: stated.kind, scene: null, state: 'self-contained', reason: null }
    if (stated.kind === 'proposed') return { side, kind: stated.kind, scene, state: 'proposed', reason: `Provisional until ${scene || 'the neighbour'} agrees.` }
    const holds = Boolean(neighbor?.reviewed && neighbor.reviewed.recordId === stated.record && neighbor.reviewed.revision === stated.revision)
    return {
      side,
      kind: stated.kind,
      scene,
      state: holds ? 'agreed' : 'broken',
      reason: holds ? null : neighbor?.reviewed ? `${scene}'s reviewed plan changed since this seam was agreed.` : `${scene} no longer has the reviewed plan this seam was agreed with.`,
    }
  })

// Selectors and frame timing belong to construction; a plan that states them
// pretends to precision it does not have.
const EXECUTION_DETAIL = /(^|[\s(])[#.][a-z][\w-]*\s*\{|querySelector|\bdata-[a-z-]+=|\b\d+\s*ms\b|\bframe\s+\d+\b/i

export const validateTreatment = (raw: unknown, context: TreatmentContext): TreatmentReport => {
  const treatment = normalizeTreatment(raw)
  const problems: string[] = []
  const warnings: string[] = []
  const constructionRisks: string[] = []
  const { brief } = context

  if (treatment.schemaVersion !== TREATMENT_SCHEMA_VERSION) problems.push(`schemaVersion must be ${TREATMENT_SCHEMA_VERSION}`)
  if (treatment.scene !== context.scene) problems.push(`scene is "${treatment.scene}", but this plan is for "${context.scene}"`)
  for (const origin of treatment.originScenes) {
    if (!context.originScenes.includes(origin)) problems.push(`originScenes names "${origin}", which this scene does not come from — propose a roster change instead`)
  }

  // What it explains, grounded in the brief.
  const unitById = new Map(brief.units.map(unit => [unit.id, unit]))
  const evidence = new Set(brief.evidence.map(entry => entry.id))
  const coversNothing = context.originScenes.every(origin => {
    const entry = brief.coverage.find(candidate => candidate.scene === origin)
    return entry ? !entry.units.length : false
  })
  if (!treatment.units.length && !coversNothing) problems.push('units is empty — say which explanation units of the brief this scene develops')
  for (const unit of treatment.units) if (!unitById.has(unit)) problems.push(`units names "${unit}", which is not a unit of the brief`)
  if (!treatment.question) problems.push('question is missing')
  if (!treatment.takeaway) problems.push('takeaway is missing')
  if (!treatment.development) problems.push('development is missing — how does the idea unfold, beyond reciting the slide?')
  for (const ref of treatment.evidenceRefs) if (!evidence.has(ref)) problems.push(`evidenceRefs cites "${ref}", which the brief does not contain`)
  if (treatment.demonstration) {
    for (const value of treatment.demonstration.values) {
      if (!['source', 'creator', 'illustrative'].includes(String(value.basis))) {
        problems.push(`demonstration value "${value.value}" must say whether it is from the source, from the creator, or illustrative`)
      }
    }
  }

  // Moments: each one earns its place.
  if (!treatment.moments.length) problems.push('the plan has no moments')
  const momentIds = treatment.moments.map(moment => moment.id)
  for (const id of duplicates(momentIds)) problems.push(`moment id "${id}" is used twice`)
  const entityIds = new Set([...brief.entities.map(entity => entity.id), ...treatment.objects.map(object => object.entity)])
  const channelCount = (moment: TreatmentMoment) =>
    [moment.narration, moment.objects, moment.text, moment.presenter, moment.camera, moment.audio].filter(Boolean).length
  for (const moment of treatment.moments) {
    const where = `moment ${moment.id || '?'}`
    if (!moment.id) problems.push('a moment has no id')
    if (!moment.purpose) problems.push(`${where} does not say why the viewer needs to see it`)
    if (!moment.observation) problems.push(`${where} does not say what the viewer should notice`)
    if (!moment.attention) problems.push(`${where} has no primary attention target`)
    if (!channelCount(moment)) problems.push(`${where} has no channel — something must be heard, seen or read`)
    for (const actor of moment.objects?.actors || []) if (!entityIds.has(actor)) problems.push(`${where} moves "${actor}", which is neither a brief entity nor one of the plan's objects`)
    for (const ref of moment.evidenceRefs) if (!evidence.has(ref)) problems.push(`${where} cites "${ref}", which the brief does not contain`)
    for (const recipe of moment.recipes) {
      const label = `${where} recipe "${recipe.id}"`
      if (!recipe.id || !recipe.purpose) problems.push(`${label} needs an id and a purpose`)
      if (!(RECIPE_SOURCES as readonly string[]).includes(String(recipe.catalog))) {
        problems.push(`${label} must say where it comes from: ${RECIPE_SOURCES.join(', ')}`)
        continue
      }
      if (!(TREATMENT_CHANNELS as readonly string[]).includes(String(recipe.channel))) problems.push(`${label} must name the channel it serves: ${TREATMENT_CHANNELS.join(', ')}`)
      if (recipe.catalog === 'rule' || recipe.catalog === 'blueprint' || recipe.catalog === 'technique') {
        const entry = findCapability(context.catalog, recipe.catalog as CapabilityKind, recipe.id)
        if (!entry) problems.push(`${label} is not a ${recipe.catalog} in the pinned catalog — name a catalogued one, or mark it adapted and describe it`)
        else if (!entry.verifiedInInstalledRuntime) constructionRisks.push(`${recipe.catalog} "${recipe.id}" is catalogued but not yet proven in the installed runtime`)
      } else if (recipe.catalog === 'reference') {
        if (!context.bundleReferences.includes(recipe.id)) problems.push(`${label} is not a reference file of the pinned bundle`)
      } else {
        constructionRisks.push(`adapted recipe "${recipe.id}" (${recipe.purpose || 'no purpose given'}) must be built and verified at construction`)
      }
    }
    for (const field of [moment.narration?.guide, moment.objects?.change, moment.camera?.treatment]) {
      if (field && EXECUTION_DETAIL.test(field)) warnings.push(`${where} states execution detail (selectors or exact timing) that a plan cannot yet know`)
    }
  }
  const estimates = treatment.moments.map(moment => moment.estimateSeconds).filter((value): value is number => value !== null)
  if (estimates.length && brief.purpose.requestedSeconds && estimates.reduce((sum, value) => sum + value, 0) > brief.purpose.requestedSeconds) {
    warnings.push('the moment estimates alone exceed the whole video\'s requested length')
  }

  // Objects: what each does, and whether an asset exists for it.
  const cast = new Set(treatment.objects.map(object => object.entity))
  for (const actor of new Set(treatment.moments.flatMap(moment => moment.objects?.actors || []))) {
    if (entityIds.has(actor) && !cast.has(actor)) warnings.push(`"${actor}" moves in a moment but is not cast among the plan's objects, so its look and asset are undecided`)
  }
  const assets = new Set(context.assetKeys)
  const moveActors = new Set(treatment.moments.flatMap(moment => moment.objects?.actors || []))
  for (const object of treatment.objects) {
    if (!object.entity || !object.role) problems.push('each object needs the entity it plays and its role')
    if (!object.performance) warnings.push(`object ${object.entity} has no performance — does it do explanatory work beyond appearing?`)
    const decision = object.asset.status
    if ((decision === 'reuse' || decision === 'adapt' || decision === 'enrich') && (!object.asset.ref || !assets.has(object.asset.ref))) {
      problems.push(`object ${object.entity} ${decision === 'reuse' ? 'reuses' : decision === 'adapt' ? 'adapts' : 'enriches'} asset "${object.asset.ref || ''}", which is not in the accepted asset library`)
    }
    if (decision !== 'undecided' && !object.asset.reason) warnings.push(`object ${object.entity}: say why "${decision}" serves what the viewer needs to understand`)
    if (decision === 'omit' && moveActors.has(object.entity)) problems.push(`object ${object.entity} is omitted, but a moment moves it`)
  }

  // The demonstration's arithmetic (R7).
  if (treatment.ledger) problems.push(...ledgerProblems(treatment.ledger, momentIds))
  else {
    const counted = [...new Set(countedMentions(treatment))]
    if (counted.length >= 2) {
      warnings.push(`the demonstration counts (${counted.slice(0, 4).join(', ')}) but has no ledger — add one so its arithmetic is checked`)
    }
  }

  // Continuity (R8): each side says whether it needs its neighbour, and an
  // agreement rests on the neighbour's reviewed plan, recorded here.
  const neighbors = context.neighbors || []
  for (const side of ['incoming', 'outgoing'] as const) {
    const stated = treatment.continuity[side]
    const position = side === 'incoming' ? 'before' : 'after'
    const neighbor = neighbors.find(entry => entry.position === position) || null
    const label = `continuity.${side}`
    if (!(CONTINUITY_KINDS as readonly string[]).includes(stated.kind)) {
      problems.push(`${label} must say whether the ${side === 'incoming' ? 'opening' : 'ending'} is self-contained, agreed with a reviewed neighbour, or proposed`)
      continue
    }
    if (stated.kind === 'self-contained') continue
    if (!neighbor) {
      problems.push(`${label} is ${stated.kind}, but no scene comes ${position} this one`)
      continue
    }
    if (stated.scene && stated.scene !== neighbor.scene) problems.push(`${label} names "${stated.scene}", but the scene ${position} this one is "${neighbor.scene}"`)
    stated.scene = neighbor.scene
    if (stated.kind === 'agreed') {
      if (!neighbor.reviewed) {
        problems.push(`${label} is agreed, but ${neighbor.scene} has no reviewed plan to agree with — open self-contained, or mark the seam proposed`)
      } else if (stated.revision !== undefined && stated.revision !== neighbor.reviewed.revision) {
        problems.push(`${label} agrees with revision ${stated.revision} of ${neighbor.scene}, but its reviewed plan is revision ${neighbor.reviewed.revision}`)
      } else {
        // The agreement is the check's record, not the harness's claim.
        stated.record = neighbor.reviewed.recordId
        stated.revision = neighbor.reviewed.revision
      }
    } else {
      warnings.push(`${label} proposes a seam with ${neighbor.scene} that its plan has not promised — it stays provisional until both sides agree`)
    }
  }

  // Skills: which pinned guidance shaped the plan, and why.
  if (!treatment.skills.length) problems.push('skills is empty — name the pinned Hyperframes skills that shaped this plan and why')
  for (const skill of treatment.skills) {
    if (!context.bundleSkills.includes(skill.skill)) problems.push(`skills names "${skill.skill}", which is not in the pinned bundle`)
    if (!skill.why) problems.push(`skill "${skill.skill}" gives no reason`)
    for (const reference of skill.references) if (!context.bundleReferences.includes(reference)) problems.push(`skill "${skill.skill}" cites "${reference}", which is not a file of the pinned bundle`)
  }

  // Coverage: every communication need of the units it takes on.
  for (const unitId of treatment.units) {
    const unit = unitById.get(unitId)
    if (!unit) continue
    for (const need of unit.communicationNeeds) {
      const entry = treatment.coverage.find(candidate => candidate.unit === unitId && candidate.need === need.need)
      if (!entry) {
        problems.push(`coverage does not say how "${need.need}" (${unitId}) is met — name the moments, or defer it with a reason`)
        continue
      }
      if (!entry.moments.length && !entry.deferred) problems.push(`coverage for "${need.need}" names no moment and gives no deferral reason`)
      for (const moment of entry.moments) if (!momentIds.includes(moment)) problems.push(`coverage for "${need.need}" names "${moment}", which is not a moment`)
    }
  }

  // Delivery: a plan may suggest, never decide for the creator.
  if (context.delivery === null && treatment.delivery.voice !== 'undecided') {
    problems.push(`delivery.voice is "${treatment.delivery.voice}", but the creator has not chosen a delivery for this scene — keep it undecided and put the suggestion in the note`)
  }
  if (context.delivery !== null && treatment.delivery.voice !== context.delivery) {
    problems.push(`delivery.voice must be the creator's choice, "${context.delivery}"`)
  }
  if (context.delivery === 'generated' && treatment.moments.some(moment => moment.presenter && moment.presenter.visibility !== 'hidden')) {
    problems.push('this scene is generated-only: it reserves no presenter space, so no moment may show a presenter')
  }

  // Roster: a proposal names real scenes and a reason.
  if (treatment.rosterProposal) {
    for (const scene of treatment.rosterProposal.scenes) if (!context.videoScenes.includes(scene)) problems.push(`rosterProposal names "${scene}", which is not a scene of this video`)
    if (!treatment.rosterProposal.reason) problems.push('rosterProposal gives no reason')
  }

  // A recipe several moments share is one risk, reported once.
  return { ok: problems.length === 0, problems, warnings: [...new Set(warnings)], constructionRisks: [...new Set(constructionRisks)], treatment }
}

// The channels a plan actually uses, for the workspace's lanes.
export const channelsOf = (moment: TreatmentMoment): TreatmentChannel[] =>
  TREATMENT_CHANNELS.filter(channel => Boolean(moment[channel]))
