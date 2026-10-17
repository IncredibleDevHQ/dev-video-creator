import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { Teaser } from '../shared/release'

// Review 8, round 1: a vertical teaser whose text stays small is a draft,
// and Release can have the frame agent draw its frames again for its shape.
// The frame agent, X and Hyperframes' render are stand-ins (the render
// draws each frame as dark stripes under a timer bar, at 1080×1920, with
// ffmpeg); the teaser cut from that render is real and measured. These
// checks prove the plumbing, never what a model draws.
const { drawn, rendered, posted, notebook, confirm } = vi.hoisted(() => ({
  drawn: vi.fn(),
  rendered: vi.fn(),
  posted: vi.fn(),
  notebook: vi.fn(),
  confirm: vi.fn()
}))
vi.mock('./teaser-portrait-run', async (original) => ({
  ...(await original<typeof import('./teaser-portrait-run')>()),
  drawFrameForShape: drawn,
  renderShape: rendered
}))
vi.mock('./posting', () => ({ postToX: posted, postToLinkedIn: posted }))
vi.mock('../app/studio-api', () => ({
  studioApi: { request: vi.fn(), notebook }
}))
vi.mock('../app/confirm-action', () => ({ confirmAction: confirm }))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-portrait-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY = '1'
const shape = await import('../shared/teaser-shape')
const { keepTeaser, rebuildTeaser } = await import('./teaser-portrait')
const { updateRelease, uploadBundle } = await import('./release')
const { coverStamp } = await import('../shared/release-cover')
const { postItem } = await import('./campaign')
const { readAsset, storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { productionDir } = await import('./storyboard/workspace')
const { HarnessStageError } = await import('./generation-errors')
const { teasersSection } = await import('../app/release-view')
const { clickRelease } = await import('../app/release-controller')
const { parseHTML } = await import('linkedom')
afterAll(() => rm(root, { recursive: true, force: true }))

/** A storyboard episode whose scenes hold frames of these lengths. */
const episode = (id: string, durations: number[][], objectKey = 'v.mp4') => {
  let number = 0
  return {
    id,
    title: 'One click, two lattes',
    source: '',
    slides: durations.map((_, index) => ({
      id: `p${index}`,
      title: `Page ${index + 1}`,
      svg: ''
    })),
    video: {
      settings: {
        presence: 'off',
        voice: { kind: 'record' },
        harness: { adapter: 'claude-code' }
      },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { inputKey: 'sb', objectKey },
      storyboard: {
        id: 'sb',
        pages: durations.map((_, index) => `p${index}`),
        stage: 'done',
        status: 'done',
        updatedAt: '',
        plan: {
          message: '',
          audience: '',
          structure: '',
          hook: '',
          scenes: durations.map((list, index) => ({
            pageId: `p${index}`,
            build: 'faceless',
            buildReason: '',
            frames: list.map((duration) => {
              number += 1
              return {
                number,
                title: `Frame ${number}`,
                type: number === 1 ? 'hook' : 'explain',
                duration,
                voiceover: `Line ${number}.`,
                transition: 'cut'
              }
            })
          }))
        }
      }
    },
    release: { teasers: [], campaign: [] }
  } as unknown as Project
}
const teaser = (more: Partial<Teaser> = {}): Teaser => ({
  id: 't',
  channel: 'youtube',
  aspect: '9:16',
  segments: [
    { from: 0, to: 4 },
    { from: 14.5, to: 40.5 }
  ],
  state: 'ready',
  objectKey: 'k',
  small: 26.5,
  at: '',
  ...more
})
const page = (project: Project) =>
  parseHTML(
    `<div>${teasersSection({ project, status: 'ready', error: null, events: [] })}</div>`
  ).document
// The reviewer's episode, by its frames' lengths: its teaser is the first
// four seconds and the beat from 14.5 s.
const REAL = [
  [4.162, 3.931, 6.436],
  [4.846, 3.481, 4.263, 3.5, 5.287, 5.293, 4.375, 4.642]
]

it('holds a teaser whose text stays small for over a fifth of it as a draft, until drawn again or kept (F16, round 1)', () => {
  const base = teaser()
  expect(shape.needsShapeCut(base)).toBe(true)
  // A fifth of 30 s is 6 s: just over it is a draft, at it is not.
  expect(shape.needsShapeCut({ ...base, small: 6 })).toBe(false)
  expect(shape.needsShapeCut({ ...base, small: 6.1 })).toBe(true)
  expect(shape.needsShapeCut({ ...base, kept: true })).toBe(false)
  const ready = { state: 'ready' as const, frames: 7, done: 7, at: '' }
  // Drawn again, it is measured again (round 2): readable, it is finished;
  // still small, it is still a draft.
  expect(
    shape.needsShapeCut({ ...base, small: undefined, rebuild: ready })
  ).toBe(false)
  expect(shape.needsShapeCut({ ...base, rebuild: ready })).toBe(true)
  expect(
    shape.needsShapeCut({ ...base, rebuild: { ...ready, state: 'failed' } })
  ).toBe(true)
  expect(shape.needsShapeCut({ ...base, aspect: '16:9' })).toBe(false)
  expect(shape.needsShapeCut({ ...base, state: 'cutting' })).toBe(false)
  expect(shape.shapeName('1:1')).toBe('square')
  expect(shape.shapeName('4:5')).toBe('portrait')
  // The frames it uses on the reviewer's episode: the hook's first, and
  // 4 to 9; the 29 ms of frame 3 before frame 4 comes in is held on frame
  // 4's first picture, never drawn for.
  const project = episode('real', REAL)
  const { frames, pieces } = shape.teaserFrames(project, base.segments)
  expect(frames.map((frame) => frame.number)).toEqual([1, 4, 5, 6, 7, 8, 9])
  expect(pieces.map((piece) => piece.frame)).toEqual([1, 4, 5, 6, 7, 8, 9])
  expect(pieces[1].from).toBeCloseTo(14.529, 3)
  expect(pieces[1].before).toBeCloseTo(0.029, 3)
  expect(pieces.at(-1)!.to).toBe(40.5)
  // A sliver at the end of a stretch holds the frame before it.
  const tail = shape.teaserFrames(project, [{ from: 14.529, to: 19.6 }])
  expect(tail.frames.map((frame) => frame.number)).toEqual([4])
  expect(tail.pieces[0].after).toBeCloseTo(0.225, 3)
  // Drawn again only for a storyboard episode, and only once at a time.
  expect(shape.canRebuild(project, base)).toBe(true)
  expect(
    shape.canRebuild(project, {
      ...base,
      rebuild: { ...ready, state: 'rebuilding', done: 2 }
    })
  ).toBe(false)
  expect(shape.canRebuild(project, { ...base, small: 0.5 })).toBe(false)
  const older = episode('older', REAL)
  delete older.video!.storyboard
  expect(shape.canRebuild(older, base)).toBe(false)
})

it('offers a draft its rebuild, says it is an AI run for each frame, and offers no download (F16, round 1)', () => {
  const project = episode('real', REAL)
  project.release!.teasers = [teaser()]
  const draft = page(project)
  expect(draft.querySelector('.teaser-row.is-draft')).not.toBeNull()
  expect(draft.querySelector('.teaser-small')?.textContent).toBe(
    'Needs a portrait cut. Its text stays small on a phone for 27 of its 30 seconds.'
  )
  const rebuild = draft.querySelector('[data-action="teaser-rebuild"]')!
  expect(rebuild.textContent).toBe('Rebuild for portrait')
  expect(rebuild.getAttribute('class')).toBe('primary')
  expect(rebuild.getAttribute('data-frames')).toBe('7')
  expect(draft.querySelector('.teaser-cost')?.textContent).toBe(
    'An AI run for each of its 7 frames'
  )
  expect(draft.querySelector('[data-action="teaser-keep"]')?.textContent).toBe(
    'Keep it as it is'
  )
  expect(draft.querySelector('a[download]')).toBeNull()
  // A square one says so.
  project.release!.teasers = [teaser({ aspect: '1:1', channel: 'linkedin' })]
  expect(page(project).querySelector('.teaser-small b')?.textContent).toBe(
    'Needs a square cut.'
  )
  // Kept: finished, downloadable, the rebuild still there but quiet.
  project.release!.teasers = [teaser({ kept: true })]
  const kept = page(project)
  expect(kept.querySelector('.is-draft')).toBeNull()
  expect(kept.querySelector('a[download]')).not.toBeNull()
  expect(
    kept.querySelector('[data-action="teaser-rebuild"]')?.getAttribute('class')
  ).toBe('quiet')
  // Under way, then failed.
  const under = { state: 'rebuilding' as const, frames: 7, done: 2, at: '' }
  project.release!.teasers = [teaser({ rebuild: under })]
  expect(page(project).querySelector('.teaser-status')?.textContent).toBe(
    'Drawing its frames again for portrait: 2 of 7…'
  )
  project.release!.teasers = [
    teaser({ rebuild: { ...under, state: 'failed', error: 'Frame 5 stopped' } })
  ]
  const failed = page(project)
  expect(failed.querySelector('.release-failed')?.textContent).toBe(
    'Frame 5 stopped'
  )
  expect(failed.querySelector('[data-action="teaser-rebuild"]')).not.toBeNull()
  // An older episode has no frames to draw: it can only be kept.
  delete project.video!.storyboard
  project.release!.teasers = [teaser()]
  const older = page(project)
  expect(older.querySelector('[data-action="teaser-rebuild"]')).toBeNull()
  expect(older.querySelector('[data-action="teaser-keep"]')).not.toBeNull()
})

it('asks before the rebuild’s AI runs, and keeps a teaser on a click (F16, round 1)', async () => {
  const project = episode('ask', REAL)
  const snapshot: Snapshot = {
    project,
    status: 'ready',
    error: null,
    events: []
  }
  const app = {
    snapshot,
    dialog: { open: false, dataset: {}, querySelector: () => null },
    showDialog: vi.fn()
  }
  const target = { dataset: { teaser: 't', frames: '7' } }
  notebook.mockResolvedValue(snapshot)
  confirm.mockResolvedValueOnce(false)
  await clickRelease(app as never, target as never, 'teaser-rebuild')
  expect(confirm.mock.calls[0][0].detail).toContain('7 AI runs')
  expect(notebook).not.toHaveBeenCalled()
  confirm.mockResolvedValueOnce(true)
  await clickRelease(app as never, target as never, 'teaser-rebuild')
  expect(notebook.mock.calls.at(-1)).toEqual([
    'ask',
    'teasers',
    { action: 'rebuild', teaser: 't' }
  ])
  await clickRelease(app as never, target as never, 'teaser-keep')
  expect(notebook.mock.calls.at(-1)).toEqual([
    'ask',
    'teasers',
    { action: 'keep', teaser: 't' }
  ])
})

// The rebuild, end to end: three scenes' frames of 4, 3 and 2.5 s, then
// three of 3 s. The teaser is the first 4 s and 9–15.8 s: half a second of
// frame 3, frames 4 and 5, and 0.3 s of frame 6.
const work = join(root, 'work')
const GREY: Record<number, string> = {
  1: '0x101010',
  4: '0x303030',
  5: '0x505050'
}
/** The stand-in render: each frame its own grey stripes, 24 px wide, under
 * a black bar that grows 100 px a second from the frame's start. */
const drawShape = async (
  dir: string,
  canvas: { width: number; height: number },
  frames: Array<{ frameId: string; duration: number }>
) => {
  const out = join(dir, 'renders', 'teaser.mp4')
  await mkdir(join(dir, 'renders'), { recursive: true })
  const source = (spec: string, duration: number) => [
    '-f',
    'lavfi',
    '-i',
    `color=c=${spec}:r=30:d=${duration}`
  ]
  const chains = frames.map((frame, index) => {
    const grey = GREY[Number(frame.frameId.slice(1, 3))]
    const stripes = Array.from(
      { length: 22 },
      (_, at) => `drawbox=x=${at * 48}:y=150:w=24:h=1300:color=${grey}:t=fill`
    ).join(',')
    return `[${index * 2}:v]${stripes}[s${index}];[s${index}][${index * 2 + 1}:v]overlay=x='-1000+100*t':y=60[f${index}]`
  })
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    ...frames.flatMap((frame) => [
      ...source(`white:s=${canvas.width}x${canvas.height}`, frame.duration),
      ...source('black:s=1000x40', frame.duration)
    ]),
    '-filter_complex',
    `${chains.join(';')};${frames.map((_, index) => `[f${index}]`).join('')}concat=n=${frames.length}:v=1:a=0[v]`,
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    out
  ])
  return out
}
/** The teaser's picture at a moment, as luma (white 235, black 16). */
const lumaAt = (file: string, at: number) => {
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
  const run = (y: number, from = 0) => {
    let x = from
    while (x < 1080 && row(y)[x] < 100) x++
    return x - from
  }
  return {
    at: (x: number, y: number) => row(y)[x],
    /** How far the timer bar has grown. */
    bar: () => run(80),
    /** The first stripe's width: the text's scale against the drawing. */
    stripe: () => run(800),
    /** The share of the picture above the caption band with sharp detail. */
    sharp: () =>
      Array.from({ length: 1600 }, (_, y) => row(y)).filter((line) => {
        let edges = 0
        for (let x = 1; x < line.length; x++)
          if (Math.abs(line[x] - line[x - 1]) > 25) edges++
        return edges >= 10
      }).length / 1920,
    darkIn: (from: number, to: number) =>
      Array.from({ length: to - from }, (_, index) => row(from + index)).some(
        (line) => line.some((value) => value < 100)
      )
  }
}
/** How loud a stretch of a file is, in dB. */
const loudness = (file: string, from: number, seconds: number) =>
  Number(
    /mean_volume: (-?[\d.]+) dB/.exec(
      spawnSync(
        'ffmpeg',
        [
          '-v',
          'info',
          '-ss',
          String(from),
          '-t',
          String(seconds),
          '-i',
          file,
          '-af',
          'volumedetect',
          '-vn',
          '-f',
          'null',
          '-'
        ],
        { encoding: 'utf8' }
      ).stderr
    )?.[1] ?? 'NaN'
  )
