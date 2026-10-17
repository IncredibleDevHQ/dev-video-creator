// A teaser framed for a phone (review 8: a 9:16 teaser fitted the whole
// 16:9 frame into a strip a third of the screen high, its labels too small
// to read). A storyboard episode draws its frames on a plain background, so
// where the lesson sits can be found: each stretch is cropped to it, as
// large as the shape's picture area allows, on the frame's own background,
// with the teaser's captions under it in place of the episode's caption
// band. While a frame builds, its crop widens a step ahead of what comes
// in; a frame without a plain background keeps the fit. Each stretch says
// how large its text ends up, so a teaser that stays small says so.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Project } from '../shared/model'
import { captionCues, sceneTimes } from '../shared/release-plan'
import { frameId } from '../shared/storyboard'
import { stillFile } from './storyboard/board'
import { productionDir } from './storyboard/workspace'

/** The pictures are read this small: a sixth of a 1920×1080 frame. */
const READ = { width: 320, height: 180 }
/** The storyboard canvas keeps its lowest sixth for the captions. */
export const BAND_TOP = 1 - 0.1667
const ROWS = Math.round(READ.height * BAND_TOP)
const SAMPLES_PER_SECOND = 4
/** The crop holds what comes in this far ahead. */
const AHEAD = 0.5
/** A frame's first moments may blend in the frame before it. */
const ENTRANCE = 0.9
const SHORTEST = 0.75
/** A new crop only when the picture would shrink by more than this. */
const SHRINK = 0.85
/** Room around the lesson, as a share of the frame's width. */
const MARGIN = 0.03
const LARGEST = 2
/** Text at nine tenths of its size in the episode watched full screen on
 * the same phone, or more, reads: the phone shows both at one scale. */
export const READABLE = 0.9

/** Where something sits, as shares of the frame. */
export type Box = { x0: number; y0: number; x1: number; y1: number }
export type Layout = { width: number; height: number; captionAt: number }
type Rect = { x: number; y: number; w: number; h: number }
/** A stretch of the produced video, in its seconds, and how it is framed:
 * cropped and scaled to `place` on its background, or fitted whole. The
 * background is a `patch` of the frame's own, blown up, so it meets the
 * crop without a seam; else `color`. */
export type Shot = {
  from: number
  to: number
  scale: number
  crop?: Rect
  place?: Rect
  patch?: { x: number; y: number }
  color?: string
}

/** The side of the background patch, in the frame's pixels. */
export const PATCH = 16

const union = (one: Box | null, other: Box | null): Box | null =>
  !one || !other
    ? one || other
    : {
        x0: Math.min(one.x0, other.x0),
        y0: Math.min(one.y0, other.y0),
        x1: Math.max(one.x1, other.x1),
        y1: Math.max(one.y1, other.y1)
      }

/** The colour most of a picture's edge has above the caption band (its
 * mean, so the fill around a crop meets the crop without a seam), and how
 * much of the edge has it. */
export const backgroundOf = (rgb: Buffer, width: number, rows: number) => {
  const tally = new Map<number, number[]>()
  let total = 0
  const add = (x: number, y: number) => {
    const at = (y * width + x) * 3
    const key =
      ((rgb[at] >> 3) << 10) | ((rgb[at + 1] >> 3) << 5) | (rgb[at + 2] >> 3)
    const sums = tally.get(key) || [0, 0, 0, 0]
    sums[0]++
    for (let channel = 0; channel < 3; channel++)
      sums[channel + 1] += rgb[at + channel]
    tally.set(key, sums)
    total++
  }
  for (let x = 0; x < width; x++) {
    add(x, 0)
    add(x, rows - 1)
  }
  for (let y = 1; y < rows - 1; y++) {
    add(0, y)
    add(width - 1, y)
  }
  const [count, ...sums] = [...tally.values()].reduce((most, sums) =>
    sums[0] > most[0] ? sums : most
  )
  return {
    color: sums.map((sum) => Math.round(sum / count)),
    share: count / total
  }
}

/** Where the picture differs from its background above the caption band:
 * a box in shares of the frame, or null when nothing does. */
export const contentBox = (
  rgb: Buffer,
  width: number,
  height: number,
  rows: number,
  background: number[]
): Box | null => {
  let x0 = width
  let y0 = rows
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 3
      const away =
        Math.abs(rgb[at] - background[0]) +
        Math.abs(rgb[at + 1] - background[1]) +
        Math.abs(rgb[at + 2] - background[2])
      if (away <= 36) continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
  return x1 < 0
    ? null
    : {
        x0: x0 / width,
        y0: y0 / height,
        x1: (x1 + 1) / width,
        y1: (y1 + 1) / height
      }
}

const down2 = (value: number) => Math.floor(value / 2) * 2
const up2 = (value: number) => Math.max(2, Math.ceil(value / 2) * 2)

/** A crop's place in the teaser: the lesson with room around it, as large
 * as the shape's picture area above the captions allows (never past twice
 * its size), centred there. Sizes are even, as the encoder wants. */
