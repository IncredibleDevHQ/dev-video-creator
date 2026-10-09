import { expect, it, vi, beforeEach } from 'vitest'
import type { Snapshot } from '../shared/api'
const { list, read } = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn() }))
vi.mock('./persistence', () => ({ listNotebookRows: list, readRow: read }))
const { withProgress } = await import('./progress')
const snapshot = (status: Snapshot['status'] = 'building'): Snapshot => ({
  project: {
    id: 'notebook',
    title: 'Test',
    source: '',
    slides: [],
    video: null
  },
  status,
  error: null,
  events: []
})
beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue(['old', 'current', 'scene'])
  read.mockImplementation(async (_kind, id) => ({
    id,
    projectId: 'notebook',
    stage: id === 'old' ? 'story' : 'drawing',
    status: id === 'old' ? 'done' : 'running',
    startedAt:
      id === 'current' ? '2026-10-01T00:00:00Z' : '2026-10-01T00:01:00Z',
    ...(id === 'scene' ? { sceneId: 'scene' } : {})
  }))
})
it('projects the active deck stage without persisting or changing event history', async () => {
  const original = snapshot(),
    result = await withProgress(original)
  expect(result?.progress).toEqual({
    label: 'Designing your slides',
    startedAt: '2026-10-01T00:00:00Z'
  })
  expect(original.progress).toBeUndefined()
  expect(result?.events).toEqual([])
  expect(list).toHaveBeenCalledWith('engine-runs', 'notebook')
})
it('does not report a running stage after completion or failure', async () => {
  for (const status of ['ready', 'failed'] as const)
    expect(await withProgress(snapshot(status))).toEqual(snapshot(status))
  expect(list).not.toHaveBeenCalled()
})
it('keeps the notebook event fallback when no active deck run exists', async () => {
  read.mockResolvedValue({
    projectId: 'notebook',
    stage: 'drawing',
    status: 'done',
    startedAt: '2026-10-01T00:00:00Z'
  })
  const original = snapshot()
  expect(await withProgress(original)).toBe(original)
})
