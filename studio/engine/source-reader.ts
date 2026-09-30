// Reads retained prose and observed website branding.
import { parseHTML } from 'linkedom'
import { storeAsset } from './persistence'
import {hsl} from './source-colours'

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
    // Where the colours came from (F5 of the Perplexity review): read off a
    // website, a default because none could be read, or chosen by hand.
    provenance: 'extracted' | 'fallback' | 'manual'
    // The website they were read from, or why they are a default.
    from: string
  }
  fonts: { display: string; body: string; mono: string; seen: string[] }
  warnings: string[]
  // How much was read, and how likely it is the article (F3): a thin read
  // may be a page's navigation, and is not planned from unless the creator
  // says so. The excerpt and the headings let them see what was read.
  extraction: { confidence: 'good' | 'thin'; words: number; headings: number; excerpt: string; reason: string; tables?: number; codeBlocks?: number; notes?: string[] }
  // A document read from its host rather than its page (F3): where, and at
  // exactly which revision.
  origin?: { host: 'github'; owner: string; repo: string; ref: string; commit: string | null; path: string; url: string }
}

// The colours a browser paints links with when a page sets none.
const BROWSER_COLOURS = new Set(['#0000ee', '#551a8b', '#ee0000', '#ff0000'])
// Colours for a source whose brand could not be read: said to be defaults.
const FALLBACK_PALETTE = { candidates: [], ground: '#0b1f3a', text: '#e8f1fa', accent: '#f5a623', secondary: '#9cc3e6', themeColor: '' }

// An article's own text, block by block, as the outline reads it (B02 of
// the BoltDB review): headings, prose, lists, tables as tables — every cell
// — and code and diagrams whole. A table used to keep only the labels it
// set in code, without what they meant, and every code block was cut at 600
// characters without a word: a diagram lost its end. A block too long to
// keep whole is cut where it is said to be, in the text and in a warning.
const PROSE_LIMIT = 4_000
const ITEM_LIMIT = 1_500
const CODE_LIMIT = 8_000
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'br'])
const SKIPPED = new Set(['hr', 'img', 'picture', 'video', 'audio', 'canvas', 'input', 'select', 'textarea', 'template'])
export const articleText = (container: Element) => {
  const headings: SourceRead['headings'] = []
  const blocks: string[] = []
  const notes: string[] = []
  let tables = 0
  let codeBlocks = 0
  let near = ''
  const clip = (text: string, limit: number, what: string) => {
    if (text.length <= limit) return text
    notes.push(`${what}${near ? ` in “${near}”` : ''} was ${text.length.toLocaleString('en')} characters; its first ${limit.toLocaleString('en')} were read`)
    return `${text.slice(0, limit)} … [cut: ${(text.length - limit).toLocaleString('en')} more characters]`
  }
  const flat = (node: Element) => (node.textContent || '').replace(/\s+/g, ' ').trim()
  const code = (node: Element) => {
    const raw = (node.textContent || '').replace(/^\n+/, '').replace(/\s+$/, '')
    if (!raw.trim()) return
    codeBlocks += 1
    blocks.push('```\n' + clip(raw, CODE_LIMIT, 'A code block') + '\n```')
  }
  const table = (node: Element) => {
    const rows = Array.from(node.querySelectorAll('tr')).filter(row => row.closest('table') === node)
    const cells = rows
      .map(row => Array.from(row.children).filter(cell => /^(td|th)$/i.test(cell.tagName)).map(cell => flat(cell).replace(/\|/g, '\\|')))
      .filter(row => row.some(Boolean))
    if (!cells.length) return
    tables += 1
    const width = Math.max(...cells.map(row => row.length))
    const line = (row: string[]) => `| ${Array.from({ length: width }, (_, index) => row[index] || '').join(' | ')} |`
    const caption = node.querySelector('caption')
    blocks.push([...(caption && flat(caption) ? [`(table: ${flat(caption)})`] : []), line(cells[0]), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...cells.slice(1).map(line)].join('\n'))
  }
  const block = (node: Element, tag: string) => {
    const text = flat(node)
    if (/^h[1-6]$/.test(tag)) {
      if (!text) return
      const level = Math.min(4, Number(tag[1]))
      headings.push({ level, text: text.slice(0, 140) })
      blocks.push(`${'#'.repeat(level)} ${text.slice(0, 140)}`)
      near = text.slice(0, 80)
    } else if (tag === 'p' || tag === 'blockquote') {
      if (text) blocks.push(clip(text, PROSE_LIMIT, 'A paragraph'))
    } else if (tag === 'li') {
      if (text) blocks.push(`- ${clip(text, ITEM_LIMIT, 'A list item')}`)
    } else if (tag === 'pre' || (tag === 'code' && (node.textContent || '').includes('\n'))) code(node)
    else if (tag === 'table') table(node)
    else if (tag === 'dt') {
      if (text) blocks.push(`- ${text}`)
    } else if (tag === 'dd') {
      if (text) blocks.push(`  ${clip(text, ITEM_LIMIT, 'A definition')}`)
    } else if (tag === 'figcaption') {
      if (text) blocks.push(`(figure: ${text.slice(0, 200)})`)
    } else if (!SKIPPED.has(tag)) walk(node)
  }
  // Text set loose in a container, beside or between its blocks, is a
  // paragraph of its own.
  const walk = (node: Element) => {
    let run = ''
    const flush = () => {
      const text = run.replace(/\s+/g, ' ').trim()
      run = ''
      if (text) blocks.push(clip(text, PROSE_LIMIT, 'A paragraph'))
    }
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === 3) {
        run += child.textContent || ''
        return
      }
      if (child.nodeType !== 1) return
      const element = child as Element
      const tag = element.tagName.toLowerCase()
      if (INLINE.has(tag) && !(tag === 'code' && (element.textContent || '').includes('\n')) && !element.querySelector('p, div, pre, table, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, figure')) {
        run += tag === 'br' ? ' ' : element.textContent || ''
        return
      }
      flush()
      block(element, tag)
    })
    flush()
  }
  walk(container)
  return { text: blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(), headings, tables, codeBlocks, notes }
}

