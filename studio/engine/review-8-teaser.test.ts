import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// Review 8, the portrait teaser. A synthetic storyboard episode of flat
// blocks on a plain background, its stills and its caption groups: the
// teaser is cut for real with ffmpeg and measured. Nothing here is what a
// model made.
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-teaser-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const framing = await import('./teaser-framing')
const { makeTeaser } = await import('./teasers')
const { readAsset, storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { productionDir } = await import('./storyboard/workspace')
const { teasersSection } = await import('../app/release-view')
const { parseHTML } = await import('linkedom')
afterAll(() => rm(root, { recursive: true, force: true }))

const box = (x0: number, y0: number, x1: number, y1: number) => ({
  x0: x0 / 1920,
  y0: y0 / 1080,
  x1: x1 / 1920,
  y1: y1 / 1080
})
const SOURCE = { width: 1920, height: 1080 }
const PORTRAIT = { width: 1080, height: 1920, captionAt: 0.7 }

it('crops a compact lesson large, keeps a wide one whole, and widens a building frame a step ahead (F16)', () => {
  // A 500 px block, with room around it, fills the width; a full-width
  // one stays at the fit; a small one is never blown up past twice.
  const compact = framing.placeCrop(box(200, 200, 700, 700), SOURCE, PORTRAIT)
  expect(compact.scale).toBeCloseTo(1080 / 616, 3)
  expect(compact.place.w).toBeLessThanOrEqual(1080)
  const wide = framing.placeCrop(box(60, 300, 1860, 700), SOURCE, PORTRAIT)
  expect(wide.scale).toBeCloseTo(1080 / 1916, 3)
  expect(wide.scale).toBeLessThan(framing.READABLE)
  expect(
    framing.placeCrop(box(760, 250, 1160, 650), SOURCE, PORTRAIT).scale
  ).toBe(2)
  // Content near the caption band: the crop stops above the band.
  const low = framing.placeCrop(box(200, 500, 700, 870), SOURCE, PORTRAIT)
  expect(low.crop.y + low.crop.h).toBeLessThanOrEqual(898)
  // Every size even, for the encoder.
  for (const value of [
    ...Object.values(compact.crop),
    ...Object.values(compact.place)
  ])
    expect(value % 2).toBe(0)
  // A frame that builds: a blend before 0.9 s, a second block from 3 s
  // (past its first look), and a little more from 3.5 s, too little to cut
  // for.
  const scaleOf = (one: ReturnType<typeof box>) =>
    framing.placeCrop(one, SOURCE, PORTRAIT).scale
  const samples = Array.from({ length: 16 }, (_, index) => {
    const t = index / 4
    return {
      t,
      box:
        t < 0.9
          ? box(0, 0, 1920, 880)
          : t < 3
            ? box(200, 200, 700, 700)
            : t < 3.5
              ? box(200, 200, 1400, 700)
              : box(200, 200, 1420, 700)
    }
  })
  const stretches = framing.frameStretches(
    { from: 0, to: 4, enters: 0.9 },
    samples,
    scaleOf
  )
  // The blend is never framed; the crop widens half a second ahead.
  expect(stretches.map((stretch) => [stretch.from, stretch.to])).toEqual([
    [0, 2.5],
    [2.5, 4]
  ])
  expect(stretches[0].box).toEqual(box(200, 200, 700, 700))
  expect(stretches[1].box).toEqual(box(200, 200, 1420, 700))
  // A lone heading first, the rest a moment later: the first crop holds
  // all of it, never a heading blown up on its own (round 1).
  const heading = framing.frameStretches(
    { from: 0, to: 4, enters: 0 },
    samples.map((sample) => ({
      ...sample,
      box: sample.t < 1.25 ? box(860, 100, 1060, 160) : box(100, 100, 1800, 700)
    })),
    scaleOf
  )
  expect(heading).toEqual([{ from: 0, to: 4, box: box(100, 100, 1800, 700) }])
  // Too short to read: two widenings a quarter second apart make one cut;
  // a wider crop for the last moments widens the one before.
  expect(
    framing
      .frameStretches(
        { from: 0, to: 4, enters: 0 },
        samples.map((sample) => ({
          ...sample,
          box:
            sample.t < 2.5
              ? box(200, 200, 700, 700)
              : sample.t < 2.75
                ? box(200, 200, 1000, 700)
                : box(200, 200, 1400, 700)
        })),
        scaleOf
      )
      .map((stretch) => [stretch.from, stretch.to])
  ).toEqual([
    [0, 2],
    [2, 4]
  ])
  const twoPhases = (until: number) =>
    samples.map((sample) => ({
      ...sample,
      box: sample.t < until ? box(200, 200, 700, 700) : box(200, 200, 1400, 700)
    }))
  expect(
    framing.frameStretches(
      { from: 0, to: 3.9, enters: 0 },
      twoPhases(3.75),
      scaleOf
    )
  ).toEqual([{ from: 0, to: 3.9, box: box(200, 200, 1400, 700) }])
  // The landed still is held by the frame's last crop.
  const landed = framing.frameStretches(
    { from: 0, to: 4, enters: 0 },
    samples.slice(4, 6),
    scaleOf,
    box(100, 100, 1500, 800)
  )
  expect(landed.at(-1)!.box).toEqual(box(100, 100, 1500, 800))
  // How long the text stays small.
  expect(
    framing.smallSeconds([
      { from: 0, to: 1.5, scale: 1.75 },
      { from: 1.5, to: 4, scale: 0.82 },
      { from: 8, to: 12, scale: 0.56 }
    ])
  ).toBe(6.5)
})

it('finds a plain background and what sits on it, and none in stripes (F16)', () => {
  const width = 32
  const rows = 15
  const picture = (paint: (x: number, y: number) => number[]) => {
    const rgb = Buffer.alloc(width * 18 * 3)
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < width; x++) rgb.set(paint(x, y), (y * width + x) * 3)
    return rgb
  }
  const plain = picture((x, y) =>
    x >= 8 && x < 16 && y >= 4 && y < 10 ? [30, 30, 30] : [250, 250, 250]
  )
  const background = framing.backgroundOf(plain, width, rows)
  expect(background).toEqual({ color: [250, 250, 250], share: 1 })
  expect(framing.contentBox(plain, width, 18, rows, background.color)).toEqual({
    x0: 8 / 32,
    y0: 4 / 18,
    x1: 16 / 32,
    y1: 10 / 18
  })
  const stripes = picture((x) =>
    Math.floor(x / 4) % 2 ? [112, 112, 112] : [224, 224, 224]
  )
  expect(framing.backgroundOf(stripes, width, rows).share).toBeLessThan(0.6)
})

