// The series outline, as the agent plans it and the studio checks it: an
// outcome for the viewer, the lines that run through the series, episodes in
// the order a viewer learns (each needing only what earlier ones taught, or a
// gap it names), the gaps the cards don't cover, an answer to each of the
// creator's directions, and a viewer's check. A made episode keeps its place
// and its pages; open ones are the agent's to arrange.
import { fitOf, withSegues } from '../shared/length'
import type { LengthGoal } from '../shared/storyboard'
import type { ViewerFlag } from '../shared/series'

const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
const list = (value: unknown) => (Array.isArray(value) ? value : [])
const slug = (value: unknown) =>
  words(value, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export type OutlineEpisode = {
  /** The existing episode this is (its notebook); new ones have none. */
  episode?: string
  title: string
  about: string
  win: string
  teaches: string[]
  /** `from` is an earlier episode's number in this plan. */
  needs: Array<{ what: string; from?: number; gap?: string }>
  carries: string
  lines: string[]
  pages: string[]
}
export type OutlinePlan = {
  outcome: string
  audience: string
  lines: Array<{ id: string; name: string; line: string }>
  episodes: OutlineEpisode[]
  gaps: Array<{
    id: string
    missing: string
    episode?: number
    why: string
    ask: string
  }>
  overlaps: Array<{ pages: string[]; note: string }>
  left: Array<{ page: string; why: string }>
  answers: Array<{
    id: string
    state: 'followed' | 'partly' | 'not'
    why: string
  }>
  /** The last plan's open gaps this plan no longer needs, and why. */
  resolved: Array<{ id: string; why: string }>
  flags: Array<{ episode: number; kind: ViewerFlag['kind']; line: string }>
}

export type OutlineRules = {
  /** Every drawn card of the map, with how long it speaks. */
  pages: Array<{ id: string; seconds: number }>
  /** The episodes that exist, in order: made ones keep place and pages. */
  existing: Array<{ notebook: string; made: boolean; pages: string[] }>
  /** The creator's direction ids, each to be answered. */
  directions: string[]
  /** Whether the creator gave the outcome and the audience. */
  given: { outcome: boolean; audience: boolean }
  length?: LengthGoal
  /** The last plan's gaps and what the creator did with each. */
  lastGaps?: Array<{
    id: string
    state: 'open' | 'explained' | 'ignored' | 'closed'
  }>
}

const STATES = ['followed', 'partly', 'not'] as const
const KINDS = ['confusing', 'slow', 'overloaded', 'assumes'] as const

/** Reads the agent's outline and says what to fix. */
export const validateOutline = (raw: unknown, rules: OutlineRules) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const warnings: string[] = []
  const outcome = words(value.outcome, 300)
  const audience = words(value.audience, 200)
  if (!rules.given.outcome && !outcome)
    problems.push(
      'Propose the outcome: what a viewer can do or understand by the end'
    )
  if (!rules.given.audience && !audience)
    problems.push('Propose the audience: who the series is for, in a line')
  const lines = list(value.lines)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      return {
        id: slug(entry.id || entry.name),
        name: words(entry.name, 40),
        line: words(entry.line, 160)
      }
    })
    .filter((line) => line.id && line.name)
  if (lines.length < 1 || lines.length > 4)
    problems.push('Name one to four through-lines, each with an id and a name')
  const lineIds = new Set(lines.map((line) => line.id))
  if (lineIds.size !== lines.length)
    problems.push('Give each through-line its own id')
  const gaps = list(value.gaps)
    .slice(0, 8)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      const at = Number(entry.episode)
      return {
        id: slug(entry.id),
        missing: words(entry.missing, 160),
        ...(Number.isInteger(at) && at > 0 ? { episode: at } : {}),
        why: words(entry.why, 240),
        ask: words(entry.ask, 240)
      }
    })
  const gapIds = new Set(gaps.map((gap) => gap.id))
  gaps.forEach((gap, index) => {
    if (!gap.id || !gap.missing || !gap.why || !gap.ask)
      problems.push(
        `Gap ${index + 1}: give it an id, what is missing, why it matters and the question that would fill it`
      )
  })
  if (gapIds.size !== gaps.length) problems.push('Give each gap its own id')
  const resolved = list(value.resolved)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      return { id: slug(entry.id), why: words(entry.why, 200) }
    })
    .filter((item) => item.id)
  for (const gap of rules.lastGaps || []) {
    // An open gap is kept (same id) or said to be no longer needed; one the
    // creator set aside does not come back.
    const settled = resolved.find((item) => item.id === gap.id)
    if (gap.state === 'open' && !gapIds.has(gap.id) && !settled?.why)
      problems.push(
        `The last plan's gap ${gap.id} is not in this plan: keep it with the same id, or say in resolved why the series no longer needs it`
      )
    if (gap.state === 'ignored' && gapIds.has(gap.id))
      problems.push(`The creator set gap ${gap.id} aside: leave it out of gaps`)
  }
  const episodes: OutlineEpisode[] = list(value.episodes).map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>
    return {
      ...(entry.episode ? { episode: String(entry.episode) } : {}),
      title: words(entry.title, 80),
      about: words(entry.about, 300),
      win: words(entry.win, 200),
      teaches: list(entry.teaches)
        .map((thing) => words(thing, 80))
        .filter(Boolean)
        .slice(0, 4),
      needs: list(entry.needs)
        .map((need) => {
          const into = (need ?? {}) as Record<string, unknown>
          const from = Number(into.from)
          return {
            what: words(into.what, 120),
            ...(Number.isInteger(from) && from > 0 ? { from } : {}),
            ...(into.gap ? { gap: slug(into.gap) } : {})
          }
        })
        .filter((need) => need.what)
        .slice(0, 6),
      carries: words(entry.carries, 300),
      lines: list(entry.lines).map(slug).filter(Boolean),
      pages: list(entry.pages).map(String)
    }
  })
  if (!episodes.length || episodes.length > 12)
    problems.push('Plan one to twelve episodes')
  const drawn = new Set(rules.pages.map((page) => page.id))
  const seconds = new Map(rules.pages.map((page) => [page.id, page.seconds]))
  const existing = new Map(rules.existing.map((item) => [item.notebook, item]))
  const madePages = new Set(
    rules.existing.filter((item) => item.made).flatMap((item) => item.pages)
  )
  const seen = new Map<string, number>()
  const mentioned = new Set<string>()
  episodes.forEach((episode, index) => {
    const label = `Episode ${index + 1}`
    const was = episode.episode ? existing.get(episode.episode) : undefined
    if (episode.episode && !was)
      problems.push(
        `${label}: ${episode.episode} is not an episode of this series`
      )
    if (was) {
      if (mentioned.has(was.notebook))
        problems.push(`${label}: that episode is already in the plan`)
      mentioned.add(was.notebook)
    }
    if (!episode.title || !episode.about || !episode.win || !episode.carries)
      problems.push(
        `${label}: give it a title, its message (about), the viewer's win and what it carries`
      )
    if (!episode.teaches.length)
      problems.push(`${label}: say what it teaches (one to four things)`)
    if (!episode.pages.length)
      problems.push(`${label}: give it at least one card`)
    for (const line of episode.lines)
      if (!lineIds.has(line))
        problems.push(`${label}: ${line} is not one of the through-lines`)
    for (const need of episode.needs) {
      if (need.from !== undefined && need.from >= index + 1)
        problems.push(
          `${label} needs “${need.what}” from episode ${need.from}: an episode can only build on one before it`
        )
      if (need.gap && !gapIds.has(need.gap))
        problems.push(
          `${label} needs “${need.what}” from gap ${need.gap}, which is not in gaps`
        )
      if (need.from === undefined && !need.gap)
        problems.push(
          `${label} needs “${need.what}”: say which earlier episode teaches it (from), or name the gap`
        )
    }
    if (was?.made) {
      // A made episode is the creator's video: same place, same cards.
      if (rules.existing.indexOf(was) !== index)
        problems.push(
          `${label}: “${episode.title}” is made, so it stays episode ${rules.existing.indexOf(was) + 1}`
        )
      if (episode.pages.join() !== was.pages.join())
        problems.push(
          `${label} is made: keep its cards as they are (${was.pages.join(', ')})`
        )
      return
    }
    for (const page of episode.pages) {
      if (!drawn.has(page))
        problems.push(`${label}: ${page} is not a drawn card of the map`)
      else if (madePages.has(page))
        problems.push(`${label}: ${page} is already in a made episode`)
      if (seen.has(page))
        problems.push(
          `${label}: ${page} is already in episode ${seen.get(page)! + 1}`
        )
      seen.set(page, index)
    }
    const goal = rules.length
    // Spoken with its segues: the line into each card, and its close.
    const total = withSegues(
      episode.pages.map((page) => seconds.get(page) || 0)
    )
    if (goal && total) {
      const line = `${label} runs about ${Math.round(total)} s; each episode asks for ${goal.min}–${goal.max} s`
      const fit = fitOf(total, goal)
      if (fit === 'long' && episode.pages.length > 1)
        (goal.strict ? problems : warnings).push(`${line}: split it`)
      else if (fit === 'long')
        warnings.push(`${line}: its one card runs long; flag it overloaded`)
      // Short is a warning; strict refuses only an episode far too thin.
      else if (fit === 'short')
        (goal.strict && total < goal.min * 0.6 ? problems : warnings).push(
          `${line}: merge it`
        )
    }
  })
  for (const item of rules.existing)
    if (!mentioned.has(item.notebook))
      problems.push(
        `Keep every episode that exists in the plan: ${item.notebook} is missing (use its "episode")`
      )
  for (const gap of gaps)
    if (gap.episode !== undefined && gap.episode > episodes.length)
      problems.push(`Gap ${gap.id}: episode ${gap.episode} is not in the plan`)
  const left = list(value.left).map((item) => {
    const entry =
      typeof item === 'string'
        ? { page: item }
        : ((item ?? {}) as Record<string, unknown>)
    return { page: String(entry.page || ''), why: words(entry.why, 200) }
  })
  const leftIds = new Set(left.map((item) => item.page))
  const unplaced = [...drawn].filter(
    (id) => !seen.has(id) && !madePages.has(id) && !leftIds.has(id)
  )
  if (unplaced.length)
    problems.push(
      `Place every card in an episode, or name it in left with why: ${unplaced.join(', ')}`
    )
  const answers = list(value.directions)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      const state = String(entry.state || '') as (typeof STATES)[number]
      return { id: String(entry.id || ''), state, why: words(entry.why, 200) }
    })
    .filter((answer) => rules.directions.includes(answer.id))
  for (const id of rules.directions) {
    const answer = answers.find((item) => item.id === id)
    if (!answer || !STATES.includes(answer.state) || !answer.why)
      problems.push(
        `Answer direction ${id}: followed, partly or not, and why in a line`
      )
  }
  const flags = list(value.flags)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      return {
        episode: Number(entry.episode),
        kind: String(entry.kind || '') as ViewerFlag['kind'],
        line: words(entry.line, 200)
      }
    })
    .filter(
      (flag) =>
        Number.isInteger(flag.episode) &&
        flag.episode >= 1 &&
        flag.episode <= episodes.length &&
        KINDS.includes(flag.kind) &&
        flag.line
    )
    .slice(0, 6)
  const overlaps = list(value.overlaps)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      return {
        pages: list(entry.pages)
          .map(String)
          .filter((id) => drawn.has(id)),
        note: words(entry.note, 200)
      }
    })
    .filter((overlap) => overlap.pages.length > 1 && overlap.note)
    .slice(0, 6)
  return {
    ok: problems.length === 0,
    problems,
    warnings,
    value: {
      outcome,
      audience,
      lines,
      episodes,
      gaps,
      overlaps,
      left: left.filter((item) => drawn.has(item.page)),
      answers,
      resolved: resolved.filter(
        (item) =>
          item.why &&
          !gapIds.has(item.id) &&
          (rules.lastGaps || []).some(
            (gap) => gap.id === item.id && gap.state === 'open'
          )
      ),
      flags
    } satisfies OutlinePlan
  }
}
