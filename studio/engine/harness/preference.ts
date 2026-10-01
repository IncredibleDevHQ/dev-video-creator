import type { HarnessSelection } from '../../shared/model'
import { loadSetting, saveSetting } from '../persistence'
export const validateHarnessSelection = (raw: unknown): HarnessSelection => {
  const value = raw as HarnessSelection
  if (!value || !['claude-code', 'codex', 'kimi'].includes(value.adapter))
    throw new Error('Choose a supported harness')
  if (
    value.model !== undefined &&
    (typeof value.model !== 'string' ||
      !value.model.trim() ||
      value.model.length > 200)
  )
    throw new Error('Choose a supported model')
  return {
    adapter: value.adapter,
    ...(value.model ? { model: value.model.trim() } : {})
  }
}
export const loadHarnessPreference =
  async (): Promise<HarnessSelection | null> => {
    const stored = await loadSetting('harness')
    return stored
      ? validateHarnessSelection(stored)
      : { adapter: 'kimi', model: 'kimi-code/k3' }
  }
export const saveHarnessPreference = (raw: unknown) =>
  saveSetting('harness', raw === null ? null : validateHarnessSelection(raw))
