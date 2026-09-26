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
import { startExportJob, getExportJob, cancelExportJob, exportJobView, renderWarningsOf, type ExportJob } from './export-jobs'
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

// F01 and F05 of the fix verification: a stored export is named by its path
// on whatever origin the app has now, and a render's warnings are read.
describe('export results across restarts', () => {
  const job = (url: string, exportAsset: { assetId: string; objectKey: string } | null): ExportJob => ({ project: { ...project, notebook: { type: 'doc', content: [] }, presenterTracks: {}, blocks: {} } as ProjectDocumentV1, id: 'a'.repeat(64), manifestHash: 'a'.repeat(64), owner: 'o', status: 'stored', updatedAt: 1, result: { url, durationSeconds: 4, exportAsset } })
  it('names a result written on an earlier port by its stored object', () => {
    const view = exportJobView(job('http://127.0.0.1:58827/objects/projects/p/export/v.mp4', { assetId: 'v', objectKey: 'projects/p/export/v.mp4' }))
    expect(view?.result?.url).toBe('/objects/projects/p/export/v.mp4')
  })
  it('keeps the path of an older result without an asset row, and a portable one as it is', () => {
    expect(exportJobView(job('http://localhost:4319/outputs/x.mp4', null))?.result?.url).toBe('/outputs/x.mp4')
    expect(exportJobView(job('/objects/video', { assetId: 'video', objectKey: 'video' }))?.result?.url).toBe('/objects/video')
  })
})

describe('what a render says about itself', () => {
  const describeSource = (source: string) => source.replace(/^http:\/\/localhost:\d+\//, '/')
  it('keeps a logo that did not load as a warning, and blocks on anything the video shows', () => {
    const readings = renderWarningsOf([
      { code: 'media_load_failed', message: 'image media failed to load before capture', details: { mediaType: 'image', sources: ['http://localhost:49303/media/logo.svg'] } },
    ], { logo: 'media/logo.svg', describe: describeSource })
    expect(readings.blocking).toEqual([])
    expect(readings.warnings).toEqual([{ code: 'logo_not_loaded', message: 'The theme logo did not load, so the video has no logo.', sources: ['/media/logo.svg'] }])
    const blocked = renderWarningsOf([
      { code: 'media_load_failed', message: 'image media failed to load before capture', details: { mediaType: 'image', sources: ['http://localhost:49303/media/logo.svg', 'http://localhost:49303/media/figure.png'] } },
    ], { logo: 'media/logo.svg', describe: source => (source.endsWith('figure.png') ? '/objects/figure.png' : describeSource(source)) })
    expect(blocked.blocking).toEqual(['/objects/figure.png'])
    expect(blocked.warnings.map(warning => warning.code)).toEqual(['logo_not_loaded'])
  })
  it('reads slow media and unmixed sound as warnings in the creator\'s words, and passes others on', () => {
    const readings = renderWarningsOf([
      { code: 'media_readiness_timeout', message: 'video media did not become capture-ready within 45000ms', details: { mediaType: 'video', sources: ['http://localhost:1/media/take.mp4'] } },
      { code: 'audio_processing_failed', message: 'audio failed' },
      { code: 'live_map_detected', message: 'A live map was detected' },
    ], { logo: '', describe: describeSource })
    expect(readings.blocking).toEqual([])
    expect(readings.warnings).toEqual([
      { code: 'media_readiness_timeout', message: 'Some video took too long to load; it may appear late in its first frames.', sources: ['/media/take.mp4'] },
      { code: 'audio_processing_failed', message: 'Some of the sound could not be mixed, so part of the video may be silent.' },
      { code: 'live_map_detected', message: 'A live map was detected' },
    ])
  })
  it('blocks a failed load that names no source', () => {
    expect(renderWarningsOf([{ code: 'media_load_failed', message: 'x', details: { mediaType: 'video', sources: [] } }], { logo: '', describe: describeSource }).blocking).toEqual(['video media'])
  })
})
