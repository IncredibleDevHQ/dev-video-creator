// Poses of a drawn object: the states its moments change it into (a needle
// at the limit, a lamp lit, a gate shut). Quiver draws each one by editing
// the drawing itself, shape for shape. Here a pose is compared with its
// drawing, and every shape it changes carries the values it changes to,
// written so a tween reads them number for number. The scene's timeline then
// turns the drawing into a pose and back smoothly, seekable like the rest of
// it, through the app's pose player (pose-player.js).

import { readFile } from 'node:fs/promises'

/** Where a production loads the pose player from, beside its blocks. */
export const POSE_PLAYER = 'compositions/artwork-poses.js'
/** The pose player's code, as the production installs it. */
export const posePlayer = () =>
  readFile(new URL('./pose-player.js', import.meta.url), 'utf8')

/** One element of a drawing: its tag, nesting and attributes as written. */
type Element = {
  tag: string
  depth: number
  parent: number
  attrs: Map<string, string>
  /** Its start tag, where it is in the markup. */
  at: number
  length: number
  closed: boolean
  /** Where it ends: after its closing tag, or its start tag when empty. */
  end: number
}

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g
const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

/** A drawing's elements in document order, the root first. */
export const svgElements = (svg: string): Element[] => {
  const elements: Element[] = []
  const open: number[] = []
  for (const match of svg.matchAll(TOKEN)) {
    if (match[1]) {
      const closing = open.pop()
      if (closing !== undefined)
        elements[closing].end = match.index + match[0].length
      continue
    }
    if (!match[2]) continue
    const attrs = new Map<string, string>()
    for (const attribute of (match[3] || '').matchAll(ATTRIBUTE))
      attrs.set(
        attribute[1],
        (attribute[2] ?? attribute[3] ?? attribute[4] ?? '').replace(
          /"/g,
          '&quot;'
        )
      )
    elements.push({
      tag: match[2],
      depth: open.length,
      parent: open[open.length - 1] ?? -1,
      attrs,
      at: match.index,
      length: match[0].length,
      closed: match[4] === '/',
      end: match.index + match[0].length
    })
    if (match[4] !== '/') open.push(elements.length - 1)
  }
  return elements
}

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g
const NUMBER_AT = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
/** A number as a tween writes it: plain, never in exponent form. */
const fmt = (value: number) => {
  const rounded = Math.round(value * 10000) / 10000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}
const shapeOf = (value: string) => value.replace(NUMBER, '#')
const numbered = (value: string) =>
  value.replace(NUMBER, (number) => fmt(Number(number)))

const NAMED: Record<string, string> = {
  black: '0,0,0',
  white: '255,255,255',
  red: '255,0,0',
  lime: '0,255,0',
  green: '0,128,0',
  blue: '0,0,255',
  yellow: '255,255,0',
  orange: '255,165,0',
  gray: '128,128,128',
  grey: '128,128,128',
  silver: '192,192,192',
  navy: '0,0,128',
  teal: '0,128,128',
  purple: '128,0,128',
  maroon: '128,0,0',
  olive: '128,128,0',
  aqua: '0,255,255',
  cyan: '0,255,255',
  fuchsia: '255,0,255',
  magenta: '255,0,255'
}

