// The kit the template sketches are drawn with: small SVG shapes and a motion
// clock. Every sketch loops on the same seven seconds, so the stages inside
// it stay in step loop after loop. Colours come from CSS variables, which the
// card sets from the project's look.
export const LOOP = 7

const pct = (seconds: number) =>
  Math.max(0, Math.min(100, +((seconds / LOOP) * 100).toFixed(2)))
const keyframes = new Map<string, string>()
let flushed = 0
const name = (...parts: Array<string | number>) =>
  `sk-${parts
    .map((part) => (typeof part === 'number' ? +part.toFixed(3) : part))
    .join('_')}`
    .replace(/\./g, 'p')
    .replace(/-(?=\d)/g, 'm')
const register = (id: string, body: string) => {
  if (!keyframes.has(id))
    keyframes.set(
      id,
      `@keyframes ${id}{${body}}.${id}{animation:${id} ${LOOP}s linear infinite both}`
    )
  return id
}
const end = pct(LOOP - 0.45)

/** Timed motions, by the second they start in the loop. */
export const motion = {
  pop: (t: number) =>
    register(
      name('pop', t),
      `0%,${pct(t)}%{opacity:0;transform:scale(.6)}${pct(t + 0.25)}%{opacity:1;transform:scale(1.08)}${pct(t + 0.45)}%,${end}%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}`
    ),
  fade: (t: number, d = 0.4) =>
    register(
      name('fade', t, d),
      `0%,${pct(t)}%{opacity:0}${pct(t + d)}%,${end}%{opacity:1}100%{opacity:0}`
    ),
  during: (a: number, b: number) =>
    register(
      name('win', a, b),
      `0%,${pct(a)}%{opacity:0}${pct(a + 0.3)}%,${pct(b)}%{opacity:1}${pct(b + 0.3)}%,100%{opacity:0}`
    ),
  until: (t: number) =>
    register(
      name('off', t),
      `0%{opacity:0}${pct(0.35)}%,${pct(t)}%{opacity:1}${pct(t + 0.4)}%,100%{opacity:0}`
    ),
  spot: (a: number, b: number) =>
    register(
      name('dim', a, b),
      `0%,${pct(a)}%{opacity:.28}${pct(a + 0.25)}%,${pct(b)}%{opacity:1}${pct(b + 0.25)}%,100%{opacity:.28}`
    ),
  draw: (t: number, d = 1.2) =>
    register(
      name('draw', t, d),
      `0%,${pct(t)}%{stroke-dashoffset:1;opacity:1}${pct(t + d)}%,${end}%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}`
    ),
  move: (
    a: number,
    b: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) =>
    register(
      name('mv', a, b, x0, y0, x1, y1),
      `0%,${pct(a)}%{transform:translate(${x0}px,${y0}px)}${pct(b)}%,100%{transform:translate(${x1}px,${y1}px)}`
    ),
  scale: (a: number, b: number, s0: number, s1: number) =>
    register(
      name('sc', a, b, s0, s1),
      `0%,${pct(a)}%{transform:scale(${s0})}${pct(b)}%,100%{transform:scale(${s1})}`
    ),
  grow: (t: number, d = 1) =>
    register(
      name('gr', t, d),
      `0%,${pct(t)}%{transform:scaleX(0);opacity:1}${pct(t + d)}%,${end}%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}`
    ),
  type: (t: number, d: number) =>
    register(
      name('ty', t, d),
      `0%,${pct(t)}%{transform:scaleX(0);animation-timing-function:steps(18,end)}${pct(t + d)}%,100%{transform:scaleX(1)}`
    ),
  spin: () =>
    register(
      'sk-spin',
      '0%{transform:rotate(0)}100%{transform:rotate(1080deg)}'
    ),
  pulse: (t: number) =>
    register(
      name('pu', t),
      `0%,${pct(t)}%{opacity:0;transform:scale(.8)}${pct(t + 0.4)}%{opacity:.9;transform:scale(1.15)}${pct(t + 0.8)}%{opacity:.35;transform:scale(1)}${pct(t + 1.2)}%{opacity:.9;transform:scale(1.15)}${pct(t + 1.6)}%{opacity:.35;transform:scale(1)}${pct(t + 2)}%{opacity:.9;transform:scale(1.15)}${end}%{opacity:.6;transform:scale(1)}100%{opacity:0}`
    ),
  flip: (t: number) =>
    register(
      name('fl', t),
      `0%,${pct(t)}%{transform:scaleX(1)}${pct(t + 0.2)}%{transform:scaleX(0)}${pct(t + 0.4)}%,100%{transform:scaleX(1)}`
    ),
  along: (a: number, b: number) =>
    register(
      name('al', a, b),
      `0%,${pct(a)}%{offset-distance:0%}${pct(b)}%,100%{offset-distance:100%}`
    )
}

