import { createHash, randomUUID } from 'node:crypto'
import { audioReadinessOf, type ProjectDocumentV1 } from 'markdown-composition'
import { compareAndSwapSetting, loadSetting } from './persistence'
export type ExportResult = { url: string; durationSeconds: number; exportAsset: { assetId: string; objectKey: string } | null }
// Where a render is, as the renderer says (F8 of the Perplexity review):
// its stage, how far, and its frames when it counts them. No time estimate
// is promised.
export type ExportProgress = { stage: string; percent: number; frame?: number; frames?: number; at: number }
export type ExportReport = (progress: Omit<ExportProgress, 'at'>) => void
export type ExportJob = { project: ProjectDocumentV1; id: string; manifestHash: string; owner: string; status: 'queued' | 'running' | 'stored' | 'failed' | 'cancelled'; updatedAt: number; result?: ExportResult; error?: string; projectId?: string; startedAt?: number; progress?: ExportProgress }
const owner = randomUUID()
const active = new Map<string, AbortController>()
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item)
export const getExportJob = (id: string) => loadSetting(`export-job:${id}`) as Promise<ExportJob | null>
/** Content-addressed jobs survive the client connection. A CAS lease prevents
 * concurrent workers or retries from encoding the same manifest twice. */
// A notebook's exports, newest first: found again on any open of the
// notebook, whatever became of the window that started them (F8).
const indexKey = (projectId: string) => `export-index:${projectId}`
const indexExport = async (projectId: string, id: string) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const was = (await loadSetting(indexKey(projectId))) as string[] | null
    const next = [id, ...(was || []).filter(entry => entry !== id)].slice(0, 12)
    if (await compareAndSwapSetting(indexKey(projectId), was, next)) return
  }
}
export const listProjectExports = async (projectId: string) => {
  const ids = ((await loadSetting(indexKey(projectId))) as string[] | null) || []
  const jobs = await Promise.all(ids.map(id => getExportJob(id).catch(() => null)))
  return jobs.filter((job): job is ExportJob => Boolean(job)).map(job => exportJobView(job)!)
}

export async function startExportJob(project: ProjectDocumentV1, render: (signal: AbortSignal, report: ExportReport) => Promise<ExportResult>, retry = false): Promise<ExportJob> {
  const id = createHash('sha256').update(canonical({ renderer: 'studio-composition-3', project })).digest('hex')
  const previous = await getExportJob(id)
  if (previous && (previous.status === 'stored' || ((!retry || !['cancelled', 'failed'].includes(previous.status)) && (previous.status === 'cancelled' || previous.status === 'failed' || Date.now() - previous.updatedAt < 90000)))) {
    await indexExport(project.id, id).catch(() => {})
    return previous
  }
  let job: ExportJob = { project: structuredClone(project), id, manifestHash: id, owner, status: 'queued', updatedAt: Date.now(), projectId: project.id, startedAt: Date.now() }
  if (!await compareAndSwapSetting(`export-job:${id}`, previous, job)) return (await getExportJob(id))!
  await indexExport(project.id, id).catch(() => {})
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
      await update({ status: 'running', progress: { stage: 'preparing', percent: 0, at: Date.now() } })
      heartbeat = setInterval(() => { void update({}).catch(() => controller.abort()) }, 15000)
      // Progress is kept with the job, at most once a second (and at every
      // change of stage), so a reopened notebook reads where it is.
      let reported = 0
      let stage = ''
      const report: ExportReport = progress => {
        const now = Date.now()
        if (progress.stage === stage && now - reported < 1000) return
        reported = now
        stage = progress.stage
        void update({ progress: { ...progress, percent: Math.max(0, Math.min(100, Math.round(progress.percent))), at: now } }).catch(() => {})
      }
      const result = await render(controller.signal, report)
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

// A job says what its export sounds like (F9 of the Perplexity review):
// which blocks carry a take or a voice, and which will be silent.
export const exportJobView = (job: ExportJob | null) => {
  if (!job) return null
  const { project, ...view } = job
  const audio = audioReadinessOf(project)
  return { ...view, audio: { voiced: audio.voiced, missing: audio.missing, silentDraft: audio.silentDraft, blocks: audio.blocks } }
}
