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
const { draftPosts, updateRelease } = await import('./release')
const { presentationScreen } = await import('../app/presentation-screen')
const { postsSection } = await import('../app/release-view')
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

const LOG = `# Learning log: APIs that survive retries

A timeout tells the client that it did not receive a response; it does not prove the order failed. Retrying the same POST can create two orders.

The client creates a unique key for one logical order and reuses it when retrying that order. The server stores the key with a fingerprint of the request and the result.`
// The live run's note, as the creator wrote it.
const NOTE =
  'New learning: the retention window is part of the idempotency contract. Keep a key long enough to cover the documented client retry window. After expiry, the same key may be treated as a new request. Do not promise that an old retry will be deduplicated forever. I want this caveat included in the series.'
const NOTED = `${LOG}\n\n## Note, 17 October 2026\n\n${NOTE}`
const LIMIT = 'Do not promise that an old retry will be deduplicated forever.'
// The live run's outro and its LinkedIn copy; the rewrite the audit's
// stand-in moved to; and each said within its limit.
const OVER =
  'Next time, in Give the latte a name, we reach for our first tool: an idempotency key, so a retry can never pour a second latte.'
const FOREVER =
  'Next time, in Give the latte a name: an idempotency key, so an old retry is deduplicated forever.'
const SCOPED =
  'Next time, in Give the latte a name: an idempotency key, so that within the key’s retention window a retry can never pour a second latte.'
const POST_OVER =
  'Next episode, I reach for the first tool: an idempotency key, so a retry can never pour a second latte.'
const POST_SCOPED =
  'Next episode: an idempotency key, so that within the key’s retention window a retry can never pour a second latte.'
const KEY_SCRIPT =
  'Our first tool is an idempotency key. Before sending the latte order, the client creates a unique key for it and reuses that same key on every retry of that order. A retry with the same key and the same request gets the original result back.'
const NOTE_SAYS = `It says “never”; the note of 17 October 2026 says “${LIMIT}”`

const page = (id: string, title: string, narration: string) =>
  ({
    id,
    title,
    svg: `<svg><text>${title}</text></svg>`,
    idea: `${title}, in a sentence`,
    narration
  }) satisfies Slide
const drawnMap = async (id: string, source: string) => {
  const slides = [
    page(`${id}-1`, 'APIs that survive retries', 'One click, one latte.'),
    page(
      `${id}-2`,
      'A timeout is ambiguous',
      'Our client sends POST /orders for one latte and waits. The server commits the order, but its response gets lost on the way back.'
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
const screenOf = (snapshot: Snapshot) =>
  presentationScreen(
    { ...snapshot, views: projectViews(snapshot.project, []) },
    1
  )

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key]
  asked.length = 0
  briefs.length = 0
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
    says: LIMIT,
    from: 'the note of 17 October 2026'
  })
  // Sent back once, with the creator's words it went past.
  expect(asked).toHaveLength(1)
  expect(asked[0].problems).toEqual([
    `The outro says “never”, which the pages and the creator’s notes don’t promise; the note of 17 October 2026 says: “${LIMIT}”. Keep to what they say, within its limit, or leave the promise out`
  ])
  const last = await lastOf(one)
  expect(last.copyOf?.slide).toBe(ids[1])
  expect(last.outro).toBe(SCOPED)
  expect(last.narration).toContain(SCOPED)
  expect((await loadProject(one))!.project.segueChecks).toBeUndefined()
})

it('flags the rewrite that moves to “deduplicated forever”, the very promise the note forbids', async () => {
  replies['Write Segues'] = writer(() => 'Next.')
  const { one } = await twoEpisodes('m-forever', NOTED)
  replies['Write Segues'] = writer((_, said) => (said.length ? FOREVER : OVER))
  segues.scheduleSegues(one, true)
  await segues.settledAllSegues()
  expect(asked).toHaveLength(1)
  const snapshot = (await loadProject(one))!
  const last = snapshot.project.slides.at(-1)!
  expect(last.outro).toBe(FOREVER)
  expect(snapshot.project.segueChecks).toEqual({
    [last.id]: {
      outro: {
        line: FOREVER,
        note: `It says “forever”; the note of 17 October 2026 says “${LIMIT}”`
      }
    }
  })
})

