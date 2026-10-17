// A site's fonts by name and role, and which of them may travel with a look.
// Sites rename their faces for loading (`Inter-1b28280e86394dd4`, Next.js's
// `__Inter_d65c78`, `Inter Fallback`); the brand's font is the name under
// that. Only an openly licensed face (SIL OFL, Apache, Ubuntu) is kept as a
// file: a site's licence for a commercial face covers its own web pages, not
// a video made from them, so those show as the nearest built-in instead.

const GENERIC = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'emoji',
  'math',
  'fangsong',
  'inherit',
  'initial'
])

/** A font that draws icons, never the brand's text face. */
export const iconFont = (family: string) =>
  /(?:^|[\s_-])icons?(?:[\s_-]|$)|icomoon|awesome|glyphicons?|material\s*(?:icons|symbols)|feather|(?:icon|glyph).*font|font.*(?:icon|glyph)/i.test(
    family
  )

/** The family a site's loading name stands for. */
export const cleanFamily = (raw: string) => {
  let name = (raw || '').split(',')[0].replace(/["']/g, '').trim()
  name = name.replace(/\s+fallback(?:\s*:.*)?$/i, '')
  const nextFont = /^__(.+?)(?:_Fallback)?_[0-9a-f]{5,}$/i.exec(name)
  if (nextFont) name = nextFont[1].replace(/_/g, ' ')
  return name.replace(/[-_][0-9a-f]{6,}$/i, '').trim()
}

export const genericFamily = (family: string) =>
  GENERIC.has(family.trim().toLowerCase())

// Openly licensed families, as their foundry names them. Most are on Google
// Fonts (OFL or Apache); Geist and Inter Display are OFL too.
const OPEN = [
  'Albert Sans',
  'Anton',
  'Archivo',
  'Atkinson Hyperlegible',
  'Barlow',
  'Be Vietnam Pro',
  'Bebas Neue',
  'Bitter',
  'Bricolage Grotesque',
  'Cabin',
  'Commit Mono',
  'Cormorant',
  'Crimson Pro',
  'DM Mono',
  'DM Sans',
  'DM Serif Display',
  'EB Garamond',
  'Epilogue',
  'Figtree',
  'Fira Code',
  'Fira Mono',
  'Fira Sans',
  'Fraunces',
  'Geist',
  'Geist Mono',
  'Hanken Grotesk',
  'IBM Plex Mono',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Inconsolata',
  'Instrument Sans',
  'Instrument Serif',
  'Inter',
  'Inter Display',
  'Inter Tight',
  'JetBrains Mono',
  'Josefin Sans',
  'Karla',
  'Lato',
  'Lexend',
  'Libre Franklin',
  'Literata',
  'Lora',
  'Manrope',
  'Martian Mono',
  'Merriweather',
  'Montserrat',
  'Mulish',
  'Newsreader',
  'Noto Sans',
  'Noto Serif',
  'Nunito',
  'Nunito Sans',
  'Onest',
  'Open Sans',
  'Oswald',
  'Outfit',
  'Overpass',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Poppins',
  'PT Sans',
  'PT Serif',
  'Public Sans',
  'Quicksand',
  'Raleway',
  'Recursive',
  'Red Hat Display',
  'Red Hat Mono',
  'Red Hat Text',
  'Roboto',
  'Roboto Flex',
  'Roboto Mono',
  'Rubik',
  'Schibsted Grotesk',
  'Sora',
  'Source Code Pro',
  'Source Sans 3',
  'Source Sans Pro',
  'Source Serif 4',
  'Source Serif Pro',
  'Space Grotesk',
  'Space Mono',
  'Spectral',
  'Ubuntu',
  'Ubuntu Mono',
  'Urbanist',
  'Work Sans'
]

const keyOf = (family: string) =>
  family
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(?:variable|var|vf)$/, '')
const OPEN_KEYS = new Map(OPEN.map((family) => [keyOf(family), family]))
// Names sites load open faces under: Vercel's next/font names, IBM's short
// names, and Notion's renamed Inter (OFL allows a renamed build).
for (const [alias, family] of [
  ['geistsans', 'Geist'],
  ['geistmono', 'Geist Mono'],
  ['plexsans', 'IBM Plex Sans'],
  ['plexmono', 'IBM Plex Mono'],
  ['plexserif', 'IBM Plex Serif'],
  ['notioninter', 'Inter']
])
  OPEN_KEYS.set(alias, family)

/** The open family a site's face is, by its foundry name; null for any other. */
export const openFamily = (family: string) =>
  OPEN_KEYS.get(keyOf(cleanFamily(family))) ?? null

/** How the page named and used its faces (site-brand-page.ts). */
export type FontSignals = {
  /** Families by how much text they set, most first. */
  ranked: Array<{ family: string; weight: number }>
  heading: string
  body: string
  mono: string
  /** `--font-*` custom properties on :root, by name. */
  variables: Record<string, string>
}

const usable = (family: string) =>
  Boolean(family) && !genericFamily(family) && !iconFont(family)

const fromVariables = (variables: Record<string, string>, pattern: RegExp) => {
  for (const [name, value] of Object.entries(variables))
    if (pattern.test(name)) {
      const family = cleanFamily(value)
      if (usable(family)) return family
    }
  return ''
}

/** An open face by its foundry name, any other as the site names it. */
const named = (family: string) => openFamily(family) ?? family

/**
 * The headings, text and code faces. What the page paints wins over what its
 * stylesheet declares: an h1's computed face is the display face in use.
 */
export const fontRoles = (signals: FontSignals) => {
  const ranked = signals.ranked
    .map((entry) => cleanFamily(entry.family))
    .filter(usable)
  const mono = (family: string) =>
    /mono|code|courier|menlo|consolas/i.test(family)
  const text = ranked.filter((family) => !mono(family))
  const pick = (...choices: string[]) =>
    choices.map(cleanFamily).find(usable) || ''
  const display =
    pick(signals.heading) ||
    fromVariables(signals.variables, /display|heading|title/i) ||
    text[0] ||
    'system-ui'
  const body =
    pick(signals.body) ||
    fromVariables(signals.variables, /sans|body|text|base|copy/i) ||
    text[1] ||
    text[0] ||
    display
  // A code face is a monospaced one: inline code set in the text face
  // isn't the brand's code face.
  const code =
    [cleanFamily(signals.mono)].find(
      (family) => usable(family) && mono(family)
    ) ||
    fromVariables(signals.variables, /mono|code/i) ||
    ranked.find(mono) ||
    'ui-monospace'
  return {
    display: named(mono(display) && text[0] ? text[0] : display),
    body: named(mono(body) && text[0] ? text[0] : body),
    mono: named(code),
    seen: [...new Set(ranked.map(named))].slice(0, 6)
  }
}
