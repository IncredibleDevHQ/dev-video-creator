import { describe, expect, it } from 'vitest'
import { SCENE_REVISION_ATTRS, sceneRevisionPayload } from './scene-revision'

describe('sceneRevisionPayload', () => {
  it('carries the complete editable direction of a scene', () => {
    const attrs = {
      title: 'Retries', script: 'A line.', sourceText: 'A line.', program: { version: 1 },
      motion: { version: 2 }, windows: [{ say: 'A line.' }], stageTrack: [{ family: 'content-full' }],
      stagePlacements: null, directorAuto: { shots: [] }, directorNotes: 'Why?\nBecause.',
      // Not part of the reviewed direction: provenance and flow state.
      id: 'scene', svg: '<svg/>', origin: { notebook: 'base' }, explainer: { run: 'run-1' },
    }
    expect(sceneRevisionPayload(attrs)).toEqual({
      title: 'Retries', script: 'A line.', sourceText: 'A line.', program: { version: 1 },
      motion: { version: 2 }, windows: [{ say: 'A line.' }], stageTrack: [{ family: 'content-full' }],
      stagePlacements: null, directorAuto: { shots: [] }, directorNotes: 'Why?\nBecause.',
    })
  })

  it('normalizes absent attributes to null, so tiptap defaults and stored JSON agree', () => {
    const bare = sceneRevisionPayload({ id: 'scene', svg: '<svg/>' })
    expect(Object.keys(bare).sort()).toEqual([...SCENE_REVISION_ATTRS].sort())
    expect(Object.values(bare).every(value => value === null)).toBe(true)
    expect(sceneRevisionPayload(undefined)).toEqual(bare)
    expect(sceneRevisionPayload({ stageTrack: [] })).toEqual({ ...bare, stageTrack: [] })
  })

  it('layers the rendered extras over the direction without losing either', () => {
    const payload = sceneRevisionPayload({ script: 'A line.' }, { camera: { position: 'hidden' }, durationMs: 2000 })
    expect(payload.script).toBe('A line.')
    expect(payload.camera).toEqual({ position: 'hidden' })
    expect(payload.durationMs).toBe(2000)
    expect(payload.motion).toBeNull()
  })
})