let original = ''
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  // The episode's sound: a tone in the hook and from 8.9 s, silence between,
  // so a stretch cut from the wrong place is heard.
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x808080:s=320x180:r=30:d=18.5',
    '-f',
    'lavfi',
    '-i',
    "aevalsrc='0.5*sin(2*PI*440*t)*(lt(t,4)+gte(t,8.9))':s=48000:d=18.5",
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    join(work, 'episode.mp4')
  ])
  const bytes = await readFile(join(work, 'episode.mp4'))
  const store = (kind: string) =>
    storeAsset({
      body: bytes,
      contentType: 'video/mp4',
      extension: '.mp4',
      kind,
      projectId: 'rb'
    })
  const video = await store('produced-video')
  original = (await store('teaser')).objectKey
  const project = episode(
    'rb',
    [
      [4, 3, 2.5],
      [3, 3, 3]
    ],
    video.objectKey
  )
  project.release!.teasers = [
    teaser({
      segments: [
        { from: 0, to: 4 },
        { from: 9, to: 15.8 }
      ],
      objectKey: original,
      small: 9
    })
  ]
  project.release!.campaign = [
    {
      id: 'teaser-x--3',
      channel: 'x',
      asset: 'teaser-x',
      kind: 'teaser',
      words: 'Two lattes, one tap.',
      offsetDays: -3,
      time: '18:00',
      state: 'approved'
    }
  ]
  const production = productionDir('rb', 'sb')
  await mkdir(production, { recursive: true })
  await writeFile(join(production, 'frame.md'), '# Design\n')
  await writeFile(
    join(production, 'caption_groups.json'),
    JSON.stringify({
      groups: [
        { start: 0.5, end: 2.5, text: 'One tap.' },
        { start: 10, end: 12, text: 'Then two lattes.' }
      ]
    })
  )
  await writeRow('projects', 'rb', {
    project,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
}, 60_000)

