// Phase 0 of the plan: how a video begins. A pasted link or narrative becomes
// three things every later stage reads — a brand read off the source, an
// outline with a runtime target, and pages that already carry the contract
// (stable ids, named groups with roles, directed connectors with verbs). The
// pages are rendered here, deterministically, so nothing downstream has to
// guess what a shape is.
import { parseHTML } from 'linkedom'
import { storeAsset } from './persistence'

// ——— reading a source ———

export type SourceRead = {
  kind: 'url' | 'narrative'
  url: string
  site: string
  title: string
  description: string
  text: string
  words: number
  headings: Array<{ level: number; text: string }>
  images: Array<{ url: string; alt: string }>
  logos: Array<{ url: string; source: string; localUrl?: string }>
  palette: {
    candidates: Array<{ hex: string; weight: number; role?: 'ground' | 'text' | 'accent' | 'secondary' }>
    ground: string
    text: string
    accent: string
    secondary: string
    themeColor: string
  }
  fonts: { display: string; body: string; mono: string; seen: string[] }
  warnings: string[]
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 IncredibleStudio/2'
const GENERIC_FONTS = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'inherit', 'initial', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy', 'emoji', 'math', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'arial', 'helvetica', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji', 'sfmono-regular', 'menlo', 'consolas', 'courier new', 'liberation mono', 'monaco', 'font awesome 6 free', 'fontawesome'])

const assertPublicUrl = (raw: string) => {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('That is not a link the studio can open')
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Only http and https links can be read')
  const host = url.hostname.toLowerCase()
  // The private-network guard stands in normal launches; scripted checks run
  // a fixture brand site on loopback under the test-hooks flag (the same flag
  // that already exposes /__eval — never set in a normal launch).
  if (process.env.STUDIO_ENABLE_TEST_HOOKS !== '1' && (host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === '::1' || host === '[::1]')) {
    throw new Error('Links to this machine or a private network cannot be read')
  }
  return url
}

