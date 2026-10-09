import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
const root = await mkdtemp(join(tmpdir(), 'minimal-accept-candidate-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { acceptCandidate } = await import('./production')
afterAll(() => rm(root, { recursive: true, force: true }))

const notebook = (scene: Record<string, unknown>): Snapshot =>
  ({
    project: {
      id: 'p',
      title: 'Agents',
      source: '',
      slides: [{ id: 's', title: 'One', svg: '<svg/>' }],
      video: {
        settings: { presence: 'off', voice: { kind: 'record' } },
        scenes: [
          {
            id: 'scene-s',
            slideId: 's',
            phase: 'failed',
            failure: 'production',
            presence: null,
            moments: [],
            inputKey: 'k1',
            produced: null,
            error: 'The agent ran out of time.',
            ...scene
          }
        ],
        transitions: [],
        inputKey: '',
        produced: null
      }
    },
    status: 'ready',
    error: null,
    events: []
  }) as unknown as Snapshot

it('accepts only a candidate refused by soft checks, for this scene as it is', async () => {
  await writeRow('projects', 'p', notebook({}))
  await expect(acceptCandidate('p', 'scene-s')).rejects.toThrow(
    'This scene has no candidate to accept'
  )
  await writeRow('creative-production-attempts', 'a1', {
    projectId: 'p',
    sceneId: 'scene-s',
    inputKey: 'k0',
    soft: true,
    artifacts: []
  })
  await writeRow('projects', 'p', notebook({ acceptable: 'a1' }))
  // Made for the scene's earlier inputs: it no longer fits.
  await expect(acceptCandidate('p', 'scene-s')).rejects.toThrow(
    'The candidate no longer fits this scene'
  )
})

it('accepts a scene built as its animation, under the key the animation is built with', async () => {
  const { refreshVideoKeys } = await import('./scene-model')
  const { loadStageCheckpoint } = await import('./artifacts')
  const { waitForSceneProduction } = await import('./production')
  // A scene with a creative plan is built as its animation: its candidates
  // carry the animation's key, not the scene's (review 6: Accept as is
  // always said the candidate no longer fit).
  const snapshot = notebook({
    acceptable: 'a2',
    creativePlan: { recordId: 'r1' },
    moments: [
      {
        id: 'm1',
        title: 'One',
        lines: 'Hello there.',
        start: 0,
        end: 2,
        camera: 'none',
        layout: 'full-screen',
        overlay: null,
        recordingKey: 'rk',
        take: null,
        audio: null,
        audioKey: 'au'
      }
    ]
  })
  refreshVideoKeys(snapshot.project)
  const scene = snapshot.project.video!.scenes[0]
  scene.phase = 'failed'
  scene.failure = 'production'
  const built = `animation-${scene.animationKey}`
  expect(built).not.toBe(`animation-${scene.inputKey}`)
  await writeRow('creative-production-attempts', 'a2', {
    projectId: 'p',
    sceneId: 'scene-s',
    inputKey: built,
    soft: true,
    artifacts: []
  })
  await writeRow('projects', 'p', snapshot)
  const started = await acceptCandidate('p', 'scene-s')
  expect(started.project.video!.scenes[0].phase).toBe('producing')
  // Where the animation's build looks for its accepted production.
  expect(
    await loadStageCheckpoint('p', 'scene-s', 'creative-production', built)
  ).toBeTruthy()
  await waitForSceneProduction('p', 'scene-s').catch(() => {})
})
