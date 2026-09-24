import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProjectDocumentV1 } from 'markdown-composition'
const records = vi.hoisted(() => new Map<string, unknown>())
vi.mock('./persistence', () => ({
  loadSetting: async (key: string) => structuredClone(records.get(key) ?? null),
  compareAndSwapSetting: async (key: string, expected: unknown, value: unknown) => {
    if (JSON.stringify(records.get(key) ?? null) !== JSON.stringify(expected)) return false
    records.set(key, structuredClone(value)); return true
  },
}))
import { startExportJob, getExportJob, cancelExportJob } from './export-jobs'
const project = { version: 1, id: 'test', title: 'Reference' } as ProjectDocumentV1
const result = { url: '/objects/video', durationSeconds: 4, exportAsset: { assetId: 'video', objectKey: 'video' } }
const settle = () => new Promise(resolve => setTimeout(resolve, 10))
beforeEach(() => records.clear())
describe('durable export jobs', () => {
  it('concurrent identical submissions encode once, then reattach to the stored result', async () => {
    let finish!: (value: typeof result) => void
    const render = vi.fn(() => new Promise<typeof result>(resolve => { finish = resolve }))
    const [a,b] = await Promise.all([startExportJob(project,render),startExportJob(structuredClone(project),render)])
    expect(a.id).toBe(b.id)
    await settle(); expect(render).toHaveBeenCalledTimes(1)
    finish(result); await settle()
    expect((await startExportJob(project,render)).status).toBe('stored')
    expect(render).toHaveBeenCalledTimes(1)
    expect((await getExportJob(a.id))?.result).toEqual(result)
  })
  it('cancels the render worker and never reports a cancelled encode as success', async () => {
    let aborted = false
    const job = await startExportJob(project, signal => new Promise((_resolve,reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelled')) })))
    await settle(); await cancelExportJob(job.id); await settle()
    expect(aborted).toBe(true); expect((await getExportJob(job.id))?.status).toBe('cancelled')
  })
  it('retries a failed job only on an explicit retry', async () => {
    const render = vi.fn(async () => { throw new Error('encode failed') })
    await startExportJob(project, render); await settle()
    expect((await startExportJob(project, render)).status).toBe('failed')
    expect(render).toHaveBeenCalledTimes(1)
    await startExportJob(project, async () => result, true); await settle()
    expect((await startExportJob(project, render)).status).toBe('stored')
  })
  it('requires durable storage and distinguishes a changed manifest', async () => {
    const first = await startExportJob(project, async () => ({ ...result, exportAsset: null }))
    await settle(); expect((await getExportJob(first.id))?.status).toBe('failed')
    const second = await startExportJob({ ...project,title:'Changed' },async()=>result)
    expect(first.id).not.toBe(second.id); await settle()
    expect((await getExportJob(second.id))?.status).toBe('stored')
  })
})
