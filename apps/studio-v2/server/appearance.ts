// What a thing in an explainer should look like, written down.
//
// A wireframe says a bucket is here and a server is there. That is enough to
// plan a story and not enough to draw one: the artwork stage needs to know
// what the object is, which of its parts the scene will move, where things
// enter and leave it, and what the rest of its family looks like so the page
// holds together. This module is that brief — the input to a generator and
// the record of what was asked for.
import { createHash } from 'node:crypto'

/** The look every object in one scene shares. */
export type ObjectStyle = {
  /** A name for the family, so a brief can say "like the others". */
  family: string
  palette: { ground: string; text: string; accent: string; secondary: string; warning?: string }
  /** One viewing angle for the whole family: front, or a slight three-quarter. */
  angle: 'front' | 'three-quarter'
  /** How much detail an object carries. Restraint reads better at 640px wide. */
  density: 'plain' | 'considered' | 'rich'
  /** Flat fills and one soft shadow, or a fuller treatment. */
  depth: 'flat' | 'soft'
}

/** One object to be drawn: what it is, and what the scene will do to it. */
export type ObjectBrief = {
  /** The entity on the page this artwork stands for. */
  entity: string
  /** Its role in the story: bucket, server, request, queue, gate. */
  role: string
  /** A sentence a person would recognise it by. */
  represents: string
  /**
   * What the diagram it belongs to is about. The look is the family's; the
   * subject is this object's, so a second explanation can be drawn in the
   * same hand without redrawing the first one's objects.
   */
  subject?: string
  /** The states the scene puts it in — the artwork must be able to show them. */
  states: string[]
  /**
   * The pieces the scene controls by name. A piece that stands for how full
   * the thing is says which way it fills: a container's contents drop as it
   * empties ("up"), a bar shortens from its right end ("right"). Left unsaid,
   * the studio guesses from the shape.
   */
  parts: Array<{ id: string; what: string; fills?: 'up' | 'right' }>
  /** Where things arrive and leave, in the object's own box (0–1). */
  ports: { in?: { x: number; y: number }; out?: { x: number; y: number } }
  /** Where the page's own label sits, so the drawing leaves room for it. */
  labelAnchor: 'below' | 'right' | 'inside-top' | 'none'
  size: { width: number; height: number }
  style: ObjectStyle
  /** Text the page draws itself; the artwork must not bake it in. */
  keepsTextOut: string[]
}

/** The style of the reference explanation: Stripe's own ground and accent. */
export const REFERENCE_STYLE: ObjectStyle = {
  family: 'rate-limiter',
  palette: { ground: '#ffffff', text: '#0a2540', accent: '#635bff', secondary: '#425466', warning: '#d6336c' },
  angle: 'three-quarter',
  density: 'considered',
  depth: 'flat',
}

/**
 * The three objects the reference explanation is built from. The bucket and
 * the server are generated first: they set the family, and everything after
 * them is drawn to match.
 */
export const referenceObjects = (style: ObjectStyle = REFERENCE_STYLE): ObjectBrief[] => [
  {
    entity: 'token-bucket',
    role: 'bucket',
    represents: 'A container holding a small number of tokens, which drain as calls are served and refill over time',
    states: ['full', 'partly spent', 'empty', 'refilling'],
    parts: [
      { id: 'shell', what: 'the container itself, open at the top' },
      { id: 'tokens', what: 'three identical tokens stacked inside, each separately controllable' },
      { id: 'level', what: 'the fill the tokens sit in, so how full it is reads at a glance', fills: 'up' },
      { id: 'inlet', what: 'where the refill drips in' },
    ],
    ports: { in: { x: 0.08, y: 0.5 }, out: { x: 0.92, y: 0.5 } },
    labelAnchor: 'below',
    size: { width: 260, height: 220 },
    style,
    keepsTextOut: ['the token count', 'the bucket size', 'the refill rate'],
  },
  {
    entity: 'server',
    role: 'server',
    represents: 'The service behind the limiter that does the real work when a call is admitted',
    states: ['idle', 'processing', 'done'],
    parts: [
      { id: 'shell', what: 'the machine body, a stacked rack rather than a plain box' },
      { id: 'tray', what: 'the slot an admitted call arrives in' },
      { id: 'indicator', what: 'a light that shows it working' },
    ],
    ports: { in: { x: 0.06, y: 0.5 }, out: { x: 0.94, y: 0.5 } },
    labelAnchor: 'below',
    size: { width: 240, height: 200 },
    style,
    keepsTextOut: ['the service name', 'any status code'],
  },
  {
    entity: 'request',
    role: 'request',
    represents: 'One call from one user, travelling between the things on the page',
    states: ['travelling', 'admitted', 'rejected'],
    parts: [
      { id: 'body', what: 'the packet itself, small and unmistakable while moving' },
      { id: 'mark', what: 'a mark that can turn from neutral to refused' },
    ],
    ports: {},
    labelAnchor: 'none',
    size: { width: 72, height: 72 },
    style,
    keepsTextOut: ['any label — the page writes what it is'],
  },
]

