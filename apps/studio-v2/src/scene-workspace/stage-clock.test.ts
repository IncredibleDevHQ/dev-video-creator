import { describe, expect, it } from 'vitest'
import { atStageEnd, lastFrameOf } from './stage-clock'

// F07 of the project-flow fix verification: a 31.204 s produced scene
// stopped at its last frame, 31.2 s, and the player never said it ended.
describe('a scene\'s end on the stage', () => {
  it('is reached at the last frame, whether or not the clock is a whole number of frames', () => {
    expect(atStageEnd(936 / 30, 31.204)).toBe(true)
    expect(atStageEnd(935 / 30, 31.204)).toBe(false)
    expect(atStageEnd(936 / 30, 31.2)).toBe(true)
    expect(atStageEnd(935 / 30, 31.2)).toBe(false)
    expect(atStageEnd(31.204, 31.204)).toBe(true)
    expect(atStageEnd(0, 0)).toBe(false)
    expect(atStageEnd(Number.NaN, 4)).toBe(false)
  })
  it('holds the last frame anything is drawn on — never the blank end of a half-open clip', () => {
    expect(lastFrameOf(31.204)).toBeCloseTo(31.2, 9)
    expect(lastFrameOf(31.2)).toBeCloseTo(935 / 30, 9)
    expect(lastFrameOf(6)).toBeCloseTo(179 / 30, 9)
    expect(lastFrameOf(0.01)).toBe(0)
    expect(lastFrameOf(0)).toBe(0)
  })
})
