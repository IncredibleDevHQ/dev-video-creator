import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// Review 8, the YouTube thumbnail. Pictures are made with ffmpeg from flat
// colours, so each one says where it came from; YouTube is a stand-in.
const { notebook } = vi.hoisted(() => ({ notebook: vi.fn() }))
vi.mock('../app/studio-api', () => ({
  studioApi: { request: vi.fn(), notebook }
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-cover-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { parseHTML } = await import('linkedom')
const { uploadBundle, updateRelease } = await import('./release')
const { coverFor, coverImage } = await import('./release-cover')
const { publishToYouTube } = await import('./youtube-publish')
const { saveSetting, storeAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { productionDir } = await import('./storyboard/workspace')
const { coverChoices, chosenCover } = await import('../shared/release-cover')
const { youtubeSection } = await import('../app/release-view')
const { clickRelease } = await import('../app/release-controller')
afterAll(() => rm(root, { recursive: true, force: true }))
afterEach(() => vi.unstubAllGlobals())

const work = join(root, 'work')
/** A flat picture or clip of one colour, or of two colours one after the
 * other (the first for `split` seconds). */
const colour = async (name: string, colours: string[], seconds = 0) => {
  const file = join(work, name)
  const source = (c: string, d: number) =>
    `color=c=${c}:s=1920x1080:r=30${d ? `:d=${d}` : ''}`
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    ...(seconds
      ? [
          '-f',
          'lavfi',
          '-i',
          source(colours[0], colours[1] ? 2 : seconds),
          ...(colours[1]
            ? ['-f', 'lavfi', '-i', source(colours[1], seconds - 2)]
            : []),
          ...(colours[1]
            ? [
                '-filter_complex',
                '[0:v][1:v]concat=n=2:v=1:a=0[v]',
                '-map',
                '[v]'
              ]
            : []),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p'
        ]
      : ['-f', 'lavfi', '-i', source(colours[0], 0), '-frames:v', '1']),
    file
  ])
  return file
}
/** A JPEG's size and the colour at its middle. */
const looks = async (bytes: Buffer) => {
  const file = join(work, `look-${Math.random()}.jpg`)
  await writeFile(file, bytes)
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
  const [r, g, b] = execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    file,
    '-vf',
    'crop=8:8:(iw-8)/2:(ih-8)/2,scale=1:1',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    'pipe:1'
  ])
  const hue =
    r > 150 && g < 90 && b < 90
      ? 'red'
      : b > 150 && r < 90
        ? 'blue'
        : g > 100 && r < 90 && b < 90
          ? 'green'
          : `rgb(${r},${g},${b})`
  return { width, height, hue }
}

/** Each frame's still in a notebook's production: red, blue, yellow. */
const pose = async (projectId: string) => {
  const stills = join(productionDir(projectId, 'sb-1'), 'boards', 'stills')
  await mkdir(stills, { recursive: true })
  const names = ['f01-the-hook', 'f02-two-lattes', 'f03-on-camera']
  for (const [index, hue] of ['red', 'blue', 'yellow'].entries())
    await writeFile(
      join(stills, `${names[index]}.png`),
      await readFile(await colour(`${hue}.png`, [hue]))
    )
}

let videoKey = ''
beforeAll(async () => {
  await mkdir(work, { recursive: true })
  // The made video is green from start to end: a thumbnail taken from it
  // is green; one from a still is that still's colour.
  videoKey = (
    await storeAsset({
      body: await readFile(await colour('made.mp4', ['green'], 12)),
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'produced-video',
      projectId: 'cover'
    })
  ).objectKey
  await pose('cover')
  await writeRow('series', 'retries', {
    id: 'retries',
    title: 'APIs that survive retries',
    about: '',
    createdAt: '',
    growth: 'one',
    episodes: [],
    repos: [],
    threads: []
  })
})

