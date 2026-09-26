import { describe, expect, it } from 'vitest'
import { coachStateFor } from './coach'
import type { ProjectDocumentV1 } from 'markdown-composition'

const project = (takes: Record<string, unknown>, brief = true): ProjectDocumentV1 => ({
  version: 1,
  id: 'nb',
  title: 'Coach fixture',
  notebook: { type: 'doc', content: [
    { type: 'heading', attrs: { id: 'h1', level: 1 }, content: [{ type: 'text', text: 'Title' }] },
    { type: 'scene', attrs: { id: 's1', title: 'Opening', ...(brief ? { directorAuto: { recordingBrief: { objective: 'hook: title', next: 'You hold the frame throughout.', shots: [{ id: 'shot-1', view: 'camera-full', look: 'You, full frame.', record: 'Look into the lens.' }] } } } : {}) } },
    { type: 'scene', attrs: { id: 's2', title: 'The mechanism' } },
    { type: 'scene', attrs: { id: 's3', title: 'The close' } },
  ] },
  fps: 30, width: 1920, height: 1080,
  blocks: {},
  presenterTracks: {},
  recordedBlocks: takes,
  brand: {},
} as unknown as ProjectDocumentV1)

describe('coachStateFor', () => {
  it('lists the scenes in order with the next unfinished scene first', () => {
    const coach = coachStateFor(project({}))
    expect(coach.total).toBe(3)
    expect(coach.done).toBe(0)
    expect(coach.nextId).toBe('s1')
    expect(coach.scenes.map(scene => scene.title)).toEqual(['Opening', 'The mechanism', 'The close'])
  })

  it('resumes at the first scene without an accepted take', () => {
    const take = { blockId: 's1', recordingId: 'r1', videoUrl: 'http://x/y.webm', durationMs: 100, recordedAt: '', storage: 'minio' }
    const coach = coachStateFor(project({ s1: take }))
    expect(coach.done).toBe(1)
    expect(coach.nextId).toBe('s2')
  })

  it('reports a fully recorded journey', () => {
    const take = { recordingId: 'r', videoUrl: 'http://x/y.webm', durationMs: 1, recordedAt: '', storage: 'minio' }
    const coach = coachStateFor(project({ s1: { ...take, blockId: 's1' }, s2: { ...take, blockId: 's2' }, s3: { ...take, blockId: 's3' } }))
    expect(coach.done).toBe(3)
    expect(coach.nextId).toBeNull()
  })

  it('carries the scene’s recording brief when the director planned one', () => {
    const coach = coachStateFor(project({}))
    expect(coach.scenes[0].brief?.objective).toBe('Opening')
    expect(coach.scenes[0].brief?.shots?.[0].record).toContain('lens')
    expect(coach.scenes[1].brief).toBeUndefined()
  })
})
