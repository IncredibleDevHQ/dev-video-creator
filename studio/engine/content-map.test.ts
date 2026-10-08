import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// The agent is a stand-in: these checks prove the plumbing and the
// validators, not what a model would write.
const { stage, replies } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<string, (input: Record<string, unknown>) => unknown>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
const root = await mkdtemp(join(tmpdir(), 'minimal-content-map-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow, readRow } = await import('./persistence')
const { loadProject, editSlide, changeProject } = await import('./projects')
const notes = await import('./map-notes')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const topics = await import('./map-topics')
const { loadSeries } = await import('./series')
afterAll(() => rm(root, { recursive: true, force: true }))

stage.mockImplementation(async (input: Record<string, unknown>) => {
  const reply = replies[input.route as string]
  if (!reply) throw new Error(`No stand-in for ${input.route}`)
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  const report = validate(reply(input))
  if (!report.ok) throw new Error(report.problems.join('; '))
  return report.value
})

const page = (id: string, title: string): Slide => ({
  id,
  title,
  svg: `<svg><text>${title}</text></svg>`,
  idea: `${title}, in a sentence`,
  narration: `What ${title.toLowerCase()} says.`
})
// A drawn map: four pages, its outline and source retained.
const drawnMap = async (id: string, video = false) => {
  const slides = [
    page(`${id}-1`, 'Why it exists'),
    page(`${id}-2`, 'The parts'),
    page(`${id}-3`, 'Preview by relay'),
    page(`${id}-4`, 'Security')
  ]
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'Streamline',
      source: 'Streamline runs custom video pipelines.',
      harness: { adapter: 'claude-code' },
      slides,
      video: video
        ? {
            settings: { presence: 'off', voice: { kind: 'record' } },
            scenes: [],
            transitions: [],
            inputKey: '',
            produced: null
          }
        : null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
  await writeRow('outlines', id, {
    source: {
      title: 'Streamline',
      text: 'Streamline runs custom video pipelines.'
    },
    brand: {},
    outline: {
      title: 'Streamline',
      scenes: slides.map((s) => ({ title: s.title }))
    },
    slideIds: slides.map((s) => s.id)
  })
  await writeRow('sources', id, {
    title: 'Streamline',
    text: 'Streamline runs custom video pipelines.'
  })
  return snapshot
}

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key]
  replies['Write Segues'] = (input) => {
    const brief = JSON.parse(
      (input.packet as Record<string, string>)['packet/EPISODE.json']
    )
    return {
      pages: brief.pages.map((p: { id: string; title: string }, i: number) => ({
        id: p.id,
        bridge: i ? `So, ${p.title.toLowerCase()}.` : 'Here is the question.'
      })),
      outro: brief.next
        ? `Next time: ${brief.next.title}.`
        : 'That is the series.'
    }
  }
})

it('checks the sorting against the pages the map has', () => {
  const pages = ['a', 'b']
  expect(notes.validateSort({ items: [] }, pages).ok).toBe(false)
  expect(
    notes.validateSort(
      { items: [{ kind: 'adds', line: 'x', page: 'z' }] },
      pages
    ).problems
  ).toContain('Name the page it adds to by its id')
  expect(
    notes.validateSort(
      { items: [{ kind: 'new', line: 'x', after: 'b' }] },
      pages
    ).problems
  ).toContain('Give each new page a short title')
  const accepted = notes.validateSort(
    {
      items: [
        {
          kind: 'new',
          line: 'what an hour costs',
          title: 'Cost',
          after: 'a',
          topic: 'Money'
        },
        { kind: 'covered', line: 'it sleeps', page: 'b' }
      ]
    },
    pages,
    ['Money']
  )
  expect(accepted.ok).toBe(true)
  expect(accepted.value.items[0]).toMatchObject({
    kind: 'new',
    after: 'a',
    topic: 'Money'
  })
})

