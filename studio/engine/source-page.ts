import type { SourceRead } from './source-document'
import type { OutlineScene, OutlinePart } from './source-outline'
import { hsl } from './source-colours'
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

const escapeXml = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'part'

const mix = (hex: string, towards: string, amount: number) => {
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const b = [1, 3, 5].map((i) => parseInt(towards.slice(i, i + 2), 16))
  return `#${a
    .map((v, i) =>
      Math.round(v + (b[i] - v) * amount)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

// A brand for pages: a dark ground reads better behind a presenter at
// 1080p, so a light website ground is deepened rather than copied.
export const pageBrandFrom = (
  palette: SourceRead['palette'],
  fonts: SourceRead['fonts'],
  mode: 'dark' | 'light' | 'auto' = 'auto'
): PageBrand => {
  const groundIsLight = hsl(palette.ground).l > 0.5
  const wantDark =
    mode === 'dark' || (mode === 'auto' && (groundIsLight || true))
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
      mono: fonts.mono
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
    mono: fonts.mono
  }
}

const W = 1280
const H = 720

// rough advance widths so lines wrap before they leave the page
const textWidth = (text: string, size: number, mono = false) =>
  text.length * size * (mono ? 0.6 : 0.52)
const wrap = (
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
  mono = false
) => {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(candidate, size, mono) <= maxWidth || !current)
      current = candidate
    else {
      lines.push(current)
      current = word
    }
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (
    lines.length === maxLines &&
    words.join(' ').length > lines.join(' ').length
  )
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '…'
  return lines
}
const textLines = (
  lines: string[],
  x: number,
  y: number,
  size: number,
  attrs: string,
  lineHeight = 1.3
) =>
  lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${(y + index * size * lineHeight).toFixed(1)}" font-size="${size}" ${attrs}>${escapeXml(line)}</text>`
    )
    .join('\n')

const fontAttr = (family: string, fallback: string) =>
  `font-family="${escapeXml(family)}, ${fallback}"`

// The figure a stat's label states, when it states one: "99.9% uptime",
// "40 ms", "3× faster", "10 regions". A number that belongs to a name —
// p50, v2, GPT-4, H100 — or a bare year is part of the label, never its
// value: the page shows the label and its detail as written instead of
// guessing (F1 of the fresh end-to-end review: "p50 TTFT" became "50").
const STAT_UNIT = '(?:%|×|x|ms|s|k|K|M|B|GB|MB|TB|fps|ns|µs|us)'
const STANDALONE = new RegExp(
  `(?<![\\p{L}\\p{N}._\\/-])([-+~≈<>]?[$€£]?\\d[\\d.,]*)(\\s*${STAT_UNIT})?(?![\\p{L}\\p{N}])`,
  'gu'
)
export const statFigure = (
  label: string
): { figure: string; caption: string } | null => {
  for (const match of label.matchAll(STANDALONE)) {
    const [whole, number, unit] = match
    const leads = !label.slice(0, match.index).trim()
    const year =
      !unit &&
      /^\d{4}$/.test(number) &&
      Number(number) >= 1900 &&
      Number(number) <= 2099
    // A figure with a unit may sit anywhere in the label; a bare number only
    // leads it ("10 regions"), and a bare year is a date, not a value.
    if (year || (!unit && !leads)) continue
    const caption = (
      label.slice(0, match.index) +
      ' ' +
      label.slice((match.index || 0) + whole.length)
    )
      .replace(/\s+/g, ' ')
      .replace(/^[\s:·—–-]+|[\s:·—–-]+$/g, '')
      .trim()
    return { figure: whole.trim(), caption }
  }
  return null
}

