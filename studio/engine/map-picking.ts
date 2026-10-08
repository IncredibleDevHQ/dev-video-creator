// "What should this episode be about?" The agent picks the map's pages that
// tell it, in the order a viewer meets them, preferring pages no other
// episode uses. The episode exists at once, empty and saying it is choosing,
// so the creator can keep working on the canvas meanwhile.
import type { Snapshot } from '../shared/api'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { copyOf } from './map-copy'
import { scheduleSegues } from './map-segues'
import { detectedHarness } from './notebook-intake'
import { readRow } from './persistence'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { reconcileVideo } from './scene-model'
import { loadSeries } from './series'

const MOST_PAGES = 12
const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

export type Pick = { title: string; pages: string[] }

/** One to twelve drawn pages of the map, each once, and a short title. */
export const validatePick = (raw: unknown, drawn: string[]) => {
  const value = (raw ?? {}) as { title?: unknown; pages?: unknown }
  const problems: string[] = []
  const pages = Array.isArray(value.pages) ? value.pages.map(String) : []
  const title = words(value.title, 80)
  if (!title) problems.push('Give the episode a short title')
  if (!pages.length || pages.length > MOST_PAGES)
    problems.push(`Choose one to ${MOST_PAGES} pages`)
  if (new Set(pages).size !== pages.length)
    problems.push('Choose each page once')
  for (const page of pages)
    if (!drawn.includes(page))
      problems.push(`${page} is not a drawn page of the map`)
  return {
    ok: !problems.length,
    problems,
    warnings: [],
    value: { title, pages }
  }
}

/** Picks the pages again after the agent could not. */
export const retryPick = async (id: string) => {
  const snapshot = await changeProject(id, (current) => {
    const now = current.project.picking
    if (now?.state !== 'failed') throw new Refusal('Nothing to pick again')
    current.project.picking = {
      state: 'picking',
      about: now.about,
      ...(now.titled ? { titled: true } : {})
    }
  })
  schedulePick(id)
  return snapshot
}

const picking = new Map<string, Promise<void>>()
/** Picks the episode's pages in the background. */
export const schedulePick = (id: string) => {
  if (picking.has(id)) return
  const job = pick(id).finally(() => picking.delete(id))
  picking.set(id, job)
}
/** Resolves when the episode's pages are picked (tests and checks). */
export const settledPick = async (id: string) => {
  while (picking.has(id)) await picking.get(id)
}

const pick = async (id: string) => {
  try {
    const episode = await loadProject(id)
    const about = episode?.project.picking?.about
    if (!episode?.project.copyOfMap || !about) return
    const map = await loadProject(episode.project.copyOfMap)
    if (!map) throw new Error('The map was not found')
    const series = episode.project.episode
      ? await loadSeries(episode.project.episode.series)
      : null
    const others: Snapshot[] = []
    for (const item of series?.episodes || [])
      if (item.notebookId !== id) {
        const other = await readRow<Snapshot>('projects', item.notebookId)
        if (other) others.push(other)
      }
    const usedBy = (page: string) =>
      others
        .filter((other) =>
          other.project.slides.some((s) => s.copyOf?.slide === page)
        )
        .map((other) => other.project.episode?.number ?? 0)
    const pages = map.project.slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide }) => slide.svg && !slide.aside)
      .map(({ slide, index }) => ({
        id: slide.id,
        number: index + 1,
        title: slide.title,
        idea: slide.idea || '',
        ...(slide.topic ? { topic: slide.topic } : {}),
        ...(usedBy(slide.id).length ? { usedBy: usedBy(slide.id) } : {})
      }))
    const episodes = others.map((other) => ({
      number: other.project.episode?.number ?? 0,
      title: other.project.title,
      pages: other.project.slides.map((slide) => slide.title)
    }))
    const chosen = await runValidatedJsonStage<Pick>({
      projectId: id,
      inputKey: fingerprintOf({ about, pages, episodes }),
      checkpoint: 'episode-pick',
      operation: 'revise-story',
      stage: 'story',
      route: 'Plan Episode',
      stageContext: { about },
      file: 'story/episode.json',
      tool: 'story_submit_episode',
      packet: {
        'packet/REQUEST.md': about,
        'packet/PAGES.json': JSON.stringify(pages, null, 1),
        'packet/EPISODES.json': JSON.stringify(episodes, null, 1)
      },
      selection: episode.project.harness ?? (await detectedHarness()),
      origin: origin(),
      validate: (raw) =>
        validatePick(
          raw,
          pages.map((page) => page.id)
        )
    })
    const latest = (await loadProject(map.project.id))!
    await changeProject(id, (current) => {
      const slides = current.project.slides
      // Pages the creator dropped in meanwhile stay first.
      for (const pageId of chosen.pages) {
        const page = latest.project.slides.find((s) => s.id === pageId)
        if (page?.svg && !slides.some((s) => s.copyOf?.slide === pageId))
          slides.push(copyOf(map.project.id, page))
      }
      if (!current.project.picking?.titled) current.project.title = chosen.title
      delete current.project.picking
      reconcileVideo(current.project, current, new Set())
      addEvent(
        current,
        'slide',
        `Picked ${chosen.pages.length} page${chosen.pages.length === 1 ? '' : 's'} from the map`
      )
    })
    scheduleSegues(id)
    const at =
      series?.episodes.findIndex((item) => item.notebookId === id) ?? -1
    if (at > 0) scheduleSegues(series!.episodes[at - 1].notebookId)
  } catch (error) {
    await changeProject(id, (current) => {
      if (!current.project.picking) return
      current.project.picking = {
        ...current.project.picking,
        state: 'failed',
        error:
          error instanceof Error && error.message
            ? error.message
            : 'The agent could not pick the pages'
      }
    }).catch(() => {})
  }
}
