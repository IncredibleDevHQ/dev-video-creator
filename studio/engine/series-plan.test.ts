import { expect, it } from 'vitest'
import { validateSeriesPlan } from './series-plan'

const pages = [
  { id: 'a', seconds: 30 },
  { id: 'b', seconds: 40 },
  { id: 'c', seconds: 35 },
  { id: 'd', seconds: 50 }
]
const episode = (title: string, ids: string[]) => ({
  title,
  about: `${title} in one line`,
  carries: 'what it hands on',
  pages: ids
})

it('accepts every page once, in episodes that fit the length', () => {
  const report = validateSeriesPlan(
    {
      arc: 'From one request to a pipeline',
      threads: ['the timer'],
      episodes: [episode('Why', ['a', 'b']), episode('How', ['c', 'd'])]
    },
    { pages, kept: [], length: { min: 45, max: 100, strict: true } }
  )
  expect(report.problems).toEqual([])
  expect(report.value.episodes.map((item) => item.pages)).toEqual([
    ['a', 'b'],
    ['c', 'd']
  ])
})

it('keeps the episodes that exist, and places every page or names it', () => {
  const report = validateSeriesPlan(
    {
      arc: 'x',
      episodes: [episode('New first', ['c']), episode('Why', ['a'])]
    },
    { pages, kept: [{ number: 1, pages: ['a', 'b'] }] }
  )
  const text = report.problems.join(' | ')
  expect(text).toMatch(/Episode 1 exists: keep its pages first/)
  expect(text).toMatch(/Place every page.*b, d/)
})

it('holds a strict length, and lets a flexible one through with a warning', () => {
  const plan = { arc: 'x', episodes: [episode('All', ['a', 'b', 'c', 'd'])] }
  const strict = validateSeriesPlan(plan, {
    pages,
    kept: [],
    length: { min: 30, max: 90, strict: true }
  })
  expect(strict.problems.join()).toMatch(/runs about 155 s.*split it/)
  const loose = validateSeriesPlan(plan, {
    pages,
    kept: [],
    length: { min: 30, max: 90, strict: false }
  })
  expect(loose.ok).toBe(true)
  expect(loose.warnings.join()).toMatch(/split it/)
})
