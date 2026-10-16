// A site's own logo, made safe and usable away from its page. An SVG lifted
// from a page is reduced to drawing alone (no script, no handlers, no links
// out, no foreign content), keeps the paint the page gave it, and, drawn in
// one colour that would vanish on the look's ground, takes the look's text
// colour. The page's icons are ranked the way browsers would pick them.
import { DOMParser } from 'linkedom'
import { lightness } from './brand-colour'

const ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern'
])

const ATTRIBUTES = new Set([
  'xmlns',
  'xmlns:xlink',
  'version',
  'id',
  'viewBox',
  'preserveAspectRatio',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'clip-path',
  'mask',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'display',
  'visibility',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternTransform',
  'maskUnits',
  'clipPathUnits',
  'spreadMethod',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'dx',
  'dy',
  'vector-effect',
  'paint-order',
  'href',
  'xlink:href'
])

// A paint or reference that points anywhere but inside this drawing.
const OUTSIDE = /url\(\s*['"]?(?!#)|javascript:|expression\s*\(|@import/i

/** The SVG reduced to safe drawing, or null when nothing drawable is left. */
export const sanitizeSvg = (markup: string): string | null => {
  if (!/<svg[\s>]/i.test(markup) || markup.length > 400_000) return null
  const svg = /<svg[\s\S]*<\/svg>/i.exec(markup)?.[0]
  if (!svg) return null
  let root: Element
  try {
    root = new DOMParser().parseFromString(svg, 'image/svg+xml')
      .documentElement as unknown as Element
  } catch {
    return null
  }
  if (!root || root.tagName !== 'svg') return null
  const walk = (element: Element) => {
    for (const child of Array.from(element.children)) {
      if (!ELEMENTS.has(child.tagName)) {
        child.remove()
        continue
      }
      walk(child)
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name
      const value = attribute.value
      const allowed =
        ATTRIBUTES.has(name) &&
        !OUTSIDE.test(value) &&
        ((name !== 'href' && name !== 'xlink:href') || value.startsWith('#'))
      if (!allowed) element.removeAttribute(name)
    }
  }
  walk(root)
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (root.querySelector('[xlink\\:href]'))
    root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  if (!root.querySelector('path, rect, circle, ellipse, polygon, text, use'))
    return null
  return root.outerHTML
}

const HEX = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi

const hexOf = (value: string) => {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value)
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase()
  const rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/i.exec(
    value
  )
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return null
  return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** The colours a drawing paints with, in the order it uses them. */
export const svgColours = (svg: string) => {
  const found: string[] = []
  for (const match of svg.matchAll(
    /(?:fill|stroke|stop-color|color)\s*=\s*"([^"]+)"/gi
  ))
    for (const value of match[1].match(HEX) || []) {
      const hex = hexOf(value)
      if (hex && !found.includes(hex)) found.push(hex)
    }
  return found
}

/**
 * A one-colour drawing that would vanish on the ground, painted in the
 * look's text colour; any other drawing as it is.
 */
export const readableOn = (svg: string, ground: string, text: string) => {
  const colours = svgColours(svg)
  if (colours.length !== 1) return svg
  if (Math.abs(lightness(colours[0]) - lightness(ground)) > 64) return svg
  return svg.replace(
    /((?:fill|stroke|color)\s*=\s*")([^"]+)(")/gi,
    (whole, start, value, end) =>
      value.match(HEX) ? `${start}${text}${end}` : whole
  )
}

/** One `<link rel="icon">` the page declared. */
export type IconLink = {
  rel: string
  href: string
  sizes?: string | null
  type?: string | null
}

const largest = (sizes?: string | null) =>
  Math.max(
    0,
    ...(sizes || '')
      .split(/\s+/)
      .map((token) => /^(\d+)x(\d+)$/i.exec(token))
      .filter(Boolean)
      .map((match) => Math.max(Number(match![1]), Number(match![2])))
  )

/** Best first: an SVG, then the largest declared, then an .ico, and a
 * pinned-tab mask icon (a one-colour silhouette) only as a last resort. */
export const rankIcons = (icons: IconLink[]) =>
  icons
    .filter((icon) => icon.href)
    .map((icon, at) => {
      const rel = icon.rel.toLowerCase()
      const path = icon.href.split(/[?#]/)[0].toLowerCase()
      const tier = /(^|\s)mask-icon(\s|$)/.test(rel)
        ? 3
        : /svg/.test(icon.type || '') || path.endsWith('.svg')
          ? 0
          : /icon/.test(icon.type || '') || path.endsWith('.ico')
            ? 2
            : 1
      const size =
        largest(icon.sizes) || (/apple-touch-icon/.test(rel) ? 180 : 0)
      return { icon, at, tier, size }
    })
    .sort((a, b) => a.tier - b.tier || b.size - a.size || a.at - b.at)
    .map((entry) => entry.icon)
