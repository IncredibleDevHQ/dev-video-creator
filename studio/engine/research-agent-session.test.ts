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
