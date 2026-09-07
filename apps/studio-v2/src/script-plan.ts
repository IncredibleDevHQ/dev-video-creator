// Script-first motion planning. The scene's dialogue (what is said, window
// by window, with optional [directions]) is the source of truth; the page's
// units are matched to the windows by what is spoken — or assigned
// explicitly by id from a breakdown — and the motion is designed to fit the
// narrative: units enter when they are first spoken, re-mentions pop, focus
// windows dim the rest, tight windows move the camera in, connectors trace
// after the boxes they join. Pure: units in, plan out — the atomizer runs
// outside (it needs layout).
import {
  MOTION_DURATION_MS,
  MOTION_EASE_FOR,
  MOTION_STAGGER_MS,
  stepsFromMotionPlan,
  type MotionAction,
  type MotionBeat,
  type MotionIntent,
  type MotionOp,
  type MotionPlanV2,
  type SlideStepV1,
} from 'markdown-composition'
import { inferEdges, leafUnits, suggestSteps, type SlideEdge, type SlideUnit } from './slide-atoms'

export type ScriptDirectionKind =
  | 'hero' | 'camera' | 'zoomout' | 'connect' | 'dim' | 'exit' | 'show' | 'count' | 'pulse'
  | 'open' | 'speaker' | 'hold' | 'takeover' | 'panel'

export type ScriptDirection = { kind: ScriptDirectionKind; args: string }

export type ScriptBeat = {
  index: number
  title: string
  text: string
  directions: ScriptDirection[]
}

export type Granularity = 'paragraph' | 'sentence' | 'clause'
export type WindowLayout = 'page' | 'beside' | 'me'

// A window of attention: one stretch of dialogue and what it is about, by
// unit id. The breakdown stage produces these (model or local); the planner
// consumes them; the UI edits them.
export type SceneWindow = {
  say: string
  title?: string
  parts: string[]
  hero?: string
  camera?: string[]
  layout?: WindowLayout
  intent?: MotionIntent
  // Parts chosen by hand: they stay when the words change.
  pinned?: boolean
}

export type PaceSettings = { granularity: Granularity; wpm: number }
export const DEFAULT_PACE: PaceSettings = { granularity: 'sentence', wpm: 150 }

export type ScriptCoverage = {
  beats: Array<{ index: number; matched: string[]; anchored: boolean }>
  // Units placed by neighbourhood, not by the script.
  inferredUnits: string[]
  unresolvedDirections: string[]
  score: number
}

export type ScriptPlanResult = {
  plan: MotionPlanV2
  steps: SlideStepV1[]
  coverage: ScriptCoverage
  beats: ScriptBeat[]
  windows: SceneWindow[]
}

// ——— script parsing ———

const DIRECTION_ALIASES: Array<[RegExp, ScriptDirectionKind]> = [
  [/^(hero|focus)$/i, 'hero'],
  [/^(camera|zoom|zoom in|push in|close on)$/i, 'camera'],
  [/^(zoom out|pull out|wide|full page|whole page)$/i, 'zoomout'],
  [/^(connect|link|join)$/i, 'connect'],
  [/^(dim|dim rest|dim others|fade rest)$/i, 'dim'],
  [/^(exit|remove|clear|drop)$/i, 'exit'],
  [/^(show|reveal|bring in|bring up)$/i, 'show'],
  [/^(count|count up|number)$/i, 'count'],
  [/^(pulse|blink)$/i, 'pulse'],
  [/^(open on me|on me|on camera|to camera|back to me|me)$/i, 'open'],
  [/^(speaker|voice)$/i, 'speaker'],
  [/^(hold|pause|beat)$/i, 'hold'],
  [/^(takeover|full screen|page full)$/i, 'takeover'],
  [/^(panel|beside me|split)$/i, 'panel'],
]

const parseDirection = (raw: string): ScriptDirection | null => {
  const text = raw.trim()
  if (!text) return null
  const colon = text.indexOf(':')
  const head = (colon >= 0 ? text.slice(0, colon) : text).trim()
  const args = (colon >= 0 ? text.slice(colon + 1) : '').trim()
  for (const [pattern, kind] of DIRECTION_ALIASES) {
    if (pattern.test(head)) return { kind, args }
  }
  const words = head.split(/\s+/)
  if (words.length > 1) {
    const nested = parseDirection(`${words[0]}: ${words.slice(1).join(' ')}`)
    if (nested) return nested
  }
  return null
}

