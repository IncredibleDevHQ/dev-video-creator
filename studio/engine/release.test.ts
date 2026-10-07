import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Project } from '../shared/model'
// The agent is a stand-in: these checks prove the plumbing, not a model.
const { stage } = vi.hoisted(() => ({ stage: vi.fn() }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
const root = await mkdtemp(join(tmpdir(), 'minimal-release-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const plan = await import('../shared/release-plan')
const { zipFiles } = await import('./zip')
const { draftPosts, uploadBundle, updateRelease, validatePosts } =
  await import('./release')
const { makeTeaser } = await import('./teasers')
const { storeAsset, readAsset, writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { default: puppeteer } = await import('puppeteer')
afterAll(() => rm(root, { recursive: true, force: true }))

const BEATS = ['impact', 'timeline', 'cause', 'fix', 'changes']
// Five scenes of twelve seconds, one beat each, a line spoken in each.
const project = (objectKey = 'n/video/x.mp4'): Project => ({
  id: 'release',
  title: 'The outage',
  source:
    'At 14:02 the API failed. We fixed the limiter and added a replay test.',
  narrative: 'incident',
  slides: BEATS.map((beat, index) => ({
    id: `s${index}`,
    title: `Page ${index + 1}`,
    svg: '',
    narration: `About ${beat}.`
  })),
  video: {
    settings: {
      presence: 'off',
      voice: { kind: 'record' },
      narrative: 'incident',
      direction: { preset: 'briefing' }
    },
    scenes: BEATS.map((beat, index) => ({
      id: `scene-${index}`,
      slideId: `s${index}`,
      phase: 'done',
      presence: null,
      beats: [beat],
      moments: [
        {
          id: `m${index}`,
          lines: `This is the ${beat} part of the story we tell today`,
          start: 0,
          end: 12
        }
      ],
      inputKey: '',
      produced: null,
      error: null
    })) as never,
    transitions: [],
    inputKey: '',
    produced: {
      inputKey: '',
      objectKey,
      clock: BEATS.map((_, index) => ({
        sceneId: `scene-${index}`,
        start: index * 12,
        duration: 12
      }))
    }
  }
})

it('cuts the hook, then the beat that pays off, and captions what is said', () => {
  const segments = plan.teaserSegments(project())
  expect(segments).toEqual([
    { from: 0, to: 4 },
    { from: 48, to: 60 }
  ])
  // The creator pointed at a moment: the cut starts there.
  expect(plan.teaserSegments(project(), 25)).toEqual([
    { from: 0, to: 4 },
    { from: 25, to: 36 }
  ])
  const cues = plan.captionCues(project(), segments)
  expect(cues[0]).toEqual({
    start: 0,
    end: 4,
    text: 'This is the impact part of'
  })
  expect(cues.find((cue) => cue.start >= 4)).toMatchObject({
    start: 4,
    text: 'This is the changes part of'
  })
  expect(plan.chapters(project())).toEqual([
    '0:00 Impact',
    '0:12 Timeline',
    '0:24 Cause',
    '0:36 Fix',
    '0:48 What changes'
  ])
  expect(plan.youtubeDescription(project(), 'What broke and why.')).toBe(
    'What broke and why.\n\n0:00 Impact\n0:12 Timeline\n0:24 Cause\n0:36 Fix\n0:48 What changes'
  )
})

it('keeps each channel’s words within its limits, and never the same', () => {
  const words = {
    x: `It broke at 14:02. Here is why https://example.com/${'a'.repeat(200)}`,
    linkedin: 'Last week our API failed for five minutes.',
    youtube: 'An incident walkthrough.'
  }
  expect(validatePosts(words).ok).toBe(true)
  expect(
    validatePosts({ ...words, x: 'y'.repeat(281), linkedin: words.youtube })
      .problems
  ).toEqual([
    'Write x in 1–280 characters (a link counts as 23)',
    'Write each channel its own words, never the same text'
  ])
})

it('zips the bundle so any unzip reads it', async () => {
  const file = join(root, 'test.zip')
  await writeFile(file, zipFiles({ 'title.txt': 'Hi', 'notes/a.txt': 'Notes' }))
  const listing = execFileSync('unzip', ['-l', file]).toString()
  expect(listing).toContain('title.txt')
  expect(listing).toContain('notes/a.txt')
  expect(execFileSync('unzip', ['-p', file, 'notes/a.txt']).toString()).toBe(
    'Notes'
  )
})

const tools = await (async () => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return existsSync(await puppeteer.executablePath())
  } catch {
    return false
  }
})()
let videoKey = ''
beforeAll(async () => {
  if (!tools) return
  const file = join(root, 'made.mp4')
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=1280x720:rate=30:duration=60',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=60',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-c:a',
    'aac',
    '-shortest',
    file
  ])
  videoKey = (
    await storeAsset({
      body: await readFile(file),
      contentType: 'video/mp4',
      extension: '.mp4',
      kind: 'video',
      projectId: 'release'
    })
  ).objectKey
})

it.skipIf(!tools)(
  'cuts a 9:16 teaser with its words burned in, and bundles the upload',
  async () => {
    await writeRow('projects', 'release', {
      project: project(videoKey),
      status: 'ready',
      error: null,
      events: []
    } satisfies Snapshot)
    const started = await makeTeaser('release', { channel: 'youtube' })
    expect(started.project.release!.teasers[0]).toMatchObject({
      channel: 'youtube',
      aspect: '9:16',
      state: 'cutting'
    })
    await vi.waitFor(
      async () =>
        expect(
          (await loadProject('release'))!.project.release!.teasers[0].state
        ).toBe('ready'),
      { timeout: 120_000, interval: 500 }
    )
    const teaser = (await loadProject('release'))!.project.release!.teasers[0]
    const file = join(root, 'teaser.mp4')
    await writeFile(file, await readAsset(teaser.objectKey!))
    const probe = execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height:format=duration',
      '-of',
      'json',
      file
    ]).toString()
    const info = JSON.parse(probe)
    expect(
      info.streams.map((item: { codec_type: string }) => item.codec_type)
    ).toEqual(['video', 'audio'])
    expect(info.streams[0]).toMatchObject({ width: 1080, height: 1920 })
    expect(Number(info.format.duration)).toBeGreaterThanOrEqual(15)
    expect(Number(info.format.duration)).toBeLessThanOrEqual(17)
    // The bundle: the video, its words and chapters, a thumbnail, the Short.
    await updateRelease('release', {
      posts: { x: 'x', linkedin: 'l', youtube: 'What broke and why.' }
    })
    const bundle = await uploadBundle('release')
    const zip = join(root, 'bundle.zip')
    await writeFile(zip, bundle.bytes)
    const names = execFileSync('unzip', ['-Z1', zip])
      .toString()
      .trim()
      .split('\n')
    expect(names).toEqual([
      'video.mp4',
      'title.txt',
      'description.txt',
      'thumbnail.jpg',
      'README.txt',
      'short-1.mp4'
    ])
    expect(
      execFileSync('unzip', ['-p', zip, 'description.txt']).toString()
    ).toContain('0:48 What changes')
    expect(bundle.name).toBe('The outage - YouTube.zip')
  },
  180_000
)

it('drafts the posts in the background, and says when it could not', async () => {
  await writeRow('projects', 'posts', {
    project: { ...project(), id: 'posts', harness: { adapter: 'kimi' } },
    status: 'ready',
    error: null,
    events: []
  } satisfies Snapshot)
  stage.mockImplementation(async (input) => {
    expect(input.packet['packet/VOICE.md']).toContain('At 14:02')
    return input.validate({
      x: 'It broke.',
      linkedin: 'Last week…',
      youtube: 'Why.'
    }).value
  })
  const started = await draftPosts('posts')
  expect(started.project.release?.drafting?.state).toBe('drafting')
  await vi.waitFor(async () =>
    expect((await loadProject('posts'))!.project.release?.posts?.x).toBe(
      'It broke.'
    )
  )
  expect(
    (await loadProject('posts'))!.project.release?.drafting
  ).toBeUndefined()
  stage.mockRejectedValue(new Error('The agent stopped'))
  await draftPosts('posts')
  await vi.waitFor(async () =>
    expect(
      (await loadProject('posts'))!.project.release?.drafting
    ).toMatchObject({
      state: 'failed',
      error: 'The agent stopped'
    })
  )
})