const fetchText = async (url: string, maximumBytes: number, timeoutMs = 15_000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,text/css,*/*;q=0.8' }, redirect: 'follow', signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    return { text: buffer.subarray(0, maximumBytes).toString('utf8'), contentType: response.headers.get('content-type') || '', finalUrl: response.url || url }
  } finally {
    clearTimeout(timer)
  }
}

const fetchBinary = async (url: string, maximumBytes: number, timeoutMs = 10_000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.5' }, redirect: 'follow', signal: controller.signal })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || ''
    if (!/^image\//.test(contentType)) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > maximumBytes) return null
    return { buffer, contentType }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ——— colour helpers ———

const hexOf = (raw: string): string | null => {
  const value = raw.trim().toLowerCase()
  let match = /^#([0-9a-f]{6})\b/.exec(value)
  if (match) return `#${match[1]}`
  match = /^#([0-9a-f]{3})\b/.exec(value)
  if (match) return `#${match[1].split('').map(c => c + c).join('')}`
  match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/.exec(value)
  if (match) {
    if (match[4] !== undefined && Number(match[4]) < 0.5) return null
    return `#${[match[1], match[2], match[3]].map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('')}`
  }
  match = /^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*([\d.]+%?)\s*)?\)/.exec(value)
  if (match) return `#${[match[1], match[2], match[3]].map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('')}`
  return null
}

const hsl = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s, l }
}

const isNeutral = (hex: string) => {
  const { s, l } = hsl(hex)
  return s < 0.14 || l > 0.94 || l < 0.07
}

class Tally {
  private map = new Map<string, number>()
  add(hex: string | null, weight: number) {
    if (!hex || !Number.isFinite(weight) || weight <= 0) return
    this.map.set(hex, (this.map.get(hex) || 0) + weight)
  }
  top(limit: number) {
    return [...this.map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([hex, weight]) => ({ hex, weight: Math.round(weight) }))
  }
  get size() {
    return this.map.size
  }
}

const cssColours = (css: string, tally: Tally, weight = 1) => {
  const declarations = css.match(/(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi) || []
  declarations.forEach(raw => tally.add(hexOf(raw), weight))
  // custom properties that name the brand count more
  const named = css.match(/--[\w-]*(brand|primary|accent|theme|highlight)[\w-]*\s*:\s*([^;}]+)/gi) || []
  named.forEach(line => {
    const value = line.split(':').slice(1).join(':')
    tally.add(hexOf(value.trim()), weight * 40)
  })
}

// Font loaders hash family names ("Inter-1b28280e86394dd4", "… fallback: Arial"); keep the human name.
const cleanFontName = (raw: string) =>
  raw.replace(/["']/g, '').replace(/\s+fallback:.*$/i, '').replace(/[-_]?[0-9a-f]{10,}$/i, '').replace(/__[\w-]+$/, '').trim()

const cssFonts = (css: string, tally: Map<string, number>, weight = 1) => {
  const declarations = css.match(/font-family\s*:\s*([^;}]+)/gi) || []
  declarations.forEach(line => {
    const first = cleanFontName(line.split(':').slice(1).join(':').split(',')[0])
    if (!first) return
    const key = first.toLowerCase()
    if (GENERIC_FONTS.has(key) || /icon|awesome|glyph|symbol/i.test(key) || key.startsWith('var(')) return
    tally.set(first, (tally.get(first) || 0) + weight)
  })
}

// ——— the rendered read: what the page actually paints ———
// Computed styles weighted by area for grounds and by text length for ink,
// so CSS-in-JS and images-as-backgrounds do not hide the brand.

type Rendered = { backgrounds: Array<[string, number]>; inks: Array<[string, number]>; fonts: Array<[string, number]>; headingFont: string; bodyFont: string }

const renderedRead = async (url: string): Promise<Rendered | null> => {
  try {
    const { default: puppeteer } = await import('puppeteer')
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
    try {
      const page = await browser.newPage()
      await page.setUserAgent(UA)
      await page.setViewport({ width: 1280, height: 900 })
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20_000 }).catch(() => undefined)
      await new Promise(resolve => setTimeout(resolve, 800))
      return await page.evaluate(() => {
        const backgrounds = new Map<string, number>()
        const inks = new Map<string, number>()
        const fonts = new Map<string, number>()
        const bump = (map: Map<string, number>, key: string, weight: number) => map.set(key, (map.get(key) || 0) + weight)
        const elements = Array.from(document.querySelectorAll('body, body *')).slice(0, 5000)
        const limitY = window.innerHeight * 3
        elements.forEach(element => {
          const rect = element.getBoundingClientRect()
          if (rect.width < 2 || rect.height < 2 || rect.top > limitY || rect.bottom < 0) return
          const style = getComputedStyle(element)
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return
          const area = Math.min(rect.width, window.innerWidth) * Math.min(rect.height, limitY)
          const background = style.backgroundColor
          if (background && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)/.test(background) && background !== 'transparent') bump(backgrounds, background, area)
          const textLength = Array.from(element.childNodes).filter(node => node.nodeType === 3).reduce((sum, node) => sum + (node.textContent || '').trim().length, 0)
          if (textLength) {
            bump(inks, style.color, textLength * parseFloat(style.fontSize || '16'))
            const family = (style.fontFamily || '').split(',')[0].replace(/["']/g, '').trim()
            if (family) bump(fonts, family, textLength)
          }
          if (parseFloat(style.borderTopWidth || '0') > 0 && style.borderTopColor) bump(inks, style.borderTopColor, rect.width * 0.4)
        })
        const family = (selector: string) => {
          const element = document.querySelector(selector)
          return element ? (getComputedStyle(element).fontFamily || '').split(',')[0].replace(/["']/g, '').trim() : ''
        }
        const sorted = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
        return { backgrounds: sorted(backgrounds), inks: sorted(inks), fonts: sorted(fonts), headingFont: family('h1') || family('h2'), bodyFont: family('p') || family('body') }
      })
    } finally {
      await browser.close()
    }
  } catch {
    return null
  }
}

const absolute = (href: string | null | undefined, base: string) => {
  if (!href) return ''
  try {
    return new URL(href, base).toString()
  } catch {
    return ''
  }
}

export const readSourceUrl = async (raw: string, options: { projectId?: string } = {}): Promise<SourceRead> => {
  const target = assertPublicUrl(raw)
  const warnings: string[] = []
  const html = await fetchText(target.toString(), 3 * 1024 * 1024)
  if (!/html/i.test(html.contentType) && !/<html/i.test(html.text.slice(0, 2000))) throw new Error('That link is not a web page')
  const base = html.finalUrl
  const { document } = parseHTML(html.text)
  const meta = (name: string) =>
    document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || ''
  const title = (meta('og:title') || document.querySelector('title')?.textContent || document.querySelector('h1')?.textContent || '').trim().slice(0, 160)
  const description = (meta('og:description') || meta('description') || '').trim().slice(0, 400)
  const site = (meta('og:site_name') || target.hostname.replace(/^www\./, '')).trim().slice(0, 80)

  // the main text: the article if there is one, else main, else body
  const candidates = [...Array.from(document.querySelectorAll('article')), ...Array.from(document.querySelectorAll('main')), document.body].filter(Boolean)
  const container = candidates.map(node => ({ node, length: (node.textContent || '').trim().length })).sort((a, b) => b.length - a.length)[0]?.node || document.body
  const clone = container.cloneNode(true) as Element
  clone.querySelectorAll('nav, header, footer, aside, script, style, noscript, form, iframe, svg, button, [role="navigation"], [aria-hidden="true"], .share, .comments, .newsletter, .sidebar').forEach(node => node.remove())
  const headings: SourceRead['headings'] = []
  const lines: string[] = []
  const walk = (node: Element) => {
    Array.from(node.children).forEach(child => {
      const tag = child.tagName.toLowerCase()
      const text = (child.textContent || '').replace(/\s+/g, ' ').trim()
      if (!text) return
      if (/^h[1-4]$/.test(tag)) {
        const level = Number(tag[1])
        headings.push({ level, text: text.slice(0, 140) })
        lines.push(`${'#'.repeat(level)} ${text.slice(0, 140)}`)
      } else if (tag === 'p' || tag === 'blockquote') lines.push(text.slice(0, 1_200))
      else if (tag === 'li') lines.push(`- ${text.slice(0, 400)}`)
      else if (tag === 'pre' || tag === 'code') lines.push('```\n' + (child.textContent || '').trim().slice(0, 600) + '\n```')
      else if (tag === 'figcaption') lines.push(`(figure: ${text.slice(0, 200)})`)
      else if (['div', 'section', 'main', 'article', 'ul', 'ol', 'table', 'tbody', 'tr', 'td', 'span', 'figure', 'details'].includes(tag)) walk(child)
    })
  }
  walk(clone)
  let text = lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length > 24_000) {
    text = text.slice(0, 24_000)
    warnings.push('The article was long; the first 24,000 characters were read')
  }
  if (text.length < 400) warnings.push('Little readable text was found on the page; the outline may be thin')

  // images and logo candidates
  const images: SourceRead['images'] = []
  const pushImage = (url: string, alt: string) => {
    if (!url || images.some(image => image.url === url) || /\.svg(\?|$)/i.test(url) === false && /data:/.test(url)) return
    images.push({ url, alt: alt.slice(0, 120) })
  }
  ;[meta('og:image'), meta('twitter:image')].forEach(url => pushImage(absolute(url, base), 'cover'))
  Array.from(container.querySelectorAll('img')).slice(0, 40).forEach(img => {
    const src = absolute(img.getAttribute('src') || img.getAttribute('data-src'), base)
    if (src && !/data:/.test(src)) pushImage(src, img.getAttribute('alt') || '')
  })
  const logos: SourceRead['logos'] = []
  const pushLogo = (url: string, source: string) => {
    if (url && !logos.some(logo => logo.url === url)) logos.push({ url, source })
  }
  const iconLinks = Array.from(document.querySelectorAll('link[rel]')).filter(link => /icon/i.test(link.getAttribute('rel') || ''))
  iconLinks
    .map(link => ({ href: absolute(link.getAttribute('href'), base), size: Number((link.getAttribute('sizes') || '0x0').split('x')[0]) || (/apple-touch/i.test(link.getAttribute('rel') || '') ? 180 : 32), rel: link.getAttribute('rel') || '' }))
    .sort((a, b) => b.size - a.size)
    .forEach(link => pushLogo(link.href, link.rel))
  Array.from(document.querySelectorAll('header img, nav img, a[href="/"] img, [class*="logo" i] img, img[class*="logo" i], img[alt*="logo" i]')).slice(0, 6).forEach(img => {
    pushLogo(absolute(img.getAttribute('src') || img.getAttribute('data-src'), base), 'header')
  })
  pushLogo(absolute('/favicon.ico', base), 'favicon')

  // colours and fonts, from the stylesheets and from the rendered page
  const colours = new Tally()
  const fontTally = new Map<string, number>()
  const themeColor = hexOf(meta('theme-color')) || ''
  if (themeColor) colours.add(themeColor, 60)
  Array.from(document.querySelectorAll('style')).forEach(style => {
    cssColours(style.textContent || '', colours, 1)
    cssFonts(style.textContent || '', fontTally, 1)
  })
  Array.from(document.querySelectorAll('[style]')).slice(0, 400).forEach(element => cssColours(element.getAttribute('style') || '', colours, 0.5))
  const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(link => absolute(link.getAttribute('href'), base))
    .filter(href => href && new URL(href).hostname === target.hostname)
    .slice(0, 3)
  for (const href of sheets) {
    try {
      const css = await fetchText(href, 400 * 1024, 8_000)
      cssColours(css.text, colours, 1)
      cssFonts(css.text, fontTally, 1)
    } catch {
      warnings.push(`A stylesheet could not be read: ${new URL(href).pathname}`)
    }
  }
  const rendered = await renderedRead(target.toString())
  const grounds = new Tally()
  const inks = new Tally()
  if (rendered) {
    rendered.backgrounds.forEach(([colour, weight]) => grounds.add(hexOf(colour), weight))
    rendered.inks.forEach(([colour, weight]) => inks.add(hexOf(colour), weight))
    rendered.fonts.forEach(([rawFamily, weight]) => {
      const family = cleanFontName(rawFamily)
      const key = family.toLowerCase()
      if (family && !GENERIC_FONTS.has(key) && !/icon|awesome/i.test(key)) fontTally.set(family, (fontTally.get(family) || 0) + weight * 4)
    })
    // rendered colours join the candidate tally with their real prominence
    rendered.backgrounds.slice(0, 12).forEach(([colour, weight]) => colours.add(hexOf(colour), Math.sqrt(weight)))
    rendered.inks.slice(0, 12).forEach(([colour, weight]) => colours.add(hexOf(colour), Math.sqrt(weight)))
  } else warnings.push('The page could not be rendered for its painted colours; stylesheet colours were used')

  const ground = grounds.top(1)[0]?.hex || (colours.top(40).find(c => hsl(c.hex).l > 0.9)?.hex ?? '#ffffff')
  const inkCandidates = inks.top(6).map(c => c.hex)
  const textColour = inkCandidates.find(hex => Math.abs(hsl(hex).l - hsl(ground).l) > 0.4) || (hsl(ground).l > 0.5 ? '#1a1a1a' : '#f2f2f2')
  const saturated = colours.top(60).filter(c => !isNeutral(c.hex) && c.hex !== ground && c.hex !== textColour)
  // an accent has to carry on a dark video ground: prefer saturated colours of middling lightness over a brand's near-black navy
  const carries = (hex: string) => {
    const { s, l } = hsl(hex)
    return s >= 0.35 && l >= 0.28 && l <= 0.78
  }
  const accent = themeColor && !isNeutral(themeColor) && carries(themeColor) ? themeColor : saturated.find(c => carries(c.hex))?.hex || saturated[0]?.hex || '#f5a623'
  const secondary = saturated.find(c => c.hex !== accent && Math.abs(hsl(c.hex).h - hsl(accent).h) > 25)?.hex || saturated.find(c => c.hex !== accent)?.hex || accent
  const candidatesOut = [
    { hex: ground, weight: 0, role: 'ground' as const },
    { hex: textColour, weight: 0, role: 'text' as const },
    { hex: accent, weight: 0, role: 'accent' as const },
    { hex: secondary, weight: 0, role: 'secondary' as const },
    ...saturated.slice(0, 10).filter(c => ![ground, textColour, accent, secondary].includes(c.hex)),
  ]

  const fontsSeen = [...fontTally.entries()].sort((a, b) => b[1] - a[1]).map(([family]) => family).slice(0, 6)
  const headingFont = cleanFontName(rendered?.headingFont || '')
  const bodyFont = cleanFontName(rendered?.bodyFont || '')
  const display = headingFont && !GENERIC_FONTS.has(headingFont.toLowerCase()) ? headingFont : fontsSeen[0] || 'Segoe UI'
  const body = bodyFont && !GENERIC_FONTS.has(bodyFont.toLowerCase()) ? bodyFont : fontsSeen[1] || fontsSeen[0] || 'Segoe UI'
  const mono = fontsSeen.find(f => /mono|code|courier|menlo|consolas|jetbrains|fira/i.test(f)) || 'Consolas'

  // keep the best two logo candidates locally so the render can stage them
  for (const logo of logos.slice(0, 2)) {
    const file = await fetchBinary(logo.url, 1024 * 1024)
    if (!file) continue
    const extension = /svg/.test(file.contentType) ? '.svg' : /png/.test(file.contentType) ? '.png' : /jpe?g/.test(file.contentType) ? '.jpg' : /webp/.test(file.contentType) ? '.webp' : /x-icon|vnd\.microsoft\.icon/.test(file.contentType) ? '.ico' : ''
    if (!extension || extension === '.ico') continue
    try {
      const stored = await storeAsset({ body: file.buffer, contentType: file.contentType, projectId: options.projectId, kind: 'brand-logo', extension })
      logo.localUrl = `/objects/${stored.objectKey}`
    } catch {
      /* the original url still works for preview */
    }
  }

  return {
    kind: 'url',
    url: base,
    site,
    title,
    description,
    text,
    words: text.split(/\s+/).filter(Boolean).length,
    headings: headings.slice(0, 60),
    images: images.slice(0, 12),
    logos: logos.slice(0, 6),
    palette: { candidates: candidatesOut, ground, text: textColour, accent, secondary, themeColor },
    fonts: { display, body, mono, seen: fontsSeen },
    warnings,
  }
}

