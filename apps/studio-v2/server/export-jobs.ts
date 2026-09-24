import { createHash, randomUUID } from 'node:crypto'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { compareAndSwapSetting, loadSetting } from './persistence'
export type ExportResult = { url: string; durationSeconds: number; exportAsset: { assetId: string; objectKey: string } | null }
export type ExportJob = { project: ProjectDocumentV1; id: string; manifestHash: string; owner: string; status: 'queued' | 'running' | 'stored' | 'failed' | 'cancelled'; updatedAt: number; result?: ExportResult; error?: string }
const owner = randomUUID()
const active = new Map<string, AbortController>()
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item)
export const getExportJob = (id: string) => loadSetting(`export-job:${id}`) as Promise<ExportJob | null>
/** Content-addressed jobs survive the client connection. A CAS lease prevents
 * concurrent workers or retries from encoding the same manifest twice. */
export async function startExportJob(project: ProjectDocumentV1, render: (signal: AbortSignal) => Promise<ExportResult>, retry = false): Promise<ExportJob> {
  const id = createHash('sha256').update(canonical({ renderer: 'studio-composition-3', project })).digest('hex')
  const previous = await getExportJob(id)
  if (previous && (previous.status === 'stored' || ((!retry || !['cancelled', 'failed'].includes(previous.status)) && (previous.status === 'cancelled' || previous.status === 'failed' || Date.now() - previous.updatedAt < 90000)))) return previous
  let job: ExportJob = { project: structuredClone(project), id, manifestHash: id, owner, status: 'queued', updatedAt: Date.now() }
  if (!await compareAndSwapSetting(`export-job:${id}`, previous, job)) return (await getExportJob(id))!
  const controller = new AbortController(); active.set(id, controller)
  let writes: Promise<unknown> = Promise.resolve()
  const update = (patch: Partial<ExportJob>) => {
    const operation = writes.catch(() => {}).then(async () => {
      const next = { ...job, ...patch, updatedAt: Date.now() }
      if (!await compareAndSwapSetting(`export-job:${id}`, job, next)) { controller.abort(); throw new Error('Export lease changed or was cancelled') }
      job = next
    })
    writes = operation; return operation
  }
  void (async () => {
    let heartbeat: ReturnType<typeof setInterval> | undefined
    try {
      await update({ status: 'running' })
      heartbeat = setInterval(() => { void update({}).catch(() => controller.abort()) }, 15000)
      const result = await render(controller.signal)
      if (!result.exportAsset) throw new Error('Encoded output was not stored durably')
      if (controller.signal.aborted) throw new Error('Export cancelled')
      await update({ status: 'stored', result })
    } catch (error) {
      if (!controller.signal.aborted) await update({ status: 'failed', error: String(error) }).catch(() => {})
    } finally { if (heartbeat) clearInterval(heartbeat); if (active.get(id) === controller) active.delete(id) }
  })()
  return job
}
export async function cancelExportJob(id: string) {
  const job = await getExportJob(id)
  if (!job || ['stored','failed','cancelled'].includes(job.status)) return job
  const next: ExportJob = { ...job, status: 'cancelled', updatedAt: Date.now() }
  if (!await compareAndSwapSetting(`export-job:${id}`, job, next)) return cancelExportJob(id)
  active.get(id)?.abort()
  return next
}

export const exportJobView = (job: ExportJob | null) => { if (!job) return null; const { project: _project, ...view } = job; return view }
