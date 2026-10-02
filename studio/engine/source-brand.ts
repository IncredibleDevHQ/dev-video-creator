import { hsl } from './source-colours'
// The colours a browser paints links with when a page sets none.
export const BROWSER_COLOURS = new Set([
  '#0000ee',
  '#551a8b',
  '#ee0000',
  '#ff0000'
])
export const GENERIC_FONTS = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'inherit',
  'initial',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'cursive',
  'fantasy',
  'emoji',
  'math',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'roboto',
  'helvetica neue',
  'arial',
  'helvetica',
  'apple color emoji',
  'segoe ui emoji',
  'segoe ui symbol',
  'noto color emoji',
  'sfmono-regular',
  'menlo',
  'consolas',
  'courier new',
  'liberation mono',
  'monaco',
  'font awesome 6 free',
  'fontawesome'
])

// ——— colour helpers ———

export const hexOf = (raw: string): string | null => {
  const value = raw.trim().toLowerCase()
  let match = /^#([0-9a-f]{6})\b/.exec(value)
  if (match) return `#${match[1]}`
  match = /^#([0-9a-f]{3})\b/.exec(value)
  if (match)
    return `#${match[1]
      .split('')
      .map((c) => c + c)
      .join('')}`
  match =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/.exec(
      value
    )
  if (match) {
    if (match[4] !== undefined && Number(match[4]) < 0.5) return null
    return `#${[match[1], match[2], match[3]]
      .map((n) =>
        Math.max(0, Math.min(255, Number(n)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')}`
  }
  match =
    /^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*([\d.]+%?)\s*)?\)/.exec(
      value
    )
  if (match)
    return `#${[match[1], match[2], match[3]]
      .map((n) =>
        Math.max(0, Math.min(255, Number(n)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')}`
  return null
}

export const isNeutral = (hex: string) => {
  const { s, l } = hsl(hex)
  return s < 0.14 || l > 0.94 || l < 0.07
}

export class Tally {
  private map = new Map<string, number>()
  add(hex: string | null, weight: number) {
    if (!hex || !Number.isFinite(weight) || weight <= 0) return
    this.map.set(hex, (this.map.get(hex) || 0) + weight)
  }
  top(limit: number) {
    return [...this.map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([hex, weight]) => ({ hex, weight: Math.round(weight) }))
  }
  get size() {
    return this.map.size
  }
}

export const cssColours = (css: string, tally: Tally, weight = 1) => {
  const declarations = css.match(/(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi) || []
  declarations.forEach((raw) => tally.add(hexOf(raw), weight))
  // custom properties that name the brand count more
  const named =
    css.match(
      /--[\w-]*(brand|primary|accent|theme|highlight)[\w-]*\s*:\s*([^;}]+)/gi
    ) || []
  named.forEach((line) => {
    const value = line.split(':').slice(1).join(':')
    tally.add(hexOf(value.trim()), weight * 40)
  })
}

// Font loaders hash family names ("Inter-1b28280e86394dd4", "… fallback: Arial"); keep the human name.
export const cleanFontName = (raw: string) =>
  raw
    .replace(/["']/g, '')
    .replace(/\s+fallback:.*$/i, '')
    .replace(/[-_]?[0-9a-f]{10,}$/i, '')
    .replace(/__[\w-]+$/, '')
    .trim()

export const cssFonts = (
  css: string,
  tally: Map<string, number>,
  weight = 1
) => {
  const declarations = css.match(/font-family\s*:\s*([^;}]+)/gi) || []
  declarations.forEach((line) => {
    const first = cleanFontName(
      line.split(':').slice(1).join(':').split(',')[0]
    )
    if (!first) return
    const key = first.toLowerCase()
    if (
      GENERIC_FONTS.has(key) ||
      /icon|awesome|glyph|symbol/i.test(key) ||
      key.startsWith('var(')
    )
      return
    tally.set(first, (tally.get(first) || 0) + weight)
  })
}
