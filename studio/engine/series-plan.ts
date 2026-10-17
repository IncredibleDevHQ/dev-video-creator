// Plan Series: the series outlined from every drawn card of the map, as a
// course is outlined from its material (storyboard-master/workflows/
// plan-series.md): an outcome for the viewer and who it is for, the lines
// that run through it, episodes ordered so each builds on the last, the gaps
// the cards don't cover, and an answer to each of the creator's directions.
// Made episodes keep their place and cards; open ones are rearranged. New
// cards drawn later are placed by Place Pages (series-organize.ts).
import type { Snapshot } from '../shared/api'
import { DEFAULT_LENGTH, SEGUE, episodesFor } from '../shared/length'
import type { Direction, Series } from '../shared/series'
import { drawnWords } from './card-words'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { fingerprintOf } from './planning/fingerprint'
import { loadProject } from './projects'
import { Refusal } from './refusal'
import { changeSeries, loadSeries } from './series'
import { applyOutline, isMade, pagesOf } from './series-apply'
import { directionsOf, scopeOf } from './series-directions'
import { markCovered } from './series-gaps'
import { validateOutline, type OutlinePlan } from './series-outline'
import { pageScript } from './storyboard/plan'
import { cardSeconds } from './storyboard/plan-check'
import { validLength } from './video'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

const planning = new Map<string, Promise<void>>()

