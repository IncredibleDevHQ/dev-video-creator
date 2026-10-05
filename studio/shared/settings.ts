import type { Voice } from './model'
export type Branding = {
  name: string
  tagline: string
  accent: string
  useAccent: boolean
  palette?: { ground: string; text: string; secondary: string }
  fonts?: { display: string; body: string; mono: string }
  logoKey: string | null
  /** The named look the palette and fonts came from (review 5). */
  look?: { id: string; name: string }
}
export type VoiceClone = {
  id: string
  name: string
  state: 'creating' | 'training' | 'ready' | 'failed' | 'deleted'
  referenceId?: string
  attemptStartedAt?: string
  recordingKey: string | null
  sampleKey: string | null
  duration: number
  consentAt: string
  error: string | null
}
export type VoiceChoice = {
  id: string
  name: string
  provider: 'system' | 'fish'
  language: string
}
export type ModelProvider =
  | 'openai'
  | 'litellm'
  | 'openrouter'
  | 'ollama'
  | 'anthropic'
  | 'custom'
export type PublicModels = {
  provider: ModelProvider
  baseUrl: string
  hasKey: boolean
  models: { writing: string; vision: string; coding: string }
  reasoningEffort: 'none' | 'low' | 'medium' | 'high'
}
export type SavedBrand = {
  id: string
  domain: string | null
  brand: Branding
  updatedAt: string
}
export type StudioSettings = {
  brandLibrary?: SavedBrand[]
  harness: import('./model').HarnessSelection | null
  models: PublicModels
  providers: Array<{
    id: ModelProvider
    name: string
    baseUrl: string
    models: PublicModels['models']
  }>
  branding: Branding
  voice: {
    hasKey: boolean
    selected: Voice
    clones: VoiceClone[]
    choices: VoiceChoice[]
    error: string | null
  }
}
export const CLONE_SCRIPT =
  'Today I want to explain an idea clearly. A good explanation starts with a question, follows one example, and gives each step time to make sense. When something changes on screen, I slow down and show why it matters. My voice should feel natural, warm, and direct. Small pauses help the listener follow along. At the end, I bring the pieces together and leave one useful takeaway.'
export const VOICE_SAMPLE =
  'Here is how I will sound in your video. Let us take one idea and make it clear.'
