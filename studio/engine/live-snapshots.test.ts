import { afterEach, expect, it, vi } from 'vitest'
const { load } = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('./projects', () => ({ loadProject: load }))
vi.mock('./progress', () => ({ withProgress: async (value: unknown) => value }))
import { watchSnapshots } from './live-snapshots'
import { notifyNotebook } from './notebook-events'
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
afterEach(() => vi.useRealTimers())

it('shares one refresh, stays quiet when idle, and delivers persisted run changes', async () => {
  vi.useFakeTimers()
  const snapshot = { project: { id: 'shared' }, events: [] }
  load.mockResolvedValue(snapshot)
  const first = vi.fn(),
    second = vi.fn()
  const closeFirst = watchSnapshots('shared', first),
    closeSecond = watchSnapshots('shared', second)
  try {
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(60000)
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    load.mockResolvedValue({
      ...snapshot,
      sceneProgress: { scene: { label: 'Checking' } }
    })
    notifyNotebook('shared')
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(2)
    notifyNotebook('shared')
    await settle()
    expect(first).toHaveBeenCalledTimes(2)
    closeFirst()
    closeSecond()
    notifyNotebook('shared')
    await settle()
    expect(load).toHaveBeenCalledTimes(3)
  } finally {
    closeFirst()
    closeSecond()
  }
})
