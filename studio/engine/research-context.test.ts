import { beforeEach, expect, it, vi } from 'vitest'
import type { ResearchNode } from '../shared/research'
import { ancestorTurns } from '../shared/research-conversations'
import {
  contextTokens,
  splitContext,
  researchContextPacket,
  researchContextTools
} from './research-context'
const fixtures = vi.hoisted(() => ({
  saved: new Map<string, unknown>(),
  summarize: vi.fn()
}))
vi.mock('./persistence', () => ({
  readRow: async (_: string, key: string) => fixtures.saved.get(key),
  writeRow: async (_: string, key: string, value: unknown) =>
    fixtures.saved.set(key, value),
  withOperationLock: async (_: string, fn: () => unknown) => fn()
}))
vi.mock('./creative/stage', () => ({
  runValidatedJsonStage: fixtures.summarize
}))
import { summarizeResearchAncestors } from './research-context-summary'
const turn = (
  id: string,
  parentId: string | null = null,
  answer = 'Evidence with qualifications and source: model.rs:12.'
): ResearchNode => ({
  id,
  parentId,
  chatId: 'chat',
  question: `Question ${id}`,
  answer,
  answerText: answer,
  harness: { adapter: 'codex' },
  repos: [],
  state: 'done',
  at: '2026-10-19'
})
beforeEach(() => {
  fixtures.saved.clear()
  fixtures.summarize.mockReset().mockImplementation(async (input) => {
    const data = JSON.parse(input.packet['packet/SUMMARY_INPUT.json'])
    return {
      summary: `${data.previousSummary} Source ${data.sourceTurnIds.join(',')}: retain qualifications; consult original evidence.`
    }
  })
})
it('sends only the new question on continuation, without repeated history or repository catalog', () => {
  const history = [turn('root')]
  const next = turn('next', 'root')
  const { recent, older } = splitContext(history, true)
  const built = researchContextPacket(next, history, true, '', recent)
  expect(older).toEqual([])
  expect(built.packet['packet/CONVERSATION.json']).toBe('[]')
  expect(built.packet['packet/REPOSITORIES.json']).toBe('[]')
  expect(Object.values(built.packet).join('')).not.toContain(history[0].answer)
  expect(built.contextInfo.mode).toBe('session-delta')
})
it('includes each full ancestor answer once and preserves the exact selected passage and offsets', () => {
  const root = turn('root')
  const next = turn('child', 'root')
  next.anchor = {
    kind: 'response',
    id: 'root',
    start: 0,
    end: 8,
    text: 'Evidence'
  }
  const built = researchContextPacket(next, [root], false, '', [root])
  expect(
    Object.values(built.packet).join('').split(root.answer).length - 1
  ).toBe(1)
  expect(JSON.parse(built.packet['packet/QUESTION.json']).selection).toEqual(
    next.anchor
  )
  expect(built.packet).not.toHaveProperty('packet/ACTIVE_DOCUMENT.json')
})
it('retrieves exact originals but refuses sibling and post-fork parent turns', async () => {
  const root = turn('root'),
    child = turn('child', 'root'),
    sibling = turn('sibling', 'root'),
    later = turn('later', 'root'),
    grandchild = turn('grandchild', 'child')
  const history = ancestorTurns(
    [root, child, sibling, later, grandchild],
    grandchild
  )
  expect(history.map((n) => n.id)).toEqual(['root', 'child'])
  const tool = researchContextTools(history)[0]
  const result = (await tool.call({ id: 'root', offset: 0, limit: 12000 })) as {
    text: string
    provenance: { repos: unknown[]; selection: unknown }
  }
  expect(JSON.parse(result.text).answer).toBe(root.answer)
  expect(result.provenance.repos).toEqual(root.repos)
  await expect(tool.call({ id: 'sibling' })).rejects.toThrow('outside')
  await expect(tool.call({ id: 'later' })).rejects.toThrow('outside')
})
it('bounds recent context by estimated tokens even for one very long answer', () => {
  const history = [
    turn('long', null, '文'.repeat(15000)),
    turn('recent', 'long')
  ]
  const split = splitContext(history, false)
  expect(split.older.map((n) => n.id)).toEqual(['long'])
  expect(split.recent.map((n) => n.id)).toEqual(['recent'])
  expect(contextTokens(JSON.stringify(split.recent))).toBeLessThan(6000)
})
it('caches reusable summary checkpoints without changing originals', async () => {
  const history = [turn('old', null, 'Evidence '.repeat(2200))]
  const before = JSON.stringify(history)
  const first = await summarizeResearchAncestors(
    history,
    turn('next'),
    'fixture',
    'http://fixture'
  )
  const calls = fixtures.summarize.mock.calls.length
  expect(calls).toBeGreaterThan(1)
  expect(
    await summarizeResearchAncestors(
      history,
      turn('other'),
      'fixture',
      'http://fixture'
    )
  ).toBe(first)
  expect(fixtures.summarize).toHaveBeenCalledTimes(calls)
  expect(JSON.stringify(history)).toBe(before)
  for (const [input] of fixtures.summarize.mock.calls)
    expect(input.packet['packet/SUMMARY_INPUT.json'].length).toBeLessThan(20000)
})
it('fails explicitly if summarization fails instead of silently dropping older context', async () => {
  fixtures.summarize.mockRejectedValueOnce(new Error('summary unavailable'))
  await expect(
    summarizeResearchAncestors(
      [turn('old')],
      turn('next'),
      'fixture',
      'http://fixture'
    )
  ).rejects.toThrow('summary unavailable')
  expect(fixtures.saved.size).toBe(0)
})
it('summary validation rejects empty or oversized output', async () => {
  await summarizeResearchAncestors(
    [turn('old')],
    turn('next'),
    'fixture',
    'http://fixture'
  )
  const { validate } = fixtures.summarize.mock.calls[0][0]
  expect(validate({ summary: '' }).ok).toBe(false)
  expect(validate({ summary: 'x'.repeat(8000) }).ok).toBe(false)
})
