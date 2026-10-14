// Plan Series: the map's drawn pages grouped into the series' episodes by
// the agent (storyboard-master/workflows/plan-series.md), following the
// creator's own episode ideas when they gave some, else organising them
// itself; one arc and its threads; each episode within the series' length.
// Kept episodes stay, and a later page is placed where it belongs; with
// "keep planning" on, pages drawn later are planned in as they land.
import type { LengthGoal } from '../shared/storyboard'
import type { Series } from '../shared/series'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { addMapEpisode, changeCopies } from './map-episodes'
import { detectedHarness } from './notebook-intake'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { changeSeries, loadSeries } from './series'
import { pageScript } from './storyboard/plan'
import { spokenSeconds } from './storyboard/plan-check'
import { validLength } from './video'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

export type PlannedEpisode = {
  title: string
  about: string
  carries: string
  pages: string[]
}
export type SeriesPlan = {
  arc: string
  threads: string[]
  episodes: PlannedEpisode[]
  left: string[]
}
type PlanPage = { id: string; seconds: number }
type Kept = { number: number; pages: string[] }

/** The plan, checked: kept episodes first with their pages, every drawn
 * page once, each episode within the length. */
export const validateSeriesPlan = (
  raw: unknown,
  rules: { pages: PlanPage[]; kept: Kept[]; length?: LengthGoal }
) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const warnings: string[] = []
  const arc = words(value.arc, 300)
  if (!arc)
    problems.push('Write the arc: the series’ through-line in one sentence')
  const threads = (Array.isArray(value.threads) ? value.threads : [])
    .map((thread) => words(thread, 120))
    .filter(Boolean)
    .slice(0, 8)
  const ids = rules.pages.map((page) => page.id)
  const seconds = new Map(rules.pages.map((page) => [page.id, page.seconds]))
  const episodes: PlannedEpisode[] = (
    Array.isArray(value.episodes) ? value.episodes : []
  ).map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>
    return {
      title: words(entry.title, 80),
      about: words(entry.about, 300),
      carries: words(entry.carries, 300),
      pages: (Array.isArray(entry.pages) ? entry.pages : []).map(String)
    }
  })
  const left = (Array.isArray(value.left) ? value.left : []).map(String)
  if (!episodes.length || episodes.length > 12)
    problems.push('Plan one to twelve episodes')
  const seen = new Map<string, number>()
  episodes.forEach((episode, index) => {
    const label = `Episode ${index + 1}`
    if (!episode.title || !episode.about || !episode.carries)
      problems.push(
        `${label}: give it a title, what it is about and what it carries`
      )
    if (!episode.pages.length)
      problems.push(`${label}: give it at least one page`)
    for (const page of episode.pages) {
      if (!ids.includes(page))
        problems.push(`${label}: ${page} is not a drawn page of the map`)
      if (seen.has(page))
        problems.push(
          `${label}: ${page} is already in episode ${seen.get(page)! + 1}`
        )
      seen.set(page, index)
    }
    const kept = rules.kept[index]
    if (kept) {
      const missing = kept.pages.filter((page) => !episode.pages.includes(page))
      if (
        missing.length ||
        episode.pages.slice(0, kept.pages.length).join() !== kept.pages.join()
      )
        problems.push(
          `${label} exists: keep its pages first, in order (${kept.pages.join(', ')})`
        )
    }
    const goal = rules.length
    const total = episode.pages.reduce(
      (sum, page) => sum + (seconds.get(page) || 0),
      0
    )
    if (goal && total) {
      const line = `${label} runs about ${Math.round(total)} s; each episode asks for ${goal.min}–${goal.max} s`
      if (total > goal.max * 1.05 && episode.pages.length > 1)
        (goal.strict ? problems : warnings).push(`${line}: split it`)
      else if (total < goal.min * 0.6 && !kept)
        (goal.strict ? problems : warnings).push(`${line}: merge it`)
    }
  })
  if (episodes.length < rules.kept.length)
    problems.push(
      `Keep the ${rules.kept.length} episodes that exist, first and in order`
    )
  const unplaced = ids.filter((id) => !seen.has(id) && !left.includes(id))
  if (unplaced.length)
    problems.push(
      `Place every page in an episode, or name it in left: ${unplaced.join(', ')}`
    )
  return {
    ok: problems.length === 0,
    problems,
    warnings,
    value: {
      arc,
      threads,
      episodes,
      left: left.filter((id) => ids.includes(id))
    }
  }
}

const planning = new Map<string, Promise<void>>()

/** Plans the series' episodes in the background; the map shows them. */
export const planSeries = async (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const length =
    value.length === undefined ? undefined : validLength(value.length)
  const series = await changeSeries(seriesId, (current) => {
    if (!current.map) throw new Refusal('This series has no content map')
    if (current.planning?.state === 'planning')
      throw new Refusal('The episodes are being planned')
    if (value.ideas !== undefined)
      current.ideas = words(value.ideas, 4000) || undefined
    if (length) current.length = length
    if (value.autoplan !== undefined) current.autoplan = value.autoplan === true
    current.planning = { state: 'planning', at: new Date().toISOString() }
  })
  const job = runPlan(seriesId)
    .catch((error: Error) =>
      changeSeries(seriesId, (current) => {
        current.planning = {
          state: 'failed',
          error: error.message || 'The agent could not plan the episodes',
          at: new Date().toISOString()
        }
      }).then(() => undefined)
    )
    .finally(() => planning.delete(seriesId))
  planning.set(seriesId, job)
  return series
}

