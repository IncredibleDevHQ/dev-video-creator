// An episode's own lines: a cold open or "last time", a turn into each page
// from the one before, and "next time" after the last. They belong to the
// episode, never to the map, and are written again when its pages change.
import type { Slide } from '../shared/model'
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { reconcileVideo } from './scene-model'
import { loadSeries } from './series'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

/** The episode's script for a copy: its line in, the map's script, its line out. */
export const composeNarration = (slide: Slide) =>
  [slide.bridge, slide.base, slide.outro].filter(Boolean).join(' ')

export type Segues = {
  pages: Array<{ id: string; bridge: string }>
  outro: string
}

/** One line into each page, in the episode's order, and one out of the last. */
export const validateSegues = (raw: unknown, ids: string[]) => {
  const value = (raw ?? {}) as { pages?: unknown; outro?: unknown }
  const problems: string[] = []
  const list = Array.isArray(value.pages) ? value.pages : []
  const pages = list.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return { id: String(item.id ?? ''), bridge: words(item.bridge, 320) }
  })
  if (pages.map((page) => page.id).join() !== ids.join())
    problems.push(
      'Write one bridge for each page, in the episode’s order, by id'
    )
  if (pages.some((page) => !page.bridge))
    problems.push('Give every page a bridge')
  const outro = words(value.outro, 320)
  if (!outro) problems.push('Write the outro said after the last page')
  return {
    ok: !problems.length,
    problems,
    warnings: [],
    value: { pages, outro }
  }
}

const writing = new Map<string, Promise<void>>()
const again = new Set<string>()
/** Writes the episode's segues in the background; a later change runs again. */
export const scheduleSegues = (id: string) => {
  if (writing.has(id)) {
    again.add(id)
    return
  }
  const job = writeSegues(id).finally(() => {
    writing.delete(id)
    if (again.delete(id)) scheduleSegues(id)
  })
  writing.set(id, job)
  void job.catch(() => {})
}
/** Resolves when no episode's segues are being written (tests and checks). */
export const settledAllSegues = async () => {
  while (writing.size) await Promise.all([...writing.values()])
}
/** Resolves when the episode's segues are written (tests and checks). */
export const settledSegues = async (id: string) => {
  while (writing.has(id)) await writing.get(id)!.catch(() => {})
}

const writeSegues = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot?.project.copyOfMap) return
  const slides = snapshot.project.slides
  if (!slides.length) {
    if (snapshot.project.segues)
      await changeProject(id, (current) => {
        delete current.project.segues
      })
    return
  }
  const series = snapshot.project.episode
    ? await loadSeries(snapshot.project.episode.series)
    : null
  const order = series?.episodes || []
  const at = order.findIndex((item) => item.notebookId === id)
  const before = at > 0 ? await loadProject(order[at - 1].notebookId) : null
  const after =
    at >= 0 && at < order.length - 1
      ? await loadProject(order[at + 1].notebookId)
      : null
  const pages = slides.map((slide) => ({
    id: slide.id,
    title: slide.title,
    idea: slide.idea || '',
    script: slide.base ?? slide.narration ?? ''
  }))
  const brief = {
    series: series?.title || null,
    episode: { number: at + 1 || 1, title: snapshot.project.title },
    previous: before
      ? {
          title: before.project.title,
          pages: before.project.slides.map((slide) => slide.title)
        }
      : null,
    next: after ? { title: after.project.title } : null,
    pages
  }
  await changeProject(id, (current) => {
    current.project.segues = { state: 'writing' }
  })
  try {
    const ids = pages.map((page) => page.id)
    const segues = await runValidatedJsonStage<Segues>({
      projectId: id,
      inputKey: fingerprintOf(brief),
      checkpoint: 'episode-segues',
      operation: 'revise-story',
      stage: 'story',
      route: 'Write Segues',
      stageContext: { episode: brief.episode },
      file: 'story/segues.json',
      tool: 'story_submit_segues',
      packet: { 'packet/EPISODE.json': JSON.stringify(brief, null, 1) },
      selection: snapshot.project.harness ?? (await detectedHarness()),
      origin: origin(),
      validate: (raw) => validateSegues(raw, ids)
    })
    await changeProject(id, (current) => {
      const now = current.project.slides
      // Pages changed meanwhile: the run that follows writes them.
      if (now.map((slide) => slide.id).join() !== ids.join()) return
      now.forEach((slide, index) => {
        // A script the creator wrote is theirs: it keeps no segue.
        if (slide.base === undefined) return
        slide.bridge = segues.pages[index].bridge
        if (index === now.length - 1) slide.outro = segues.outro
        else delete slide.outro
        slide.narration = composeNarration(slide)
      })
      delete current.project.segues
      reconcileVideo(current.project, current, new Set())
      addEvent(current, 'slide', 'Wrote the segues between the pages')
    })
  } catch (error) {
    await changeProject(id, (current) => {
      current.project.segues = {
        state: 'failed',
        error:
          error instanceof Error && error.message
            ? error.message
            : 'The agent could not write the segues'
      }
    }).catch(() => {})
  }
}