const titleFrom = (text: string) => {
  const words = text.replace(/[“”"]/g, '').split(/\s+/).filter(Boolean)
  const short = words.slice(0, 6).join(' ')
  return (words.length > 6 ? `${short}…` : short).replace(/[,.;:]$/, '')
}

const liftDirections = (raw: string) => {
  const directions: ScriptDirection[] = []
  const text = raw
    .replace(/\[([^\]]+)\]/g, (_match, inner: string) => {
      const direction = parseDirection(inner)
      if (direction) directions.push(direction)
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
  return { text, directions }
}

/**
 * Beats are paragraphs. A short first line ending with ":" or wrapped in
 * ** ** or starting with # is the beat's title; [directions] are lifted out
 * of the spoken text.
 */
export const parseScript = (script: string): ScriptBeat[] => {
  const paragraphs = String(script || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean)
  return paragraphs.map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    let title = ''
    const first = lines[0] || ''
    const heading = /^(#{1,3}\s+|\*\*)(.+?)(\*\*)?\s*:?$/.exec(first)
    if (heading && lines.length > 1) {
      title = heading[2].trim()
      lines.shift()
    } else if (/^[^.!?]{2,48}:$/.test(first) && lines.length > 1) {
      title = first.slice(0, -1).trim()
      lines.shift()
    }
    const { text, directions } = liftDirections(lines.join(' '))
    return { index, title: title || titleFrom(text) || `Beat ${index + 1}`, text, directions }
  })
}

// Sentence boundaries: end punctuation (with closing quotes) followed by a
// space and a capital, digit or quote. Abbreviations like "e.g." survive
// because they are followed by lowercase.
const SENTENCE_SPLIT = /(?<=[.!?…][”"’)]?)\s+(?=[“"(A-Z0-9])/
// Clause boundaries inside a sentence: dashes, semicolons, colons, and a
// comma before a conjunction — only when both sides carry a few words.
const CLAUSE_SPLIT = /\s+[—–]\s+|;\s+|:\s+|,\s+(?=(?:and|but|so|then|while|because|which|where|when)\b)/

const splitKeepingDirections = (raw: string, splitter: RegExp, minWords: number) => {
  // Split on the raw text (directions still in place) so a direction stays
  // with the sentence it was written in.
  const pieces = raw.split(splitter).map(piece => piece.trim()).filter(Boolean)
  const merged: string[] = []
  pieces.forEach(piece => {
    const words = liftDirections(piece).text.split(/\s+/).filter(Boolean).length
    if (merged.length && words < minWords) merged[merged.length - 1] = `${merged[merged.length - 1]} ${piece}`
    else merged.push(piece)
  })
  return merged
}

/** Windows of attention at the chosen granularity. */
export const splitWindows = (script: string, granularity: Granularity): ScriptBeat[] => {
  const paragraphs = parseScript(script)
  if (granularity === 'paragraph') return paragraphs
  // Re-split from the raw paragraphs so directions land in the right piece.
  const rawParagraphs = String(script || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean)
  const beats: ScriptBeat[] = []
  rawParagraphs.forEach((block, paragraphIndex) => {
    const paragraph = paragraphs[paragraphIndex]
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    const first = lines[0] || ''
    const hasTitle =
      lines.length > 1 && (/^(#{1,3}\s+|\*\*)(.+?)(\*\*)?\s*:?$/.test(first) || /^[^.!?]{2,48}:$/.test(first))
    const body = (hasTitle ? lines.slice(1) : lines).join(' ')
    let pieces = splitKeepingDirections(body, SENTENCE_SPLIT, 3)
    if (granularity === 'clause') pieces = pieces.flatMap(piece => splitKeepingDirections(piece, CLAUSE_SPLIT, 4))
    pieces.forEach((piece, pieceIndex) => {
      const { text, directions } = liftDirections(piece)
      if (!text) return
      beats.push({
        index: beats.length,
        title: pieceIndex === 0 && paragraph ? paragraph.title : titleFrom(text),
        text,
        directions,
      })
    })
  })
  return beats
}

// ——— pacing ———

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Speech time at a pace, with a breath at the start of every window. */
export const speechMsAt = (text: string, wpm: number) =>
  Math.max(1_200, Math.round((wordCount(text) / Math.max(80, wpm)) * 60_000) + 300)

export const estimateSeconds = (script: string, pace: PaceSettings) =>
  Math.round(splitWindows(script, pace.granularity).reduce((sum, beat) => sum + speechMsAt(beat.text, pace.wpm), 0) / 100) / 10

// ——— matching ———

const STOP = new Set(
  'the a an and or but of to in on at for from by with as is are was were be been it its this that these those we you they he she i our your their not no so then than into over under about up down out off just also very can will would could should may might one two three four five first second third next last each every all any some more most much many few less least here there where when what which who how why because while before after again still yet only own same other another such into onto'.split(' '),
)

const stem = (word: string) => {
  let w = word
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`
  else if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 3 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
  return w
}

export const tokens = (text: string) =>
  String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9%$€.+×-]+/)
    .map(token => token.replace(/^[.+-]+|[.+-]+$/g, ''))
    .filter(token => token && !STOP.has(token))
    .map(stem)

const GENERIC_LABEL = /^(shape|frame|image|circle|polygon|connector\s*#?\d*|u\d+)$/i
export const NUMERIC_LABEL = /^\s*[-+~≈]?\$?[\d,]+(\.\d+)?\s*[%\w$€#×x]*\s*$/

/** How many units on the page carry each token — common words weigh less. */
export const tokenSpread = (labels: string[]) => {
  const spread = new Map<string, number>()
  labels.forEach(label => {
    new Set(tokens(label)).forEach(token => spread.set(token, (spread.get(token) || 0) + 1))
  })
  return spread
}

/**
 * How much of the unit's label the beat speaks, 0..1, weighting each word by
 * its rarity on the page: a word every card shares counts little, a word
 * only this unit carries counts fully. A rare word of five letters or more
 * (or a number) matches on its own when it is at least a third of the label.
 */
export const matchScore = (unitLabel: string, beatTokens: Set<string>, spread?: Map<string, number>) => {
  if (GENERIC_LABEL.test(unitLabel.trim())) return 0
  const unitTokens = [...new Set(tokens(unitLabel))]
  if (!unitTokens.length) return 0
  const strong = unitTokens.filter(token => token.length >= 3 || /\d/.test(token))
  if (!strong.length) return 0
  const weight = (token: string) => 1 / Math.max(1, spread?.get(token) || 1)
  const hits = strong.filter(token => beatTokens.has(token))
  if (!hits.length) return 0
  const total = strong.reduce((sum, token) => sum + weight(token), 0)
  const matched = hits.reduce((sum, token) => sum + weight(token), 0)
  const precision = matched / total
  const rareHit = hits.some(token => weight(token) === 1 && (token.length >= 5 || /\d/.test(token)))
  if (rareHit && precision >= 1 / 3) return Math.max(precision, 0.6)
  return precision
}

const MATCH_THRESHOLD = 0.5

// A number worth counting up: ten or more, a decimal, or a unit after it.
// Step numbers, bullets (1, 2, 3) and years just appear.
export const countable = (label: string) => {
  if (!NUMERIC_LABEL.test(label)) return false
  const match = /-?[\d,]+(\.\d+)?/.exec(label)
  if (!match) return false
  const value = Math.abs(Number(match[0].replace(/,/g, '')))
  const suffix = label.slice((match.index || 0) + match[0].length).trim()
  if (!match[1] && !suffix && value >= 1900 && value <= 2100) return false
  return value >= 10 || Boolean(match[1]) || suffix.length > 0
}

/** Finds the units a direction argument names (best matches, ties kept). */
const unitsNamed = (args: string, candidates: SlideUnit[], spread?: Map<string, number>) => {
  const words = new Set(tokens(args))
  if (!words.size) return []
  const scored = candidates
    .map(unit => ({ unit, score: matchScore(unit.label, words, spread) }))
    .filter(entry => entry.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
  if (!scored.length) return []
  const best = scored[0].score
  return scored.filter(entry => entry.score >= best - 0.01).map(entry => entry.unit)
}

// ——— the shared plan builder ———

const unionBox = (units: SlideUnit[]) => {
  if (!units.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  units.forEach(({ bbox }) => {
    x0 = Math.min(x0, bbox.x); y0 = Math.min(y0, bbox.y)
    x1 = Math.max(x1, bbox.x + bbox.width); y1 = Math.max(y1, bbox.y + bbox.height)
  })
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

const action = (
  op: MotionOp,
  targets: string[],
  startMs: number,
  extra: Partial<MotionAction> = {},
): MotionAction => ({
  op,
  targets,
  startMs,
  durationMs: MOTION_DURATION_MS[op],
  ease: MOTION_EASE_FOR[op],
  persistence: 'state',
  ...extra,
})

// What one window asks of the page, resolved to units.
export type BeatSpec = {
  beat: ScriptBeat
  entering: SlideUnit[]
  mentioned: SlideUnit[]
  hero: SlideUnit | null
  // null = decide automatically; [] = stay on the page.
  camera: SlideUnit[] | null
  zoomOut: boolean
  dim: SlideUnit[] | null
  exits: SlideUnit[]
  pulses: SlideUnit[]
  connects: Array<[SlideUnit, SlideUnit]>
  hold: boolean
  layout?: WindowLayout
  intent?: MotionIntent
}

export type ScriptPlanOptions = {
  viewBox: { width: number; height: number }
  // Camera moves in when a beat's units cover less than this share of the page.
  cameraShare?: number
  wpm?: number
}

export const buildPlan = (specs: BeatSpec[], units: SlideUnit[], options: ScriptPlanOptions): MotionPlanV2 => {
  const pageArea = options.viewBox.width * options.viewBox.height
  const cameraShare = options.cameraShare ?? 0.3
  const wpm = options.wpm ?? DEFAULT_PACE.wpm
  const edges = inferEdges(units)
  const visible = new Set<string>()
  const dimmedNow = new Set<string>()
  let cameraOnPage = true
  const beats: MotionBeat[] = specs.map((spec, index) => {
    const { beat } = spec
    const actions: MotionAction[] = []
    const entering = spec.entering.filter(unit => !visible.has(unit.id))
    const returning = spec.mentioned.filter(unit => visible.has(unit.id) && !entering.includes(unit))
    let cursor = 0
    let intent: MotionIntent = spec.intent || (index === 0 ? 'introduce' : 'locate')

    if (dimmedNow.size) {
      const ids = [...dimmedNow].flatMap(id => units.length ? leafUnits(units).find(unit => unit.id === id)?.ids || [] : [])
      if (ids.length) actions.push(action('undim', ids, 0, { implicit: true }))
      dimmedNow.clear()
    }

    // Boxes and labels enter first (in rows, not one long wall), connectors
    // trace after them, numbers count.
    const bodies = entering.filter(unit => unit.kind !== 'connector' && !countable(unit.label))
    const numbers = entering.filter(unit => unit.kind !== 'connector' && countable(unit.label))
    const connectors = entering.filter(unit => unit.kind === 'connector')
    if (bodies.length) {
      const rows = rowsOf(bodies)
      rows.forEach((row, rowIndex) => {
        const ids = row.flatMap(unit => unit.ids)
        const stagger = ids.length > 8 ? 40 : MOTION_STAGGER_MS
        const durationMs = MOTION_DURATION_MS.reveal + stagger * Math.max(0, ids.length - 1)
        actions.push(action('reveal', ids, cursor, { durationMs, value: { staggerMs: stagger } }))
        cursor += rowIndex === rows.length - 1 ? durationMs * 0.7 : Math.min(durationMs, 260)
      })
      if (!spec.intent) intent = 'introduce'
    }
    if (numbers.length) {
      const ids = numbers.flatMap(unit => unit.ids)
      actions.push(action('count', ids, cursor, { durationMs: MOTION_DURATION_MS.count + 90 * Math.max(0, numbers.length - 1), value: { staggerMs: 90 } }))
      cursor += MOTION_DURATION_MS.count
      if (!spec.intent) intent = 'quantify'
    }
    if (connectors.length) {
      const ids = connectors.flatMap(unit => unit.ids)
      const durationMs = MOTION_DURATION_MS.trace + 90 * Math.max(0, connectors.length - 1)
      actions.push(action('trace', ids, cursor, { durationMs, value: { staggerMs: 90 } }))
      cursor += durationMs
      if (!spec.intent) intent = 'flow'
    }
    spec.connects.forEach(([from, to]) => {
      const existing = edges.find(edge =>
        (edge.source?.id === from.id && edge.target?.id === to.id) || (edge.source?.id === to.id && edge.target?.id === from.id),
      )
      if (existing && !visible.has(existing.connector.id) && !entering.includes(existing.connector)) {
        actions.push(action('trace', existing.connector.ids, cursor))
        visible.add(existing.connector.id)
      } else if (!existing) {
        actions.push(action('connect', [], cursor, { ports: { from: from.ids[0], to: to.ids[0] } }))
      }
      cursor += MOTION_DURATION_MS.connect
      if (!spec.intent) intent = 'relate'
    })

    // Re-mentions pop; the hero pops once its entrance has landed.
    const pops = new Set<string>()
    returning.forEach(unit => pops.add(unit.id))
    const hero = spec.hero
    if (hero && (returning.includes(hero) || (entering.includes(hero) && entering.length > 2) || (!entering.includes(hero) && visible.has(hero.id)))) pops.add(hero.id)
    if (pops.size) {
      actions.push(action('emphasize', [...pops].flatMap(id => unitById(units, id)?.ids || []), cursor, { persistence: 'flourish' }))
      if (!entering.length && !spec.intent) intent = 'emphasize'
    }
    spec.pulses.forEach(unit => actions.push(action('pulse', unit.ids, cursor, { persistence: 'flourish' })))

    // Focus: explicit, or a beat that introduces nothing and speaks about a
    // few visible units dims the rest.
    let toDim: SlideUnit[] = []
    if (spec.dim) {
      toDim = spec.dim.length
        ? spec.dim
        : leafUnits(units).filter(unit => visible.has(unit.id) && !pops.has(unit.id) && !(hero && unit.id === hero.id))
    } else if (!entering.length && returning.length && returning.length <= 2 && visible.size - returning.length >= 3) {
      toDim = leafUnits(units).filter(unit => visible.has(unit.id) && !returning.includes(unit))
    }
    if (toDim.length) {
      actions.push(action('dim', toDim.flatMap(unit => unit.ids), 0, { value: { to: 0.35 } }))
      toDim.forEach(unit => dimmedNow.add(unit.id))
      if (!spec.intent) intent = 'emphasize'
    }

    spec.exits.forEach(unit => {
      actions.push(action('exit', unit.ids, cursor))
      visible.delete(unit.id)
    })

    entering.forEach(unit => visible.add(unit.id))

    // Camera: directed, or move in on a tight beat once the page is busy;
    // back to the page when the beat's units fall outside, or on the last beat.
    // The frame grows to the visual block around the subject (lines of the
    // same paragraph, the box a label sits in) so nothing on screen is cut.
    const subject = spec.camera && spec.camera.length ? spec.camera : [...entering, ...returning]
    const onScreen = leafUnits(units).filter(unit => visible.has(unit.id))
    const focusBox = expandToBlock(unionBox(subject), onScreen)
    const tight = focusBox ? focusBox.width * focusBox.height < pageArea * cameraShare : false
    const directedClose = Boolean(spec.camera && spec.camera.length)
    const wantsClose =
      !spec.zoomOut &&
      !(spec.camera && spec.camera.length === 0) &&
      index !== specs.length - 1 &&
      Boolean(focusBox) &&
      (directedClose || (tight && index > 0 && visible.size >= 4 && subject.length <= 3 && spec.layout !== 'me'))
    if (wantsClose && focusBox) {
      actions.push(action('camera', [], Math.min(cursor, 200), { value: { x: focusBox.x, y: focusBox.y, width: focusBox.width, height: focusBox.height } }))
      cameraOnPage = false
    } else if (!cameraOnPage) {
      actions.push(action('camera', [], 0, { implicit: true }))
      cameraOnPage = true
    }

    if (index === specs.length - 1 && !entering.length && !spec.intent) intent = 'recap'

    const motionWindowMs = actions.reduce((max, item) => Math.max(max, item.startMs + item.durationMs), 0)
    const speech = speechMsAt(beat.text, wpm)
    return {
      id: `B${String(index + 1).padStart(2, '0')}`,
      title: beat.title,
      explanation: beat.text,
      intent,
      ...(hero ? { hero: hero.ids } : {}),
      actions,
      motionWindowMs,
      holdMs: Math.max(800, speech - motionWindowMs) + (spec.hold ? 1_500 : 0),
    }
  })
  return { version: 2, steps: beats }
}

const unitById = (units: SlideUnit[], id: string) => leafUnits(units).find(unit => unit.id === id) || null

/** Share of a unit's area that lies inside a rect grown by a margin. */
const insideShare = (unit: SlideUnit['bbox'], rect: SlideUnit['bbox'], margin: number) => {
  const x0 = Math.max(unit.x, rect.x - margin)
  const y0 = Math.max(unit.y, rect.y - margin)
  const x1 = Math.min(unit.x + unit.width, rect.x + rect.width + margin)
  const y1 = Math.min(unit.y + unit.height, rect.y + rect.height + margin)
  const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  return area / Math.max(1, unit.width * unit.height)
}

/**
 * Grows a focus rect to the visual block around it: on-screen units that
 * sit mostly inside the rect grown by a small margin (the next line of the
 * same paragraph, the box a label sits in) join it, over three rounds.
 * Connectors and frames never pull the frame along the page.
 */
const expandToBlock = (box: SlideUnit['bbox'] | null, onScreen: SlideUnit[]) => {
  if (!box) return null
  let rect = { ...box }
  const included = new Set<string>()
  for (let round = 0; round < 3; round += 1) {
    const margin = Math.max(24, Math.max(rect.width, rect.height) * 0.1)
    const touching = onScreen.filter(
      unit => !included.has(unit.id) && unit.kind !== 'frame' && unit.kind !== 'connector' && insideShare(unit.bbox, rect, margin) >= 0.5,
    )
    if (!touching.length) break
    touching.forEach(unit => included.add(unit.id))
    const grown = unionBox([{ bbox: rect } as SlideUnit, ...touching])
    if (!grown) break
    rect = grown
  }
  return rect
}

/** Groups units into visual rows (top to bottom), each row left to right. */
const rowsOf = (units: SlideUnit[]) => {
  const sorted = [...units].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
  const rows: SlideUnit[][] = []
  sorted.forEach(unit => {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last[0].bbox.y - unit.bbox.y) <= Math.max(24, last[0].bbox.height * 0.6)) last.push(unit)
    else rows.push([unit])
  })
  return rows.map(row => row.sort((a, b) => a.bbox.x - b.bbox.x))
}

// ——— placement from prose ———

type Placement = { unit: SlideUnit; beat: number; anchored: boolean; score: number }

type PlacementOptions = {
  // Beats that never receive filler (a window that belongs to the presenter).
  excluded?: Set<number>
  // Where parts nobody names end up: spread over the beats between anchors
  // (prose), or settled quietly into the last content beat (breakdown).
  trailing?: 'spread' | 'last'
}

const placeUnits = (
  beats: ScriptBeat[],
  units: SlideUnit[],
  explicit: Map<string, number[]>,
  placement: PlacementOptions = {},
): { placed: Map<string, Placement>; mentions: Map<string, number[]>; ordered: SlideUnit[]; anchoredAny: boolean } => {
  const leaves = leafUnits(units).filter(unit => !unit.chrome)
  const beatTokens = beats.map(beat => new Set(tokens(`${beat.title} ${beat.text}`)))
  const spread = tokenSpread(leaves.map(unit => unit.label))
  const edges = inferEdges(units)
  const mentions = new Map<string, number[]>()
  const placed = new Map<string, Placement>()
  leaves.forEach(unit => {
    const hits: number[] = []
    let bestScore = 0
    beats.forEach((_beat, index) => {
      // A presenter window never anchors page parts by its words.
      if (placement.excluded?.has(index)) return
      const score = matchScore(unit.label, beatTokens[index], spread)
      if (score >= MATCH_THRESHOLD) {
        hits.push(index)
        bestScore = Math.max(bestScore, score)
      }
    })
    const named = explicit.get(unit.id) || []
    const all = [...new Set([...hits, ...named])].sort((a, b) => a - b)
    if (all.length) {
      mentions.set(unit.id, all)
      placed.set(unit.id, { unit, beat: all[0], anchored: true, score: named.length ? 1 : bestScore })
    }
  })
  // Connectors join the beat of the later endpoint they touch.
  const connectorEdge = new Map(edges.map(edge => [edge.connector.id, edge]))
  leaves
    .filter(unit => unit.kind === 'connector' && !placed.has(unit.id))
    .forEach(connector => {
      const edge = connectorEdge.get(connector.id)
      const ends = [edge?.source, edge?.target].filter((end): end is SlideUnit => Boolean(end))
      const beatsOfEnds = ends.map(end => placed.get(end.id)?.beat).filter((b): b is number => b !== undefined)
      if (beatsOfEnds.length) placed.set(connector.id, { unit: connector, beat: Math.max(...beatsOfEnds), anchored: false, score: 0 })
    })
  // Everything else rides in story order: runs between anchors spread over
  // the beats those anchors span; a run before the first anchor spreads
  // from the first beat; a trailing run spreads over the remaining beats
  // (the last beat stays clear when there are three or more).
  const storyOrder = suggestSteps(units).flatMap(step => step.reveals)
  const orderIndex = new Map(storyOrder.map((id, index) => [id, index]))
  const ordered = [...leaves].sort((a, b) => (orderIndex.get(a.ids[0]) ?? 1e9) - (orderIndex.get(b.ids[0]) ?? 1e9))
  const anchoredAny = [...placed.values()].some(entry => entry.anchored)
  if (anchoredAny) {
    // A focus beat speaks only about parts already on screen: it gets no
    // filler, so its dim-the-rest reads clean.
    const firstBeatOf = new Map([...placed.values()].filter(entry => entry.anchored).map(entry => [entry.unit.id, entry.beat]))
    const focusBeat = beats.map((_beat, index) => {
      const spoken = [...mentions.entries()].filter(([, list]) => list.includes(index))
      if (!spoken.length) return false
      return spoken.every(([id]) => (firstBeatOf.get(id) ?? index) < index)
    })
    const anchorsAt = ordered.map(unit => placed.get(unit.id)?.beat ?? -1)
    let i = 0
    while (i < ordered.length) {
      if (anchorsAt[i] >= 0) { i += 1; continue }
      let j = i
      while (j < ordered.length && anchorsAt[j] < 0) j += 1
      const run = ordered.slice(i, j)
      const previousBeat = i > 0 ? Math.max(...anchorsAt.slice(0, i).filter(b => b >= 0)) : -1
      const nextBeat = j < ordered.length ? anchorsAt[j] : -1
      const fromBeat = previousBeat >= 0 ? previousBeat : 0
      let toBeat: number
      if (nextBeat >= 0) toBeat = nextBeat
      else if (previousBeat < 0) toBeat = beats.length - 1
      else toBeat = beats.length >= 3 ? Math.max(previousBeat, beats.length - 2) : beats.length - 1
      const excluded = placement.excluded || new Set<number>()
      let allowed: number[] = []
      for (let b = fromBeat; b <= toBeat; b += 1) if (!focusBeat[b] && !excluded.has(b)) allowed.push(b)
      if (nextBeat < 0 && placement.trailing === 'last' && allowed.length) allowed = [allowed[allowed.length - 1]]
      if (!allowed.length) {
        // Every candidate is a presenter or focus window: the nearest content
        // beat before, else the first content beat after.
        for (let b = fromBeat; b >= 0 && !allowed.length; b -= 1) if (!excluded.has(b)) allowed = [b]
        for (let b = toBeat; b < beats.length && !allowed.length; b += 1) if (!excluded.has(b)) allowed = [b]
        if (!allowed.length) allowed = [fromBeat]
      }
      const slots = allowed
      run.forEach((unit, k) => {
        const beat = slots[Math.min(slots.length - 1, Math.floor((k / run.length) * slots.length))]
        placed.set(unit.id, { unit, beat, anchored: false, score: 0 })
      })
      i = j
    }
  } else {
    const excluded = placement.excluded || new Set<number>()
    const content = beats.map((_beat, index) => index).filter(index => !excluded.has(index))
    const slots = content.length ? content : beats.map((_beat, index) => index)
    const per = Math.ceil(ordered.length / Math.max(1, slots.length))
    ordered.forEach((unit, index) => {
      placed.set(unit.id, { unit, beat: slots[Math.min(slots.length - 1, Math.floor(index / per))], anchored: false, score: 0 })
    })
  }
  return { placed, mentions, ordered, anchoredAny }
}

const specsFromPlacement = (
  beats: ScriptBeat[],
  units: SlideUnit[],
  placed: Map<string, Placement>,
  mentions: Map<string, number[]>,
  ordered: SlideUnit[],
  unresolved: string[],
  layouts: Array<WindowLayout | undefined> = [],
  heroes: Array<string | undefined> = [],
  cameras: Array<string[] | undefined> = [],
  intents: Array<MotionIntent | undefined> = [],
): BeatSpec[] => {
  const leaves = leafUnits(units).filter(unit => !unit.chrome)
  const spread = tokenSpread(leaves.map(unit => unit.label))
  return beats.map((beat, index) => {
    const entering = ordered.filter(unit => placed.get(unit.id)?.beat === index)
    const mentioned = leaves.filter(unit => (mentions.get(unit.id) || []).includes(index))
    const named = (kind: ScriptDirectionKind) =>
      beat.directions.filter(direction => direction.kind === kind).flatMap(direction => unitsNamed(direction.args, leaves, spread))
    const heroDirected = named('hero')
    const heroById = heroes[index] ? unitById(units, heroes[index]!) : null
    const spoken = [...entering, ...mentioned.filter(unit => !entering.includes(unit))].filter(unit => placed.get(unit.id)?.anchored || mentioned.includes(unit))
    const hero =
      heroById ||
      heroDirected[0] ||
      spoken.sort((a, b) => (placed.get(b.id)?.score || 0) - (placed.get(a.id)?.score || 0))[0] ||
      null
    const cameraDirected = named('camera')
    const cameraById = cameras[index] ? cameras[index]!.map(id => unitById(units, id)).filter((unit): unit is SlideUnit => Boolean(unit)) : null
    const dimDirections = beat.directions.filter(direction => direction.kind === 'dim')
    const dimExplicit = dimDirections.length ? dimDirections.flatMap(direction => unitsNamed(direction.args, leaves, spread)) : null
    const connects: Array<[SlideUnit, SlideUnit]> = []
    beat.directions.filter(direction => direction.kind === 'connect').forEach(direction => {
      const [fromArg, toArg] = direction.args.split(/->|→|\bto\b/).map(part => part.trim())
      const from = unitsNamed(fromArg || '', leaves, spread)[0]
      const to = unitsNamed(toArg || '', leaves, spread)[0]
      if (from && to) connects.push([from, to])
      else unresolved.push(`[connect: ${direction.args}]`)
    })
    const layoutDirected: WindowLayout | undefined = beat.directions.some(d => d.kind === 'open')
      ? 'me'
      : beat.directions.some(d => d.kind === 'panel')
        ? 'beside'
        : beat.directions.some(d => d.kind === 'takeover')
          ? 'page'
          : undefined
    return {
      beat,
      entering,
      mentioned,
      hero,
      camera: cameraById && cameras[index] !== undefined ? cameraById : cameraDirected.length ? cameraDirected : null,
      zoomOut: beat.directions.some(direction => direction.kind === 'zoomout'),
      dim: dimExplicit,
      exits: named('exit'),
      pulses: named('pulse'),
      connects,
      hold: beat.directions.some(direction => direction.kind === 'hold'),
      layout: layouts[index] || layoutDirected,
      intent: intents[index],
    }
  })
}

const coverageFor = (beats: ScriptBeat[], specs: BeatSpec[], placed: Map<string, Placement>, unresolved: string[]): ScriptCoverage => {
  const coverageBeats = beats.map((beat, index) => {
    const spec = specs[index]
    const matched = [...new Set([...spec.entering.filter(unit => placed.get(unit.id)?.anchored), ...spec.mentioned])].map(unit => unit.label)
    const anchored =
      matched.length > 0 ||
      spec.layout === 'me' ||
      beat.directions.some(direction => ['open', 'speaker', 'hold', 'zoomout', 'takeover', 'panel'].includes(direction.kind))
    return { index, matched, anchored }
  })
  const inferredUnits = [...placed.values()].filter(entry => !entry.anchored && entry.unit.kind !== 'connector').map(entry => entry.unit.label)
  const anchoredCount = coverageBeats.filter(beat => beat.anchored).length
  return {
    beats: coverageBeats,
    inferredUnits,
    unresolvedDirections: unresolved,
    score: beats.length ? Math.round((anchoredCount / beats.length) * 100) / 100 : 0,
  }
}

const windowsFromSpecs = (specs: BeatSpec[], placed: Map<string, Placement>): SceneWindow[] =>
  specs.map(spec => ({
    say: spec.beat.text,
    title: spec.beat.title,
    parts: [...new Set([...spec.entering, ...spec.mentioned].filter(unit => placed.get(unit.id)?.anchored || spec.mentioned.includes(unit)).map(unit => unit.id))],
    ...(spec.hero ? { hero: spec.hero.id } : {}),
    ...(spec.camera ? { camera: spec.camera.map(unit => unit.id) } : {}),
    ...(spec.layout ? { layout: spec.layout } : {}),
  }))

/** Plan from prose: the words decide which parts each window is about. */
export const planFromScript = (
  script: string,
  units: SlideUnit[],
  options: ScriptPlanOptions & { granularity?: Granularity },
): ScriptPlanResult | null => {
  const beats = options.granularity ? splitWindows(script, options.granularity) : parseScript(script)
  if (!beats.length) return null
  const leaves = leafUnits(units).filter(unit => !unit.chrome)
  if (!leaves.length) return null
  const spread = tokenSpread(leaves.map(unit => unit.label))
  // Explicit [show:] / [hero:] / [count:] directions anchor too, and win over prose.
  const explicit = new Map<string, number[]>()
  const unresolved: string[] = []
  beats.forEach(beat => {
    beat.directions
      .filter(direction => direction.kind === 'show' || direction.kind === 'hero' || direction.kind === 'count')
      .forEach(direction => {
        const named = unitsNamed(direction.args, leaves, spread)
        if (!named.length) {
          if (direction.args) unresolved.push(`[${direction.kind}: ${direction.args}]`)
          return
        }
        named.forEach(unit => explicit.set(unit.id, [...(explicit.get(unit.id) || []), beat.index]))
      })
  })
  const excluded = new Set(beats.filter(beat => beat.directions.some(direction => direction.kind === 'open')).map(beat => beat.index))
  const { placed, mentions, ordered } = placeUnits(beats, units, explicit, { excluded, trailing: 'spread' })
  const specs = specsFromPlacement(beats, units, placed, mentions, ordered, unresolved)
  const plan = buildPlan(specs, units, options)
  return {
    plan,
    steps: stepsFromMotionPlan(plan),
    coverage: coverageFor(beats, specs, placed, unresolved),
    beats,
    windows: windowsFromSpecs(specs, placed),
  }
}

/**
 * Plan from a breakdown: each window names its parts by id (from the model
 * or the user's edits); prose matching only fills what the windows leave
 * unplaced.
 */
export const planFromWindows = (
  windows: SceneWindow[],
  units: SlideUnit[],
  options: ScriptPlanOptions,
): ScriptPlanResult | null => {
  if (!windows.length) return null
  const leaves = leafUnits(units).filter(unit => !unit.chrome)
  if (!leaves.length) return null
  const beats: ScriptBeat[] = windows.map((window, index) => {
    const { text, directions } = liftDirections(window.say)
    return { index, title: window.title || titleFrom(text) || `Window ${index + 1}`, text, directions }
  })
  const explicit = new Map<string, number[]>()
  windows.forEach((window, index) => {
    ;[...window.parts, ...(window.hero ? [window.hero] : [])].forEach(id => {
      if (!leaves.some(unit => unit.id === id)) return
      explicit.set(id, [...(explicit.get(id) || []), index])
    })
  })
  const unresolved: string[] = []
  const excluded = new Set(windows.map((window, index) => (window.layout === 'me' ? index : -1)).filter(index => index >= 0))
  const { placed, mentions, ordered } = placeUnits(beats, units, explicit, { excluded, trailing: 'last' })
  const specs = specsFromPlacement(
    beats, units, placed, mentions, ordered, unresolved,
    windows.map(window => window.layout),
    windows.map(window => window.hero),
    windows.map(window => window.camera),
    windows.map(window => window.intent),
  )
  const plan = buildPlan(specs, units, options)
  return {
    plan,
    steps: stepsFromMotionPlan(plan),
    coverage: coverageFor(beats, specs, placed, unresolved),
    beats,
    windows: windows.map((window, index) => ({ ...window, say: beats[index].text, title: beats[index].title })),
  }
}

/** Connector relations for prompts: connector id → from / to unit ids. */
export const relationsOf = (units: SlideUnit[]) =>
  inferEdges(units)
    .filter((edge): edge is SlideEdge & { source: SlideUnit; target: SlideUnit } => Boolean(edge.source && edge.target))
    .map(edge => ({ connector: edge.connector.id, from: edge.source.id, to: edge.target.id }))

/** A script from existing beats (title + explanation), for scenes that predate scripts. */
export const scriptFromSteps = (steps: Array<{ title?: string; explanation?: string }>) =>
  steps
    .map(step => {
      const title = String(step.title || '').trim()
      const text = String(step.explanation || '').trim()
      if (!text) return title ? `${title}:\n${title}.` : ''
      return title && title !== titleFrom(text) ? `${title}:\n${text}` : text
    })
    .filter(Boolean)
    .join('\n\n')

/** Dialogue text from windows (one paragraph per window, titles kept). */
export const scriptFromWindows = (windows: SceneWindow[]) =>
  windows
    .map(window => {
      const say = window.say.trim()
      if (!say) return ''
      return window.title && window.title !== titleFrom(say) ? `${window.title}:\n${say}` : say
    })
    .filter(Boolean)
    .join('\n\n')
