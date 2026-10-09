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
  /**
   * What the loop moves, by place in the drawing, and its classes: one
   * element, or a run of siblings from `index` to `last` that the animation
   * grouped to move together.
   */
  classes: Array<{ index: number; last?: number; names: string[] }>
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
  const full = svgElements(animated)
  const baseIds = new Set(base.map((element) => element.attrs.get('id')))
  // Each of the animation's elements matched to the drawing's, in order:
  // the same tag at the same depth, one level deeper inside each group the
  // animation added to move shapes together (a wrapper: a group with an id
  // the drawing does not have, or one where the drawing has another shape).
  const match = new Map<number, number>()
  const wrappers = new Set<number>()
  const deeper = (at: number) => {
    let levels = 0
    for (let up = full[at].parent; up >= 0; up = full[up].parent)
      if (wrappers.has(up)) levels++
    return levels
  }
  let next = 0
  for (let at = 0; at < full.length; at++) {
    const element = full[at]
    if (element.tag.toLowerCase() === 'style') continue
    const mine = base[next]
    const fits =
      mine !== undefined &&
      element.tag === mine.tag &&
      element.depth - deeper(at) === mine.depth
    const id = element.attrs.get('id')
    if (at > 0 && element.tag === 'g' && ((id && !baseIds.has(id)) || !fits)) {
      wrappers.add(at)
      continue
    }
    if (!fits) return { problem: 'it added, removed or regrouped shapes' }
    match.set(at, next++)
  }
  if (next !== base.length)
    return { problem: 'it added, removed or regrouped shapes' }
  const css = [...animated.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
    .map((found) => found[1])
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
  // Where an animation element sits in the drawing: itself, or for a
  // wrapper the run of siblings it holds (null when they are not a run).
  const placeOf = (at: number): { index: number; last: number } | null => {
    if (match.has(at)) return { index: match.get(at)!, last: match.get(at)! }
    const inside = full
      .map((_, child) => child)
      .filter(
        (child) =>
          full[child].parent === at && full[child].tag.toLowerCase() !== 'style'
      )
      .map(placeOf)
    if (!inside.length || inside.some((place) => !place)) return null
    const places = inside as Array<{ index: number; last: number }>
    const index = Math.min(...places.map((place) => place.index))
    const last = Math.max(...places.map((place) => place.last))
    const level = base[index].parent
    const run = base
      .map((element, sibling) => ({ element, sibling }))
      .filter(
        ({ element, sibling }) =>
          element.parent === level && sibling >= index && sibling <= last
      )
    return base[last].parent === level &&
      run.every(({ sibling }) =>
        places.some((place) => sibling >= place.index && sibling <= place.last)
      )
      ? { index, last }
      : null
  }
  const added = (at: number) => {
    const mine = match.has(at)
      ? (base[match.get(at)!].attrs.get('class') || '').split(/\s+/)
      : []
    return (full[at].attrs.get('class') || '')
      .split(/\s+/)
      .filter((name) => name && !mine.includes(name))
  }
  const places = new Map<
    string,
    { index: number; last: number; names: Set<string> }
  >()
  const mark = (place: { index: number; last: number }, name: string) => {
    const key = `${place.index}:${place.last}`
    if (!places.has(key)) places.set(key, { ...place, names: new Set() })
    places.get(key)!.names.add(name)
  }
  const kept: string[] = []
  // A selector the loop wrote: a class it put on elements or groups, or one
  // element's id. Never the frame itself.
  const targetsOf = (selector: string) => {
    const id = /^#([\w-]+)$/.exec(selector)?.[1]
    const name = /^\.([\w-]+)$/.exec(selector)?.[1]
    const ats = id
      ? full
          .map((_, at) => at)
          .filter((at) => at > 0 && full[at].attrs.get('id') === id)
      : name
        ? full
            .map((_, at) => at)
            .filter((at) => at > 0 && added(at).includes(name))
        : []
    const found = ats.map(placeOf)
    if (!found.length || found.some((place) => !place)) return null
    return {
      // Named by its place in the drawing, which the animation does not change.
      name: id ? `${entity}-idle-${found[0]!.index}` : named(name!),
      places: found as Array<{ index: number; last: number }>
    }
  }
  for (const rule of rules) {
    if (rule.prelude.startsWith('@')) continue
    const targets = rule.prelude
      .split(',')
      .map((item) => targetsOf(item.trim()))
    if (!targets.length || targets.some((target) => !target)) continue
    const declarations = declarationsOf(rule.body, RULE_PROPERTIES)
    if (!declarations.some((item) => /^animation/i.test(item))) continue
    const sure = targets as Array<{
      name: string
      places: Array<{ index: number; last: number }>
    }>
    for (const target of sure)
      for (const place of target.places) mark(place, target.name)
    kept.push(
      `${sure.map((target) => `.${target.name}`).join(', ')} { ${declarations.map(renamed).join('; ')}; }`
    )
  }
  // An animation written on the element itself counts the same.
  full.forEach((element, at) => {
    if (at === 0 || element.tag.toLowerCase() === 'style') return
    const style = element.attrs.get('style') || ''
    const own = match.has(at)
      ? base[match.get(at)!].attrs.get('style') || ''
      : ''
    if (style === own || !/animation/i.test(style)) return
    const declarations = declarationsOf(style, RULE_PROPERTIES)
    const place = placeOf(at)
    if (!place || !declarations.some((item) => /^animation/i.test(item))) return
    const name = `${entity}-idle-${place.index}-own`
    mark(place, name)
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
      classes: [...places.values()]
        .sort((a, b) => a.index - b.index || b.last - a.last)
        .map(({ index, last, names }) => ({
          index,
          ...(last !== index ? { last } : {}),
          names: [...names]
        }))
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
  // A change at a place in the markup; `span` orders wrappers that start or
  // end at one place, so the outer one stays outside.
  type Op = {
    start: number
    end: number
    rank: number
    span: number
    text: string
  }
  const ops: Op[] = []
  const painted = (index: number): boolean => {
    for (let at = elements[index].parent; at >= 0; at = elements[at].parent)
      if (PAINT.test(elements[at].tag)) return true
    return false
  }
  for (const { index, last = index, names } of loop.classes) {
    const element = elements[index]
    if (!element || !elements[last] || index === 0) continue
    if (painted(index) || PAINT.test(element.tag)) {
      // No wrapper goes inside paint: one element takes the class itself.
      if (last !== index) continue
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
        span: 0,
        text: classed
      })
      continue
    }
    const span = last - index
    ops.push({
      start: element.at,
      end: element.at,
      rank: 1,
      span,
      text: `<g class="${names.join(' ')}" data-idle="">`
    })
    const close = elements[last].end
    ops.push({ start: close, end: close, rank: 2, span: -span, text: '</g>' })
  }
  const root = elements[0]
  ops.push({
    start: root.at + root.length,
    end: root.at + root.length,
    rank: 1,
    span: Number.MAX_SAFE_INTEGER,
    text: `<style>${loop.css}</style>`
  })
  // From the end, so each place is where it was. At one place: a tag's
  // change, then wrappers opening (inner before outer, so the outer one
  // ends up first), then wrappers closing (outer before inner).
  let out = svg
  for (const op of ops.sort(
    (a, b) => b.start - a.start || a.rank - b.rank || a.span - b.span
  ))
    out = out.slice(0, op.start) + op.text + out.slice(op.end)
  return out
}
