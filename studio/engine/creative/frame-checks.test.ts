import { expect, it } from 'vitest'
import {
  frameDefects,
  settledProblems,
  type FrameBox,
  type FrameMeasure
} from './frame-checks'

const frame: FrameBox = { left: 0, top: 0, right: 1920, bottom: 1080 }
const at = (left: number, top: number, w: number, h: number): FrameBox => ({
  left,
  top,
  right: left + w,
  bottom: top + h
})
const measure = (parts: Partial<FrameMeasure>): FrameMeasure => ({
  frame,
  texts: [],
  shapes: [],
  ...parts
})
const messages = (parts: Partial<FrameMeasure>) =>
  frameDefects(measure(parts)).map((defect) => defect.message)

it('finds what the frame’s edge cuts, and leaves lines and the unseen alone', () => {
  expect(
    messages({
      shapes: [{ tag: 'path', box: at(-40, 400, 120, 120), layer: 'script' }],
      texts: [
        { text: 'runaway script', box: at(1800, 500, 200, 50), layer: 'labels' }
      ]
    })
  ).toEqual([
    'script is cut by the left edge',
    '“runaway script” is cut by the right edge'
  ])
  // Wholly outside is waiting off stage; a line may run off the edge.
  expect(
    messages({
      shapes: [
        { tag: 'path', box: at(-400, 400, 120, 120), layer: 'script' },
        { tag: 'path', box: at(-200, 420, 1400, 4), layer: 'route' }
      ]
    })
  ).toEqual([])
})

it('finds words on a shape they do not belong to, but not inside a card', () => {
  const packet = { tag: 'circle', box: at(500, 400, 36, 36), layer: 'packets' }
  const label = {
    text: 'cap: N requests / s',
    box: at(480, 395, 420, 50),
    layer: 'labels'
  }
  expect(messages({ shapes: [packet], texts: [label] })).toEqual([
    '“cap: N requests / s” sits on packets'
  ])
  const card = { tag: 'rect', box: at(400, 300, 700, 300), layer: 'flood' }
  expect(messages({ shapes: [card], texts: [label] })).toEqual([])
  // The card's own words, and a shape of the label's own layer, are fine.
  expect(
    messages({
      shapes: [{ ...packet, layer: 'labels' }],
      texts: [label]
    })
  ).toEqual([])
})

it('finds labels on each other and boxes with nothing in them', () => {
  expect(
    messages({
      texts: [
        { text: 'slots left: 0', box: at(600, 600, 300, 50), layer: 'labels' },
        {
          text: 'request rate limiter',
          box: at(620, 610, 360, 46),
          layer: 'labels'
        }
      ]
    })
  ).toEqual(['“slots left: 0” overlaps “request rate limiter”'])
  const empty = { tag: 'rect', box: at(300, 100, 350, 200), layer: 'flood' }
  expect(messages({ shapes: [empty] })).toEqual(['an empty box in flood'])
  expect(
    messages({
      shapes: [empty],
      texts: [
        { text: 'Request flood', box: at(340, 150, 260, 50), layer: 'flood' }
      ]
    })
  ).toEqual([])
  // A backdrop, or a bar, is not a box to fill.
  expect(
    messages({
      shapes: [
        { tag: 'rect', box: at(0, 0, 1920, 1080), layer: 'backdrop' },
        { tag: 'rect', box: at(300, 900, 600, 24), layer: 'progress' }
      ]
    })
  ).toEqual([])
})

it('says each defect once, with the moments it spans and what to do', () => {
  const cut = {
    kind: 'cut' as const,
    message: 'script is cut by the left edge'
  }
  const empty = { kind: 'empty' as const, message: 'an empty box in flood' }
  expect(
    settledProblems([
      { moment: 'm1', defects: [cut] },
      { moment: 'm2', defects: [cut, empty] },
      { moment: 'm3', defects: [] }
    ])
  ).toEqual([
    'At the end of m1, m2, script is cut by the left edge: keep it, and the camera’s framing, at least 48 px inside the frame',
    'At the end of m2, an empty box in flood: give the box its words (VISUAL_CAST.json meaning.label) and its artwork, or leave it out'
  ])
})
