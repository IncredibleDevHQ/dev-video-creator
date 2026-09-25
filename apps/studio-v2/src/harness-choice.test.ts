import { describe, expect, it } from 'vitest'
import { BROWSER_REVIEW_MESSAGE, planningHostOf, resolveStage, type HarnessPreferences } from './harness-choice'

// R9: where planning can run is told apart from what a provider did.
describe('where planning can run', () => {
  const claude = { id: 'claude-code', ok: true, models: { default: null, source: 'test', options: [{ id: 'claude-opus-5-5', label: 'Claude Opus 5.5' }] } }
  const missing = { id: 'kimi', ok: false, reason: 'kimi not found on PATH' }
  const chosen: HarnessPreferences = { default: { harness: 'claude-code', model: 'claude-opus-5-5' }, stages: {}, updatedAt: null }

  it('reviews in a browser without advising an install', () => {
    const host = planningHostOf(false, [], resolveStage(chosen, 'planning', []))
    expect(host).toEqual({ state: 'browser', message: BROWSER_REVIEW_MESSAGE })
    expect(host.message).not.toMatch(/install/i)
    expect(host.message).toMatch(/desktop app/)
  })

  it('says no harness is installed only in the desktop app, when none is', () => {
    expect(planningHostOf(true, [missing], resolveStage(chosen, 'planning', [missing]))).toMatchObject({ state: 'no-harness', message: expect.stringMatching(/install Claude Code, Kimi or Codex/) })
  })

  it('names the chosen harness when it is the one missing', () => {
    const kimiChosen: HarnessPreferences = { default: { harness: 'kimi', model: null }, stages: {}, updatedAt: null }
    expect(planningHostOf(true, [claude, missing], resolveStage(kimiChosen, 'planning', [claude, missing]))).toMatchObject({ state: 'unavailable', message: expect.stringMatching(/^Kimi is not available/) })
  })

  it('is ready when the chosen harness and model are there', () => {
    expect(planningHostOf(true, [claude], resolveStage(chosen, 'planning', [claude]))).toEqual({ state: 'ready', message: null })
  })
})