export const placeCrop = (
  box: Box,
  source: { width: number; height: number },
  layout: Layout
) => {
  const room = source.width * MARGIN
  const floor = down2(source.height * BAND_TOP)
  const x = down2(Math.max(0, box.x0 * source.width - room))
  const y = Math.min(
    floor - 2,
    down2(Math.max(0, box.y0 * source.height - room))
  )
  const crop = {
    x,
    y,
    w: Math.min(source.width - x, up2(box.x1 * source.width + room - x)),
    h: Math.min(floor - y, up2(box.y1 * source.height + room - y))
  }
  const top = layout.height * 0.06
  const area = layout.height * (layout.captionAt - 0.02) - top
  const scale = Math.min(layout.width / crop.w, area / crop.h, LARGEST)
  const w = Math.min(layout.width, down2(crop.w * scale))
  const h = down2(crop.h * scale)
  return {
    scale,
    crop,
    place: {
      x: down2((layout.width - w) / 2),
      y: down2(top + (area - h) / 2),
      w,
      h
    }
  }
}

/**
 * One frame's stretch of the teaser, cut where its crop must widen: the
 * crop at a moment holds all the frame has shown since it came in, and
 * what comes in half a second later; a new stretch begins only when that
 * would shrink the picture by more than a seventh. The landed still, when
 * the stretch runs to the frame's end, is held too.
 */
export const frameStretches = (
  span: { from: number; to: number; enters: number },
  samples: Array<{ t: number; box: Box | null }>,
  scaleOf: (box: Box) => number,
  landed: Box | null = null
) => {
  const seen = samples.filter(
    (sample) =>
      sample.t >= Math.max(span.from, span.enters) && sample.t < span.to
  )
  const stretches: Array<{ from: number; to: number; box: Box }> = []
  let held: Box | null = null
  let ahead = 0
  for (const sample of seen) {
    while (ahead < seen.length && seen[ahead].t <= sample.t + AHEAD)
      held = union(held, seen[ahead++].box)
    if (!held) continue
    const last = stretches.at(-1)
    if (last && scaleOf(held) >= scaleOf(last.box) * SHRINK) last.box = held
    else {
      if (last) last.to = sample.t
      stretches.push({
        from: last ? sample.t : span.from,
        to: span.to,
        box: held
      })
    }
  }
  const last = stretches.at(-1)
  if (last && landed) last.box = union(last.box, landed)!
  // A stretch too short to read joins the next, whose crop holds it.
  for (let index = 0; index < stretches.length; index++) {
    const stretch = stretches[index]
    if (stretch.to - stretch.from >= SHORTEST || stretches.length === 1)
      continue
    const next = stretches[index + 1]
    const before = stretches[index - 1]
    if (next) next.from = stretch.from
    else {
      before.to = stretch.to
      before.box = union(before.box, stretch.box)!
    }
    stretches.splice(index--, 1)
  }
  return stretches
}

/** Pictures from ffmpeg at the reading size, each handed on as it lands:
 * a still once, or a stretch of video four times a second. */
