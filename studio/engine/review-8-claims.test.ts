import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import { projectViews } from '../shared/state'
// Review 8, F10: an automatic segue said "so a retry can never pour a second
// latte" against the creator's note on the key's retention window, and the
// LinkedIn draft repeated it. The writers are stand-ins that answer a
// refusal as an agent does: these checks prove what the writers are given
// and what the studio does with their lines, not what a model would write.
const { stage, replies, asked } = vi.hoisted(() => ({
  stage: vi.fn(),
  replies: {} as Record<
    string,
    (input: Record<string, unknown>, problems: string[]) => unknown
  >,
  asked: [] as Array<{ route: string; problems: string[] }>
}))
vi.mock('./creative/stage', () => ({ runValidatedJsonStage: stage }))
vi.mock('./slide-changes', async (original) => ({
  ...(await original<typeof import('./slide-changes')>()),
  scheduleChanges: vi.fn()
}))
vi.mock('../app/api', () => ({ api: {} }))
const root = await mkdtemp(join(tmpdir(), 'minimal-review-8-claims-'))
process.env.MINIMAL_STUDIO_DATA_DIR = join(root, 'data')
const { writeRow } = await import('./persistence')
const { loadProject, changeProject } = await import('./projects')
const episodes = await import('./map-episodes')
const segues = await import('./map-segues')
const notes = await import('./map-notes')
const { draftPosts } = await import('./release')
const { materialOf, overclaims } = await import('./claims')
const { presentationScreen } = await import('../app/presentation-screen')
afterAll(async () => {
  await segues.settledAllSegues()
  await rm(root, { recursive: true, force: true })
})

// As the harness does: a refused submission goes back with its problems,
// at most six times.
stage.mockImplementation(async (input: Record<string, unknown>) => {
  const route = input.route as string
  const reply = replies[route]
  if (!reply) throw new Error(`No stand-in for ${route}`)
  const validate = input.validate as (raw: unknown) => {
    ok: boolean
    problems: string[]
    value: unknown
  }
  let problems: string[] = []
  for (let attempt = 0; attempt < 6; attempt++) {
    const report = validate(await reply(input, problems))
    if (report.ok) return report.value
    problems = report.problems
    asked.push({ route, problems })
  }
  throw new Error('This stage reached its submission budget')
})
const packetOf = (input: Record<string, unknown>, name: string) =>
  JSON.parse((input.packet as Record<string, string>)[`packet/${name}`])

const LOG = `Learning log: APIs that survive retries

A customer taps order once and pays for two lattes. The client timed out and retried the same POST. A timeout only tells the client that no answer arrived; it doesn't prove the order failed.

The fix is an idempotency key: the client makes one key per order and sends it with every retry, and the server stores the key with the result.`
const NOTE =
  'Careful with the promise: deduplication only lasts as long as the server keeps the key, its retention window. Don’t promise a retry is safe forever; after the window the same key is new again.'
const NOTED = `${LOG}\n\n## Note, 17 October 2026\n\n${NOTE}`
// The live run's outro and its LinkedIn copy, and each said within its
// limit: the same guarantee, in its stated scope.
const OVER =
  'Next time, in Give the latte a name, we reach for our first tool: an idempotency key, so a retry can never pour a second latte.'
const SCOPED =
  'Next time, in Give the latte a name: an idempotency key, so that within the key’s retention window a retry can never pour a second latte.'
const POST_OVER =
  'Next episode, I reach for the first tool: an idempotency key, so a retry can never pour a second latte.'
const POST_SCOPED =
  'Next episode: an idempotency key, so that within the key’s retention window a retry can never pour a second latte.'
const KEY_SCRIPT =
  'Our first tool is an idempotency key. Before sending the latte order, the client creates a unique key for it and reuses that same key on every retry of that order. A retry with the same key and the same request gets the original result back.'