/** A colour as rgba(), the one form a tween reads channel by channel. */
export const rgba = (value: string) => {
  const color = value.trim().toLowerCase()
  if (color === 'transparent') return 'rgba(0,0,0,0)'
  if (NAMED[color]) return `rgba(${NAMED[color]},1)`
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(color)?.[1]
  if (hex) {
    const full =
      hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
    const channel = (at: number) => parseInt(full.slice(at, at + 2), 16)
    return `rgba(${channel(0)},${channel(2)},${channel(4)},${full.length === 8 ? fmt(channel(6) / 255) : 1})`
  }
  const parts =
    /^rgba?\(\s*([\d.]+)(%?)\s*[\s,]\s*([\d.]+)(%?)\s*[\s,]\s*([\d.]+)(%?)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(
      color
    )
  if (!parts) return null
  const channel = (number: string, percent: string) =>
    fmt(percent ? Number(number) * 2.55 : Number(number))
  const alpha =
    parts[7] === undefined
      ? 1
      : fmt(parts[8] ? Number(parts[7]) / 100 : Number(parts[7]))
  return `rgba(${channel(parts[1], parts[2])},${channel(parts[3], parts[4])},${channel(parts[5], parts[6])},${alpha})`
}

type Step = { name: string; args: number[] }
type Matrix = [number, number, number, number, number, number]
const STEP = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
const ARITY: Record<string, number[]> = {
  matrix: [6],
  translate: [1, 2],
  scale: [1, 2],
  rotate: [1, 3],
  skewX: [1],
  skewY: [1]
}

/** A transform's steps, or null when it holds anything else. */
const stepsOf = (value: string): Step[] | null => {
  if (value.replace(STEP, '').replace(/[\s,]/g, '')) return null
  const steps = [...value.matchAll(STEP)].map((match) => ({
    name: match[1],
    args: (match[2].match(NUMBER) || []).map(Number)
  }))
  return steps.every((step) => ARITY[step.name].includes(step.args.length))
    ? steps
    : null
}
const stepsText = (steps: Step[]) =>
  steps.map((step) => `${step.name}(${step.args.map(fmt).join(' ')})`).join(' ')
const stepsShape = (steps: Step[]) =>
  steps.map((step) => `${step.name}${step.args.length}`).join(' ')
/** The same steps doing nothing: a turn of 0 about the same pivot. */
const stillSteps = (steps: Step[]): Step[] =>
  steps.map((step) => ({
    name: step.name,
    args:
      step.name === 'matrix'
        ? [1, 0, 0, 1, 0, 0]
        : step.name === 'scale'
          ? step.args.map(() => 1)
          : step.name === 'rotate'
            ? [0, ...step.args.slice(1)]
            : step.args.map(() => 0)
  }))
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
]
const matrixOf = (steps: Step[]) =>
  steps.reduce<Matrix>(
    (matrix, { name, args: [a, b, c, d, e, f] }) => {
      const angle = (a * Math.PI) / 180
      const step: Matrix =
        name === 'matrix'
          ? [a, b, c, d, e, f]
          : name === 'translate'
            ? [1, 0, 0, 1, a, b ?? 0]
            : name === 'scale'
              ? [a, 0, 0, b ?? a, 0, 0]
              : name === 'skewX'
                ? [1, 0, Math.tan(angle), 1, 0, 0]
                : name === 'skewY'
                  ? [1, Math.tan(angle), 0, 1, 0, 0]
                  : [
                      Math.cos(angle),
                      Math.sin(angle),
                      -Math.sin(angle),
                      Math.cos(angle),
                      0,
                      0
                    ]
      // A turn about a pivot: there, turned, and back.
      const pivoted =
        name === 'rotate' && b !== undefined
          ? multiply(multiply([1, 0, 0, 1, b, c], step), [1, 0, 0, 1, -b, -c])
          : step
      return multiply(matrix, pivoted)
    },
    [1, 0, 0, 1, 0, 0]
  )
const matrixText = (steps: Step[]) =>
  `matrix(${matrixOf(steps).map(fmt).join(' ')})`

const PATH_ARGS: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0
}

/**
 * Path data with every number apart, and its shape: the commands and arc
 * flags as they are and each number as #. Two paths with one shape tween
 * point for point.
 */
export const pathForm = (d: string) => {
  const text: string[] = []
  const shape: string[] = []
  let at = 0
  let command = ''
  const space = () => {
    while (at < d.length && /[\s,]/.test(d[at])) at++
  }
  const read = (flag: boolean) => {
    space()
    if (flag) {
      const digit = d[at]
      if (digit !== '0' && digit !== '1') return false
      at++
      text.push(digit)
      shape.push(digit)
      return true
    }
    NUMBER_AT.lastIndex = at
    const match = NUMBER_AT.exec(d)
    if (!match) return false
    at += match[0].length
    text.push(fmt(Number(match[0])))
    shape.push('#')
    return true
  }
  for (space(); at < d.length; space()) {
    if (/[a-z]/i.test(d[at])) {
      command = d[at++]
      if (!(command.toLowerCase() in PATH_ARGS)) return null
      text.push(command)
      shape.push(command)
    } else if (!command || command.toLowerCase() === 'z') return null
    const count = PATH_ARGS[command.toLowerCase()]
    for (let index = 0; index < count; index++)
      if (!read(command.toLowerCase() === 'a' && (index === 3 || index === 4)))
        return null
  }
  return { text: text.join(' '), shape: shape.join(' ') }
}

