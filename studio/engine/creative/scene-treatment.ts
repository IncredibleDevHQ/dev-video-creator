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
import { findCapability, type CapabilityKind } from './capability-catalog'

import { presenceProblems, showsTitle } from '../planning/presence'

import {
  TREATMENT_SCHEMA_VERSION,
  TREATMENT_CHANNELS,
  RECIPE_SOURCES,
  TreatmentMoment,
  TreatmentLedger,
  CONTINUITY_KINDS,
  ContinuitySide,
  SceneTreatmentV1,
  TreatmentContext,
  NeighborPlan,
  TreatmentReport
} from './treatment-model'
import { normalizeTreatment } from './treatment-normalize'

/** A moment's picture develops at least this often, as its voice does. */
const SECONDS_PER_BEAT = 4
export * from './treatment-model'
export { normalizeTreatment } from './treatment-normalize'
const duplicates = (values: string[]) => [
  ...new Set(values.filter((value, index) => values.indexOf(value) !== index))
]

const whole = (value: number) => Number.isInteger(value) && value >= 0

// Replays a ledger in moment order: every stated count must be the count.
export const ledgerProblems = (
  ledger: TreatmentLedger,
  momentIds: string[]
) => {
  const problems: string[] = []
  const label = `ledger (${ledger.quantity || 'no quantity named'})`
  if (!ledger.quantity)
    problems.push('ledger.quantity must say what is counted')
  if (!whole(ledger.initial))
    problems.push(`${label}: initial must be a whole number`)
  if (
    ledger.capacity !== null &&
    (!whole(ledger.capacity) ||
      (whole(ledger.initial) && ledger.capacity < ledger.initial))
  ) {
    problems.push(
      `${label}: a capacity of ${ledger.capacity} cannot hold the initial ${ledger.initial}`
    )
  }
  if (!ledger.events.length)
    problems.push(
      `${label}: events is empty — a counted demonstration changes the count`
    )
  const rates = ledger.rates || []
  const rateIds = rates.map((rate) => rate.id)
  for (const id of rateIds.filter(
    (value, index) => rateIds.indexOf(value) !== index
  ))
    problems.push(`${label}: rate "${id}" is declared twice`)
  for (const rate of rates) {
    const where = `${label} rate ${rate.id || '?'}`
    if (!rate.id) problems.push(`${label}: every rate needs an id`)
    if (rate.change !== 'add' && rate.change !== 'consume')
      problems.push(`${where}: change must be add or consume`)
    if (!whole(rate.amount) || rate.amount === 0)
      problems.push(`${where}: amount must be a whole number above 0`)
    if (rate.id && !ledger.events.some((event) => event.rate === rate.id))
      problems.push(
        `${where} makes none of the changes — tag the events it makes with its id, or remove it`
      )
  }
  let count = whole(ledger.initial) ? ledger.initial : 0
  let latest = -1
  ledger.events.forEach((event, index) => {
    const where = `${label} event ${index + 1}${event.what ? ` ("${event.what}")` : ''}`
    const at = momentIds.indexOf(event.moment)
    if (at < 0)
      problems.push(
        `${where} happens in moment "${event.moment}", which is not a moment of this plan`
      )
    else if (at < latest)
      problems.push(
        `${where} is listed after an event of a later moment — list events in the order they happen`
      )
    else latest = at
    if (event.rate) {
      const rate = rates.find((entry) => entry.id === event.rate)
      if (!rate)
        problems.push(
          `${where} is made by rate "${event.rate}", which the ledger does not declare`
        )
      else if (rate.change !== event.change || rate.amount !== event.amount)
        problems.push(
          `${where} is made by rate ${rate.id}, which ${rate.change === 'add' ? 'adds' : 'consumes'} ${rate.amount} each time`
        )
    }
    if (event.change === 'refuse') {
      const needs = event.needs ?? 1
      if (event.amount !== 0)
        problems.push(
          `${where}: a refused request consumes nothing — its amount is 0`
        )
      if (count >= needs)
        problems.push(
          `${where} is refused while ${count} remain — with that supply it would be admitted`
        )
    } else if (event.change === 'add' || event.change === 'consume') {
      if (!whole(event.amount) || event.amount === 0)
        problems.push(`${where}: amount must be a whole number above 0`)
      else if (event.change === 'add') {
        if (ledger.capacity !== null && count + event.amount > ledger.capacity)
          problems.push(
            `${where} adds ${event.amount} to ${count}, past the capacity of ${ledger.capacity}`
          )
        count =
          ledger.capacity !== null
            ? Math.min(ledger.capacity, count + event.amount)
            : count + event.amount
      } else {
        if (event.amount > count)
          problems.push(
            `${where} consumes ${event.amount} while only ${count} remain — it would be refused`
          )
        count = Math.max(0, count - event.amount)
      }
    } else {
      problems.push(`${where}: change must be add, consume or refuse`)
    }
    if (event.after !== count)
      problems.push(
        `${where} says ${Number.isFinite(event.after) ? event.after : 'nothing'} remain after it, but the count is ${count}`
      )
  })
  if (ledger.final !== count)
    problems.push(
      `${label}: final is ${Number.isFinite(ledger.final) ? ledger.final : 'missing'}, but the events leave ${count}`
    )
  return problems
}

