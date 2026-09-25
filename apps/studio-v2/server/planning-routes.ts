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
  recordReportedModel,
  reviewTreatment,
  runFinished,
  saveDirection,
  submitBrief,
  submitTreatment,
  retryVisualCast,
  queuePreview,
  submitSketch,
  loadPreviewFile,
  queueProduction,
  submitProduction,
  loadProductionFile,
  acceptProduction,
  productionEdits,
  saveProductionEdits,
  noteProgress,
  publishDraft,
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
    // /api/planning/previews/:id/<file> — a preview's files, for the player.
    if (parts[0] === 'previews' && parts[1] && method === 'GET') {
      const file = await loadPreviewFile(parts[1], parts.slice(2).join('/') || 'index.html')
      response.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'no-store' })
      response.end(file.body)
      return true
    }
    // /api/planning/productions/:id/<file> — a produced scene's files, for the
    // stage. A player seeks the take by byte ranges.
    if (parts[0] === 'productions' && parts[1] && method === 'GET') {
      const file = await loadProductionFile(parts[1], parts.slice(2).join('/') || 'index.html')
      const body = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body)
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range || ''))
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]))
        const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
        if (start >= body.length || start > end) {
          response.writeHead(416, { 'content-range': `bytes */${body.length}` })
          response.end()
          return true
        }
        response.writeHead(206, { 'content-type': file.contentType, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': String(end - start + 1) })
        response.end(body.subarray(start, end + 1))
        return true
      }
      response.writeHead(200, { 'content-type': file.contentType, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-length': String(body.length) })
      response.end(body)
      return true
    }
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
      // The owning run read its packet and contract (U3 of the scene
      // workspace plan): a milestone the creator sees. Nothing else is
      // reported from outside; the rest the product confirms itself.
      if (method === 'POST' && action === 'progress') {
        const input = await body<{ runId?: string; milestone?: string }>(request)
        if (!input.runId) throw new PlanningError('A run id is required', 400)
        if (input.milestone !== 'context') throw new PlanningError('Only reading the run\'s context is reported here', 400)
        await noteProgress(id, { milestone: 'context' }, { runId: String(input.runId) })
        send(response, 200, { ok: true })
        return true
      }
      // A section of a scene plan, published by its run as a draft.
      if (method === 'POST' && action === 'draft') {
        const input = await body<Record<string, unknown>>(request, 256 * 1024)
        if (!input.runId) throw new PlanningError('A run id is required', 400)
        const result = await publishDraft(id, String(input.runId), input.section, input)
        send(response, result.accepted ? 200 : 422, result)
        return true
      }
      // The owning run's harness reports the model its session runs.
      if (method === 'POST' && action === 'model') {
        const input = await body<{ runId?: string; model?: string }>(request)
        if (!input.runId) throw new PlanningError('A run id is required', 400)
        send(response, 200, { record: await recordReportedModel(id, { runId: input.runId, model: String(input.model || '') }) })
        return true
      }
      if (method === 'POST' && (action === 'brief' || action === 'treatment')) {
        const input = await body<{ brief?: unknown; treatment?: unknown; runId?: string }>(request, 4 * 1024 * 1024)
        const runId = input.runId ? String(input.runId) : undefined
        const result = action === 'brief' ? await submitBrief(id, input.brief, runId) : await submitTreatment(id, input.treatment, runId)
        // Problems are an answer, not a failure: the harness fixes and resubmits.
        send(response, result.accepted ? 200 : 422, result)
        return true
      }
      if (method === 'POST' && action === 'sketch') {
        const input = await body<{ files?: unknown; runId?: string }>(request, 12 * 1024 * 1024)
        const result = await submitSketch(id, input.files, input.runId ? String(input.runId) : undefined)
        send(response, result.accepted ? 200 : 422, result)
        return true
      }
      if (method === 'POST' && action === 'production') {
        const input = await body<{ files?: unknown; runId?: string }>(request, 60 * 1024 * 1024)
        const result = await submitProduction(id, input.files, input.runId ? String(input.runId) : undefined)
        send(response, result.accepted ? 200 : 422, result)
        return true
      }
      // The creator's values for a produced scene's controls (P6).
      if (action === 'edits' && method === 'GET') {
        send(response, 200, { edits: await productionEdits(id) })
        return true
      }
      if (action === 'edits' && method === 'PUT') {
        send(response, 200, { edits: await saveProductionEdits(id, await body<{ revision?: unknown; values?: unknown }>(request)) })
        return true
      }
      // The creator accepts a produced scene: it is rendered once, as the scene's output.
      if (method === 'POST' && action === 'accept') {
        send(response, 200, { record: await acceptProduction(id) })
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
      const input = await body<{ status?: string; exitCode?: number | null; error?: string; failure?: { category?: string; message?: string; recovery?: string[] } }>(request)
      send(response, 200, { failed: await runFinished(parts[1], { status: String(input.status || 'done'), exitCode: input.exitCode ?? null, ...(input.error ? { error: String(input.error) } : {}), ...(input.failure ? { failure: input.failure } : {}) }) })
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
    // Extract the base's visual cast again after a failure.
    if (method === 'POST' && parts[1] === 'cast') {
      send(response, 200, { status: (await retryVisualCast(projectId)).status })
      return true
    }
    if (method === 'POST' && parts[1] === 'scenes' && parts[2] && parts[3] === 'produce') {
      const input = await body<{ again?: boolean; note?: string }>(request)
      send(response, 200, await queueProduction(projectId, parts[2], { again: Boolean(input.again), ...(typeof input.note === 'string' ? { note: input.note } : {}) }))
      return true
    }
    if (method === 'POST' && parts[1] === 'scenes' && parts[2] && parts[3] === 'preview') {
      const input = await body<{ recordId?: string; again?: boolean }>(request)
      send(response, 200, await queuePreview(projectId, parts[2], { ...(input.recordId ? { recordId: String(input.recordId) } : {}), again: Boolean(input.again) }))
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
