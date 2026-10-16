// Place Pages: cards that land on the map after the series is planned
// organise themselves into it (storyboard-master/workflows/place-pages.md).
// Only the new cards are placed: into an open episode where it builds best,
// as a new episode after the last made one, against a gap they fill, or left
// out with a reason. Made episodes never change. Each run is recorded, so
// Undo takes out what it added; the cards it took back wait, unplaced.
import { randomUUID } from 'node:crypto'
import { fitOf, withSegues } from '../shared/length'
import type { OrganizeRun, Series } from '../shared/series'
import type { LengthGoal } from '../shared/storyboard'
import { organizes } from '../shared/series'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { addMapEpisode, changeCopies } from './map-episodes'
import { scheduleAround, settledSegues } from './map-segues'
import { detectedHarness } from './notebook-intake'
import { deleteRow } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { changeSeries, loadSeries } from './series'
import {
  isMade,
  pagesOf,
  setEpisodePages,
  setSeriesOrder
} from './series-apply'
import { directionLines, cardsOf, existingOf, isPlanning } from './series-plan'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
const list = (value: unknown) => (Array.isArray(value) ? value : [])

export type Move = {
  page: string
  into?: string
  after?: string | null
  start?: string
  closes?: string
  left?: boolean
  why: string
}
export type Started = {
  key: string
  title: string
  about: string
  win: string
  teaches: string[]
  carries: string
  lines: string[]
  /** The episode it comes after (its notebook); null opens the series. */
  after: string | null
}
export type Answer = {
  id: string
  state: 'followed' | 'partly' | 'not'
  why: string
}
export type Placement = { moves: Move[]; start: Started[]; answers: Answer[] }

type Rules = {
  fresh: string[]
  episodes: Array<{ notebook: string; made: boolean; pages: string[] }>
  gaps: string[]
  lines: string[]
  /** The creator's direction ids, which a placement may answer again. */
  directions?: string[]
  /** How long each episode may run, and each card's running time. */
  length?: LengthGoal
  seconds?: Record<string, number>
}

/** Every new card placed once: into an open episode after a card it holds,
 * into a new episode after the last made one, against an open gap, or left
 * out with a reason. */
