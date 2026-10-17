import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
import type { Teaser } from '../shared/release'

// Review 8, round 2: a teaser's frames drawn again for its shape. The frame
// agent and Hyperframes' render are stand-ins (the render is a white
// picture at the teaser's canvas, made with ffmpeg); the cut from it is
// real. These checks prove the plumbing, never what a model draws.
const { drawn, rendered } = vi.hoisted(() => ({
  drawn: vi.fn(),
  rendered: vi.fn()
}))
vi.mock('./teaser-portrait-run', async (original) => ({
  ...(await original<typeof import('./teaser-portrait-run')>()),
  drawFrameForShape: drawn,
  renderShape: rendered
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-portrait-3-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
process.env.MINIMAL_STUDIO_FRAME_CONCURRENCY = '1'
const { rebuildTeaser } = await import('./teaser-portrait')
const { RESTARTED, settleInterruptedWork } = await import('./studio-recovery')
const { storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { productionDir } = await import('./storyboard/workspace')
const { teasersSection } = await import('../app/release-view')
const { parseHTML } = await import('linkedom')
afterAll(() => rm(root, { recursive: true, force: true }))

const work = join(root, 'work')
let videoKey = ''
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x808080:s=320x180:r=30:d=16',
    '-f',
    'lavfi',
    '-i',
    "aevalsrc='0.5*sin(2*PI*440*t)':s=48000:d=16",
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
  videoKey = (
    await storeAsset({
      body: await readFile(join(work, 'episode.mp4')),
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'produced-video',
      projectId: 'r2'
    })
  ).objectKey
})

/** A storyboard episode of one scene, its frames 4, 3, 3 and 3 s long. */
export const episode = (id: string, teasers: Teaser[]): Project =>
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

export const teaser = (more: Partial<Teaser> = {}): Teaser => ({
  id: 't',
  channel: 'youtube',
  aspect: '9:16',
  segments: [{ from: 0, to: 13 }],
  state: 'ready',
  objectKey: 'k',
  small: 13,
  at: '',
  ...more
})

/** The stand-in render: a white picture at the canvas, the frames' length. */
export const whiteRender = async (
  dir: string,
  canvas: { width: number; height: number },
  frames: Array<{ duration: number }>
) => {
  const out = join(dir, 'renders', 'teaser.mp4')
  await mkdir(join(dir, 'renders'), { recursive: true })
  const seconds = frames.reduce((sum, frame) => sum + frame.duration, 0)
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=white:s=${canvas.width}x${canvas.height}:r=30:d=${seconds}`,
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

/** A production whose caption groups fall outside every teaser: the cut
 * needs no browser to draw its captions. */
export const production = async (id: string) => {
  const dir = productionDir(id, 'sb')
  await mkdir(join(dir, 'shapes', '1080x1920', 'compositions', 'frames'), {
    recursive: true
  })
  await writeFile(join(dir, 'frame.md'), '# Design\n')
  await writeFile(
    join(dir, 'caption_groups.json'),
    JSON.stringify({ groups: [{ start: 100, end: 101, text: 'Later.' }] })
  )
  return dir
}

const save = (project: Project) =>
  writeRow('projects', project.id, {
    project,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)

it('stops a rebuild cut off by a restart, and a new one picks up from the frames drawn (round 2)', async () => {
  const under = { state: 'rebuilding' as const, frames: 4, done: 1, at: '' }
  await save(episode('r2', [teaser({ rebuild: under })]))
  // Frame 1 was drawn before the studio went away.
  const dir = await production('r2')
  const shape = join(dir, 'shapes', '1080x1920', 'compositions', 'frames')
  await writeFile(join(shape, 'f01-frame-1.html'), '<template>1</template>')
  await settleInterruptedWork()
  const now = async () =>
    (await loadProject('r2'))!.project.release!.teasers[0]
  expect((await now()).rebuild).toEqual({
    state: 'failed',
    frames: 4,
    done: 1,
    at: '',
    error: RESTARTED
  })
  // The row says it stopped and offers the rebuild again, never
  // "Drawing…" forever.
  const view = parseHTML(
    `<div>${teasersSection({ project: (await loadProject('r2'))!.project, status: 'ready', error: null, events: [] })}</div>`
  ).document
  expect(view.querySelector('.teaser-status')).toBeNull()
  expect(view.querySelector('.release-failed')?.textContent).toBe(RESTARTED)
  expect(view.querySelector('[data-action="teaser-rebuild"]')).not.toBeNull()
  // A new rebuild is taken, and draws only the frames not drawn yet.
  drawn.mockImplementation(async (input) =>
    writeFile(
      join(input.dir, 'compositions', 'frames', `${input.frameId}.html`),
      `<template>${input.frameId}</template>`
    )
  )
  rendered.mockImplementation(whiteRender)
  await rebuildTeaser('r2', { teaser: 't' })
  await vi.waitFor(
    async () => expect((await now()).rebuild?.state).toBe('ready'),
    { timeout: 60_000, interval: 200 }
  )
  expect(drawn.mock.calls.map(([input]) => input.frameId)).toEqual([
    'f02-frame-2',
    'f03-frame-3',
    'f04-frame-4'
  ])
}, 120_000)
