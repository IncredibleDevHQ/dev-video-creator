// A drawn object's idle loop: what it does while it waits, as a Lottie icon
// does (lamps blink in turn, a ring breathes, a needle trembles). Quiver
// animates the drawing; here its loop is taken as CSS on the drawing's own
// parts, made finite and named for the object, and put on a wrapper around
// each part it moves, so the part's poses and the scene's own moves still
// apply to the part inside. Hyperframes seeks CSS animations, so the loop
// plays on the scene's clock like everything else.
import { svgElements } from './artwork-poses'

/** What Quiver is asked to animate: the object alive while it waits. */
export const idlePrompt = (
  role: string,
  parts: Array<{ id: string; what: string }>
) =>
  [
    `A subtle, seamless idle loop for this drawing of ${role.trim().replace(/\.$/, '') || 'an object'}: as in a Lottie icon, it is alive while it waits.`,
    parts.length
      ? `Bring its parts to life where it suits them: ${parts.map((part) => part.what).join('; ')}.`
      : '',
    'Small motions on a loop of two to four seconds: lights blink in turn, rings breathe, needles tremble, screens flicker, fans turn.',
    'Animate only opacity and transform, never colours. Keep every element, its id and its place: add no shapes, and keep the whole drawing in place.'
  ]
    .filter(Boolean)
    .join(' ')

export type IdleLoop = {
  /** The loop's CSS: its keyframes and the rules for its classes. */
  css: string
  /** Each element the loop moves, by its place in the drawing, and its classes. */
  classes: Array<{ index: number; names: string[] }>
}

// Only motion survives: the loop moves and fades parts, nothing else.
const RULE_PROPERTIES = new Set([
  'transform-origin',
  'transform-box',
  'animation',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode'
])
const FRAME_PROPERTIES = new Set(['transform', 'opacity'])
// A loop runs this many times: longer than any scene, and finite, as a
// seekable timeline needs.
const LOOPS = '999'

/** CSS as its top-level rules: what comes before each block, and the block. */
const rulesOf = (css: string) => {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Array<{ prelude: string; body: string }> = []
  let at = 0
  for (
    let open = text.indexOf('{', at);
    open >= 0;
    open = text.indexOf('{', at)
  ) {
    let depth = 1,
      index = open + 1
    for (; index < text.length && depth; index++)
      depth += text[index] === '{' ? 1 : text[index] === '}' ? -1 : 0
    rules.push({
      prelude: text.slice(at, open).trim(),
      body: text.slice(open + 1, index - 1)
    })
    at = index
  }
  return rules
}

const declarationsOf = (body: string, allowed: Set<string>) =>
  body
    .split(';')
    .map((item) => item.trim())
    .filter((item) => allowed.has(item.split(':')[0]?.trim().toLowerCase()))

/**
 * The loop a Quiver animation added to the drawing: the classes it put on
 * the drawing's elements (or the ids it named) and the CSS behind them,
 * when it kept the drawing's shapes. Its names take the object's.
 */
