import { expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { EngineRun } from './harness/runtime'
const { runs } = vi.hoisted(() => ({ runs: [] as any[] }))
vi.mock('./persistence', () => ({
  listNotebookRows: vi.fn(async () => runs.map((run) => run.id)),
  readRow: vi.fn(async (_: string, id: string) =>
    runs.find((run) => run.id === id)
  )
}))
const { withProgress } = await import('./progress')
const snapshot = (): Snapshot => ({
  status: 'ready',
  error: null,
  events: [],
  project: {
    id: 'p',
    title: 'Fixture',
    source: '',
    slides: [],
    video: {
      settings: { presence: 'off', voice: { kind: 'ai', id: 'default' } },
      transitions: [],
      inputKey: '',
      produced: null,
      scenes: [
        {
          id: 's',
          slideId: 'slide',
          phase: 'producing',
          presence: null,
          moments: [],
          inputKey: '',
          produced: null,
          error: null
        }
      ]
    }
  }
})
const run = (
  id: string,
  status: EngineRun['status'],
  operation: string,
  startedAt: string
) => ({
  id,
  sceneId: 's',
  projectId: 'p',
  stage: 'composition',
  status,
  startedAt,
  events: [
    {
      type: 'tool',
      operation,
      tool: 'A private command must not reach the UI',
      ts: Date.parse(startedAt)
    }
  ]
})
it('streams safe scene activity after the presentation is ready', async () => {
  runs.splice(
    0,
    runs.length,
    run('r', 'running', 'edit', '2026-10-01T00:00:00Z')
  )
  const input = snapshot(),
    result = await withProgress(input)
  expect(result?.sceneProgress?.s).toEqual({
    stage: 'composition',
    active: true,
    label: 'Building the animation',
    updatedAt: '2026-10-01T00:00:00.000Z',
    // When the run began, for the running step's elapsed time.
    startedAt: expect.any(String)
  })
  expect(result?.progress).toBeUndefined()
  expect(JSON.stringify(result)).not.toContain('private command')
  expect(input.sceneProgress).toBeUndefined()
})
it('uses the latest attempt and marks terminal runs inactive rather than showing old failure activity', async () => {
  runs.splice(
    0,
    runs.length,
    run('old', 'error', 'run', '2026-10-01T00:00:00Z'),
    run('new', 'running', 'read', '2026-10-01T00:02:00Z')
  )
  expect((await withProgress(snapshot()))?.sceneProgress?.s.label).toBe(
    'Reviewing scene inputs'
  )
  runs[1].status = 'done'
  expect((await withProgress(snapshot()))?.sceneProgress?.s.active).toBe(false)
})
