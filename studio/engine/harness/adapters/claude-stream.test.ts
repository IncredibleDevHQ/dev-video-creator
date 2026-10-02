import { afterEach, expect, it, vi } from 'vitest'
import { emitLine } from './claude-code'
import type { HarnessEvent } from '../types'
afterEach(() => vi.useRealTimers())
it('reports real partial activity without persisting thinking or code fragments', () => {
  vi.useFakeTimers()
  const events: HarnessEvent[] = [],
    state = {}
  const chunk = JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: {
        type: 'thinking_delta',
        thinking: 'Private reasoning must not be persisted'
      }
    }
  })
  emitLine(chunk, (event) => events.push(event), state)
  emitLine(chunk, (event) => events.push(event), state)
  expect(events).toHaveLength(1)
  expect(events[0].type).toBe('activity')
  expect(JSON.stringify(events)).not.toContain('Private reasoning')
  vi.advanceTimersByTime(2000)
  emitLine(chunk, (event) => events.push(event), state)
  expect(events).toHaveLength(2)
})
it('does not treat arbitrary stream messages as progress', () => {
  const emit = vi.fn()
  emitLine(
    JSON.stringify({ type: 'stream_event', event: { type: 'ping' } }),
    emit,
    {}
  )
  expect(emit).not.toHaveBeenCalled()
})
