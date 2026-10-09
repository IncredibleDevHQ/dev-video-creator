// A notebook's look: three colours and two fonts, chosen from named looks or
// read from the article's site, changed beside the wireframes (review 5).
// The look is not the creator's identity: a look never sets "Your name".

export type LookPalette = {
  ground: string
  text: string
  accent: string
  secondary: string
}
export type LookFonts = { display: string; body: string; mono: string }
export type Look = {
  id: string
  name: string
  description: string
  palette: LookPalette
  fonts: LookFonts
}

const sans: LookFonts = {
  display: 'Inter',
  body: 'Inter',
  mono: 'ui-monospace'
}

/** Named looks, each with one sentence. The first is the neutral start. */
export const LOOKS: Look[] = [
  {
    id: 'paper',
    name: 'Paper',
    description: 'White page, graphite type and one calm blue. Reads anywhere.',
    palette: {
      ground: '#ffffff',
      text: '#1f2328',
      accent: '#3a5fcd',
      secondary: '#7b8794'
    },
    fonts: sans
  },
  {
    id: 'ink',
    name: 'Ink',
    description:
      'A near-black page with soft white type, for systems and code.',
    palette: {
      ground: '#15181d',
      text: '#eef1f4',
      accent: '#5eb0ff',
      secondary: '#93a0ae'
    },
    fonts: sans
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Deep blue with white line work, like an engineering drawing.',
    palette: {
      ground: '#10294a',
      text: '#eaf2fb',
      accent: '#ffcf5c',
      secondary: '#86b1df'
    },
    fonts: sans
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'A soft green page with dark green type. Friendly and quiet.',
    palette: {
      ground: '#f2f8f3',
      text: '#16301f',
      accent: '#21783d',
      secondary: '#6d8f7a'
    },
    fonts: sans
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'A cream page with serif headings and a warm orange accent.',
    palette: {
      ground: '#fbf7ef',
      text: '#221b14',
      accent: '#d9541e',
      secondary: '#9b8d7c'
    },
    fonts: { display: 'Georgia', body: 'Inter', mono: 'ui-monospace' }
  }
]
export const NEUTRAL_LOOK = LOOKS[0]

/** Fonts the creator can choose: menus, not typed names. */
export const FONT_CHOICES: Array<{ value: string; label: string }> = [
  { value: 'Inter', label: 'Inter' },
  { value: 'system-ui', label: 'System sans' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'ui-serif', label: 'System serif' },
  { value: 'ui-monospace', label: 'Monospace' }
]

// Fonts a Mac or a PC shows without loading anything. Windows' own Segoe UI
// and Consolas are not among them (review 6: a look kept them, and another
// font showed with no word).
const SAFE = new Set([
  'arial',
  'helvetica',
  'helvetica neue',
  'georgia',
  'times new roman',
  'verdana',
  'trebuchet ms',
  'courier new'
])
const SERIF =
  /serif|tiempos|georgia|times|garamond|merriweather|lora|playfair|caslon|baskerville|minion|charter|spectral|crimson|libre/i

/**
 * A font the studio can show: a built-in or common one as it is, else the
 * nearest built-in, said as replaced (review 6: a site's own fonts never
 * load, and Inter showed with no word).
 */
export const loadableFont = (family: string) => {
  const name = family.trim()
  if (
    FONT_CHOICES.some((choice) => choice.value === name) ||
    SAFE.has(name.toLowerCase())
  )
    return { value: name, replaced: false }
  const value = /mono|code|courier|menlo|consolas/i.test(name)
    ? 'ui-monospace'
    : /^segoe ui$/i.test(name)
      ? 'system-ui'
      : SERIF.test(name) && !/sans/i.test(name)
        ? 'Georgia'
        : 'Inter'
  return { value, replaced: true }
}

const hexOf = (value: string) => {
  const raw = value.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}
const toHex = (rgb: number[]) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
const distance = (a: number[], b: number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * The same colour in another look. A drawn page mixes its look's colours:
 * the ground, and tints between the ground and the text, the accent or the
 * secondary colour. Each such colour is re-mixed from the new look; a colour
 * that is not a mix of the look (a red for a refusal) keeps its meaning.
 */
export const lookColour = (
  colour: string,
  from: LookPalette,
  to: LookPalette
) => {
  const c = hexOf(colour)
  const ground = hexOf(from.ground)
  let best: { error: number; t: number; key: keyof LookPalette } | null = null
  for (const key of ['accent', 'text', 'secondary'] as const) {
    const end = hexOf(from[key])
    const span = end.map((v, i) => v - ground[i])
    const length = span.reduce((sum, v) => sum + v * v, 0)
    if (!length) continue
    const t = Math.min(
      1,
      Math.max(
        0,
        span.reduce((sum, v, i) => sum + v * (c[i] - ground[i]), 0) / length
      )
    )
    const error = distance(
      c,
      ground.map((v, i) => v + span[i] * t)
    )
    if (!best || error < best.error - 0.5) best = { error, t, key }
  }
  if (!best || best.error > 20) return colour
  const toGround = hexOf(to.ground)
  const toEnd = hexOf(to[best.key])
  return toHex(toGround.map((v, i) => v + (toEnd[i] - v) * best!.t))
}

/** A drawn page (or any text holding its colours) moved to another look. */
export const recolourLook = (
  svg: string,
  from: LookPalette,
  to: LookPalette,
  fonts?: { from: LookFonts; to: LookFonts }
) => {
  const cache = new Map<string, string>()
  let out = svg.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (match) => {
    const key = match.toLowerCase()
    if (!cache.has(key)) cache.set(key, lookColour(key, from, to))
    return cache.get(key)!
  })
  if (fonts)
    out = out.replace(/font-family="([^"]*)"/g, (_whole, value: string) => {
      let family = value
      for (const key of ['display', 'body', 'mono'] as const)
        if (fonts.from[key] && fonts.from[key] !== fonts.to[key])
          family = family
            .split(',')
            .map((part) =>
              part.trim().replace(/^['"]|['"]$/g, '') === fonts.from[key]
                ? fonts.to[key]
                : part.trim()
            )
            .join(', ')
      return `font-family="${family}"`
    })
  return out
}