const frame = (number: number, title: string, type: string) => ({
  number,
  title,
  type,
  duration: 4,
  voiceover: `Words of frame ${number}`,
  still: '2026-10-17T00:00:00.000Z'
})
// A storyboard episode of three frames: the hook and a second frame drawn,
// then a camera frame whose still holds a block for the take.
const episode = (id = 'cover'): Project => ({
  id,
  title: 'One click, two lattes',
  source: '',
  slides: [],
  episode: { series: 'retries', number: 1 },
  video: {
    settings: { presence: 'off', voice: { kind: 'record' } },
    scenes: [],
    transitions: [],
    inputKey: '',
    produced: { inputKey: 'sb-1', objectKey: videoKey },
    storyboard: {
      id: 'sb-1',
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
            frames: [
              frame(1, 'The hook', 'hook'),
              frame(2, 'Two lattes', 'pain_point')
            ]
          },
          {
            pageId: 'b',
            build: 'camera',
            buildReason: '',
            frames: [frame(3, 'On camera', 'hook')]
          }
        ]
      }
    }
  } as never,
  release: { teasers: [], campaign: [] }
})
const save = (value: Project) =>
  writeRow('projects', value.id, {
    project: value,
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
const thumbnailOf = async (id: string) => {
  const bundle = await uploadBundle(id)
  const zip = join(work, `${id}.zip`)
  await writeFile(zip, bundle.bytes)
  return execFileSync('unzip', ['-p', zip, 'thumbnail.jpg'], {
    maxBuffer: 1 << 26
  })
}

it('bundles the hook’s still as the thumbnail, at 1280×720, and the frame the creator picks instead (F19)', async () => {
  await save(episode())
  expect(await looks(await thumbnailOf('cover'))).toEqual({
    width: 1280,
    height: 720,
    hue: 'red'
  })
  // The dialog's preview is the same picture.
  const project = (await loadProject('cover'))!.project
  expect(
    Buffer.compare(
      await coverFor(project, new URLSearchParams()),
      await coverImage(project)
    )
  ).toBe(0)
  // Another frame, chosen from those offered; never one that is not.
  await expect(updateRelease('cover', { cover: { frame: 9 } })).rejects.toThrow(
    'Choose one of the thumbnails shown'
  )
  await updateRelease('cover', { cover: { frame: 2 } })
  expect((await looks(await thumbnailOf('cover'))).hue).toBe('blue')
  // A still gone from disk gives way to that frame's last picture in the
  // video, never a moment caught mid-way.
  await rm(
    join(
      productionDir('cover', 'sb-1'),
      'boards',
      'stills',
      'f02-two-lattes.png'
    )
  )
  expect((await looks(await thumbnailOf('cover'))).hue).toBe('green')
})

it('uploads with the same thumbnail and the series and episode in the title (F19)', async () => {
  await pose('cover-up')
  await save(episode('cover-up'))
  const expected = await coverImage(episode('cover-up'))
  await saveSetting('account-google', {
    access: 'g',
    name: 'Acme',
    at: '',
    scopes:
      'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl'
  })
  const sent: Array<{ url: string; body?: unknown }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      sent.push({ url: String(url), body: init.body })
      if (String(url).includes('uploadType=resumable'))
        return new Response(null, {
          status: 200,
          headers: { location: 'https://upload.example/session-1' }
        })
      if (String(url) === 'https://upload.example/session-1')
        return Response.json({
          id: 'vid1',
          status: { privacyStatus: 'private' }
        })
      if (String(url).includes('/playlists?part=snippet&mine=true'))
        return Response.json({ items: [] })
      if (String(url).includes('/playlists?part=snippet,status'))
        return Response.json({ id: 'pl1' })
      return Response.json({})
    })
  )
  await publishToYouTube('cover-up', { privacy: 'private' })
  await vi.waitFor(async () =>
    expect(
      (await loadProject('cover-up'))!.project.release!.youtube!.state
    ).toBe('uploaded')
  )
  const metadata = JSON.parse(String(sent[0].body))
  expect(metadata.snippet.title).toBe(
    'One click, two lattes | APIs that survive retries, episode 1'
  )
  const thumb = sent.find((call) => call.url.includes('thumbnails/set'))!
  expect(Buffer.compare(Buffer.from(thumb.body as Uint8Array), expected)).toBe(
    0
  )
  expect((await looks(expected)).hue).toBe('red')
})

it('shows the thumbnail before the bundle, with the other frames to choose from (F19)', async () => {
  const snapshot = (value: Project): Snapshot => ({
    project: value,
    status: 'ready',
    error: null,
    events: []
  })
  const value = episode()
  const page = parseHTML(
    `<div>${youtubeSection(snapshot(value))}</div>`
  ).document
  const shown = page.querySelector<HTMLImageElement>('.release-cover img')!
  expect(shown.getAttribute('src')).toBe('/api/projects/cover/cover?frame=1')
  expect(page.querySelector('.release-cover figcaption')?.textContent).toBe(
    'Thumbnail · Frame 1: The hook'
  )
  const choices = [...page.querySelectorAll<HTMLElement>('.cover-choice')]
  expect(choices.map((choice) => choice.dataset.frame)).toEqual(['1', '2', '3'])
  expect(choices.map((choice) => choice.getAttribute('aria-pressed'))).toEqual([
    'true',
    'false',
    'false'
  ])
  // Reviewed before it is downloaded or uploaded.
  const html = page.querySelector('section')!.innerHTML
  expect(html.indexOf('release-cover')).toBeLessThan(html.indexOf('/bundle'))
  // Picking one asks for it.
  const app = {
    snapshot: snapshot(value),
    dialog: { open: false, dataset: {}, querySelector: () => null },
    showDialog: vi.fn()
  }
  notebook.mockResolvedValue(snapshot(value))
  await clickRelease(app as never, choices[1] as never, 'choose-cover')
  expect(notebook.mock.calls.at(-1)!.slice(1)).toEqual([
    'release',
    { cover: { frame: 2 } }
  ])
  // Without stills, each frame's last picture, held before the next comes
  // in: the first by default.
  const bare = episode()
  for (const scene of bare.video!.storyboard!.plan!.scenes)
    for (const item of scene.frames) delete item.still
  expect(coverChoices(bare).map((choice) => choice.at)).toEqual([
    3.85, 7.85, 11.85
  ])
  expect(chosenCover(bare)?.at).toBe(3.85)
})

it('takes an older video’s thumbnail once its first scene has played, not at 1.5 s (F19)', async () => {
  // Red for the first two seconds, then green: the scene's picture settles.
  const key = (
    await storeAsset({
      body: await readFile(await colour('older.mp4', ['red', 'green'], 12)),
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'produced-video',
      projectId: 'older'
    })
  ).objectKey
  const older: Project = {
    id: 'older',
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
        objectKey: key,
        clock: [{ sceneId: 'scene-0', start: 0, duration: 12 }]
      }
    } as never,
    release: { teasers: [], campaign: [] }
  }
  await save(older)
  expect(coverChoices(older)).toEqual([
    { key: 'scene-0', label: 'Impact', at: 11.4 }
  ])
  expect((await looks(await thumbnailOf('older'))).hue).toBe('green')
})
