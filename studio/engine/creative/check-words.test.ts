import { expect, it } from 'vitest'
import { plainCheck } from './check-words'

// The checker names moments by id and says how to fix what it found; the
// creator reads the finding alone, its moments by number.
const moments = [
  { id: 'scene-a1-moment-0f3c' },
  { id: 'scene-a1-moment-9be2' },
  { id: 'scene-a1-moment-41aa' }
]

it('says what a check found in plain words, its moments by number', () => {
  expect(
    plainCheck(
      'scene-a1-moment-41aa changes its picture once in 12 s: give each idea its own visible change',
      moments
    )
  ).toBe('Moment 3 needs two more visible changes')
  expect(
    plainCheck(
      'scene-a1-moment-9be2 changes its picture 2 times in 12.4 s: give each idea',
      moments
    )
  ).toBe('Moment 2 needs one more visible change')
  expect(
    plainCheck(
      'scene-a1-moment-0f3c holds one still frame for 4.5 s (2 s to 6.5 s into the moment): develop the picture',
      moments
    )
  ).toBe('Moment 1 holds one picture still for 4.5 s')
  expect(
    plainCheck(
      'scene-a1-moment-0f3c shows an empty frame for 1.5 s (0 s into the moment) while the voice speaks: keep',
      moments
    )
  ).toBe('Moment 1 shows an empty frame for 1.5 s')
  expect(
    plainCheck(
      'scene-a1-moment-9be2 cuts “augmented LLM” at the frame’s edge (3 s into the moment): keep a push-in’s target',
      moments
    )
  ).toBe('Moment 2 cuts “augmented LLM” at the frame’s edge')
  expect(
    plainCheck(
      'At the end of scene-a1-moment-0f3c, scene-a1-moment-41aa, “Retrieval” is cut by the left edge: move it in',
      moments
    )
  ).toBe(
    'At the end of moment 1, moment 3, “Retrieval” is cut by the left edge'
  )
  // A moment it doesn't know is still not shown by its id.
  expect(
    plainCheck('scene-zz-moment-77ab holds one still frame for 4 s', moments)
  ).toBe('A moment holds one still frame for 4 s')
})
