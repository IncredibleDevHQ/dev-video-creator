import { expect, it } from 'vitest'
import { readSourceNarrative } from '../source-document'
import { validateCreativeStory } from './story'
const source = readSourceNarrative(
  'A request spends one token. The bucket refills over time. Requests wait when the bucket is empty.'
)
const outline = {
  title: 'Token bucket',
  scenes: Array.from({ length: 6 }, (_, index) => ({
    title: `Scene ${index + 1}`,
    kind: index === 0 ? 'title' : index === 5 ? 'close' : 'diagram',
    idea: 'A request uses a token.',
    narration: 'A request spends one token.',
    seconds: 12,
    parts: [],
    relations: [],
    source: index === 0 || index === 5 ? [] : ['A request spends one token.']
  }))
}
it('accepts a story whose evidence is retained in the source', () =>
  expect(validateCreativeStory(outline, source).ok).toBe(true))
it('refuses invented source quotations rather than silently sanitizing them', () => {
  const changed = structuredClone(outline)
  changed.scenes[1].source = ['The bucket processes 1000 requests per second.']
  expect(
    validateCreativeStory(changed, source).problems.some((problem) =>
      problem.includes('not in the retained source')
    )
  ).toBe(true)
})
it('requires an opening, ending, spoken draft and evidence for body scenes', () => {
  const changed = structuredClone(outline)
  changed.scenes[0].kind = 'diagram'
  changed.scenes[2].source = []
  changed.scenes[3].narration = ''
  const report = validateCreativeStory(changed, source)
  expect(report.ok).toBe(false)
  expect(report.problems.length).toBeGreaterThanOrEqual(3)
})
