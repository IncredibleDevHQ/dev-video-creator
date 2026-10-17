import { loadSetting, saveSetting } from './persistence'
import { Refusal } from './refusal'
export const fishKey = async () =>
  String(
    (await loadSetting('fish-key')) || process.env.FISH_AUDIO_API_KEY || ''
  )
export const saveFishKey = async (value: unknown) => {
  if (value === undefined || value === '') return
  if (typeof value !== 'string' || value.length > 4000)
    throw new Refusal('Check the voice API key')
  await saveSetting('fish-key', value.trim())
}
