// A series: episodes as notebooks, the repos they share, and what carries
// from one to the next. It grows one episode at a time, or from an arc the
// agent proposes first; the next episode starts from what changed on the
// branch since the last one, and a short "previously".
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import { NARRATIVES, narrativeById } from '../shared/narratives'
import {
  ARC_RANGE,
  nextPart,
  type Series,
  type SeriesPart,
  type SeriesSummary
} from '../shared/series'
import { latest, numberLessons, retentionByBeat } from '../shared/numbers'
import type { RepoLink } from '../shared/repos'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { listRows, readRow, writeRow } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, createProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { branchHead, repoDiff, repoLog, validateRepoLink } from './repo-git'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .trim()
    .slice(0, limit)

export const loadSeries = (id: string) =>
  /^[a-zA-Z0-9_-]+$/.test(id) ? readRow<Series>('series', id) : null

const queues = new Map<string, Promise<unknown>>()
/** One change at a time per series, as notebooks are changed. */
export const changeSeries = (
  id: string,
  update: (series: Series) => void | Promise<void>
) => {
  const next = (queues.get(id) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const series = await loadSeries(id)
      if (!series) throw new Refusal('Series not found')
      await update(series)
      await writeRow('series', id, series)
      return series
    })
  queues.set(id, next)
  return next
}

const reposOf = async (raw: unknown) => {
  if (!Array.isArray(raw) || raw.length > 4)
    throw new Refusal('Link up to four repos')
  const repos: RepoLink[] = []
  for (const item of raw) repos.push(await validateRepoLink(item))
  return repos
}

/** A new series: its title, what it is about, and how it grows. */
export const createSeries = async (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const title = words(value.title, 120)
  const about = words(value.about, 4000)
  if (!title) throw new Refusal('Give the series a title')
  if (!about) throw new Refusal('Say what the series is about')
  const series: Series = {
    id: randomUUID(),
    title,
    about,
    growth: value.growth === 'arc' ? 'arc' : 'one',
    createdAt: new Date().toISOString(),
    episodes: [],
    repos: await reposOf(value.repos ?? []),
    threads: []
  }
  await writeRow('series', series.id, series)
  if (series.growth === 'arc') return planArc(series.id)
  return series
}

/** Title, about, threads and repos, as the creator changes them. */
export const updateSeries = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const repos = value.repos === undefined ? null : await reposOf(value.repos)
  return changeSeries(id, (series) => {
    if (value.title !== undefined)
      series.title = words(value.title, 120) || series.title
    if (value.about !== undefined)
      series.about = words(value.about, 4000) || series.about
    if (Array.isArray(value.threads))
      series.threads = value.threads
        .map((item) => words(item, 200))
        .filter(Boolean)
        .slice(0, 12)
    if (repos) series.repos = repos
  })
}

