import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// The file backend in a scratch directory; PLANNING_TEST_BACKEND=postgres
// runs the same checks on the isolated PostgreSQL the STUDIO_* variables name.
process.env.STUDIO_PERSISTENCE = process.env.PLANNING_TEST_BACKEND === 'postgres' ? 'postgres' : 'local'
process.env.STUDIO_DATA_DIR = mkdtempSync(join(tmpdir(), 'harness-preferences-'))

const persistence = await import('./persistence')
const preferences = await import('./harness-preferences')

beforeAll(async () => {
  await persistence.initializePersistence()
  await persistence.saveSetting('harness-preferences-v1', { default: null, stages: {}, updatedAt: null })
})

describe('the harness and model preference', () => {
  it('keeps one default and per-stage overrides, durably', async () => {
    await preferences.saveHarnessPreferences({ default: { harness: 'claude-code', model: 'claude-opus-5-5' } })
    await preferences.saveHarnessPreferences({ stages: { drawing: { harness: 'kimi', model: 'kimi-code/k3' } } })
    const saved = await preferences.loadHarnessPreferences()
    expect(saved.default).toEqual({ harness: 'claude-code', model: 'claude-opus-5-5' })
    expect(preferences.effectiveChoice(saved, 'drawing')).toEqual({ harness: 'kimi', model: 'kimi-code/k3' })
    expect(preferences.effectiveChoice(saved, 'planning')).toEqual({ harness: 'claude-code', model: 'claude-opus-5-5' })
    // A stage set to null uses the default again; the CLI default is null.
    const cleared = await preferences.saveHarnessPreferences({ stages: { drawing: null, planning: { harness: 'codex', model: null } } })
    expect(cleared.stages).toEqual({ planning: { harness: 'codex', model: null } })
  })

  it('refuses what is not a harness, a stage or a model id', async () => {
    await expect(preferences.saveHarnessPreferences({ default: { harness: 'gpt-in-a-box', model: null } })).rejects.toThrow(/harness is one of/)
    await expect(preferences.saveHarnessPreferences({ stages: { export: { harness: 'kimi', model: null } } })).rejects.toThrow(/stage is one of/)
    await expect(preferences.saveHarnessPreferences({ default: { harness: 'kimi', model: 'rm -rf /' } })).rejects.toThrow(/model is a model id/)
  })

  it('never loses one of two saves made at once', async () => {
    await Promise.all([
      preferences.saveHarnessPreferences({ stages: { story: { harness: 'kimi', model: 'kimi-code/k3' } } }),
      preferences.saveHarnessPreferences({ stages: { composition: { harness: 'claude-code', model: 'claude-fable-5-1' } } }),
    ])
    const saved = await preferences.loadHarnessPreferences()
    expect(saved.stages.story?.harness).toBe('kimi')
    expect(saved.stages.composition?.model).toBe('claude-fable-5-1')
  })
})

describe('a run keeps why it failed', () => {
  it('stores the requested and reported model and the failure with the run', async () => {
    const id = `run-failure-${Date.now().toString(36)}`
    const failure = { category: 'quota', message: "You're out of usage credits", harness: 'claude-code', at: '2026-09-24T00:00:00Z', recovery: ['Retry after restoring Claude Code credits', 'Switch harness or model'] }
    await persistence.saveBuildRun({ id, skill: 'story-master', route: 'Plan Story', adapter: 'claude-code', projectDir: '/tmp/x', status: 'running', model: 'claude-opus-5-5' })
    await persistence.saveBuildRun({ id, skill: 'story-master', route: 'Plan Story', adapter: 'claude-code', projectDir: '/tmp/x', status: 'error', reportedModel: 'claude-opus-5-5', failure, finishedAt: '2026-09-24T00:01:00Z' })
    const run = (await persistence.listBuildRuns()).find(entry => entry.id === id)
    expect(run).toMatchObject({ status: 'error', model: 'claude-opus-5-5', reportedModel: 'claude-opus-5-5', failure })
  })
})
