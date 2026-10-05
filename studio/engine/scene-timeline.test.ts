import { expect, it, vi } from 'vitest'
import type { Moment, Scene } from '../shared/model'
vi.mock('../app/api', () => ({ api: {} }))
const { animationAt, sceneParts, sceneWords, steerAnimation } =
  await import('../app/scene-timeline')

// A synthetic scene of three moments: the second runs on past its
// animation (extra dialogue), so the animation holds its last frame there.
const moment = (
  id: string,
  start: number,
  end: number,
  lines: string
): Moment => ({
  id,
  lines,
  start,
  end,
  camera: 'none',
  layout: 'corner',
  overlay: null,
  recordingKey: 'r',
  take: null,
  audio: null,
  audioKey: 'a'
})
const scene: Scene = {
  id: 'scene',
  slideId: 'slide',
  phase: 'waiting',
  presence: null,
  moments: [
    moment('m1', 0, 4, 'One two, three.'),
    {
      ...moment('m2', 4, 10, 'Four five.'),
      extension: {
        text: 'And six more.',
        seconds: 2,
        baseSeconds: 4,
        baseLines: 'Four five.',
        baseSegments: []
      }
    } as Moment,
    moment('m3', 10, 12, 'Seven.')
  ],
  inputKey: 'i',
  produced: null,
  error: null,
  animation: {
    inputKey: 'k',
    objectKey: 'animation.mp4',
    moments: [
      { id: 'm1', start: 0, end: 4 },
      { id: 'm2', start: 4, end: 8 },
      { id: 'm3', start: 8, end: 10 }
    ]
  },
  animationKey: 'k'
} as Scene

it('plays the animation straight on, holding only past a moment’s animation', () => {
  expect(animationAt(scene, 2)).toMatchObject({
    index: 0,
    holding: false,
    target: 2,
    rate: 1
  })
  // Into the next moment without a stop.
  expect(animationAt(scene, 4.5)).toMatchObject({ index: 1, target: 4.5 })
  // The second moment's words run on past its animation: the frame holds.
  expect(animationAt(scene, 9)).toMatchObject({
    index: 1,
    holding: true,
    target: 7.96
  })
  expect(animationAt(scene, 10.5)).toMatchObject({ index: 2, target: 8.5 })
})

const player = (time: number, paused: boolean) => ({
  currentTime: time,
  paused,
  seeking: false,
  playbackRate: 1,
  pause: vi.fn(function (this: { paused: boolean }) {
    this.paused = true
  }),
  play: vi.fn(function (this: { paused: boolean }) {
    this.paused = false
    return Promise.resolve()
  })
})

it('keeps the animation on the scene’s clock without jumping', () => {
  // Paused, it shows the frame for the second.
  const still = player(0, false)
  expect(steerAnimation(still as never, scene, 2, false, true)).toEqual({
    rolling: false,
    stopped: false
  })
  expect([still.paused, still.currentTime]).toEqual([true, 2])
  // A little behind while playing, it plays a touch faster to catch up.
  const behind = player(1.8, true)
  expect(steerAnimation(behind as never, scene, 2, true, false)).toEqual({
    rolling: true,
    stopped: false
  })
  expect(behind.play).toHaveBeenCalled()
  expect(behind.currentTime).toBe(1.8)
  expect(behind.playbackRate).toBeCloseTo(1.12)
  // Far off, it jumps.
  const lost = player(0, false)
  steerAnimation(lost as never, scene, 3, true, true)
  expect(lost.currentTime).toBe(3)
  // Paused from outside while it should roll: the caller says so.
  expect(
    steerAnimation(player(2, true) as never, scene, 2, true, true)
  ).toEqual({ rolling: true, stopped: true })
  // Holding past a moment's animation, it stops on that frame.
  const held = player(7.9, false)
  steerAnimation(held as never, scene, 9, true, true)
  expect([held.paused, held.currentTime]).toEqual([true, 7.96])
})

it('draws the whole scene as one timeline, its moments cut apart', () => {
  const parts = sceneParts(scene.moments, 12, 50, true)
  expect(parts.ruler).toContain('>0:00<')
  expect(parts.moments.match(/data-ds-moment="\d"/g)).toHaveLength(3)
  // The second moment's held part is marked.
  expect(parts.moments).toContain('class="ds-moment-hold" style="left:66.')
  expect(parts.cuts.match(/<i /g)).toHaveLength(2)
  expect(parts.phrases).toContain('data-jump="4"')
  const words = sceneWords(scene.moments)
  expect(words.starts).toEqual([0, 3, 8])
})