it('piles a note into the map: a new page, a change to a page, one covered', async () => {
  await drawnMap('m1')
  await expect(notes.addNote('m1', { text: '' })).rejects.toThrow(
    'Write the note first'
  )
  replies['Sort Note'] = () => ({
    items: [
      {
        kind: 'new',
        line: 'Walk through what an hour costs',
        title: 'What an hour costs',
        idea: 'The bill for one hour',
        after: 'm1-2'
      },
      { kind: 'adds', line: 'Say where the relay adds delay', page: 'm1-3' },
      { kind: 'covered', line: 'It is open source', page: 'm1-4' }
    ]
  })
  const started = await notes.addNote('m1', {
    text: 'Walk through what an hour costs. Say where the relay adds delay.'
  })
  expect(started.project.notes?.[0].state).toBe('sorting')
  // The note is evidence from now on, in the notebook and its retained source.
  expect(started.project.source).toContain('## Note, ')
  expect(
    (await readRow<{ source: { text: string } }>('outlines', 'm1'))!.source.text
  ).toContain('what an hour costs')
  await notes.settledNotes()
  const after = (await loadProject('m1'))!
  const slides = after.project.slides
  expect(slides.map((s) => s.title)).toEqual([
    'Why it exists',
    'The parts',
    'What an hour costs',
    'Preview by relay',
    'Security'
  ])
  const fresh = slides[2]
  expect(fresh).toMatchObject({
    svg: null,
    fromNote: after.project.notes![0].id
  })
  expect(after.changes?.map((c) => c.slideId)).toEqual([fresh.id, 'm1-3'])
  expect(after.project.notes![0]).toMatchObject({ state: 'sorted' })
  expect(after.project.notes![0].results!.map((r) => r.kind)).toEqual([
    'new',
    'adds',
    'covered'
  ])
  expect(after.events.at(-1)?.message).toBe(
    'Your note: 1 new page, 1 added to, 1 already covered'
  )
})

it('keeps a note page’s scene left out when the map has a video', async () => {
  await drawnMap('m2', true)
  replies['Sort Note'] = () => ({
    items: [{ kind: 'new', line: 'A demo', title: 'Demo', after: null }]
  })
  await notes.addNote('m2', { text: 'A demo idea.' })
  await notes.settledNotes()
  const video = (await loadProject('m2'))!.project.video!
  const added = video.scenes.at(-1)!
  expect(added.phase).toBe('idle')
})

it('records why a note could not be sorted', async () => {
  await drawnMap('m3')
  replies['Sort Note'] = () => ({
    items: [{ kind: 'adds', line: 'x', page: 'nope' }]
  })
  await notes.addNote('m3', { text: 'Something.' })
  await notes.settledNotes()
  const note = (await loadProject('m3'))!.project.notes![0]
  expect(note.state).toBe('failed')
  expect(note.error).toContain('Name the page it adds to by its id')
})

it('makes an episode of copies, with segues, and tracks where each page is used', async () => {
  await drawnMap('m4')
  const series = await episodes.startMapSeries('m4', {
    title: 'Streamline, explained'
  })
  expect(series.map).toBe('m4')
  expect((await loadProject('m4'))!.project.mapSeries).toBe(series.id)
  // The same series comes back for the same map.
  expect((await episodes.startMapSeries('m4', {})).id).toBe(series.id)
  const one = await episodes.addMapEpisode(series.id, {
    title: 'Why',
    slides: ['m4-1', 'm4-2']
  })
  const ep1 = one.notebook.project
  expect(one.notebook.status).toBe('ready')
  expect(ep1.copyOfMap).toBe('m4')
  expect(ep1.episode).toMatchObject({ series: series.id, number: 1 })
  expect(ep1.slides.map((s) => s.copyOf?.slide)).toEqual(['m4-1', 'm4-2'])
  expect(ep1.slides.every((s) => !['m4-1', 'm4-2'].includes(s.id))).toBe(true)
  // An episode's own changes have the map's evidence and outline.
  const retained = await readRow<{ slideIds: string[] }>('outlines', ep1.id)
  expect(retained!.slideIds).toEqual(ep1.slides.map((s) => s.id))
  await segues.settledSegues(ep1.id)
  const written = (await loadProject(ep1.id))!.project.slides
  expect(written[0].narration).toBe(
    'Here is the question. What why it exists says.'
  )
  expect(written[1].narration).toBe(
    'So, the parts. What the parts says. That is the series.'
  )
  // The second episode: the first one's "next time" is rewritten to lead into it.
  const two = await episodes.addMapEpisode(series.id, {
    title: 'How',
    slides: ['m4-2', 'm4-3']
  })
  await segues.settledSegues(two.notebook.project.id)
  await segues.settledSegues(ep1.id)
  expect((await loadProject(ep1.id))!.project.slides[1].outro).toBe(
    'Next time: How.'
  )
  const view = await episodes.mapView('m4')
  expect(view.series?.title).toBe('Streamline, explained')
  expect(view.episodes.map((e) => e.number)).toEqual([1, 2])
  expect(view.usage['m4-2']).toEqual([ep1.id, two.notebook.project.id])
  expect(view.usage['m4-4']).toBeUndefined()
  expect((await loadSeries(series.id))!.episodes).toHaveLength(2)
})