// How much was read, and how sure the read is that it is the article.
export const extractionOf = (text: string, headings: number, where = ''): SourceRead['extraction'] => {
  const words = text.split(/\s+/).filter(Boolean).length
  const thin = words < 150
  return {
    confidence: thin ? 'thin' : 'good',
    words,
    headings,
    excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 600),
    reason: thin ? `Only ${words} word${words === 1 ? '' : 's'} ${words === 1 ? 'was' : 'were'} read${where ? ` from ${where}` : ''} — it may be the page's navigation, not the article.` : '',
  }
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

export class SourceReadError extends Error {
  constructor(readonly status:number,readonly hostname:string){
    super([401,403,429].includes(status)?'This site does not allow automatic reading. Paste the article text to continue.':`Could not read this article (${status}). Check the link or paste the article text.`)
    this.name='SourceReadError'
  }
}
const fetchText = async (url: string, maximumBytes: number, timeoutMs = 15_000, accept = 'text/html,text/css,*/*;q=0.8') => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: controller.signal })
    if (!response.ok) throw new SourceReadError(response.status,new URL(url).hostname)
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

// ——— a document its code host serves (F3 of the Perplexity review) ———
// A GitHub file page is the host's chrome around the document: its article
// extractor found 17 words of navigation. The document is read from the
// host's raw contents instead, at the commit its address names, and the
// host's own colours and logo are left out of the brand.
export const githubDocumentOf = (url: URL) => {
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null
  const parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part))
  if (parts.length === 2) return { owner: parts[0], repo: parts[1], ref: 'HEAD', path: 'README.md' }
  if (parts.length >= 5 && (parts[2] === 'blob' || parts[2] === 'raw') && /\.(md|markdown|mdx|txt|rst)$/i.test(parts[parts.length - 1])) {
    return { owner: parts[0], repo: parts[1], ref: parts[3], path: parts.slice(4).join('/') }
  }
  return null
}

