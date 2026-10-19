import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  generationStops,
  generationFailure,
  HarnessStageError,
  stopsPreparationBatch
} from '../generation-errors'
const fixture = vi.hoisted(() => ({
  runs: {} as Record<string, unknown>,
  projects: {} as Record<string, unknown>
}))
vi.mock('../persistence', () => ({
  listRows: async () => Object.keys(fixture.runs),
  readRow: async (table: string, id: string) =>
    (table === 'engine-runs' ? fixture.runs : fixture.projects)[id] || null
}))
const usage = (input: number, cacheRead = 0) => ({
  input,
  output: 0,
  cacheWrite: 0,
  cacheRead,
  final: true
})
beforeEach(() => {
  vi.resetModules()
  fixture.runs = {}
  fixture.projects = {}
  for (const [name, limit] of Object.entries({
    RUN_NEW: 250000,
    RUN_CACHED: 4000000,
    PROJECT_NEW: 6000000,
    PROJECT_CACHED: 100000000,
    SERIES_NEW: 12000000,
    SERIES_CACHED: 200000000
  }))
    vi.stubEnv(`MINIMAL_STUDIO_${name}_TOKENS`, String(limit))
})
afterEach(() => vi.unstubAllEnvs())
it('allows Codex research when earlier Kimi and Claude production exhausted the series ledger', async () => {
  fixture.projects = { episode: { project: { copyOfMap: 'notebook' } } }
  fixture.runs = {
    kimi: {
      id: 'kimi',
      projectId: 'notebook',
      operation: 'page',
      adapter: 'kimi',
      usage: usage(6000000)
    },
    claude: {
      id: 'claude',
      projectId: 'episode',
      operation: 'planning',
      adapter: 'claude-code',
      usage: usage(7000000)
    }
  }
  const { tokenBudget } = await import('./token-budget')
  expect((await tokenBudget('notebook', 'codex', 'research'))()).toBeNull()
  expect((await tokenBudget('episode', 'next-frame', 'frame'))()).toBe(
    generationStops.projectTokens
  )
})
it('preserves cross-agent research caps and keeps them separate from production', async () => {
  fixture.runs = {
    old: {
      id: 'old',
      projectId: 'book',
      operation: 'chat',
      adapter: 'kimi',
      usage: usage(6000000)
    }
  }
  const { tokenBudget } = await import('./token-budget')
  expect((await tokenBudget('book', 'codex', 'research'))()).toBe(
    generationStops.projectTokens
  )
  expect((await tokenBudget('book', 'frame', 'frame'))()).toBeNull()
})
it('counts research across notebooks in the same series but not unrelated series', async () => {
  fixture.projects = {
    a: { project: { copyOfMap: 'series' } },
    b: { project: { copyOfMap: 'series' } }
  }
  fixture.runs = {
    a: {
      id: 'a',
      projectId: 'a',
      operation: 'research',
      usage: usage(6500000)
    },
    b: { id: 'b', projectId: 'b', operation: 'chat', usage: usage(6500000) }
  }
  const { tokenBudget } = await import('./token-budget')
  expect((await tokenBudget('series', 'new', 'research'))()).toBe(
    generationStops.seriesTokens
  )
  expect((await tokenBudget('unrelated', 'other', 'research'))()).toBeNull()
})
it('retains per-request fresh and cached ceilings and replaces cumulative usage', async () => {
  const { tokenBudget } = await import('./token-budget')
  const check = await tokenBudget('book', 'run', 'research')
  expect(check(usage(200000))).toBeNull()
  expect(check(usage(200000))).toBeNull()
  expect(check(usage(250000))).toBe(generationStops.tokens)
  const cached = await tokenBudget('book', 'cached', 'research')
  expect(cached(usage(0, 4000000))).toBe(generationStops.tokens)
})
it('retains cached aggregate caps and reports safe Studio-specific errors through the API', async () => {
  fixture.runs = {
    old: {
      id: 'old',
      projectId: 'book',
      operation: 'research',
      usage: usage(0, 100000000)
    }
  }
  const { tokenBudget } = await import('./token-budget')
  expect((await tokenBudget('book', 'new', 'chat'))()).toBe(
    generationStops.projectTokens
  )
  for (const message of [
    generationStops.tokens,
    generationStops.projectTokens,
    generationStops.seriesTokens
  ]) {
    expect(generationFailure(new Error(message), 'fallback')).toBe(message)
    expect(
      generationFailure(
        new HarnessStageError(
          {
            category: 'other',
            message,
            harness: 'codex',
            at: new Date(0).toISOString(),
            recovery: []
          },
          'fallback'
        ),
        'fallback'
      )
    ).toBe(message)
    expect(stopsPreparationBatch(message)).toBe(true)
  }
})