/**
 * The second explanation: a concurrency limit. Work in progress occupies a
 * fixed number of slots, work beyond that waits its turn, and a slot freed by
 * a completion admits the next one. It is a different mechanism told with the
 * same runtime, the same controls and the same hand — the request and the
 * server are the reference family's, drawn once and reused here.
 */
export const concurrencyObjects = (style: ObjectStyle = REFERENCE_STYLE): ObjectBrief[] => [
  {
    entity: 'slot-pool',
    role: 'pool',
    represents: 'A fixed row of work slots, each either free or occupied by one call in progress',
    subject: 'concurrency limits',
    states: ['all free', 'partly taken', 'full', 'a slot freed'],
    parts: [
      { id: 'shell', what: 'the frame that holds the row, making the number of slots countable at a glance' },
      { id: 'slots', what: 'four identical slots in a row, each separately controllable' },
      { id: 'occupied', what: 'the mark that shows a slot is taken, so how full the pool is reads at a glance', fills: 'right' },
      { id: 'gate', what: 'the mouth work passes through on its way in' },
    ],
    ports: { in: { x: 0.06, y: 0.5 }, out: { x: 0.94, y: 0.5 } },
    labelAnchor: 'below',
    size: { width: 300, height: 200 },
    style,
    keepsTextOut: ['the number of slots', 'how many are in use'],
  },
  {
    entity: 'waiting-line',
    role: 'queue',
    represents: 'The line work stands in when every slot is taken, emptying from the front as slots free',
    subject: 'concurrency limits',
    states: ['empty', 'holding', 'releasing the next one'],
    parts: [
      { id: 'shell', what: 'the lane the waiting work stands in, open at both ends' },
      { id: 'waiting', what: 'three identical items queued along it, each separately controllable', fills: 'right' },
      { id: 'head', what: 'a mark on the one at the front, the next to be admitted' },
    ],
    ports: { in: { x: 0.94, y: 0.5 }, out: { x: 0.06, y: 0.5 } },
    labelAnchor: 'below',
    size: { width: 300, height: 160 },
    style,
    keepsTextOut: ['how many are waiting', 'any wait time'],
  },
]

/**
 * Every object the studio knows how to draw. One list, so a page may name any
 * of them and the studio finds the brief without knowing which explanation
 * asked for it.
 */
export const knownObjects = (style: ObjectStyle = REFERENCE_STYLE): ObjectBrief[] => [...referenceObjects(style), ...concurrencyObjects(style)]

