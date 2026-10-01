import { expect, it } from 'vitest'
import { recordingTarget } from '../app/recording-target'
import type { Moment } from '../shared/model'
const moments = ['intro', 'demo', 'outro'].map((id) => ({ id })) as Moment[]
it('lets a later unfinished moment be recorded before the first one', () => {
  expect(recordingTarget(moments, ['intro', 'outro'], 2)).toBe(2)
})
it('offers the first unfinished moment when the selection needs no recording', () => {
  expect(recordingTarget(moments, ['intro', 'outro'], 1)).toBe(0)
  expect(recordingTarget(moments, [], 1)).toBe(-1)
})
