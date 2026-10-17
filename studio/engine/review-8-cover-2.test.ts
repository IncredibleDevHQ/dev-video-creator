import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// Review 8, round 2: the YouTube thumbnail never shows captions, can carry
// the title, and goes out only once the creator approves it. Pictures are
// made with ffmpeg from flat colours, a white bar standing for a caption;
// YouTube is never called.
const { notebook } = vi.hoisted(() => ({ notebook: vi.fn() }))
vi.mock('../app/studio-api', () => ({
  studioApi: { request: vi.fn(), notebook }
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-cover-2-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { parseHTML } = await import('linkedom')
const { uploadBundle, updateRelease } = await import('./release')
const { coverFor, coverImage } = await import('./release-cover')
const { publishToYouTube } = await import('./youtube-publish')
const { storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { productionDir } = await import('./storyboard/workspace')
const cover = await import('../shared/release-cover')
const { youtubeSection } = await import('../app/release-view')
const { clickRelease } = await import('../app/release-controller')
afterAll(() => rm(root, { recursive: true, force: true }))

const work = join(root, 'work')
/** A green picture or clip with a white bar where a caption sits, from
 * `top` to `bottom` px of 1080. */
const captioned = (name: string, top: number, bottom: number, seconds = 0) => {
  const file = join(work, name)
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=green:s=1920x1080:r=30${seconds ? `:d=${seconds}` : ''}`,
    '-vf',
    `drawbox=x=660:y=${top}:w=600:h=${bottom - top}:color=white:t=fill`,
    ...(seconds
      ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p']
      : ['-frames:v', '1']),
    file
  ])
  return file
}
/** A JPEG's size, its brightest pixel and the share of near-white pixels
 * in a box, as luma. */
const looks = (bytes: Buffer) => {
  const file = join(work, `look-${Math.random()}.jpg`)
  execFileSync('tee', [file], { input: bytes })
  const [width, height] = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    file
  ])
    .toString()
    .trim()
    .split(',')
    .map(Number)
  const luma = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'],
    { maxBuffer: 1 << 24 }
  )
  const rgb = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      file,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1'
    ],
    { maxBuffer: 1 << 24 }
  )
  const white = (x0: number, y0: number, x1: number, y1: number) => {
    let count = 0
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) if (luma[y * width + x] > 200) count++
    return count / ((x1 - x0) * (y1 - y0))
  }
  const at = (x: number, y: number) =>
    [0, 1, 2].map((channel) => rgb[(y * width + x) * 3 + channel])
  return { width, height, white, at }
}

let videoKey = ''
let olderKey = ''
let posterKey = ''
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  const store = async (file: string, kind: string, type: string) =>
    (
      await storeAsset({
        body: await readFile(file),
        contentType: type,
        extension: type === 'video/mp4' ? '.mp4' : '.jpg',
        kind,
        projectId: 'cover-2'
      })
    ).objectKey
  // A storyboard episode burns its captions into its lowest sixth; an
  // older video into its lowest fifth.
  videoKey = await store(
    captioned('board.mp4', 940, 1040, 12),
    'produced-video',
    'video/mp4'
  )
  olderKey = await store(
    captioned('older.mp4', 880, 1000, 12),
    'produced-video',
    'video/mp4'
  )
  posterKey = await store(
    captioned('poster.jpg', 880, 1000),
    'poster',
    'image/jpeg'
  )
})

const frame = (number: number, title: string, type: string) => ({
  number,
  title,
  type,
  duration: 4,
  voiceover: `Words of frame ${number}`
})
/** A storyboard episode of three frames, posed or not. */
const episode = (id: string): Project => ({
  id,
  title: 'One click, two lattes',
  source: '',
  slides: [],
  episode: { series: 'none', number: 3 },
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: [],
    transitions: [],
    inputKey: '',
    produced: { inputKey: 'sb-1', objectKey: videoKey },
    storyboard: {
      id: 'sb-1',
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
            frames: [
              frame(1, 'The hook', 'hook'),
              frame(2, 'Two lattes', 'explain'),
              frame(3, 'The receipt', 'explain')
            ]
          }
        ]
      }
    }
  } as never,
  release: { teasers: [], campaign: [] }
})
/** An older video, made scene by scene: timed, or only its poster. */
const older = (id: string, timed: boolean): Project => ({
  id,
  title: 'The outage',
  source: '',
  slides: [{ id: 's0', title: 'Impact', svg: '' }],
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: [
      {
        id: 'scene-0',
        slideId: 's0',
        phase: 'produced',
        presence: null,
        moments: [{ id: 'm', lines: 'It broke.', start: 0, end: 12 }],
        inputKey: '',
        produced: null,
        error: null
      }
    ],
    transitions: [],
    inputKey: '',
    produced: {
      inputKey: '',
      objectKey: olderKey,
      ...(timed
        ? { clock: [{ sceneId: 'scene-0', start: 0, duration: 12 }] }
        : { posterKey })
    }
  } as never,
  release: { teasers: [], campaign: [] }
})
const snapshot = (value: Project): Snapshot => ({
  project: value,
  status: 'ready',
  error: null,
  events: []
})
const save = (value: Project) => writeRow('projects', value.id, snapshot(value))
const page = (value: Project) =>
  parseHTML(`<div>${youtubeSection(snapshot(value))}</div>`).document
const approve = async (id: string) =>
  updateRelease(id, {
    approveCover: cover.coverStamp((await loadProject(id))!.project)
  })
const thumbnailOf = async (id: string) => {
  const zip = join(work, `${id}-${Math.random()}.zip`)
  await writeFile(zip, (await uploadBundle(id)).bytes)
  return execFileSync('unzip', ['-p', zip, 'thumbnail.jpg'], {
    maxBuffer: 1 << 26
  })
}

it('takes a thumbnail from the made video without its caption band, filling the picture (F19, round 2)', async () => {
  // Unposed, a storyboard frame's thumbnail is its last picture in the
  // video: the caption bar in its lowest sixth is left out.
  const board = await coverImage(episode('board'))
  const seen = looks(board)
  expect([seen.width, seen.height]).toEqual([1280, 720])
  expect(seen.white(0, 0, 1280, 720)).toBe(0)
  // No bars: the picture's own colour reaches its corners.
  for (const [x, y] of [
    [4, 4],
    [1275, 715]
  ]) {
    const [r, g, b] = seen.at(x, y)
    expect(g).toBeGreaterThan(90)
    expect(Math.max(r, b)).toBeLessThan(40)
  }
  // An older video's scene: its lowest fifth.
  expect(
    looks(await coverImage(older('scenes', true))).white(0, 0, 1280, 720)
  ).toBe(0)
  // A video with no timed scenes offers its poster, captions left out too.
  const posterOnly = older('poster', false)
  expect(cover.coverChoices(posterOnly)).toEqual([
    { key: 'poster', label: 'The video’s opening picture', poster: true }
  ])
  expect(looks(await coverImage(posterOnly)).white(0, 0, 1280, 720)).toBe(0)
  expect(
    looks(await coverFor(posterOnly, new URLSearchParams('poster=1'))).white(
      0,
      0,
      1280,
      720
    )
  ).toBe(0)
}, 60_000)

it('sets the title over the thumbnail on the creator’s word, large on the left, the picture on the right (F19, round 2)', async () => {
  await save(episode('titled'))
  const plain = looks(await coverImage((await loadProject('titled'))!.project))
  expect(plain.white(80, 160, 720, 560)).toBe(0)
  await updateRelease('titled', { coverTitle: true })
  const project = (await loadProject('titled'))!.project
  expect(cover.coverTitled(project)).toBe(true)
  const titled = looks(await coverImage(project))
  expect([titled.width, titled.height]).toEqual([1280, 720])
  // The title's letters, white on a shade, fill part of the left…
  expect(titled.white(80, 160, 720, 560)).toBeGreaterThan(0.04)
  const [r, g, b] = titled.at(30, 360)
  expect(Math.max(r, g, b)).toBeLessThan(40)
  // …and the picture shows on the right, as it was.
  const [, right] = titled.at(1240, 360)
  expect(right).toBeGreaterThan(90)
  // The dialog shows the titled picture, the same as the bundle's.
  const view = page(project)
  const shown = view.querySelector<HTMLImageElement>('.release-cover img')!
  expect(shown.getAttribute('src')).toBe(
    '/api/projects/titled/cover?at=3.85&title=1'
  )
  expect(
    Buffer.compare(
      await coverFor(project, new URLSearchParams('at=3.85&title=1')),
      await coverImage(project)
    )
  ).toBe(0)
  const toggle = view.querySelector('[data-action="cover-title"]')!
  expect(toggle.textContent).toBe('Title on it')
  expect(toggle.getAttribute('aria-pressed')).toBe('true')
  // Taken off again on a click.
  notebook.mockResolvedValue(snapshot(project))
  const app = {
    snapshot: snapshot(project),
    dialog: { open: false, dataset: {}, querySelector: () => null },
    showDialog: vi.fn()
  }
  await clickRelease(app as never, toggle as never, 'cover-title')
  expect(notebook.mock.calls.at(-1)!.slice(1)).toEqual([
    'release',
    { coverTitle: false }
  ])
}, 60_000)

it('keeps the bundle and the upload waiting until the creator approves the thumbnail as shown (F19, round 2)', async () => {
  await save(episode('approve'))
  await expect(uploadBundle('approve')).rejects.toThrow(
    'Approve the thumbnail first: Release shows it'
  )
  await expect(
    publishToYouTube('approve', { privacy: 'private' })
  ).rejects.toThrow('Approve the thumbnail first: Release shows it')
  // The dialog asks for it, and offers neither the bundle nor the upload.
  const project = (await loadProject('approve'))!.project
  const waiting = page(project)
  const button = waiting.querySelector<HTMLElement>(
    '[data-action="approve-cover"]'
  )!
  expect(button.textContent).toBe('Approve the thumbnail')
  expect(button.getAttribute('class')).toBe('primary')
  expect(button.dataset.stamp).toBe(cover.coverStamp(project))
  expect(waiting.querySelector('a[href$="/bundle"]')).toBeNull()
  expect(
    [...waiting.querySelectorAll('button')]
      .filter((item) => item.hasAttribute('disabled'))
      .map((item) => item.textContent)
  ).toEqual(['Download the upload bundle', 'Upload to YouTube'])
  expect(waiting.querySelector('.release-note')?.textContent).toMatch(
    /^Approve the thumbnail first\. /
  )
  notebook.mockResolvedValue(snapshot(project))
  const app = {
    snapshot: snapshot(project),
    dialog: { open: false, dataset: {}, querySelector: () => null },
    showDialog: vi.fn()
  }
  await clickRelease(app as never, button as never, 'approve-cover')
  expect(notebook.mock.calls.at(-1)!.slice(1)).toEqual([
    'release',
    { approveCover: cover.coverStamp(project) }
  ])
  // Only the thumbnail as shown is approved.
  await expect(
    updateRelease('approve', { approveCover: 'frame-1|||' })
  ).rejects.toThrow('The thumbnail changed: look at it again')
  await approve('approve')
  const approved = (await loadProject('approve'))!
  expect(cover.coverApproved(approved.project)).toBe(true)
  expect(approved.events.at(-1)?.message).toBe('Approved the YouTube thumbnail')
  const ready = page(approved.project)
  expect(ready.querySelector('.cover-approved')?.textContent).toBe('Approved')
  expect(ready.querySelector('[data-action="approve-cover"]')).toBeNull()
  expect(ready.querySelector('a[href$="/bundle"]')).not.toBeNull()
  expect(looks(await thumbnailOf('approve')).width).toBe(1280)
  // Another picture, or the title set over it, asks for approval again.
  await updateRelease('approve', { cover: { at: 7.85 } })
  await expect(uploadBundle('approve')).rejects.toThrow('Approve the thumbnail')
  await approve('approve')
  await updateRelease('approve', { coverTitle: true })
  const changed = (await loadProject('approve'))!.project
  expect(changed.release!.cover).toEqual({ at: 7.85, titled: true })
  await expect(uploadBundle('approve')).rejects.toThrow('Approve the thumbnail')
  // A video with no picture to offer sends none: YouTube Studio sets it.
  const bare = older('bare', false)
  delete (bare.video!.produced as { posterKey?: string }).posterKey
  await save(bare)
  const zip = join(work, 'bare.zip')
  await writeFile(zip, (await uploadBundle('bare')).bytes)
  expect(execFileSync('unzip', ['-Z1', zip]).toString()).not.toContain(
    'thumbnail.jpg'
  )
  expect(execFileSync('unzip', ['-p', zip, 'README.txt']).toString()).toContain(
    '3. Choose a thumbnail in YouTube Studio.'
  )
}, 60_000)