const page = (id: string, title: string, narration: string, svg = '') =>
  ({
    id,
    title,
    svg: svg || `<svg><text>${title}</text></svg>`,
    idea: `${title}, in a sentence`,
    narration
  }) satisfies Slide
const drawnMap = async (id: string, source: string) => {
  const slides = [
    page(`${id}-1`, 'APIs that survive retries', 'One click, one latte.'),
    page(
      `${id}-2`,
      'A timeout is ambiguous',
      'Our client sends POST /orders for one latte and waits. The server commits the order, but its response gets lost on the way back. If the client simply sends the same POST again, one click can turn into two lattes.',
      '<svg><text>Lost response</text><text>never reaches the client</text></svg>'
    ),
    page(`${id}-3`, 'First tool: an idempotency key', KEY_SCRIPT),
    page(
      `${id}-4`,
      'The database race',
      'Two copies of the same order hit the database at once.'
    )
  ]
  const snapshot: Snapshot = {
    project: {
      id,
      title: 'APIs that survive retries',
      source,
      harness: { adapter: 'claude-code' },
      slides,
      video: null
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
  await writeRow('outlines', id, {
    source: { title: 'APIs', text: source },
    brand: {},
    outline: { title: 'APIs', scenes: slides.map((s) => ({ title: s.title })) },
    slideIds: slides.map((s) => s.id)
  })
  await writeRow('sources', id, { title: 'APIs', text: source })
  return slides.map((slide) => slide.id)
}
/** The live run's series: episode 1 ends on the timeout, episode 2 opens
 * on the idempotency key. */
const twoEpisodes = async (id: string, source: string) => {
  const ids = await drawnMap(id, source)
  const series = await episodes.startMapSeries(id, {})
  const one = await episodes.addMapEpisode(series.id, {
    title: 'One click, two lattes',
    slides: [ids[0], ids[1]]
  })
  const two = await episodes.addMapEpisode(series.id, {
    title: 'Give the latte a name',
    slides: [ids[2], ids[3]]
  })
  await segues.settledAllSegues()
  return { ids, one: one.notebook.project.id, two: two.notebook.project.id }
}
const lastOf = async (notebook: string) =>
  (await loadProject(notebook))!.project.slides.at(-1)!
/** A segue writer: plain bridges; the outro given, or the next one. */
const writer =
  (outro: (brief: Record<string, unknown>, problems: string[]) => string) =>
  (input: Record<string, unknown>, problems: string[]) => {
    const brief = packetOf(input, 'EPISODE.json')
    return {
      pages: brief.pages.map((p: { id: string }) => ({
        id: p.id,
        bridge: 'So.'
      })),
      outro: brief.next ? outro(brief, problems) : 'That is the series.'
    }
  }
const briefs: Array<Record<string, unknown>> = []

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key]
  asked.length = 0
  briefs.length = 0
})

it('finds a promise past the creator’s limit, and lets a scoped line, a story line and a backed one through', () => {
  const material = materialOf(NOTED, [])
  const [claim] = overclaims(OVER, material)
  expect(claim).toMatchObject({
    word: 'never',
    limit: {
      from: 'the note of 17 October 2026',
      says: 'Don’t promise a retry is safe forever; after the window the same key is new again.'
    }
  })
  // The same "never", said within the limit, is the creator's.
  expect(overclaims(SCOPED, material)).toEqual([])
  // "Never" in a story line is no promise.
  expect(
    overclaims(
      'It starts with a single request that never hears back.',
      material
    )
  ).toEqual([])
  // "Doesn't … forever" keeps a limit, in a line or in the notes: the note's
  // "don't promise … forever" backs no "forever".
  const log = materialOf(LOG, [])
  expect(overclaims('A key doesn’t keep a retry safe forever.', log)).toEqual(
    []
  )
  expect(
    overclaims('A key keeps a retry safe forever.', material)
  ).toMatchObject([
    { word: 'forever', limit: { from: 'the note of 17 October 2026' } }
  ])
  // The creator said it outright about the same things: it is theirs.
  const backed =
    'With the same key, retries are guaranteed to return the first result.'
  expect(
    overclaims(
      'Retries with the same key are guaranteed to return the first result.',
      materialOf(backed, [])
    )
  ).toEqual([])
  // A promise word needs backing even where no limit was written.
  expect(overclaims('Retries are guaranteed to be safe.', log)).toMatchObject([
    { word: 'guaranteed' }
  ])
})

