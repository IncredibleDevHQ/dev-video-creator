import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import type { ResearchNode } from '../shared/research'
import type { EngineRun } from './harness/runtime'
const root = await mkdtemp(join(tmpdir(), 'research-native-session-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { prepareResearchSession, finishResearchSession } =
  await import('./research-agent-session')
afterAll(() => rm(root, { recursive: true, force: true }))
const node = (id: string, parentId: string | null = null): ResearchNode => ({
  id,
  parentId,
  chatId: 'chat',
  question: 'Question',
  answer: '',
  answerText: '',
  harness: { adapter: 'kimi' },
  repos: [],
  at: new Date().toISOString(),
  state: 'working'
})
const done = { status: 'done', resumeId: 'native-id' } as EngineRun
it('continues accepted linear turns, isolates siblings and rejects stale completions', async () => {
  const first = await prepareResearchSession('project', node('a'))
  await finishResearchSession(first, 'a', done)
  const next = await prepareResearchSession('project', node('b', 'a'))
  expect(next.mode).toBe('continued')
  expect(next.workspaceId).toBe(first.workspaceId)
  expect(next.resumeId).toBe('native-id')
  const retry = await prepareResearchSession('project', node('c', 'a'))
  expect(retry.workspaceId).not.toBe(next.workspaceId)
  await finishResearchSession(next, 'b', done)
  await finishResearchSession(retry, 'c', done)
  const sibling = await prepareResearchSession('project', node('d', 'a'))
  expect(sibling.mode).toBe('branched')
  expect(sibling.resumeId).toBeUndefined()
})
it('starts a fresh native session when the model or repository context changes', async () => {
  const initial = await prepareResearchSession('project', node('start'))
  await finishResearchSession(initial, 'start', done)
  const changed = node('changed', 'start')
  changed.harness.model = 'another-model'
  expect(
    (await prepareResearchSession('project', changed)).resumeId
  ).toBeUndefined()
})
it('preserves native conversation context when only thinking effort changes', async () => {
  const first = node('effort-start')
  first.harness.effort = 'low'
  const initial = await prepareResearchSession('project', first)
  await finishResearchSession(initial, first.id, done)
  const next = node('effort-next', first.id)
  next.harness.effort = 'max'
  const continued = await prepareResearchSession('project', next)
  expect(continued.resumeId).toBe('native-id')
  expect(continued.workspaceId).toBe(initial.workspaceId)
})
it('retains each recursive branch cursor and resumes the parent after backtracking', async () => {
  const a = { ...node('root-turn'), conversationId: 'root-turn' }
  const rootPlan = await prepareResearchSession('recursive', a)
  await finishResearchSession(rootPlan, a.id, {
    ...done,
    resumeId: 'root-native'
  })
  const b = {
    ...node('branch', a.id),
    conversationId: 'branch',
    anchor: {
      kind: 'response' as const,
      id: a.id,
      start: 0,
      end: 4,
      text: 'test'
    }
  }
  const branch = await prepareResearchSession('recursive', b)
  expect(branch.resumeId).toBeUndefined()
  expect(branch.workspaceId).not.toBe(rootPlan.workspaceId)
  await finishResearchSession(branch, b.id, {
    ...done,
    resumeId: 'branch-native'
  })
  const c = {
    ...node('nested', b.id),
    conversationId: 'nested',
    anchor: { ...b.anchor, id: b.id }
  }
  const nested = await prepareResearchSession('recursive', c)
  expect(nested.resumeId).toBeUndefined()
  await finishResearchSession(nested, c.id, {
    ...done,
    resumeId: 'nested-native'
  })
  expect(
    (
      await prepareResearchSession('recursive', {
        ...node('root-reply', a.id),
        conversationId: a.id
      })
    ).resumeId
  ).toBe('root-native')
  expect(
    (
      await prepareResearchSession('recursive', {
        ...node('branch-reply', b.id),
        conversationId: b.id
      })
    ).resumeId
  ).toBe('branch-native')
})
it('returns to an earlier branch native session after exploring a child', async () => {
  const root = { ...node('return-root'), conversationId: 'return-root' }
  const rootPlan = await prepareResearchSession('return-project', root)
  await finishResearchSession(rootPlan, root.id, {
    ...done,
    resumeId: 'root-native'
  })
  const child = {
    ...node('return-child', root.id),
    conversationId: 'return-child',
    anchor: {
      kind: 'response' as const,
      id: root.id,
      text: 'passage',
      start: 0,
      end: 7
    }
  }
  const childPlan = await prepareResearchSession('return-project', child)
  await finishResearchSession(childPlan, child.id, {
    ...done,
    resumeId: 'child-native'
  })
  const resumed = await prepareResearchSession('return-project', {
    ...node('return-reply', root.id),
    conversationId: root.id
  })
  expect(resumed.resumeId).toBe('root-native')
  expect(resumed.workspaceId).toBe(rootPlan.workspaceId)
})
it('re-seeds an oversized native conversation without deleting ancestor records', async () => {
  const root = { ...node('large-root'), conversationId: 'large-root' }
  const plan = await prepareResearchSession('large-project', root)
  await finishResearchSession(plan, root.id, done)
  const history = [{ ...root, answer: 'x'.repeat(40000) }]
  const next = await prepareResearchSession(
    'large-project',
    { ...node('large-next', root.id), conversationId: root.id },
    history
  )
  expect(next.resumeId).toBeUndefined()
  expect(next.workspaceId).not.toBe(plan.workspaceId)
  expect(history[0].answer.length).toBe(40000)
})