// Markdown as the text the outline reads: headings (either style) marked
// the same way, figures named, link targets dropped; code and tables kept.
export const markdownDocument = (markdown: string) => {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const out: string[] = []
  const headings: SourceRead['headings'] = []
  let fenced = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      out.push(line)
      continue
    }
    if (fenced) {
      out.push(line)
      continue
    }
    const next = lines[i + 1] || ''
    if (line.trim() && /^\s*(=+|-{3,})\s*$/.test(next) && !/^\s*([-*+]\s|\|)/.test(line)) {
      const level = next.trim().startsWith('=') ? 1 : 2
      headings.push({ level, text: line.trim().slice(0, 140) })
      out.push(`${'#'.repeat(level)} ${line.trim()}`)
      i += 1
      continue
    }
    const atx = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (atx) {
      const level = Math.min(4, atx[1].length)
      headings.push({ level, text: atx[2].slice(0, 140) })
      out.push(`${'#'.repeat(level)} ${atx[2]}`)
      continue
    }
    out.push(line.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt: string) => (alt ? `(figure: ${alt})` : '')).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'))
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), headings }
}

const readGithubDocument = async (doc: NonNullable<ReturnType<typeof githubDocumentOf>>, given: string, options: { projectId?: string }): Promise<SourceRead | null> => {
  const path = doc.path.split('/').map(encodeURIComponent).join('/')
  let raw: string
  try {
    raw = (await fetchText(`https://raw.githubusercontent.com/${encodeURIComponent(doc.owner)}/${encodeURIComponent(doc.repo)}/${encodeURIComponent(doc.ref)}/${path}`, 2 * 1024 * 1024, 15_000, 'text/plain,*/*;q=0.5')).text
  } catch {
    // Not a public document: the page itself is read instead.
    return null
  }
  // The exact commit the ref names, when the host says; unauthenticated
  // reads are rate limited, and then the ref stands.
  let commit: string | null = null
  try {
    const answer = (await fetchText(`https://api.github.com/repos/${encodeURIComponent(doc.owner)}/${encodeURIComponent(doc.repo)}/commits/${encodeURIComponent(doc.ref)}`, 4096, 8_000, 'application/vnd.github.sha')).text.trim()
    if (/^[0-9a-f]{40}$/.test(answer)) commit = answer
  } catch {
    /* the ref stands */
  }
  const read = markdownDocument(raw)
  const warnings: string[] = []
  const cuts: string[] = []
  let text = read.text
  if (text.length > 24_000) {
    cuts.push(`The document was long; the first 24,000 characters were read, and ${(text.length - 24_000).toLocaleString('en')} more were left out`)
    text = text.slice(0, 24_000)
    warnings.push(...cuts)
  }
  const title = (read.headings.find(heading => heading.level === 1)?.text || doc.path.split('/').pop()!.replace(/\.[a-z]+$/i, '')).slice(0, 160)
  const description = (text.split('\n\n').find(paragraph => paragraph.trim() && !/^(#|\||[-*+]\s|```)/.test(paragraph.trim())) || '').replace(/\s+/g, ' ').trim().slice(0, 400)
  warnings.push(`Read ${doc.path} from ${doc.owner}/${doc.repo} at ${commit ? commit.slice(0, 7) : doc.ref}. GitHub's own page colours and logo are left out — choose the brand below.`)
  // The publisher's avatar is its mark on the host.
  const logos: SourceRead['logos'] = [{ url: `https://github.com/${encodeURIComponent(doc.owner)}.png?size=200`, source: `${doc.owner} on GitHub` }]
  const avatar = await fetchBinary(logos[0].url, 1024 * 1024)
  if (avatar && /png|jpe?g|webp/.test(avatar.contentType)) {
    try {
      const stored = await storeAsset({ body: avatar.buffer, contentType: avatar.contentType, projectId: options.projectId, kind: 'brand-logo', extension: /png/.test(avatar.contentType) ? '.png' : /webp/.test(avatar.contentType) ? '.webp' : '.jpg' })
      logos[0].localUrl = `/objects/${stored.objectKey}`
    } catch {
      /* the original url still works for preview */
    }
  }
  return {
    kind: 'url',
    url: given,
    site: `github.com/${doc.owner}`,
    title,
    description,
    text,
    words: text.split(/\s+/).filter(Boolean).length,
    headings: read.headings.slice(0, 60),
    images: [],
    logos,
    palette: { ...FALLBACK_PALETTE, provenance: 'fallback', from: `${doc.owner}'s colours are not on GitHub's page` },
    fonts: { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas', seen: [] },
    warnings,
    extraction: { ...extractionOf(text, read.headings.length, `${doc.owner}/${doc.repo}`), notes: cuts },
    origin: { host: 'github', owner: doc.owner, repo: doc.repo, ref: doc.ref, commit, path: doc.path, url: given },
  }
}

export const readSourceUrl = async (raw: string, options: { projectId?: string } = {}): Promise<SourceRead> => {
  const target = assertPublicUrl(raw)
  const hosted = githubDocumentOf(target)
  if (hosted) {
    const document = await readGithubDocument(hosted, target.toString(), options)
    if (document) return document
  }
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
  const article = articleText(clone)
  const headings = article.headings
  let text = article.text
  // What the read cut, said before anything is planned from it.
  const cuts = [...article.notes]
  if (text.length > 24_000) {
    // Where the read stops, and what it leaves out, said.
    const kept = text.slice(0, 24_000)
    const stopsIn = [...kept.matchAll(/^#{1,4} (.+)$/gm)].pop()?.[1] || ''
    const left = headings.length - [...kept.matchAll(/^#{1,4} /gm)].length
    text = `${kept} … [cut: the article goes on for ${(article.text.length - 24_000).toLocaleString('en')} more characters]`
    cuts.push(`The article was long; the first 24,000 characters were read${stopsIn ? ` — it stops in “${stopsIn}”` : ''}${left > 0 ? `, and ${left} later section${left === 1 ? ' was' : 's were'} left out` : ''}`)
  }
  warnings.push(...cuts)
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
  // A browser's own link colours are not a brand's (F5 of the Perplexity
  // review): a page that paints none of its own has no brand colours.
  const saturated = colours.top(60).filter(c => !isNeutral(c.hex) && c.hex !== ground && c.hex !== textColour && !BROWSER_COLOURS.has(c.hex))
  // an accent has to carry on a dark video ground: prefer saturated colours of middling lightness over a brand's near-black navy
  const carries = (hex: string) => {
    const { s, l } = hsl(hex)
    return s >= 0.35 && l >= 0.28 && l <= 0.78
  }
  const accentRead = Boolean((themeColor && !isNeutral(themeColor) && carries(themeColor)) || saturated.length)
  const accent = themeColor && !isNeutral(themeColor) && carries(themeColor) ? themeColor : saturated.find(c => carries(c.hex))?.hex || saturated[0]?.hex || FALLBACK_PALETTE.accent
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
    palette: { candidates: candidatesOut, ground, text: textColour, accent, secondary, themeColor, provenance: accentRead ? 'extracted' : 'fallback', from: accentRead ? target.hostname.replace(/^www\./, '') : `${target.hostname.replace(/^www\./, '')} showed no brand colours` },
    fonts: { display, body, mono, seen: fontsSeen },
    warnings,
    extraction: { ...extractionOf(text, headings.length, site), tables: article.tables, codeBlocks: article.codeBlocks, notes: cuts },
  }
}

export const readSourceNarrative = (narrative: string, title = ''): SourceRead => {
  const given = String(narrative || '').replace(/\r\n?/g, '\n').trim()
  const text = given.slice(0, 24_000)
  // A text too long to read whole says so (B02 of the BoltDB review).
  const cuts = given.length > text.length ? [`The text was long; its first 24,000 characters were read, and ${(given.length - text.length).toLocaleString('en')} more were left out`] : []
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
    palette: { ...FALLBACK_PALETTE, provenance: 'fallback', from: 'no brand website was given' },
    fonts: { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas', seen: [] },
    warnings: cuts,
    // The creator's own words are what they are: never thin by length.
    extraction: { ...extractionOf(text, headings.length), confidence: 'good', reason: '', notes: cuts },
  }
}
