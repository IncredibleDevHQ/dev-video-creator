import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'

// Review 8 (the live AI run), F08: a change to a map card (a note added to
// it) reaches the episodes not yet in production through every copy no one
// edited or kept; an edited copy, a kept one, or one in an episode being
// made waits for the creator. The agents are stand-ins: these checks prove
// the plumbing, never what a model writes.
const { revise, draw, segues, hold } = vi.hoisted(() => ({
  revise: vi.fn(),
  draw: vi.fn(),
  segues: vi.fn(),
  hold: {
    series: '',
    gate: null as Promise<void> | null,
    reached: () => {}
  }
}))
vi.mock('./creative/slide-revision', () => ({
  prepareCreativeSlideRevision: revise
}))
// A catch-up held once, after it has read the card, while another change
// to that card lands.
vi.mock('./series', async (importOriginal) => {
  const real = await importOriginal<typeof import('./series')>()
  return {
    ...real,
    loadSeries: async (id: string) => {
      const gate = id === hold.series ? hold.gate : null
      if (gate) {
        hold.gate = null
        hold.reached()
        await gate
      }
      return real.loadSeries(id)
    }
  }
})
vi.mock('./creative/pages', () => ({ prepareCreativePages: draw }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: segues }))
const root = await mkdtemp(join(tmpdir(), 'studio-review-8-copies-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { chatSlide, settledChanges } = await import('./slide-changes')
const { catchUpCopies, copyOf, pageHash, settledFollowing } =
  await import('./map-copy')
const { settledAllSegues } = await import('./map-segues')
const { readSourceNarrative } = await import('./source-document')
const { pageBrandFrom } = await import('./source-page')
afterAll(async () => {
  await settledAllSegues()
  await rm(root, { recursive: true, force: true })
})

const source = readSourceNarrative('Retries are safe with an idempotency key.')
const card: Slide = {
  id: 'questions',
  title: 'Questions still open',
  svg: '<svg id="old"/>',
  narration: 'What happens when the key expires?',
  idea: 'The open questions'
}
revise.mockResolvedValue({
  title: 'Payments',
  scenes: [
    {
      title: 'Questions still open',
      kind: 'list',
      seconds: 6,
      idea: 'The open questions',
      narration: 'A key dedupes only while it is kept: the retention window.',
      parts: [],
      relations: [],
      source: [source.text]
    }
  ],
  targetSeconds: 6,
  glossary: []
})
draw.mockResolvedValue(['<svg id="new"/>'])
segues.mockRejectedValue(new Error('No stand-in for segues here'))

const write = (id: string, project: Record<string, unknown>) =>
  writeRow('projects', id, {
    project: {
      id,
      title: id,
      source: source.text,
      harness: { adapter: 'claude-code' },
      video: null,
      ...project
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot)
const episode = (id: string, copy: Slide, video: unknown = null) =>
  write(id, {
    copyOfMap: 'map',
    episode: { series: 's', number: 1 },
    slides: [
      { ...copy, bridge: 'Last time, a timeout.', outro: 'Next, an outbox.' }
    ],
    video
  })
const copyIn = async (id: string) => (await loadProject(id))!.project.slides[0]

it('brings the untouched copies of a changed card up to date, and leaves edited, kept and made ones to the creator', async () => {
  await write('map', { mapSeries: 's', slides: [card] })
  await writeRow('outlines', 'map', {
    source,
    brand: pageBrandFrom(source.palette, source.fonts)
  })
  await writeRow('series', 's', {
    id: 's',
    title: 'Payments',
    mapNotebook: 'map',
    organize: true,
    episodes: ['open', 'edited', 'kept', 'made'].map((notebookId) => ({
      notebookId
    }))
  })
  const fresh = copyOf('map', card)
  await episode('open', fresh)
  await episode('edited', { ...copyOf('map', card), base: 'My own words.' })
  await episode('kept', {
    ...copyOf('map', card),
    copyOf: { ...fresh.copyOf!, kept: 'an-older-version' }
  })
  await episode('made', copyOf('map', card), {
    settings: { presence: 'off', voice: { kind: 'ai', id: 'default' } },
    scenes: [],
    transitions: [],
    inputKey: 'v',
    produced: { objectKey: 'made.mp4', duration: 30 }
  })
  await chatSlide('map', {
    anchor: { stage: 'presentation', slideId: 'questions' },
    instruction: 'Add the retention window'
  })
  await settledChanges('map')
  const changed = (await loadProject('map'))!.project.slides[0]
  expect(changed.svg).toBe('<svg id="new"/>')
  // The untouched copy follows the card, its own id and lines kept.
  const open = await copyIn('open')
  expect(open).toMatchObject({
    id: fresh.id,
    svg: '<svg id="new"/>',
    base: 'A key dedupes only while it is kept: the retention window.',
    bridge: 'Last time, a timeout.',
    outro: 'Next, an outbox.'
  })
  expect(open.copyOf!.hash).toBe(pageHash(changed))
  expect(open.narration).toContain('the retention window')
  expect((await loadProject('open'))!.events.at(-1)?.message).toBe(
    'Updated “Questions still open” from the map'
  )
  // The creator's edit, a kept version and a made episode wait.
  for (const id of ['edited', 'kept', 'made'])
    expect((await copyIn(id)).svg).toBe('<svg id="old"/>')
})

it('says which episodes a note’s addition reaches, and which wait for the creator', async () => {
  const { mapNotes } = await import('../app/map-view')
  const snapshot = {
    project: {
      id: 'map',
      title: 'Payments',
      source: '',
      video: null,
      slides: [card],
      notes: [
        {
          id: 'n1',
          at: '2026-10-17T00:00:00.000Z',
          text: 'The retention window bounds deduplication.',
          state: 'sorted',
          results: [
            {
              kind: 'adds',
              slideId: 'questions',
              title: 'Questions still open',
              line: 'Name the window'
            }
          ]
        }
      ]
    },
    status: 'ready',
    error: null,
    events: []
  } as unknown as Snapshot
  const view = {
    usage: { questions: ['open', 'made'] },
    episodes: [
      {
        notebook: 'open',
        number: 2,
        copies: [{ copyOf: { slide: 'questions' }, stale: false }]
      },
      {
        notebook: 'made',
        number: 4,
        copies: [{ copyOf: { slide: 'questions' }, stale: true }]
      }
    ]
  } as never
  expect(mapNotes(snapshot, new Set(), view)).toContain(
    'Questions still open · in Ep 2 · Ep 4 waits for you'
  )
})

it('keeps a followed copy’s capture, leaves an episode with any storyboard, and follows a hand-edited script', async () => {
  const second: Slide = { ...card, id: 'window', title: 'The retention window' }
  await write('map2', { mapSeries: 's2', slides: [second] })
  await writeRow('series', 's2', {
    id: 's2',
    title: 'Payments',
    mapNotebook: 'map2',
    organize: true,
    episodes: ['captured', 'planning'].map((notebookId) => ({ notebookId }))
  })
  const capture = {
    url: 'https://shop.example',
    steps: [],
    state: 'ready',
    objectKey: 'captures/shop.webm',
    at: '2026-10-17T00:00:00.000Z'
  }
  await write('captured', {
    copyOfMap: 'map2',
    episode: { series: 's2', number: 1 },
    slides: [{ ...copyOf('map2', second), capture }]
  })
  await write('planning', {
    copyOfMap: 'map2',
    episode: { series: 's2', number: 2 },
    slides: [copyOf('map2', second)],
    video: {
      settings: { presence: 'off', voice: { kind: 'ai', id: 'default' } },
      scenes: [],
      transitions: [],
      inputKey: 'v',
      produced: null,
      storyboard: {
        id: 'sb-planning',
        pages: [],
        stage: 'review',
        status: 'waiting',
        waitingFor: 'approval',
        updatedAt: '2026-10-17T00:00:00.000Z'
      }
    }
  })
  const { createStudioServer } = await import('./server')
  const server = createStudioServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as { port: number }
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/projects/map2/slides`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'script',
          slideId: 'window',
          narration: 'Keep a key as long as clients may retry.'
        })
      }
    )
    expect(response.status).toBe(200)
  } finally {
    server.close()
  }
  await settledFollowing()
  const captured = await copyIn('captured')
  expect(captured.base).toBe('Keep a key as long as clients may retry.')
  expect(captured.capture).toEqual(capture)
  // A plan waits there: its copy waits for the creator's Update.
  expect((await copyIn('planning')).base).toBe(card.narration)
})

it('leaves no copy on the older card when two changes to it overlap', async () => {
  const third: Slide = { ...card, id: 'expiry', title: 'When a key expires' }
  await write('map3', { mapSeries: 's3', slides: [third] })
  await writeRow('series', 's3', {
    id: 's3',
    title: 'Payments',
    mapNotebook: 'map3',
    organize: true,
    episodes: [{ notebookId: 'follows' }]
  })
  await write('follows', {
    copyOfMap: 'map3',
    episode: { series: 's3', number: 1 },
    slides: [copyOf('map3', third)]
  })
  const { editSlide } = await import('./projects')
  const say = (narration: string) =>
    editSlide('map3', { action: 'script', slideId: 'expiry', narration })
  // The first change's copies start to follow it, and stop once they have
  // read the card...
  let release!: () => void
  hold.series = 's3'
  hold.gate = new Promise((done) => (release = done))
  const reached = new Promise<void>((done) => (hold.reached = done))
  await say('Keep a key for a day.')
  const first = catchUpCopies('map3', 'expiry')
  await reached
  // ...while a second change lands and its copies follow it.
  await say('Keep a key for as long as clients may retry.')
  const second = catchUpCopies('map3', 'expiry')
  await Promise.race([second, new Promise((done) => setTimeout(done, 100))])
  release()
  await Promise.all([first, second])
  // The copy ends on the card as it is, never the older one.
  expect((await copyIn('follows')).base).toBe(
    'Keep a key for as long as clients may retry.'
  )
})
