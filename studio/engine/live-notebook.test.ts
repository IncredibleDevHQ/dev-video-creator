import { afterEach, expect, it, vi } from 'vitest'
import { liveNotebook } from '../app/live-notebook'
import { NotebookStreams } from '../app/notebook-stream'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('restores an expired worker subscription on heartbeat without a visibility event', () => {
  vi.useFakeTimers()
  const subscribe = vi.fn(() => vi.fn()),
    hub = new NotebookStreams(subscribe)
  const port = {
    postMessage: vi.fn((data: { type: string; id: string }) => {
      if (data.type === 'watch')
        hub.watch(port as unknown as MessagePort, data.id)
      if (data.type === 'stop') hub.unwatch(port as unknown as MessagePort)
    }),
    start: vi.fn(),
    close: vi.fn(),
    onmessage: null
  }
  vi.stubGlobal(
    'SharedWorker',
    class {
      port = port
    }
  )
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
  const close = liveNotebook('notebook', vi.fn(), vi.fn())
  expect(subscribe).toHaveBeenCalledOnce()
  vi.setSystemTime(Date.now() + 180001)
  hub.expire()
  vi.advanceTimersByTime(30000)
  expect(subscribe).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(90000)
  expect(subscribe).toHaveBeenCalledTimes(2)
  close()
  expect(port.close).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