it('gives the segue writer the creator’s limits and the next page, and sends a line past them back once', async () => {
  replies['Write Segues'] = writer(() => 'Next.')
  const { ids, one } = await twoEpisodes('m-segue', NOTED)
  replies['Write Segues'] = (input, problems) => {
    briefs.push(packetOf(input, 'EPISODE.json'))
    return writer((_, said) => (said.length ? SCOPED : OVER))(input, problems)
  }
  segues.scheduleSegues(one, true)
  await segues.settledAllSegues()
  const brief = briefs[0] as {
    next: { opens: string; page: { script: string } }
    limits: Array<{ says: string; from: string }>
  }
  expect(brief.next.opens).toBe('First tool: an idempotency key')
  expect(brief.next.page.script).toBe(KEY_SCRIPT)
  expect(brief.limits).toContainEqual({
    says: 'Careful with the promise: deduplication only lasts as long as the server keeps the key, its retention window.',
    from: 'the note of 17 October 2026'
  })
  // Sent back once, with the creator's words it went past.
  expect(asked).toHaveLength(1)
  expect(asked[0].problems).toEqual([
    expect.stringMatching(
      /^The outro says “never”, which the pages and the creator’s notes don’t promise; the note of 17 October 2026 says: “Don’t promise a retry is safe forever/
    )
  ])
  const last = await lastOf(one)
  expect(last.copyOf?.slide).toBe(ids[1])
  expect(last.outro).toBe(SCOPED)
  expect(last.narration).toContain(SCOPED)
  expect((await loadProject(one))!.project.segueChecks).toBeUndefined()
})

it('keeps a line still past the limit after its rewrite, flagged under it, and doesn’t ask again', async () => {
  replies['Write Segues'] = writer(() => 'Next.')
  const { one } = await twoEpisodes('m-stubborn', NOTED)
  replies['Write Segues'] = writer(() => OVER)
  segues.scheduleSegues(one, true)
  await segues.settledAllSegues()
  expect(asked).toHaveLength(1)
  const snapshot = (await loadProject(one))!
  const last = snapshot.project.slides.at(-1)!
  expect(last.outro).toBe(OVER)
  const note =
    'It says “never”; the note of 17 October 2026 says “Don’t promise a retry is safe forever; after the window the same key is new again.”'
  expect(snapshot.project.segueChecks).toEqual({
    [last.id]: { outro: { line: OVER, note } }
  })
  expect(snapshot.events.map((event) => event.message)).toContain(
    `Check the line after “A timeout is ambiguous”. ${note}`
  )
  // Under "Said after it" on its wireframe.
  const screen = presentationScreen(
    { ...snapshot, views: projectViews(snapshot.project, []) },
    1
  )
  expect(screen).toContain(
    `<p class="page-check">Check this line <small>${note}</small></p>`
  )
  // Flagged once: the next write leaves it, and asks no writer.
  stage.mockClear()
  segues.scheduleSegues(one)
  await segues.settledAllSegues()
  expect(stage).not.toHaveBeenCalled()
  expect((await lastOf(one)).outro).toBe(OVER)
})

