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
  moments: TreatmentMoment[]
  objects: Array<{
    entity: string
    role: string
    appearance: string
    performance: string
    asset: { status: 'reuse' | 'generate' | 'native' | 'undecided'; ref?: string }
  }>
  treatments: { presenter: string; text: string; camera: string }
  skills: Array<{ skill: string; references: string[]; why: string }>
  requirements: { assets: string[]; takes: string[]; decisions: string[] }
  continuity: { entry: string; exit: string }
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
          status: oneOf(asset.status, ['reuse', 'generate', 'native', 'undecided'] as const, 'undecided'),
          ...(text(asset.ref, 120) ? { ref: text(asset.ref, 120) } : {}),
        },
      }
    }),
    treatments: { presenter: text(treatments.presenter, 2000), text: text(treatments.text, 2000), camera: text(treatments.camera, 2000) },
    skills: records(value.skills).map(entry => ({ skill: text(entry.skill, 80), references: texts(entry.references, 200), why: text(entry.why, 800) })),
    requirements: { assets: texts(requirements.assets), takes: texts(requirements.takes), decisions: texts(requirements.decisions) },
    continuity: { entry: text(continuity.entry, 1000), exit: text(continuity.exit, 1000) },
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
  const assets = new Set(context.assetKeys)
  for (const object of treatment.objects) {
    if (!object.entity || !object.role) problems.push('each object needs the entity it plays and its role')
    if (!object.performance) warnings.push(`object ${object.entity} has no performance — does it do explanatory work beyond appearing?`)
    if (object.asset.status === 'reuse' && (!object.asset.ref || !assets.has(object.asset.ref))) {
      problems.push(`object ${object.entity} reuses asset "${object.asset.ref || ''}", which is not in the accepted asset library`)
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

  return { ok: problems.length === 0, problems, warnings, constructionRisks, treatment }
}

// The channels a plan actually uses, for the workspace's lanes.
export const channelsOf = (moment: TreatmentMoment): TreatmentChannel[] =>
  TREATMENT_CHANNELS.filter(channel => Boolean(moment[channel]))
