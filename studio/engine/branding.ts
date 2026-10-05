import type { Branding } from '../shared/settings'
import {
  loadSetting,
  saveSetting,
  readAsset,
  validObjectKey,
  readRow
} from './persistence'
import { changeProject, addEvent } from './projects'
import { refreshVideoKeys, scenePlanKey } from './scene-model'
export const DEFAULT_BRANDING: Branding = {
  name: '',
  tagline: '',
  accent: '#527c60',
  useAccent: false,
  logoKey: null
}
export const loadBranding = async (): Promise<Branding> => ({
  ...DEFAULT_BRANDING,
  ...((await loadSetting('branding')) as Partial<Branding>)
})
export const validateBranding = async (value: unknown): Promise<Branding> => {
  const raw = value as Branding
  if (
    !raw ||
    typeof raw.name !== 'string' ||
    raw.name.length > 100 ||
    typeof raw.tagline !== 'string' ||
    raw.tagline.length > 160 ||
    !/^#[a-f0-9]{6}$/i.test(raw.accent) ||
    typeof raw.useAccent !== 'boolean'
  )
    throw new Error('Check your branding fields')
  if (raw.logoKey !== null) {
    if (!validObjectKey(raw.logoKey) || !/\.(png|jpg|webp)$/i.test(raw.logoKey))
      throw new Error('Invalid logo')
    await readAsset(raw.logoKey)
  }
  if (
    raw.palette &&
    !['ground', 'text', 'secondary'].every((key) =>
      /^#[a-f0-9]{6}$/i.test(raw.palette![key as keyof typeof raw.palette])
    )
  )
    throw new Error('Check your brand colours')
  if (
    raw.fonts &&
    !['display', 'body', 'mono'].every(
      (key) =>
        typeof raw.fonts![key as keyof typeof raw.fonts] === 'string' &&
        raw.fonts![key as keyof typeof raw.fonts].length <= 100
    )
  )
    throw new Error('Check your brand fonts')
  if (
    raw.look !== undefined &&
    (typeof raw.look?.id !== 'string' ||
      typeof raw.look?.name !== 'string' ||
      raw.look.id.length > 100 ||
      raw.look.name.length > 100)
  )
    throw new Error('Check the look')
  const brand = {
    ...(raw.palette ? { palette: raw.palette } : {}),
    ...(raw.fonts ? { fonts: raw.fonts } : {}),
    ...(raw.look ? { look: { id: raw.look.id, name: raw.look.name } } : {}),
    name: raw.name.trim(),
    tagline: raw.tagline.trim(),
    accent: raw.accent,
    useAccent: raw.useAccent,
    logoKey: raw.logoKey
  }
  return brand
}
export const saveBranding = async (value: unknown) => {
  const brand = await validateBranding(value)
  await saveSetting('branding', brand)
  return brand
}
/**
 * The creator's name, description and logo on this notebook. Their identity
 * is kept apart from the notebook's look: saving one never changes the other
 * (review 5: a brand's name became the lower third's "Your name").
 */
export const applyIdentity = (id: string, branding: Branding) =>
  changeProject(id, async (current) => {
    current.project.branding = {
      ...(current.project.branding || DEFAULT_BRANDING),
      name: branding.name,
      tagline: branding.tagline,
      logoKey: branding.logoKey
    }
    for (const scene of current.project.video?.scenes || [])
      scene.planKey = scenePlanKey(current.project, scene)
    refreshVideoKeys(current.project)
    addEvent(current, 'video', 'Your name and logo updated')
  })
/** Only the creator's identity carries from Settings into a new notebook. */
export const identityOf = (branding: Branding | null | undefined) => ({
  ...DEFAULT_BRANDING,
  name: branding?.name || '',
  tagline: branding?.tagline || '',
  logoKey: branding?.logoKey || null
})
