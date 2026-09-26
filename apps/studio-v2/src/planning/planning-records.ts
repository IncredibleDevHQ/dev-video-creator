// Durable planning records and the states a creator sees.
//
// A video notebook's Explanation Brief and each scene's creative plan are
// versioned records. A record is queued, runs on the local harness, and ends
// ready (a brief), as a candidate (a plan), or failed. A creator marks a
// candidate reviewed; reviewing never starts any generation.
//
// Every record pins the inputs it was made from and keeps the fingerprint of
// the ones it depends on. Freshness runs down one chain — retained inputs →
// brief → scene plan — and the same check decides what the workspace shows,
// what may be queued, which late result may land and what may be reviewed.
// A stale result stays readable but never becomes current or reviewed. A
// newer run supersedes an older one for the same subject; the last reviewed
// plan stays in place while a new candidate runs or fails.
import type { ClaimFlag } from './claim-scope'
import { fingerprintOf, stableJson } from './fingerprint'
import type { ExplanationBriefV1 } from './explanation-brief'
import type { SceneTreatmentV1 } from './scene-treatment'
import type { SketchManifest, SketchProof } from './sketch-bundle'
import type { ProductionManifest } from './production-bundle'

// brief: the video's explanation brief · treatment: a scene's creative plan ·
// preview: a rough, seekable sketch of one plan revision (P3) · production:
// the scene produced from its approved plan, on its real clock (P4).
export type PlanningKind = 'brief' | 'treatment' | 'preview' | 'production'

// verifying: a sketch the harness submitted, being played in the pinned
// player before it can read ready (a preview only).
export const PLANNING_STATUSES = ['queued', 'running', 'verifying', 'ready', 'candidate', 'reviewed', 'failed', 'superseded'] as const
export type PlanningStatus = (typeof PLANNING_STATUSES)[number]

// Statuses a record can still move from: it has not produced a result.
export const ACTIVE_STATUSES: readonly PlanningStatus[] = ['queued', 'running', 'verifying']
export const isActiveStatus = (status: PlanningStatus | string | null | undefined) => (ACTIVE_STATUSES as readonly string[]).includes(String(status))

export type SkillBundleRef = { name: string; version: string; hash: string; upstreamCommit: string }

// The faces a production's type is set in, the same on the stage and in its
// render (B11 of the BoltDB review): a generic family set first, and the
// face put ahead of it; faces that could not be had.
export type TypeFaces = { faces: string[]; substituted: Record<string, string>; unresolved: string[] }

export type PlanningRecord = {
  id: string
  kind: PlanningKind
  projectId: string
  // The scene a plan is for; empty for the notebook-wide brief.
  subject: string
  revision: number
  status: PlanningStatus
  fingerprint: string
  // The pinned references the record was made from.
  inputs: Record<string, unknown>
  content: ExplanationBriefV1 | SceneTreatmentV1 | SketchManifest | ProductionManifest | null
  // What the checks said: warnings, construction risks.
  report: { warnings: string[]; constructionRisks?: string[]; verification?: SketchProof; type?: TypeFaces; claims?: ClaimFlag[] } | null
  artifacts: { objectKey: string; assetId: string } | null
  // The run that owns the record once it starts; nothing else may claim it.
  runId: string | null
  adapter: string | null
  // The model the run asked for, and the one its harness session reported.
  model: string | null
  reportedModel: string | null
  skillBundle: SkillBundleRef | null
  workflow: string | null
  direction: string
  // Why it failed: what happened, the provider's own last status, its
  // category (quota, auth, model, …) and the ways on.
  error: { message: string; providerStatus?: string; category?: string; recovery?: string[] } | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  // Set when the creator approves the plan (P2): what it was approved with.
  approval: PlanApproval | null
  // How the run went as the product saw it (U3 of the scene workspace plan).
  progress?: PlanningProgress | null
}

