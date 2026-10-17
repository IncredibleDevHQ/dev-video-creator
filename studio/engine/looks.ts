// A notebook starts with a look and changes it beside its wireframes: a look
// saved for the site, the colours read from the site, or the neutral Paper
// look when the site showed none (review 5: the built-in orange fallback was
// presented as "Suggestion from stripe.com").
import type { BrandFontFile, Branding, SiteOffer } from '../shared/settings'
import {
  LOOKS,
  NEUTRAL_LOOK,
  filesFor,
  type Look,
  type LookPalette
} from '../shared/looks'

const NO_IDENTITY: Branding = {
  name: '',
  tagline: '',
  accent: NEUTRAL_LOOK.palette.accent,
  useAccent: false,
  logoKey: null
}
import { brandDomain, loadBrandLibrary } from './brand-library'
import { fontName, loadableFont } from '../shared/looks'
import type { SourceRead } from './source-document'
import { Refusal } from './refusal'

/**
 * Which of a look's fonts can't be loaded here and what stands in: each
 * stand-in named once, the words agreeing with how many there are.
 */
export const fontsStandingIn = (standing: Array<{ value: string }>) => {
  const names = [...new Set(standing.map((font) => fontName(font.value)))]
  return `${standing.length > 1 ? 'Its fonts' : 'One of its fonts'} can’t be loaded here, so ${names.join(' and ')} ${names.length > 1 ? 'stand' : 'stands'} in.`
}

/** A face the look can show: one it carries a file for keeps its name; any
 * other is the nearest built-in, said as replaced. */
const showable = (family: string, files: BrandFontFile[]) =>
  files.some((file) => file.family === family)
    ? { value: family, replaced: false }
    : loadableFont(family)

/** The look read from a source's site: its colours and the fonts it can
 * show (a face it carries a file for keeps its name). Null when the site
 * showed no colours of its own. */
const siteLookCore = (source: SourceRead | null) => {
  if (source?.palette.provenance !== 'extracted') return null
  const files = source.brand?.fontFiles || []
  const display = showable(source.fonts.display, files)
  const body = showable(source.fonts.body, files)
  const standing = [display, body].filter((font) => font.replaced)
  const domain = source.url ? brandDomain(source.url) : null
  const site = source.site || domain
  return {
    name: source.site || domain || 'The site',
    // Only the fonts that stand in are named (one may load as it is).
    description: standing.length
      ? `Colours read from ${site}. ${fontsStandingIn(standing)}`
      : `Colours and fonts read from ${site}.`,
    palette: {
      ground: source.palette.ground,
      text: source.palette.text,
      accent: source.palette.accent,
      secondary: source.palette.secondary
    },
    fonts: {
      display: display.value,
      body: body.value,
      mono: showable(source.fonts.mono, files).value
    }
  }
}

/** What a source's site offers a notebook: its look, logo, icon and open
 * faces. */
export const siteOffer = (source: SourceRead | null): SiteOffer | undefined => {
  if (!source?.url || !(source.brand || siteLookCore(source))) return undefined
  const look = siteLookCore(source)
  return {
    from: brandDomain(source.url) || source.site,
    ...(look ? { look } : {}),
    ...(source.brand?.logo ? { logo: source.brand.logo } : {}),
    ...(source.brand?.symbol ? { symbol: source.brand.symbol } : {}),
    fontFiles: source.brand?.fontFiles || []
  }
}

/** The look read from a source's site, or null when it showed no colours. */
export const siteLook = (source: SourceRead | null): Look | null => {
  const core = siteLookCore(source)
  if (!core) return null
  const offer = siteOffer(source)
  return {
    id: 'site',
    ...core,
    fontFiles: filesFor(core.fonts, source?.brand?.fontFiles || []),
    ...(offer ? { site: offer } : {})
  }
}

/** The look a notebook starts with, before the creator chooses one. */
export const startingLook = async (
  source: SourceRead | null
): Promise<Look> => {
  const domain = source?.url ? brandDomain(source.url) : null
  const saved = domain
    ? (await loadBrandLibrary()).find((entry) => entry.domain === domain)
    : undefined
  const offer = saved?.brand.site || siteOffer(source)
  if (saved?.brand.palette && saved.brand.fonts) {
    const files = saved.brand.fontFiles || []
    const fonts = {
      display: showable(saved.brand.fonts.display, files),
      body: showable(saved.brand.fonts.body, files),
      mono: showable(saved.brand.fonts.mono, files)
    }
    const standing = [fonts.display, fonts.body].filter((font) => font.replaced)
    const chosen = {
      display: fonts.display.value,
      body: fonts.body.value,
      mono: fonts.mono.value
    }
    return {
      id: `saved:${saved.id}`,
      name: saved.brand.look?.name || saved.brand.name || domain!,
      description: standing.length
        ? `Your saved look for ${domain}. ${fontsStandingIn(standing)}`
        : `Your saved look for ${domain}.`,
      palette: { ...saved.brand.palette, accent: saved.brand.accent },
      fonts: chosen,
      fontFiles: filesFor(chosen, files),
      ...(offer ? { site: offer } : {}),
      // The logo the creator chose for this site's notebooks.
      ...(saved.brand.logoKey ? { logoKey: saved.brand.logoKey } : {})
    }
  }
  return (
    siteLook(source) || {
      ...NEUTRAL_LOOK,
      ...(offer ? { site: offer } : {})
    }
  )
}

/** A notebook's branding wearing a look; the creator's identity is kept. */
export const withLook = (
  branding: Branding | undefined,
  look: Look
): Branding => ({
  ...(branding || NO_IDENTITY),
  accent: look.palette.accent,
  useAccent: true,
  palette: {
    ground: look.palette.ground,
    text: look.palette.text,
    secondary: look.palette.secondary
  },
  fonts: { ...look.fonts },
  // A look of the studio's own describes itself; one read from a site or
  // saved keeps its words, which say when its fonts stand in.
  look: {
    id: look.id,
    name: look.name,
    ...(LOOKS.some((item) => item.id === look.id) || !look.description
      ? {}
      : { note: look.description })
  },
  // The files its fonts need go with it; a built-in look needs none.
  fontFiles: look.fontFiles?.length ? look.fontFiles : undefined,
  ...(look.site ? { site: look.site } : {}),
  ...(look.logoKey ? { logoKey: look.logoKey } : {})
})

export const paletteOf = (
  branding: Branding | undefined
): LookPalette | null =>
  branding?.palette ? { ...branding.palette, accent: branding.accent } : null

const hex = /^#[0-9a-f]{6}$/i
export const validateLook = (raw: unknown): Look => {
  const look = raw as Look
  const named = LOOKS.find((item) => item.id === look?.id)
  if (named) return named
  if (
    !look ||
    typeof look.id !== 'string' ||
    typeof look.name !== 'string' ||
    look.id.length > 100 ||
    !look.name.trim() ||
    look.name.length > 100 ||
    !['ground', 'text', 'accent', 'secondary'].every((key) =>
      hex.test(look.palette?.[key as keyof LookPalette] || '')
    ) ||
    !['display', 'body', 'mono'].every(
      (key) =>
        typeof look.fonts?.[key as keyof Look['fonts']] === 'string' &&
        look.fonts[key as keyof Look['fonts']].trim() &&
        look.fonts[key as keyof Look['fonts']].length <= 100
    )
  )
    throw new Refusal('Choose a look, or three colours and two fonts')
  return {
    id: look.id,
    name: look.name.trim(),
    description: '',
    palette: { ...look.palette },
    fonts: { ...look.fonts }
  }
}