/** Puts every motion the sketches used so far on the page, once. */
export const flushMotion = (
  doc: Document | undefined = globalThis.document
) => {
  if (!doc || keyframes.size === flushed) return
  let style = doc.getElementById('template-sketch-motion')
  if (!style) {
    style = doc.createElement('style')
    style.id = 'template-sketch-motion'
    doc.head.append(style)
  }
  style.textContent = [...keyframes.values()].join('\n')
  flushed = keyframes.size
}

export const svg = (inner: string) =>
  `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">${inner}</svg>`
export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  cls = 'sk-card',
  r = 8,
  extra = ''
) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${cls}" ${extra}/>`
export const bar = (x: number, y: number, w: number, cls = 'sk-ink3', h = 6) =>
  rect(x, y, w, h, cls, h / 2)
export const label = (
  x: number,
  y: number,
  t: string,
  cls = 'sk-label',
  anchor = 'middle'
) =>
  `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${t}</text>`
export const group = (cls: string, inner: string, extra = '') =>
  `<g class="${cls}" ${extra}>${inner}</g>`
export const path = (d: string, cls = 'sk-edge', extra = '') =>
  `<path d="${d}" class="${cls}" ${extra}/>`
/** A line that draws itself, starting at second t. */
export const drawn = (d: string, cls: string, t: number, dur = 1.2) =>
  `<path d="${d}" pathLength="1" class="${cls} sk-draw ${motion.draw(t, dur)}"/>`
export const person = (cx: number, cy: number, s = 1) =>
  `<g class="sk-person"><circle cx="${cx}" cy="${cy - 12 * s}" r="${9 * s}"/><path d="M${cx - 17 * s} ${cy + 17 * s}q0-${18 * s} ${17 * s}-${18 * s}q${17 * s} 0 ${17 * s} ${18 * s}z"/></g>`
/** The creator's camera, as a dark tile with a figure in it. */
export const camera = (x: number, y: number, w: number, h: number) =>
  rect(x, y, w, h, 'sk-cam', 10) +
  person(x + w / 2, y + h * 0.56, Math.min(w, h) / 66)
export const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  cls = 'sk-card'
) => rect(x, y, w, h, cls, 7) + label(x + w / 2, y + h / 2 + 3, text)
/**
 * A dot that travels a path between seconds a and b. It moves on a CSS motion
 * path rather than SVG's own clock, so a card that starts its sketch two
 * seconds in keeps the dot in step with everything else.
 */
export const traveller = (
  route: string,
  a: number,
  b: number,
  cls = 'sk-acc',
  r = 4
) =>
  group(
    motion.during(a - 0.05, b + 0.05),
    `<circle r="${r}" class="${cls} ${motion.along(a, b)}" style="offset-path:path('${route}');offset-rotate:0deg"/>`
  )
export const tick = (x: number, y: number, cls: string) =>
  `<path d="M${x} ${y}l4 4 8-9" pathLength="1" class="sk-sok sk-draw ${cls}" stroke-linecap="round" stroke-linejoin="round"/>`
export const windowFrame = (x: number, y: number, w: number, h: number) =>
  rect(x, y, w, h, 'sk-card', 8) +
  `<circle cx="${x + 9}" cy="${y + 8}" r="2.2" class="sk-bad"/><circle cx="${x + 16}" cy="${y + 8}" r="2.2" class="sk-warn"/><circle cx="${x + 23}" cy="${y + 8}" r="2.2" class="sk-ok"/>`
