// The creator's choice of local harness and model, durably, for every stage
// that runs one: story, page drawing, planning and scene production. One
// default, with deliberate per-stage overrides. It lives in the studio's
// settings store — not browser storage, which a new local server port
// resets — so a restart keeps it.
import { compareAndSwapSetting, loadSetting, saveSetting } from './persistence'

export const HARNESS_STAGES = ['story', 'drawing', 'planning', 'composition'] as const
export type HarnessStage = (typeof HARNESS_STAGES)[number]
export const HARNESS_IDS = ['claude-code', 'kimi', 'codex'] as const
export type HarnessChoice = { harness: (typeof HARNESS_IDS)[number]; model: string | null }
export type HarnessPreferences = {
  default: HarnessChoice | null
  stages: Partial<Record<HarnessStage, HarnessChoice>>
  updatedAt: string | null
}

const KEY = 'harness-preferences-v1'
const EMPTY: HarnessPreferences = { default: null, stages: {}, updatedAt: null }

export class HarnessPreferenceError extends Error {}

const choiceFrom = (value: unknown): HarnessChoice | null => {
  if (value === null) return null
  const entry = value as { harness?: unknown; model?: unknown }
  if (!entry || !HARNESS_IDS.includes(entry.harness as HarnessChoice['harness'])) throw new HarnessPreferenceError(`A harness is one of ${HARNESS_IDS.join(', ')}`)
  const model = entry.model === null || entry.model === undefined || entry.model === '' ? null : String(entry.model).trim()
  if (model !== null && (!model || model.length > 120 || !/^[\w.:/@+-]+$/.test(model))) throw new HarnessPreferenceError('A model is a model id such as claude-opus-5-5')
  return { harness: entry.harness as HarnessChoice['harness'], model }
}

export const loadHarnessPreferences = async (): Promise<HarnessPreferences> => {
  const stored = (await loadSetting(KEY)) as HarnessPreferences | null
  return stored ? { default: stored.default ?? null, stages: stored.stages || {}, updatedAt: stored.updatedAt ?? null } : { ...EMPTY, stages: {} }
}

// A patch sets the default and/or stages; a stage set to null uses the
// default again. Concurrent saves never lose one another.
export const saveHarnessPreferences = async (patch: { default?: unknown; stages?: Record<string, unknown> }) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stored = (await loadSetting(KEY)) as HarnessPreferences | null
    const current = stored ? await loadHarnessPreferences() : { ...EMPTY, stages: {} }
    const next: HarnessPreferences = { default: current.default, stages: { ...current.stages }, updatedAt: new Date().toISOString() }
    if (patch.default !== undefined) next.default = choiceFrom(patch.default)
    for (const [stage, value] of Object.entries(patch.stages || {})) {
      if (!HARNESS_STAGES.includes(stage as HarnessStage)) throw new HarnessPreferenceError(`A stage is one of ${HARNESS_STAGES.join(', ')}`)
      const choice = choiceFrom(value)
      if (choice) next.stages[stage as HarnessStage] = choice
      else delete next.stages[stage as HarnessStage]
    }
    if (await compareAndSwapSetting(KEY, stored, next)) return next
    // A row holding a null value never matches "absent": nothing to lose.
    if (stored === null && (await loadSetting(KEY)) === null) {
      await saveSetting(KEY, next)
      return next
    }
  }
  throw new HarnessPreferenceError('The harness preference changed while saving; try again')
}

// The choice a stage runs with: its override, else the default.
export const effectiveChoice = (preferences: HarnessPreferences, stage: HarnessStage) =>
  preferences.stages[stage] || preferences.default || null