/** A scene author's brief, not an entry in a closed icon catalogue. */
export const objectBriefFrom = (value: unknown): ObjectBrief => {
  const b = value as ObjectBrief
  const text = (v: unknown, max = 800) => typeof v === 'string' ? v.trim().slice(0, max) : ''
  if (!b || !/^[a-z][a-z0-9-]{1,63}$/.test(b.entity || '') || !text(b.role) || !text(b.represents)) throw new Error('An object needs an entity, a role, and what it represents')
  if (!Array.isArray(b.parts) || !b.parts.length || b.parts.length > 24) throw new Error('An object needs 1–24 named parts')
  const parts = b.parts.map(p => {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(p.id || '') || !text(p.what)) throw new Error('Each part needs a stable id and a description')
    return { id: p.id, what: text(p.what), ...(p.fills === 'up' || p.fills === 'right' ? { fills: p.fills } : {}) }
  })
  if (new Set(parts.map(p => p.id)).size !== parts.length) throw new Error('Object part ids must be unique')
  const palette = b.style?.palette
  if (!palette || Object.values(palette).some(v => !/^#[0-9a-f]{6}$/i.test(v))) throw new Error('Use six-digit hex colours from the scene palette')
  for (const key of ['ground', 'text', 'accent', 'secondary', 'warning'] as const) if (!palette[key]) throw new Error(`Missing palette ${key}`)
  const size = b.size
  if (!size || ![size.width, size.height].every(v => Number.isFinite(v) && v >= 48 && v <= 1600)) throw new Error('Object dimensions must be 48–1600')
  const ports: ObjectBrief['ports'] = {}
  for (const [name, point] of Object.entries(b.ports || {})) {
    if ((name !== 'in' && name !== 'out') || ![point.x, point.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Ports use normalized coordinates')
    ports[name] = { x: point.x, y: point.y }
  }
  return { entity: b.entity, role: text(b.role, 80), represents: text(b.represents), subject: text(b.subject, 120), parts, ports, size,
    states: (Array.isArray(b.states) ? b.states : []).slice(0, 12).map(s => text(s, 100)), labelAnchor: ['below', 'right', 'inside-top', 'none'].includes(b.labelAnchor) ? b.labelAnchor : 'below',
    style: { family: text(b.style.family, 100), palette, angle: b.style.angle === 'front' ? 'front' : 'three-quarter', density: b.style.density === 'rich' ? 'rich' : 'considered', depth: b.style.depth === 'soft' ? 'soft' : 'flat' },
    keepsTextOut: (Array.isArray(b.keepsTextOut) ? b.keepsTextOut : []).slice(0, 12).map(s => text(s, 120)) }
}

/** The words a generator is given. Everything the brief knows, nothing else. */
export const briefPrompt = (brief: ObjectBrief) => {
  const { style } = brief
  return [
    `Draw one object for a technical explainer: ${brief.represents}.`,
    `It is the ${brief.role} in a diagram about ${brief.subject || 'the technical mechanism'}, seen ${style.angle === 'front' ? 'from the front' : 'at a slight three-quarter angle'}.`,
    `Flat vector artwork on a transparent background, ${style.depth === 'flat' ? 'flat fills with at most one soft shadow' : 'soft shading'}, ${style.density} detail — it has to read at 640 pixels wide.`,
    `Palette: ${style.palette.accent} as the accent, ${style.palette.secondary} for secondary surfaces, ${style.palette.text} for outlines, on nothing (transparent). It belongs to a family called "${style.family}": the same angle, weight and palette as the others.`,
    `Give it a concrete silhouette — a viewer should recognise what it is with the label covered.`,
    `These parts must be separate groups, each with its own id, because the scene animates them: ${brief.parts.map(part => `"${part.id}" (${part.what})`).join('; ')}.`,
    `It must be able to show these states without redrawing: ${brief.states.join(', ')}.`,
    `Keep containers empty unless the named parts explicitly request their controllable contents. Never bake decorative coins, packets, jobs or other countable items into the shell or interior: the scene owns those quantities.`,
    brief.ports.in || brief.ports.out
      ? `Things enter at ${brief.ports.in ? `${Math.round(brief.ports.in.x * 100)}%, ${Math.round(brief.ports.in.y * 100)}%` : 'no entrance'} and leave at ${brief.ports.out ? `${Math.round(brief.ports.out.x * 100)}%, ${Math.round(brief.ports.out.y * 100)}%` : 'no exit'} of its box.`
      : 'It travels; nothing enters or leaves it.',
    `Draw no text: the page writes ${brief.keepsTextOut.join(', ')} itself.`,
    `Return one SVG, viewBox "0 0 ${brief.size.width} ${brief.size.height}", no external references, no <image>, no filters beyond a soft drop shadow.`,
  ].join(' ')
}

/**
 * What makes this artwork this artwork. Two briefs that would produce the same
 * drawing share a key, so rewording a scene's narration never regenerates it.
 */
export const briefKey = (brief: ObjectBrief) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        entity: brief.entity,
        role: brief.role,
        represents: brief.represents,
        // Only when the brief states one: an object asked for before this
        // field existed keeps the key its accepted drawing is filed under.
        ...(brief.subject ? { subject: brief.subject } : {}),
        states: [...brief.states].sort(),
        parts: brief.parts.map(part => [part.id, part.what, part.fills || null]).sort(),
        ports: brief.ports,
        size: brief.size,
        style: brief.style,
      }),
    )
    .digest('hex')
    .slice(0, 24)

// ——— Accepting what came back ———
// A prompt asking for named parts does not guarantee a usable rig. What
// arrives is inspected against the brief: one root, nothing external, the
// parts the scene will animate present and findable by name. What is accepted
// is a normalized copy — ids prefixed so two objects on one page cannot
// collide, and the root sized the way the page will place it.

export type AcceptedArtwork = {
  ok: boolean
  /** The drawing as it will be used: prefixed ids, normalized root. */
  svg: string
  viewBox: { width: number; height: number }
  /** Which of the brief's parts were found, by their new ids. */
  /** The element found for each part the brief named: its id in the accepted
   * drawing, the element it is, and the name the scene knows it by. */
  parts: Array<{ id: string; element: string; as: string; fills?: 'up' | 'right' }>
  missing: string[]
  /** Ports in the object's own box, carried from the brief. */
  ports: ObjectBrief['ports']
  problems: string[]
}

const SVG_FORBIDDEN = /<\s*(image|script|foreignObject|iframe)\b/i
const EXTERNAL_REFERENCE = /\b(?:href|xlink:href)\s*=\s*["'](?!#)[^"']+["']/i

