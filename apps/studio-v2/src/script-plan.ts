// Script-first motion planning. The scene's script (what is said, beat by
// beat, with optional [directions]) is the source of truth; the page's
// units are matched to the beats by what the script names, and the motion
// is designed to fit the narrative: units enter when they are first spoken,
// re-mentions pop, focus beats dim the rest, tight beats move the camera in,
// connectors trace after the boxes they join. Pure: units in, plan out — the
// atomizer runs outside (it needs layout).
import {
  MOTION_DURATION_MS,
  MOTION_EASE_FOR,
  MOTION_STAGGER_MS,
  speechMs,
  stepsFromMotionPlan,
  type MotionAction,
  type MotionBeat,
  type MotionIntent,
  type MotionOp,
  type MotionPlanV2,
  type SlideStepV1,
} from 'markdown-composition'
import { inferEdges, leafUnits, suggestSteps, type SlideUnit } from './slide-atoms'

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
  // "[dim rest]" style — head carries the argument.
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
    const directions: ScriptDirection[] = []
    const spoken = lines
      .join(' ')
      .replace(/\[([^\]]+)\]/g, (_match, inner: string) => {
        const direction = parseDirection(inner)
        if (direction) directions.push(direction)
        return ' '
      })
      .replace(/\s+/g, ' ')
      .trim()
    return { index, title: title || titleFrom(spoken) || `Beat ${index + 1}`, text: spoken, directions }
  })
}

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
// Step numbers and bullets (1, 2, 3) just appear.
export const countable = (label: string) => {
  if (!NUMERIC_LABEL.test(label)) return false
  const match = /-?[\d,]+(\.\d+)?/.exec(label)
  if (!match) return false
  const value = Math.abs(Number(match[0].replace(/,/g, '')))
  const suffix = label.slice((match.index || 0) + match[0].length).trim()
  return value >= 10 || Boolean(match[1]) || suffix.length > 0
}

// ——— planning ———

type PlacedUnit = { unit: SlideUnit; beat: number; anchored: boolean; score: number }

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

export type ScriptPlanOptions = {
  viewBox: { width: number; height: number }
  // Camera moves in when a beat's units cover less than this share of the page.
  cameraShare?: number
}

