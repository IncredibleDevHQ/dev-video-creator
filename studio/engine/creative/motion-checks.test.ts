import { expect, it } from 'vitest'
import {
  motionDefects,
  motionProblems,
  poseChange,
  type Pose
} from './motion-checks'

// Synthetic samples: a card at a place, with an opacity out of 20.
const card = (left: number, alpha = 20, words = 'Seek point') =>
  [left, 100, 300, 160, alpha, 0, words, 'rgb(235, 239, 250)'] as NonNullable<
    Pose['elements'][number]
  >
const pose = (...elements: Pose['elements']): Pose => ({
  media: false,
  elements
})
const moment = (seconds: number) => ({ id: 'm2', start: 5, end: 5 + seconds })

it('tells a visible change from a slight one and from none', () => {
  expect(poseChange(pose(card(100)), pose(card(100)))).toBe('same')
  // A jitter or a slow drift keeps a frame alive, but develops nothing.
  expect(poseChange(pose(card(100)), pose(card(103)))).toBe('slight')
  expect(poseChange(pose(card(100)), pose(card(160)))).toBe('visible')
  expect(poseChange(pose(null), pose(card(100)))).toBe('visible')
  expect(poseChange(pose(card(100, 4)), pose(card(100, 20)))).toBe('visible')
  expect(
    poseChange(pose(card(100)), pose(card(100, 20, 'Seek point 5.8 s')))
  ).toBe('visible')
})

it('refuses a moment that arrives at its start and then holds', () => {
  // Seen live: one entrance in the first second, then 8 s of one frame.
  const samples = [
    pose(null),
    pose(card(100, 10)),
    ...Array.from({ length: 18 }, () => pose(card(100)))
  ]
  const defects = motionDefects(moment(10), samples)
  expect(defects.map((defect) => defect.kind)).toEqual(['frozen', 'sparse'])
  expect(defects[0].message).toBe(
    'm2 holds one still frame for 8.5 s (1 s to 9.5 s into the moment)'
  )
  expect(motionProblems(defects)[0]).toContain('CLOCK.json cues')
})

it('accepts a moment that develops as its voice goes on', () => {
  // A new part every two seconds, the last one held briefly to be read.
  const samples = Array.from({ length: 20 }, (_, index) =>
    pose(
      card(100),
      index >= 3 ? card(500) : null,
      index >= 7 ? card(900) : null,
      index >= 11 ? card(1300) : null,
      index >= 15 ? card(1700) : null
    )
  )
  expect(motionDefects(moment(10), samples)).toEqual([])
})

it('counts a jitter as alive but not as development, and lets video move', () => {
  const jitter = Array.from({ length: 20 }, (_, index) =>
    pose(card(100 + (index % 2)))
  )
  expect(motionDefects(moment(10), jitter).map((d) => d.kind)).toEqual([
    'sparse'
  ])
  const video = Array.from({ length: 20 }, () => ({
    media: true,
    elements: [card(100)]
  }))
  expect(motionDefects(moment(10), video)).toEqual([])
})
