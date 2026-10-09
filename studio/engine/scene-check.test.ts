import { expect, it } from 'vitest'
import type { Scene } from '../shared/model'
import { sceneCheck } from '../app/scene-check'

// What stopped a scene, beside Try again; or what a made scene was accepted
// with, while it still applies.
const scene = (fields: Partial<Scene>) =>
  ({
    id: 's',
    slideId: 'slide',
    phase: 'failed',
    presence: null,
    moments: [],
    inputKey: 'k1',
    produced: null,
    error: null,
    ...fields
  }) as Scene

it('says the last check in plain words, with Accept as is when it can be taken', () => {
  const stopped = scene({
    failure: 'production',
    lastCheck: 'Moment 3 needs one more visible change',
    acceptable: 'candidate-1'
  })
  const html = sceneCheck(stopped)
  expect(html).toContain(
    'The last check: Moment 3 needs one more visible change.'
  )
  expect(html).toContain('data-action="accept-scene"')
  expect(
    sceneCheck(
      scene({ failure: 'production', lastCheck: 'Its code had a fault' })
    )
  ).not.toContain('accept-scene')
  // A scene stopped while being written says nothing of an older making.
  expect(sceneCheck({ ...stopped, failure: 'planning' })).toBe('')
})

it('leaves a stop’s finding and candidate behind when the scene changes', async () => {
  const { transitionScene } = await import('./autopilot')
  const ledger = { project: { id: 'p' }, events: [] } as unknown as Parameters<
    typeof transitionScene
  >[2]
  const stopped = scene({
    failure: 'production',
    lastCheck: 'Moment 3 needs one more visible change',
    acceptable: 'candidate-1'
  })
  transitionScene(stopped, 'produce', ledger)
  expect(stopped.lastCheck).toBeUndefined()
  expect(stopped.acceptable).toBeUndefined()
})

it('keeps what a made scene was accepted with only while it still applies', () => {
  const notice =
    'Accepted with a warning: Moment 2 needs one more visible change'
  const made = scene({
    phase: 'produced',
    notice,
    produced: { inputKey: 'k1', objectKey: 'o.mp4' }
  })
  expect(sceneCheck(made)).toContain(notice)
  // Changed since, or left out of the video: it no longer says so.
  expect(sceneCheck({ ...made, inputKey: 'k2' })).toBe('')
  expect(sceneCheck({ ...made, phase: 'idle' })).toBe('')
})

it('says the video stopped only while a scene is stopped, however the scene recovers', async () => {
  const { transitionScene } = await import('./autopilot')
  const stopped = scene({ failure: 'production', moments: [] })
  const video = {
    phase: 'failed',
    error: 'A scene stopped. Other saved animations are ready.',
    scenes: [stopped]
  }
  const ledger = {
    project: { id: 'p', video },
    events: []
  } as unknown as Parameters<typeof transitionScene>[2]
  // Tried again, it is still on its way: the video still says so.
  transitionScene(stopped, 'produce', ledger)
  expect(video.phase).toBe('failed')
  // Back waiting for the creator's take: nothing is stopped any more.
  transitionScene(stopped, 'animation-ready', ledger)
  expect(stopped.phase).toBe('waiting')
  expect(video).toMatchObject({ phase: 'idle', error: null })
})

it('says how many scenes are stopped now, and nothing once none is', async () => {
  const { settleStoppedVideo } = await import('./autopilot')
  const a = scene({ id: 'a', failure: 'production' })
  const b = scene({ id: 'b', failure: 'production' })
  const video = {
    phase: 'failed',
    error: '2 scenes stopped. Other saved animations are ready.',
    scenes: [a, b]
  } as never as Parameters<typeof settleStoppedVideo>[0] & {
    phase: string
    error: string | null
  }
  // One fixed: the line counts the one left (review 6: it said 2).
  a.phase = 'produced'
  settleStoppedVideo(video)
  expect(video.error).toBe('A scene stopped. Other saved animations are ready.')
  // The other's wireframe deleted with it: nothing is stopped.
  video!.scenes.splice(1, 1)
  settleStoppedVideo(video)
  expect(video).toMatchObject({ phase: 'idle', error: null })
})
