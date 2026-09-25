// The planning actions the notebook and the planning workspace share:
// load a video's planning, queue a scene plan and start it on the creator's
// "Video planning" harness, approve a plan — and, as the creator's own
// explicit step, produce an approved scene on the "Scene production"
// harness and accept what it produced (P4).
import type { PlanningRecord } from './planning-records'
import type { PlanningOverviewV1, ProductionEditsView } from './planning-workspace'
import { BROWSER_REVIEW_MESSAGE, loadHarnessPreferences, resolveStage, type HarnessAvailability } from '../harness-choice'

type FetchJson = <T>(path: string, init?: RequestInit) => Promise<T>

export const loadPlanning = (fetchJson: FetchJson, projectId: string) =>
  fetchJson<PlanningOverviewV1>(`/api/planning/${encodeURIComponent(projectId)}`)

export const saveSceneDirection = (fetchJson: FetchJson, projectId: string, subject: string, direction: string) =>
  fetchJson(`/api/planning/${encodeURIComponent(projectId)}/inputs`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subject, direction }),
  })

// Starts the run that answers a queued record, on the durable planning
// choice. A harness that cannot start leaves the record failed, with why.
export const startPlanningRun = async (fetchJson: FetchJson, input: { record: PlanningRecord; route: 'Prepare Brief' | 'Plan Scene' | 'Sketch Scene' | 'Produce Scene'; projectId: string }) => {
  // Production runs on the creator's "Scene production" choice, with the producer.
  const production = input.route === 'Produce Scene'
  const bridge = window.studioDesktop
  const fail = (message: string, providerStatus?: string) =>
    fetchJson(`/api/planning/records/${encodeURIComponent(input.record.id)}/fail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, ...(providerStatus ? { providerStatus } : {}) }) }).catch(() => {})
  if (!bridge?.isDesktop) {
    await fail(BROWSER_REVIEW_MESSAGE, 'browser review')
    throw new Error(BROWSER_REVIEW_MESSAGE)
  }
  const [adapters, preferences] = await Promise.all([bridge.harness.adapters().catch(() => [] as HarnessAvailability[]), loadHarnessPreferences(fetchJson)])
  const choice = resolveStage(preferences, production ? 'composition' : 'planning', adapters)
  if (!choice.available || !choice.harness) {
    const message = choice.reason || 'No local harness is available — install Kimi, Claude Code or Codex, then retry.'
    await fail(message, 'no harness online')
    throw new Error(message)
  }
  try {
    await bridge.harness.run({
      adapter: choice.harness,
      skill: production ? 'scene-producer' : 'video-planner',
      route: input.route,
      projectId: input.projectId,
      inputs: { planning: { recordId: input.record.id }, ...(choice.model ? { model: choice.model } : {}), effort: 'high', autonomous: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await fail(`The local harness did not start: ${message}`, message)
    throw error
  }
}

// Queue this scene's plan from its current inputs, and start it unless the
// same inputs are already being planned.
// Only the desktop app runs the local harness: a browser queues nothing.
const assertDesktop = () => {
  if (!window.studioDesktop?.isDesktop) throw new Error(BROWSER_REVIEW_MESSAGE)
}

export const planScene = async (fetchJson: FetchJson, projectId: string, sceneId: string) => {
  assertDesktop()
  const { record, reused } = await fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}`, { method: 'POST' })
  if (!reused || record.status === 'queued') await startPlanningRun(fetchJson, { record, route: 'Plan Scene', projectId })
  return { record, reused }
}

// A rough, seekable preview of one plan revision (P3), built on the same
// harness; the same plan already previewed is shown again unless `again`.
export const previewScene = async (fetchJson: FetchJson, projectId: string, sceneId: string, options: { recordId?: string; again?: boolean } = {}) => {
  assertDesktop()
  const { record, reused } = await fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!reused || record.status === 'queued') await startPlanningRun(fetchJson, { record, route: 'Sketch Scene', projectId })
  return { record, reused }
}

// Produce the scene from its approved plan (P4): the product makes the
// scene's clock first (a generated voice is spoken and measured), then the
// "Scene production" harness builds the scene on it. The same approved plan
// on the same clock is produced once, unless `again`.
export const produceScene = async (fetchJson: FetchJson, projectId: string, sceneId: string, options: { again?: boolean; note?: string } = {}) => {
  assertDesktop()
  const { record, reused } = await fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}/produce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!reused || record.status === 'queued') await startPlanningRun(fetchJson, { record, route: 'Produce Scene', projectId })
  return { record, reused }
}

// Accepting a produced scene renders it once, as the scene's output — and
// again when the creator's edits change.
export const acceptProduction = (fetchJson: FetchJson, recordId: string) =>
  fetchJson<{ record: PlanningRecord }>(`/api/planning/records/${encodeURIComponent(recordId)}/accept`, { method: 'POST' })

// The creator's values for a produced scene's controls (P6), saved against
// the edit revision they were made on.
export const saveProductionEdits = (fetchJson: FetchJson, recordId: string, revision: number, values: Record<string, number>) =>
  fetchJson<{ edits: ProductionEditsView }>(`/api/planning/records/${encodeURIComponent(recordId)}/edits`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ revision, values }),
  })

// Approval pins the plan with what it was made from. It starts nothing.
export const approvePlan = (fetchJson: FetchJson, recordId: string) =>
  fetchJson<{ record: PlanningRecord }>(`/api/planning/records/${encodeURIComponent(recordId)}/review`, { method: 'POST' })
