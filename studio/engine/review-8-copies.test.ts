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
  // Its change still queued on the card: being added, nowhere yet; failed
  // there, it says so and why (round 3).
  snapshot.project.notes![0].results![0].change = 'c1'
  snapshot.changes = [
    {
      id: 'c1',
      slideId: 'questions',
      instruction: 'Add it',
      state: 'queued',
      at: '2026-10-17T00:00:00.000Z'
    }
  ]
  expect(mapNotes(snapshot, new Set(), view)).toContain(
    'Questions still open · being added</span>'
  )
  snapshot.changes[0].state = 'failed'
  snapshot.changes[0].message =
    'Claude Code could not change this wireframe. Try again.'
  expect(mapNotes(snapshot, new Set(), view)).toContain(
    'Questions still open · not added: Claude Code could not change this wireframe. Try again.</span>'
  )
})

it('keeps a followed copy’s capture, follows an episode whose plan waits for approval, and leaves an approved one', async () => {
  const second: Slide = { ...card, id: 'window', title: 'The retention window' }
  await write('map2', { mapSeries: 's2', slides: [second] })
  await writeRow('series', 's2', {
    id: 's2',
    title: 'Payments',
    mapNotebook: 'map2',
    organize: true,
    episodes: ['captured', 'planning', 'approved'].map((notebookId) => ({
      notebookId
    }))
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
  // A storyboard of the copy: a plan waiting for approval, or approved.
  const boarded = async (id: string, number: number, approved: boolean) => {
    const copy = copyOf('map2', second)
    await write(id, {
      copyOfMap: 'map2',
      episode: { series: 's2', number },
      slides: [copy],
      video: {
        settings: { presence: 'off', voice: { kind: 'ai', id: 'default' } },
        scenes: [],
        transitions: [],
        inputKey: 'v',
        produced: null,
        storyboard: {
          id: `sb-${id}`,
          pages: [copy.id],
          stage: approved ? 'stills' : 'review',
          status: approved ? 'working' : 'waiting',
          ...(approved ? { approved: true } : { waitingFor: 'approval' }),
          updatedAt: '2026-10-17T00:00:00.000Z'
        }
      }
    })
  }
  await boarded('planning', 2, false)
  await boarded('approved', 3, true)
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
  // A plan not yet approved follows, and is marked to be planned again:
  // never stale, and nothing paid starts by itself.
  const planning = (await loadProject('planning'))!.project
  expect(planning.slides[0].base).toBe(
    'Keep a key as long as clients may retry.'
  )
  expect(planning.video!.storyboard).toMatchObject({
    replan: true,
    status: 'waiting'
  })
  expect(planning.video!.storyboard!.stale).toBeUndefined()
  // An approved one waits for the creator's Update, its video untouched.
  const approved = (await loadProject('approved'))!.project
  expect(approved.slides[0].base).toBe(card.narration)
  expect(approved.video!.storyboard!.stale).toBeUndefined()
})

it('keeps a copy’s capture and answers when the creator updates it, as when it follows by itself', async () => {
  const page: Slide = { ...card, id: 'holds', title: 'What a key holds' }
  await write('map4', {
    mapSeries: 's4',
    slides: [{ ...page, narration: 'A key holds the first response.' }]
  })
  await writeRow('series', 's4', {
    id: 's4',
    title: 'Payments',
    mapNotebook: 'map4',
    episodes: [{ notebookId: 'answered' }]
  })
  const capture = {
    url: 'https://shop.example',
    steps: [],
    state: 'ready',
    objectKey: 'captures/checkout.webm',
    at: '2026-10-17T00:00:00.000Z'
  }
  const answers = [{ what: 'How long a key is kept', answer: '24 hours' }]
  const behind = { ...copyOf('map4', page), capture, answers } as Slide
  await write('answered', {
    copyOfMap: 'map4',
    episode: { series: 's4', number: 1 },
    slides: [{ ...behind, bridge: 'Last time, a timeout.' }]
  })
  const { changeCopies } = await import('./map-episodes')
  await changeCopies('answered', { action: 'update', slide: behind.id })
  expect(await copyIn('answered')).toMatchObject({
    id: behind.id,
    base: 'A key holds the first response.',
    capture,
    answers,
    bridge: 'Last time, a timeout.'
  })
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

it('updates all of an approved episode’s waiting copies in one go, and Undo puts them back, scenes and plan included', async () => {
  const pages = ['p1', 'p2', 'p3'].map((id) => ({ ...card, id, title: id }))
  await write('map5', { mapSeries: 's5', slides: pages })
  await writeRow('series', 's5', {
    id: 's5',
    title: 'Payments',
    mapNotebook: 'map5',
    episodes: [{ notebookId: 'approved5' }, { notebookId: 'made5' }]
  })
  const copies = pages.map((page) => copyOf('map5', page))
  const settings = { presence: 'off', voice: { kind: 'ai', id: 'default' } }
  await write('approved5', {
    copyOfMap: 'map5',
    episode: { series: 's5', number: 1 },
    slides: copies,
    video: {
      settings,
      scenes: [],
      transitions: [],
      inputKey: 'v',
      produced: null,
      storyboard: {
        id: 'sb5',
        pages: copies.map((copy) => copy.id),
        stage: 'stills',
        status: 'working',
        approved: true,
        updatedAt: '2026-10-17T00:00:00.000Z'
      }
    }
  })
  // An episode made scene by scene, its one scene made.
  const madeCopy = copyOf('map5', pages[0])
  await write('made5', {
    copyOfMap: 'map5',
    episode: { series: 's5', number: 2 },
    slides: [madeCopy]
  })
  const { changeProject } = await import('./projects')
  const { reconcileVideo } = await import('./scene-model')
  await changeProject('made5', (current) => {
    const video = { settings, scenes: [], transitions: [], inputKey: '' }
    current.project.video = {
      ...video,
      produced: null
    } as unknown as Snapshot['project']['video']
    reconcileVideo(current.project, current, new Set())
    current.project.video!.scenes[0].phase = 'produced'
    current.project.video!.scenes[0].produced = {
      inputKey: 'k',
      objectKey: 'scene.mp4'
    }
  })
  await changeProject('map5', (current) => {
    current.project.slides[0].narration = 'One, newer.'
    current.project.slides[1].narration = 'Two, newer.'
  })
  const { changeCopies } = await import('./map-episodes')
  // Update all: the two that wait, in one call that says how many.
  const waiting = copies.slice(0, 2).map((copy) => copy.id)
  expect(
    await changeCopies('approved5', { action: 'update', slides: waiting })
  ).toEqual({ updated: 2 })
  let approved = (await loadProject('approved5'))!.project
  expect(approved.slides.map((slide) => slide.base)).toEqual([
    'One, newer.',
    'Two, newer.',
    card.narration
  ])
  expect(approved.video!.storyboard!.stale).toBe(true)
  // Undo: both as they were, and the approved plan no longer stale.
  await changeCopies('approved5', { action: 'undo-update' })
  approved = (await loadProject('approved5'))!.project
  expect(approved.slides).toEqual(copies)
  expect(approved.video!.storyboard!.stale).toBeUndefined()
  await expect(
    changeCopies('approved5', { action: 'undo-update' })
  ).rejects.toThrow('That update can no longer be undone')
  // Keep, undone: the copy waits for its Update again.
  await changeCopies('approved5', { action: 'keep', slide: copies[0].id })
  expect((await copyIn('approved5')).copyOf!.kept).toBeDefined()
  await changeCopies('approved5', { action: 'undo-update' })
  expect((await copyIn('approved5')).copyOf).toEqual(copies[0].copyOf)
  // A made scene goes with an update, and comes back with its Undo.
  await changeCopies('made5', { action: 'update', slide: madeCopy.id })
  const scene = async () => (await loadProject('made5'))!.project.video!.scenes
  expect((await scene())[0].produced).toBeNull()
  await changeCopies('made5', { action: 'undo-update' })
  expect((await scene())[0]).toMatchObject({
    phase: 'produced',
    produced: { objectKey: 'scene.mp4' }
  })
  // A copy changed since its update is never undone over.
  await changeCopies('made5', { action: 'update', slide: madeCopy.id })
  const { editSlide } = await import('./projects')
  await editSlide('made5', {
    action: 'script',
    slideId: madeCopy.id,
    narration: 'My own words.'
  })
  await expect(
    changeCopies('made5', { action: 'undo-update' })
  ).rejects.toThrow('That page has changed since: nothing was undone')
  expect((await copyIn('made5')).base).toBe('My own words.')
})

// Round 3 of the audit: an Undo of Keep or Update never puts a scene back
// over work done in it since; the lines around an undone update come back
// before the plan's flags are settled; Update all leaves the creator's
// edited copies to them.
const settings = { presence: 'off', voice: { kind: 'ai', id: 'default' } }
const sceneOf = async (id: string, index: number) =>
  (await loadProject(id))!.project.video!.scenes[index]

it('leaves a scene made after a Keep, or worked on after an Update, when either is undone; one caught mid-render waits to be made again', async () => {
  const pages = ['k1', 'k2', 'k3'].map((id) => ({ ...card, id, title: id }))
  await write('map7', { mapSeries: 's7', slides: pages })
  await writeRow('series', 's7', {
    id: 's7',
    title: 'Payments',
    mapNotebook: 'map7',
    episodes: [{ notebookId: 'made7' }]
  })
  const copies = pages.map((page) => copyOf('map7', page))
  await write('made7', {
    copyOfMap: 'map7',
    episode: { series: 's7', number: 1 },
    slides: copies
  })
  const { changeProject } = await import('./projects')
  const { reconcileVideo } = await import('./scene-model')
  const { changeCopies } = await import('./map-episodes')
  // Every scene is being rendered.
  await changeProject('made7', (current) => {
    current.project.video = {
      settings,
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null
    } as unknown as Snapshot['project']['video']
    reconcileVideo(current.project, current, new Set())
    for (const scene of current.project.video!.scenes) scene.phase = 'producing'
  })
  await changeProject('map7', (current) => {
    for (const slide of current.project.slides)
      slide.narration = `${slide.id}, newer.`
  })
  // Keep while its scene renders; the render lands; Undo leaves it made.
  await changeCopies('made7', { action: 'keep', slide: copies[0].id })
  await changeProject('made7', (current) => {
    const scene = current.project.video!.scenes[0]
    scene.phase = 'produced'
    scene.produced = { inputKey: scene.inputKey, objectKey: 'k1.mp4' }
  })
  await changeCopies('made7', { action: 'undo-update' })
  expect(await sceneOf('made7', 0)).toMatchObject({
    phase: 'produced',
    produced: { objectKey: 'k1.mp4' }
  })
  expect((await copyIn('made7')).copyOf).toEqual(copies[0].copyOf)
  // Updated mid-render, then undone: its render went with the update, so
  // it waits to be made again rather than stand rendering for ever.
  await changeCopies('made7', { action: 'update', slide: copies[1].id })
  await changeCopies('made7', { action: 'undo-update' })
  expect((await sceneOf('made7', 1)).phase).toBe('waiting')
  // Updated, then the creator chose its shot: Undo keeps the scene as it
  // is now, and says so.
  await changeCopies('made7', { action: 'update', slide: copies[2].id })
  await changeProject('made7', (current) => {
    current.project.video!.scenes[2].shot = 'close-up'
  })
  expect(await changeCopies('made7', { action: 'undo-update' })).toEqual({
    undone: true,
    kept: 1
  })
  const made = (await loadProject('made7'))!
  expect(made.project.slides[2]).toEqual(copies[2])
  expect(made.project.video!.scenes[2].shot).toBe('close-up')
  expect(made.events.map((event) => event.message)).toContain(
    'Put “k3” back as it was; its scene was worked on since, so it stays as it is'
  )
})

it('puts back the lines around an undone update before it settles the plan, so an approved plan is as it was', async () => {
  const pages = ['r1', 'r2'].map((id) => ({
    ...card,
    id,
    title: id,
    narration: `${id} says.`
  }))
  await write('map6', { mapSeries: 's6', slides: pages })
  await writeRow('series', 's6', {
    id: 's6',
    title: 'Payments',
    mapNotebook: 'map6',
    episodes: [{ notebookId: 'approved6' }]
  })
  const copies = pages.map((page) => copyOf('map6', page))
  await write('approved6', {
    copyOfMap: 'map6',
    episode: { series: 's6', number: 1 },
    slides: copies
  })
  const { changeProject } = await import('./projects')
  const { changeCopies } = await import('./map-episodes')
  const { scheduleSegues } = await import('./map-segues')
  // Each run words its lines anew, so a line put back is told apart.
  let take = 0
  segues.mockImplementation(async (input: Record<string, unknown>) => {
    const brief = JSON.parse(
      (input.packet as Record<string, string>)['packet/EPISODE.json']
    )
    take++
    return {
      pages: brief.pages.map((page: { id: string; title: string }) => ({
        id: page.id,
        bridge: `Take ${take}: into ${page.title}.`
      })),
      outro: 'That is all.'
    }
  })
  try {
    scheduleSegues('approved6')
    await settledAllSegues()
    await changeProject('approved6', (current) => {
      current.project.video = {
        settings,
        scenes: [],
        transitions: [],
        inputKey: 'v',
        produced: null,
        storyboard: {
          id: 'sb6',
          pages: current.project.slides.map((slide) => slide.id),
          stage: 'stills',
          status: 'working',
          approved: true,
          updatedAt: '2026-10-17T00:00:00.000Z'
        }
      } as unknown as Snapshot['project']['video']
    })
    const before = (await loadProject('approved6'))!.project.slides
    await changeProject('map6', (current) => {
      current.project.slides[0].narration = 'r1, newer.'
    })
    await changeCopies('approved6', { action: 'update', slide: copies[0].id })
    await settledAllSegues()
    let episode = (await loadProject('approved6'))!.project
    // The page after it had its line in written again for it.
    expect(episode.slides[1].bridge).not.toBe(before[1].bridge)
    expect(episode.video!.storyboard!.stale).toBe(true)
    const asked = segues.mock.calls.length
    await changeCopies('approved6', { action: 'undo-update' })
    episode = (await loadProject('approved6'))!.project
    expect(episode.slides).toEqual(before)
    expect(episode.video!.storyboard!.stale).toBeUndefined()
    await settledAllSegues()
    expect(segues.mock.calls.length).toBe(asked)
    expect(
      (await loadProject('approved6'))!.project.video!.storyboard!.stale
    ).toBeUndefined()
  } finally {
    segues.mockReset()
    segues.mockRejectedValue(new Error('No stand-in for segues here'))
  }
})

it('leaves a copy the creator edited to them when Update all brings the others up to their cards', async () => {
  const pages = ['u1', 'u2'].map((id) => ({ ...card, id, title: id }))
  await write('map9', { mapSeries: 's9', slides: pages })
  await writeRow('series', 's9', {
    id: 's9',
    title: 'Payments',
    mapNotebook: 'map9',
    episodes: [{ notebookId: 'ep9' }]
  })
  const copies = [
    copyOf('map9', pages[0]),
    { ...copyOf('map9', pages[1]), base: 'My own words.' }
  ]
  await write('ep9', {
    copyOfMap: 'map9',
    episode: { series: 's9', number: 1 },
    slides: copies
  })
  const { changeProject } = await import('./projects')
  const { changeCopies } = await import('./map-episodes')
  await changeProject('map9', (current) => {
    for (const slide of current.project.slides)
      slide.narration = `${slide.id}, newer.`
  })
  const all = copies.map((copy) => copy.id)
  expect(await changeCopies('ep9', { action: 'update', slides: all })).toEqual({
    updated: 1,
    edited: 1
  })
  const bases = async () =>
    (await loadProject('ep9'))!.project.slides.map((slide) => slide.base)
  expect(await bases()).toEqual(['u1, newer.', 'My own words.'])
  // Its own Update is the creator's choice: it brings it up.
  await changeCopies('ep9', { action: 'update', slide: copies[1].id })
  expect(await bases()).toEqual(['u1, newer.', 'u2, newer.'])
})

it('names only the episodes a note’s addition reached, says which wait for an Update, and that it is being added until it lands (F02)', async () => {
  const page: Slide = { ...card, id: 'window8', title: 'The retention window' }
  await write('map8', { mapSeries: 's8', slides: [page] })
  await writeRow('outlines', 'map8', {
    source,
    brand: pageBrandFrom(source.palette, source.fonts)
  })
  await writeRow('series', 's8', {
    id: 's8',
    title: 'Payments',
    mapNotebook: 'map8',
    organize: true,
    episodes: [
      { notebookId: 'open8', number: 1 },
      { notebookId: 'approved8', number: 2 }
    ]
  })
  await write('open8', {
    copyOfMap: 'map8',
    episode: { series: 's8', number: 1 },
    slides: [copyOf('map8', page)]
  })
  await write('approved8', {
    copyOfMap: 'map8',
    episode: { series: 's8', number: 2 },
    slides: [copyOf('map8', page)],
    video: {
      settings,
      scenes: [],
      transitions: [],
      inputKey: 'v',
      produced: { objectKey: 'made.mp4', duration: 30 }
    }
  })
  const { changeProject } = await import('./projects')
  const { noteViews } = await import('./map-notes')
  // The copies follow once the card has changed: held there.
  let release!: () => void
  hold.series = 's8'
  hold.gate = new Promise((done) => (release = done))
  const reached = new Promise<void>((done) => (hold.reached = done))
  const queued = await chatSlide('map8', {
    anchor: { stage: 'presentation', slideId: 'window8' },
    instruction: 'Add the retention window'
  })
  const change = queued.changes!.at(-1)!.id
  // As a sorted note leaves it: its addition is that change.
  await changeProject('map8', (current) => {
    current.project.notes = [
      {
        id: 'n8',
        at: '2026-10-17T00:00:00.000Z',
        text: 'Keys are kept for a window.',
        state: 'sorted',
        results: [
          {
            kind: 'adds',
            slideId: 'window8',
            title: 'The retention window',
            line: 'Name the window',
            change
          }
        ]
      }
    ]
  })
  await reached
  // The card has changed; its copies have not caught up: on its way still.
  expect((await loadProject('map8'))!.changes || []).toEqual([])
  expect((await noteViews('map8'))[0].results![0].landing).toBe('adding')
  release()
  await settledChanges('map8')
  // Landed: the episode whose copy took it, and the one that waits.
  const [landed] = (await noteViews('map8'))[0].results!
  expect(landed).toMatchObject({ episodes: [1], waits: [2] })
  expect(landed.landing).toBeUndefined()
  // A change that failed says so, and why.
  await changeProject('map8', (current) => {
    current.changes = [
      {
        id: 'failed8',
        slideId: 'window8',
        instruction: 'Add it',
        state: 'failed',
        at: '2026-10-17T00:00:00.000Z',
        message: 'Claude Code could not change this wireframe. Try again.'
      }
    ]
    current.project.notes![0].results![0].change = 'failed8'
  })
  expect((await noteViews('map8'))[0].results![0]).toMatchObject({
    landing: 'failed',
    failure: 'Claude Code could not change this wireframe. Try again.'
  })
})
