import { loadSetting,saveSetting } from './persistence'
export const fishKey = async () => String(await loadSetting('fish-key') || process.env.FISH_AUDIO_API_KEY || '')
export const saveFishKey = async (value: unknown) => {
  if (value === undefined || value === '') return
  if (typeof value !== 'string' || value.length > 4000) throw new Error('Invalid voice API key')
  await saveSetting('fish-key',value.trim())
}