export const validatePlacement = (raw: unknown, rules: Rules) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const start: Started[] = list(value.start).map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>
    return {
      key: words(entry.key, 40),
      title: words(entry.title, 80),
      about: words(entry.about, 300),
      win: words(entry.win, 200),
      teaches: list(entry.teaches)
        .map((thing) => words(thing, 80))
        .filter(Boolean)
        .slice(0, 4),
      carries: words(entry.carries, 300),
      lines: list(entry.lines)
        .map(String)
        .filter((id) => rules.lines.includes(id)),
      after: entry.after ? String(entry.after) : null
    }
  })
  const lastMade = rules.episodes.reduce(
    (at, item, index) => (item.made ? index : at),
    -1
  )
  const episode = new Map(rules.episodes.map((item) => [item.notebook, item]))
  for (const item of start) {
    if (!item.key || !item.title || !item.about || !item.win)
      problems.push(
        'Each new episode needs a key, a title, its message (about) and the viewer’s win'
      )
    const at = item.after
      ? rules.episodes.findIndex((e) => e.notebook === item.after)
      : -1
    if (item.after && at < 0)
      problems.push(`New episode ${item.key}: ${item.after} is not an episode`)
    else if (at < lastMade)
      problems.push(
        `New episode ${item.key}: it must come after episode ${lastMade + 1}, the last one made`
      )
  }
  const keys = new Set(start.map((item) => item.key))
  const moves: Move[] = list(value.moves).map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>
    return {
      page: String(entry.page || ''),
      ...(entry.into ? { into: String(entry.into) } : {}),
      ...(entry.after === null || entry.after === undefined
        ? { after: null }
        : { after: String(entry.after) }),
      ...(entry.start ? { start: String(entry.start) } : {}),
      ...(entry.closes ? { closes: String(entry.closes) } : {}),
      ...(entry.left === true ? { left: true } : {}),
      why: words(entry.why, 200)
    }
  })
  const placed = new Map<string, number>()
  moves.forEach((move, index) => {
    const label = `Move ${index + 1}`
    if (!rules.fresh.includes(move.page))
      return problems.push(`${label}: ${move.page} is not one of the new cards`)
    placed.set(move.page, (placed.get(move.page) || 0) + 1)
    if (!move.why) problems.push(`${label}: say why, in a line`)
    const ways = [move.into, move.start, move.left].filter(Boolean).length
    if (ways !== 1)
      problems.push(
        `${label}: put ${move.page} into an episode, start a new one, or leave it out (one of them)`
      )
    if (move.closes && !rules.gaps.includes(move.closes))
      problems.push(`${label}: ${move.closes} is not an open gap`)
    if (move.closes && move.left)
      problems.push(`${label}: a card that fills a gap goes into an episode`)
    if (move.start && !keys.has(move.start))
      problems.push(`${label}: no new episode has the key ${move.start}`)
    if (move.into) {
      const target = episode.get(move.into)
      if (!target) problems.push(`${label}: ${move.into} is not an episode`)
      else if (target.made)
        problems.push(
          `${label}: episode ${rules.episodes.indexOf(target) + 1} is made; start a new episode instead`
        )
      else if (
        move.after &&
        !target.pages.includes(move.after) &&
        !moves.some(
          (other) => other.page === move.after && other.into === move.into
        )
      )
        problems.push(
          `${label}: ${move.after} is not a card of that episode (null puts it first)`
        )
    }
  })
  for (const page of rules.fresh)
    if (placed.get(page) !== 1) problems.push(`Place ${page} exactly once`)
  for (const item of start)
    if (!moves.some((move) => move.start === item.key))
      problems.push(`New episode ${item.key} has no card`)
  // An episode the new cards push past the longest: say so, or refuse it
  // when the length is strict.
  const warnings: string[] = []
  const goal = rules.length
  if (goal && rules.seconds) {
    const runs = (pages: string[]) =>
      withSegues(pages.map((page) => rules.seconds![page] || 0))
    const filled = [
      ...rules.episodes.map((target, index) => ({
        name: `Episode ${index + 1}`,
        pages: [
          ...target.pages,
          ...moves.filter((m) => m.into === target.notebook).map((m) => m.page)
        ],
        grew: moves.some((m) => m.into === target.notebook)
      })),
      ...start.map((item) => ({
        name: `New episode ${item.key}`,
        pages: moves.filter((m) => m.start === item.key).map((m) => m.page),
        grew: true
      }))
    ]
    for (const { name, pages, grew } of filled) {
      const total = runs(pages)
      if (!grew || pages.length < 2 || fitOf(total, goal) !== 'long') continue
      const line = `${name} would run about ${Math.round(total)} s, past the longest ${goal.max} s: start a new episode for some of the cards`
      ;(goal.strict ? problems : warnings).push(line)
    }
  }
  // A direction the moves change is answered again; others keep theirs.
  const answers: Answer[] = list(value.answers)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      return {
        id: String(entry.id || ''),
        state: String(entry.state || '') as Answer['state'],
        why: words(entry.why, 200)
      }
    })
    .filter(
      (answer) =>
        (rules.directions || []).includes(answer.id) &&
        ['followed', 'partly', 'not'].includes(answer.state) &&
        answer.why
    )
  return {
    ok: problems.length === 0,
    problems,
    warnings,
    value: { moves, start, answers }
  }
}

const organizing = new Map<string, Promise<void>>()
/** Resolves when the series has organised its new cards (tests and checks). */
export const settledOrganize = async (seriesId: string) => {
  while (organizing.has(seriesId)) await organizing.get(seriesId)
}

/** The drawn cards no episode holds, not left out and not held back; a
 * card whose note answered an open gap says which. */