/** Plans the series' episodes in the background; the map shows them. */
export const planSeries = async (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const length =
    value.length === undefined ? undefined : validLength(value.length)
  const series = await changeSeries(seriesId, (current) => {
    if (!current.map) throw new Refusal('This series has no content map')
    if (current.organizing?.state === 'organizing')
      throw new Refusal('Wait until the new cards are organised')
    if (current.planning?.state === 'planning')
      throw new Refusal('The episodes are being planned')
    // The bar's line of ideas is a direction for the whole series.
    if (value.ideas !== undefined) {
      const text = words(value.ideas, 600)
      const others = (current.directions || []).filter((d) => d.id !== 'ideas')
      current.directions = text
        ? [{ id: 'ideas', text, at: new Date().toISOString() }, ...others]
        : others
      delete current.ideas
    }
    if (length) current.length = length
    else if (!current.length) current.length = { ...DEFAULT_LENGTH }
    if (value.organize !== undefined || value.autoplan !== undefined) {
      current.organize = (value.organize ?? value.autoplan) === true
      delete current.autoplan
    }
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
export const isPlanning = (seriesId: string) => planning.has(seriesId)

/** Every drawn card of the map, as the planner reads it: all it says (its
 * idea, its whole script, the evidence under it, the words drawn on it and
 * the creator's answers), not only its title or how its script begins: a
 * gap named from the first 300 characters asked for what the rest said
 * (review 8). */
export const cardsOf = (map: Snapshot) =>
  map.project.slides
    .filter((slide) => slide.svg && !slide.aside)
    .map((slide) => {
      const shows = drawnWords(slide.svg)
        .slice(0, 40)
        .map((line) => words(line, 160))
      return {
        id: slide.id,
        title: slide.title,
        ...(slide.idea ? { idea: slide.idea } : {}),
        script: words(pageScript(slide), 2400),
        ...(slide.evidence?.length
          ? {
              evidence: slide.evidence
                .slice(0, 8)
                .map((line) => words(line, 300))
            }
          : {}),
        ...(shows.length ? { shows } : {}),
        ...(slide.answers?.length
          ? {
              answers: slide.answers
                .slice(0, 6)
                .map((item) => words(`${item.what}: ${item.answer}`, 400))
            }
          : {}),
        ...(slide.topic ? { topic: slide.topic } : {}),
        seconds: cardSeconds(pageScript(slide))
      }
    })

/** The episodes that exist, in order, with whether each is made. */
export const existingOf = async (series: Series) => {
  const found: Array<{
    notebook: string
    number: number
    title: string
    made: boolean
    named?: boolean
    pages: string[]
  }> = []
  for (const episode of series.episodes) {
    const notebook = await loadProject(episode.notebookId)
    if (!notebook) continue
    found.push({
      notebook: episode.notebookId,
      number: episode.number,
      title: notebook.project.title,
      made: isMade(notebook),
      ...(notebook.project.episode?.named ? { named: true } : {}),
      pages: pagesOf(notebook)
    })
  }
  return found
}

/** The creator's directions as the planner reads them: each with what it is
 * about, in words. */
export const directionLines = async (
  series: Series,
  map: Snapshot,
  existing: Array<{ notebook: string; number: number; title: string }>
) =>
  directionsOf(series).map((direction: Direction) => ({
    id: direction.id,
    text: direction.text,
    about: scopeOf(direction, map, existing)
  }))

const runPlan = async (seriesId: string) => {
  const series = (await loadSeries(seriesId))!
  const map = await loadProject(series.map!)
  if (!map) throw new Error('The map was not found')
  const pages = cardsOf(map)
  const total = pages.reduce((sum, page) => sum + page.seconds, 0)
  const existing = await existingOf(series)
  const directions = await directionLines(series, map, existing)
  const number = new Map(existing.map((item) => [item.notebook, item.number]))
  // The last plan's gaps, each with what the creator did with it, so a gap
  // keeps its id, an ignored one stays away, and a dropped one says why.
  const lastGaps = (series.gaps || []).map((gap) => ({
    id: gap.id,
    missing: gap.missing,
    state: gap.state,
    ...(gap.episode && number.get(gap.episode)
      ? { episode: number.get(gap.episode) }
      : {})
  }))
  const suggested = new Set(series.suggested || [])
  const given = {
    outcome: Boolean(series.outcome && !suggested.has('outcome')),
    audience: Boolean(series.audience && !suggested.has('audience'))
  }
  const brief = {
    title: series.title,
    about: series.about,
    outcome: given.outcome ? series.outcome : null,
    audience: given.audience ? series.audience : null,
    // The window, with how long all the cards run and about how many
    // episodes that makes at this length.
    length: series.length
      ? {
          ...series.length,
          seconds: total,
          segue: SEGUE,
          episodes: episodesFor(total, pages.length, series.length)
        }
      : null,
    directions,
    episodes: existing.map(
      ({ notebook, number, title, made, named, pages: used }) => ({
        episode: notebook,
        number,
        title,
        made,
        ...(named ? { named } : {}),
        pages: used
      })
    ),
    // The last outline, so a new plan keeps what still holds.
    last: series.lines?.length
      ? {
          ...(series.outcome ? { outcome: series.outcome } : {}),
          lines: series.lines,
          gaps: lastGaps,
          episodes: series.episodes
            .filter((item) => item.outline)
            .map((item) => ({
              episode: item.notebookId,
              win: item.outline!.win,
              teaches: item.outline!.teaches
            }))
        }
      : null
  }
  const plan = await runValidatedJsonStage<OutlinePlan>({
    projectId: map.project.id,
    inputKey: fingerprintOf({ brief, pages, at: series.planning?.at }),
    checkpoint: 'series-outline',
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
      validateOutline(raw, {
        pages,
        existing,
        directions: directions.map((item) => item.id),
        given,
        length: series.length,
        lastGaps
      })
  })
  // A gap a card already says is marked with that card, for the creator to
  // close with it; it stays open until they do.
  const episodeOf = new Map(
    plan.episodes.flatMap((episode, index) =>
      episode.pages.map((page) => [page, index + 1] as const)
    )
  )
  await applyOutline(
    seriesId,
    { ...plan, gaps: markCovered(plan.gaps, pages, episodeOf) },
    { map, series, existing }
  )
}

/** New cards drawn later: placed into the episodes by Place Pages, when the
 * series organises itself (the default) and has episodes to place them in. */
export const planNewPages = async (mapId: string) => {
  const { organizeNewPages } = await import('./series-organize')
  await organizeNewPages(mapId)
}
