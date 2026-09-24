// HTTP routes for planning (M0). One entry point, answering only
// /api/planning/*; everything it does is in the planning service.
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  PlanningError,
  attachRun,
  failRecord,
  loadPacket,
  planningForBase,
  planningOverview,
  queueBrief,
  queueTreatment,
  reviewTreatment,
  runFinished,
  saveDirection,
  submitBrief,
  submitTreatment,
} from './planning-service'
import { loadPlanningRecord } from './persistence'

const send = (response: ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

const body = async <T>(request: IncomingMessage, maximumBytes = 2 * 1024 * 1024): Promise<T> => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maximumBytes) throw new PlanningError('Request body is too large', 413)
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return (text ? JSON.parse(text) : {}) as T
}

export const handlePlanningRoute = async (request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> => {
  if (!url.pathname.startsWith('/api/planning/')) return false
  const parts = url.pathname.split('/').slice(3).map(decodeURIComponent)
  const method = request.method || 'GET'
  try {
    // /api/planning/records/:id[/action]
    if (parts[0] === 'records' && parts[1]) {
      const id = parts[1]
      const action = parts[2] || ''
      if (method === 'GET' && !action) {
        const record = await loadPlanningRecord(id)
        if (!record) throw new PlanningError('Planning record not found', 404)
        send(response, 200, { record })
        return true
      }
      if (method === 'GET' && action === 'packet') {
        send(response, 200, await loadPacket(id))
        return true
      }
      if (method === 'POST' && action === 'run') {
        const input = await body<{ runId?: string; adapter?: string; model?: string }>(request)
        if (!input.runId) throw new PlanningError('A run id is required', 400)
        send(response, 200, { record: await attachRun(id, { runId: input.runId, adapter: input.adapter, model: input.model }) })
        return true
      }
      if (method === 'POST' && (action === 'brief' || action === 'treatment')) {
        const input = await body<{ brief?: unknown; treatment?: unknown }>(request, 4 * 1024 * 1024)
        const result = action === 'brief' ? await submitBrief(id, input.brief) : await submitTreatment(id, input.treatment)
        // Problems are an answer, not a failure: the harness fixes and resubmits.
        send(response, result.accepted ? 200 : 422, result)
        return true
      }
      if (method === 'POST' && action === 'review') {
        send(response, 200, { record: await reviewTreatment(id) })
        return true
      }
      if (method === 'POST' && action === 'fail') {
        const input = await body<{ message?: string; providerStatus?: string }>(request)
        const record = await failRecord(id, { message: String(input.message || 'The planning run failed'), ...(input.providerStatus ? { providerStatus: String(input.providerStatus) } : {}) })
        send(response, record ? 200 : 409, record ? { record } : { error: 'This planning record already finished' })
        return true
      }
    }
    // /api/planning/runs/:runId/finished — the desktop host, when a run ends.
    if (parts[0] === 'runs' && parts[1] && parts[2] === 'finished' && method === 'POST') {
      const input = await body<{ status?: string; exitCode?: number | null; error?: string }>(request)
      send(response, 200, { failed: await runFinished(parts[1], { status: String(input.status || 'done'), exitCode: input.exitCode ?? null, ...(input.error ? { error: String(input.error) } : {}) }) })
      return true
    }
    const projectId = parts[0]
    if (!projectId) throw new PlanningError('A notebook id is required', 400)
    if (method === 'GET' && parts.length === 1) {
      send(response, 200, await planningOverview(projectId))
      return true
    }
    // A base reads one of its videos' planning, read-only.
    if (method === 'GET' && parts[1] === 'child' && parts[2]) {
      send(response, 200, await planningForBase(projectId, parts[2]))
      return true
    }
    if (method === 'POST' && parts[1] === 'brief') {
      send(response, 200, await queueBrief(projectId))
      return true
    }
    if (method === 'POST' && parts[1] === 'scenes' && parts[2]) {
      send(response, 200, await queueTreatment(projectId, parts[2]))
      return true
    }
    if (method === 'PUT' && parts[1] === 'inputs') {
      const input = await body<{ subject?: string; direction?: string; delivery?: string | null }>(request)
      send(response, 200, { input: await saveDirection(projectId, { subject: String(input.subject || ''), direction: input.direction, delivery: input.delivery }) })
      return true
    }
    throw new PlanningError('Not found', 404)
  } catch (error) {
    if (error instanceof PlanningError) {
      send(response, error.statusCode, { error: error.message, ...(error.detail ? { detail: error.detail } : {}) })
      return true
    }
    console.error(error)
    send(response, 500, { error: error instanceof Error ? error.message : 'Planning failed' })
    return true
  }
}
