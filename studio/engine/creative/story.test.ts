import { expect, it } from 'vitest'
import { readSourceNarrative } from '../source-document'
import { validateCreativeStory } from './story'
import { narrativeById, storyPlanBrief } from '../../shared/narratives'
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

// With a template, the pages come from its beats.
const incident = narrativeById('incident')!
const short = storyPlanBrief(incident, { preset: 'short-dramatic' })
const told = (overrides: Record<number, object> = {}) => ({
  title: 'Token outage',
  scenes: [
    {
      kind: 'title',
      beats: ['impact'],
      seconds: 12,
      needs: [{ kind: 'numbers', what: 'how many failed', source: null }]
    },
    { kind: 'diagram', beats: ['timeline'], seconds: 20, needs: [] },
    {
      kind: 'diagram',
      beats: ['cause', 'fix'],
      seconds: 25,
      needs: [
        {
          kind: 'quote',
          what: 'the trigger',
          source: 'Requests wait when the bucket is empty.'
        }
      ]
    },
    { kind: 'close', beats: ['fix'], seconds: 10, needs: [] }
  ].map((scene, index) => ({
    title: `Scene ${index + 1}`,
    idea: 'A request uses a token.',
    narration: 'A request spends one token.',
    parts: [],
    relations: [],
    source: ['title', 'close'].includes(scene.kind)
      ? []
      : ['A request spends one token.'],
    ...scene,
    ...(overrides[index] || {})
  }))
})
const problems = (raw: unknown, story = short) =>
  validateCreativeStory(raw, source, story).problems

it('plans the pages from the template’s beats, within its page range', () => {
  expect(short.pages).toEqual([3, 6])
  expect(problems(told())).toEqual([])
  const many = told()
  many.scenes.splice(1, 0, ...Array(3).fill(many.scenes[1]))
  expect(problems(many)).toContain('This telling needs 3–6 pages for 45–90 s')
  // Without a template the old count still holds.
  expect(validateCreativeStory(told(), source).problems).toContain(
    'An outline needs 6–14 scenes'
  )
})

it('puts every core beat on a page, in the story’s order', () => {
  expect(problems(told({ 2: { beats: ['fix'] } }))).toContain(
    'No scene carries the core beat "Cause"'
  )
  expect(problems(told({ 1: { beats: ['zebra'] } }))).toContain(
    'Scene 2 names a beat the story does not have'
  )
  expect(problems(told({ 1: { beats: [] } }))).toContain(
    'Scene 2 needs the beats it carries'
  )
  // A briefing tells it in order; a cold open may start on a later beat.
  const briefing = storyPlanBrief(incident, {
    preset: 'briefing',
    length: [45, 90]
  })
  const back = told({ 0: { beats: ['fix', 'impact'] } })
  expect(problems(back)).toEqual([])
  expect(problems(back, briefing)).toContain(
    'Scene 2 goes back to an earlier beat; keep the story’s order'
  )
})

it('keeps the lengths in range and asks for evidence the source lacks', () => {
  expect(problems(told({ 2: { seconds: 90 } }))).toContain(
    'The scenes should add up to 45–90 s'
  )
  expect(
    problems(
      told({
        2: {
          needs: [{ kind: 'quote', what: 'the trigger', source: 'Made up.' }]
        }
      })
    )
  ).toContain(
    'Scene 3: evidence "the trigger" quotes the source wrongly; quote it exactly or leave source null to ask the creator'
  )
  expect(problems(told({ 1: { needs: undefined } }))).toContain(
    'Scene 2 needs its list of evidence needs'
  )
  const kept = validateCreativeStory(told(), source, short).value.scenes
  expect(kept[0].beats).toEqual(['impact'])
  expect(kept[0].needs).toEqual([
    { kind: 'numbers', what: 'how many failed', source: null }
  ])
  expect(kept[2].needs?.[0].source).toBe(
    'Requests wait when the bucket is empty.'
  )
})