it('keeps a line still past the limit after its rewrite, flagged where it is approved, until it is kept or written again', async () => {
  replies['Write Segues'] = writer(() => 'Next.')
  const { one, two } = await twoEpisodes('m-stubborn', NOTED)
  replies['Write Segues'] = writer(() => OVER)
  segues.scheduleSegues(one, true)
  await segues.settledAllSegues()
  expect(asked).toHaveLength(1)
  const snapshot = (await loadProject(one))!
  const last = snapshot.project.slides.at(-1)!
  expect(last.outro).toBe(OVER)
  expect(snapshot.project.segueChecks).toEqual({
    [last.id]: { outro: { line: OVER, note: NOTE_SAYS } }
  })
  expect(snapshot.events.map((event) => event.message)).toContain(
    `Check the line after “A timeout is ambiguous”. ${NOTE_SAYS}`
  )
  // Under "Said after it" on its wireframe, with the two answers.
  expect(screenOf(snapshot)).toContain(
    `<p class="page-check">Check this line <small>${NOTE_SAYS}</small> <button type="button" class="quiet" data-action="segue-again" data-slide="${last.id}" data-line="outro">Write it again</button><button type="button" class="quiet" data-action="segue-keep" data-slide="${last.id}" data-line="outro">Keep it</button></p>`
  )
  // On the map's "Next time" card.
  const view = await episodes.mapView('m-stubborn')
  const card = view.episodes.find((e) => e.notebook === one)!.copies.at(-1)!
  expect(card.checks).toEqual({ outro: NOTE_SAYS })
  expect(view.episodes.find((e) => e.notebook === two)!.copies[0].checks).toBe(
    undefined
  )
  // Flagged once: the next write leaves it, and asks no writer.
  stage.mockClear()
  segues.scheduleSegues(one)
  await segues.settledAllSegues()
  expect(stage).not.toHaveBeenCalled()
  // Written again: that line alone, through the check once more.
  const bridges = snapshot.project.slides.map((slide) => slide.bridge)
  replies['Write Segues'] = writer(() => SCOPED)
  await segues.answerSegueCheck(one, { slide: last.id, line: 'outro' })
  await segues.settledAllSegues()
  const again = (await loadProject(one))!
  expect(again.project.slides.at(-1)!.outro).toBe(SCOPED)
  expect(again.project.slides.map((slide) => slide.bridge)).toEqual(bridges)
  expect(again.project.segueChecks).toBeUndefined()
  expect(screenOf(again)).not.toContain('Check this line')
})

it('keeps a flagged line as it is when the creator says so, and shows it nowhere again', async () => {
  replies['Write Segues'] = writer(() => 'Next.')
  const { one } = await twoEpisodes('m-keep', NOTED)
  replies['Write Segues'] = writer(() => OVER)
  segues.scheduleSegues(one, true)
  await segues.settledAllSegues()
  const last = await lastOf(one)
  const kept = await segues.answerSegueCheck(one, {
    slide: last.id,
    line: 'outro',
    keep: true
  })
  expect(kept.project.segueChecks?.[last.id]?.outro?.kept).toBe(true)
  expect(kept.project.slides.at(-1)!.outro).toBe(OVER)
  expect(screenOf(kept)).not.toContain('Check this line')
  const view = await episodes.mapView('m-keep')
  expect(
    view.episodes.find((e) => e.notebook === one)!.copies.at(-1)!.checks
  ).toBeUndefined()
  // Kept stays kept: no writer is asked about it again.
  stage.mockClear()
  segues.scheduleSegues(one)
  await segues.settledAllSegues()
  expect(stage).not.toHaveBeenCalled()
  await expect(
    segues.answerSegueCheck(one, { slide: last.id, line: 'outro', keep: true })
  ).rejects.toThrow('That line is no longer flagged')
})