const freshOf = async (series: Series, mapId: string) => {
  const map = await loadProject(mapId)
  if (!map) return []
  const used = new Set<string>([...(series.left || []), ...(series.held || [])])
  for (const item of series.episodes) {
    const notebook = await loadProject(item.notebookId)
    for (const page of notebook ? pagesOf(notebook) : []) used.add(page)
  }
  const open = new Set(
    (series.gaps || []).filter((g) => g.state === 'open').map((g) => g.id)
  )
  const fills = new Map<string, string>()
  for (const note of map.project.notes || [])
    for (const result of note.results || [])
      if (result.fills && open.has(result.fills))
        fills.set(result.slideId, result.fills)
  return cardsOf(map)
    .filter((card) => !used.has(card.id))
    .map((card) =>
      fills.has(card.id) ? { ...card, fills: fills.get(card.id)! } : card
    )
}

/** Places the map's new cards into its series, when it organises itself. */
export const organizeNewPages = async (mapId: string) => {
  const map = await loadProject(mapId)
  const seriesId = map?.project.mapSeries
  if (!map || !seriesId || map.status !== 'ready') return
  const series = await loadSeries(seriesId)
  if (
    !series ||
    !organizes(series) ||
    !series.episodes.length ||
    series.planning?.state === 'planning' ||
    isPlanning(seriesId) ||
    organizing.has(seriesId)
  )
    return
  const fresh = await freshOf(series, mapId)
  if (!fresh.length) return
  await changeSeries(seriesId, (current) => {
    current.organizing = { state: 'organizing', at: new Date().toISOString() }
  })
  const job = place(seriesId, mapId, fresh)
    .catch((error: Error) =>
      changeSeries(seriesId, (current) => {
        current.organizing = {
          state: 'failed',
          error: error.message || 'The new cards could not be organised',
          at: new Date().toISOString()
        }
      }).then(() => undefined)
    )
    .finally(() => organizing.delete(seriesId))
  organizing.set(seriesId, job)
}

const place = async (
  seriesId: string,
  mapId: string,
  fresh: ReturnType<typeof cardsOf>
) => {
  const series = (await loadSeries(seriesId))!
  const map = (await loadProject(mapId))!
  const existing = await existingOf(series)
  const directions = (await directionLines(series, map, existing)).map(
    (line) => {
      const answer = series.directions?.find((d) => d.id === line.id)?.answer
      return answer
        ? { ...line, answer: { state: answer.state, why: answer.why } }
        : line
    }
  )
  const open = (series.gaps || []).filter((gap) => gap.state === 'open')
  const number = (notebook?: string) =>
    existing.find((item) => item.notebook === notebook)?.number
  const brief = {
    title: series.title,
    outcome: series.outcome || null,
    audience: series.audience || null,
    lines: series.lines || [],
    length: series.length || null,
    directions,
    gaps: open.map((gap) => ({
      id: gap.id,
      missing: gap.missing,
      ...(number(gap.episode) ? { episode: number(gap.episode) } : {}),
      why: gap.why
    }))
  }
  const cards = new Map(cardsOf(map).map((card) => [card.id, card]))
  const episodes = existing.map((item) => {
    const outline = series.episodes.find(
      (e) => e.notebookId === item.notebook
    )?.outline
    return {
      number: item.number,
      episode: item.notebook,
      title: item.title,
      made: item.made,
      ...(outline ? { win: outline.win, teaches: outline.teaches } : {}),
      pages: item.pages.map((id) => ({
        id,
        title: cards.get(id)?.title || ''
      })),
      seconds: item.pages.reduce(
        (sum, id) => sum + (cards.get(id)?.seconds || 0),
        0
      )
    }
  })
  const plan = await runValidatedJsonStage<Placement>({
    projectId: mapId,
    inputKey: fingerprintOf({ brief, episodes, fresh }),
    checkpoint: 'series-place',
    stage: 'storyboard',
    route: 'Place Pages',
    stageContext: { series: seriesId },
    file: 'plan/place.json',
    tool: 'storyboard_submit_placement',
    operation: 'revise-story',
    skillFiles: ['SKILL.md', 'workflows/place-pages.md'],
    packet: {
      'packet/SERIES.json': JSON.stringify(brief, null, 1),
      'packet/EPISODES.json': JSON.stringify(episodes, null, 1),
      'packet/NEW.json': JSON.stringify(fresh, null, 1)
    },
    selection: map.project.harness ?? (await detectedHarness()),
    origin: origin(),
    validate: (raw) =>
      validatePlacement(raw, {
        fresh: fresh.map((card) => card.id),
        episodes: existing,
        gaps: open.map((gap) => gap.id),
        lines: (series.lines || []).map((line) => line.id),
        directions: directions.map((line) => line.id),
        ...(series.length ? { length: series.length } : {}),
        seconds: Object.fromEntries(
          [...cards.values()].map((card) => [card.id, card.seconds])
        )
      })
  })
  await applyPlacement(seriesId, mapId, plan, fresh)
}