// The synthetic episode: frame 1 (0–4 s) builds, a dark block, then a
// second from 2 s; frame 2 (4–8 s) is one small dark block; frame 3
// (8–12 s) is grey stripes on white, no plain background. A black
// box sits in the caption band throughout, standing in for the episode's
// own captions: in the teaser only its own captions are dark below.
const work = join(root, 'work')
const blocks = [
  "drawbox=x=200:y=200:w=500:h=500:color=0x202020:t=fill:enable='lt(t,4)'",
  "drawbox=x=900:y=200:w=500:h=500:color=0x202020:t=fill:enable='gte(t,2)*lt(t,4)'",
  "drawbox=x=760:y=250:w=400:h=400:color=0x2040a0:t=fill:enable='gte(t,4)*lt(t,8)'",
  ...Array.from(
    { length: 20 },
    (_, index) =>
      `drawbox=x=${index * 96}:y=0:w=48:h=1080:color=0xa0a0a0:t=fill:enable='gte(t,8)'`
  )
]
const BAND = 'drawbox=x=760:y=950:w=400:h=80:color=0x000000:t=fill'
const draw = (file: string, still?: number) =>
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=0xffffff:s=1920x1080:r=30:d=12,${[...blocks, ...(still === undefined ? [BAND] : [])].join(',')}`,
    ...(still === undefined
      ? [
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440:duration=12',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-shortest'
        ]
      : ['-ss', String(still), '-frames:v', '1']),
    file
  ])
// Frame 2 has no still to hand: its background is read from the video.
const frame = (
  number: number,
  title: string,
  transition: string
): Record<string, unknown> => ({
  number,
  title,
  type: number === 1 ? 'hook' : 'explain',
  duration: 4,
  voiceover: `The words of frame ${number}`,
  transition,
  ...(number === 2 ? {} : { still: 'posed' })
})
let project: Project
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  draw(join(work, 'episode.mp4'))
  const video = await storeAsset({
    body: await readFile(join(work, 'episode.mp4')),
    contentType: 'video/mp4',
    extension: '.mp4',
    kind: 'produced-video',
    projectId: 'portrait'
  })
  const production = productionDir('portrait', 'sb')
  await mkdir(join(production, 'boards', 'stills'), { recursive: true })
  for (const [name, at] of [
    ['f01-builds', 3.5],
    ['f03-striped', 10]
  ] as const)
    draw(join(production, 'boards', 'stills', `${name}.png`), at)
  await writeFile(
    join(production, 'caption_groups.json'),
    JSON.stringify({
      groups: [
        { start: 0.5, end: 2.5, text: 'One tap.' },
        { start: 4.5, end: 7.5, text: 'Then one latte.' },
        { start: 8.5, end: 11.5, text: 'Two lattes.' }
      ]
    })
  )
  project = {
    id: 'portrait',
    title: 'One click, two lattes',
    source: '',
    slides: [
      { id: 'a', title: 'A', svg: '' },
      { id: 'b', title: 'B', svg: '' }
    ],
    video: {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { inputKey: 'sb', objectKey: video.objectKey },
      storyboard: {
        id: 'sb',
        pages: ['a', 'b'],
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
              frames: [frame(1, 'Builds', 'cut'), frame(2, 'Small', 'cut')]
            },
            {
              pageId: 'b',
              build: 'faceless',
              buildReason: '',
              frames: [frame(3, 'Striped', 'crossfade')]
            }
          ]
        }
      }
    } as never,
    release: { teasers: [], campaign: [] }
  }
  await writeRow('projects', 'portrait', {
    project,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
}, 60_000)

/** A frame of the teaser as its luma, unconverted (white is 235, black 16):
 * what each row holds. */
const rowsAt = (file: string, at: number) => {
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
  )
  const row = (y: number) => luma.subarray(y * 1080, (y + 1) * 1080)
  return {
    /** The height of what is dark above the caption, in pixels. */
    dark: (below = 1300) => {
      const rows = Array.from({ length: below }, (_, y) =>
        row(y).some((value) => value < 100)
      )
      const first = rows.indexOf(true)
      return first < 0 ? 0 : rows.lastIndexOf(true) - first + 1
    },
    mean: (y: number) => row(y).reduce((sum, value) => sum + value, 0) / 1080,
    /** Rows above the caption with sharp stripes in them: a blurred fill's
     * edges are soft. */
    sharp: (below = 1340) =>
      Array.from({ length: below }, (_, y) => row(y)).filter((line) => {
        let edges = 0
        for (let x = 1; x < line.length; x++)
          if (Math.abs(line[x] - line[x - 1]) > 25) edges++
        return edges >= 10
      }).length,
    at: (x: number, y: number) => row(y)[x],
    spread: (y: number) => Math.max(...row(y)) - Math.min(...row(y)),
    darkIn: (from: number, to: number) =>
      Array.from({ length: to - from }, (_, index) => row(from + index)).some(
        (line) => line.some((value) => value < 100)
      )
  }
}

it('cuts a 9:16 teaser whose lesson fills the screen, measured, and says where its text stays small (F16)', async () => {
  const started = await makeTeaser('portrait', { channel: 'youtube' })
  expect(started.project.release!.teasers[0].segments).toEqual([
    { from: 0, to: 12 }
  ])
  await vi.waitFor(
    async () =>
      expect(
        (await loadProject('portrait'))!.project.release!.teasers[0].state
      ).toBe('ready'),
    { timeout: 120_000, interval: 500 }
  )
  const teaser = (await loadProject('portrait'))!.project.release!.teasers[0]
  const file = join(work, 'teaser.mp4')
  await writeFile(file, await readAsset(teaser.objectKey!))
  const probe = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height,sample_aspect_ratio:format=duration',
      '-of',
      'json',
      file
    ]).toString()
  )
  expect(probe.streams[0]).toMatchObject({
    width: 1080,
    height: 1920,
    sample_aspect_ratio: '1:1'
  })
  expect(Number(probe.format.duration)).toBeCloseTo(12, 0)
  // The fit showed a 500 px block 281 px high, a 400 px one 225 px high.
  const fit = (side: number) => side * (1080 / 1920)
  const first = rowsAt(file, 1)
  expect(first.dark()).toBeGreaterThan(fit(500) * 3)
  expect(first.dark() / 1920).toBeGreaterThan(0.44)
  // On the frame's own white, never a blurred fill; the teaser's caption
  // under the picture, the episode's caption band left out.
  expect(first.mean(40)).toBeGreaterThan(225)
  expect(first.darkIn(1344, 1460)).toBe(true)
  const building = rowsAt(file, 3)
  expect(building.dark()).toBeGreaterThan(fit(500) * 1.3)
  expect(building.darkIn(1344, 1460)).toBe(false)
  const small = rowsAt(file, 6)
  expect(small.dark()).toBeGreaterThan(fit(400) * 3.4)
  expect(small.mean(1250)).toBeGreaterThan(225)
  // The background around the crop is the frame's own: no seam where the
  // crop ends (above it, against its white under the block).
  expect(small.at(540, 100)).toBe(small.at(540, 1200))
  // Stripes, no plain background: fitted whole, but without the band, so
  // nothing dark but the teaser's caption.
  const striped = rowsAt(file, 10)
  expect(Math.abs(striped.sharp() - fit(900))).toBeLessThan(8)
  // Above it, the blurred fill's soft stripes, not a flat patch of one.
  expect(striped.spread(300)).toBeGreaterThan(10)
  expect(striped.darkIn(0, 1340)).toBe(false)
  expect(striped.darkIn(1344, 1460)).toBe(true)
  // 2.5 s while frame 1 holds both blocks, and frame 3's 4 s.
  expect(teaser.small).toBe(6.5)
  const row = parseHTML(
    `<div>${teasersSection({
      project: (await loadProject('portrait'))!.project,
      status: 'ready',
      error: null,
      events: []
    })}</div>`
  ).document
  // Small for more than a fifth of it: a draft until its frames are drawn
  // again for a phone, or the creator keeps it (round 1).
  expect(row.querySelector('.teaser-small')?.textContent).toBe(
    'Needs a portrait cut. Its text stays small on a phone for 7 of its 12 seconds.'
  )
  expect(
    row
      .querySelector('[data-action="teaser-rebuild"]')
      ?.getAttribute('data-frames')
  ).toBe('3')
  expect(row.querySelector('a[download]')).toBeNull()
  expect(row.querySelector('video')?.getAttribute('height')).toBe('480')
}, 180_000)