export const readSourceNarrative = (narrative: string, title = ''): SourceRead => {
  const text = String(narrative || '').replace(/\r\n?/g, '\n').trim().slice(0, 24_000)
  const headings = (text.match(/^#{1,4}\s+.+$/gm) || []).map(line => ({ level: (line.match(/^#+/) || ['#'])[0].length, text: line.replace(/^#+\s+/, '').slice(0, 140) }))
  const firstLine = text.split('\n').find(line => line.trim())?.replace(/^#+\s+/, '').trim() || 'Untitled'
  return {
    kind: 'narrative',
    url: '',
    site: '',
    title: (title || firstLine).slice(0, 160),
    description: '',
    text,
    words: text.split(/\s+/).filter(Boolean).length,
    headings,
    images: [],
    logos: [],
    palette: { candidates: [], ground: '#0b1f3a', text: '#e8f1fa', accent: '#f5a623', secondary: '#9cc3e6', themeColor: '' },
    fonts: { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas', seen: [] },
    warnings: [],
  }
}

// ——— the outline ———

export const SCENE_KINDS = ['title', 'list', 'diagram', 'numbers', 'quote', 'close'] as const
export type SceneKind = (typeof SCENE_KINDS)[number]
export const PART_KINDS = ['box', 'step', 'note', 'number'] as const
export const VERBS = ['sends to', 'waits for', 'calls', 'reads', 'writes', 'returns', 'splits into', 'merges into', 'depends on', 'becomes', 'contains', 'compares with', 'feeds', 'triggers'] as const

export type OutlinePart = { label: string; kind: (typeof PART_KINDS)[number]; detail: string }
export type OutlineScene = {
  title: string
  idea: string
  kind: SceneKind
  seconds: number
  parts: OutlinePart[]
  relations: Array<{ from: string; to: string; verb: string }>
  narration: string
  // The article's own sentences this scene rests on, verbatim. The outline
  // is a summary and loses the motivating example, the number and the
  // because; these carry them to the writer, which never sees the source.
  source: string[]
}
export type Outline = {
  title: string
  targetSeconds: number
  scenes: OutlineScene[]
  glossary: Array<{ term: string; meaning: string }>
}

export const outlineSchema = () => ({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'targetSeconds', 'scenes', 'glossary'],
  properties: {
    title: { type: 'string' },
    targetSeconds: { type: 'integer' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'idea', 'kind', 'seconds', 'parts', 'relations', 'narration', 'source'],
        properties: {
          title: { type: 'string' },
          idea: { type: 'string' },
          kind: { type: 'string', enum: [...SCENE_KINDS] },
          seconds: { type: 'integer' },
          parts: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['label', 'kind', 'detail'], properties: { label: { type: 'string' }, kind: { type: 'string', enum: [...PART_KINDS] }, detail: { type: 'string' } } },
          },
          relations: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['from', 'to', 'verb'], properties: { from: { type: 'string' }, to: { type: 'string' }, verb: { type: 'string', enum: [...VERBS] } } },
          },
          narration: { type: 'string' },
          source: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    glossary: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['term', 'meaning'], properties: { term: { type: 'string' }, meaning: { type: 'string' } } } },
  },
})

