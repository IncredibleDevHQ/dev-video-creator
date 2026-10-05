import { loadBrandLibrary } from './brand-library'
import { availableHarness, setNotebookHarness } from './notebook-intake'
import {
  loadHarnessPreference,
  saveHarnessPreference
} from './harness/preference'
import type { StudioSettings } from '../shared/settings'
import type { Voice } from '../shared/model'
import {
  MODEL_PRESETS,
  publicModelSettings,
  saveModelSettings,
  type ModelSettingsV1
} from './model-gateway'
import { fishKey, saveFishKey } from './credentials'
import { loadBranding, saveBranding, applyBranding } from './branding'
import {
  listClones,
  voiceCatalogue,
  selectedVoice,
  useVoice
} from './voice-library'
export const getStudioSettings = async (
  refreshVoices = false
): Promise<StudioSettings> => {
  const [models, branding, clones, selected, catalogue, key] =
    await Promise.all([
      publicModelSettings(),
      loadBranding(),
      listClones(),
      selectedVoice(),
      voiceCatalogue(refreshVoices),
      fishKey()
    ])
  return {
    harness: await loadHarnessPreference(),
    models: {
      provider: models.provider,
      baseUrl: models.baseUrl,
      hasKey: models.hasKey,
      models: models.models,
      reasoningEffort: models.reasoningEffort
    },
    providers: Object.entries(MODEL_PRESETS).map(([id, preset]) => ({
      id: id as ModelSettingsV1['provider'],
      name: preset.label,
      baseUrl: preset.baseUrl,
      models: preset.models
    })),
    branding,
    brandLibrary: await loadBrandLibrary(),
    voice: {
      hasKey: Boolean(key),
      selected,
      clones,
      choices: catalogue.choices,
      error: catalogue.error
    }
  }
}
export const saveStudioSettings = async (body: unknown) => {
  const patch = body as {
    harness?: unknown
    models?: Partial<ModelSettingsV1>
    branding?: unknown
    fishApiKey?: unknown
    voice?: unknown
    projectId?: string
  }
  if (!patch || typeof patch !== 'object') throw new Error('Invalid settings')
  if (Object.hasOwn(patch, 'harness')) {
    const harness =
      patch.harness === null ? null : await availableHarness(patch.harness)
    if (patch.projectId && harness)
      await setNotebookHarness(patch.projectId, harness)
    await saveHarnessPreference(harness)
  }
  if (patch.models) {
    const models = patch.models
    if (!models.provider || !Object.hasOwn(MODEL_PRESETS, models.provider))
      throw new Error('Choose a model provider')
    const base = models.baseUrl || MODEL_PRESETS[models.provider].baseUrl
    const url = new URL(base)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Enter the provider API URL without credentials')
    if (
      !models.models ||
      !Object.values(models.models).every(
        (model) =>
          typeof model === 'string' && model.trim() && model.length <= 200
      )
    )
      throw new Error('Choose a model for each task')
    if (models.apiKey !== undefined && typeof models.apiKey !== 'string')
      throw new Error('Invalid model API key')
    await saveModelSettings(models)
  }
  await saveFishKey(patch.fishApiKey)
  if (patch.branding) {
    const brand = await saveBranding(patch.branding)
    if (patch.projectId) await applyBranding(patch.projectId, brand)
  }
  if (patch.voice) await useVoice(validateVoiceChoice(patch.voice))
  return getStudioSettings()
}
export const validateVoiceChoice = (raw: unknown): Voice => {
  const voice = raw as Voice
  if (!voice || !['record', 'ai', 'clone'].includes(voice.kind))
    throw new Error('Choose a voice')
  if (voice.kind === 'record') return { kind: 'record' }
  if (typeof voice.id !== 'string' || !voice.id.trim() || voice.id.length > 200)
    throw new Error('Choose a voice')
  return { kind: voice.kind, id: voice.id }
}
