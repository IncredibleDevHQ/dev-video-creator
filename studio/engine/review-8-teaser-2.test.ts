import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { Project } from '../shared/model'
import type { Planned } from './teaser-framing'
// Review 8, round 1: a portrait teaser's frames coming in. A synthetic
// storyboard episode of two flat blocks joined by a real crossfade is cut
// with ffmpeg and measured. Nothing here is what a model made.
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-teaser-2-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const framing = await import('./teaser-framing')
const { cutTeaser } = await import('./teasers')
const { storeAsset } = await import('./persistence')
afterAll(() => rm(root, { recursive: true, force: true }))

const box = (x0: number, y0: number, x1: number, y1: number) => ({
  x0: x0 / 1920,
  y0: y0 / 1080,
  x1: x1 / 1920,
  y1: y1 / 1080
})
const A = box(120, 300, 720, 600)
const B = box(1200, 300, 1800, 600)

it('holds the frame before and the frame coming in for a transition, and joins a sliver to its neighbour (F16, round 1)', () => {
  const span = (
    from: number,
    to: number,
    start: number,
    cut: boolean,
    stretches: Planned[]
  ) => ({ from, start, cut, stretches })
  // A crossfade: both blocks in the crop while it plays, then B alone.
  expect(
    framing.joinStretches([
      span(0, 4, 0, true, [{ from: 0, to: 4, box: A }]),
      span(4, 8, 4, false, [{ from: 4, to: 8, box: B }])
    ])
  ).toEqual([
    { from: 0, to: 4, box: A },
    { from: 4, to: 4.9, box: box(120, 300, 1800, 600) },
    { from: 4.9, to: 8, box: B }
  ])
  // A cut shows nothing of the frame before.
  expect(
    framing.joinStretches([
      span(0, 4, 0, true, [{ from: 0, to: 4, box: A }]),
      span(4, 8, 4, true, [{ from: 4, to: 8, box: B }])
    ])
  ).toHaveLength(2)
  // A frame kept whole: its entrance is whole too.
  expect(
    framing.joinStretches([
      span(0, 4, 0, true, [{ from: 0, to: 4, box: A }]),
      span(4, 8, 4, false, [{ from: 4, to: 8, box: null }])
    ])[1].box
  ).toBeNull()
  // A beat cut 33 ms before a frame comes in (the review's 14.5 s against
  // 14.53 s): the sliver joins the entrance, the crop holding both.
  expect(
    framing.joinStretches([
      span(14.5, 14.53, 8.09, false, [{ from: 14.5, to: 14.53, box: A }]),
      span(14.53, 19.38, 14.53, false, [{ from: 14.53, to: 19.38, box: B }])
    ])
  ).toEqual([
    { from: 14.5, to: 15.43, box: box(120, 300, 1800, 600) },
    { from: 15.43, to: 19.38, box: B }
  ])
  // A sliver at the end joins the stretch before it.
  expect(
    framing.joinStretches([
      span(0, 4, 0, true, [{ from: 0, to: 4, box: A }]),
      span(4, 4.2, 4, true, [{ from: 4, to: 4.2, box: B }])
    ])
  ).toEqual([{ from: 0, to: 4.2, box: box(120, 300, 1800, 600) }])
})

// Frame 1 (0–4 s) a dark block on the left, frame 2 (4–8 s) one on the
// right, coming in on a half-second crossfade at 4 s as Hyperframes plays
// it: the frame going out holds while the next fades in over it.
const work = join(root, 'work')
let project: Project
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  const clip = (name: string, x: number, seconds: number) =>
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=0xffffff:s=1920x1080:r=30:d=${seconds},drawbox=x=${x}:y=300:w=600:h=300:color=0x202020:t=fill`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      join(work, name)
    ])
  clip('a.mp4', 120, 4.5)
  clip('b.mp4', 1200, 4)
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    join(work, 'a.mp4'),
    '-i',
    join(work, 'b.mp4'),
    '-filter_complex',
    '[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4[v]',
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    join(work, 'episode.mp4')
  ])
  const video = await storeAsset({
    body: await readFile(join(work, 'episode.mp4')),
    contentType: 'video/mp4',
    extension: '.mp4',
    kind: 'produced-video',
    projectId: 'entrance'
  })
  const frame = (number: number, transition: string) => ({
    number,
    title: `Frame ${number}`,
    type: 'explain',
    duration: 4,
    voiceover: '',
    transition
  })
  project = {
    id: 'entrance',
    title: 'Entrance',
    source: '',
    slides: [{ id: 'a', title: 'A', svg: '' }],
    video: {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { inputKey: 'sb', objectKey: video.objectKey },
      storyboard: {
        id: 'sb',
        pages: ['a'],
        stage: 'done',
        status: 'done',
        updatedAt: '',
        plan: {
          message: '',
          audience: '',
          structure: '',
          hook: '',
          scenes: [
            {
              pageId: 'a',
              build: 'faceless',
              buildReason: '',
              frames: [frame(1, 'cut'), frame(2, 'crossfade')]
            }
          ]
        }
      }
    } as never,
    release: { teasers: [], campaign: [] }
  }
}, 60_000)

/** The runs of not-white across one row of a teaser's picture. */
const runsAt = (file: string, at: number, y: number) => {
  const luma = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-ss',
      String(at),
      '-i',
      file,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'yuv420p',
      'pipe:1'
    ],
    { maxBuffer: 1 << 24 }
  ).subarray(y * 1080, (y + 1) * 1080)
  const runs: Array<[number, number]> = []
  luma.forEach((value, x) => {
    if (value >= 200) return
    const last = runs.at(-1)
    if (last && last[1] === x - 1) last[1] = x
    else runs.push([x, x])
  })
  return runs
}

it('keeps the frame going out whole while the next fades in, then crops to the new one (F16, round 1)', async () => {
  const { bytes } = await cutTeaser(project, {
    aspect: '9:16',
    segments: [{ from: 0, to: 8 }]
  })
  const file = join(work, 'teaser.mp4')
  await writeFile(file, bytes)
  // Mid-crossfade: both blocks, whole, neither cut off at the picture's
  // edge (round 1: "No an" at the crop's edge).
  const fading = runsAt(file, 4.25, 760)
  expect(fading).toHaveLength(2)
  for (const [first, last] of fading) {
    expect(first).toBeGreaterThan(0)
    expect(last).toBeLessThan(1079)
  }
  // Once it has come in, the new block alone fills the width.
  const settled = runsAt(file, 6, 760)
  expect(settled).toHaveLength(1)
  expect(settled[0][1] - settled[0][0]).toBeGreaterThan(800)
}, 120_000)

it('never opens a beat on a sliver of the frame before (F16, round 1)', async () => {
  const shots = await framing.frameTeaser({
    project,
    video: join(work, 'episode.mp4'),
    segments: [{ from: 3.967, to: 8 }],
    layout: { width: 1080, height: 1920, captionAt: 0.7 },
    source: { width: 1920, height: 1080 }
  })
  expect(shots![0].from).toBe(3.967)
  for (const shot of shots!)
    expect(shot.to - shot.from).toBeGreaterThanOrEqual(0.75)
}, 120_000)