export const outlinePrompt = (source: Pick<SourceRead, 'title' | 'site' | 'text' | 'words'>, targetSeconds: number | null, wordingPolicy: 'preserve' | 'assist' | 'draft' = 'draft') => {
  const target = targetSeconds || Math.max(180, Math.min(540, Math.round((source.words / 2.4) * 0.45)))
  const wording = wordingPolicy === 'preserve'
    ? `WORDING POLICY — preserve: this text is the author's own narrative. The narration fields must reuse their sentences word for word wherever they carry the idea; your job is structure and order, not rewriting. Never replace a personal account with generic explanatory prose.`
    : wordingPolicy === 'assist'
      ? `WORDING POLICY — assist: this is the author's own narrative. Keep their voice, claims and examples; you may tighten sentences and propose clearer transitions, but every edit must stay recognisably theirs.`
      : `WORDING POLICY — draft: draft fresh narration from this material in a clear presenter voice.`
  return `You plan a narrated technical explainer video from a written source. A presenter speaks over pages; each page is a scene with one idea. Plan the outline, not the pages.

${wording}

SOURCE: "${source.title}"${source.site ? ` from ${source.site}` : ''} (${source.words} words)
---
${source.text.slice(0, 22_000)}
---

Return the video's title, a target runtime of about ${target} seconds, and 6 to 14 scenes in order. Each scene:
- one idea, stated in a sentence ("idea");
- a kind: "title" for the opening card (first scene only), "list" for a set of parallel points, "diagram" when the idea is a structure or a process with parts that relate to each other, "numbers" when figures carry the point, "quote" when one statement is the picture, "close" for the last scene only;
- seconds it deserves: the title 12 to 18, the close 8 to 14, others 20 to 70 in proportion to how much the viewer must take in; the sum should land near the target;
- parts: the things the page must show, at most 8, each with a short label (2 to 4 words, as it would be drawn), a kind ("box" for a component or actor, "step" for an ordered stage, "number" for a figure with its unit, "note" for a short caption) and one line of detail; a "list" scene's parts are its points, a "numbers" scene's parts are its figures, a "title" and "close" scene have no parts;
- relations between parts for diagram scenes: from label, to label, and a verb from the allowed set that says what happens between them; use "waits for" for sequential dependency, "sends to" or "feeds" for flow, "splits into" and "merges into" for fan out and fan in, "compares with" for contrast;
- source: two to four FULL SENTENCES copied VERBATIM from the article that this scene rests on. A heading, a label or a fragment is not a passage: take whole sentences that carry what a drawing cannot — a number, a named example, a consequence, or a reason (the ones with "because", "so that", "when", "if", or a figure). Copy them exactly, do not paraphrase, do not stitch fragments together. They are the writer's only access to the article, so choose what the summary would lose. A title or close scene may have none;
- narration: a first draft of what the presenter says on this scene, two to four plain sentences in the second person plural or first person plural, grounded in the source and naming the parts by their labels; the close hands over or lands the point.
Also return a glossary of up to 12 terms the video introduces, each with a one-line meaning in the video's own words. Keep every label unique within a scene.`
}