/** Puts the placement into the episodes and records it for Undo. */
export const applyPlacement = async (
  seriesId: string,
  mapId: string,
  plan: Placement,
  fresh: Array<{ id: string; title: string }>
) => {
  const map = (await loadProject(mapId))!
  const title = (page: string) =>
    fresh.find((card) => card.id === page)?.title || 'a card'
  const run: OrganizeRun = {
    id: randomUUID(),
    at: new Date().toISOString(),
    moves: [],
    started: []
  }
  // Into open episodes: each new card after the card it follows.
  const into = new Map<string, string[]>()
  for (const move of plan.moves.filter((m) => m.into)) {
    const notebook = move.into!
    if (!into.has(notebook)) {
      const snapshot = await loadProject(notebook)
      into.set(notebook, snapshot ? pagesOf(snapshot) : [])
    }
    const order = into.get(notebook)!
    const at = move.after ? order.indexOf(move.after) + 1 : 0
    order.splice(at < 0 ? order.length : at, 0, move.page)
  }
  for (const [notebook, order] of into) {
    await setEpisodePages(notebook, map, order)
    await scheduleAround(notebook)
  }
  // New episodes, each put after the episode it follows, carrying what the
  // placement said it picks up and hands on, as a planned one does.
  const startedAt = new Map<string, string>()
  const before = plan.start.length ? await loadSeries(seriesId) : null
  const lineName = new Map(
    (before?.lines || []).map((line) => [line.id, line.name])
  )
  for (const item of plan.start) {
    const pages = plan.moves
      .filter((m) => m.start === item.key)
      .map((m) => m.page)
    const made = await addMapEpisode(seriesId, {
      title: item.title,
      slides: pages
    })
    await changeProject(made.notebook.project.id, (current) => {
      const ref = current.project.episode
      if (!ref) return
      ref.part = { title: item.title, carries: item.carries }
      ref.threads = item.lines
        .map((id) => lineName.get(id) || '')
        .filter(Boolean)
      if (before?.length) ref.length = before.length
    })
    startedAt.set(item.key, made.notebook.project.id)
    run.started.push(made.notebook.project.id)
  }
  if (plan.start.length) {
    const series = (await loadSeries(seriesId))!
    const order = series.episodes
      .map((e) => e.notebookId)
      .filter((id) => !run.started.includes(id))
    for (const item of plan.start) {
      const id = startedAt.get(item.key)!
      const after = item.after ? order.indexOf(item.after) + 1 : 0
      order.splice(after, 0, id)
    }
    await setSeriesOrder(seriesId, order)
    for (const id of run.started) await scheduleAround(id)
  }
  for (const move of plan.moves) {
    const episode =
      move.into || (move.start ? startedAt.get(move.start) : undefined)
    const snapshot = episode ? await loadProject(episode) : null
    const copy = snapshot?.project.slides.find(
      (s) => s.copyOf?.slide === move.page
    )
    run.moves.push({
      page: move.page,
      title: title(move.page),
      kind: move.left
        ? 'left'
        : move.closes
          ? 'closes'
          : move.start
            ? 'new'
            : 'into',
      ...(episode ? { episode } : {}),
      ...(copy ? { copy: copy.id } : {}),
      why: move.why
    })
  }
  await changeSeries(seriesId, (current) => {
    for (const item of plan.start) {
      const entry = current.episodes.find(
        (e) => e.notebookId === startedAt.get(item.key)
      )
      if (entry)
        entry.outline = {
          win: item.win,
          teaches: item.teaches,
          needs: [],
          lines: item.lines
        }
    }
    for (const move of plan.moves) {
      const gap = move.closes
        ? current.gaps?.find((g) => g.id === move.closes)
        : undefined
      if (gap) {
        gap.state = 'closed'
        gap.closedBy = move.page
      }
      if (move.left && !(current.left || []).includes(move.page))
        current.left = [...(current.left || []), move.page]
    }
    const at = new Date().toISOString()
    for (const answer of plan.answers || []) {
      const direction = current.directions?.find((d) => d.id === answer.id)
      if (!direction) continue
      run.answered = [
        ...(run.answered || []),
        {
          id: direction.id,
          ...(direction.answer ? { before: direction.answer } : {})
        }
      ]
      direction.answer = { state: answer.state, why: answer.why, at }
    }
    current.organized = [...(current.organized || []), run].slice(-5)
    delete current.organizing
  })
  await changeProject(mapId, (current) =>
    addEvent(current, 'slide', `Organised ${summary(run, title)}`)
  )
  return run
}

