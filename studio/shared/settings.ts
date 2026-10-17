import type { Voice } from './model'
/** A font file a look carries: an openly licensed face read from the site
 * the look came from, stored by the studio. */
export type BrandFontFile = {
  family: string
  /** One weight, or the range a variable face covers. */
  weight: number | [number, number]
  style: 'normal' | 'italic'
  objectKey: string
  format: 'woff2' | 'woff' | 'truetype' | 'opentype'
}
/** The logo a site shows, read with its look: offered, used only when the
 * creator chooses it. */
export type SiteLogo = {
  /** A transparent PNG, the logo as the site paints it. */
  pngKey: string
  /** The drawing itself, made safe, when the site drew it as SVG. */
  svgKey?: string
  width: number
  height: number
  label: string
  /** The site it was read from. */
  from: string
}
export type Branding = {
  name: string
  tagline: string
  accent: string
  useAccent: boolean
  palette?: { ground: string; text: string; secondary: string }
  fonts?: { display: string; body: string; mono: string }
  logoKey: string | null
  /** The named look the palette and fonts came from (review 5), and what
   * it says of them: a site's fonts that stand in for its own (review 6). */
  look?: { id: string; name: string; note?: string }
  /** The files of the look's fonts that are not built in. */
  fontFiles?: BrandFontFile[]
  /** What the notebook's site offers, whichever look it wears: its logo
   * (`logoKey` is its PNG once chosen), its icon, its open faces. */
  site?: SiteOffer
}
export type SiteOffer = {
  from: string
  /** The look read from the site, offered beside the named looks. */
  look?: {
    name: string
    description: string
    palette: { ground: string; text: string; accent: string; secondary: string }
    fonts: { display: string; body: string; mono: string }
  }
  logo?: SiteLogo
  symbol?: SiteLogo
  fontFiles: BrandFontFile[]
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
