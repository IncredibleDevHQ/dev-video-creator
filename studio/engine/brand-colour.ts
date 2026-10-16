// A brand's colours by what they do on its site, not by how much of each
// there is: the ground is what paints the most real background, the accent
// is the colourful one that recurs across roles (button fills, link text,
// badges), sits on real controls and runs through the page as a family of
// tints, and the text is the dominant ink that reads on the ground. The
// counts come from one pass over the rendered page (site-brand-page.ts).

/** How one colour is used across the page. */
export type ColourStat = {
  hex: string
  /** Every use, as a background or as text. */
  count: number
  /** Painted as a background. */
  bgCount: number
  /** A background on a link, button or other control. */
  interactiveBg: number
  /** A background over a large block (more than 50,000 px²). */
  areaBg: number
  /** Used as a text colour. */
  textCount: number
  /** The largest single area it fills, in px². */
  maxArea: number
}

export type BrandRoles = {
  ground: string
  text: string
  /** Absent when the site shows no colour of its own. */
  accent?: string
  second?: string
}

// The colours a browser gives links nobody styled: never a brand's.
const BROWSER_LINKS = new Set(['#0000EE', '#551A8B', '#0000FF', '#EE0000'])

export const rgbOf = (hex: string) => {
  const raw = hex.replace('#', '')
  return [0, 2, 4].map((at) => parseInt(raw.slice(at, at + 2), 16))
}

/** Perceived lightness on 0–255. */
export const lightness = (hex: string) => {
  const [r, g, b] = rgbOf(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** How colourful, 0–255: the spread between the strongest and weakest channel. */
export const colourfulness = (hex: string) => {
  const rgb = rgbOf(hex)
  return Math.max(...rgb) - Math.min(...rgb)
}

const valid = (hex: string) => /^#[0-9A-F]{6}$/i.test(hex)

/** A colour's hue, 0–360. */
export const hueOf = (hex: string) => {
  const [r, g, b] = rgbOf(hex).map((value) => value / 255)
  const max = Math.max(r, g, b)
  const spread = max - Math.min(r, g, b)
  if (!spread) return 0
  const hue =
    max === r
      ? ((g - b) / spread) % 6
      : max === g
        ? (b - r) / spread + 2
        : (r - g) / spread + 4
  return (hue * 60 + 360) % 360
}

const hueDistance = (a: string, b: string) => {
  const distance = Math.abs(hueOf(a) - hueOf(b))
  return Math.min(distance, 360 - distance)
}

/**
 * The ground, text, accent and second accent of a site. `palette` is the
 * page's colours in order of prominence (what the eye meets most), which
 * separates a brand colour used everywhere from a one-off button.
 */
export const brandRoles = (
  stats: ColourStat[],
  palette: string[]
): BrandRoles | null => {
  const usable = stats
    .map((stat) => ({ ...stat, hex: stat.hex.toUpperCase() }))
    .filter((stat) => valid(stat.hex))
  if (!usable.length) return null
  const ground = [...usable].sort(
    (a, b) =>
      b.areaBg - a.areaBg || b.maxArea - a.maxArea || b.bgCount - a.bgCount
  )[0].hex
  const order = new Map(palette.map((hex, at) => [hex.toUpperCase(), at]))
  const prominence = (hex: string) => order.get(hex) ?? 1e9
  const roles = (stat: ColourStat) =>
    (stat.interactiveBg > 0 ? 1 : 0) +
    (stat.textCount > 0 ? 1 : 0) +
    (stat.bgCount > 0 ? 1 : 0)
  // The page's colourful colours by hue: a brand colour shows as a family
  // (its tints and shades through the page), a status colour as one swatch.
  const colourful = palette
    .map((hex) => hex.toUpperCase())
    .filter((hex) => valid(hex) && colourfulness(hex) > 40)
  const weightOf = (hex: string) => 1 / (1 + prominence(hex) / 4)
  const total = colourful.reduce((sum, hex) => sum + weightOf(hex), 0) || 1
  const family = (hex: string) =>
    colourful
      .filter((other) => hueDistance(other, hex) <= 18)
      .reduce((sum, other) => sum + weightOf(other), 0) / total
  const seen = new Map(usable.map((stat) => [stat.hex, stat]))
  const pool = [
    ...usable,
    ...colourful
      .filter((hex) => !seen.has(hex))
      .map((hex) => ({
        hex,
        count: 0,
        bgCount: 0,
        interactiveBg: 0,
        areaBg: 0,
        textCount: 0,
        maxArea: 0
      }))
  ]
  const score = (stat: ColourStat) => {
    const rank = prominence(stat.hex)
    return (
      3 * roles(stat) +
      (stat.interactiveBg > 0 ? 2 : 0) +
      4 * family(stat.hex) +
      (rank < 3 ? 1.5 : rank < 8 ? 1 : rank < 16 ? 0.5 : 0)
    )
  }
  const accents = (exclude: string[]) =>
    pool
      .filter(
        (stat) =>
          colourfulness(stat.hex) > 40 &&
          !exclude.includes(stat.hex) &&
          !BROWSER_LINKS.has(stat.hex)
      )
      .sort(
        (a, b) =>
          score(b) - score(a) ||
          prominence(a.hex) - prominence(b.hex) ||
          b.count - a.count ||
          colourfulness(b.hex) - colourfulness(a.hex)
      )
  const accent = accents([ground])[0]?.hex
  const groundLight = lightness(ground)
  const text =
    [...usable]
      .filter((stat) => stat.hex !== ground && stat.hex !== accent)
      .sort((a, b) => b.textCount - a.textCount)
      .find((stat) => Math.abs(lightness(stat.hex) - groundLight) > 64)?.hex ??
    (groundLight > 128 ? '#111111' : '#F5F5F5')
  // A second accent is another colour: a different hue, not a pale wash, a
  // near-black or a shade of the accent.
  const colours = (accent ? accents([ground, text, accent]) : []).filter(
    (stat) => {
      const [r, g, b] = rgbOf(stat.hex)
      const level = (Math.max(r, g, b) + Math.min(r, g, b)) / 510
      return level >= 0.12 && level <= 0.8
    }
  )
  const second = (
    colours.find((stat) => hueDistance(stat.hex, accent!) > 25) || colours[0]
  )?.hex
  return {
    ground,
    text,
    ...(accent ? { accent } : {}),
    ...(second ? { second } : {})
  }
}