// Does the plan count things without a ledger? Numbers of countable things
// in the demonstration or the moments' visible changes.
const COUNTED =
  /\b(\d+)\s+(?:[a-z-]+\s+)?(tokens?|slots?|requests?|calls?|retries|items?|jobs?|connections?|workers?|messages?|packets?|credits?|permits?|seats?|tickets?|units?)\b/gi
const countedMentions = (treatment: SceneTreatmentV1) =>
  [
    treatment.demonstration?.text || '',
    ...(treatment.demonstration?.values.map((value) => value.value) || []),
    ...treatment.moments.flatMap((moment) => [
      moment.objects?.change || '',
      moment.observation
    ])
  ].flatMap((value) =>
    [...value.matchAll(COUNTED)].map((match) => match[0].toLowerCase())
  )

// Where each seam stands now: an agreement holds only while the neighbour's
// reviewed plan is the one it was made with.
export type ContinuityState = {
  side: 'incoming' | 'outgoing'
  kind: ContinuitySide['kind'] | 'unstated'
  scene: string | null
  state: 'self-contained' | 'agreed' | 'broken' | 'proposed' | 'unstated'
  reason: string | null
}
export const continuityStatus = (
  treatment: SceneTreatmentV1,
  neighbors: NeighborPlan[]
): ContinuityState[] =>
  (['incoming', 'outgoing'] as const).map((side) => {
    const stated = treatment.continuity[side]
    const neighbor =
      neighbors.find(
        (entry) => entry.position === (side === 'incoming' ? 'before' : 'after')
      ) || null
    const scene = stated?.scene || neighbor?.scene || null
    if (
      !stated ||
      !(CONTINUITY_KINDS as readonly string[]).includes(stated.kind)
    )
      return {
        side,
        kind: 'unstated',
        scene,
        state: 'unstated',
        reason: 'The plan does not say how this side meets its neighbour.'
      }
    if (stated.kind === 'self-contained')
      return {
        side,
        kind: stated.kind,
        scene: null,
        state: 'self-contained',
        reason: null
      }
    if (stated.kind === 'proposed')
      return {
        side,
        kind: stated.kind,
        scene,
        state: 'proposed',
        reason: `Provisional until ${scene || 'the neighbour'} agrees.`
      }
    const holds = Boolean(
      neighbor?.reviewed &&
      neighbor.reviewed.recordId === stated.record &&
      neighbor.reviewed.revision === stated.revision
    )
    return {
      side,
      kind: stated.kind,
      scene,
      state: holds ? 'agreed' : 'broken',
      reason: holds
        ? null
        : neighbor?.reviewed
          ? `${scene}'s reviewed plan changed since this seam was agreed.`
          : `${scene} no longer has the reviewed plan this seam was agreed with.`
    }
  })

