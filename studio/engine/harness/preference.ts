import type { HarnessSelection } from '../../shared/model'
import { loadSetting, saveSetting } from '../persistence'
import { isReasoningEffort } from '../../shared/reasoning-effort'
import { Refusal } from '../refusal'
export const validateHarnessSelection = (raw: unknown): HarnessSelection => {
  const value = raw as HarnessSelection
  if (!value || !['claude-code', 'codex', 'kimi'].includes(value.adapter))
    throw new Refusal('Choose a supported agent')
  if (
    value.model !== undefined &&
    (typeof value.model !== 'string' ||
      !value.model.trim() ||
      value.model.length > 200)
  )
    throw new Refusal('Choose a supported model')
  if (value.effort !== undefined && !isReasoningEffort(value.effort))
    throw new Refusal('Choose a supported thinking effort')
  return {
    ...(value.effort ? { effort: value.effort } : {}),
    adapter: value.adapter,
    ...(value.model ? { model: value.model.trim() } : {})
  }
}
export const loadHarnessPreference =
  async (): Promise<HarnessSelection | null> => {
    const stored = await loadSetting('harness')
    return stored ? validateHarnessSelection(stored) : null
  }
export const saveHarnessPreference = (raw: unknown) =>
  saveSetting('harness', raw === null ? null : validateHarnessSelection(raw))
