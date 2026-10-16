import type {
  BrandFontFile,
  Branding,
  SiteLogo,
  SiteOffer
} from '../shared/settings'
import {
  loadSetting,
  saveSetting,
  readAsset,
  validObjectKey,
  readRow
} from './persistence'
import { changeProject, addEvent } from './projects'
import { refreshVideoKeys } from './scene-model'
import { makingVideo } from './autopilot'
import { Refusal } from './refusal'
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
const FONT_FORMATS = ['woff2', 'woff', 'truetype', 'opentype']

/** Font files a brand names: the studio's own stored faces, nothing else. */
const fontFilesOf = (value: unknown): BrandFontFile[] | undefined => {
  if (value === undefined) return undefined
  const files = Array.isArray(value) ? value.slice(0, 16) : null
  const weight = (raw: unknown) =>
    typeof raw === 'number'
      ? raw >= 1 && raw <= 1000
      : Array.isArray(raw) &&
        raw.length === 2 &&
        raw.every(
          (part) => typeof part === 'number' && part >= 1 && part <= 1000
        )
  if (
    !files ||
    !files.every(
      (file: BrandFontFile) =>
        typeof file?.family === 'string' &&
        file.family.trim().length > 0 &&
        file.family.length <= 100 &&
        weight(file.weight) &&
        ['normal', 'italic'].includes(file.style) &&
        FONT_FORMATS.includes(file.format) &&
        validObjectKey(file.objectKey) &&
        /\.(woff2?|ttf|otf)$/i.test(file.objectKey)
    )
  )
    throw new Refusal('Check the look’s font files')
  return files.map((file: BrandFontFile) => ({
    family: file.family.trim(),
    weight: file.weight,
    style: file.style,
    objectKey: file.objectKey,
    format: file.format
  }))
}

const logoOf = (value: unknown): SiteLogo | undefined => {
  const logo = value as SiteLogo | undefined
  if (!logo) return undefined
  if (
    !validObjectKey(logo.pngKey) ||
    !/\.png$/i.test(logo.pngKey) ||
    (logo.svgKey !== undefined &&
      (!validObjectKey(logo.svgKey) || !/\.svg$/i.test(logo.svgKey))) ||
    typeof logo.width !== 'number' ||
    typeof logo.height !== 'number' ||
    typeof logo.label !== 'string' ||
    typeof logo.from !== 'string'
  )
    throw new Refusal('Check the site’s logo')
  return {
    pngKey: logo.pngKey,
    ...(logo.svgKey ? { svgKey: logo.svgKey } : {}),
    width: Math.round(logo.width),
    height: Math.round(logo.height),
    label: logo.label.slice(0, 120),
    from: logo.from.slice(0, 120)
  }
}

const siteOf = (value: unknown): SiteOffer | undefined => {
  const site = value as SiteOffer | undefined
  if (!site) return undefined
  if (typeof site.from !== 'string' || site.from.length > 120)
    throw new Refusal('Check the site')
  const logo = logoOf(site.logo)
  const symbol = logoOf(site.symbol)
  const look = site.look
  if (
    look &&
    (typeof look.name !== 'string' ||
      look.name.length > 100 ||
      typeof look.description !== 'string' ||
      look.description.length > 400 ||
      !['ground', 'text', 'accent', 'secondary'].every((key) =>
        /^#[a-f0-9]{6}$/i.test(look.palette?.[key as 'ground'] || '')
      ) ||
      !['display', 'body', 'mono'].every(
        (key) =>
          typeof look.fonts?.[key as 'display'] === 'string' &&
          look.fonts[key as 'display'].length <= 100
      ))
  )
    throw new Refusal('Check the site’s look')
  return {
    from: site.from,
    ...(look
      ? {
          look: {
            name: look.name,
            description: look.description,
            palette: { ...look.palette },
            fonts: { ...look.fonts }
          }
        }
      : {}),
    ...(logo ? { logo } : {}),
    ...(symbol ? { symbol } : {}),
    fontFiles: fontFilesOf(site.fontFiles) || []
  }
}

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
    throw new Refusal('Check your branding fields')
  if (raw.logoKey !== null) {
    if (!validObjectKey(raw.logoKey) || !/\.(png|jpg|webp)$/i.test(raw.logoKey))
      throw new Refusal('Invalid logo')
    await readAsset(raw.logoKey)
  }
  if (
    raw.palette &&
    !['ground', 'text', 'secondary'].every((key) =>
      /^#[a-f0-9]{6}$/i.test(raw.palette![key as keyof typeof raw.palette])
    )
  )
    throw new Refusal('Check your brand colours')
  if (
    raw.fonts &&
    !['display', 'body', 'mono'].every(
      (key) =>
        typeof raw.fonts![key as keyof typeof raw.fonts] === 'string' &&
        raw.fonts![key as keyof typeof raw.fonts].length <= 100
    )
  )
    throw new Refusal('Check your brand fonts')
  if (
    raw.look !== undefined &&
    (typeof raw.look?.id !== 'string' ||
      typeof raw.look?.name !== 'string' ||
      raw.look.id.length > 100 ||
      raw.look.name.length > 100)
  )
    throw new Refusal('Check the look')
  const fontFiles = fontFilesOf(raw.fontFiles)
  const site = siteOf(raw.site)
  const brand = {
    ...(fontFiles?.length ? { fontFiles } : {}),
    ...(site ? { site } : {}),
    ...(raw.palette ? { palette: raw.palette } : {}),
    ...(raw.fonts ? { fonts: raw.fonts } : {}),
    ...(raw.look
      ? {
          look: {
            id: raw.look.id,
            name: raw.look.name,
            ...(typeof raw.look.note === 'string' && raw.look.note.length <= 400
              ? { note: raw.look.note }
              : {})
          }
        }
      : {}),
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
export const IDENTITY_WAITS =
  'Wait for the scenes being made to finish before changing your name and logo'
/**
 * The creator's name, description and logo on this notebook. Their identity
 * is kept apart from the notebook's look: saving one never changes the other
 * (review 5: a brand's name became the lower third's "Your name").
 */
export const applyIdentity = (id: string, branding: Branding) =>
  changeProject(id, async (current) => {
    if (makingVideo(current.project)) throw new Refusal(IDENTITY_WAITS)
    current.project.branding = {
      ...(current.project.branding || DEFAULT_BRANDING),
      name: branding.name,
      tagline: branding.tagline,
      logoKey: branding.logoKey
    }
    // What the scenes say doesn't change, only how they're made: each keeps
    // its plan (review 6: an identity saved first re-keyed an older plan).
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