export const listSeries = async (): Promise<SeriesSummary[]> => {
  const result: SeriesSummary[] = []
  for (const id of await listRows('series')) {
    const series = await loadSeries(id)
    if (series)
      result.push({
        id,
        title: series.title,
        episodes: series.episodes.length,
        planned: series.arc ? series.arc.parts.length : null,
        updatedAt: series.arc?.at || series.createdAt
      })
  }
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** The series with its episodes' titles and states, for its page. */
export const seriesPage = async (id: string) => {
  const series = await loadSeries(id)
  if (!series) throw new Refusal('Series not found')
  const episodes = []
  for (const episode of series.episodes) {
    const notebook = await loadProject(episode.notebookId)
    episodes.push({
      ...episode,
      title: notebook?.project.title || 'Missing notebook',
      status: notebook?.status || 'failed',
      narrative: notebook?.project.narrative ?? null
    })
  }
  return { series, episodes }
}

/** The agent's arc, checked: a range of episodes, a part for each. */
export const validateArc = (raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const problems: string[] = []
  const range = Array.isArray(value.episodes) ? value.episodes : []
  const [min, max] = range.map(Number)
  if (
    range.length !== 2 ||
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 2 ||
    min > max ||
    max > 8
  )
    problems.push('Set episodes to a range such as [3, 5]')
  const parts: SeriesPart[] = []
  for (const item of Array.isArray(value.parts) ? value.parts : []) {
    const part = (item ?? {}) as Record<string, unknown>
    const title = words(part.title, 80)
    const carries = words(part.carries, 400)
    if (!title || !carries) {
      problems.push('Give every part a title and what it carries')
      continue
    }
    const narrative = narrativeById(String(part.narrative ?? ''))
    if (part.narrative && !narrative)
      problems.push(`${part.narrative} is not a template in the catalog`)
    parts.push({
      title,
      carries,
      ...(narrative ? { narrative: narrative.id } : {})
    })
  }
  if (parts.length !== max)
    problems.push('Write one part for each episode up to the most')
  return {
    ok: problems.length === 0,
    problems,
    warnings: [],
    value: { episodes: [min, max] as [number, number], parts }
  }
}

const branchStory = async (
  repos: RepoLink[],
  since?: Record<string, string>
) => {
  const sections: string[] = []
  for (const repo of repos) {
    const from = since?.[repo.path]
    const log = await repoLog(repo, from).catch(() => '')
    const stat = await repoDiff(repo, { stat: true, since: from }).catch(
      () => ''
    )
    sections.push(
      `## ${repo.name}, ${repo.branch}${from ? ` since ${from.slice(0, 7)}` : ` against ${repo.base}`}\n\n${log.trim() || 'No new commits.'}\n\n${stat.trim()}`
    )
  }
  return sections.join('\n\n')
}

/** Asks the agent for the arc, in the background; the page shows it. */
export const planArc = async (id: string) => {
  const series = await changeSeries(id, (current) => {
    current.planning = { state: 'planning', at: new Date().toISOString() }
  })
  const asked = new Date().toISOString()
  void (async () => {
    const brief = {
      title: series.title,
      about: series.about,
      range: ARC_RANGE,
      episodes: (await seriesPage(id)).episodes.map((item) => item.title),
      threads: series.threads
    }
    const branch = await branchStory(series.repos)
    const arc = await runValidatedJsonStage({
      projectId: id,
      // Each plan is its own run: "Plan again" never replays the last arc.
      inputKey: fingerprintOf({ brief, branch, asked }),
      checkpoint: 'series-arc',
      stage: 'story',
      route: 'Plan Arc',
      stageContext: { series: brief },
      file: 'story/arc.json',
      tool: 'story_submit_arc',
      packet: {
        'packet/SERIES.json': JSON.stringify(brief, null, 1),
        'packet/BRANCH.md': branch || 'No repo is linked.',
        'packet/CATALOG.md': NARRATIVES.map(
          (item) => `- ${item.id}: ${item.name}. ${item.line}`
        ).join('\n')
      },
      selection: await detectedHarness(),
      origin: origin(),
      validate: validateArc
    })
    await changeSeries(id, (current) => {
      current.arc = { ...arc, at: new Date().toISOString() }
      current.growth = 'arc'
      delete current.planning
    })
  })().catch((error: Error) =>
    changeSeries(id, (current) => {
      current.planning = {
        state: 'failed',
        error: error.message || 'The agent could not plan the arc',
        at: new Date().toISOString()
      }
    }).catch(() => {})
  )
  return series
}

/** "Previously", from the last episode's title and its pages. */
export const previouslyOf = (last: Snapshot | null) => {
  if (!last) return undefined
  const pages = last.project.slides
    .map((slide) => slide.title)
    .filter(Boolean)
    .slice(0, 4)
  return `Last time, “${last.project.title}”${pages.length ? `: ${pages.join('; ')}` : ''}.`.slice(
    0,
    400
  )
}

/**
 * The next episode, as a notebook: its source the creator's, else what the
 * series is about and what changed on the branch since the last episode.
 */
const adding = new Set<string>()
export const addEpisode = async (id: string, raw: unknown) => {
  // One at a time: a second submit while one is made would number two
  // notebooks as the same episode.
  if (adding.has(id)) throw new Refusal('An episode is being added')
  adding.add(id)
  try {
    return await addOneEpisode(id, raw)
  } finally {
    adding.delete(id)
  }
}

const addOneEpisode = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const series = await loadSeries(id)
  if (!series) throw new Refusal('Series not found')
  const asked = value.part === undefined ? null : Number(value.part)
  const chosen =
    asked !== null && series.arc?.parts[asked]
      ? { index: asked, part: series.arc.parts[asked] }
      : nextPart(series)
  const last = series.episodes.at(-1)
  const lastNotebook = last ? await loadProject(last.notebookId) : null
  const first = series.episodes[0]
    ? await loadProject(series.episodes[0].notebookId)
    : null
  const commits: Record<string, string> = {}
  for (const repo of series.repos)
    commits[repo.path] = await branchHead(repo).catch(() => '')
  const given = words(value.source, 200_000)
  const changed = await branchStory(series.repos, last?.commits)
  const source =
    given ||
    [
      `# ${series.title}: ${chosen ? chosen.part.title : `episode ${series.episodes.length + 1}`}`,
      chosen ? chosen.part.carries : series.about,
      chosen ? `The series: ${series.about}` : '',
      changed ? `# What changed on the branch\n\n${changed}` : ''
    ]
      .filter(Boolean)
      .join('\n\n')
  const created = await createProject(source, undefined, true)
  const number = series.episodes.length + 1
  const previously = previouslyOf(lastNotebook)
  // Where people left last time shapes this one's plan.
  const curve = latest(lastNotebook?.project.release?.numbers, 'youtube')
  const lessons =
    lastNotebook && curve?.retention
      ? numberLessons(retentionByBeat(lastNotebook.project, curve.retention))
      : []
  const notebook = await changeProject(created.project.id, (current) => {
    current.project.episode = {
      series: id,
      number,
      ...(previously ? { previously } : {}),
      ...(series.threads.length ? { threads: series.threads } : {}),
      ...(chosen ? { part: chosen.part } : {}),
      ...(lessons.length ? { lessons } : {})
    }
    if (series.repos.length) current.project.repos = series.repos
    const look = series.branding || first?.project.branding
    if (look) current.project.branding = look
    if (chosen?.part.narrative)
      current.project.narrative = chosen.part.narrative
    addEvent(current, 'slide', `Episode ${number} of ${series.title}`)
  })
  const saved = await changeSeries(id, (current) => {
    current.episodes.push({
      notebookId: notebook.project.id,
      number,
      ...(chosen ? { part: chosen.index } : {}),
      commits
    })
    current.branding ||= first?.project.branding
  })
  return { series: saved, notebook }
}
