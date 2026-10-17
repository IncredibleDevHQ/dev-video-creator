import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'

// Review 8, round 1: what the frame agent is told when it draws a teaser's
// frame again for its shape, and what it may hand back. The agent's run and
// Hyperframes' check are stand-ins: these checks prove the dispatch and the
// acceptance, never what a model draws.
const { run, tried } = vi.hoisted(() => ({ run: vi.fn(), tried: vi.fn() }))
vi.mock('./harness/runtime', async (original) => ({
  ...(await original<typeof import('./harness/runtime')>()),
  runEngineStage: run
}))
vi.mock('./storyboard/check', async (original) => ({
  ...(await original<typeof import('./storyboard/check')>()),
  tryFrame: tried
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-portrait-2-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const real = await import('./teaser-portrait-run')
const { productionDir } = await import('./storyboard/workspace')
afterAll(() => rm(root, { recursive: true, force: true }))

it('tells the frame agent to draw the frame again for the teaser’s canvas, from its own composition and still (F16, round 1)', async () => {
  const dir = productionDir('dispatch', 'sb')
  const packets = join(dir, '.hyperframes', 'frame-packets')
  await mkdir(packets, { recursive: true })
  await mkdir(join(dir, 'compositions', 'frames'), { recursive: true })
  await mkdir(join(dir, 'boards', 'stills'), { recursive: true })
  await mkdir(join(dir, 'assets'), { recursive: true })
  await writeFile(join(dir, 'frame.md'), '# Design\n')
  await writeFile(join(dir, 'hyperframes.json'), '{}')
  await writeFile(join(packets, '_role.md'), 'You draw one frame.\n')
  await writeFile(
    join(packets, 'f04-frame-4.md'),
    '- Project: /somewhere\n- Voiceover: Two lattes.\n'
  )
  const episodeFrame = '<template id="landscape">the 16:9 frame</template>'
  await writeFile(
    join(dir, 'compositions', 'frames', 'f04-frame-4.html'),
    episodeFrame
  )
  await writeFile(join(dir, 'boards', 'stills', 'f04-frame-4.png'), 'still')
  const canvas = { width: 1080, height: 1920 }
  const target = await real.prepareShape(dir, canvas)
  expect(target).toBe(join(dir, 'shapes', '1080x1920'))
  expect(existsSync(join(target, 'hyperframes.json'))).toBe(true)
  expect(existsSync(join(target, 'assets'))).toBe(true)
  const frame = (width: number, height: number) =>
    `<template id="f04-frame-4-template"><div data-composition-id="f04-frame-4" data-width="${width}" data-height="${height}"><h1>Two lattes</h1></div><script>window.__timelines["f04-frame-4"] = gsap.timeline({ paused: true }).to("h1", { opacity: 1 })</script></template>`
  const seen: string[][] = []
  tried.mockResolvedValue({
    problems: [],
    warnings: [],
    fill: [],
    snapshots: []
  })
  run.mockImplementation(async (input) => {
    const runDir = await mkdtemp(join(root, 'run-'))
    const file = join(
      runDir,
      'production',
      'compositions',
      'frames',
      'f04-frame-4.html'
    )
    await mkdir(join(file, '..'), { recursive: true })
    const [tryIt, submit] = input.tools(runDir)
    // The 16:9 frame as it was: refused before Hyperframes looks at it.
    await writeFile(file, frame(1920, 1080))
    seen.push((await tryIt.call({})).problems)
    await writeFile(file, frame(1080, 1920))
    seen.push((await tryIt.call({})).problems)
    expect(await submit.call({})).toMatchObject({ accepted: true })
    return { status: 'done' }
  })
  await real.drawFrameForShape({
    projectId: 'dispatch',
    episodeDir: dir,
    dir: target,
    frameId: 'f04-frame-4',
    number: 4,
    build: 'faceless',
    duration: 4.846,
    canvas,
    selection: { adapter: 'claude-code' },
    origin: 'http://127.0.0.1:1'
  })
  const input = run.mock.calls[0][0]
  expect(input).toMatchObject({
    stage: 'frame',
    route: 'Build Frame',
    stageContext: { frameId: 'f04-frame-4', canvas: '1080x1920' }
  })
  expect(input.packet['packet/ROLE.md']).toBe('You draw one frame.\n')
  expect(input.packet['packet/FRAME_PACKET.md']).toContain(
    '- Project: production'
  )
  const dispatch = input.packet['packet/DISPATCH.md'] as string
  for (const line of [
    'Canvas: 1080×1920',
    'data-width="1080" data-height="1920"',
    'Keep every element above y = 1580',
    'production/reference/f04-frame-4.html',
    'production/reference/f04-frame-4.png',
    'Keep its words, figures, data, colours',
    'headlines 96 px or more, body 48 px or more',
    'Duration: 4.846 s'
  ])
    expect(dispatch).toContain(line)
  expect(
    String(input.productionSeed['production/reference/f04-frame-4.html'])
  ).toBe(episodeFrame)
  expect(
    String(input.productionSeed['production/reference/f04-frame-4.png'])
  ).toBe('still')
  expect(input.productionSeed['production/frame.md']).toBeDefined()
  expect(seen[0]).toEqual([
    'The root is 1080×1920: set data-width="1080" and data-height="1920"'
  ])
  expect(seen[1]).toEqual([])
  // Checked on the teaser's canvas, in the shape's own project.
  expect(tried.mock.calls[0][0]).toMatchObject({
    dir: target,
    frameId: 'f04-frame-4',
    format: '1080x1920'
  })
  expect(
    await readFile(
      join(target, 'compositions', 'frames', 'f04-frame-4.html'),
      'utf8'
    )
  ).toBe(frame(1080, 1920))
  // The episode's own frame never changes.
  expect(
    await readFile(
      join(dir, 'compositions', 'frames', 'f04-frame-4.html'),
      'utf8'
    )
  ).toBe(episodeFrame)
  expect(await real.drawnForShape(dir, target, 'f04-frame-4')).toBe(true)
  // A run that ends without a frame accepted says which frame.
  run.mockResolvedValueOnce({ status: 'error' })
  await expect(
    real.drawFrameForShape({
      projectId: 'dispatch',
      episodeDir: dir,
      dir: target,
      frameId: 'f04-frame-4',
      number: 4,
      build: 'faceless',
      duration: 4.846,
      canvas,
      selection: { adapter: 'claude-code' },
      origin: 'http://127.0.0.1:1'
    })
  ).rejects.toThrow('Frame 4 was not drawn again')
})

it('tells the frame agent which words it drew too small for a phone, while it can fix them (F16, round 2)', async () => {
  const dir = productionDir('dispatch', 'sb')
  const canvas = { width: 1080, height: 1920 }
  const target = await real.prepareShape(dir, canvas)
  const frame = (label: number) =>
    `<template id="f04-frame-4-template"><div data-composition-id="f04-frame-4" data-width="1080" data-height="1920"><h1 style="font-size:96px">Two lattes</h1><p style="font-size:${label}px">per tap</p></div><script>window.__timelines["f04-frame-4"] = gsap.timeline({ paused: true })</script></template>`
  tried.mockResolvedValue({
    problems: [],
    warnings: ['A check warning'],
    fill: [],
    snapshots: []
  })
  const heard: string[][] = []
  run.mockImplementation(async (input) => {
    const runDir = await mkdtemp(join(root, 'run-'))
    const file = join(
      runDir,
      'production',
      'compositions',
      'frames',
      'f04-frame-4.html'
    )
    await mkdir(join(file, '..'), { recursive: true })
    const [tryIt, submit] = input.tools(runDir)
    await writeFile(file, frame(24))
    heard.push((await tryIt.call({})).warnings)
    await writeFile(file, frame(40))
    heard.push((await tryIt.call({})).warnings)
    await submit.call({})
    return { status: 'done' }
  })
  await real.drawFrameForShape({
    projectId: 'dispatch',
    episodeDir: dir,
    dir: target,
    frameId: 'f04-frame-4',
    number: 4,
    build: 'faceless',
    duration: 4.846,
    canvas,
    selection: { adapter: 'claude-code' },
    origin: 'http://127.0.0.1:1'
  })
  expect(heard).toEqual([
    [
      'A check warning',
      'Words under 36 px, too small on a phone: “per tap” 24 px. Make labels 36 px or more, body 48 px or more.'
    ],
    ['A check warning']
  ])
  // The dispatch says the words are measured.
  expect(run.mock.calls.at(-1)![0].packet['packet/DISPATCH.md']).toContain(
    'one under 36 px keeps the teaser a draft'
  )
}, 60_000)