// Selectors and frame timing belong to construction; a plan that states them
// pretends to precision it does not have.
const EXECUTION_DETAIL =
  /(^|[\s(])[#.][a-z][\w-]*\s*\{|querySelector|\bdata-[a-z-]+=|\b\d+\s*ms\b|\bframe\s+\d+\b/i

export const validateTreatment = (
  raw: unknown,
  context: TreatmentContext
): TreatmentReport => {
  const treatment = normalizeTreatment(raw)
  const problems: string[] = []
  const warnings: string[] = []
  const constructionRisks: string[] = []
  const { brief } = context

  if (treatment.schemaVersion !== TREATMENT_SCHEMA_VERSION)
    problems.push(`schemaVersion must be ${TREATMENT_SCHEMA_VERSION}`)
  if (treatment.scene !== context.scene)
    problems.push(
      `scene is "${treatment.scene}", but this plan is for "${context.scene}"`
    )
  for (const origin of treatment.originScenes) {
    if (!context.originScenes.includes(origin))
      problems.push(
        `originScenes names "${origin}", which this scene does not come from — propose a roster change instead`
      )
  }

  // What it explains, grounded in the brief.
  const unitById = new Map(brief.units.map((unit) => [unit.id, unit]))
  const evidence = new Set(brief.evidence.map((entry) => entry.id))
  const coversNothing = context.originScenes.every((origin) => {
    const entry = brief.coverage.find((candidate) => candidate.scene === origin)
    return entry ? !entry.units.length : false
  })
  if (!treatment.units.length && !coversNothing)
    problems.push(
      'units is empty — say which explanation units of the brief this scene develops'
    )
  for (const unit of treatment.units)
    if (!unitById.has(unit))
      problems.push(`units names "${unit}", which is not a unit of the brief`)
  if (!treatment.question) problems.push('question is missing')
  if (!treatment.takeaway) problems.push('takeaway is missing')
  if (!treatment.development)
    problems.push(
      'development is missing — how does the idea unfold, beyond reciting the slide?'
    )
  for (const ref of treatment.evidenceRefs)
    if (!evidence.has(ref))
      problems.push(
        `evidenceRefs cites "${ref}", which the brief does not contain`
      )
  if (treatment.demonstration) {
    for (const value of treatment.demonstration.values) {
      if (
        !['source', 'creator', 'illustrative'].includes(String(value.basis))
      ) {
        problems.push(
          `demonstration value "${value.value}" must say whether it is from the source, from the creator, or illustrative`
        )
      }
    }
    // A concrete example is whole or it is not one (Q01).
    const example = treatment.demonstration.example
    const missing = example
      ? (['before', 'action', 'after', 'observed'] as const).filter(
          (key) => !example[key]
        )
      : []
    if (missing.length)
      problems.push(
        `demonstration.example has no ${missing.join(', ')}: a concrete example gives the value before, the operation, the value after, and what someone then sees`
      )
  }

  // Moments: each one earns its place, and develops as it is said.
  if (!treatment.moments.length) problems.push('the plan has no moments')
  const momentIds = treatment.moments.map((moment) => moment.id)
  for (const id of duplicates(momentIds))
    problems.push(`moment id "${id}" is used twice`)
  const entityIds = new Set([
    ...brief.entities.map((entity) => entity.id),
    ...treatment.objects.map((object) => object.entity)
  ])
  const channelCount = (moment: TreatmentMoment) =>
    [
      moment.narration,
      moment.objects,
      moment.text,
      moment.presenter,
      moment.camera,
      moment.audio
    ].filter(Boolean).length
  for (const moment of treatment.moments) {
    const where = `moment ${moment.id || '?'}`
    if (!moment.id) problems.push('a moment has no id')
    if (!moment.purpose)
      problems.push(`${where} does not say why the viewer needs to see it`)
    if (!moment.observation)
      problems.push(`${where} does not say what the viewer should notice`)
    if (!moment.attention)
      problems.push(`${where} has no primary attention target`)
    if (!channelCount(moment))
      problems.push(
        `${where} has no channel — something must be heard, seen or read`
      )
    // A moment develops as its voice does, not in one change and a hold
    // (seen live: 64–80% of each scene one still frame).
    const needed = moment.objects
      ? Math.floor((moment.estimateSeconds || 0) / SECONDS_PER_BEAT)
      : 0
    const beats = (moment.objects?.beats || []).filter(
      (beat) => beat?.on?.trim() && beat?.change?.trim()
    )
    if (needed >= 2 && beats.length < needed)
      problems.push(
        `${where} develops in ${beats.length === 1 ? 'one beat' : `${beats.length} beats`} over about ${moment.estimateSeconds} s: give objects.beats, one visible change for each idea its voice reaches (at least one every ${SECONDS_PER_BEAT} s), in the order it says them`
      )
    for (const actor of moment.objects?.actors || [])
      if (!entityIds.has(actor))
        problems.push(
          `${where} moves "${actor}", which is neither a brief entity nor one of the plan's objects`
        )
    for (const ref of moment.evidenceRefs)
      if (!evidence.has(ref))
        problems.push(
          `${where} cites "${ref}", which the brief does not contain`
        )
    for (const recipe of moment.recipes) {
      const label = `${where} recipe "${recipe.id}"`
      if (!recipe.id || !recipe.purpose)
        problems.push(`${label} needs an id and a purpose`)
      if (
        !(RECIPE_SOURCES as readonly string[]).includes(String(recipe.catalog))
      ) {
        problems.push(
          `${label} must say where it comes from: ${RECIPE_SOURCES.join(', ')}`
        )
        continue
      }
      if (
        !(TREATMENT_CHANNELS as readonly string[]).includes(
          String(recipe.channel)
        )
      )
        problems.push(
          `${label} must name the channel it serves: ${TREATMENT_CHANNELS.join(', ')}`
        )
      if (
        recipe.catalog === 'rule' ||
        recipe.catalog === 'blueprint' ||
        recipe.catalog === 'technique' ||
        recipe.catalog === 'component' ||
        recipe.catalog === 'block'
      ) {
        const entry = findCapability(
          context.catalog,
          recipe.catalog as CapabilityKind,
          recipe.id
        )
        if (!entry)
          problems.push(
            `${label} is not a ${recipe.catalog} in the pinned catalog — name a catalogued one, or mark it adapted and describe it`
          )
        else if (!entry.verifiedInInstalledRuntime)
          constructionRisks.push(
            `${recipe.catalog} "${recipe.id}" is catalogued but not yet proven in the installed runtime`
          )
      } else if (recipe.catalog === 'reference') {
        if (!context.bundleReferences.includes(recipe.id))
          problems.push(`${label} is not a reference file of the pinned bundle`)
      } else {
        constructionRisks.push(
          `adapted recipe "${recipe.id}" (${recipe.purpose || 'no purpose given'}) must be built and verified at construction`
        )
      }
    }
    for (const field of [
      moment.narration?.guide,
      moment.objects?.change,
      moment.camera?.treatment
    ]) {
      if (field && EXECUTION_DETAIL.test(field))
        warnings.push(
          `${where} states execution detail (selectors or exact timing) that a plan cannot yet know`
        )
    }
  }
  const estimates = treatment.moments
    .map((moment) => moment.estimateSeconds)
    .filter((value): value is number => value !== null)
  if (
    estimates.length &&
    brief.purpose.requestedSeconds &&
    estimates.reduce((sum, value) => sum + value, 0) >
      brief.purpose.requestedSeconds
  ) {
    warnings.push(
      "the moment estimates alone exceed the whole video's requested length"
    )
  }

  // Objects: what each does, and whether an asset exists for it.
  const cast = new Set(treatment.objects.map((object) => object.entity))
  for (const actor of new Set(
    treatment.moments.flatMap((moment) => moment.objects?.actors || [])
  )) {
    if (entityIds.has(actor) && !cast.has(actor))
      warnings.push(
        `"${actor}" moves in a moment but is not cast among the plan's objects, so its look and asset are undecided`
      )
  }
  const assets = new Set(context.assetKeys)
  const moveActors = new Set(
    treatment.moments.flatMap((moment) => moment.objects?.actors || [])
  )
  const partOwners = new Map<string, string>()
  for (const object of treatment.objects) {
    if (!object.entity || !object.role)
      problems.push('each object needs the entity it plays and its role')
    if (!object.performance)
      warnings.push(
        `object ${object.entity} has no performance — does it do explanatory work beyond appearing?`
      )
    const decision = object.asset.status
    if (
      (decision === 'reuse' || decision === 'adapt' || decision === 'enrich') &&
      (!object.asset.ref || !assets.has(object.asset.ref))
    ) {
      problems.push(
        `object ${object.entity} ${decision === 'reuse' ? 'reuses' : decision === 'adapt' ? 'adapts' : 'enriches'} asset "${object.asset.ref || ''}", which is not in the accepted asset library`
      )
    }
    if (decision !== 'undecided' && !object.asset.reason)
      warnings.push(
        `object ${object.entity}: say why "${decision}" serves what the viewer needs to understand`
      )
    if (decision === 'omit' && moveActors.has(object.entity))
      problems.push(`object ${object.entity} is omitted, but a moment moves it`)
    // Drawn artwork separates the parts the scene moves, by these ids.
    if (
      context.drawsArtwork &&
      (decision === 'generate' || decision === 'enrich')
    ) {
      const ids = (object.parts || []).map((part) => part.id)
      if (!ids.length)
        problems.push(
          `object ${object.entity} is drawn for the scene: name the parts its moments move in parts, so the drawing separates them`
        )
      for (const id of ids.filter(
        (value, index) => ids.indexOf(value) !== index
      ))
        problems.push(`object ${object.entity} names part "${id}" twice`)
      for (const id of ids.filter((value) => !/^[a-z][a-z0-9-]*$/.test(value)))
        problems.push(
          `object ${object.entity} part "${id}" must be a lowercase id (letters, digits, hyphens)`
        )
      // Each pose is drawn by an edit of the drawing: a few, plainly named.
      const poses = (object.poses || []).map((pose) => pose.id)
      if (poses.length > 3)
        problems.push(
          `object ${object.entity} names ${poses.length} poses: keep the three its moments need most`
        )
      for (const id of poses.filter(
        (value, index) => poses.indexOf(value) !== index
      ))
        problems.push(`object ${object.entity} names pose "${id}" twice`)
      for (const id of poses.filter(
        (value) => !/^[a-z][a-z0-9-]*$/.test(value)
      ))
        problems.push(
          `object ${object.entity} pose "${id}" must be a lowercase id (letters, digits, hyphens)`
        )
      if (poses.includes('rest'))
        problems.push(
          `object ${object.entity} names a pose "rest", which is the drawing as drawn: name the pose for the state it shows`
        )
      // The drawings share one page, so a part id names one part in it.
      for (const id of new Set(ids)) {
        const owner = partOwners.get(id)
        if (owner)
          problems.push(
            `part "${id}" is named by both ${owner} and ${object.entity}: give each drawn part its own id`
          )
        else partOwners.set(id, object.entity)
      }
    }
  }
  // Every object on the scene's page gets a decision, so a designed slide's
  // artwork is never dropped without one.
  const decided = new Set(
    treatment.objects
      .filter(
        (object) => object.asset.status !== 'undecided' && object.asset.ref
      )
      .map((object) => object.asset.ref!)
  )
  const undecided = (context.pageObjects || []).filter(
    (entry) => !decided.has(entry.key)
  )
  if (undecided.length) {
    const one = undecided.length === 1
    const message = `the ${context.pageKind === 'designed' ? 'designed slide' : 'page'}'s ${undecided.map((entry) => `${entry.label} (${entry.key})`).join(', ')} ${one ? 'has' : 'have'} no decision: in objects, use, adapt or replace ${one ? 'it' : 'each'}, or omit ${one ? 'it' : 'those the scene does not need'} (asset.status "omit" with ${one ? 'its' : 'their'} key as asset.ref) — each with why`
    if (context.pageKind === 'designed') problems.push(message)
    else warnings.push(message)
  }

  // The demonstration's arithmetic (R7).
  if (treatment.ledger)
    problems.push(...ledgerProblems(treatment.ledger, momentIds))
  else {
    const counted = [...new Set(countedMentions(treatment))]
    if (counted.length >= 2) {
      warnings.push(
        `the demonstration counts (${counted.slice(0, 4).join(', ')}) but has no ledger — add one so its arithmetic is checked`
      )
    }
  }

  // Continuity (R8): each side says whether it needs its neighbour, and an
  // agreement rests on the neighbour's reviewed plan, recorded here.
  const neighbors = context.neighbors || []
  for (const side of ['incoming', 'outgoing'] as const) {
    const stated = treatment.continuity[side]
    const position = side === 'incoming' ? 'before' : 'after'
    const neighbor =
      neighbors.find((entry) => entry.position === position) || null
    const label = `continuity.${side}`
    if (!(CONTINUITY_KINDS as readonly string[]).includes(stated.kind)) {
      problems.push(
        `${label} must say whether the ${side === 'incoming' ? 'opening' : 'ending'} is self-contained, agreed with a reviewed neighbour, or proposed`
      )
      continue
    }
    if (stated.kind === 'self-contained') continue
    if (!neighbor) {
      problems.push(
        `${label} is ${stated.kind}, but no scene comes ${position} this one`
      )
      continue
    }
    if (stated.scene && stated.scene !== neighbor.scene)
      problems.push(
        `${label} names "${stated.scene}", but the scene ${position} this one is "${neighbor.scene}"`
      )
    stated.scene = neighbor.scene
    if (stated.kind === 'agreed') {
      if (!neighbor.reviewed) {
        problems.push(
          `${label} is agreed, but ${neighbor.scene} has no reviewed plan to agree with — open self-contained, or mark the seam proposed`
        )
      } else if (
        stated.revision !== undefined &&
        stated.revision !== neighbor.reviewed.revision
      ) {
        problems.push(
          `${label} agrees with revision ${stated.revision} of ${neighbor.scene}, but its reviewed plan is revision ${neighbor.reviewed.revision}`
        )
      } else {
        // The agreement is the check's record, not the harness's claim.
        stated.record = neighbor.reviewed.recordId
        stated.revision = neighbor.reviewed.revision
      }
    } else {
      warnings.push(
        `${label} proposes a seam with ${neighbor.scene} that its plan has not promised — it stays provisional until both sides agree`
      )
    }
  }

  // Skills: which pinned guidance shaped the plan, and why.
  if (!treatment.skills.length)
    problems.push(
      'skills is empty — name the pinned Hyperframes skills that shaped this plan and why'
    )
  for (const skill of treatment.skills) {
    if (!context.bundleSkills.includes(skill.skill))
      problems.push(
        `skills names "${skill.skill}", which is not in the pinned bundle`
      )
    if (!skill.why) problems.push(`skill "${skill.skill}" gives no reason`)
    for (const reference of skill.references)
      if (!context.bundleReferences.includes(reference))
        problems.push(
          `skill "${skill.skill}" cites "${reference}", which is not a file of the pinned bundle`
        )
  }

  // Coverage: every communication need of the units it takes on.
  for (const unitId of treatment.units) {
    const unit = unitById.get(unitId)
    if (!unit) continue
    for (const need of unit.communicationNeeds) {
      const entry = treatment.coverage.find(
        (candidate) => candidate.unit === unitId && candidate.need === need.need
      )
      if (!entry) {
        problems.push(
          `coverage does not say how "${need.need}" (${unitId}) is met — name the moments, or defer it with a reason`
        )
        continue
      }
      if (!entry.moments.length && !entry.deferred)
        problems.push(
          `coverage for "${need.need}" names no moment and gives no deferral reason`
        )
      for (const moment of entry.moments)
        if (!momentIds.includes(moment))
          problems.push(
            `coverage for "${need.need}" names "${moment}", which is not a moment`
          )
    }
  }

  // Delivery: a plan may suggest, never decide for the creator.
  if (context.delivery === null && treatment.delivery.voice !== 'undecided') {
    problems.push(
      `delivery.voice is "${treatment.delivery.voice}", but the creator has not chosen a delivery for this scene — keep it undecided and put the suggestion in the note`
    )
  }
  if (
    context.delivery !== null &&
    treatment.delivery.voice !== context.delivery
  ) {
    problems.push(
      `delivery.voice must be the creator's choice, "${context.delivery}"`
    )
  }
  // On camera (R07 of the projects-first rereview): once the creator has
  // decided presence, it says where the presenter is, whoever speaks; until
  // then a generated-only scene reserves no presenter space.
  if (context.presence)
    problems.push(...presenceProblems(treatment.moments, context.presence))
  else if (
    context.delivery === 'generated' &&
    treatment.moments.some(
      (moment) => moment.presenter && moment.presenter.visibility !== 'hidden'
    )
  ) {
    problems.push(
      'this scene is generated-only: it reserves no presenter space, so no moment may show a presenter'
    )
  }
  // The video's opening shows the video's actual title, readable (R09).
  if (
    context.intro?.title &&
    !showsTitle(treatment.moments, context.intro.title)
  ) {
    problems.push(
      `this is the video's opening scene: show its title, "${context.intro.title}", as on-screen text in its first or second moment (text.role "exact"), held long enough to read, with the presenter and the graphics composed around it`
    )
  }

  // Roster: a proposal names real scenes and a reason.
  if (treatment.rosterProposal) {
    for (const scene of treatment.rosterProposal.scenes)
      if (!context.videoScenes.includes(scene))
        problems.push(
          `rosterProposal names "${scene}", which is not a scene of this video`
        )
    if (!treatment.rosterProposal.reason)
      problems.push('rosterProposal gives no reason')
  }

  // A recipe several moments share is one risk, reported once.
  return {
    ok: problems.length === 0,
    problems,
    warnings: [...new Set(warnings)],
    constructionRisks: [...new Set(constructionRisks)],
    treatment
  }
}

// The channels a plan actually uses, for the workspace's lanes.