export const planFromScript = (
  script: string,
  units: SlideUnit[],
  options: ScriptPlanOptions,
): ScriptPlanResult | null => {
  const beats = parseScript(script)
  if (!beats.length) return null
  const leaves = leafUnits(units).filter(unit => !unit.chrome)
  if (!leaves.length) return null
  const pageArea = options.viewBox.width * options.viewBox.height
  const cameraShare = options.cameraShare ?? 0.3
  const beatTokens = beats.map(beat => new Set(tokens(`${beat.title} ${beat.text}`)))
  const edges = inferEdges(units)
  const spread = tokenSpread(leaves.map(unit => unit.label))

  // 1. Where each unit is first spoken (anchored), and every later mention.
  const mentions = new Map<string, number[]>()
  const placed = new Map<string, PlacedUnit>()
  leaves.forEach(unit => {
    const hits: number[] = []
    let bestScore = 0
    beats.forEach((_beat, index) => {
      const score = matchScore(unit.label, beatTokens[index], spread)
      if (score >= MATCH_THRESHOLD) {
        hits.push(index)
        bestScore = Math.max(bestScore, score)
      }
    })
    if (hits.length) {
      mentions.set(unit.id, hits)
      placed.set(unit.id, { unit, beat: hits[0], anchored: true, score: bestScore })
    }
  })
  // Explicit [show:] / [hero:] directions anchor too, and win over prose.
  const unresolvedDirections: string[] = []
  beats.forEach(beat => {
    beat.directions
      .filter(direction => direction.kind === 'show' || direction.kind === 'hero' || direction.kind === 'count')
      .forEach(direction => {
        const named = unitsNamed(direction.args, leaves, spread)
        if (!named.length) {
          if (direction.args) unresolvedDirections.push(`[${direction.kind}: ${direction.args}]`)
          return
        }
        named.forEach(unit => {
          const current = placed.get(unit.id)
          if (!current || current.beat > beat.index || !current.anchored) {
            placed.set(unit.id, { unit, beat: beat.index, anchored: true, score: 1 })
          }
          const list = mentions.get(unit.id) || []
          if (!list.includes(beat.index)) mentions.set(unit.id, [...list, beat.index].sort((a, b) => a - b))
        })
      })
  })

  // 2. Connectors join the beat of the later endpoint they touch.
  const connectorEdge = new Map(edges.map(edge => [edge.connector.id, edge]))
  leaves
    .filter(unit => unit.kind === 'connector' && !placed.has(unit.id))
    .forEach(connector => {
      const edge = connectorEdge.get(connector.id)
      const ends = [edge?.source, edge?.target].filter((end): end is SlideUnit => Boolean(end))
      const beatsOfEnds = ends.map(end => placed.get(end.id)?.beat).filter((b): b is number => b !== undefined)
      if (beatsOfEnds.length) {
        placed.set(connector.id, { unit: connector, beat: Math.max(...beatsOfEnds), anchored: false, score: 0 })
      }
    })

  // 3. Everything else rides with its neighbour in story order (the page's
  // own build order), or the nearest earlier anchored beat.
  const storyOrder = suggestSteps(units).flatMap(step => step.reveals)
  const orderIndex = new Map(storyOrder.map((id, index) => [id, index]))
  const anchoredAny = [...placed.values()].some(entry => entry.anchored)
  const ordered = [...leaves].sort(
    (a, b) => (orderIndex.get(a.ids[0]) ?? 1e9) - (orderIndex.get(b.ids[0]) ?? 1e9),
  )
  if (anchoredAny) {
    // Unplaced runs between two anchors are spread evenly over the beats
    // those anchors span; a run before the first anchor spreads from the
    // first beat up to it; a run after the last anchor stays with it.
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
      const toBeat = nextBeat >= 0 ? nextBeat : previousBeat >= 0 ? previousBeat : beats.length - 1
      const span = Math.max(1, toBeat - fromBeat + 1)
      run.forEach((unit, k) => {
        const beat = Math.min(toBeat, fromBeat + Math.floor((k / run.length) * span))
        placed.set(unit.id, { unit, beat, anchored: false, score: 0 })
      })
      i = j
    }
  } else {
    // The script names nothing on the page: even story-order partition, so
    // the scene still moves — coverage says why it is flat.
    const per = Math.ceil(ordered.length / beats.length)
    ordered.forEach((unit, index) => {
      placed.set(unit.id, { unit, beat: Math.min(beats.length - 1, Math.floor(index / per)), anchored: false, score: 0 })
    })
  }

  // 4. Actions per beat.
  const visible = new Set<string>()
  const dimmedNow = new Set<string>()
  let cameraOnPage = true
  const unitById = new Map(leaves.map(unit => [unit.id, unit]))
  const planBeats: MotionBeat[] = beats.map((beat, index) => {
    const actions: MotionAction[] = []
    const entering = ordered.filter(unit => placed.get(unit.id)?.beat === index)
    const mentioned = leaves.filter(unit => (mentions.get(unit.id) || []).includes(index))
    const returning = mentioned.filter(unit => visible.has(unit.id) && !entering.includes(unit))
    const directions = beat.directions
    const named = (kind: ScriptDirectionKind) =>
      directions.filter(direction => direction.kind === kind).flatMap(direction => unitsNamed(direction.args, leaves, spread))
    let cursor = 0
    let intent: MotionIntent = index === 0 ? 'introduce' : 'locate'

    // Lift a previous focus before anything else.
    if (dimmedNow.size) {
      actions.push(action('undim', [...dimmedNow].flatMap(id => unitById.get(id)?.ids || []), 0, { implicit: true }))
      dimmedNow.clear()
    }

    // Boxes and labels enter first, connectors trace after them, numbers count.
    const bodies = entering.filter(unit => unit.kind !== 'connector' && !countable(unit.label))
    const numbers = entering.filter(unit => unit.kind !== 'connector' && countable(unit.label))
    const connectors = entering.filter(unit => unit.kind === 'connector')
    if (bodies.length) {
      const ids = bodies.flatMap(unit => unit.ids)
      const stagger = bodies.length > 6 ? 40 : MOTION_STAGGER_MS
      const durationMs = MOTION_DURATION_MS.reveal + stagger * Math.max(0, ids.length - 1)
      actions.push(action('reveal', ids, 0, { durationMs, value: { staggerMs: stagger } }))
      cursor = durationMs * 0.7
      intent = 'introduce'
    }
    if (numbers.length) {
      numbers.forEach((unit, i) => {
        actions.push(action('count', unit.ids, cursor + i * 120))
      })
      cursor += MOTION_DURATION_MS.count
      intent = 'quantify'
    }
    if (connectors.length) {
      const ids = connectors.flatMap(unit => unit.ids)
      const durationMs = MOTION_DURATION_MS.trace + 90 * Math.max(0, connectors.length - 1)
      actions.push(action('trace', ids, cursor, { durationMs, value: { staggerMs: 90 } }))
      cursor += durationMs
      intent = 'flow'
    }
    // Directed connections between two named units: an existing arrow traces,
    // otherwise a connector is synthesized.
    directions.filter(direction => direction.kind === 'connect').forEach(direction => {
      const [fromArg, toArg] = direction.args.split(/->|→|to\b/).map(part => part.trim())
      const from = unitsNamed(fromArg || '', leaves, spread)[0]
      const to = unitsNamed(toArg || '', leaves, spread)[0]
      if (!from || !to) {
        unresolvedDirections.push(`[connect: ${direction.args}]`)
        return
      }
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
      intent = 'relate'
    })

    // The hero: directed, else the best-scoring spoken unit of the beat.
    const heroDirected = named('hero')
    const spokenHere = [...entering, ...returning].filter(unit => placed.get(unit.id)?.anchored || mentioned.includes(unit))
    const hero =
      heroDirected[0] ||
      spokenHere.sort((a, b) => (placed.get(b.id)?.score || 0) - (placed.get(a.id)?.score || 0))[0] ||
      null
    // Re-mentions pop; the hero pops once its entrance has landed.
    const pops = new Set<string>()
    returning.forEach(unit => pops.add(unit.id))
    if (hero && (returning.includes(hero) || heroDirected.length || (entering.includes(hero) && entering.length > 2))) pops.add(hero.id)
    if (pops.size) {
      actions.push(
        action('emphasize', [...pops].flatMap(id => unitById.get(id)?.ids || []), cursor, {
          persistence: 'flourish',
        }),
      )
      if (!entering.length) intent = 'emphasize'
    }
    named('pulse').forEach(unit => actions.push(action('pulse', unit.ids, cursor, { persistence: 'flourish' })))

    // Focus: a beat that introduces nothing and speaks about a few visible
    // units dims the rest (or [dim rest] / [dim: X] says so).
    const dimDirections = directions.filter(direction => direction.kind === 'dim')
    let toDim: SlideUnit[] = []
    if (dimDirections.length) {
      const explicit = dimDirections.flatMap(direction => unitsNamed(direction.args, leaves, spread))
      toDim = explicit.length
        ? explicit
        : leaves.filter(unit => visible.has(unit.id) && !pops.has(unit.id) && !(hero && unit.id === hero.id))
    } else if (!entering.length && returning.length && returning.length <= 2 && visible.size - returning.length >= 3) {
      toDim = leaves.filter(unit => visible.has(unit.id) && !returning.includes(unit))
    }
    if (toDim.length) {
      actions.push(action('dim', toDim.flatMap(unit => unit.ids), 0, { value: { to: 0.35 } }))
      toDim.forEach(unit => dimmedNow.add(unit.id))
      intent = 'emphasize'
    }

    named('exit').forEach(unit => {
      actions.push(action('exit', unit.ids, cursor))
      visible.delete(unit.id)
    })

    entering.forEach(unit => visible.add(unit.id))

    // Camera: directed, or move in on a tight beat once the page is busy;
    // back to the page when the beat's units fall outside, or on the last beat.
    const cameraDirected = named('camera')
    const zoomOut = directions.some(direction => direction.kind === 'zoomout')
    const subject = cameraDirected.length ? cameraDirected : [...entering, ...returning]
    const focusBox = unionBox(subject)
    const tight = focusBox ? focusBox.width * focusBox.height < pageArea * cameraShare : false
    const wantsClose =
      !zoomOut &&
      index !== beats.length - 1 &&
      Boolean(focusBox) &&
      (cameraDirected.length > 0 || (tight && index > 0 && visible.size >= 4 && subject.length <= 3))
    if (wantsClose && focusBox) {
      actions.push(
        action('camera', [], Math.min(cursor, 200), {
          value: { x: focusBox.x, y: focusBox.y, width: focusBox.width, height: focusBox.height },
        }),
      )
      cameraOnPage = false
      if (intent === 'locate') intent = 'locate'
    } else if (!cameraOnPage) {
      actions.push(action('camera', [], 0, { implicit: true }))
      cameraOnPage = true
    }

    if (index === beats.length - 1 && !entering.length) intent = 'recap'

    const motionWindowMs = actions.reduce((max, item) => Math.max(max, item.startMs + item.durationMs), 0)
    const speech = speechMs(beat.text)
    const holdDirected = directions.some(direction => direction.kind === 'hold') ? 1_500 : 0
    return {
      id: `B${String(index + 1).padStart(2, '0')}`,
      title: beat.title,
      explanation: beat.text,
      intent,
      ...(hero ? { hero: hero.ids } : {}),
      actions,
      motionWindowMs,
      holdMs: Math.max(800, speech - motionWindowMs) + holdDirected,
    }
  })

  const plan: MotionPlanV2 = { version: 2, steps: planBeats }
  const coverageBeats = beats.map((beat, index) => {
    const matched = leaves
      .filter(unit => (mentions.get(unit.id) || []).includes(index))
      .map(unit => unit.label)
    const anchored =
      matched.length > 0 ||
      beat.directions.some(direction => ['open', 'speaker', 'hold', 'zoomout', 'takeover', 'panel'].includes(direction.kind))
    return { index, matched, anchored }
  })
  const inferredUnits = [...placed.values()].filter(entry => !entry.anchored && entry.unit.kind !== 'connector').map(entry => entry.unit.label)
  const anchoredCount = coverageBeats.filter(beat => beat.anchored).length
  return {
    plan,
    steps: stepsFromMotionPlan(plan),
    coverage: {
      beats: coverageBeats,
      inferredUnits,
      unresolvedDirections,
      score: Math.round((anchoredCount / beats.length) * 100) / 100,
    },
    beats,
  }
}

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
