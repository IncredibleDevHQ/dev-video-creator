import { describe, expect, it } from 'vitest'
import { baseStatusOf, forkNotebook, revisionOf, sceneOriginsOf } from './derive'
import type { ProjectDocumentV1 } from './types'

const base = (): ProjectDocumentV1 =>
  ({
    version: 1,
    id: 'base-1',
    title: 'Rate limiters',
    notebook: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'scene', attrs: { id: 'blk-a', title: 'The bucket', svg: '<svg id="a"/>' } },
        { type: 'scene', attrs: { id: 'blk-b', title: 'The shedder', svg: '<svg id="b"/>' } },
      ],
    },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: { 'blk-a': { blockId: 'blk-a' }, 'blk-b': { blockId: 'blk-b' } },
    presenterTracks: { 'blk-a': [] },
    recordedBlocks: { 'blk-a': { blockId: 'blk-a' } },
    brand: {},
  }) as unknown as ProjectDocumentV1

describe('deriving a video from a base', () => {
  it('gives the video its own ids and remembers where each scene came from', () => {
    const { project, origins } = forkNotebook(base(), { id: 'video-1', at: '2026-09-17T00:00:00.000Z' })
    expect(project.id).toBe('video-1')
    expect(origins).toEqual([
      { from: 'blk-a', to: 'video-1-s01' },
      { from: 'blk-b', to: 'video-1-s02' },
    ])
    const scenes = project.notebook.content.filter(node => node.type === 'scene')
    expect(scenes.map(node => node.attrs!.id)).toEqual(['video-1-s01', 'video-1-s02'])
    expect(scenes[0].attrs!.origin).toEqual({ notebook: 'base-1', scene: 'blk-a' })
    // Block configuration and presenter lanes follow the new ids.
    expect(Object.keys(project.blocks)).toEqual(['video-1-s01', 'video-1-s02'])
    expect(project.blocks['video-1-s01'].blockId).toBe('video-1-s01')
    expect(Object.keys(project.presenterTracks)).toEqual(['video-1-s01'])
    // Takes belong to the notebook that recorded them.
    expect(project.recordedBlocks).toBeUndefined()
  })

  it('pins the revision it was taken from, and never shares a mutable page', () => {
    const original = base()
    const { project } = forkNotebook(original, { id: 'video-1', forkKey: 'k1' })
    expect(project.derivedFrom).toMatchObject({ notebook: 'base-1', kind: 'video', forkKey: 'k1', baseRevision: revisionOf(original) })
    const scene = project.notebook.content.find(node => node.type === 'scene')!
    scene.attrs!.svg = '<svg id="rich"/>'
    const stillThere = original.notebook.content.find(node => node.attrs?.id === 'blk-a')!
    expect(stillThere.attrs!.svg).toBe('<svg id="a"/>')
  })

  it('reads the same revision for the same content, whatever the fork did', () => {
    const one = base()
    const two = base()
    two.derivedFrom = { notebook: 'somewhere' }
    expect(revisionOf(one)).toBe(revisionOf(two))
    two.title = 'Rate limiters, revised'
    expect(revisionOf(one)).not.toBe(revisionOf(two))
  })

  it('says when the base has moved, and which of the video’s sources changed', () => {
    const original = base()
    const { project } = forkNotebook(original, { id: 'video-1' })
    expect(baseStatusOf(project, original, original).stale).toBe(false)
    const moved = base()
    moved.notebook.content[1].attrs!.title = 'The bucket, rewritten'
    const status = baseStatusOf(project, moved, original)
    expect(status.stale).toBe(true)
    expect(status.scenes.find(scene => scene.scene === 'blk-a')!.state).toBe('changed')
    expect(status.scenes.find(scene => scene.scene === 'blk-b')!.state).toBe('same')
  })

  it('survives a base that is gone, and still knows what it was made of', () => {
    const { project } = forkNotebook(base(), { id: 'video-1' })
    const status = baseStatusOf(project, null, null)
    expect(status.missing).toBe(true)
    expect(sceneOriginsOf(project).map(entry => entry.id)).toEqual(['video-1-s01', 'video-1-s02'])
  })
})
