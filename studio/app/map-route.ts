// A direction's line on the map: from its note to the frame of what it
// guides, ending at that frame and pointing in. Of the ways a line can go
// (out of a side and down a gutter, straight down a gutter, or round the
// frames above or below them), it takes the one that runs least through a
// frame, then the shortest, so a note anywhere on the canvas reaches its
// target without crossing the Cards or the series (review 7).
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

export const routeDirection = (
  note: Box,
  frame: Box,
  y: number,
  frames: Box[]
): { points: Point[]; turn: number } => {
  const left = note.x + note.w / 2 < frame.x + frame.w / 2
  const turn = left ? frame.x - 20 : frame.x + frame.w + 20
  const end: Point = [left ? frame.x : frame.x + frame.w, y]
  const middle = note.y + note.h / 2
  const near = left ? note.x + note.w : note.x
  const far = left ? note.x : note.x + note.w
  const ways: Point[][] = []
  // Out of the side facing the frame, turning in the gutter beside it.
  if (left ? near <= turn : near >= turn)
    ways.push([[near, middle], [turn, middle], [turn, y], end])
  // Out of the far side, turning beyond the note.
  const beyond = left ? Math.min(turn, far - 20) : Math.max(turn, far + 20)
  ways.push([[far, middle], [beyond, middle], [beyond, y], end])
  // Straight along the gutter, when the note spans it.
  if (turn > note.x + 8 && turn < note.x + note.w - 8)
    ways.push([[turn, y > middle ? note.y + note.h : note.y], [turn, y], end])
  // Round every frame, above or below them all.
  const top = Math.min(...frames.map((f) => f.y)) - 24
  const bottom = Math.max(...frames.map((f) => f.y + f.h)) + 24
  for (const lane of [top, bottom]) {
    const x = note.x + note.w / 2
    const edge = lane < middle ? note.y : note.y + note.h
    ways.push([[x, edge], [x, lane], [turn, lane], [turn, y], end])
  }
  const cost = (points: Point[]) => {
    let crossed = 0
    let length = 0
    for (const [a, b] of runs(points)) {
      length += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
      for (const box of frames) crossed += through(a, b, box)
    }
    return [crossed, length]
  }
  const best = ways
    .map((way) => ({ way: tidy(way), cost: cost(way) }))
    .sort((a, b) => a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1])[0]
  return { points: best.way, turn }
}
