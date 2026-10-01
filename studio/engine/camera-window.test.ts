import { expect, it } from 'vitest'
import { cameraAt } from '../shared/camera-window'
import type { Moment } from '../shared/model'
const moment: Moment = {
  id: 'moment',
  lines: 'Open. Explain. Close.',
  start: 5,
  end: 15,
  camera: 'both',
  layout: 'corner',
  overlay: null,
  recordingKey: 'record',
  take: null,
  audio: null,
  audioKey: 'sound',
  segments: [
    { id: 'a', lines: 'Open.', camera: true, estimate: 2 },
    { id: 'b', lines: 'Explain.', camera: false, estimate: 6 },
    { id: 'c', lines: 'Close.', camera: true, estimate: 2 }
  ]
}
it('rehearses only the authored camera windows and respects exact boundaries', () => {
  expect(
    [4.9, 5, 6.9, 7, 12.9, 13, 14.9, 15].map((second) =>
      cameraAt(moment, second)
    )
  ).toEqual([false, true, true, false, false, true, true, false])
})
it('uses measured production windows when narration changed the clock', () => {
  const measured = {
    ...moment,
    media: {
      inputKey: 'sound',
      clips: [
        { start: 0, end: 3, camera: true },
        { start: 3, end: 9, camera: false },
        { start: 9, end: 10, camera: true }
      ]
    }
  }
  expect(cameraAt(measured, 7.5)).toBe(true)
  expect(cameraAt(measured, 13.5)).toBe(false)
  expect(cameraAt(measured, 14)).toBe(true)
  expect(cameraAt({ ...measured, audioKey: 'changed' }, 13.5)).toBe(true)
})