it('marks a copy when its original changes, and updates or keeps it', async () => {
  await drawnMap('m5')
  const series = await episodes.startMapSeries('m5', {})
  const { notebook } = await episodes.addMapEpisode(series.id, {
    slides: ['m5-1']
  })
  const ep = notebook.project.id
  await segues.settledSegues(ep)
  await changeProject('m5', (current) => {
    current.project.slides[0].narration = 'A newer script.'
  })
  let copy = (await episodes.mapView('m5')).episodes[0].copies[0]
  expect(copy.stale).toBe(true)
  await episodes.changeCopies(ep, { action: 'keep', slide: copy.id })
  expect((await episodes.mapView('m5')).episodes[0].copies[0].stale).toBe(false)
  await changeProject('m5', (current) => {
    current.project.slides[0].narration = 'The newest script.'
  })
  copy = (await episodes.mapView('m5')).episodes[0].copies[0]
  expect(copy.stale).toBe(true)
  await episodes.changeCopies(ep, { action: 'update', slide: copy.id })
  await segues.settledSegues(ep)
  const updated = (await loadProject(ep))!.project.slides[0]
  expect(updated.base).toBe('The newest script.')
  expect(updated.narration).toBe(
    'Here is the question. The newest script. That is the series.'
  )
  expect((await episodes.mapView('m5')).episodes[0].copies[0].stale).toBe(false)
})

it('copies, cuts, moves and removes pages between episodes', async () => {
  await drawnMap('m6')
  const series = await episodes.startMapSeries('m6', {})
  const a = (await episodes.addMapEpisode(series.id, { slides: ['m6-1'] }))
    .notebook.project.id
  const b = (await episodes.addMapEpisode(series.id, { slides: ['m6-2'] }))
    .notebook.project.id
  // A cut makes the page this episode's only.
  expect(
    await episodes.changeCopies(a, { action: 'add', slide: 'm6-3', only: true })
  ).toEqual({ cut: true, shared: false })
  expect((await loadProject('m6'))!.project.slides[2].onlyIn).toBe(a)
  await expect(
    episodes.changeCopies(a, { action: 'add', slide: 'm6-3' })
  ).rejects.toThrow('already has a copy')
  // Copying it into another episode shares it again.
  await episodes.changeCopies(b, { action: 'add', slide: 'm6-3', index: 0 })
  expect((await loadProject('m6'))!.project.slides[2].onlyIn).toBeUndefined()
  expect(
    (await loadProject(b))!.project.slides.map((s) => s.copyOf?.slide)
  ).toEqual(['m6-3', 'm6-2'])
  // A cut of a page another episode uses is a copy.
  expect(
    await episodes.changeCopies(a, { action: 'add', slide: 'm6-2', only: true })
  ).toEqual({ cut: false, shared: true })
  // Move within an episode, then to another.
  const inA = (await loadProject(a))!.project.slides
  await episodes.changeCopies(a, { action: 'move', slide: inA[2].id, index: 0 })
  expect(
    (await loadProject(a))!.project.slides.map((s) => s.copyOf?.slide)
  ).toEqual(['m6-2', 'm6-1', 'm6-3'])
  const first = (await loadProject(a))!.project.slides[1]
  await episodes.changeCopies(a, { action: 'move', slide: first.id, to: b })
  expect(
    (await loadProject(b))!.project.slides.map((s) => s.copyOf?.slide)
  ).toEqual(['m6-3', 'm6-2', 'm6-1'])
  const removed = (await loadProject(b))!.project.slides[0]
  await episodes.changeCopies(b, { action: 'remove', slide: removed.id })
  expect((await loadProject(b))!.project.slides).toHaveLength(2)
  // The map never changed because an episode did.
  expect((await loadProject('m6'))!.project.slides.map((s) => s.id)).toEqual([
    'm6-1',
    'm6-2',
    'm6-3',
    'm6-4'
  ])
  await episodes.setAside('m6', { slide: 'm6-4', aside: true })
  expect((await loadProject('m6'))!.project.slides[3].aside).toBe(true)
})

