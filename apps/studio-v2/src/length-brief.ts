// The length judgement (Motion Core, step 0 of the script-first flow). Before
// a word is written, the director reads the picture and decides how much
// explanation it deserves: seconds, windows, words, which parts get their
// own window, which are named in passing, which are skipped — and why. The
// writer is told this plan; the beats then follow the explanation.
import { flattenUnits, leafUnits, type SlideUnit } from './slide-atoms'
import { classifyScene, type ArcRole, type SceneKind } from './director'
import { NUMERIC_LABEL } from './script-plan'

export type LengthDepth = 'skim' | 'walk' | 'deep'
export type CoverageTreatment = 'walk' | 'passing' | 'skip'
export type LengthBrief = {
  seconds: number
  range: [number, number]
  windows: number
  words: number
  depth: LengthDepth
  kind: SceneKind
  arcRole: ArcRole
  // What the page has that costs time, and the one-line judgement.
  reasons: string[]
  why: string
  // The walk, in order: what each stretch covers and roughly how long.
  outline: Array<{ label: string; parts: string[]; seconds: number }>
  // Every non-chrome part: its treatment and the reason.
  coverage: Array<{ id: string; label: string; treatment: CoverageTreatment; reason: string }>
}

export const LENGTH_DEPTHS: LengthDepth[] = ['skim', 'walk', 'deep']
export const DEPTH_LABELS: Record<LengthDepth, string> = { skim: 'Skim', walk: 'Walk', deep: 'Deep' }
const DEPTH_SCALE: Record<LengthDepth, number> = { skim: 0.6, walk: 1, deep: 1.5 }
// The scene's role in the arc: a hook earns the next minute quickly, an idea
// deserves room, a close lands and stops.
const ROLE_SCALE: Record<ArcRole, number> = { hook: 0.75, map: 0.9, build: 1, idea: 1.15, explain: 1, evidence: 1.05, close: 0.7 }
// A formula is a function-shaped expression, not a spec line like "N = 6".
const FORMULA = /\w\([^)]*\)\s*=|=\s*\w+\(|\b(softmax|sin|cos|exp|max)\(|[Σ√∑∏∫]|\^\(/i
const SECONDS_PER_WINDOW = 7.5
const MIN_SECONDS = 8
const MAX_SECONDS = 150

const words = (text: string) => text.split(/\s+/).filter(Boolean).length
const round1 = (value: number) => Math.round(value * 10) / 10
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const isText = (unit: SlideUnit) => unit.kind === 'label' || unit.kind === 'box'
const readable = (label: string) => /[A-Za-z]{2,}/.test(label) && label.length <= 48

// Reading order: top to bottom in bands, left to right within a band. Two
// things that share most of their height (columns side by side) read left
// to right whatever their tops.
const readingOrder = (a: SlideUnit, b: SlideUnit, band: number) => {
  const overlap = Math.min(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height) - Math.max(a.bbox.y, b.bbox.y)
  const shorter = Math.max(1, Math.min(a.bbox.height, b.bbox.height))
  if (overlap / shorter > 0.5) return a.bbox.x - b.bbox.x
  const rowA = Math.round(a.bbox.y / band)
  const rowB = Math.round(b.bbox.y / band)
  return rowA - rowB || a.bbox.x - b.bbox.x
}

export const lengthBriefFor = (
  units: SlideUnit[],
  viewBox: { width: number; height: number },
  options: { arcRole: ArcRole; depth?: LengthDepth; wpm?: number; kind?: SceneKind },
): LengthBrief => {
  const depth = options.depth || 'walk'
  const wpm = options.wpm || 150
  const classified = classifyScene(units)
  let kind = options.kind || classified.kind
  const allLeaves = flattenUnits(units).filter(unit => unit.kind !== 'group')
  const leaves = allLeaves.filter(unit => !unit.chrome)
  const boxes = leaves.filter(unit => unit.kind === 'box')
  const labels = leaves.filter(unit => unit.kind === 'label')
  const connectors = leaves.filter(unit => unit.kind === 'connector')
  const images = leaves.filter(unit => unit.kind === 'image')
  const texts = leaves.filter(isText)
  const numeric = texts.filter(unit => NUMERIC_LABEL.test(unit.label))
  const formulas = texts.filter(unit => FORMULA.test(unit.label) && words(unit.label) <= 14)
  const groups = units.filter(unit => unit.kind === 'group' && !unit.chrome && leafUnits([unit]).filter(leaf => !leaf.chrome && isText(leaf)).length >= 2)
  // Notes: long labels, with consecutive lines of one paragraph counted once.
  const noteLines = labels.filter(unit => words(unit.label) >= 6).sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y)
  const noteHeads: SlideUnit[] = []
  const continuation = new Set<string>()
  noteLines.forEach(line => {
    const head = noteHeads[noteHeads.length - 1]
    const last = head ? [...noteLines].filter(other => other === head || continuation.has(other.id)).filter(other => Math.abs(other.bbox.x - line.bbox.x) < viewBox.width * 0.03).sort((a, b) => b.bbox.y - a.bbox.y)[0] : null
    if (head && last && Math.abs(last.bbox.x - line.bbox.x) < viewBox.width * 0.03 && line.bbox.y - (last.bbox.y + last.bbox.height) < last.bbox.height * 1.2 && line.bbox.y > last.bbox.y) continuation.add(line.id)
    else noteHeads.push(line)
  })
  const notes = noteHeads
  const pageWords = texts.reduce((sum, unit) => sum + words(unit.label), 0)
  // Rows and grids the shapes alone do not reveal: numbered rows read as a
  // list; text in three or more columns and rows reads as a table.
  const rowNumbers = labels.filter(unit => /^\s*\d{1,2}\s*[.)]?\s*$/.test(unit.label))
  const clusters = (values: number[], tolerance: number) => {
    const sorted = [...values].sort((a, b) => a - b)
    let count = 0
    let last = -Infinity
    sorted.forEach(value => {
      if (value - last > tolerance) count += 1
      last = value
    })
    return count
  }
  const columns = clusters(texts.map(unit => unit.bbox.x), viewBox.width * 0.03)
  const rowsOfText = clusters(texts.map(unit => unit.bbox.y), viewBox.height * 0.025)
  // A table's cells are short; a page of formulas and prose with a plot is not a table.
  const shortTexts = texts.filter(unit => words(unit.label) <= 4)
  const gridLike = texts.length >= 9 && columns >= 3 && rowsOfText >= 3 && boxes.length <= 2 && connectors.length >= rowsOfText - 1 && shortTexts.length >= texts.length * 0.6 && notes.length <= 3
  const listLike = rowNumbers.length >= 3 || (groups.length >= 3 && boxes.length === 0 && connectors.length === 0)
  // Repeated boxes (four "Add & Norm") are named once and recognised after;
  // arrows are cheap and never outnumber the boxes they join.
  const uniqueBoxes = new Set(boxes.map(unit => unit.label.trim().toLowerCase())).size
  const arrowCount = Math.min(connectors.length, Math.max(uniqueBoxes, 1))
  const readingSeconds = pageWords / 2.4

  if (!options.kind) {
    if (gridLike && kind !== 'numbers') kind = 'table'
    else if (listLike && (kind === 'text' || kind === 'figure')) kind = 'list'
  }
  // The base budget, by what kind of page it is.
  const reasons: string[] = []
  let seconds: number
  switch (kind) {
    case 'title':
      seconds = 8 + Math.min(6, pageWords / 6)
      reasons.push('a title card')
      break
    case 'text':
      seconds = readingSeconds * 0.5 + 10
      reasons.push(`${pageWords} words to read`)
      break
    case 'list': {
      const rows = Math.max(rowNumbers.length, boxes.length, groups.length, 1)
      seconds = 6 + rows * 7 + 6
      reasons.push(`${rows} rows to walk`)
      break
    }
    case 'diagram':
      seconds = 6 + uniqueBoxes * 4 + arrowCount * 1.5 + 6
      reasons.push(`${uniqueBoxes} distinct boxes and ${connectors.length} arrows`)
      if (notes.length) {
        seconds += notes.length * 3.5
        reasons.push(`${notes.length} note${notes.length === 1 ? '' : 's'}`)
      }
      break
    case 'table': {
      const rows = Math.max(3, clusters(shortTexts.map(unit => unit.bbox.y), viewBox.height * 0.025) - 1)
      seconds = 6 + rows * 6 + 6
      reasons.push(`a table of ${rows} rows × ${columns} columns`)
      break
    }
    case 'numbers': {
      // A chart or a row of figures: a handful of numbers get quoted, the
      // rest are shape.
      const quoted = Math.min(8, numeric.length)
      seconds = 6 + quoted * 3 + Math.max(1, Math.floor(quoted / 3)) * 5 + 6
      reasons.push(`${numeric.length} numbers, ${quoted} to quote`)
      break
    }
    case 'figure':
    default:
      seconds = 14 + Math.min(8, labels.length)
      reasons.push(images.length ? 'a figure to describe' : 'a page to describe')
      break
  }
  if (formulas.length && kind !== 'numbers' && kind !== 'table') {
    const counted = Math.min(3, formulas.length)
    seconds += counted * 6
    reasons.push(`${formulas.length} formula${formulas.length === 1 ? '' : 's'}`)
  }
  const roleScale = ROLE_SCALE[options.arcRole]
  seconds = clamp(round1(seconds * roleScale * DEPTH_SCALE[depth]), MIN_SECONDS, MAX_SECONDS)
  const windowCount = Math.round(clamp(Math.round(seconds / SECONDS_PER_WINDOW), 2, 14))
  const wordBudget = Math.round((seconds / 60) * wpm)
  const range: [number, number] = [Math.round(seconds * 0.8), Math.round(seconds * 1.2)]

  // Coverage: which parts earn a window, which ride inside one, which are chrome.
  const band = Math.max(1, viewBox.height / 24)
  const small = viewBox.height * 0.025
  const coverage: LengthBrief['coverage'] = []
  const treat = (unit: SlideUnit, treatment: CoverageTreatment, reason: string) => coverage.push({ id: unit.id, label: unit.label, treatment, reason })
  allLeaves.filter(unit => unit.chrome).forEach(unit => treat(unit, 'skip', 'page chrome'))
  leaves.forEach(unit => {
    if (unit.kind === 'connector') treat(unit, 'passing', 'an arrow rides with the boxes it joins')
    else if (unit.kind === 'shape' || unit.kind === 'frame') treat(unit, 'skip', 'decoration')
    else if (unit.kind === 'image') treat(unit, 'walk', 'a picture to describe')
    else if (!readable(unit.label) && !NUMERIC_LABEL.test(unit.label)) treat(unit, 'skip', 'no words')
    else if (unit.kind === 'label' && words(unit.label) <= 2 && unit.bbox.height < small && !NUMERIC_LABEL.test(unit.label)) treat(unit, 'passing', 'a short caption')
    else if (continuation.has(unit.id)) treat(unit, 'passing', 'a line of the note above it')
    else treat(unit, 'walk', kind === 'title' ? 'the title' : unit.kind === 'box' ? 'a part of the page' : 'a line to say')
  })
  // The budget buys only so many walked parts: about six per window. The
  // smallest labels step back to "in passing" first.
  const walked = () => coverage.filter(entry => entry.treatment === 'walk')
  const room = windowCount * 6
  if (walked().length > room) {
    const byId = new Map(leaves.map(unit => [unit.id, unit]))
    walked()
      .map(entry => ({ entry, unit: byId.get(entry.id) }))
      .filter(({ unit }) => unit && unit.kind === 'label')
      .sort((a, b) => a.unit!.bbox.height - b.unit!.bbox.height)
      .slice(0, walked().length - room)
      .forEach(({ entry }) => {
        entry.treatment = 'passing'
        entry.reason = 'the budget is spent on larger parts'
      })
  }

  // The outline: an overview when there is enough to see, one stretch per
  // group in reading order, loose parts, notes, a takeaway.
  const walkedIds = new Set(walked().map(entry => entry.id))
  const outline: LengthBrief['outline'] = []
  const overview = leaves.length >= 6 && kind !== 'title'
  const takeaway = seconds >= 20 && kind !== 'title'
  const fixed = (overview ? 6 : 0) + (takeaway ? 5 : 0)
  const stretches: Array<{ label: string; parts: string[] }> = []
  const placed = new Set<string>()
  const sortedGroups = [...groups].sort((a, b) => readingOrder(a, b, band))
  sortedGroups.forEach((group, index) => {
    const parts = leafUnits([group]).filter(leaf => walkedIds.has(leaf.id) && !placed.has(leaf.id)).sort((a, b) => readingOrder(a, b, band))
    if (!parts.length) return
    parts.forEach(part => placed.add(part.id))
    const label = readable(group.label) && !/^u\d+$/.test(group.label) ? group.label : `${parts[0].label.split(/\s+/).slice(0, 3).join(' ')}…`
    stretches.push({ label: label || `Group ${index + 1}`, parts: parts.map(part => part.id) })
  })
  const loose = leaves.filter(leaf => walkedIds.has(leaf.id) && !placed.has(leaf.id)).sort((a, b) => readingOrder(a, b, band))
  const looseNotes = loose.filter(leaf => leaf.kind === 'label' && words(leaf.label) >= 6)
  const looseParts = loose.filter(leaf => !looseNotes.includes(leaf))
  if (looseParts.length) stretches.push({ label: kind === 'title' ? 'The title' : stretches.length ? 'The rest of the page' : 'The page', parts: looseParts.map(part => part.id) })
  if (looseNotes.length) stretches.push({ label: `${looseNotes.length} note${looseNotes.length === 1 ? '' : 's'}, one each`, parts: looseNotes.map(part => part.id) })
  const stretchParts = stretches.reduce((sum, stretch) => sum + stretch.parts.length, 0) || 1
  const spread = Math.max(0, seconds - fixed)
  if (overview) outline.push({ label: 'Overview', parts: [], seconds: 6 })
  stretches.forEach(stretch => outline.push({ label: stretch.label, parts: stretch.parts, seconds: Math.max(3, Math.round((spread * stretch.parts.length) / stretchParts)) }))
  if (takeaway) outline.push({ label: 'Takeaway', parts: [], seconds: 5 })

  const judgement =
    kind === 'diagram' ? 'a diagram to walk, not to skim' : kind === 'list' ? 'a list to walk row by row' : kind === 'numbers' || kind === 'table' ? 'numbers to quote, not to gloss' : kind === 'title' ? 'a title to land and leave' : kind === 'text' ? 'a passage to read with, not over' : 'a picture to describe'
  const why = `${reasons.join(', ')} — ${judgement}${roleScale !== 1 ? ` · the ${options.arcRole} role ${roleScale > 1 ? 'earns' : 'trims'} ${Math.round(Math.abs(1 - roleScale) * 100)}%` : ''}`
  return { seconds, range, windows: windowCount, words: wordBudget, depth, kind, arcRole: options.arcRole, reasons, why, outline, coverage }
}

/** How a draft measures against the brief: under 60% reads as kept minimal. */
export const briefVerdict = (brief: Pick<LengthBrief, 'seconds' | 'range'>, draftedSeconds: number) => {
  if (!draftedSeconds) return 'none' as const
  if (draftedSeconds < brief.seconds * 0.6) return 'thin' as const
  if (draftedSeconds > brief.range[1] * 1.25) return 'long' as const
  return 'fits' as const
}

/** The brief as the writer reads it. */
export const briefForWriter = (brief: LengthBrief, labelOf: (id: string) => string) => ({
  seconds: brief.seconds,
  windows: brief.windows,
  words: brief.words,
  outline: brief.outline.map(stretch => ({ label: stretch.label, seconds: stretch.seconds, parts: stretch.parts.map(id => ({ id, label: labelOf(id) })) })),
  // Arrows are drawn by the engine when their boxes are named; they are
  // never spoken, so they are not offered to the writer at all.
  passing: brief.coverage
    .filter(entry => entry.treatment === 'passing' && readable(entry.label) && !/^connector\b/i.test(entry.label) && !/^an arrow/.test(entry.reason))
    .map(entry => ({ id: entry.id, label: entry.label })),
  skip: brief.coverage.filter(entry => entry.treatment === 'skip' && readable(entry.label)).map(entry => ({ id: entry.id, label: entry.label })),
})
