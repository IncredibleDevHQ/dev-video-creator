// How much of the picture a frame's content fills, read from its snapshot.
// Hyperframes' check has no rule for it; faceless-explainer's visual design
// asks the primary visual to fill 40–60% of the frame and never to float as
// a small cluster in empty space. The content is what differs from the
// ground (the colour at the picture's corners), above the caption band.
import { execFile } from 'node:child_process'

/** A picture as rows of RGB bytes. */
export type Picture = { width: number; height: number; data: Buffer }

const WIDTH = 480
const HEIGHT = 270

/** A snapshot made small, as raw RGB, by ffmpeg. */
const pictureOf = (path: string) =>
  new Promise<Picture | null>((resolve) => {
    execFile(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        path,
        '-vf',
        `scale=${WIDTH}:${HEIGHT}:flags=area`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        '-'
      ],
      { encoding: 'buffer', maxBuffer: WIDTH * HEIGHT * 3 + 1024 },
      (error, stdout) =>
        resolve(
          error || stdout.length < WIDTH * HEIGHT * 3
            ? null
            : { width: WIDTH, height: HEIGHT, data: stdout }
        )
    )
  })

/** The box around everything that is not the ground, above `bottom`
 * (a fraction of the height), as fractions of that picture area. */
export const contentBox = (picture: Picture, bottom = 0.83) => {
  const { width, data } = picture
  const height = Math.round(picture.height * bottom)
  const color = (x: number, y: number) => {
    const at = (y * width + x) * 3
    return [data[at], data[at + 1], data[at + 2]]
  }
  const near = (a: number[], b: number[]) =>
    a.every((value, index) => Math.abs(value - b[index]) <= 28)
  // The ground: the colour most of the four corners agree on.
  const corners = [
    color(2, 2),
    color(width - 3, 2),
    color(2, height - 3),
    color(width - 3, height - 3)
  ]
  const ground = corners
    .map((corner) => ({
      corner,
      votes: corners.filter((other) => near(corner, other)).length
    }))
    .sort((a, b) => b.votes - a.votes)[0].corner
  const rows = new Array<number>(height).fill(0)
  const columns = new Array<number>(width).fill(0)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 3
      if (
        Math.abs(data[at] - ground[0]) > 28 ||
        Math.abs(data[at + 1] - ground[1]) > 28 ||
        Math.abs(data[at + 2] - ground[2]) > 28
      ) {
        rows[y]++
        columns[x]++
      }
    }
  // A stray speck is not content: a row or column needs a few pixels.
  const span = (counts: number[]) => {
    const first = counts.findIndex((count) => count >= 2)
    if (first < 0) return null
    let last = counts.length - 1
    while (counts[last] < 2) last--
    return [first, last + 1]
  }
  const across = span(columns)
  const down = span(rows)
  if (!across || !down) return { width: 0, height: 0, area: 0 }
  const w = (across[1] - across[0]) / width
  const h = (down[1] - down[0]) / height
  return {
    width: Math.round(w * 100) / 100,
    height: Math.round(h * 100) / 100,
    area: Math.round(w * h * 100) / 100
  }
}

const percent = (value: number) => `${Math.round(value * 100)}%`

/**
 * What the snapshots say about filling the frame: one line for its fullest
 * moment, and a warning when even that leaves most of the picture empty.
 */
export const frameFill = async (snapshots: string[], times: number[]) => {
  const boxes: Array<{ time: number; box: ReturnType<typeof contentBox> }> = []
  for (const [index, path] of snapshots.entries()) {
    const picture = await pictureOf(path)
    if (picture)
      boxes.push({ time: times[index] ?? index, box: contentBox(picture) })
  }
  if (!boxes.length) return { lines: [] as string[], warning: null }
  const fullest = boxes.reduce((best, entry) =>
    entry.box.area > best.box.area ? entry : best
  )
  const line = `At ${fullest.time} s, its fullest moment, the content spans ${percent(fullest.box.width)} of the width and ${percent(fullest.box.height)} of the height above the caption band (${percent(fullest.box.area)} of that picture).`
  return {
    lines: [line],
    warning:
      fullest.box.area < 0.25
        ? `Sparse frame: ${line} The primary visual should fill 40–60% of the frame, never a small cluster in empty space (faceless-explainer visual design: density). Scale the hero up, or compose the whole area above the captions.`
        : null
  }
}