const summary = (run: OrganizeRun, title: (page: string) => string) =>
  run.moves
    .map((move) =>
      move.kind === 'left'
        ? `“${title(move.page)}” left out`
        : move.kind === 'new'
          ? `“${title(move.page)}” as a new episode`
          : `“${title(move.page)}” into an episode${move.kind === 'closes' ? ' (fills a gap)' : ''}`
    )
    .join('; ')

/** Takes out what an organising run added; its cards wait, unplaced. */
export const undoOrganize = async (seriesId: string, raw: unknown) => {
  const id = String((raw as { run?: unknown })?.run || '')
  const series = await loadSeries(seriesId)
  const run = series?.organized?.find((item) => item.id === id)
  if (!series || !run) throw new Refusal('That organising run is gone')
  if (run.undone) return series
  for (const move of run.moves) {
    if (!move.copy || !move.episode || run.started.includes(move.episode))
      continue
    const snapshot = await loadProject(move.episode)
    if (!snapshot || isMade(snapshot)) continue
    if (snapshot.project.slides.some((s) => s.id === move.copy))
      await changeCopies(move.episode, { action: 'remove', slide: move.copy })
  }
  for (const notebook of run.started) {
    const snapshot = await loadProject(notebook)
    if (snapshot && !isMade(snapshot)) await discardEpisode(seriesId, notebook)
  }
  const after = await changeSeries(seriesId, (current) => {
    const pages = run.moves.map((move) => move.page)
    for (const gap of current.gaps || [])
      if (
        gap.state === 'closed' &&
        gap.closedBy &&
        pages.includes(gap.closedBy)
      ) {
        gap.state = 'open'
        delete gap.closedBy
      }
    current.left = (current.left || []).filter(
      (page) => !run.moves.some((m) => m.kind === 'left' && m.page === page)
    )
    current.held = [...new Set([...(current.held || []), ...pages])]
    // The answers the run gave go back to what they were.
    for (const item of run.answered || []) {
      const direction = current.directions?.find((d) => d.id === item.id)
      if (!direction) continue
      if (item.before) direction.answer = item.before
      else delete direction.answer
    }
    const saved = current.organized?.find((item) => item.id === id)
    if (saved) saved.undone = true
  })
  await setSeriesOrder(
    seriesId,
    after.episodes.map((e) => e.notebookId)
  )
  return after
}

/** An episode an organising run started and nobody touched: out of the
 * series, and gone. */
const discardEpisode = async (seriesId: string, notebook: string) => {
  await changeSeries(seriesId, (series) => {
    series.episodes = series.episodes.filter((e) => e.notebookId !== notebook)
  })
  // Its segues may be being written: a late write would bring it back.
  await settledSegues(notebook)
  for (const kind of ['projects', 'outlines', 'sources', 'source-briefs'])
    await deleteRow(kind, notebook).catch(() => {})
}
