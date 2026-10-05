import { expect, it } from 'vitest'
import { LIMIT_CEILING_MS, modelPace, stageLimits } from './limits'

it('gives a slow model more time for the same call, within one ceiling', () => {
  const k3 = stageLimits('page', { adapter: 'kimi', model: 'kimi-code/k3' })
  const claude = stageLimits('page', { adapter: 'claude-code' })
  expect(modelPace({ adapter: 'kimi', model: 'kimi-code/k3' })).toBe(2.5)
  expect(k3.timeoutMs).toBe(claude.timeoutMs * 2.5)
  expect(k3.idleTimeoutMs).toBe(claude.idleTimeoutMs * 2.5)
  expect(k3.maxToolCalls).toBe(claude.maxToolCalls)
  for (const operation of ['design', 'planning', 'story'] as const)
    expect(
      stageLimits(operation, { adapter: 'kimi', model: 'kimi-code/k3' })
        .timeoutMs
    ).toBeLessThanOrEqual(LIMIT_CEILING_MS)
})

it('runs an unknown model at the base pace and keeps quick calls quick', () => {
  expect(modelPace({ adapter: 'codex', model: 'gpt-x' })).toBe(1.25)
  expect(modelPace(null)).toBe(1)
  expect(stageLimits('chat', null).timeoutMs).toBe(120_000)
  expect(stageLimits('page', null).timeoutMs).toBeGreaterThan(
    stageLimits('chat', null).timeoutMs
  )
})