// Where a run stands, as the product confirmed it — never guessed from what
// the harness says it is reading: the run claimed its record (started), read
// its packet and contract (context), published a section of its plan as a
// draft (draft), handed its result in (submitted), which the product refused
// with problems to fix (refused) or accepted; a sketch or production is then
// played in the pinned player (checking). A stop or a failure ends it.
export type ProgressMilestone = 'started' | 'context' | 'draft' | 'submitted' | 'refused' | 'checking' | 'accepted' | 'stopped' | 'failed'
export type ProgressEvent = { seq: number; at: string; milestone: ProgressMilestone; section?: 'explanation' | 'moments'; count?: number; note?: string }
// A scene plan's sections as its run published them: complete, checked plain
// text, shown as a draft still being checked until the plan is accepted.
export type PlanDraft = { question?: string; takeaway?: string; moments?: Array<{ id: string; title: string; summary: string }>; at: string }
export type PlanningProgress = { events: ProgressEvent[]; draft: PlanDraft | null }

// The pin an approval records: the plan's own inputs and what they came
// from. Approval is a decision about direction; it starts nothing.
export type PlanApproval = {
  at: string
  fingerprint: string
  briefId: string
  briefFingerprint: string
  castId: string | null
  // A production's acceptance (P4): the render of the accepted bundle the
  // notebook plays and exports, and the bundle it was rendered from.
  // The creator's edit revision and values it was rendered with (P6).
  render?: { assetId: string; objectKey: string; durationMs: number; bundle: string; edits?: { revision: number; values: Record<string, number> } }
}

// Version of the dependency rules below; a record made under older rules
// reads as stale with that reason, once.
export const PLANNING_SCHEMA = 2

// What a brief pins. Not all of it is a dependency: see briefDependencies.
export type BriefInputs = {
  schema: number
  baseNotebook: string
  baseRevision: string
  sourceRevision: string | null
  narrativeRevision: string | null
  modelRevision: string | null
  wordingPolicy: string
  // The words the scenes speak now, so a script edit is a new input.
  scripts: Array<{ scene: string; text: string }>
  themeRef: string | null
  requestedSeconds: number | null
  videoDirection: string
  sceneDecisions: Array<{ scene: string; voice: string }>
  bundleHash: string
}

// What one scene's plan pins.
export type TreatmentInputs = {
  schema: number
  briefId: string
  briefFingerprint: string
  scene: string
  originScenes: string[]
  direction: string
  videoDirection: string
  themeRef: string | null
  delivery: string | null
  bundleHash: string
  script: string
  // The base pages the scene adopted since the fork (F1 of the Perplexity
  // review), when it adopted any.
  reference?: string
}

// What a brief depends on: the source and the creator's narrative and
// intent for the whole video. A scene's words, theme and delivery belong to
// that scene's plan, so changing one scene never makes the brief — and with
// it every scene — stale. Preserved wording is the brief's own content.
export const briefDependencies = (inputs: Record<string, unknown>) => ({
  schema: Number(inputs.schema || 1),
  baseNotebook: inputs.baseNotebook ?? null,
  baseRevision: inputs.baseRevision ?? null,
  sourceRevision: inputs.sourceRevision ?? null,
  narrativeRevision: inputs.narrativeRevision ?? null,
  modelRevision: inputs.modelRevision ?? null,
  wordingPolicy: inputs.wordingPolicy ?? null,
  requestedSeconds: inputs.requestedSeconds ?? null,
  videoDirection: inputs.videoDirection ?? '',
  bundleHash: inputs.bundleHash ?? '',
  preservedScripts: inputs.wordingPolicy === 'preserve' ? inputs.scripts ?? [] : [],
})

// What a scene plan depends on: its brief and its own scene.
export const treatmentDependencies = (inputs: Record<string, unknown>) => ({
  schema: Number(inputs.schema || 1),
  briefId: inputs.briefId ?? null,
  scene: inputs.scene ?? null,
  originScenes: inputs.originScenes ?? [],
  direction: inputs.direction ?? '',
  videoDirection: inputs.videoDirection ?? '',
  themeRef: inputs.themeRef ?? null,
  delivery: inputs.delivery ?? null,
  bundleHash: inputs.bundleHash ?? '',
  script: inputs.script ?? '',
  // Only a scene that adopted a page pins one: every other plan's
  // fingerprint stays what it was.
  ...(inputs.reference ? { reference: inputs.reference } : {}),
})

export const briefFingerprint = (inputs: BriefInputs) => fingerprintOf({ kind: 'brief', ...briefDependencies(inputs) })

