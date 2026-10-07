import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
// Jev is a stand-in here: these checks prove the plumbing, not the model.
const root = await mkdtemp(join(tmpdir(), 'minimal-template-suggest-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { askJev } = await import('./jev')
const { checkCoverage, readSuggestion, suggestTemplate, suggestionQuestions } =
  await import('./template-suggest')
const { lengthForWords, suggestedDirection } =
  await import('../shared/narratives')
afterAll(() => rm(root, { recursive: true, force: true }))
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.TYPESAFE_API_KEY
})

const answers = (confidence: number) => ({
  narrative: {
    type: 'choice',
    choice: 'incident',
    probabilities: { incident: 0.7, debugging: 0.2, retro: 0.1 },
    confidence
  },
  direction: {
    type: 'choice',
    choice: 'short-dramatic',
    probabilities: { 'short-dramatic': 0.8 },
    confidence: 0.8
  },
  length: {
    type: 'choice',
    choice: 'l120-240',
    probabilities: { 'l120-240': 0.7 },
    confidence: 0.7
  },
  audience: {
    type: 'choice',
    choice: 'customers',
    probabilities: { customers: 0.4 },
    confidence: 0.4
  },
  elaboration: {
    type: 'score',
    score: 2,
    legend: {},
    probabilities: {},
    confidence: 0.9
  },
  drama: {
    type: 'score',
    score: 1,
    legend: {},
    probabilities: {},
    confidence: 0.9
  },
  evidence_numbers: { type: 'noul', noul: 0.91 },
  evidence_code: { type: 'noul', noul: 0.12 }
})
const jev = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

it('asks one question per template, direction, length and kind of evidence', () => {
  const questions = suggestionQuestions()
  expect(
    Object.keys((questions.narrative as { criteria: object }).criteria)
  ).toHaveLength(61)
  expect(
    Object.keys(questions).filter((key) => key.startsWith('evidence_'))
  ).toHaveLength(9)
  expect(questions.elaboration).toMatchObject({ type: 'score' })
})

it('reads Jev’s answers as a suggestion, keeping only what it is sure of', () => {
  const suggestion = readSuggestion(answers(0.8) as never, 'now')!
  expect(suggestion).toMatchObject({
    narratives: [
      { id: 'incident', p: 0.7 },
      { id: 'debugging', p: 0.2 },
      { id: 'retro', p: 0.1 }
    ],
    confidence: 0.8,
    preset: 'short-dramatic',
    length: [120, 240],
    audience: null,
    evidence: { numbers: 0.91, code: 0.12 },
    elaboration: 'thorough',
    drama: 'lively'
  })
  // The direction keeps only what differs from the suggested preset.
  expect(suggestedDirection('incident', suggestion)).toEqual({
    preset: 'short-dramatic',
    length: [120, 240]
  })
  // Security excludes Short and dramatic: its default is kept.
  expect(suggestedDirection('security', suggestion).preset).toBe('briefing')
  expect(readSuggestion({})).toBeNull()
  // Unsure of the direction and the length: the template's own preset, and
  // a length the source's size supports (60 words, under two minutes).
  const unsure = readSuggestion(
    {
      ...answers(0.9),
      direction: { ...answers(0.9).direction, confidence: 0.4 },
      length: { ...answers(0.9).length, confidence: 0.3 }
    } as never,
    'now',
    60
  )!
  expect(unsure).toMatchObject({ preset: 'briefing', length: [45, 90] })
  expect(lengthForWords(287)).toEqual([120, 240])
  expect(lengthForWords(800)).toEqual([360, 600])
  expect(lengthForWords(10)).toEqual([45, 90])
})

it('needs a key, and retries a busy Jev before giving up', async () => {
  await expect(askJev({}, {})).rejects.toThrow('Jev is not set up')
  process.env.TYPESAFE_API_KEY = 'test-key'
  const busy = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 529 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ answers: { a: 1 } })))
  vi.stubGlobal('fetch', busy)
  expect(await askJev({}, {}, { pause: 1 })).toEqual({ a: 1 })
  expect(busy).toHaveBeenCalledTimes(2)
  const [, init] = busy.mock.calls[0] as [string, RequestInit]
  expect((init.headers as Record<string, string>).authorization).toBe(
    'Bearer test-key'
  )
  vi.stubGlobal('fetch', jev({}, 401))
  await expect(askJev({}, {})).rejects.toThrow('Jev refused the key')
})

const seed = async (id: string, project: Partial<Snapshot['project']> = {}) => {
  await writeRow('sources', id, {
    title: 'Outage',
    text: 'At 14:02 the API failed for 41% of requests.'
  })
  await writeRow('projects', id, {
    project: {
      id,
      title: 'Outage',
      source: '',
      slides: [],
      video: null,
      ...project
    },
    status: 'draft',
    error: null,
    events: []
  } satisfies Snapshot)
}

it('preselects a sure template, and leaves an unsure one to the creator', async () => {
  process.env.TYPESAFE_API_KEY = 'test-key'
  await seed('sure')
  vi.stubGlobal('fetch', jev({ answers: answers(0.8) }))
  const sure = await suggestTemplate('sure')
  expect(sure.project).toMatchObject({
    narrative: 'incident',
    direction: { preset: 'short-dramatic', length: [120, 240] }
  })
  expect(sure.suggestion?.preselected).toBe(true)
  await seed('unsure')
  vi.stubGlobal('fetch', jev({ answers: answers(0.4) }))
  const unsure = await suggestTemplate('unsure')
  expect(unsure.project.narrative).toBeUndefined()
  expect(unsure.suggestion?.narratives).toHaveLength(3)
  // A template the creator chose is never replaced.
  await seed('chosen', { narrative: 'launch' })
  vi.stubGlobal('fetch', jev({ answers: answers(0.95) }))
  expect((await suggestTemplate('chosen')).project.narrative).toBe('launch')
})

it('reads which beat each wireframe carries', async () => {
  process.env.TYPESAFE_API_KEY = 'test-key'
  await seed('pages', {
    narrative: 'incident',
    slides: [
      { id: 'a', title: 'Impact', svg: '<svg/>', beats: ['impact'] },
      { id: 'b', title: 'Why', svg: '<svg/>', beats: ['cause'] }
    ]
  })
  const reading = jev({
    answers: {
      page_1: {
        type: 'choice',
        choice: 'impact',
        probabilities: {},
        confidence: 0.9
      },
      page_2: {
        type: 'choice',
        choice: 'fix',
        probabilities: {},
        confidence: 0.7
      }
    }
  })
  vi.stubGlobal('fetch', reading)
  const checked = await checkCoverage('pages')
  expect(checked?.coverageReading?.pages).toEqual({
    a: { beat: 'impact', confidence: 0.9 },
    b: { beat: 'fix', confidence: 0.7 }
  })
  const [, init] = reading.mock.calls[0] as unknown as [string, RequestInit]
  const sent = JSON.parse(String(init.body))
  expect(Object.keys(sent.questions.page_2.criteria)).toContain('none')
})
