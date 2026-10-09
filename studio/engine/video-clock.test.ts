import { expect, it } from 'vitest'
import type { Project } from '../shared/model'
import { sceneAt, videoSecond } from '../shared/video-clock'

// Fifteen scenes, only 6 and 9 made: the clock lists those two, by id.
const project = {
  id: 'p',
  title: 'Agents',
  source: '',
  slides: [],
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: Array.from({ length: 15 }, (_, i) => ({ id: `scene-${i + 1}` })),
    transitions: [],
    inputKey: '',
    produced: {
      objectKey: 'v.mp4',
      clock: [
        { sceneId: 'scene-6', start: 0, duration: 57 },
        { sceneId: 'scene-9', start: 57, duration: 40 }
      ]
    }
  }
} as unknown as Project

it('finds the scene playing by its id, not its place in the clock', () => {
  expect(sceneAt(project, 6)).toEqual({ index: 5, second: 6 })
  expect(sceneAt(project, 60)).toEqual({ index: 8, second: 3 })
})

it('seeks a scene by its own interval', () => {
  expect(videoSecond(project, 8, 2)).toBe(59)
  expect(videoSecond(project, 5, 0)).toBe(0)
})
