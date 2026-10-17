import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { Teaser } from '../shared/release'

// Review 8, round 3: the end of a teaser's rebuild. The frame agent and
// Hyperframes' render are stand-ins (the render is a white picture made
// with ffmpeg), and so is the browser's failure to measure; the cut is
// real. These checks prove the plumbing, never what a model draws.
const { drawn, rendered, sizes, readyAt } = vi.hoisted(() => ({
  drawn: vi.fn(),
  rendered: vi.fn(),
  sizes: vi.fn(),
  readyAt: vi.fn()
}))
vi.mock('./teaser-portrait-run', async (original) => ({
  ...(await original<typeof import('./teaser-portrait-run')>()),
  drawFrameForShape: drawn,
  renderShape: rendered
}))
vi.mock('./teaser-type', async (original) => {
  const actual = await original<typeof import('./teaser-type')>()
  sizes.mockImplementation(actual.typeSizes)
  return { ...actual, typeSizes: sizes }
})
// Each change to a notebook, watched for the moment a rebuild is ready.
vi.mock('./projects', async (original) => {
  const actual = await original<typeof import('./projects')>()
  return {
    ...actual,
    changeProject: (async (
      ...args: Parameters<typeof actual.changeProject>
    ) => {
      const result = await actual.changeProject(...args)
      const teaser = result.project.release?.teasers[0]
      if (teaser?.rebuild?.state === 'ready') readyAt(result.project.id)
      return result
    }) as typeof actual.changeProject
  }
})
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-portrait-4-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY = '1'
const { keepTeaser, rebuildTeaser } = await import('./teaser-portrait')
const { storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { productionDir } = await import('./storyboard/workspace')
const { teasersSection } = await import('../app/release-view')
const { needsShapeCut } = await import('../shared/teaser-shape')
const { parseHTML } = await import('linkedom')
afterAll(() => rm(root, { recursive: true, force: true }))

const work = join(root, 'work')
let videoKey = ''
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-y', '-f', 'lavfi'],
    ...['-i', 'color=c=0x808080:s=320x180:r=30:d=16'],
    ...['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'],
    join(work, 'episode.mp4')
  ])
  videoKey = (
    await storeAsset({
      body: await readFile(join(work, 'episode.mp4')),
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'produced-video',
      projectId: 'r3'
    })
  ).objectKey
})

/** A storyboard episode of one scene, its frames 4, 3, 3 and 3 s long. */
const episode = (id: string, teasers: Teaser[]): Project =>
  ({
    id,
    title: 'One click, two lattes',
    source: '',
    slides: [{ id: 'p0', title: 'Page 1', svg: '' }],
    video: {
      settings: {
        presence: 'off',
        voice: { kind: 'record' },
        harness: { adapter: 'claude-code' }
      },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { inputKey: 'sb', objectKey: videoKey },
      storyboard: {
        id: 'sb',
        pages: ['p0'],
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
              pageId: 'p0',
              build: 'faceless',
              buildReason: '',
              frames: [4, 3, 3, 3].map((duration, index) => ({
                number: index + 1,
                title: `Frame ${index + 1}`,
                type: index ? 'explain' : 'hook',
                duration,
                voiceover: `Line ${index + 1}.`,
                transition: 'cut'
              }))
            }
          ]
        }
      }
    },
    release: { teasers, campaign: [] }
  }) as unknown as Project
const teaser: Teaser = {
  id: 't',
  channel: 'youtube',
  aspect: '9:16',
  segments: [{ from: 0, to: 13 }],
  state: 'ready',
  objectKey: 'k',
  small: 13,
  at: ''
}
/** The stand-in render: a white picture at the canvas, the frames' length. */
const whiteRender = async (
  dir: string,
  canvas: { width: number; height: number },
  frames: Array<{ duration: number }>
) => {
  const out = join(dir, 'renders', 'teaser.mp4')
  await mkdir(join(dir, 'renders'), { recursive: true })
  const seconds = frames.reduce((sum, frame) => sum + frame.duration, 0)
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-y', '-f', 'lavfi'],
    ...[
      '-i',
      `color=c=white:s=${canvas.width}x${canvas.height}:r=30:d=${seconds}`
    ],
    ...['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'],
    out
  ])
  return out
}
/** A production whose captions fall outside the teaser; its shape's
 * frames folder. */