it('writes a line again when a later note brings a limit it goes past', async () => {
  // Before the note: no limit, so the line stands as written.
  replies['Write Segues'] = writer((brief) =>
    (brief.limits as Array<{ says: string }>).some((limit) =>
      limit.says.includes('retention window')
    )
      ? SCOPED
      : OVER
  )
  const { ids, one } = await twoEpisodes('m-later', LOG)
  expect((await lastOf(one)).outro).toBe(OVER)
  replies['Sort Note'] = () => ({
    items: [{ kind: 'adds', line: NOTE, page: ids[2] }]
  })
  await notes.addNote('m-later', { text: NOTE })
  await notes.settledNotes()
  await segues.settledAllSegues()
  expect((await lastOf(one)).outro).toBe(SCOPED)
  expect((await loadProject(one))!.project.segueChecks).toBeUndefined()
})

it('flags, and leaves as it is, a line under a started video when a later note brings a limit it goes past', async () => {
  replies['Write Segues'] = writer(() => OVER)
  const { ids, one } = await twoEpisodes('m-made', LOG)
  // The live run: the storyboard was planned before the note came.
  await changeProject(one, (current) => {
    current.project.video = {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null,
      storyboard: { id: 'sb', pages: [], stage: 'plan', status: 'working' }
    } as never
  })
  replies['Sort Note'] = () => ({
    items: [{ kind: 'adds', line: NOTE, page: ids[2] }]
  })
  stage.mockClear()
  await notes.addNote('m-made', { text: NOTE })
  await notes.settledNotes()
  await segues.settledAllSegues()
  expect(
    stage.mock.calls.map(([input]) => (input as { route: string }).route)
  ).toEqual(['Sort Note'])
  const snapshot = (await loadProject(one))!
  const last = snapshot.project.slides.at(-1)!
  expect(last.outro).toBe(OVER)
  expect(snapshot.project.segueChecks).toEqual({
    [last.id]: {
      outro: {
        line: OVER,
        note: expect.stringMatching(
          /^It says “never”; the note of .+ says “Don’t promise a retry is safe forever/
        )
      }
    }
  })
  expect(snapshot.events.at(-1)?.message).toMatch(
    /^Check the line after “A timeout is ambiguous”\. It says “never”/
  )
})

it('gives the posts writer the creator’s limits, and sends a post past them back once', async () => {
  replies['Write Segues'] = writer(() => 'Next.')
  const { one } = await twoEpisodes('m-posts', NOTED)
  await changeProject(one, (current) => {
    current.project.video = {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: { inputKey: '', objectKey: 'made.mp4' }
    }
  })
  let limits: Array<{ says: string; from: string }> = []
  const posts = (linkedin: string) => ({
    x: 'You tap order once. How do you pay for two lattes?',
    linkedin,
    youtube: 'Why a timeout is ambiguous, for developers building an API.'
  })
  replies['Draft Posts'] = (input, problems) => {
    limits = packetOf(input, 'VIDEO.json').limits
    return posts(problems.length ? POST_SCOPED : POST_OVER)
  }
  await draftPosts(one)
  await vi.waitFor(async () =>
    expect(
      (await loadProject(one))!.project.release?.posts?.linkedin
    ).toBeTruthy()
  )
  expect(limits).toContainEqual({
    says: 'Don’t promise a retry is safe forever; after the window the same key is new again.',
    from: 'the note of 17 October 2026'
  })
  expect(asked).toEqual([
    {
      route: 'Draft Posts',
      problems: [
        expect.stringMatching(/^The LinkedIn post says “never”, which/)
      ]
    }
  ])
  expect((await loadProject(one))!.project.release?.posts?.linkedin).toBe(
    POST_SCOPED
  )
  // A post still past the limit after its rewrite is kept, and said.
  replies['Draft Posts'] = () => posts(POST_OVER)
  await draftPosts(one)
  await vi.waitFor(async () =>
    expect((await loadProject(one))!.project.release?.posts?.linkedin).toBe(
      POST_OVER
    )
  )
  expect(
    (await loadProject(one))!.events.map((event) => event.message)
  ).toContain(
    'Check the LinkedIn post. It says “never”; the note of 17 October 2026 says “Don’t promise a retry is safe forever; after the window the same key is new again.”'
  )
})
