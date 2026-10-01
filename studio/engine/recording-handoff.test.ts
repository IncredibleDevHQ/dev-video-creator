import { expect, it } from 'vitest'
import { recordingHandoff } from '../app/recording-handoff'
import type { Snapshot } from '../shared/api'
import type { Scene } from '../shared/model'
it('explains a saved recording until the scene is finished, including after reload', () => {
  const scene = {
    id: 's',
    phase: 'waiting',
    moments: [{ id: 'intro', recordingKey: 'r', take: { recordingKey: 'r' } }]
  } as Scene
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'record' } } } },
    events: [{ kind: 'scene', sceneId: 's', message: '1 moment recorded' }],
    views: { scenes: { s: { produced: false, openMomentIds: [] } } }
  } as unknown as Snapshot
  expect(recordingHandoff(snapshot, scene)).toContain(
    'Moment 1 recording saved'
  )
  expect(recordingHandoff(snapshot, scene)).toContain(
    'Ready to combine with your scene'
  )
  snapshot.views!.scenes.s.openMomentIds = ['outro']
  expect(recordingHandoff(snapshot, scene)).toContain(
    '1 moment still needs recording'
  )
  snapshot.views!.scenes.s.produced = true
  expect(recordingHandoff(snapshot, scene)).toBe('')
})
it('does not confuse an older saved take with a current processing or failed operation', () => {
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'record' } } } },
    events: [{ kind: 'scene', sceneId: 's', message: '1 moment recorded' }]
  } as Snapshot
  for (const phase of ['producing', 'failed'] as const)
    expect(
      recordingHandoff(snapshot, {
        id: 's',
        phase,
        moments: []
      } as unknown as Scene)
    ).toBe('')
  expect(
    recordingHandoff(snapshot, {
      id: 'other',
      phase: 'waiting',
      moments: []
    } as unknown as Scene)
  ).toBe('')
})

it('does not claim a recording is saved from historical events after the take is removed', () => {
  const snapshot = {
    project: { video: { settings: { voice: { kind: 'record' } } } },
    events: [{ kind: 'scene', sceneId: 's', message: '1 moment recorded' }]
  } as Snapshot
  const scene = {
    id: 's',
    phase: 'waiting',
    moments: [{ id: 'm6', recordingKey: 'r', take: null }]
  } as Scene
  expect(recordingHandoff(snapshot, scene)).toBe('')
})
