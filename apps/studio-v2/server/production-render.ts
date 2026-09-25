// A produced scene, rendered (P4): the accepted bundle played frame by frame
// by the pinned producer, the way the notebook's export renders, into the
// MP4 the notebook then plays and exports for that scene. The bundle is the
// one the stage played; only where it finds the Studio's runtime changes —
// served at /runtime/* in the Studio, beside the page on disk.
import { createRenderJob, executeRenderJob } from '@hyperframes/producer'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { RUNTIME_PATHS } from './sketch-runtime'
import type { SketchFiles } from '../src/planning/sketch-bundle'

export const renderProductionBundle = async (files: SketchFiles, options: { fps: number; signal?: AbortSignal }) => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-production-render-'))
  try {
    for (const [name, file] of Object.entries(files)) {
      const path = join(dir, name)
      await mkdir(dirname(path), { recursive: true })
      const body = typeof file === 'string' ? (name === 'index.html' ? file.replace(/(["'])\/runtime\//g, '$1./runtime/') : file) : Buffer.from(file.base64, 'base64')
      await writeFile(path, body)
    }
    await mkdir(join(dir, 'runtime'), { recursive: true })
    for (const [url, source] of Object.entries(RUNTIME_PATHS)) await copyFile(source, join(dir, url.replace(/^\//, '')))
    const output = join(dir, 'scene.mp4')
    const job = createRenderJob({ fps: options.fps, quality: 'standard', workers: 1, entryFile: 'index.html', outputResolution: 'landscape' })
    try {
      await executeRenderJob(job, dir, output, undefined, options.signal)
    } catch (error) {
      const details = job.warnings.map(warning => warning.message).filter(Boolean).slice(0, 4).join('; ')
      throw new Error(`${error instanceof Error ? error.message : String(error)}${details ? ` (${details})` : ''}`)
    }
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
