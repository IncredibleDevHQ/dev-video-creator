// The planning actions the notebook and the planning workspace share:
// load a video's planning, queue a scene plan and start it on the creator's
// "Video planning" harness, approve a plan. Nothing here starts production.
import type { PlanningRecord } from './planning-records'
import type { PlanningOverviewV1 } from './planning-workspace'
import { loadHarnessPreferences, resolveStage, type HarnessAvailability } from '../harness-choice'

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
export const startPlanningRun = async (fetchJson: FetchJson, input: { record: PlanningRecord; route: 'Prepare Brief' | 'Plan Scene' | 'Sketch Scene'; projectId: string }) => {
  const bridge = window.studioDesktop
  const fail = (message: string, providerStatus?: string) =>
    fetchJson(`/api/planning/records/${encodeURIComponent(input.record.id)}/fail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, ...(providerStatus ? { providerStatus } : {}) }) }).catch(() => {})
  if (!bridge?.isDesktop) throw new Error('Planning runs in the desktop app, with your local harness')
  const [adapters, preferences] = await Promise.all([bridge.harness.adapters().catch(() => [] as HarnessAvailability[]), loadHarnessPreferences(fetchJson)])
  const choice = resolveStage(preferences, 'planning', adapters)
  if (!choice.available || !choice.harness) {
    const message = choice.reason || 'No local harness is available — install Kimi, Claude Code or Codex, then retry.'
    await fail(message, 'no harness online')
    throw new Error(message)
  }
  try {
    await bridge.harness.run({
      adapter: choice.harness,
      skill: 'video-planner',
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
export const planScene = async (fetchJson: FetchJson, projectId: string, sceneId: string) => {
  const { record, reused } = await fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}`, { method: 'POST' })
  if (!reused || record.status === 'queued') await startPlanningRun(fetchJson, { record, route: 'Plan Scene', projectId })
  return { record, reused }
}

// A rough, seekable preview of one plan revision (P3), built on the same
// harness; the same plan already previewed is shown again unless `again`.
export const previewScene = async (fetchJson: FetchJson, projectId: string, sceneId: string, options: { recordId?: string; again?: boolean } = {}) => {
  const { record, reused } = await fetchJson<{ record: PlanningRecord; reused: boolean }>(`/api/planning/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!reused || record.status === 'queued') await startPlanningRun(fetchJson, { record, route: 'Sketch Scene', projectId })
  return { record, reused }
}

// Approval pins the plan with what it was made from. It starts nothing.
export const approvePlan = (fetchJson: FetchJson, recordId: string) =>
  fetchJson<{ record: PlanningRecord }>(`/api/planning/records/${encodeURIComponent(recordId)}/review`, { method: 'POST' })