/** Resolves when the series is planned (tests and checks). */
export const settledSeriesPlan = async (seriesId: string) => {
  while (planning.has(seriesId)) await planning.get(seriesId)
}

const runPlan = async (seriesId: string) => {
  const series = (await loadSeries(seriesId))!
  const map = await loadProject(series.map!)
  if (!map) throw new Error('The map was not found')
  const pages = map.project.slides
    .filter((slide) => slide.svg && !slide.aside)
    .map((slide) => ({
      id: slide.id,
      title: slide.title,
      ...(slide.idea ? { idea: slide.idea } : {}),
      ...(slide.topic ? { topic: slide.topic } : {}),
      seconds: Math.round(spokenSeconds(pageScript(slide)) + 1)
    }))
  const kept: Array<Kept & { notebookId: string; title: string }> = []
  for (const episode of series.episodes) {
    const notebook = await loadProject(episode.notebookId)
    if (!notebook) continue
    kept.push({
      number: episode.number,
      notebookId: episode.notebookId,
      title: notebook.project.title,
      pages: notebook.project.slides
        .map((slide) => slide.copyOf?.slide || '')
        .filter(Boolean)
    })
  }
  const brief = {
    title: series.title,
    about: series.about,
    ideas: series.ideas || '',
    length: series.length || null,
    kept: kept.map(({ number, title, pages: used }) => ({
      number,
      title,
      pages: used
    }))
  }
  const plan = await runValidatedJsonStage<SeriesPlan>({
    projectId: map.project.id,
    inputKey: fingerprintOf({ brief, pages, at: series.planning?.at }),
    checkpoint: 'series-plan',
    stage: 'storyboard',
    route: 'Plan Series',
    stageContext: { series: seriesId },
    file: 'plan/series.json',
    tool: 'storyboard_submit_series',
    operation: 'storyboard',
    skillFiles: [
      'SKILL.md',
      'workflows/plan-series.md',
      'hyperframes/skills/hyperframes-creative/references/story-spine.md',
      'hyperframes/skills/faceless-explainer/references/story-design.md'
    ],
    packet: {
      'packet/SERIES.json': JSON.stringify(brief, null, 1),
      'packet/PAGES.json': JSON.stringify(pages, null, 1),
      'packet/SOURCE.md': map.project.source
    },
    selection: map.project.harness ?? (await detectedHarness()),
    origin: origin(),
    validate: (raw) =>
      validateSeriesPlan(raw, { pages, kept, length: series.length })
  })
  await applyPlan(seriesId, plan, kept, series)
}

const applyPlan = async (
  seriesId: string,
  plan: SeriesPlan,
  kept: Array<Kept & { notebookId: string }>,
  series: Series
) => {
  const notebooks: string[] = []
  for (const [index, episode] of plan.episodes.entries()) {
    const existing = kept[index]
    if (existing) {
      for (const page of episode.pages.slice(existing.pages.length))
        await changeCopies(existing.notebookId, { action: 'add', slide: page })
      notebooks.push(existing.notebookId)
    } else {
      const made = await addMapEpisode(seriesId, {
        title: episode.title,
        slides: episode.pages
      })
      notebooks.push(made.notebook.project.id)
    }
  }
  for (const [index, notebookId] of notebooks.entries()) {
    const episode = plan.episodes[index]
    await changeProject(notebookId, (current) => {
      if (!current.project.episode) return
      current.project.episode.part = {
        title: episode.title,
        carries: episode.carries
      }
      current.project.episode.threads = plan.threads
      if (series.length) current.project.episode.length = series.length
      if (!kept[index]) current.project.title = episode.title
      addEvent(
        current,
        'slide',
        `Planned as episode ${index + 1}: ${episode.about}`
      )
    })
  }
  await changeSeries(seriesId, (current) => {
    current.arc = {
      episodes: [plan.episodes.length, plan.episodes.length],
      parts: plan.episodes.map((episode) => ({
        title: episode.title,
        carries: episode.carries
      })),
      at: new Date().toISOString()
    }
    current.growth = 'arc'
    current.threads = plan.threads
    current.through = plan.arc
    current.left = plan.left
    delete current.planning
  })
}

/** With "keep planning" on: pages drawn later and in no episode are planned
 * into the series. */
export const planNewPages = async (mapId: string) => {
  const map = await loadProject(mapId)
  const seriesId = map?.project.mapSeries
  if (!map || !seriesId || map.status !== 'ready') return
  const series = await loadSeries(seriesId)
  if (
    !series?.autoplan ||
    series.planning?.state === 'planning' ||
    planning.has(seriesId)
  )
    return
  const used = new Set<string>(series.left || [])
  for (const episode of series.episodes) {
    const notebook = await loadProject(episode.notebookId)
    for (const slide of notebook?.project.slides || [])
      if (slide.copyOf?.slide) used.add(slide.copyOf.slide)
  }
  if (
    map.project.slides.some(
      (slide) => slide.svg && !slide.aside && !used.has(slide.id)
    )
  )
    await planSeries(seriesId, {})
}
