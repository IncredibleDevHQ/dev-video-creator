import { expect, it } from 'vitest'
import { takeReviewPosition } from '../app/take-review-clock'
import type { Moment } from '../shared/model'
const moments = [
  { id: 'opening', recordingKey: 'first', start: 0, end: 2 },
  { id: 'auto', recordingKey: 'auto', start: 2, end: 8 },
  { id: 'closing', recordingKey: 'last', start: 8, end: 12 }
] as Moment[]
const parts = [
  { momentId: 'opening', recordingKey: 'first', from: 0, to: 10 },
  { momentId: 'closing', recordingKey: 'last', from: 10, to: 14 }
]
it('follows recorded time without highlighting skipped auto moments', () => {
  expect(takeReviewPosition(moments, parts, 5)).toEqual({
    momentIndex: 0,
    second: 1
  })
  expect(takeReviewPosition(moments, parts, 10)).toEqual({
    momentIndex: 2,
    second: 8
  })
  expect(takeReviewPosition(moments, parts, 12)).toEqual({
    momentIndex: 2,
    second: 10
  })
  expect(takeReviewPosition(moments, parts, 14)).toEqual({
    momentIndex: 2,
    second: 12
  })
})
it('holds the last completed part in a partial pass and rejects obsolete recording inputs', () => {
  expect(takeReviewPosition(moments, parts.slice(0, 1), 10.2)).toEqual({
    momentIndex: 0,
    second: 2
  })
  expect(
    takeReviewPosition(moments, [{ ...parts[0], recordingKey: 'changed' }], 5)
  ).toBeNull()
  expect(takeReviewPosition(moments, parts, NaN)).toBeNull()
  expect(takeReviewPosition(moments, [], 0)).toBeNull()
})
it('holds the last recorded card when review ends before unrecorded moments', async () => {
  const { movePlayhead } = await import('../app/moment-timeline')
  const playhead = {
    style: { left: '', transform: '' },
    parentElement: {
      clientLeft: 0,
      scrollLeft: 0,
      getBoundingClientRect: () => ({ left: 200 })
    }
  }
  const cards = [10, 130, 250].map((left) => ({
    getBoundingClientRect: () => ({ left: 200 + left, right: 300 + left })
  }))
  const root = {
    querySelector: (selector: string) =>
      selector === '.moment-playhead'
        ? playhead
        : cards[Number(selector.match(/data-moment="(\d+)"/)?.[1])]
  } as unknown as HTMLElement
  const at = takeReviewPosition(moments, parts.slice(0, 1), 10.2)!
  movePlayhead(root, moments, at.second, at.momentIndex)
  expect(playhead.style.transform).toBe('translate3d(109px,0,0)')
})

it('keeps the presenter visible at both paused review boundaries', async () => {
  const { reviewLayoutSecond } = await import('../app/take-review-clock')
  expect(reviewLayoutSecond(moments[2], 8, false)).toBeCloseTo(8.28)
  expect(reviewLayoutSecond(moments[2], 12, false)).toBeCloseTo(11.72)
  expect(reviewLayoutSecond(moments[2], 10, true)).toBe(10)
})
