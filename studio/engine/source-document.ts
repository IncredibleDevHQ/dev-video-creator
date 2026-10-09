// Retained prose, extraction quality and narrative sources.
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
  /** The author line a page sets as a captioned avatar, kept out of the text. */
  byline?: string
  logos: Array<{ url: string; source: string; localUrl?: string }>
  palette: {
    candidates: Array<{
      hex: string
      weight: number
      role?: 'ground' | 'text' | 'accent' | 'secondary'
    }>
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
  extraction: {
    confidence: 'good' | 'thin'
    words: number
    headings: number
    excerpt: string
    reason: string
    tables?: number
    codeBlocks?: number
    notes?: string[]
  }
  // A document read from its host rather than its page (F3): where, and at
  // exactly which revision.
  origin?: {
    host: 'github'
    owner: string
    repo: string
    ref: string
    commit: string | null
    path: string
    url: string
  }
}

export const FALLBACK_PALETTE = {
  candidates: [],
  ground: '#0b1f3a',
  text: '#e8f1fa',
  accent: '#f5a623',
  secondary: '#9cc3e6',
  themeColor: ''
}

// An article's own text, block by block, as the outline reads it (B02 of
// the BoltDB review): headings, prose, lists, tables as tables — every cell
// — and code and diagrams whole. A table used to keep only the labels it
// set in code, without what they meant, and every code block was cut at 600
// characters without a word: a diagram lost its end. A block too long to
// keep whole is cut where it is said to be, in the text and in a warning.
const PROSE_LIMIT = 4_000
const ITEM_LIMIT = 1_500
const CODE_LIMIT = 8_000
const INLINE = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'font',
  'i',
  'ins',
  'kbd',
  'label',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
  'br'
])
const SKIPPED = new Set([
  'hr',
  'video',
  'audio',
  'canvas',
  'input',
  'select',
  'textarea',
  'template'
])
// A picture the article shows, not its author's avatar or a site icon.
const SMALL = /(?:^|[?&])(?:w|width|h|height)=(\d{1,3})(?:&|$)/i
const pictureOf = (img: Element | null, base: string) => {
  if (!img) return null
  const raw =
    img.getAttribute('src') ||
    img.getAttribute('data-src') ||
    (img.getAttribute('srcset') || '').split(/[\s,]+/)[0] ||
    ''
  if (!raw || raw.startsWith('data:')) return null
  let url = raw
  try {
    url = base ? new URL(raw, base).toString() : raw
  } catch {
    return null
  }
  if (!/^https?:\/\//i.test(url)) return null
  const size = Math.min(
    Number(img.getAttribute('width')) || Infinity,
    Number(img.getAttribute('height')) || Infinity,
    ...[...url.matchAll(new RegExp(SMALL.source, 'gi'))].map((m) =>
      Number(m[1])
    )
  )
  const hint = `${img.getAttribute('class') || ''} ${url}`
  const small =
    size <= 128 || /avatar|author|profile|gravatar|icon|logo|spacer/i.test(hint)
  return { url, alt: (img.getAttribute('alt') || '').trim(), small }
}
const markdownAlt = (text: string) =>
  text
    .replace(/[[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)

export const articleText = (container: Element, base = '') => {
  const headings: SourceRead['headings'] = []
  // The author line a site sets as a captioned avatar (review 5: it became
  // "(figure: Paul Tarjan Engineering)").
  let byline = ''
  const blocks: string[] = []
  const notes: string[] = []
  let tables = 0
  let codeBlocks = 0
  let near = ''
  const clip = (text: string, limit: number, what: string) => {
    if (text.length <= limit) return text
    notes.push(
      `${what}${near ? ` in “${near}”` : ''} was ${text.length.toLocaleString('en')} characters; its first ${limit.toLocaleString('en')} were read`
    )
    return `${text.slice(0, limit)} … [cut: ${(text.length - limit).toLocaleString('en')} more characters]`
  }
  const flat = (node: Element) =>
    (node.textContent || '').replace(/\s+/g, ' ').trim()
  const code = (node: Element) => {
    const raw = (node.textContent || '').replace(/^\n+/, '').replace(/\s+$/, '')
    if (!raw.trim()) return
    codeBlocks += 1
    blocks.push('```\n' + clip(raw, CODE_LIMIT, 'A code block') + '\n```')
  }
  const table = (node: Element) => {
    const rows = Array.from(node.querySelectorAll('tr')).filter(
      (row) => row.closest('table') === node
    )
    const cells = rows
      .map((row) =>
        Array.from(row.children)
          .filter((cell) => /^(td|th)$/i.test(cell.tagName))
          .map((cell) => flat(cell).replace(/\|/g, '\\|'))
      )
      .filter((row) => row.some(Boolean))
    if (!cells.length) return
    tables += 1
    const width = Math.max(...cells.map((row) => row.length))
    const line = (row: string[]) =>
      `| ${Array.from({ length: width }, (_, index) => row[index] || '').join(' | ')} |`
    const caption = node.querySelector('caption')
    blocks.push(
      [
        ...(caption && flat(caption) ? [`(table: ${flat(caption)})`] : []),
        line(cells[0]),
        `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
        ...cells.slice(1).map(line)
      ].join('\n')
    )
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
    } else if (
      tag === 'pre' ||
      (tag === 'code' && (node.textContent || '').includes('\n'))
    )
      code(node)
    else if (tag === 'table') table(node)
    else if (tag === 'dt') {
      if (text) blocks.push(`- ${text}`)
    } else if (tag === 'dd') {
      if (text) blocks.push(`  ${clip(text, ITEM_LIMIT, 'A definition')}`)
    } else if (tag === 'figure') {
      // The article's picture above its caption, as the creator and the
      // agent will both read it (review 5: diagrams arrived as text).
      const caption = flat(node.querySelector('figcaption') || node)
      const picture = pictureOf(node.querySelector('img'), base)
      if (picture?.small) {
        if (caption && !byline) byline = caption.slice(0, 120)
      } else if (picture) {
        blocks.push(
          `![${markdownAlt(caption || picture.alt || 'Figure')}](${picture.url})`
        )
        if (caption) blocks.push(`*${caption.slice(0, 300)}*`)
      } else if (node.querySelector('pre, table')) walk(node)
      else if (caption) blocks.push(`*${caption.slice(0, 300)}*`)
    } else if (tag === 'img') {
      const picture = pictureOf(node, base)
      if (picture && !picture.small)
        blocks.push(
          `![${markdownAlt(picture.alt || 'Figure')}](${picture.url})`
        )
    } else if (tag === 'figcaption') {
      if (text) blocks.push(`*${text.slice(0, 300)}*`)
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
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        run += child.textContent || ''
        return
      }
      if (child.nodeType !== 1) return
      const element = child as Element
      const tag = element.tagName.toLowerCase()
      if (
        INLINE.has(tag) &&
        !(tag === 'code' && (element.textContent || '').includes('\n')) &&
        !element.querySelector(
          'p, div, pre, table, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, figure'
        )
      ) {
        run += tag === 'br' ? ' ' : element.textContent || ''
        return
      }
      flush()
      block(element, tag)
    })
    flush()
  }
  walk(container)
  return {
    text: blocks
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    headings,
    tables,
    codeBlocks,
    notes,
    byline
  }
}

// How much was read, and how sure the read is that it is the article.
export const extractionOf = (
  text: string,
  headings: number,
  where = ''
): SourceRead['extraction'] => {
  const words = text.split(/\s+/).filter(Boolean).length
  const thin = words < 150
  return {
    confidence: thin ? 'thin' : 'good',
    words,
    headings,
    excerpt: text.replace(/\s+/g, ' ').trim().slice(0, 600),
    reason: thin
      ? `Only ${words} word${words === 1 ? '' : 's'} ${words === 1 ? 'was' : 'were'} read${where ? ` from ${where}` : ''} — it may be the page's navigation, not the article.`
      : ''
  }
}

/**
 * The code block still open at the end of `text`, by its fence as it stands
 * (indented with it, in a list item), if any. A fence indented four spaces
 * outside a list is a line of indented code, not a fence.
 */
const openFence = (text: string) => {
  let open: {
    char: string
    length: number
    indent: number
    fence: string
  } | null = null
  // Where a list item's text starts, while the list goes on.
  let item: number | null = null
  for (const line of text.split('\n')) {
    const lead = /^[ \t]*/.exec(line)![0]
    const indent = lead.replace(/\t/g, '    ').length
    if (!open) {
      const marker = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/.exec(line)
      if (marker) item = marker[0].replace(/\t/g, '    ').length
      else if (line.trim() && !indent) item = null
    }
    const found = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(line)
    if (!found) continue
    const [, fence, rest] = found
    if (open) {
      // Closed by the same mark, at least as long, with nothing after it,
      // where the block's own fence stands.
      if (
        fence[0] === open.char &&
        fence.length >= open.length &&
        !rest.trim() &&
        Math.abs(indent - open.indent) < 4
      )
        open = null
    } else if (
      (indent < 4 || (item !== null && indent >= item && indent - item < 4)) &&
      // A backtick fence's words hold no backtick: "```a```" is inline code.
      (fence[0] === '~' || !rest.includes('`'))
    )
      open = {
        char: fence[0],
        length: fence.length,
        indent,
        fence: lead + fence
      }
  }
  return open?.fence || ''
}

/**
 * An article too long to keep whole, kept to `limit` characters and saying
 * what it leaves out, on a line of its own. It is cut where a paragraph
 * ends, else where a line does, never inside a table's row; a code block
 * still open there is closed, so nothing before it is lost (review 6: the
 * note went inside a block, or a cell, and a stray fence lost the rest).
 */
export const cutArticle = (given: string, limit = 24_000) => {
  const text = given.replace(/\r\n?/g, '\n')
  if (text.length <= limit) return { text, kept: text, left: 0 }
  // Room for a fence that closes an open block.
  const room = limit - 8
  const paragraph = text.lastIndexOf('\n\n', room)
  const line = text.lastIndexOf('\n', room)
  const at =
    paragraph > room * 0.8 ? paragraph : line > room * 0.8 ? line : room
  const kept = text.slice(0, at).trimEnd()
  const fence = openFence(kept)
  const left = text.length - kept.length
  return {
    text: `${kept}${fence ? `\n${fence}` : ''}\n\n… [cut: the article goes on for ${left.toLocaleString('en')} more characters]`,
    kept,
    left
  }
}

export const readSourceNarrative = (
  narrative: string,
  title = '',
  // Notes the creator saved passed the limit as they count it: kept whole.
  limit = 24_000
): SourceRead => {
  const given = String(narrative || '')
    .replace(/\r\n?/g, '\n')
    .trim()
  // A text too long to read whole is cut where a paragraph ends, and says
  // so, in the notes too (B02 of the BoltDB review; review 6).
  const cut = Number.isFinite(limit)
    ? cutArticle(given, limit)
    : { text: given, left: 0, kept: given }
  const text = cut.text
  const cuts = cut.left
    ? [
        `The text was long; its first ${cut.kept.length.toLocaleString('en')} characters were read, and ${cut.left.toLocaleString('en')} more were left out`
      ]
    : []
  const headings = (text.match(/^#{1,4}\s+.+$/gm) || []).map((line) => ({
    level: (line.match(/^#+/) || ['#'])[0].length,
    text: line.replace(/^#+\s+/, '').slice(0, 140)
  }))
  const firstLine =
    text
      .split('\n')
      .find((line) => line.trim())
      ?.replace(/^#+\s+/, '')
      .trim() || 'Untitled'
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
    palette: {
      ...FALLBACK_PALETTE,
      provenance: 'fallback',
      from: 'no brand website was given'
    },
    fonts: {
      display: 'Segoe UI',
      body: 'Segoe UI',
      mono: 'Consolas',
      seen: []
    },
    warnings: cuts,
    // The creator's own words are what they are: never thin by length.
    extraction: {
      ...extractionOf(text, headings.length),
      confidence: 'good',
      reason: '',
      notes: cuts
    }
  }
}