// What moved, in the creator's words, when a result no longer matches its
// inputs. A key missing from the labels is bookkeeping and never named.
const BRIEF_INPUT_LABELS: Record<string, string> = {
  schema: 'the planning rules',
  baseNotebook: 'the base notebook',
  baseRevision: 'the base it was forked from',
  sourceRevision: 'the retained source',
  narrativeRevision: 'the narrative',
  modelRevision: 'the story model',
  wordingPolicy: 'the wording policy',
  preservedScripts: 'the preserved wording',
  requestedSeconds: 'the requested length',
  videoDirection: 'the video direction',
  bundleHash: 'the planning skills',
}
const TREATMENT_INPUT_LABELS: Record<string, string> = {
  schema: 'the planning rules',
  originScenes: 'the scene\'s base pages',
  direction: 'the scene direction',
  videoDirection: 'the video direction',
  script: 'the scene\'s script',
  delivery: 'the scene\'s delivery',
  themeRef: 'the theme',
  bundleHash: 'the planning skills',
  reference: 'the scene\'s page reference',
}

export const changedInputs = (made: Record<string, unknown>, now: Record<string, unknown>, labels: Record<string, string>) =>
  Object.keys(labels).filter(key => stableJson(made[key] ?? null) !== stableJson(now[key] ?? null)).map(key => labels[key])

const sentence = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '')

export const treatmentFingerprint = (inputs: TreatmentInputs) => fingerprintOf({ kind: 'treatment', ...treatmentDependencies(inputs) })

// Whether a result may still be used, and if not, why — in the creator's words.
export type Freshness = { fresh: true; reason: null } | { fresh: false; reason: string }
const FRESH: Freshness = { fresh: true, reason: null }
const stale = (reason: string): Freshness => ({ fresh: false, reason })

// A brief (ready, or still running) against the inputs as they are now.
export const briefFreshness = (brief: PlanningRecord | null, now: BriefInputs): Freshness => {
  if (!brief) return stale('no explanation brief is ready')
  if (brief.fingerprint === briefFingerprint(now)) return FRESH
  const moved = changedInputs(briefDependencies(brief.inputs), briefDependencies(now), BRIEF_INPUT_LABELS)
  return stale(`${moved.length ? sentence(moved) : 'its inputs'} changed since it was made`)
}