export const acceptArtwork = (raw: string, brief: ObjectBrief): AcceptedArtwork => {
  const problems: string[] = []
  const svg = raw.trim()
  const rootMatch = /<svg\b[^>]*>/i.exec(svg)
  if (!rootMatch) {
    return { ok: false, svg: '', viewBox: brief.size, parts: [], missing: brief.parts.map(part => part.id), ports: brief.ports, problems: ['the answer is not an SVG'] }
  }
  if (SVG_FORBIDDEN.test(svg)) problems.push('it contains an image, script or foreignObject')
  if (EXTERNAL_REFERENCE.test(svg) || [...svg.matchAll(/url\(([^)]+)\)/gi)].some(match => !/^['\"]?#/.test(match[1].trim())) || /@import/i.test(svg)) problems.push('it points at something outside itself')
  if (/\son[a-z]+\s*=/i.test(svg) || /<!DOCTYPE|<!ENTITY/i.test(svg)) problems.push('it contains executable or external markup')
  // One prefix per object, so two objects on one page cannot collide.
  const prefix = `ap-${briefKey(brief).slice(0, 8)}`
  const found: Array<{ id: string; element: string; as: string; fills?: 'up' | 'right' }> = []
  const missing: string[] = []
  brief.parts.forEach(part => {
    // A part has to be findable, not spelled exactly: a generator that groups
    // the tokens as "tokens", "tokens--part-1" or marks them data-part="tokens"
    // has given the scene what it needs. The name is ours; the id is theirs.
    const candidates = [
      new RegExp(`<\\s*([a-zA-Z]+)\\b[^>]*\\bid\\s*=\\s*["']${part.id}["']`, 'i'),
      new RegExp(`<\\s*([a-zA-Z]+)\\b[^>]*\\bdata-part\\s*=\\s*["']${part.id}["'][^>]*\\bid\\s*=\\s*["']([^"']+)["']`, 'i'),
      new RegExp(`<\\s*([a-zA-Z]+)\\b[^>]*\\bid\\s*=\\s*["'](${part.id}[-_][^"']*)["']`, 'i'),
      new RegExp(`<\\s*([a-zA-Z]+)\\b[^>]*\\bid\\s*=\\s*["']([^"']*[-_]${part.id})["']`, 'i'),
    ]
    const hit = candidates.map(pattern => pattern.exec(svg)).find(Boolean)
    if (hit) found.push({ id: `${prefix}-${hit[2] || part.id}`, element: hit[1].toLowerCase(), as: part.id, ...(part.fills ? { fills: part.fills } : {}) })
    else missing.push(part.id)
  })
  if (missing.length) problems.push(`the scene needs these parts and they are not in the drawing: ${missing.join(', ')}`)
  // Prefix every id and every local reference to one.
  const prefixed = svg
    .replace(/\bid\s*=\s*(["'])([^"']+)\1/g, (_, _quote: string, id: string) => `id="${prefix}-${id}"`)
    .replace(/\burl\(\s*["']?#([^)'"\s]+)["']?\s*\)/g, (_, id: string) => `url(#${prefix}-${id})`)
    .replace(/\b(href|xlink:href)\s*=\s*(["'])#([^"']+)\2/g, (_, attribute: string, _quote: string, id: string) => `${attribute}="#${prefix}-${id}"`)
  // Fit the original coordinate system into the requested viewport. Merely
  // rewriting viewBox crops provider artwork when its canvas differs.
  const originalBox = /viewBox\s*=\s*["']([^"']+)["']/i.exec(rootMatch[0])?.[1].split(/[\s,]+/).map(Number)
  const source = originalBox?.length === 4 && originalBox.every(Number.isFinite) && originalBox[2] > 0 && originalBox[3] > 0 ? originalBox : [0, 0, brief.size.width, brief.size.height]
  const scale = Math.min(brief.size.width / source[2], brief.size.height / source[3])
  const dx = (brief.size.width - source[2] * scale) / 2 - source[0] * scale
  const dy = (brief.size.height - source[3] * scale) / 2 - source[1] * scale
  const prefixedRoot = /<svg\b[^>]*>/i.exec(prefixed)![0]
  const normalizedRoot = prefixedRoot
    .replace(/\s(width|height|viewBox)\s*=\s*(["'])[^"']*\2/gi, '')
    .replace(/<svg\b/i, `<svg viewBox="0 0 ${brief.size.width} ${brief.size.height}"`)
  const fit = scale !== 1 || dx !== 0 || dy !== 0
  const normalized = prefixed.replace(prefixedRoot, normalizedRoot + (fit ? `<g transform="matrix(${scale} 0 0 ${scale} ${dx} ${dy})">` : '')).replace(/<\/svg>\s*$/i, `${fit ? '</g>' : ''}</svg>`)
  return {
    ok: problems.length === 0,
    svg: normalized,
    viewBox: brief.size,
    parts: found,
    missing,
    ports: brief.ports,
    problems,
  }
}