const TRANSFORMS = new Set([
  'transform',
  'gradientTransform',
  'patternTransform'
])
const COLORS = new Set([
  'fill',
  'stroke',
  'stop-color',
  'flood-color',
  'lighting-color',
  'color'
])
/** Attributes that are numbers (or lists of them), tweened number for number. */
const NUMERIC = new Set([
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'width',
  'height',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stop-opacity',
  'stroke-width',
  'stroke-dashoffset',
  'stroke-dasharray',
  'stroke-miterlimit',
  'offset',
  'points',
  'font-size',
  'letter-spacing'
])
/** What an attribute a drawing leaves out means, when one side has it. */
const DEFAULTS: Record<string, string> = {
  opacity: '1',
  'fill-opacity': '1',
  'stroke-opacity': '1',
  'stop-opacity': '1',
  'stroke-width': '1',
  'stroke-dashoffset': '0',
  'stop-color': 'black',
  'flood-color': 'black',
  fill: 'inherit',
  stroke: 'inherit',
  filter: 'none',
  'clip-path': 'none',
  mask: 'none',
  visibility: 'visible',
  'stroke-dasharray': 'none'
}
const ignored = (name: string) =>
  name === 'id' ||
  name === 'style' ||
  name.startsWith('data-') ||
  name.startsWith('xmlns') ||
  name.startsWith('xml:')

/** What one pose does to one element. */
type PoseValues = {
  attr: Record<string, string>
  snap: Record<string, string>
  style: Record<string, string>
  snapStyle: Record<string, string>
}
const emptyValues = (): PoseValues => ({
  attr: {},
  snap: {},
  style: {},
  snapStyle: {}
})

/**
 * One attribute across the poses that change it: the value it states at
 * rest, and each pose's value, tweened when the two share a form and set
 * halfway through the change when they do not.
 */
const decide = (
  name: string,
  from: string | undefined,
  targets: Array<{ id: string; value: string | undefined }>
) => {
  const out: Array<{ id: string; value: string; tween: boolean }> = []
  if (TRANSFORMS.has(name)) {
    const lists = [from, ...targets.map((target) => target.value)].map(
      (value) => (value === undefined ? [] : stepsOf(value))
    )
    if (lists.every((list) => list !== null)) {
      const steps = lists as Step[][]
      const present = steps.filter((list) => list.length)
      const shared = new Set(present.map(stepsShape)).size <= 1
      const form = (list: Step[]) =>
        shared
          ? stepsText(list.length ? list : stillSteps(present[0]))
          : matrixText(list)
      targets.forEach((target, index) =>
        out.push({ id: target.id, value: form(steps[index + 1]), tween: true })
      )
      return { rest: form(steps[0]), out }
    }
  }
  const restText = from ?? DEFAULTS[name]
  if (restText === undefined) return { rest: undefined, out }
  let rest = restText
  if (COLORS.has(name) && rgba(restText)) rest = rgba(restText)!
  else if (name === 'd') rest = pathForm(restText)?.text ?? restText
  else if (NUMERIC.has(name)) rest = numbered(restText)
  for (const target of targets) {
    const value = target.value ?? DEFAULTS[name]
    if (value === undefined) continue
    let next: string | null = null
    if (COLORS.has(name)) next = rgba(restText) ? rgba(value) : null
    else if (name === 'd') {
      const [a, b] = [pathForm(restText), pathForm(value)]
      next = a && b && a.shape === b.shape ? b.text : null
    } else if (
      NUMERIC.has(name) &&
      /\d/.test(value) &&
      shapeOf(restText) === shapeOf(value)
    )
      next = numbered(value)
    out.push(
      next === null
        ? { id: target.id, value, tween: false }
        : { id: target.id, value: next, tween: true }
    )
  }
  return { rest, out }
}

const declarations = (style: string | undefined) =>
  new Map(
    (style || '')
      .replace(/&quot;/g, '"')
      .split(';')
      .map((item) => item.split(':'))
      .filter((pair) => pair.length >= 2 && pair[0].trim())
      .map(([key, ...value]) => [
        key.trim().toLowerCase(),
        value.join(':').trim()
      ])
  )
const tweensAsCss = (a: string, b: string) =>
  Boolean(rgba(a) && rgba(b)) ||
  (/^[-+]?[\d.]+(?:px|%)?$/.test(a) && /^[-+]?[\d.]+(?:px|%)?$/.test(b))

