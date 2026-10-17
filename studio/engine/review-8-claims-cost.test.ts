import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
// Review 8, F10, round 1: a note re-checks the episodes' lines once, after
// it is sorted and its change has landed on the card and on the copies that
// follow it. Checked at once, a line rewritten for the note was rewritten
// again when its copy changed: two paid writer runs for one note. The
// agents are stand-ins: these checks count runs, not what a model writes.
const { revise, draw, stage, runs } = vi.hoisted(() => ({
  revise: vi.fn(),
  draw: vi.fn(),
  stage: vi.fn(),
  runs: [] as Array<{ route: string; projectId: string; sorting: boolean }>
}))
vi.mock('./creative/slide-revision', () => ({
  prepareCreativeSlideRevision: revise
}))
vi.mock('./creative/pages', () => ({ prepareCreativePages: draw }))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
const root = await mkdtemp(join(tmpdir(), 'studio-review-8-claims-cost-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { writeRow } = await import('./persistence')
const { loadProject } = await import('./projects')
const { copyOf } = await import('./map-copy')
const segues = await import('./map-segues')
const notes = await import('./map-notes')
const { readSourceNarrative } = await import('./source-document')
const { pageBrandFrom } = await import('./source-page')
afterAll(async () => {
  await segues.settledAllSegues()
  await rm(root, { recursive: true, force: true })
})

const NOTE =
  'New learning: the retention window is part of the idempotency contract. After expiry, the same key may be treated as a new request. Do not promise that an old retry will be deduplicated forever.'
const source = readSourceNarrative(
  'An idempotency key lets the server tell a retry from a new order.'
)
const OVER =
  'Last time, one click became two lattes. Now an idempotency key means a retry can never pour a second latte.'
const SCOPED =
  'Last time, one click became two lattes. Now an idempotency key means a retry inside the key’s retention window gets the first latte back.'
const card: Slide = {
  id: 'key',
  title: 'First tool: an idempotency key',
  svg: '<svg id="old"/>',
  narration: 'The client reuses one key for every retry of an order.',
  idea: 'One key per order'
}
const timeout: Slide = {
  id: 'timeout',
  title: 'A timeout is ambiguous',
  svg: '<svg/>',
  narration: 'A timeout tells the client no answer arrived.',
  idea: 'A timeout proves nothing'
}
revise.mockResolvedValue({
  title: 'APIs',
  scenes: [
    {
      title: 'First tool: an idempotency key',
      kind: 'list',
      seconds: 6,
      idea: 'One key per order, kept for a retention window',
      narration:
        'The client reuses one key for every retry of an order. The server keeps it only for a retention window.',
      parts: [],
      relations: [],
      source: [source.text]
    }
  ],
  targetSeconds: 6,
  glossary: []
})
draw.mockResolvedValue(['<svg id="new"/>'])
let sorting = false
stage.mockImplementation(async (input: Record<string, unknown>) => {
  const route = input.route as string
  runs.push({ route, projectId: input.projectId as string, sorting })
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  if (route === 'Sort Note') {
    // A writer's run while the note is sorted shows here; it ends first.
    sorting = true
    await segues.settledAllSegues()
    sorting = false
    return validate({ items: [{ kind: 'adds', line: NOTE, page: 'key' }] })
      .value
  }
  const brief = JSON.parse(
    (input.packet as Record<string, string>)['packet/EPISODE.json']
  )
  const limited = (brief.limits as Array<{ says: string }>).some((limit) =>
    limit.says.startsWith('Do not promise')
  )
  const reply = (bridge: string) => ({
    pages: brief.pages.map((p: { id: string }, index: number) => ({
      id: p.id,
      bridge: index ? 'So.' : bridge
    })),
    outro: brief.next ? 'Next time, the race.' : 'That is the series.'
  })
  let report = validate(reply(limited ? SCOPED : OVER))
  if (!report.ok) report = validate(reply(SCOPED))
  return report.value
})

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

it('rewrites a line for a note once, after the note’s change reaches its copy', async () => {
  await write('map', { mapSeries: 's', slides: [timeout, card] })
  await writeRow('outlines', 'map', {
    source,
    brand: pageBrandFrom(source.palette, source.fonts)
  })
  await writeRow('series', 's', {
    id: 's',
    title: 'APIs',
    map: 'map',
    organize: true,
    episodes: [
      { notebookId: 'one', number: 1 },
      { notebookId: 'two', number: 2 }
    ]
  })
  await write('one', {
    copyOfMap: 'map',
    episode: { series: 's', number: 1 },
    slides: [copyOf('map', timeout)]
  })
  await write('two', {
    copyOfMap: 'map',
    episode: { series: 's', number: 2 },
    slides: [copyOf('map', card)]
  })
  // Before the note: no limit, so episode 2's line stands as written.
  segues.scheduleSegues('one')
  segues.scheduleSegues('two')
  await segues.settledAllSegues()
  expect((await loadProject('two'))!.project.slides[0].bridge).toBe(OVER)
  runs.length = 0
  await notes.addNote('map', { text: NOTE })
  await notes.settledNotes()
  await segues.settledAllSegues()
  // The change landed on the card and on episode 2's untouched copy.
  const copy = (await loadProject('two'))!.project.slides[0]
  expect(copy.svg).toBe('<svg id="new"/>')
  expect(copy.bridge).toBe(SCOPED)
  // One writer run for episode 2, and none while the note was sorted.
  const writes = runs.filter((run) => run.route === 'Write Segues')
  expect(writes.filter((run) => run.projectId === 'two')).toHaveLength(1)
  expect(writes.filter((run) => run.sorting)).toEqual([])
})