it('writes a line again once a later note is sorted and brings a limit it goes past', async () => {
  // Before the note: no limit, so the line stands as written.
  replies['Write Segues'] = writer((brief) =>
    (brief.limits as Array<{ says: string }>).some((limit) =>
      limit.says.startsWith('Do not promise')
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

it('writes a line again in an episode whose plan still waits for approval, and marks the plan to be made again (round 2)', async () => {
  replies['Write Segues'] = writer((brief) =>
    (brief.limits as Array<{ says: string }>).some((limit) =>
      limit.says.startsWith('Do not promise')
    )
      ? SCOPED
      : OVER
  )
  const { ids, one } = await twoEpisodes('m-plan', LOG)
  // The storyboard was planned before the note came: it is not approved.
  await changeProject(one, (current) => {
    current.project.video = {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null,
      storyboard: {
        id: 'sb',
        pages: current.project.slides.map((slide) => slide.id),
        stage: 'review',
        status: 'waiting',
        waitingFor: 'approval'
      }
    } as never
  })
  replies['Sort Note'] = () => ({
    items: [{ kind: 'adds', line: NOTE, page: ids[2] }]
  })
  await notes.addNote('m-plan', { text: NOTE })
  await notes.settledNotes()
  await segues.settledAllSegues()
  const snapshot = (await loadProject(one))!
  expect(snapshot.project.slides.at(-1)!.outro).toBe(SCOPED)
  expect(snapshot.project.segueChecks).toBeUndefined()
  expect(snapshot.project.video?.storyboard?.replan).toBe(true)
})

it('flags, and leaves as it is, a line under an approved video when a later note brings a limit it goes past', async () => {
  replies['Write Segues'] = writer(() => OVER)
  const { ids, one } = await twoEpisodes('m-made', LOG)
  // The live run: the storyboard was approved before the note came.
  await changeProject(one, (current) => {
    current.project.video = {
      settings: { presence: 'off', voice: { kind: 'record' } },
      scenes: [],
      transitions: [],
      inputKey: '',
      produced: null,
      storyboard: {
        id: 'sb',
        pages: [],
        stage: 'stills',
        status: 'working',
        approved: true
      }
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
          /^It says “never”; the note of .+ says “Do not promise that an old retry/
        )
      }
    }
  })
  expect(snapshot.events.at(-1)?.message).toMatch(
    /^Check the line after “A timeout is ambiguous”\. It says “never”/
  )
  // Asked for by the creator, it is written again even under the video.
  replies['Write Segues'] = writer(() => SCOPED)
  await segues.answerSegueCheck(one, { slide: last.id, line: 'outro' })
  await segues.settledAllSegues()
  expect((await lastOf(one)).outro).toBe(SCOPED)
})

it('gives the posts writer the creator’s limits, sends a post past them back once, and flags one still past them in Release', async () => {
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
    says: LIMIT,
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
  const fixed = (await loadProject(one))!
  expect(fixed.project.release?.posts?.linkedin).toBe(POST_SCOPED)
  expect(fixed.project.release?.postChecks).toBeUndefined()
  expect(postsSection(fixed)).not.toContain('Check this post')
  // A post still past the limit after its rewrite is kept, flagged beside
  // it with the two answers, and said.
  replies['Draft Posts'] = () => posts(POST_OVER)
  await draftPosts(one)
  await vi.waitFor(async () =>
    expect((await loadProject(one))!.project.release?.posts?.linkedin).toBe(
      POST_OVER
    )
  )
  const flagged = (await loadProject(one))!
  expect(flagged.project.release?.postChecks).toEqual({
    linkedin: { text: POST_OVER, note: NOTE_SAYS }
  })
  expect(postsSection(flagged)).toContain(
    `<p class="page-check">Check this post <small>${NOTE_SAYS}</small> <button type="button" class="quiet" data-action="draft-posts">Write it again</button><button type="button" class="quiet" data-action="keep-post-check" data-channel="linkedin">Keep it</button></p>`
  )
  expect(flagged.events.map((event) => event.message)).toContain(
    `Check the LinkedIn post. ${NOTE_SAYS}`
  )
  // Kept: the flag goes. Edited: a flag on other words shows nowhere.
  const kept = await updateRelease(one, { keepCheck: 'linkedin' })
  expect(postsSection(kept)).not.toContain('Check this post')
  await expect(updateRelease(one, { keepCheck: 'x' })).rejects.toThrow(
    'That post is no longer flagged'
  )
})