// A scene plan against its brief and its scene as they are now. A plan made
// from a stale brief is stale too, whatever its own inputs say.
// The scene's script as a plan narrates it: its narration lines, in order,
// compared the way the recording guide compares scripts.
const narrationLinesOf = (content: unknown) =>
  ((content as SceneTreatmentV1 | null)?.moments || [])
    .map(moment => (moment.narration?.guide || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
const scriptLines = (script: string) =>
  script
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

export const treatmentFreshness = (
  record: PlanningRecord,
  // scriptAdoptedFrom: the plan whose lines the scene's script was taken
  // from, if it was (the scene's scriptSource).
  now: { brief: PlanningRecord | null; briefFresh: Freshness; inputs: TreatmentInputs | null; scriptAdoptedFrom?: string | null },
): Freshness => {
  if (!now.brief || !now.inputs) return stale('no explanation brief is ready')
  if (record.inputs.briefId !== now.brief.id) return stale('the explanation brief has changed since this plan was made')
  if (!now.briefFresh.fresh) return stale(`its explanation brief is stale: ${now.briefFresh.reason}`)
  // A script taken from this very plan, and still exactly its narration, is
  // the plan's own words — not a change to what it was made from. Any other
  // change to the words still makes it stale; new plans start from them.
  const adopted = now.scriptAdoptedFrom === record.id && scriptLines(now.inputs.script).join('\n') === narrationLinesOf(record.content).join('\n')
  if (adopted) now = { ...now, inputs: { ...now.inputs, script: String(record.inputs.script ?? now.inputs.script) } }
  if (!now.inputs) return stale('no explanation brief is ready')
  if (record.fingerprint === treatmentFingerprint(now.inputs)) return FRESH
  const moved = changedInputs(treatmentDependencies(record.inputs), treatmentDependencies(now.inputs), TREATMENT_INPUT_LABELS)
  return stale(`${moved.length ? sentence(moved) : 'its inputs'} changed since this plan was made`)
}

// The states the planning workspace shows for a scene.
export type ScenePlanningState =
  | 'needs-brief' // no brief has been asked for yet
  | 'preparing' // the video's brief is being prepared
  | 'brief-failed' // the brief could not be prepared; the fork is still usable
  | 'ready-to-plan'
  | 'planning'
  | 'candidate'
  | 'reviewed'
  | 'stale'
  | 'failed'

export type ScenePlanningView = {
  state: ScenePlanningState
  // The newest record for the scene, whatever happened to it.
  latest: PlanningRecord | null
  // The plan a creator accepted; kept while newer candidates run or fail.
  reviewed: PlanningRecord | null
  // The newest usable result: the latest candidate or reviewed plan.
  current: PlanningRecord | null
  // Why current is stale, when it is.
  staleBecause: string | null
}

const newestFirst = (records: PlanningRecord[]) => [...records].sort((a, b) => b.revision - a.revision)

export const currentBrief = (records: PlanningRecord[]) =>
  newestFirst(records.filter(record => record.kind === 'brief')).find(record => record.status === 'ready') || null

export const latestBrief = (records: PlanningRecord[]) =>
  newestFirst(records.filter(record => record.kind === 'brief'))[0] || null

// `now` is the scene's freshness context; without one (a packet looking up
// neighbours) staleness is not judged.
export const scenePlanningView = (
  records: PlanningRecord[],
  scene: string,
  now: { briefFresh: Freshness; inputs: TreatmentInputs | null; scriptAdoptedFrom?: string | null } | null,
): ScenePlanningView => {
  const brief = currentBrief(records)
  const newestBrief = latestBrief(records)
  const mine = newestFirst(records.filter(record => record.kind === 'treatment' && record.subject === scene && record.status !== 'superseded'))
  const latest = mine[0] || null
  const reviewed = mine.find(record => record.status === 'reviewed') || null
  const current = mine.find(record => record.status === 'candidate' || record.status === 'reviewed') || null
  const freshness = current && now ? treatmentFreshness(current, { brief, ...now }) : null
  const staleBecause = freshness && !freshness.fresh ? freshness.reason : null
  let state: ScenePlanningState
  if (!brief) state = newestBrief?.status === 'failed' ? 'brief-failed' : newestBrief && ACTIVE_STATUSES.includes(newestBrief.status) ? 'preparing' : 'needs-brief'
  else if (latest && isActiveStatus(latest.status)) state = 'planning'
  else if (latest?.status === 'failed') state = 'failed'
  else if (current && staleBecause) state = 'stale'
  else if (current?.status === 'reviewed') state = 'reviewed'
  else if (current) state = 'candidate'
  else state = 'ready-to-plan'
  return { state, latest, reviewed, current, staleBecause }
}

export const PLANNING_STATE_LABELS: Record<ScenePlanningState, string> = {
  'needs-brief': 'Needs the brief',
  preparing: 'Preparing the brief',
  'brief-failed': 'Brief failed',
  'ready-to-plan': 'Ready to plan',
  planning: 'Planning',
  candidate: 'Candidate ready',
  reviewed: 'Approved',
  stale: 'Stale',
  failed: 'Failed',
}

// Can this result still land? A run's result is applied only when the record
// is the newest for its subject, still running, and fresh by the same check
// the workspace and review use. Otherwise it is kept as a superseded
// revision, never over newer work.
export const landingFor = (
  record: PlanningRecord,
  siblings: PlanningRecord[],
  freshness: Freshness,
): { lands: true } | { lands: false; status: PlanningStatus; reason: string } => {
  if (!ACTIVE_STATUSES.includes(record.status)) {
    return { lands: false, status: record.status, reason: `this ${record.kind} already finished as ${record.status}` }
  }
  const newer = siblings.some(other => other.id !== record.id && other.kind === record.kind && other.subject === record.subject && other.revision > record.revision)
  if (newer) return { lands: false, status: 'superseded', reason: 'a newer run for the same subject has started since' }
  if (!freshness.fresh) {
    return { lands: false, status: 'superseded', reason: `its inputs changed while it ran (${freshness.reason}); the result is kept for reference but not used` }
  }
  return { lands: true }
}
