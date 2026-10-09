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
  // A sparse moment says how many changes it is short.
  expect(defects[1].short).toBeGreaterThan(0)
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

it('finds an empty frame while the voice speaks, and words the edge cuts', async () => {
  const { motionDefects } = await import('./motion-checks')
  type Item = [number, number, number, number, number, number, string, string]
  const ground: Item = [0, 0, 1920, 1080, 20, 0, '', 'white']
  const word = (text: string, x: number, y = 500): Item => [
    x,
    y,
    320,
    60,
    20,
    0,
    text,
    'black'
  ]
  const pose = (...items: Item[]) => ({
    media: false,
    frame: [1920, 1080] as [number, number],
    elements: [ground, ...items]
  })
  const moment = { id: 'm1', start: 0, end: 6 }
  // One word, then nothing for two seconds, then the model.
  const opening = [
    pose(word('What', 800)),
    pose(),
    pose(),
    pose(),
    pose(),
    pose(word('The model', 700)),
    pose(word('The model', 700)),
    pose(word('The model', 700)),
    pose(word('The model', 700)),
    pose(word('The model', 760)),
    pose(word('The model', 820)),
    pose(word('The model', 880))
  ]
  expect(motionDefects(moment, opening).map((d) => d.kind)).toContain('empty')
  // A push-in that leaves a label half outside the frame.
  const pushed = Array.from({ length: 12 }, (_, i) =>
    pose(
      word('augmented LLM', i < 6 ? 400 + i * 40 : -120),
      word('Memory', 900 + i * 30)
    )
  )
  const cut = motionDefects(moment, pushed).find((d) => d.kind === 'cut')
  expect(cut?.message).toContain('“augmented LLM”')
  // In view but crowding the edge, held through the move: outside the safe
  // area, as at a moment's end. Inside it, the label is fine.
  const crowded = (x: number) =>
    Array.from({ length: 12 }, (_, i) =>
      pose(
        word('Retrieval', i < 4 ? 1000 + i * 50 : x),
        word('Memory', 500 + i * 40)
      )
    )
  const kinds = (x: number) =>
    motionDefects(moment, crowded(x)).map((defect) => defect.kind)
  expect(kinds(1920 - 320 - 6)).toContain('cut')
  expect(kinds(1920 - 320 - 40)).not.toContain('cut')
})

it('judges the words themselves, not a full-width text block, and excuses what is cut on purpose', async () => {
  const { motionDefects } = await import('./motion-checks')
  // A centred title in a block as wide as the frame: its box touches both
  // edges, its words sit well inside.
  const title = [0, 0, 1920, 140, 20, 0, 'A centred title', 'black'] as [
    number,
    number,
    number,
    number,
    number,
    number,
    string,
    string
  ]
  const pose = (
    words: Array<[number, number, number, number, string, number]>
  ) => ({
    media: false,
    frame: [1920, 1080] as [number, number],
    elements: [title],
    words
  })
  const still = (
    words: Array<[number, number, number, number, string, number]>
  ) =>
    motionDefects(
      { id: 'm1', start: 0, end: 3 },
      Array.from({ length: 6 }, () => pose(words))
    ).map((defect) => defect.kind)
  expect(still([[766, 60, 388, 74, 'A centred title', 0]])).not.toContain('cut')
  // Words past the edge on purpose (data-intentional) are the scene's.
  expect(still([[-40, 900, 155, 37, 'cut caption', 1]])).not.toContain('cut')
  expect(still([[-40, 900, 155, 37, 'cut caption', 0]])).toContain('cut')
})
