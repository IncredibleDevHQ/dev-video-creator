// A notebook starts with a look and changes it beside its wireframes: a look
// saved for the site, the colours read from the site, or the neutral Paper
// look when the site showed none (review 5: the built-in orange fallback was
// presented as "Suggestion from stripe.com").
import type { Branding } from '../shared/settings'
import {
  LOOKS,
  NEUTRAL_LOOK,
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
import { loadableFont } from '../shared/looks'
import type { SourceRead } from './source-document'
import { Refusal } from './refusal'

/**
 * Which of a look's fonts can't be loaded here and what stands in: each
 * stand-in named once, the words agreeing with how many there are.
 */
export const fontsStandingIn = (standing: Array<{ value: string }>) => {
  const names = [...new Set(standing.map((font) => font.value))]
  return `${standing.length > 1 ? 'Its fonts' : 'One of its fonts'} can’t be loaded here, so ${names.join(' and ')} ${names.length > 1 ? 'stand' : 'stands'} in.`
}

/** The look a notebook starts with, before the creator chooses one. */
export const startingLook = async (
  source: SourceRead | null
): Promise<Look> => {
  const domain = source?.url ? brandDomain(source.url) : null
  const saved = domain
    ? (await loadBrandLibrary()).find((entry) => entry.domain === domain)
    : undefined
  if (saved?.brand.palette && saved.brand.fonts) {
    const fonts = {
      display: loadableFont(saved.brand.fonts.display),
      body: loadableFont(saved.brand.fonts.body),
      mono: loadableFont(saved.brand.fonts.mono)
    }
    const standing = [fonts.display, fonts.body].filter((font) => font.replaced)
    return {
      id: `saved:${saved.id}`,
      name: saved.brand.look?.name || saved.brand.name || domain!,
      description: standing.length
        ? `Your saved look for ${domain}. ${fontsStandingIn(standing)}`
        : `Your saved look for ${domain}.`,
      palette: { ...saved.brand.palette, accent: saved.brand.accent },
      fonts: {
        display: fonts.display.value,
        body: fonts.body.value,
        mono: fonts.mono.value
      }
    }
  }
  if (source?.palette.provenance === 'extracted') {
    // A site's own fonts can't be loaded: the nearest built-in stands in,
    // and the look says so.
    const display = loadableFont(source.fonts.display)
    const body = loadableFont(source.fonts.body)
    const standing = [display, body].filter((font) => font.replaced)
    const site = source.site || domain
    return {
      id: 'site',
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
        mono: loadableFont(source.fonts.mono).value
      }
    }
  }
  return NEUTRAL_LOOK
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
  }
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
