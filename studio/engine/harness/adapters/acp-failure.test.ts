import { expect, it } from 'vitest'
import { acpFailureMessage } from './acp'
import { categorise } from '../provider-errors'
it('keeps actionable categories without leaking provider diagnostics', () => {
  for (const [message, category] of [
    ['quota exceeded secret-key', 'quota'],
    ['authentication failed private-token', 'auth'],
    ['rate limit exceeded private-url', 'rate-limit'],
    ['network timed out secret', 'network']
  ]) {
    const safe = acpFailureMessage({ code: -32000, message })
    expect(categorise(safe)).toBe(category)
    expect(safe).not.toMatch(/secret|private/)
  }
  expect(
    acpFailureMessage({
      code: -32000,
      message: 'Internal failure containing private data'
    })
  ).toBe('Harness request failed (-32000)')
})
