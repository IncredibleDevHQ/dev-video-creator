import { expect, it } from 'vitest'
import { wordAt, transcriptWords } from '../app/transcript-follow'
it('follows the measured moment clock and seeks back without exceeding its words', () => {
  expect(wordAt('one two three four', 10, 18, 9)).toBe(-1)
  expect(wordAt('one two three four', 10, 18, 10)).toBe(0)
  expect(wordAt('one two three four', 10, 18, 14)).toBe(2)
  expect(wordAt('one two three four', 10, 18, 30)).toBe(3)
  expect(wordAt('one two three four', 10, 18, 12)).toBe(1)
  expect(wordAt('', 0, 1, 0)).toBe(-1)
})
it('keeps whitespace and punctuation and escapes source text', () => {
  expect(transcriptWords('  Hello, <you>! ')).toBe(
    '  <span data-transcript-word>Hello,</span> <span data-transcript-word>&lt;you&gt;!</span> '
  )
})