export const renderPage = (
  scene: OutlineScene,
  index: number,
  total: number,
  brand: PageBrand,
  video: { title: string; site: string }
): string => {
  const n = index + 1
  const id = (name: string) => `s${n}-${name}`
  const display = fontAttr(brand.display, 'Segoe UI, sans-serif')
  const body = fontAttr(brand.body, 'Segoe UI, sans-serif')
  const mono = fontAttr(brand.mono, 'Consolas, monospace')
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${body} font-size="22" data-page-role="${scene.kind}" data-page-index="${n}">`
  )
  parts.push(
    `<defs><marker id="${id('arrow')}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto"><polygon points="0,0 10,5 0,10" fill="${brand.line}"/></marker></defs>`
  )
  parts.push(
    `<rect id="bg" data-role="background" x="0" y="0" width="${W}" height="${H}" fill="${brand.ground}"/>`
  )
  const grid: string[] = []
  for (let x = 40; x < W; x += 40) grid.push(`M${x} 0V${H}`)
  for (let y = 40; y < H; y += 40) grid.push(`M0 ${y}H${W}`)
  parts.push(
    `<path id="grid" data-role="decoration" fill="none" stroke="${brand.line}" stroke-opacity="0.06" stroke-width="1" d="${grid.join(' ')}"/>`
  )

  // header: kicker and title, chrome for every kind but the title card
  const kicker = `§ ${String(n).padStart(2, '0')} · ${video.title}`
    .toUpperCase()
    .slice(0, 70)
  if (scene.kind !== 'title' && scene.kind !== 'close') {
    parts.push(`<g id="header" data-role="header">`)
    parts.push(
      `<text x="82" y="58" font-size="14" fill="${brand.accent}" letter-spacing="2" ${mono}>${escapeXml(kicker)}</text>`
    )
    parts.push(
      textLines(
        wrap(scene.title, 38, 1120, 1),
        80,
        104,
        38,
        `font-weight="bold" fill="${brand.text}" ${display}`
      )
    )
    parts.push(`</g>`)
  }

  if (scene.kind === 'title') {
    parts.push(`<g id="${id('title-stack')}" data-role="title">`)
    parts.push(
      `<text id="${id('kicker')}" x="82" y="212" font-size="15" fill="${brand.accent}" letter-spacing="2" ${mono}>${escapeXml((video.site || 'explainer').toUpperCase())}</text>`
    )
    const titleLines = wrap(scene.title, 66, 1000, 2)
    parts.push(
      textLines(
        titleLines,
        80,
        292,
        66,
        `id="${id('title')}" font-weight="bold" fill="${brand.text}" ${display}`,
        1.1
      )
    )
    const ruleY = 292 + (titleLines.length - 1) * 72 + 30
    parts.push(
      `<line id="${id('rule')}" x1="82" y1="${ruleY}" x2="262" y2="${ruleY}" stroke="${brand.accent}" stroke-width="3"/>`
    )
    parts.push(
      textLines(
        wrap(scene.idea || video.title, 24, 760, 3),
        82,
        ruleY + 44,
        24,
        `id="${id('subtitle')}" fill="${brand.muted}" ${body}`,
        1.4
      )
    )
    parts.push(`</g>`)
  } else if (scene.kind === 'close') {
    parts.push(`<g id="${id('close-stack')}" data-role="title">`)
    parts.push(
      textLines(
        wrap(scene.idea || scene.title, 46, 1040, 3),
        80,
        300,
        46,
        `id="${id('statement')}" font-weight="bold" fill="${brand.text}" ${display}`,
        1.2
      )
    )
    parts.push(
      `<line id="${id('rule')}" x1="82" y1="${300 + 46 * 1.2 * 3 + 6}" x2="262" y2="${300 + 46 * 1.2 * 3 + 6}" stroke="${brand.accent}" stroke-width="3"/>`
    )
    parts.push(
      `<text id="${id('site')}" x="82" y="${300 + 46 * 1.2 * 3 + 50}" font-size="16" fill="${brand.muted}" letter-spacing="1" ${mono}>${escapeXml((video.site || video.title).toUpperCase())}</text>`
    )
    parts.push(`</g>`)
  } else if (scene.kind === 'list') {
    const items = scene.parts.slice(0, 6)
    const top = 170
    const rowHeight = Math.min(84, (560 - 40) / Math.max(1, items.length))
    parts.push(`<g id="${id('list')}" data-role="list">`)
    items.forEach((item, i) => {
      const y = top + i * rowHeight
      parts.push(`<g id="${id(`item-${slug(item.label)}`)}" data-role="item">`)
      parts.push(
        `<rect x="82" y="${y}" width="34" height="34" rx="6" fill="${brand.panel}" stroke="${brand.line}" stroke-width="1.5"/>`
      )
      parts.push(
        `<text x="99" y="${y + 23}" font-size="16" text-anchor="middle" fill="${brand.accent}" ${mono}>${i + 1}</text>`
      )
      parts.push(
        `<text x="140" y="${y + 24}" font-size="26" fill="${brand.text}" ${body}>${escapeXml(item.label)}</text>`
      )
      if (item.detail)
        parts.push(
          `<text x="140" y="${y + 50}" font-size="16" fill="${brand.muted}" ${body}>${escapeXml(wrap(item.detail, 16, 1000, 1)[0] || '')}</text>`
        )
      parts.push(`</g>`)
    })
    parts.push(`</g>`)
  } else if (scene.kind === 'numbers') {
    const stats = scene.parts
      .filter((part) => part.kind === 'number')
      .concat(scene.parts.filter((part) => part.kind !== 'number'))
      .slice(0, 4)
    const columnWidth = (W - 160) / Math.max(1, stats.length)
    parts.push(`<g id="${id('stats')}" data-role="stats">`)
    stats.forEach((stat, i) => {
      const x = 80 + i * columnWidth
      const room = columnWidth - 40
      // a figure is the value the label states; a label without one is a
      // fact, set smaller, with its detail as written
      const found = statFigure(stat.label)
      parts.push(`<g id="${id(`stat-${slug(stat.label)}`)}" data-role="stat">`)
      if (found) {
        const figure = found.figure.slice(0, 12)
        const caption = found.caption || stat.detail
        const size = Math.max(
          34,
          Math.min(
            stats.length > 3 ? 56 : 72,
            Math.floor(room / (figure.length * 0.58))
          )
        )
        parts.push(
          `<text x="${x}" y="340" font-size="${size}" font-weight="bold" fill="${brand.text}" ${display}>${escapeXml(figure)}</text>`
        )
        parts.push(
          textLines(
            wrap(caption, 18, room, 2),
            x + 2,
            378,
            18,
            `fill="${brand.muted}" ${body}`
          )
        )
      } else {
        const lines = wrap(stat.label, 28, room, 2)
        parts.push(
          textLines(
            lines,
            x,
            316,
            28,
            `font-weight="bold" fill="${brand.text}" ${display}`,
            1.15
          )
        )
        parts.push(
          textLines(
            wrap(stat.detail, 17, room, 3),
            x + 1,
            316 + lines.length * 32 + 12,
            17,
            `fill="${brand.muted}" ${body}`
          )
        )
      }
      parts.push(`</g>`)
    })
    parts.push(`</g>`)
  } else if (scene.kind === 'quote') {
    parts.push(`<g id="${id('quote')}" data-role="quote">`)
    parts.push(
      `<rect id="${id('bar')}" x="80" y="200" width="6" height="${Math.min(4, wrap(scene.idea, 34, 1000, 4).length) * 46}" fill="${brand.accent}"/>`
    )
    parts.push(
      textLines(
        wrap(scene.idea || scene.title, 34, 1000, 4),
        112,
        232,
        34,
        `id="${id('statement')}" fill="${brand.text}" ${display}`,
        1.35
      )
    )
    const source = scene.parts[0]?.label || video.site
    if (source)
      parts.push(
        `<text id="${id('attribution')}" x="112" y="${232 + 4 * 46 + 30}" font-size="16" fill="${brand.muted}" letter-spacing="1" ${mono}>— ${escapeXml(source.toUpperCase())}</text>`
      )
    parts.push(`</g>`)
  } else {
    // diagram: nodes by level from the relations, left to right
    const nodes = scene.parts.filter(
      (part) => part.kind === 'box' || part.kind === 'step'
    )
    const notes = scene.parts.filter(
      (part) => part.kind === 'note' || part.kind === 'number'
    )
    const byLabel = new Map(
      nodes.map((node) => [node.label.toLowerCase(), node])
    )
    const level = new Map<string, number>()
    nodes.forEach((node) => level.set(node.label.toLowerCase(), 0))
    for (let round = 0; round < nodes.length; round += 1) {
      let changed = false
      scene.relations.forEach((relation) => {
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
    nodes.forEach((node) => {
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
    const positions = new Map<
      string,
      { x: number; y: number; w: number; h: number }
    >()
    parts.push(`<g id="${id('diagram')}" data-role="diagram">`)
    columns.forEach((l, ci) => {
      const column = levels.get(l) || []
      const boxHeight = Math.min(
        88,
        (areaHeight - 20) / Math.max(1, column.length) - 16
      )
      const gap = (areaHeight - column.length * boxHeight) / (column.length + 1)
      column.forEach((node, ri) => {
        const x = areaLeft + ci * columnWidth + (columnWidth - boxWidth) / 2
        const y = areaTop + gap + ri * (boxHeight + gap)
        positions.set(node.label.toLowerCase(), {
          x,
          y,
          w: boxWidth,
          h: boxHeight
        })
        const labelLines = wrap(node.label, 20, boxWidth - 24, 2)
        const rx = node.kind === 'step' ? boxHeight / 2 : 10
        parts.push(
          `<g id="${id(`node-${slug(node.label)}`)}" data-role="node" data-kind="${node.kind}">`
        )
        parts.push(
          `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxWidth}" height="${boxHeight.toFixed(1)}" rx="${rx}" fill="${brand.panel}" stroke="${brand.line}" stroke-width="1.5"/>`
        )
        const firstY = y + boxHeight / 2 + 7 - (labelLines.length - 1) * 12
        parts.push(
          labelLines
            .map(
              (line, li) =>
                `<text x="${(x + boxWidth / 2).toFixed(1)}" y="${(firstY + li * 24).toFixed(1)}" font-size="20" text-anchor="middle" fill="${brand.text}" ${body}>${escapeXml(line)}</text>`
            )
            .join('\n')
        )
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
      parts.push(
        `<line id="${id(`edge-${ri + 1}`)}" data-role="connector" data-verb="${escapeXml(relation.verb)}" data-from="${fromId}" data-to="${toId}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${brand.line}" stroke-width="1.5" marker-end="url(#${id('arrow')})"/>`
      )
    })
    parts.push(`</g>`)
    if (notes.length) {
      parts.push(`<g id="${id('notes')}" data-role="notes">`)
      notes.slice(0, 3).forEach((note, ni) => {
        const y = 600 + ni * 30
        parts.push(
          `<text id="${id(`note-${slug(note.label)}`)}" x="82" y="${y}" font-size="18" fill="${brand.muted}" ${body}>${escapeXml(wrap(`${note.label}${note.detail ? ` — ${note.detail}` : ''}`, 18, 1100, 1)[0] || '')}</text>`
        )
      })
      parts.push(`</g>`)
    }
  }

  // footer chrome
  parts.push(
    `<g id="footer" data-role="footer" ${mono} font-size="12" fill="${brand.muted}">`
  )
  parts.push(
    `<rect x="1000" y="668" width="220" height="32" fill="none" stroke="${mix(brand.line, brand.ground, 0.5)}" stroke-width="1"/>`
  )
  parts.push(
    `<line x1="1110" y1="668" x2="1110" y2="700" stroke="${mix(brand.line, brand.ground, 0.5)}" stroke-width="1"/>`
  )
  parts.push(
    `<text x="1012" y="688">${escapeXml((video.site || 'video').slice(0, 14).toUpperCase())}</text>`
  )
  parts.push(
    `<text x="1122" y="688">SHEET ${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}</text>`
  )
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
  return {
    groups,
    roles,
    connectors,
    verbs,
    labels,
    declared: connectors === verbs && groups > 0
  }
}