const readPictures = (
  input: string,
  each: (rgb: Buffer) => void,
  stretch?: { from: number; to: number }
) =>
  new Promise<void>((resolve, reject) => {
    const size = READ.width * READ.height * 3
    const child = spawn(
      'ffmpeg',
      [
        '-v',
        'error',
        ...(stretch
          ? [
              '-ss',
              String(stretch.from),
              '-t',
              String(stretch.to - stretch.from)
            ]
          : []),
        '-i',
        input,
        '-vf',
        `${stretch ? `fps=${SAMPLES_PER_SECOND},` : ''}scale=${READ.width}:${READ.height}:flags=area`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        'pipe:1'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const timer = setTimeout(() => child.kill('SIGTERM'), 120_000)
    let pending: Buffer = Buffer.alloc(0)
    let errors = ''
    child.stdout.on('data', (chunk: Buffer) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
      while (pending.length >= size) {
        each(Buffer.from(pending.subarray(0, size)))
        pending = pending.subarray(size)
      }
    })
    child.stderr.on('data', (chunk) => (errors += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else
        reject(new Error(errors.trim().split('\n').at(-1) || 'ffmpeg failed'))
    })
  })

/** A storyboard episode's frames, timed as the film runs them (their
 * durations add up to it), with their stills and how each comes in. */
const timedFrames = (project: Project) => {
  const storyboard = project.video?.storyboard
  const scenes = storyboard?.plan?.scenes
  if (!storyboard || !scenes) return []
  return sceneTimes(project).flatMap((timed) =>
    timed.scene.moments.map((moment, index) => {
      const frame = scenes[timed.index].frames[index]
      const still = frame.still
        ? join(
            productionDir(project.id, storyboard.id),
            stillFile(frameId(frame))
          )
        : ''
      return {
        from: timed.start + moment.start,
        to: timed.start + moment.end,
        cut: frame.transition === 'cut',
        still: still && existsSync(still) ? still : ''
      }
    })
  )
}

const hex = (color: number[]) =>
  `0x${color.map((value) => value.toString(16).padStart(2, '0')).join('')}`

/** A corner of the frame above the caption band where nothing the stretch
 * shows ever reaches: its background, in the frame's own colours. */
export const patchOf = (
  box: Box,
  source: { width: number; height: number }
) => {
  const floor = down2(source.height * BAND_TOP)
  return [
    { x: PATCH, y: PATCH },
    { x: source.width - 2 * PATCH, y: PATCH },
    { x: PATCH, y: floor - 2 * PATCH },
    { x: source.width - 2 * PATCH, y: floor - 2 * PATCH }
  ].find(
    (corner) =>
      corner.x + PATCH <= box.x0 * source.width ||
      corner.x >= box.x1 * source.width ||
      corner.y + PATCH <= box.y0 * source.height ||
      corner.y >= box.y1 * source.height
  )
}

/**
 * How each stretch of a teaser is framed, in the produced video's seconds;
 * null when the teaser keeps the fit: a shape as wide as the video, a video
 * that is not a storyboard episode, or one with nothing to crop to.
 */
export const frameTeaser = async (input: {
  project: Project
  video: string
  segments: Array<{ from: number; to: number }>
  layout: Layout
  source: { width: number; height: number }
}): Promise<Shot[] | null> => {
  const { layout, source } = input
  if (layout.width / layout.height >= source.width / source.height - 0.01)
    return null
  const frames = timedFrames(input.project)
  if (!frames.length) return null
  const fit = Math.min(
    layout.width / source.width,
    layout.height / source.height
  )
  const scaleOf = (box: Box) => placeCrop(box, source, layout).scale
  const shots: Shot[] = []
  for (const segment of input.segments) {
    const samples: Array<{ t: number; rgb: Buffer }> = []
    await readPictures(
      input.video,
      (rgb) =>
        samples.push({
          t: segment.from + samples.length / SAMPLES_PER_SECOND,
          rgb
        }),
      segment
    )
    for (const frame of frames) {
      const from = Math.max(frame.from, segment.from)
      const to = Math.min(frame.to, segment.to)
      if (to - from < 0.01) continue
      // Its background from its landed still, else from the video.
      let still: Buffer | null = null
      if (frame.still)
        await readPictures(frame.still, (rgb) => (still ||= rgb)).catch(
          () => {}
        )
      const picture = still || samples.find((sample) => sample.t >= from)?.rgb
      const plain = picture ? backgroundOf(picture, READ.width, ROWS) : null
      const boxOf = (rgb: Buffer) =>
        contentBox(rgb, READ.width, READ.height, ROWS, plain!.color)
      const stretches =
        plain && plain.share >= 0.6
          ? frameStretches(
              {
                from,
                to,
                enters: frame.cut ? frame.from : frame.from + ENTRANCE
              },
              samples
                .filter((sample) => sample.t >= from && sample.t < to)
                .map((sample) => ({ t: sample.t, box: boxOf(sample.rgb) })),
              scaleOf,
              still && to >= frame.to - 0.01 ? boxOf(still) : null
            )
          : []
      if (!stretches.length) shots.push({ from, to, scale: fit })
      for (const stretch of stretches) {
        const patch = patchOf(stretch.box, source)
        shots.push({
          from: stretch.from,
          to: stretch.to,
          ...placeCrop(stretch.box, source, layout),
          ...(patch ? { patch } : { color: hex(plain!.color) })
        })
      }
    }
  }
  return shots.some((shot) => shot.crop) ? shots : null
}

/** The seconds of a teaser whose text stays below reading size. */
export const smallSeconds = (
  shots: Array<Pick<Shot, 'from' | 'to' | 'scale'>>
) =>
  Math.round(
    shots
      .filter((shot) => shot.scale < READABLE)
      .reduce((sum, shot) => sum + shot.to - shot.from, 0) * 10
  ) / 10

/**
 * The teaser's own captions over a cropped storyboard episode, whose caption
 * band is left out: the episode's caption groups as it shows them, else its
 * words a few at a time.
 */
export const croppedCaptions = async (
  project: Project,
  segments: Array<{ from: number; to: number }>
) => {
  const storyboard = project.video?.storyboard
  const file = storyboard
    ? join(productionDir(project.id, storyboard.id), 'caption_groups.json')
    : ''
  const groups =
    file && existsSync(file)
      ? (
          JSON.parse(await readFile(file, 'utf8')) as {
            groups?: Array<{ start: number; end: number; text: string }>
          }
        ).groups || []
      : []
  if (!groups.length) return captionCues(project, segments)
  const cues: Array<{ start: number; end: number; text: string }> = []
  let offset = 0
  for (const segment of segments) {
    for (const group of groups) {
      const start = Math.max(group.start, segment.from)
      const end = Math.min(group.end, segment.to)
      if (end - start >= 0.05)
        cues.push({
          start: Math.round((start - segment.from + offset) * 100) / 100,
          end: Math.round((end - segment.from + offset) * 100) / 100,
          text: group.text
        })
    }
    offset += segment.to - segment.from
  }
  return cues
}
