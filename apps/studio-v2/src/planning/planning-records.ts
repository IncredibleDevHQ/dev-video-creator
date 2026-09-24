// Durable planning records and the states a creator sees.
//
// A video notebook's Explanation Brief and each scene's creative plan are
// versioned records. A record is queued, runs on the local harness, and ends
// ready (a brief), as a candidate (a plan), or failed. A creator marks a
// candidate reviewed; reviewing never starts any generation.
//
// Every record keeps the fingerprint of the inputs it was made from. When the
// source, the narrative, the theme, the brief or the creator's direction
// changes, the current fingerprint moves and the old result is stale: still
// readable, never silently treated as current, and never able to overwrite
// newer work. A newer run supersedes an older one for the same subject; the
// last reviewed plan stays in place while a new candidate runs or fails.
import { fingerprintOf } from './fingerprint'
import type { ExplanationBriefV1 } from './explanation-brief'
import type { SceneTreatmentV1 } from './scene-treatment'

export type PlanningKind = 'brief' | 'treatment'

export const PLANNING_STATUSES = ['queued', 'running', 'ready', 'candidate', 'reviewed', 'failed', 'superseded'] as const
export type PlanningStatus = (typeof PLANNING_STATUSES)[number]

// Statuses a record can still move from: it has not produced a result.
export const ACTIVE_STATUSES: readonly PlanningStatus[] = ['queued', 'running']

export type SkillBundleRef = { name: string; version: string; hash: string; upstreamCommit: string }

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
  content: ExplanationBriefV1 | SceneTreatmentV1 | null
  // What the checks said: warnings, construction risks.
  report: { warnings: string[]; constructionRisks?: string[] } | null
  artifacts: { objectKey: string; assetId: string } | null
  runId: string | null
  adapter: string | null
  model: string | null
  skillBundle: SkillBundleRef | null
  workflow: string | null
  direction: string
  error: { message: string; providerStatus?: string } | null
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
}

// What the brief is made from. Anything here changing makes the brief stale.
export type BriefInputs = {
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

// What one scene's plan is made from.
export type TreatmentInputs = {
  briefId: string
  briefFingerprint: string
  scene: string
  originScenes: string[]
  direction: string
  videoDirection: string
  themeRef: string | null
  delivery: string | null
  bundleHash: string
}

export const briefFingerprint = (inputs: BriefInputs) => fingerprintOf({ kind: 'brief', ...inputs })
export const treatmentFingerprint = (inputs: TreatmentInputs) => fingerprintOf({ kind: 'treatment', ...inputs })

// The states the planning workspace shows for a scene.
export type ScenePlanningState =
  | 'preparing' // the video's brief is not ready yet
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

export const scenePlanningView = (
  records: PlanningRecord[],
  scene: string,
  now: { briefFingerprint: string | null; treatmentFingerprint: string | null },
): ScenePlanningView => {
  const brief = currentBrief(records)
  const newestBrief = latestBrief(records)
  const mine = newestFirst(records.filter(record => record.kind === 'treatment' && record.subject === scene && record.status !== 'superseded'))
  const latest = mine[0] || null
  const reviewed = mine.find(record => record.status === 'reviewed') || null
  const current = mine.find(record => record.status === 'candidate' || record.status === 'reviewed') || null
  const staleBecause =
    current && now.treatmentFingerprint && current.fingerprint !== now.treatmentFingerprint
      ? brief && current.inputs.briefId !== brief.id
        ? 'the explanation brief has changed since this plan was made'
        : 'its inputs changed since it was made (direction, theme or source)'
      : null
  let state: ScenePlanningState
  if (!brief) state = newestBrief?.status === 'failed' ? 'brief-failed' : 'preparing'
  else if (latest && (latest.status === 'queued' || latest.status === 'running')) state = 'planning'
  else if (latest?.status === 'failed') state = 'failed'
  else if (current && staleBecause) state = 'stale'
  else if (current?.status === 'reviewed') state = 'reviewed'
  else if (current) state = 'candidate'
  else state = 'ready-to-plan'
  return { state, latest, reviewed, current, staleBecause }
}

export const PLANNING_STATE_LABELS: Record<ScenePlanningState, string> = {
  preparing: 'Preparing the brief',
  'brief-failed': 'Brief failed',
  'ready-to-plan': 'Ready to plan',
  planning: 'Planning',
  candidate: 'Candidate ready',
  reviewed: 'Reviewed',
  stale: 'Stale',
  failed: 'Failed',
}

// Can this result still land? A run's result is applied only when the record
// is the newest for its subject, still running, and made from the inputs
// that are current now. Otherwise it is kept as a superseded or stale
// revision, never over newer work.
export const landingFor = (
  record: PlanningRecord,
  siblings: PlanningRecord[],
  currentFingerprint: string,
): { lands: true } | { lands: false; status: PlanningStatus; reason: string } => {
  if (!ACTIVE_STATUSES.includes(record.status)) {
    return { lands: false, status: record.status, reason: `this ${record.kind} already finished as ${record.status}` }
  }
  const newer = siblings.some(other => other.id !== record.id && other.kind === record.kind && other.subject === record.subject && other.revision > record.revision)
  if (newer) return { lands: false, status: 'superseded', reason: 'a newer run for the same subject has started since' }
  if (record.fingerprint !== currentFingerprint) {
    return { lands: false, status: 'superseded', reason: 'its inputs changed while it ran; the result is kept for reference but not used' }
  }
  return { lands: true }
}
