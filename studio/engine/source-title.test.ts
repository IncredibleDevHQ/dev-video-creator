import { expect, it } from 'vitest'
import { removeRepeatedTitle } from '../shared/source-title'
it('shows the article heading once and retains its publication date', () => {
  expect(
    removeRepeatedTitle(
      'Introducing canvas October 3, 2024\n\n# Introducing canvas\n\nArticle',
      'Introducing canvas'
    )
  ).toBe('October 3, 2024\n\n# Introducing canvas\n\nArticle')
})
it('does not remove prose that merely starts with the article title', () => {
  const text = 'Canvas helps you write.\n\n# Canvas\n\nArticle'
  expect(removeRepeatedTitle(text, 'Canvas')).toBe(text)
})
it('keeps a different heading and removes an exact repeated heading', () => {
  expect(removeRepeatedTitle('Canvas\n\n# Canvas\nBody', 'Another title')).toBe(
    'Canvas\n\n# Canvas\nBody'
  )
  expect(removeRepeatedTitle('Canvas\n\n# Canvas\nBody')).toBe('# Canvas\nBody')
})

it('handles the reader putting the title and date on separate lines', () => {
  expect(
    removeRepeatedTitle(
      '\nIntroducing canvas\nOctober 3, 2024\n\n# Introducing canvas\n\nArticle',
      'Introducing canvas'
    )
  ).toBe('October 3, 2024\n\n# Introducing canvas\n\nArticle')
})
