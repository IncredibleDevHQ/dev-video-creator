import { expect, it } from 'vitest'
import { LIMIT_CEILING_MS, modelPace, stageLimits } from './limits'

it('gives a slow model more time for the same call, within one ceiling', () => {
  const k3 = stageLimits('page', { adapter: 'kimi', model: 'kimi-code/k3' })
  const claude = stageLimits('page', { adapter: 'claude-code' })
  expect(modelPace({ adapter: 'kimi', model: 'kimi-code/k3' })).toBe(2.5)
  expect(k3.timeoutMs).toBe(claude.timeoutMs * 2.5)
  expect(k3.idleTimeoutMs).toBe(claude.idleTimeoutMs * 2.5)
  expect(k3.maxToolCalls).toBe(claude.maxToolCalls)
  for (const operation of ['page', 'planning', 'story', 'composition'] as const)
    expect(
      stageLimits(operation, { adapter: 'kimi', model: 'kimi-code/k3' })
        .timeoutMs
    ).toBeLessThanOrEqual(LIMIT_CEILING_MS)
})

it('gives a high-effort build room to fix what the frame check finds', () => {
  // Seen live: K3 at high effort built by 18½ minutes; its fixes need more.
  const k3 = stageLimits('composition', {
    adapter: 'kimi',
    model: 'kimi-code/k3'
  })
  expect(k3.effort).toBe('high')
  expect(k3.timeoutMs).toBeGreaterThanOrEqual(40 * 60_000)
})

it('runs an unknown model at the base pace and keeps quick calls quick', () => {
  expect(modelPace({ adapter: 'codex', model: 'gpt-x' })).toBe(1.25)
  expect(modelPace(null)).toBe(1)
  expect(stageLimits('chat', null).timeoutMs).toBe(120_000)
  expect(stageLimits('page', null).timeoutMs).toBeGreaterThan(
    stageLimits('chat', null).timeoutMs
  )
})

it('thinks hard to plan, lightly to draw one page, and caps every response', () => {
  for (const operation of ['brief', 'story', 'planning'] as const)
    expect(stageLimits(operation, null).effort).toBe('high')
  expect(stageLimits('page', null).effort).toBe('medium')
  expect(stageLimits('revise-page', null).effort).toBe('medium')
  expect(stageLimits('revise-story', null).effort).toBe('low')
  expect(stageLimits('chat', null).effort).toBe('low')
  // The pace scales time, never the thinking or the response limit.
  const k3 = stageLimits('page', { adapter: 'kimi', model: 'kimi-code/k3' })
  expect(k3.effort).toBe('medium')
  expect(k3.maxOutputTokens).toBe(stageLimits('page', null).maxOutputTokens)
  expect(stageLimits('page', null).maxOutputTokens).toBeLessThan(
    stageLimits('story', null).maxOutputTokens
  )
})