const current = async () =>
  (await loadProject('rb'))!.project.release!.teasers[0]
const zipNames = async () => {
  // The thumbnail approved as shown (round 2): the bundle waits for it.
  await updateRelease('rb', {
    approveCover: coverStamp((await loadProject('rb'))!.project)
  })
  const zip = join(work, `bundle-${Math.random()}.zip`)
  await writeFile(zip, (await uploadBundle('rb')).bytes)
  return execFileSync('unzip', ['-Z1', zip]).toString().trim().split('\n')
}

it('keeps a draft out of the bundle and the campaign until it is drawn again, then cuts it from its portrait frames, measured (F16, round 1)', async () => {
  expect(await zipNames()).not.toContain('short-1.mp4')
  await expect(postItem('rb', { item: 'teaser-x--3' })).rejects.toThrow(
    'Its teaser needs a portrait cut: rebuild it, or keep it as it is, first'
  )
  expect(posted).not.toHaveBeenCalled()
  // The frame agent's stand-in draws each frame; the progress counts them.
  const progress: number[] = []
  drawn.mockImplementation(async (input) => {
    progress.push((await current()).rebuild!.done)
    await writeFile(
      join(input.dir, 'compositions', 'frames', `${input.frameId}.html`),
      `<template><h1 style="font-size:96px">${input.frameId}</h1></template>`
    )
  })
  // The first render fails: the rebuild says so and can be tried again.
  rendered.mockRejectedValueOnce(new Error('Chrome went away'))
  const started = await rebuildTeaser('rb', { teaser: 't' })
  expect(started.project.release!.teasers[0].rebuild).toMatchObject({
    state: 'rebuilding',
    frames: 3,
    done: 0
  })
  await expect(rebuildTeaser('rb', { teaser: 't' })).rejects.toThrow(
    'being drawn again now'
  )
  await vi.waitFor(
    async () => expect((await current()).rebuild?.state).toBe('failed'),
    { timeout: 30_000, interval: 100 }
  )
  expect((await current()).rebuild).toMatchObject({
    done: 3,
    error: 'It could not be drawn again: try again'
  })
  expect(progress).toEqual([0, 1, 2])
  const dir = join(productionDir('rb', 'sb'), 'shapes', '1080x1920')
  expect(drawn.mock.calls.map(([input]) => input)).toEqual(
    [
      ['f01-frame-1', 1, 4],
      ['f04-frame-4', 4, 3],
      ['f05-frame-5', 5, 3]
    ].map(([frameId, number, duration]) =>
      expect.objectContaining({
        projectId: 'rb',
        dir,
        frameId,
        number,
        duration,
        build: 'faceless',
        canvas: expect.objectContaining({ width: 1080, height: 1920 }),
        selection: { adapter: 'claude-code' }
      })
    )
  )
  expect((await current()).objectKey).toBe(original)
  // Again, through the route Release calls: the frames drawn already are
  // kept, only the render runs.
  rendered.mockImplementation(drawShape)
  const { studioRoute } = await import('./studio-routes')
  expect(
    await studioRoute(
      new URL('http://studio.test/api/projects/rb/teasers'),
      { method: 'POST' } as never,
      { action: 'rebuild', teaser: 't' },
      {} as never
    )
  ).toMatchObject({ status: 200 })
  await vi.waitFor(
    async () => expect((await current()).rebuild?.state).toBe('ready'),
    { timeout: 60_000, interval: 200 }
  )
  expect(drawn).toHaveBeenCalledTimes(3)
  expect(rendered.mock.calls.at(-1)!.slice(1)).toEqual([
    expect.objectContaining({ width: 1080, height: 1920 }),
    [
      { frameId: 'f01-frame-1', duration: 4 },
      { frameId: 'f04-frame-4', duration: 3 },
      { frameId: 'f05-frame-5', duration: 3 }
    ]
  ])
  const rebuilt = await current()
  expect(rebuilt.objectKey).not.toBe(original)
  expect(rebuilt.small).toBeUndefined()
  expect(shape.needsShapeCut(rebuilt)).toBe(false)
  await vi.waitFor(async () =>
    expect((await loadProject('rb'))!.events.at(-1)?.message).toBe(
      'Drew the 9:16 teaser’s 3 frames again for portrait'
    )
  )
  const view = page((await loadProject('rb'))!.project)
  expect(view.querySelector('.teaser-note')?.textContent).toBe(
    'Its frames drawn again for portrait.'
  )
  expect(view.querySelector('a[download]')).not.toBeNull()
  expect(view.querySelector('[data-action="teaser-rebuild"]')).toBeNull()
  // The cut: 1080×1920, the teaser's length, with sound.
  const file = join(work, 'rebuilt.mp4')
  await writeFile(file, await readAsset(rebuilt.objectKey!))
  const probe = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height,duration',
      '-of',
      'json',
      file
    ]).toString()
  )
  expect(
    probe.streams.map((item: { codec_type: string }) => item.codec_type)
  ).toEqual(['video', 'audio'])
  expect(probe.streams[0]).toMatchObject({ width: 1080, height: 1920 })
  expect(Math.abs(Number(probe.streams[0].duration) - 10.8)).toBeLessThan(0.1)
  expect(Math.abs(Number(probe.streams[1].duration) - 10.8)).toBeLessThan(0.1)
  // Each stretch from its own frame at its own moment: the hook's frame 1
  // two seconds in; frame 4's first picture held for frame 3's sliver;
  // frame 4 and 5 a second and a half in; frame 5's last picture held for
  // frame 6's 0.3 s.
  const hook = lumaAt(file, 2)
  expect(Math.abs(hook.at(12, 800) - 30)).toBeLessThan(8)
  expect(Math.abs(hook.bar() - 200)).toBeLessThan(10)
  const sliver = lumaAt(file, 4.25)
  expect(Math.abs(sliver.at(12, 800) - 57)).toBeLessThan(8)
  expect(sliver.bar()).toBeLessThan(6)
  const four = lumaAt(file, 6)
  expect(Math.abs(four.at(12, 800) - 57)).toBeLessThan(8)
  expect(Math.abs(four.bar() - 150)).toBeLessThan(10)
  const five = lumaAt(file, 9)
  expect(Math.abs(five.at(12, 800) - 85)).toBeLessThan(8)
  expect(Math.abs(five.bar() - 150)).toBeLessThan(10)
  const held = lumaAt(file, 10.7)
  expect(Math.abs(held.at(12, 800) - 85)).toBeLessThan(8)
  expect(held.bar()).toBeGreaterThan(288)
  // Phone-sized: drawn at full size (the 16:9 frame fitted to 9:16 showed
  // it at 0.56), its detail filling two thirds of the picture (the old
  // strip's was a quarter).
  expect(four.stripe() / 24).toBeGreaterThan(0.95)
  expect(four.stripe() / 24).toBeLessThan(1.1)
  expect(four.sharp()).toBeGreaterThan(0.6)
  // The teaser's captions in the caption band, only while spoken.
  expect(hook.darkIn(1600, 1920)).toBe(true)
  expect(lumaAt(file, 3.3).darkIn(1600, 1920)).toBe(false)
  expect(four.darkIn(1600, 1920)).toBe(true)
  // The episode's sound for each stretch: the beat's tone, never the
  // silence after the hook (heard had the sound run on from 4 s, or the
  // beat's been cut from 0 s).
  const silence = join(work, 'episode.mp4')
  expect(loudness(silence, 4.6, 1)).toBeLessThan(-60)
  expect(loudness(file, 4.6, 1)).toBeGreaterThan(-30)
  expect(loudness(file, 8.4, 1.6)).toBeGreaterThan(-30)
  // Finished now: bundled, and posted with the campaign.
  expect(await zipNames()).toContain('short-1.mp4')
  posted.mockResolvedValue('https://x.com/i/status/1')
  await postItem('rb', { item: 'teaser-x--3' })
  expect(posted.mock.calls[0][1]).toEqual(await readAsset(rebuilt.objectKey!))
}, 180_000)

