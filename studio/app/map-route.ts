// A direction's line on the map: from its note to the frame of what it
// guides, ending at that frame and pointing in. Of the ways a line can go
// (out of a side and down a gutter, straight down a gutter, or round, just
// past its own note or past every block), it takes the one that runs least
// through a block, then the shortest, so a note anywhere on the canvas
// reaches its target without crossing the Cards, the series, the Socials
// box or another note (review 7).
import type { Box } from './map-layout'

export type Point = [number, number]

/** How far a straight run goes through a frame's inside. */
const through = (a: Point, b: Point, box: Box) => {
  const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
  const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
  if (y1 === y2)
    return y1 > box.y && y1 < box.y + box.h
      ? Math.max(0, Math.min(x2, box.x + box.w) - Math.max(x1, box.x))
      : 0
  return x1 > box.x && x1 < box.x + box.w
    ? Math.max(0, Math.min(y2, box.y + box.h) - Math.max(y1, box.y))
    : 0
}

const runs = (points: Point[]) => points.slice(1).map((p, i) => [points[i], p])

/** Without repeated points or corners that do not turn. */
const tidy = (points: Point[]) => {
  const kept = points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]
  )
  return kept.filter((p, i) => {
    const a = kept[i - 1]
    const b = kept[i + 1]
    return (
      !a ||
      !b ||
      !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]))
    )
  })
}

/** How far a note's label stands above it (map-flow.css). */
export const LABEL = 24

/** Every note as a block, its label above it included. */
export const noteBlock = (note: Box): Box => ({
  x: note.x,
  y: note.y - LABEL,
  w: note.w,
  h: note.h + LABEL
})

/** The way from a note (with its label above it) to a frame's side, round
 * the blocks given: frames, the Socials box and the other notes. */
export const routeDirection = (
  note: Box,
  frame: Box,
  y: number,
  blocks: Box[]
): { points: Point[]; turn: number } => {
  const left = note.x + note.w / 2 < frame.x + frame.w / 2
  const turn = left ? frame.x - 20 : frame.x + frame.w + 20
  const end: Point = [left ? frame.x : frame.x + frame.w, y]
  const middle = note.y + note.h / 2
  const base = note.y + note.h
  const near = left ? note.x + note.w : note.x
  const far = left ? note.x : note.x + note.w
  const out = (side: number) => (side === note.x ? side - 16 : side + 16)
  // Its own note and label are blocks too: no way doubles back over them.
  const all = [noteBlock(note), ...blocks]
  const ways: Point[][] = []
  // Out of the side facing the frame, turning in the gutter beside it.
  if (left ? near <= turn : near >= turn)
    ways.push([[near, middle], [turn, middle], [turn, y], end])
  // Out of the far side, turning beyond the note.
  const beyond = left ? Math.min(turn, far - 20) : Math.max(turn, far + 20)
  ways.push([[far, middle], [beyond, middle], [beyond, y], end])
  // Straight down the gutter from the note's foot, when the note spans it.
  if (turn > note.x + 8 && turn < note.x + note.w - 8 && y > base)
    ways.push([[turn, base], [turn, y], end])
  const top = Math.min(...all.map((b) => b.y)) - 24
  const bottom = Math.max(...all.map((b) => b.y + b.h)) + 24
  // Round below: out of its foot, just under the note's row or under all.
  for (const lane of [base + 16, bottom]) {
    const x = note.x + note.w / 2
    ways.push([[x, base], [x, lane], [turn, lane], [turn, y], end])
  }
  // Round above: out of a side, never up through its own label.
  for (const lane of [note.y - LABEL - 16, top])
    for (const side of [near, far])
      ways.push([
        [side, middle],
        [out(side), middle],
        [out(side), lane],
        [turn, lane],
        [turn, y],
        end
      ])
  const cost = (points: Point[]) => {
    let crossed = 0
    let length = 0
    for (const [a, b] of runs(points)) {
      length += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
      for (const box of all) crossed += through(a, b, box)
    }
    return [crossed, length]
  }
  const best = ways
    .map((way) => ({ way: tidy(way), cost: cost(way) }))
    .sort((a, b) => a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1])[0]
  return { points: best.way, turn }
}
