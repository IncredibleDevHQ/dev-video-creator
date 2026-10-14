import { expect, it } from 'vitest'
import type { SceneSummary, Storyboard } from '../../shared/storyboard'
import { afterFrames, takeRefusal } from './takes'

const take = { objectKey: 'k.mp4', duration: 20 }

it('takes a scene’s first take any time, and replaces one only between steps', () => {
  const building = { stage: 'frames', status: 'working' } as Storyboard
  const waiting = { stage: 'voice', status: 'waiting' } as Storyboard
  const first = { pageId: 'b', take: null } as SceneSummary
  const second = { pageId: 'b', take } as SceneSummary
  expect(takeRefusal(building, first)).toBeNull()
  expect(takeRefusal(building, second)).toMatch(/replace a take/)
  expect(takeRefusal(waiting, second)).toBeNull()
})

it('after the frames: assemble, voice a take that came in, or wait', () => {
  const scenes = [
    { pageId: 'a', take: undefined },
    { pageId: 'b', take: null }
  ]
  expect(afterFrames(scenes, ['a', 'b'])).toBe('assemble')
  expect(afterFrames(scenes, ['a'])).toBe('wait')
  expect(afterFrames([scenes[0], { pageId: 'b', take }], ['a'])).toBe('voice')
})