it('keeps a script the creator wrote out of the segues', async () => {
  await drawnMap('m7')
  const series = await episodes.startMapSeries('m7', {})
  const ep = (
    await episodes.addMapEpisode(series.id, { slides: ['m7-1', 'm7-2'] })
  ).notebook.project.id
  await segues.settledSegues(ep)
  const second = (await loadProject(ep))!.project.slides[1]
  await editSlide(ep, {
    action: 'script',
    slideId: second.id,
    narration: 'My own words.'
  })
  segues.scheduleSegues(ep)
  await segues.settledSegues(ep)
  const kept = (await loadProject(ep))!.project.slides[1]
  expect(kept.narration).toBe('My own words.')
  expect(kept.bridge).toBeUndefined()
})

it('checks segues and topics before accepting them', () => {
  expect(
    segues.validateSegues(
      {
        pages: [
          { id: 'b', bridge: 'x' },
          { id: 'a', bridge: 'y' }
        ],
        outro: 'z'
      },
      ['a', 'b']
    ).ok
  ).toBe(false)
  expect(
    segues.validateSegues({ pages: [{ id: 'a', bridge: 'x' }], outro: '' }, [
      'a'
    ]).problems
  ).toContain('Write the outro said after the last page')
  expect(
    topics.validateTopics({ topics: [{ name: 'A', pages: ['a'] }] }, ['a']).ok
  ).toBe(false)
  expect(
    topics.validateTopics(
      {
        topics: [
          { name: 'A', pages: ['a'] },
          { name: 'a', pages: ['b'] }
        ]
      },
      ['a', 'b']
    ).problems
  ).toContain('Give each topic its own name')
  expect(
    topics.validateTopics(
      {
        topics: [
          { name: 'A', pages: ['a'] },
          { name: 'B', pages: ['b', 'a'] }
        ]
      },
      ['a', 'b']
    ).problems
  ).toContain('Put every page in exactly one topic')
})

it('groups the map by topic, and a note’s new page joins one', async () => {
  await drawnMap('m8')
  replies['Group Topics'] = () => ({
    topics: [
      { name: 'Why', pages: ['m8-1'] },
      { name: 'How it runs', pages: ['m8-2', 'm8-3'] },
      { name: 'Trust', pages: ['m8-4'] }
    ]
  })
  await topics.groupTopics('m8')
  await topics.settledTopics('m8')
  const grouped = (await loadProject('m8'))!.project
  expect(grouped.topics).toEqual(['Why', 'How it runs', 'Trust'])
  expect(grouped.slides.map((s) => s.topic)).toEqual([
    'Why',
    'How it runs',
    'How it runs',
    'Trust'
  ])
  replies['Sort Note'] = () => ({
    items: [
      {
        kind: 'new',
        line: 'Keys never leave',
        title: 'Keys',
        after: 'm8-4',
        topic: 'Trust'
      }
    ]
  })
  await notes.addNote('m8', { text: 'Keys never leave the Worker.' })
  await notes.settledNotes()
  expect((await loadProject('m8'))!.project.slides.at(-1)).toMatchObject({
    title: 'Keys',
    topic: 'Trust'
  })
})

it('waits for a page being redrawn before a note moves the pages', async () => {
  await drawnMap('m9')
  const { withDeck } = await import('./slide-changes')
  let release!: () => void
  const redraw = withDeck(
    'm9',
    () => new Promise<void>((done) => (release = done))
  )
  replies['Sort Note'] = () => ({
    items: [{ kind: 'new', line: 'Pricing', title: 'Pricing', after: 'm9-1' }]
  })
  await notes.addNote('m9', { text: 'Pricing matters.' })
  await new Promise((done) => setTimeout(done, 30))
  // Sorted, but not placed while the redraw holds the deck.
  expect((await loadProject('m9'))!.project.slides).toHaveLength(4)
  release()
  await redraw
  await notes.settledNotes()
  const placed = (await loadProject('m9'))!.project.slides.map((s) => s.title)
  expect(placed).toEqual([
    'Why it exists',
    'Pricing',
    'The parts',
    'Preview by relay',
    'Security'
  ])
})