// Loose comparison for "is this really in the article": whitespace, quotes
// and case differ between what a model copies and what the page rendered.
const flatten = (text: string) => text.toLowerCase().replace(/[\u2018\u2019\u201c\u201d"']/g, '').replace(/\s+/g, ' ').trim()

export const sanitizeOutline = (raw: unknown, fallbackTitle: string, sourceText = ''): Outline => {
  const haystack = flatten(sourceText)
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const scenes = (Array.isArray(o.scenes) ? o.scenes : [])
    .map((entry, index): OutlineScene | null => {
      const s = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const title = String(s.title || '').trim().slice(0, 80)
      if (!title) return null
      const kind = SCENE_KINDS.includes(s.kind as SceneKind) ? (s.kind as SceneKind) : index === 0 ? 'title' : 'diagram'
      const seen = new Set<string>()
      const parts = (Array.isArray(s.parts) ? s.parts : [])
        .map(part => {
          const p = (part && typeof part === 'object' ? part : {}) as Record<string, unknown>
          const label = String(p.label || '').trim().slice(0, 40)
          if (!label || seen.has(label.toLowerCase())) return null
          seen.add(label.toLowerCase())
          return { label, kind: PART_KINDS.includes(p.kind as OutlinePart['kind']) ? (p.kind as OutlinePart['kind']) : 'box', detail: String(p.detail || '').trim().slice(0, 160) }
        })
        .filter((part): part is OutlinePart => Boolean(part))
        .slice(0, 8)
      const labels = new Set(parts.map(part => part.label.toLowerCase()))
      const relations = (Array.isArray(s.relations) ? s.relations : [])
        .map(relation => {
          const r = (relation && typeof relation === 'object' ? relation : {}) as Record<string, unknown>
          const from = String(r.from || '').trim()
          const to = String(r.to || '').trim()
          const verb = String(r.verb || '').trim()
          if (!labels.has(from.toLowerCase()) || !labels.has(to.toLowerCase()) || from.toLowerCase() === to.toLowerCase()) return null
          return { from, to, verb: (VERBS as readonly string[]).includes(verb) ? verb : 'sends to' }
        })
        .filter((relation): relation is { from: string; to: string; verb: string } => Boolean(relation))
        .slice(0, 16)
      return {
        title,
        idea: String(s.idea || '').trim().slice(0, 240),
        kind,
        seconds: Math.max(6, Math.min(120, Math.round(Number(s.seconds) || 30))),
        parts,
        relations,
        narration: String(s.narration || '').trim().slice(0, 900),
        // Verbatim or not at all: a passage the article does not contain is
        // an invention, and the writer would treat it as fact.
        // Verbatim, and a sentence rather than a heading: long enough to
        // say something, and reading like prose or carrying a figure.
        source: (Array.isArray(s.source) ? s.source : [])
          .map(line => String(line || '').trim().replace(/\s+/g, ' ').slice(0, 320))
          .filter(line => line.length >= 60 && line.split(' ').length >= 10 && (/[.!?]$/.test(line) || /\d/.test(line)))
          .filter(line => !haystack || haystack.includes(flatten(line)))
          .slice(0, 4),
      }
    })
    .filter((scene): scene is OutlineScene => Boolean(scene))
    .slice(0, 16)
  const glossary = (Array.isArray(o.glossary) ? o.glossary : [])
    .map(entry => {
      const g = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const term = String(g.term || '').trim().slice(0, 40)
      return term ? { term, meaning: String(g.meaning || '').trim().slice(0, 160) } : null
    })
    .filter((entry): entry is { term: string; meaning: string } => Boolean(entry))
    .slice(0, 12)
  const total = scenes.reduce((sum, scene) => sum + scene.seconds, 0)
  return {
    title: String(o.title || fallbackTitle || 'Untitled video').trim().slice(0, 120),
    targetSeconds: Math.max(60, Math.min(1_800, Math.round(Number(o.targetSeconds) || total || 240))),
    scenes,
    glossary,
  }
}

// ——— pages: rendered here, so every page carries the contract ———
//
// The contract: stable ids per structure, named groups with data-role,
// labels as their own <text>, directed connectors with an arrowhead and a
// data-verb, and chrome (background, decoration, header, footer) marked so
// the atomiser never mistakes it for a part.

export type PageBrand = {
  ground: string
  text: string
  muted: string
  line: string
  accent: string
  secondary: string
  panel: string
  display: string
  body: string
  mono: string
}

const escapeXml = (value: string) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'part'

const mix = (hex: string, towards: string, amount: number) => {
  const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const b = [1, 3, 5].map(i => parseInt(towards.slice(i, i + 2), 16))
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')}`
}

// A brand for pages: a dark ground reads better behind a presenter at
// 1080p, so a light website ground is deepened rather than copied.
export const pageBrandFrom = (palette: SourceRead['palette'], fonts: SourceRead['fonts'], mode: 'dark' | 'light' | 'auto' = 'auto'): PageBrand => {
  const groundIsLight = hsl(palette.ground).l > 0.5
  const wantDark = mode === 'dark' || (mode === 'auto' && (groundIsLight || true))
  const accent = palette.accent
  if (wantDark) {
    // a deep ground tinted towards the accent's hue
    const tint = mix('#0b1220', accent, 0.12)
    const ground = groundIsLight ? tint : palette.ground
    return {
      ground,
      text: '#eef3fa',
      muted: mix('#eef3fa', ground, 0.35),
      line: mix(accent, '#ffffff', 0.55),
      accent,
      secondary: palette.secondary,
      panel: mix(ground, '#ffffff', 0.06),
      display: fonts.display,
      body: fonts.body,
      mono: fonts.mono,
    }
  }
  return {
    ground: palette.ground,
    text: palette.text,
    muted: mix(palette.text, palette.ground, 0.4),
    line: mix(accent, palette.ground, 0.35),
    accent,
    secondary: palette.secondary,
    panel: mix(palette.ground, palette.text, 0.05),
    display: fonts.display,
    body: fonts.body,
    mono: fonts.mono,
  }
}

const W = 1280
const H = 720

// rough advance widths so lines wrap before they leave the page
const textWidth = (text: string, size: number, mono = false) => text.length * size * (mono ? 0.6 : 0.52)
const wrap = (text: string, size: number, maxWidth: number, maxLines: number, mono = false) => {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(candidate, size, mono) <= maxWidth || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '…'
  return lines
}
const textLines = (lines: string[], x: number, y: number, size: number, attrs: string, lineHeight = 1.3) =>
  lines.map((line, index) => `<text x="${x}" y="${(y + index * size * lineHeight).toFixed(1)}" font-size="${size}" ${attrs}>${escapeXml(line)}</text>`).join('\n')

const fontAttr = (family: string, fallback: string) => `font-family="${escapeXml(family)}, ${fallback}"`

export const renderPage = (scene: OutlineScene, index: number, total: number, brand: PageBrand, video: { title: string; site: string }): string => {
  const n = index + 1
  const id = (name: string) => `s${n}-${name}`
  const display = fontAttr(brand.display, 'Segoe UI, sans-serif')
  const body = fontAttr(brand.body, 'Segoe UI, sans-serif')
  const mono = fontAttr(brand.mono, 'Consolas, monospace')
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${body} font-size="22" data-page-role="${scene.kind}" data-page-index="${n}">`)
  parts.push(`<defs><marker id="${id('arrow')}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto"><polygon points="0,0 10,5 0,10" fill="${brand.line}"/></marker></defs>`)
  parts.push(`<rect id="bg" data-role="background" x="0" y="0" width="${W}" height="${H}" fill="${brand.ground}"/>`)
  const grid: string[] = []
  for (let x = 40; x < W; x += 40) grid.push(`M${x} 0V${H}`)
  for (let y = 40; y < H; y += 40) grid.push(`M0 ${y}H${W}`)
  parts.push(`<path id="grid" data-role="decoration" fill="none" stroke="${brand.line}" stroke-opacity="0.06" stroke-width="1" d="${grid.join(' ')}"/>`)

  // header: kicker and title, chrome for every kind but the title card
  const kicker = `§ ${String(n).padStart(2, '0')} · ${video.title}`.toUpperCase().slice(0, 70)
  if (scene.kind !== 'title' && scene.kind !== 'close') {
    parts.push(`<g id="header" data-role="header">`)
    parts.push(`<text x="82" y="58" font-size="14" fill="${brand.accent}" letter-spacing="2" ${mono}>${escapeXml(kicker)}</text>`)
    parts.push(textLines(wrap(scene.title, 38, 1120, 1), 80, 104, 38, `font-weight="bold" fill="${brand.text}" ${display}`))
    parts.push(`</g>`)
  }

  if (scene.kind === 'title') {
    parts.push(`<g id="${id('title-stack')}" data-role="title">`)
    parts.push(`<text id="${id('kicker')}" x="82" y="212" font-size="15" fill="${brand.accent}" letter-spacing="2" ${mono}>${escapeXml((video.site || 'explainer').toUpperCase())}</text>`)
    const titleLines = wrap(scene.title, 66, 1000, 2)
    parts.push(textLines(titleLines, 80, 292, 66, `id="${id('title')}" font-weight="bold" fill="${brand.text}" ${display}`, 1.1))
    const ruleY = 292 + (titleLines.length - 1) * 72 + 30
    parts.push(`<line id="${id('rule')}" x1="82" y1="${ruleY}" x2="262" y2="${ruleY}" stroke="${brand.accent}" stroke-width="3"/>`)
    parts.push(textLines(wrap(scene.idea || video.title, 24, 760, 3), 82, ruleY + 44, 24, `id="${id('subtitle')}" fill="${brand.muted}" ${body}`, 1.4))
    parts.push(`</g>`)
  } else if (scene.kind === 'close') {
    parts.push(`<g id="${id('close-stack')}" data-role="title">`)
    parts.push(textLines(wrap(scene.idea || scene.title, 46, 1040, 3), 80, 300, 46, `id="${id('statement')}" font-weight="bold" fill="${brand.text}" ${display}`, 1.2))
    parts.push(`<line id="${id('rule')}" x1="82" y1="${300 + 46 * 1.2 * 3 + 6}" x2="262" y2="${300 + 46 * 1.2 * 3 + 6}" stroke="${brand.accent}" stroke-width="3"/>`)
    parts.push(`<text id="${id('site')}" x="82" y="${300 + 46 * 1.2 * 3 + 50}" font-size="16" fill="${brand.muted}" letter-spacing="1" ${mono}>${escapeXml((video.site || video.title).toUpperCase())}</text>`)
    parts.push(`</g>`)
  } else if (scene.kind === 'list') {
    const items = scene.parts.slice(0, 6)
    const top = 170
    const rowHeight = Math.min(84, (560 - 40) / Math.max(1, items.length))
    parts.push(`<g id="${id('list')}" data-role="list">`)
    items.forEach((item, i) => {
      const y = top + i * rowHeight
      parts.push(`<g id="${id(`item-${slug(item.label)}`)}" data-role="item">`)
      parts.push(`<rect x="82" y="${y}" width="34" height="34" rx="6" fill="${brand.panel}" stroke="${brand.line}" stroke-width="1.5"/>`)
      parts.push(`<text x="99" y="${y + 23}" font-size="16" text-anchor="middle" fill="${brand.accent}" ${mono}>${i + 1}</text>`)
      parts.push(`<text x="140" y="${y + 24}" font-size="26" fill="${brand.text}" ${body}>${escapeXml(item.label)}</text>`)
      if (item.detail) parts.push(`<text x="140" y="${y + 50}" font-size="16" fill="${brand.muted}" ${body}>${escapeXml(wrap(item.detail, 16, 1000, 1)[0] || '')}</text>`)
      parts.push(`</g>`)
    })
    parts.push(`</g>`)
  } else if (scene.kind === 'numbers') {
    const stats = scene.parts.filter(part => part.kind === 'number').concat(scene.parts.filter(part => part.kind !== 'number')).slice(0, 4)
    const columnWidth = (W - 160) / Math.max(1, stats.length)
    parts.push(`<g id="${id('stats')}" data-role="stats">`)
    stats.forEach((stat, i) => {
      const x = 80 + i * columnWidth
      const room = columnWidth - 40
      // a figure is the number in the label; a label without one is a fact, set smaller
      const match = stat.label.match(/[-+~≈<>]?\d[\d.,]*\s*(?:%|×|x|ms|s|k|K|M|B|GB|MB|TB|fps|ns|µs|us)?\b/)
      parts.push(`<g id="${id(`stat-${slug(stat.label)}`)}" data-role="stat">`)
      if (match) {
        const figure = match[0].trim().slice(0, 12)
        const caption = stat.label.replace(match[0], '').replace(/^[\s:·—-]+|[\s:·—-]+$/g, '').trim() || stat.detail
        const size = Math.max(34, Math.min(stats.length > 3 ? 56 : 72, Math.floor(room / (figure.length * 0.58))))
        parts.push(`<text x="${x}" y="340" font-size="${size}" font-weight="bold" fill="${brand.text}" ${display}>${escapeXml(figure)}</text>`)
        parts.push(textLines(wrap(caption, 18, room, 2), x + 2, 378, 18, `fill="${brand.muted}" ${body}`))
      } else {
        const lines = wrap(stat.label, 28, room, 2)
        parts.push(textLines(lines, x, 316, 28, `font-weight="bold" fill="${brand.text}" ${display}`, 1.15))
        parts.push(textLines(wrap(stat.detail, 17, room, 3), x + 1, 316 + lines.length * 32 + 12, 17, `fill="${brand.muted}" ${body}`))
      }
      parts.push(`</g>`)
    })
    parts.push(`</g>`)
  } else if (scene.kind === 'quote') {
    parts.push(`<g id="${id('quote')}" data-role="quote">`)
    parts.push(`<rect id="${id('bar')}" x="80" y="200" width="6" height="${Math.min(4, wrap(scene.idea, 34, 1000, 4).length) * 46}" fill="${brand.accent}"/>`)
    parts.push(textLines(wrap(scene.idea || scene.title, 34, 1000, 4), 112, 232, 34, `id="${id('statement')}" fill="${brand.text}" ${display}`, 1.35))
    const source = scene.parts[0]?.label || video.site
    if (source) parts.push(`<text id="${id('attribution')}" x="112" y="${232 + 4 * 46 + 30}" font-size="16" fill="${brand.muted}" letter-spacing="1" ${mono}>— ${escapeXml(source.toUpperCase())}</text>`)
    parts.push(`</g>`)
  } else {
    // diagram: nodes by level from the relations, left to right
    const nodes = scene.parts.filter(part => part.kind === 'box' || part.kind === 'step')
    const notes = scene.parts.filter(part => part.kind === 'note' || part.kind === 'number')
    const byLabel = new Map(nodes.map(node => [node.label.toLowerCase(), node]))
    const level = new Map<string, number>()
    nodes.forEach(node => level.set(node.label.toLowerCase(), 0))
    for (let round = 0; round < nodes.length; round += 1) {
      let changed = false
      scene.relations.forEach(relation => {
        const from = relation.from.toLowerCase()
        const to = relation.to.toLowerCase()
        if (!byLabel.has(from) || !byLabel.has(to)) return
        const next = (level.get(from) || 0) + 1
        if (next > (level.get(to) || 0) && next < nodes.length) {
          level.set(to, next)
          changed = true
        }
      })
      if (!changed) break
    }
    const levels = new Map<number, OutlinePart[]>()
    nodes.forEach(node => {
      const l = level.get(node.label.toLowerCase()) || 0
      levels.set(l, [...(levels.get(l) || []), node])
    })
    const columns = [...levels.keys()].sort((a, b) => a - b)
    const areaTop = 160
    const areaHeight = notes.length ? 400 : 470
    const areaLeft = 80
    const areaWidth = W - 160
    const columnWidth = areaWidth / Math.max(1, columns.length)
    const boxWidth = Math.min(240, columnWidth - 60)
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>()
    parts.push(`<g id="${id('diagram')}" data-role="diagram">`)
    columns.forEach((l, ci) => {
      const column = levels.get(l) || []
      const boxHeight = Math.min(88, (areaHeight - 20) / Math.max(1, column.length) - 16)
      const gap = (areaHeight - column.length * boxHeight) / (column.length + 1)
      column.forEach((node, ri) => {
        const x = areaLeft + ci * columnWidth + (columnWidth - boxWidth) / 2
        const y = areaTop + gap + ri * (boxHeight + gap)
        positions.set(node.label.toLowerCase(), { x, y, w: boxWidth, h: boxHeight })
        const labelLines = wrap(node.label, 20, boxWidth - 24, 2)
        const rx = node.kind === 'step' ? boxHeight / 2 : 10
        parts.push(`<g id="${id(`node-${slug(node.label)}`)}" data-role="node" data-kind="${node.kind}">`)
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxWidth}" height="${boxHeight.toFixed(1)}" rx="${rx}" fill="${brand.panel}" stroke="${brand.line}" stroke-width="1.5"/>`)
        const firstY = y + boxHeight / 2 + 7 - ((labelLines.length - 1) * 12)
        parts.push(labelLines.map((line, li) => `<text x="${(x + boxWidth / 2).toFixed(1)}" y="${(firstY + li * 24).toFixed(1)}" font-size="20" text-anchor="middle" fill="${brand.text}" ${body}>${escapeXml(line)}</text>`).join('\n'))
        parts.push(`</g>`)
      })
    })
    scene.relations.forEach((relation, ri) => {
      const from = positions.get(relation.from.toLowerCase())
      const to = positions.get(relation.to.toLowerCase())
      if (!from || !to) return
      const sameColumn = Math.abs(from.x - to.x) < 1
      let x1: number, y1: number, x2: number, y2: number
      if (sameColumn) {
        x1 = from.x + from.w / 2
        y1 = from.y < to.y ? from.y + from.h : from.y
        x2 = x1
        y2 = from.y < to.y ? to.y : to.y + to.h
      } else if (from.x < to.x) {
        x1 = from.x + from.w
        y1 = from.y + from.h / 2
        x2 = to.x
        y2 = to.y + to.h / 2
      } else {
        x1 = from.x
        y1 = from.y + from.h / 2
        x2 = to.x + to.w
        y2 = to.y + to.h / 2
      }
      const fromId = id(`node-${slug(relation.from)}`)
      const toId = id(`node-${slug(relation.to)}`)
      parts.push(`<line id="${id(`edge-${ri + 1}`)}" data-role="connector" data-verb="${escapeXml(relation.verb)}" data-from="${fromId}" data-to="${toId}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${brand.line}" stroke-width="1.5" marker-end="url(#${id('arrow')})"/>`)
    })
    parts.push(`</g>`)
    if (notes.length) {
      parts.push(`<g id="${id('notes')}" data-role="notes">`)
      notes.slice(0, 3).forEach((note, ni) => {
        const y = 600 + ni * 30
        parts.push(`<text id="${id(`note-${slug(note.label)}`)}" x="82" y="${y}" font-size="18" fill="${brand.muted}" ${body}>${escapeXml(wrap(`${note.label}${note.detail ? ` — ${note.detail}` : ''}`, 18, 1100, 1)[0] || '')}</text>`)
      })
      parts.push(`</g>`)
    }
  }

  // footer chrome
  parts.push(`<g id="footer" data-role="footer" ${mono} font-size="12" fill="${brand.muted}">`)
  parts.push(`<rect x="1000" y="668" width="220" height="32" fill="none" stroke="${mix(brand.line, brand.ground, 0.5)}" stroke-width="1"/>`)
  parts.push(`<line x1="1110" y1="668" x2="1110" y2="700" stroke="${mix(brand.line, brand.ground, 0.5)}" stroke-width="1"/>`)
  parts.push(`<text x="1012" y="688">${escapeXml((video.site || 'video').slice(0, 14).toUpperCase())}</text>`)
  parts.push(`<text x="1122" y="688">SHEET ${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}</text>`)
  parts.push(`</g>`)
  parts.push(`</svg>`)
  return parts.join('\n')
}

// The checker the plan asks for at the import door, run on what we emit.
export const checkPageContract = (svg: string) => {
  const groups = (svg.match(/<g [^>]*id="/g) || []).length
  const roles = (svg.match(/data-role="/g) || []).length
  const connectors = (svg.match(/data-role="connector"/g) || []).length
  const verbs = (svg.match(/data-verb="/g) || []).length
  const labels = (svg.match(/<text /g) || []).length
  return { groups, roles, connectors, verbs, labels, declared: connectors === verbs && groups > 0 }
}
