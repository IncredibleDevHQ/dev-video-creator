import { expect, it } from 'vitest'
import { sceneActivityRail } from '../app/scene-activity'
import type { Snapshot } from '../shared/api'
import type { Scene } from '../shared/model'
it('shows animation before voice on a first animation run and omits unneeded recording steps', () => {
  const scene = {
    id: 'scene',
    phase: 'producing',
    moments: [{ camera: 'none' }],
    creativePlan: { recordId: 'plan', inputKey: 'plan' },
    produced: null
  } as Scene
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'ai' } } } },
    events: [
      {
        kind: 'scene',
        sceneId: 'scene',
        message: 'Building the scene',
        stage: 'composition',
        activity: 'processing',
        time: '2026-10-01T00:00:00Z'
      }
    ]
  } as Snapshot
  const building = sceneActivityRail(snapshot, scene, true)
  expect(building).toContain('<p>Animation</p>')
  expect(building).not.toContain('<p>Voice</p>')
  snapshot.events.push({
    ...snapshot.events[0],
    message: 'Produced',
    stage: 'save',
    activity: 'complete'
  })
  const finished = sceneActivityRail(snapshot, scene, true)
  expect(finished).not.toContain('Your recordings')
  scene.moments[0].camera = 'full'
  expect(sceneActivityRail(snapshot, scene, true)).toContain('Your recordings')
})

it('shows the saved recording boundary instead of old render completion after a retake', () => {
  const scene = {
    id: 's',
    phase: 'waiting',
    moments: [{ camera: 'full' }],
    produced: { inputKey: 'old', objectKey: 'old.mp4' }
  } as Scene
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'ai' } } } },
    views: { scenes: { s: { produced: false, openMomentIds: [] } } },
    events: [
      {
        kind: 'scene',
        sceneId: 's',
        message: 'Produced',
        stage: 'save',
        activity: 'complete',
        time: '2026-10-01T00:00:00Z'
      },
      {
        kind: 'scene',
        sceneId: 's',
        message: '1 moment recorded',
        stage: 'recordings',
        activity: 'complete',
        time: '2026-10-01T01:00:00Z'
      }
    ]
  } as unknown as Snapshot
  const html = sceneActivityRail(snapshot, scene, true)
  expect(html).toContain('Recording saved · ready to finish this scene')
  expect(html).toContain('<p>Your recordings</p>')
  expect(html).not.toContain('<p>Render</p>')
  expect(html).not.toContain('Video ready')
})
it('keeps the same progress when the event wording changes', () => {
  const scene = {
    id: 's',
    phase: 'producing',
    moments: [],
    produced: null
  } as unknown as Scene
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'record' } } } },
    events: [
      {
        kind: 'scene',
        sceneId: 's',
        stage: 'render',
        activity: 'processing',
        message: 'New copy',
        time: '2026-10-01T00:00:00Z'
      }
    ]
  } as Snapshot
  const original = sceneActivityRail(snapshot, scene, true)
  snapshot.events[0].message = 'A completely unrelated sentence'
  expect(sceneActivityRail(snapshot, scene, true)).toBe(original)
  expect(original).toContain('<p>Render</p>')
})
it('uses retained artifacts for older notebooks without interpreting event text', () => {
  const scene = {
    id: 's',
    phase: 'waiting',
    moments: [{ id: 'm', camera: 'full', recordingKey: 'r', take: null }],
    animationKey: 'a',
    animation: { inputKey: 'a' },
    produced: null
  } as unknown as Scene
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'record' } } } },
    events: [
      {
        kind: 'scene',
        sceneId: 's',
        message: 'Produced',
        time: '2026-10-01T00:00:00Z'
      }
    ]
  } as Snapshot
  const html = sceneActivityRail(snapshot, scene, true)
  expect(html).toContain('1 moment needs your recording')
  expect(html).not.toContain('Save video')
})
