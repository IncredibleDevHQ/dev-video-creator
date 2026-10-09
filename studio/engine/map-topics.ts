// The map grouped by topic: the agent names a few topics and puts each page
// in one. Pages added later join a topic when the note's sorting finds one;
// the rest wait, ungrouped, until the creator asks to group the map again.
import { addEvent } from './activity'
import { runValidatedJsonStage } from './creative/stage'
import { detectedHarness } from './notebook-intake'
import { fingerprintOf } from './planning/fingerprint'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'

const origin = () =>
  process.env.MINIMAL_STUDIO_HARNESS_ORIGIN ||
  `http://127.0.0.1:${process.env.MINIMAL_STUDIO_PORT || 4320}`
const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

export type Topics = { topics: Array<{ name: string; pages: string[] }> }

/** Two to seven named topics; every page in exactly one. */
export const validateTopics = (raw: unknown, ids: string[]) => {
  const value = (raw ?? {}) as { topics?: unknown }
  const problems: string[] = []
  const list = Array.isArray(value.topics) ? value.topics : []
  const topics = list.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      name: words(item.name, 48),
      pages: Array.isArray(item.pages) ? item.pages.map(String) : []
    }
  })
  if (topics.length < 2 || topics.length > 7)
    problems.push('Group the pages into two to seven topics')
  if (topics.some((topic) => !topic.name || !topic.pages.length))
    problems.push('Give every topic a name and its pages')
  const names = topics.map((topic) => topic.name.toLowerCase())
  if (new Set(names).size !== names.length)
    problems.push('Give each topic its own name')
  const placed = topics.flatMap((topic) => topic.pages)
  if (placed.length !== ids.length || new Set(placed).size !== placed.length)
    problems.push('Put every page in exactly one topic')
  for (const id of placed)
    if (!ids.includes(id)) problems.push(`${id} is not a page of the map`)
  return { ok: !problems.length, problems, warnings: [], value: { topics } }
}

/** Groups the map's pages by topic, in the background. */
export const groupTopics = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot) throw new Refusal('Notebook not found')
  if (snapshot.status !== 'ready' || snapshot.project.slides.length < 3)
    throw new Refusal('Group the map once it has a few drawn pages')
  if (snapshot.project.grouping?.state === 'grouping') return snapshot
  const started = await changeProject(id, (current) => {
    current.project.grouping = { state: 'grouping' }
  })
  const job = group(id).finally(() => grouping.delete(id))
  grouping.set(id, job)
  return started
}

const grouping = new Map<string, Promise<void>>()
/** Resolves when the map's topics are grouped (tests and checks). */
export const settledTopics = async (id: string) => {
  while (grouping.has(id)) await grouping.get(id)
}

const group = async (id: string) => {
  try {
    const snapshot = (await loadProject(id))!
    const pages = snapshot.project.slides.map((slide, index) => ({
      id: slide.id,
      number: index + 1,
      title: slide.title,
      idea: slide.idea || ''
    }))
    const ids = pages.map((page) => page.id)
    const grouped = await runValidatedJsonStage<Topics>({
      projectId: id,
      // Each Group again is the creator asking for new topics: a fresh key,
      // so a saved result never comes back for it (review 6).
      inputKey: fingerprintOf({
        pages,
        before: snapshot.project.topics,
        asked: Date.now()
      }),
      checkpoint: 'map-topics',
      operation: 'revise-story',
      stage: 'story',
      route: 'Group Topics',
      stageContext: { pages: pages.length },
      file: 'story/topics.json',
      tool: 'story_submit_topics',
      packet: {
        'packet/PAGES.json': JSON.stringify(pages, null, 1),
        'packet/TOPICS.json': JSON.stringify(snapshot.project.topics || [])
      },
      selection: snapshot.project.harness ?? (await detectedHarness()),
      origin: origin(),
      validate: (raw) => validateTopics(raw, ids)
    })
    await changeProject(id, (current) => {
      const topicOf = new Map(
        grouped.topics.flatMap((topic) =>
          topic.pages.map((page) => [page, topic.name] as const)
        )
      )
      current.project.topics = grouped.topics.map((topic) => topic.name)
      for (const slide of current.project.slides) {
        const topic = topicOf.get(slide.id)
        if (topic) slide.topic = topic
      }
      delete current.project.grouping
      addEvent(
        current,
        'slide',
        `Grouped the map into ${grouped.topics.length} topics`
      )
    })
  } catch (error) {
    await changeProject(id, (current) => {
      const said =
        error instanceof Error && error.message
          ? error.message
          : 'The agent could not group the map'
      current.project.grouping = { state: 'failed', error: said }
      addEvent(current, 'slide', `Could not group the map by topic: ${said}`, {
        activity: 'failed'
      })
    }).catch(() => {})
  }
}
