import { EventEmitter } from 'node:events'
import type { Pool } from 'pg'
import { afterEach, expect, it, vi } from 'vitest'
import { listenForNotebookWrites } from './notifications'
import { watchNotebook } from '../notebook-events'

const connection = () =>
  Object.assign(new EventEmitter(), {
    query: vi.fn().mockResolvedValue({}),
    release: vi.fn()
  })
afterEach(() => vi.useRealTimers())

it('catches up after a lost database subscription and releases it on shutdown', async () => {
  vi.useFakeTimers()
  const first = connection(),
    second = connection()
  const connect = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second)
  const changed = vi.fn(),
    unwatch = watchNotebook('outage', changed)
  const stop = await listenForNotebookWrites({ connect } as unknown as Pool)
  try {
    expect(changed).toHaveBeenCalledOnce()
    first.emit('notification', {
      channel: 'minimal_studio_notebook',
      payload: 'outage'
    })
    expect(changed).toHaveBeenCalledTimes(2)
    first.emit('error', new Error('Connection lost'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(changed).toHaveBeenCalledTimes(3)
    second.emit('notification', {
      channel: 'minimal_studio_notebook',
      payload: 'outage'
    })
    expect(changed).toHaveBeenCalledTimes(4)
    stop()
    second.emit('notification', {
      channel: 'minimal_studio_notebook',
      payload: 'outage'
    })
    await vi.advanceTimersByTimeAsync(20000)
    expect(changed).toHaveBeenCalledTimes(4)
    expect(connect).toHaveBeenCalledTimes(2)
    expect(first.release).toHaveBeenCalledExactlyOnceWith(true)
    expect(second.release).toHaveBeenCalledExactlyOnceWith(true)
  } finally {
    stop()
    unwatch()
  }
})

it('does not hide an initial subscription failure or leave a connection checked out', async () => {
  const client = connection()
  client.query.mockRejectedValue(new Error('Cannot subscribe'))
  await expect(
    listenForNotebookWrites({ connect: async () => client } as unknown as Pool)
  ).rejects.toThrow('Cannot subscribe')
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true)
})