export const idleLoop = (
  drawing: string,
  animated: string,
  entity: string
): { loop?: IdleLoop; problem?: string } => {
  const base = svgElements(drawing)
  const shapes = svgElements(animated).filter(
    (element) => element.tag.toLowerCase() !== 'style'
  )
  if (
    shapes.length !== base.length ||
    shapes.some((element, index) => element.tag !== base[index].tag)
  )
    return { problem: 'it added, removed or regrouped shapes' }
  const css = [...animated.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
    .map((match) => match[1])
    .join('\n')
  const named = (name: string) =>
    name.startsWith(`${entity}-`) ? name : `${entity}-${name}`
  const rules = rulesOf(css)
  const frames = new Map(
    rules
      .filter((rule) => /^@(?:-webkit-)?keyframes\s/i.test(rule.prelude))
      .map((rule) => [rule.prelude.split(/\s+/)[1], rule])
  )
  const renamed = (value: string) =>
    value
      .replace(/\binfinite\b/g, LOOPS)
      .replace(/[\w-]+/g, (word) => (frames.has(word) ? named(word) : word))
  const byElement = new Map<number, Set<string>>()
  const kept: string[] = []
  const added = (index: number) => {
    const mine = (base[index].attrs.get('class') || '').split(/\s+/)
    return (shapes[index].attrs.get('class') || '')
      .split(/\s+/)
      .filter((name) => name && !mine.includes(name))
  }
  // A selector the loop wrote: a class it put on some elements, or one
  // element's id. Never the frame itself.
  const targetsOf = (selector: string) => {
    const id = /^#([\w-]+)$/.exec(selector)?.[1]
    if (id) {
      const index = shapes.findIndex(
        (element) => element.attrs.get('id') === id
      )
      return index > 0
        ? { name: `${entity}-idle-${index}`, indices: [index] }
        : null
    }
    const name = /^\.([\w-]+)$/.exec(selector)?.[1]
    if (!name) return null
    const indices = shapes
      .map((_, index) => index)
      .filter((index) => index > 0 && added(index).includes(name))
    return indices.length ? { name: named(name), indices } : null
  }
  for (const rule of rules) {
    if (rule.prelude.startsWith('@')) continue
    const targets = rule.prelude
      .split(',')
      .map((item) => targetsOf(item.trim()))
    if (!targets.length || targets.some((target) => !target)) continue
    const declarations = declarationsOf(rule.body, RULE_PROPERTIES)
    if (!declarations.some((item) => /^animation/i.test(item))) continue
    for (const target of targets as Array<{ name: string; indices: number[] }>)
      for (const index of target.indices) {
        if (!byElement.has(index)) byElement.set(index, new Set())
        byElement.get(index)!.add(target.name)
      }
    kept.push(
      `${(targets as Array<{ name: string }>).map((target) => `.${target.name}`).join(', ')} { ${declarations.map(renamed).join('; ')}; }`
    )
  }
  // An animation written on the element itself counts the same.
  shapes.forEach((element, index) => {
    if (index === 0) return
    const style = element.attrs.get('style') || ''
    const own = base[index].attrs.get('style') || ''
    if (style === own || !/animation/i.test(style)) return
    const declarations = declarationsOf(style, RULE_PROPERTIES)
    if (!declarations.some((item) => /^animation/i.test(item))) return
    const name = `${entity}-idle-${index}-own`
    if (!byElement.has(index)) byElement.set(index, new Set())
    byElement.get(index)!.add(name)
    kept.push(`.${name} { ${declarations.map(renamed).join('; ')}; }`)
  })
  if (!kept.length)
    return { problem: 'it added no loop to the drawing’s parts' }
  for (const [name, rule] of frames) {
    const steps = rulesOf(rule.body)
      .map(
        (step) =>
          `${step.prelude} { ${declarationsOf(step.body, FRAME_PROPERTIES).join('; ')}; }`
      )
      .join(' ')
    kept.unshift(`@keyframes ${named(name)} { ${steps} }`)
  }
  return {
    loop: {
      css: kept.join('\n'),
      classes: [...byElement]
        .sort(([a], [b]) => a - b)
        .map(([index, names]) => ({ index, names: [...names] }))
    }
  }
}

const PAINT =
  /^(?:defs|lineargradient|radialgradient|pattern|clippath|mask|symbol|marker|filter)$/i

/**
 * The drawing with its loop on it: the CSS in its own <style>, and each part
 * the loop moves inside a wrapper that carries the loop's classes, so a pose
 * or a move of the part itself still shows. Inside gradients and other
 * paint, where no wrapper may go, the class goes on the element.
 */
export const withIdle = (svg: string, loop: IdleLoop) => {
  const elements = svgElements(svg)
  if (!elements.length) return svg
  type Op = { start: number; end: number; rank: number; text: string }
  const ops: Op[] = []
  const painted = (index: number): boolean => {
    for (let at = elements[index].parent; at >= 0; at = elements[at].parent)
      if (PAINT.test(elements[at].tag)) return true
    return false
  }
  for (const { index, names } of loop.classes) {
    const element = elements[index]
    if (!element || index === 0) continue
    if (painted(index) || PAINT.test(element.tag)) {
      const tag = svg.slice(element.at, element.at + element.length)
      const classed = / class\s*=\s*"([^"]*)"/.test(tag)
        ? tag.replace(
            / class\s*=\s*"([^"]*)"/,
            (_, own: string) => ` class="${`${own} ${names.join(' ')}`.trim()}"`
          )
        : tag.replace(/\s*(\/?)>$/, ` class="${names.join(' ')}"$1>`)
      ops.push({
        start: element.at,
        end: element.at + element.length,
        rank: 0,
        text: classed
      })
      continue
    }
    ops.push({
      start: element.at,
      end: element.at,
      rank: 1,
      text: `<g class="${names.join(' ')}" data-idle="">`
    })
    ops.push({ start: element.end, end: element.end, rank: 2, text: '</g>' })
  }
  const root = elements[0]
  ops.push({
    start: root.at + root.length,
    end: root.at + root.length,
    rank: 1,
    text: `<style>${loop.css}</style>`
  })
  // From the end, so each place is where it was; at one place, a tag's
  // change first, then wrappers opening, then wrappers closing before them.
  let out = svg
  for (const op of ops.sort((a, b) => b.start - a.start || a.rank - b.rank))
    out = out.slice(0, op.start) + op.text + out.slice(op.end)
  return out
}
