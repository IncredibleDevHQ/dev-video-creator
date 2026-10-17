import { expect, it } from 'vitest'
import {
  generationFailure,
  generationStops,
  HarnessStageError
} from './generation-errors'
it('shows exact product-owned budget stops without exposing raw provider errors', () => {
  for (const message of Object.values(generationStops))
    expect(generationFailure(new Error(message), 'fallback')).toBe(message)
  for (const value of [
    new Error('private credential'),
    new Error(generationStops.time + ' private credential'),
    null,
    'text'
  ])
    expect(generationFailure(value, 'fallback')).toBe('fallback')
})

it('carries actionable harness failures through creative stages without displaying raw messages', () => {
  const failure = {
    category: 'quota' as const,
    message: 'quota exceeded: private credential',
    harness: 'kimi',
    at: '2026-10-01',
    recovery: []
  }
  const message = generationFailure(
    new HarnessStageError(failure, 'fallback'),
    'fallback'
  )
  expect(message).toContain('usage limit')
  expect(message).toContain('Saved work is retained')
  expect(message).not.toContain('private credential')
  expect(
    generationFailure(
      new HarnessStageError({ ...failure, category: 'other' }, 'fallback'),
      'fallback'
    )
  ).toBe('fallback')
})
