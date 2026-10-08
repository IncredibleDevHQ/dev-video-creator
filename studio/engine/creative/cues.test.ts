import { expect, it } from 'vitest'
import { phrasesOf, spokenCues } from './cues'

it('splits a moment into the phrases a beat can land on', () => {
  expect(
    phrasesOf([
      'It seeks the composition to a fifth of a second before the moment ends — after the animation has landed — so what gets checked is the picture the viewer sees.',
      'Then it measures. Every piece.'
    ])
  ).toEqual([
    'It seeks the composition to a fifth of a second before the moment ends',
    'after the animation has landed',
    'so what gets checked is the picture the viewer sees.',
    'Then it measures. Every piece.'
  ])
})

it('places each phrase by its share of the words, on the build’s clock', () => {
  const cues = spokenCues(['One two three four. Five six seven eight.'], 10, 18)
  expect(cues).toEqual([
    { at: 10, says: 'One two three four.' },
    { at: 13.8, says: 'Five six seven eight.' }
  ])
  expect(spokenCues([''], 0, 4)).toEqual([])
  expect(spokenCues(['Words here.'], 4, 4)).toEqual([])
})