const production = async (id: string) => {
  const dir = productionDir(id, 'sb')
  const frames = join(dir, 'shapes', '1080x1920', 'compositions', 'frames')
  await mkdir(frames, { recursive: true })
  await writeFile(join(dir, 'frame.md'), '# Design\n')
  await writeFile(
    join(dir, 'caption_groups.json'),
    JSON.stringify({ groups: [{ start: 100, end: 101, text: 'Later.' }] })
  )
  return frames
}
const save = (project: Project) =>
  writeRow('projects', project.id, {
    project,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
const view = async (id: string) =>
  parseHTML(
    `<div>${teasersSection({ project: (await loadProject(id))!.project, status: 'ready', error: null, events: [] })}</div>`
  ).document
const now = async (id: string) =>
  (await loadProject(id))!.project.release!.teasers[0]
/** The rebuild over, ready with a new cut (a failure is said at once). */
const ready = async (id: string, before?: string) => {
  await vi.waitFor(
    async () => expect((await now(id)).rebuild?.state).not.toBe('rebuilding'),
    { timeout: 60_000, interval: 100 }
  )
  const current = await now(id)
  expect([current.rebuild?.state, current.rebuild?.error]).toEqual([
    'ready',
    undefined
  ])
  if (before) expect(current.objectKey).not.toBe(before)
}
/** The frame agent's stand-in: frame 3 keeps a 28 px label. */
const draws = () =>
  drawn.mockImplementation(async (input) =>
    writeFile(
      join(input.dir, 'compositions', 'frames', `${input.frameId}.html`),
      `<template><h1 style="font-size:96px">${input.frameId}</h1>${input.number === 3 ? '<p style="font-size:28px">per tap</p>' : ''}</template>`
    )
  )

it('lets a small frame’s files go before the rebuild says it is ready, so a rebuild then draws it again (round 3)', async () => {
  await save(episode('tidy', [teaser]))
  const frames = await production('tidy')
  const small = join(frames, 'f03-frame-3.html')
  draws()
  rendered.mockImplementation(whiteRender)
  // What a rebuild clicked the moment it is ready would find on disk.
  const seen: boolean[] = []
  readyAt.mockImplementation((id: string) => {
    if (id === 'tidy') seen.push(existsSync(small))
  })
  await rebuildTeaser('tidy', { teaser: 't' })
  await ready('tidy')
  expect(seen[0]).toBe(false)
  expect((await now('tidy')).rebuild?.smallFrames).toEqual([3])
  // The rebuild then draws frame 3 again, the rest kept.
  const first = (await now('tidy')).objectKey
  drawn.mockClear()
  await rebuildTeaser('tidy', { teaser: 't' })
  await ready('tidy', first)
  expect(drawn.mock.calls.map(([input]) => input.frameId)).toEqual([
    'f03-frame-3'
  ])
}, 120_000)

it('keeps a rebuilt cut whose words a failed browser could not measure, says so, and lets the creator keep it or rebuild (round 3)', async () => {
  await save(episode('unmeasured', [teaser]))
  const frames = await production('unmeasured')
  draws()
  rendered.mockImplementation(whiteRender)
  drawn.mockClear()
  sizes.mockRejectedValueOnce(new Error('Failed to launch the browser process'))
  await rebuildTeaser('unmeasured', { teaser: 't' })
  await ready('unmeasured', 'k')
  // Every frame was drawn (and paid for): the cut is kept, a draft.
  expect(drawn).toHaveBeenCalledTimes(4)
  const cut = await now('unmeasured')
  expect(cut.rebuild).toMatchObject({ state: 'ready', unchecked: true })
  expect(cut.rebuild?.error).toBeUndefined()
  expect(needsShapeCut(cut)).toBe(true)
  // No frame's files go: none is known to be small.
  expect(existsSync(join(frames, 'f03-frame-3.html'))).toBe(true)
  const draft = await view('unmeasured')
  expect(draft.querySelector('.teaser-small')?.textContent).toBe(
    'Needs a portrait cut. Drawn again, but its text size could not be checked: watch it, then keep it or rebuild.'
  )
  expect(
    draft
      .querySelector('[data-action="teaser-rebuild"]')
      ?.getAttribute('data-frames')
  ).toBe('0')
  expect(draft.querySelector('.teaser-cost')?.textContent).toBe(
    'Its frames are kept: no AI run unless the episode changed since'
  )
  expect(draft.querySelector('[data-action="teaser-keep"]')).not.toBeNull()
  expect(draft.querySelector('a[download]')).toBeNull()
  // Rebuilt, nothing is drawn again: its words are measured this time.
  drawn.mockClear()
  await rebuildTeaser('unmeasured', { teaser: 't' })
  await ready('unmeasured', cut.objectKey)
  expect(drawn).not.toHaveBeenCalled()
  const measured = await now('unmeasured')
  expect(measured.rebuild?.unchecked).toBeUndefined()
  expect(measured.rebuild?.smallFrames).toEqual([3])
  expect(measured.small).toBe(3)
  // Or kept as it is, unmeasured: offered as finished.
  await save(
    episode('kept', [
      {
        ...teaser,
        rebuild: { state: 'ready', frames: 4, done: 4, at: '', unchecked: true }
      }
    ])
  )
  await keepTeaser('kept', { teaser: 't' })
  expect(needsShapeCut(await now('kept'))).toBe(false)
  expect((await view('kept')).querySelector('a[download]')).not.toBeNull()
}, 180_000)