it('says why a frame was not drawn again, and keeps a draft as it is on the creator’s word (F16, round 1)', async () => {
  const project = episode(
    'keep',
    [
      [4, 3, 2.5],
      [3, 3, 3]
    ],
    'v.mp4'
  )
  const busy = { state: 'rebuilding' as const, frames: 3, done: 1, at: '' }
  project.release!.teasers = [
    teaser({ segments: [{ from: 0, to: 10 }], small: 9 }),
    teaser({ id: 'x', channel: 'x', aspect: '1:1', rebuild: busy }),
    teaser({ id: 'other', segments: [{ from: 0, to: 10 }], small: 9 })
  ]
  await writeRow('projects', 'keep', {
    project,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  let stop!: () => void
  const stopped = new Promise<void>((done) => (stop = done))
  drawn.mockImplementationOnce(async () => {
    await stopped
    throw new HarnessStageError(undefined, 'Frame 1 was not drawn again')
  })
  // A square one drawn now does not hold up a portrait one.
  await rebuildTeaser('keep', { teaser: 't' })
  // One shape's frames are drawn in one folder at a time.
  await expect(rebuildTeaser('keep', { teaser: 'other' })).rejects.toThrow(
    'Another teaser’s frames are being drawn for portrait now: wait for it'
  )
  stop()
  const now = async () =>
    (await loadProject('keep'))!.project.release!.teasers[0]
  await vi.waitFor(
    async () => expect((await now()).rebuild?.state).toBe('failed'),
    { timeout: 30_000, interval: 100 }
  )
  expect((await now()).rebuild?.error).toBe('Frame 1 was not drawn again')
  expect(shape.needsShapeCut(await now())).toBe(true)
  // Kept through the route Release calls.
  const { studioRoute } = await import('./studio-routes')
  const reply = await studioRoute(
    new URL('http://studio.test/api/projects/keep/teasers'),
    { method: 'POST' } as never,
    { action: 'keep', teaser: 't' },
    {} as never
  )
  expect(reply).toMatchObject({ status: 200 })
  expect((await now()).kept).toBe(true)
  expect(shape.needsShapeCut(await now())).toBe(false)
  await expect(keepTeaser('keep', { teaser: 'gone' })).rejects.toThrow(
    'That teaser is gone'
  )
})
