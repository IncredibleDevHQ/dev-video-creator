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
  const brand = {
    ...(raw.palette ? { palette: raw.palette } : {}),
    ...(raw.fonts ? { fonts: raw.fonts } : {}),
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
export const applyBranding = (id: string, branding: Branding) =>
  changeProject(id, async (current) => {
    const source = await readRow<{ brand: { accent: string } }>('outlines', id)
    if (source?.brand.accent) {
      const previous = current.project.branding?.useAccent
        ? current.project.branding.accent
        : source.brand.accent
      const next = branding.useAccent ? branding.accent : source.brand.accent
      if (previous !== next)
        for (const slide of current.project.slides)
          if (slide.svg)
            slide.svg = slide.svg.split(`="${previous}"`).join(`="${next}"`)
    }
    current.project.branding = branding
    for (const scene of current.project.video?.scenes || [])
      scene.planKey = scenePlanKey(current.project, scene)
    refreshVideoKeys(current.project)
    addEvent(current, 'video', 'Branding updated')
  })