const styleText = (svg: string) =>
  [...svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .join('\n')

/** Why a pose cannot be tweened from its drawing, if it cannot. */
const structureProblems = (
  drawing: Element[],
  pose: Element[],
  drawingSvg: string,
  poseSvg: string
) => {
  const problems: string[] = []
  if (pose.length !== drawing.length)
    problems.push(
      `it has ${pose.length} elements where the drawing has ${drawing.length}: it added or removed shapes`
    )
  else {
    const at = drawing.findIndex(
      (element, index) =>
        element.tag !== pose[index].tag || element.depth !== pose[index].depth
    )
    if (at >= 0)
      problems.push(
        `its element ${at + 1} is a <${pose[at].tag}> where the drawing has a <${drawing[at].tag}>: it reordered or regrouped shapes`
      )
  }
  const box = (elements: Element[]) =>
    (elements[0]?.attrs.get('viewBox') || '').match(NUMBER)?.map(Number).join()
  if (box(drawing) !== box(pose)) problems.push('it changed the viewBox')
  if (styleText(drawingSvg) !== styleText(poseSvg))
    problems.push(
      'it changed the drawing’s <style> rules: change attributes instead'
    )
  return problems
}

export type PoseReport = {
  id: string
  /** Why it could not be tweened; empty when it can. */
  problems: string[]
  /** Every change tweens; otherwise some are set halfway through. */
  smooth: boolean
  /** The drawing's named parts it changes. */
  parts: string[]
  /** How many of the drawing's elements it changes. */
  shapes: number
}

const attributeText = (value: string) =>
  value.replace(/&(?!(?:[a-z]+|#\d+|#x[\da-f]+);)/gi, '&amp;')
const jsonAttribute = (value: unknown) =>
  JSON.stringify(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

/**
 * The drawing with its poses on it: each shape a pose changes states its
 * values at rest in a tweenable form (the same rendering) and carries
 * data-posed and, per pose, data-pose-<id> with the values it tweens or sets
 * to. Poses that cannot be tweened are reported and left off.
 */
export const posedDrawing = (
  svg: string,
  poses: Array<{ id: string; svg: string }>
) => {
  const drawing = svgElements(svg)
  const reports: PoseReport[] = []
  const usable: Array<{ id: string; elements: Element[] }> = []
  for (const pose of poses) {
    const elements = svgElements(pose.svg)
    const problems = structureProblems(drawing, elements, svg, pose.svg)
    // A pose may rename the drawing's ids; its references follow them back.
    const renamed = new Map<string, string>()
    if (!problems.length)
      elements.forEach((element, index) => {
        const [mine, theirs] = [
          drawing[index].attrs.get('id'),
          element.attrs.get('id')
        ]
        if (mine && theirs && mine !== theirs) renamed.set(theirs, mine)
      })
    for (const element of elements)
      for (const [name, value] of element.attrs)
        element.attrs.set(
          name,
          value.replace(
            /(url\(#|^#)([^)\s]+)/g,
            (whole, head: string, id: string) =>
              renamed.has(id) ? `${head}${renamed.get(id)}` : whole
          )
        )
    reports.push({ id: pose.id, problems, smooth: true, parts: [], shapes: 0 })
    if (!problems.length) usable.push({ id: pose.id, elements })
  }
  const edits = new Map<
    number,
    { rest: Map<string, string>; poses: Map<string, PoseValues> }
  >()
  const editOf = (index: number) => {
    if (!edits.has(index))
      edits.set(index, { rest: new Map(), poses: new Map() })
    return edits.get(index)!
  }
  const valuesOf = (index: number, id: string) => {
    const edit = editOf(index)
    if (!edit.poses.has(id)) edit.poses.set(id, emptyValues())
    return edit.poses.get(id)!
  }
  // The root is the frame, not a shape: it never changes.
  for (let index = 1; index < drawing.length; index++) {
    const element = drawing[index]
    const names = new Set<string>()
    for (const pose of usable)
      for (const name of [
        ...element.attrs.keys(),
        ...pose.elements[index].attrs.keys()
      ])
        if (!ignored(name)) names.add(name)
    for (const name of names) {
      const from = element.attrs.get(name)
      const targets = usable
        .map((pose) => ({
          id: pose.id,
          value: pose.elements[index].attrs.get(name)
        }))
        .filter((target) => target.value !== from)
      if (!targets.length) continue
      const { rest, out } = decide(name, from, targets)
      if (rest === undefined || !out.length) continue
      editOf(index).rest.set(name, rest)
      for (const change of out)
        valuesOf(index, change.id)[change.tween ? 'attr' : 'snap'][name] =
          change.value
    }
    // Inline styles tween as styles; the player reads them as they are.
    const style = declarations(element.attrs.get('style'))
    for (const pose of usable) {
      const theirs = declarations(pose.elements[index].attrs.get('style'))
      for (const property of new Set([...style.keys(), ...theirs.keys()])) {
        const [a, b] = [style.get(property) ?? '', theirs.get(property) ?? '']
        if (a === b) continue
        valuesOf(index, pose.id)[
          a && b && tweensAsCss(a, b) ? 'style' : 'snapStyle'
        ][property] = b
      }
    }
  }
  const partOf = (index: number): string | undefined =>
    index < 0
      ? undefined
      : (drawing[index].attrs.get('data-part') ?? partOf(drawing[index].parent))
  // A change inside a gradient or pattern shows on the shapes that paint
  // with it, so their parts change too.
  const paintedParts = (index: number): Array<string | undefined> => {
    for (let at = index; at >= 0; at = drawing[at].parent) {
      const id = drawing[at].attrs.get('id')
      if (!id || !/gradient|pattern/i.test(drawing[at].tag)) continue
      return drawing
        .map((element, user) => ({ element, user }))
        .filter(({ element }) =>
          ['fill', 'stroke'].some((name) =>
            element.attrs.get(name)?.includes(`url(#${id})`)
          )
        )
        .map(({ user }) => partOf(user))
    }
    return [partOf(index)]
  }
  for (const report of reports) {
    if (report.problems.length) continue
    const touched = [...edits].filter(([, edit]) => edit.poses.has(report.id))
    report.shapes = touched.length
    report.smooth = touched.every(([, edit]) => {
      const values = edit.poses.get(report.id)!
      return (
        !Object.keys(values.snap).length &&
        !Object.keys(values.snapStyle).length
      )
    })
    report.parts = [
      ...new Set(
        touched
          .flatMap(([index]) => paintedParts(index))
          .filter((part): part is string => Boolean(part))
      )
    ]
    if (!report.shapes) report.problems.push('it looks the same as the drawing')
  }
  let annotated = ''
  let cursor = 0
  for (const [index, edit] of [...edits].sort(([a], [b]) => a - b)) {
    const element = drawing[index]
    const attrs = new Map(element.attrs)
    for (const [name, value] of edit.rest) attrs.set(name, value)
    attrs.set('data-posed', '')
    for (const [id, values] of edit.poses)
      if (reports.find((report) => report.id === id)?.shapes)
        attrs.set(
          `data-pose-${id}`,
          jsonAttribute(
            Object.fromEntries(
              Object.entries(values).filter(
                ([, map]) => Object.keys(map).length
              )
            )
          )
        )
    annotated +=
      svg.slice(cursor, element.at) +
      `<${element.tag}${[...attrs]
        .map(([name, value]) => ` ${name}="${attributeText(value)}"`)
        .join('')}${element.closed ? '/' : ''}>`
    cursor = element.at + element.length
  }
  return { svg: annotated + svg.slice(cursor), poses: reports }
}

/** How many pops may overlap on one drawing, each scaling its own layer. */
const POP_LAYERS = 3
// A layer starts as drawn, said in full: a tween sought back before its pop
// restores what the layer had, and with nothing there it would hide it.
const POP_LAYER = '<g data-pose-layer="" transform="matrix(1 0 0 1 0 0)">'

/**
 * The drawing's content inside a group the scene may move as it likes, and
 * in it layers only the pose player moves: each pop as a pose arrives scales
 * one of them, so a pop never touches a scale the scene gives the drawing,
 * pops that overlap add up, and every seek of the timeline shows the same
 * frame. An idle loop's style stays first.
 */
export const withPop = (svg: string) => {
  const open = /<svg\b[^>]*>/i.exec(svg)
  const close = svg.search(/<\/svg\s*>\s*$/i)
  if (!open || open[0].endsWith('/>') || close < 0) return svg
  let at = open.index + open[0].length
  const style = /^\s*<style\b[^>]*>[\s\S]*?<\/style\s*>/i.exec(svg.slice(at))
  if (style) at += style[0].length
  return `${svg.slice(0, at)}<g data-pose-pop="">${POP_LAYER.repeat(POP_LAYERS)}${svg.slice(at, close)}${'</g>'.repeat(POP_LAYERS)}</g>${svg.slice(close)}`
}
