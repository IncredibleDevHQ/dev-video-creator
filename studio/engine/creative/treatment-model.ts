import type { CapabilityCatalog, CapabilityKind } from './capability-catalog'
import type { ExplanationBriefV1 } from './explanation-brief'
import type { Presence } from '../planning/presence'
export const TREATMENT_SCHEMA_VERSION = 1 as const

export const TREATMENT_CHANNELS = [
  'narration',
  'objects',
  'text',
  'presenter',
  'camera',
  'audio'
] as const
export type TreatmentChannel = (typeof TREATMENT_CHANNELS)[number]

export const RECIPE_SOURCES = [
  'rule',
  'blueprint',
  'technique',
  'reference',
  'adapted'
] as const
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
  text: {
    content: string
    role: 'term' | 'label' | 'exact' | 'code' | 'takeaway'
  } | null
  presenter: {
    visibility: 'full' | 'shared' | 'hidden' | 'undecided'
    reason: string
  } | null
  camera: { treatment: string; subject: string; reason: string } | null
  audio: { cue: string; reason: string } | null
  attention: string
  recipes: TreatmentRecipe[]
  evidenceRefs: string[]
  // A rough length, only ever an estimate before audio exists.
  estimateSeconds: number | null
}

// The least time a moment in which something visibly changes needs on
// screen (Q02 of the BoltDB review): its objects change, or the camera
// moves. It keeps three quarters of the time its plan estimated for it —
// the change prepared, made and taken in — however quickly its line is
// said; a moment where nothing changes needs no more than its words.
export const visualMinimumOf = (
  moment: Pick<TreatmentMoment, 'objects' | 'camera' | 'estimateSeconds'>
) => {
  const changes =
    Boolean(moment.objects?.change?.trim()) ||
    Boolean(
      moment.camera &&
      !/^(hold|still|static|stay|none)\b/i.test(moment.camera.treatment.trim())
    )
  return changes && moment.estimateSeconds
    ? Math.round(moment.estimateSeconds * 0.75 * 10) / 10
    : 0
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
  // The steady process that makes this change, when one does (a refill).
  rate?: string
}
// A change the mechanism makes by itself at a steady pace — a refill, a
// leak. The events it makes carry its id; a sketch gives it a period and
// must keep to it (R11 of the scene-review review).
export type LedgerRate = {
  id: string
  what: string
  change: 'add' | 'consume'
  amount: number
}
export type TreatmentLedger = {
  quantity: string
  capacity: number | null
  initial: number
  rates?: LedgerRate[]
  events: LedgerEvent[]
  final: number
}

// One small concrete example (Q01 of the project-flow fix verification): a
// scene that explains how state changes shows a case with real values —
// what was there, the operation, what changed, what stayed as it was, and
// what someone then sees — so the viewer need not infer why the mechanism
// matters. What it leads to that belongs to another scene is named so.
export type TreatmentExample = {
  before: string
  action: string
  after: string
  unchanged: string | null
  observed: string
  later: string | null
}
export const exampleLineOf = (example: TreatmentExample) =>
  [example.before, example.action, example.observed].filter(Boolean).join(' → ')

// How one side of the scene meets its neighbour (R8). self-contained: needs
// nothing from it. agreed: rests on the neighbour's reviewed plan — the
// product records which revision, and the agreement breaks when that plan
// changes. proposed: asks for a boundary the neighbour has not promised; it
// stays provisional until both sides agree.
export const CONTINUITY_KINDS = [
  'self-contained',
  'agreed',
  'proposed'
] as const
export type ContinuitySide = {
  kind: (typeof CONTINUITY_KINDS)[number]
  scene?: string
  record?: string
  revision?: number
  note?: string
}

export const ASSET_DECISIONS = [
  'reuse',
  'adapt',
  'enrich',
  'native',
  'generate',
  'omit',
  'undecided'
] as const
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
  demonstration: {
    text: string
    values: Array<{
      value: string
      basis: 'source' | 'creator' | 'illustrative'
    }>
    example?: TreatmentExample
  } | null
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
  continuity: {
    entry: string
    exit: string
    incoming: ContinuitySide
    outgoing: ContinuitySide
  }
  unresolved: string[]
  coverage: Array<{
    unit: string
    need: string
    moments: string[]
    deferred?: string
  }>
  rosterProposal: {
    action: 'split' | 'merge' | 'resequence'
    scenes: string[]
    reason: string
  } | null
  delivery: {
    voice: 'human' | 'generated' | 'silent' | 'undecided'
    note: string
  }
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
  // On camera, once decided for the scene or its video (R07 of the
  // projects-first rereview): the plan puts the presenter where it says.
  presence?: Presence | null
  // The video's opening scene, with the title it shows (R09).
  intro?: { title: string } | null
  assetKeys: string[]
  // The verified objects of the scene's own page, by library key, and what
  // that page is. Each object is decided (used, adapted, replaced or
  // omitted); on a designed slide a plan that leaves one undecided is refused.
  pageObjects?: Array<{ key: string; label: string }>
  pageKind?: string
  // The adjacent video scenes and their reviewed plans now, when they have
  // one: what an agreed seam can rest on.
  neighbors?: NeighborPlan[]
}

export type NeighborPlan = {
  position: 'before' | 'after'
  scene: string
  reviewed: {
    recordId: string
    revision: number
    entry: string
    exit: string
  } | null
}

export type TreatmentReport = {
  ok: boolean
  problems: string[]
  warnings: string[]
  // What construction will have to prove: adapted or not-yet-verified recipes.
  constructionRisks: string[]
  treatment: SceneTreatmentV1
}

export const channelsOf = (moment: TreatmentMoment): TreatmentChannel[] =>
  TREATMENT_CHANNELS.filter((channel) => Boolean(moment[channel]))
