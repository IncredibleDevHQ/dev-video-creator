// Puts a series outline into the episodes. Open episodes get exactly the
// cards the plan gave them, in its order (a card they already hold keeps its
// copy and its lines); new episodes are made; the series' order is set in one
// step, with each episode's "previously" worked out from the one now before
// it. A made episode is the creator's video and is never touched.
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import type { Series, SeriesGap } from '../shared/series'
import { addEvent } from './activity'
import { addMapEpisode } from './map-episodes'
import { copyOf, pageHash, syncEvidence } from './map-copy'
import { composeNarration, planScenes, scheduleSegues } from './map-segues'
import { changeProject, loadProject } from './projects'
import { reconcileVideo } from './scene-model'
import { Refusal } from './refusal'
import { changeSeries, loadSeries, previouslyOf } from './series'
import type { OutlinePlan } from './series-outline'

/** An episode whose video has started is made: plans keep it as it is. */
export const isMade = (snapshot: Snapshot | null) => {
  const video = snapshot?.project.video
  return Boolean(
    video &&
    (video.produced ||
      video.storyboard ||
      video.scenes.some((scene) => scene.phase !== 'idle' || scene.produced))
  )
}

/** The map's cards an episode holds, by their originals, in its order. */
export const pagesOf = (snapshot: Snapshot) =>
  snapshot.project.slides
    .map((slide) => slide.copyOf?.slide || '')
    .filter(Boolean)

/** A copy as it came from the map: nothing in it edited in the episode. */
const untouched = (copy: Slide) =>
  pageHash({ ...copy, narration: copy.base || '' }) === copy.copyOf?.hash

/** The map's card as it is now, for a copy that is behind it and was never
 * edited nor kept on purpose: same id, the lines written around it kept. */
const caughtUp = (mapId: string, copy: Slide, original: Slide) => {
  const now = pageHash(original)
  if (
    now === copy.copyOf?.hash ||
    now === copy.copyOf?.kept ||
    !untouched(copy)
  )
    return null
  const fresh: Slide = {
    ...copyOf(mapId, original),
    id: copy.id,
    ...(copy.bridge ? { bridge: copy.bridge } : {}),
    ...(copy.outro ? { outro: copy.outro } : {})
  }
  fresh.narration = composeNarration(fresh)
  return fresh
}

/**
 * Gives an open episode exactly these cards of the map, in this order. A card
 * it holds keeps its copy (and the lines written around it), brought up to
 * the map's card when it fell behind and was not edited or kept; a card new
 * to it is copied in; its own pages and copies of cards the map no longer
 * shows stay at the end. False when nothing changed.
 */
export const setEpisodePages = async (
  notebook: string,
  map: Snapshot,
  pages: string[]
) => {
  const cards = new Map(
    map.project.slides
      .filter((slide) => slide.svg && !slide.aside)
      .map((slide) => [slide.id, slide])
  )
  let changed = false
  await changeProject(notebook, (current) => {
    const slides = current.project.slides
    const held = new Map<string, Slide>()
    for (const slide of slides) {
      const page = slide.copyOf?.slide
      if (page && cards.has(page) && !held.has(page)) held.set(page, slide)
    }
    const extras = slides.filter(
      (slide) => !slide.copyOf?.slide || !cards.has(slide.copyOf.slide)
    )
    // The plan read the map's cards as they are now: an open episode holds
    // them as they are, unless the creator edited or kept a copy.
    let updated = 0
    const next = [
      ...pages
        .filter((page) => cards.has(page))
        .map((page) => {
          const was = held.get(page)
          if (!was) return copyOf(map.project.id, cards.get(page)!)
          const fresh = caughtUp(map.project.id, was, cards.get(page)!)
          if (fresh) updated += 1
          return fresh || was
        }),
      ...extras
    ]
    if (
      !updated &&
      next.map((slide) => slide.id).join() === slides.map((s) => s.id).join()
    )
      return
    changed = true
    current.project.slides = next
    reconcileVideo(current.project, current, new Set())
    addEvent(
      current,
      'slide',
      `Planned with ${next.length} card${next.length === 1 ? '' : 's'} from the map${updated ? `; ${updated} brought up to date with it` : ''}`
    )
  })
  if (!changed) return false
  await syncEvidence(map.project.id, notebook)
  await planScenes(notebook)
  return true
}

/**
 * Sets the series' episodes in this order (any not named keep theirs, after),
 * numbers them again, and works out each one's "previously" from the episode
 * now before it.
 */
export const setSeriesOrder = async (seriesId: string, order: string[]) => {
  const saved = await changeSeries(seriesId, (series) => {
    const byId = new Map(series.episodes.map((item) => [item.notebookId, item]))
    const next = order
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    for (const item of series.episodes)
      if (!order.includes(item.notebookId)) next.push(item)
    next.forEach((item, index) => {
      item.number = index + 1
    })
    series.episodes = next
  })
  let before: Snapshot | null = null
  for (const item of saved.episodes) {
    before = await changeProject(item.notebookId, (current) => {
      const ref = current.project.episode
      if (!ref) return
      ref.number = item.number
      const line = previouslyOf(before)
      if (line) ref.previously = line
      else delete ref.previously
    })
  }
  return saved
}

/** A card cut into one episode follows its copy; one no episode holds is
 * nobody's again. */
const settleCuts = async (mapId: string, order: string[]) => {
  const holders = new Map<string, string[]>()
  for (const notebook of order) {
    const snapshot = await loadProject(notebook)
    for (const page of snapshot ? pagesOf(snapshot) : [])
      holders.set(page, [...(holders.get(page) || []), notebook])
  }
  await changeProject(mapId, (current) => {
    for (const slide of current.project.slides) {
      if (!slide.onlyIn) continue
      const held = holders.get(slide.id) || []
      if (held.includes(slide.onlyIn)) continue
      if (held.length === 1) slide.onlyIn = held[0]
      else delete slide.onlyIn
    }
  })
}

/** Gaps the creator explained or ignored stay so, named again or not; a
 * closed gap stays closed; an open one the plan no longer needs closes with
 * the plan's reason. */
const mergeGaps = (
  before: SeriesGap[] = [],
  planned: OutlinePlan['gaps'],
  order: string[],
  resolved: OutlinePlan['resolved'] = []
): SeriesGap[] => {
  const same = (gap: SeriesGap, id: string, missing: string) =>
    gap.id === id || gap.missing.toLowerCase() === missing.toLowerCase()
  const fresh = planned.map((gap): SeriesGap => {
    const was = before.find((item) => same(item, gap.id, gap.missing))
    return {
      id: gap.id,
      missing: gap.missing,
      ...(gap.episode && order[gap.episode - 1]
        ? { episode: order[gap.episode - 1] }
        : {}),
      why: gap.why,
      ask: gap.ask,
      state:
        was && (was.state === 'explained' || was.state === 'ignored')
          ? was.state
          : 'open'
    }
  })
  const kept = before
    .filter((gap) => !fresh.some((item) => same(item, gap.id, gap.missing)))
    .flatMap((gap): SeriesGap[] => {
      if (gap.state !== 'open') return [gap]
      const why = resolved.find((item) => item.id === gap.id)?.why
      return why ? [{ ...gap, state: 'closed', resolved: why }] : []
    })
  return [...fresh, ...kept]
}

/** Puts the outline into the series and its episodes. */
export const applyOutline = async (
  seriesId: string,
  plan: OutlinePlan,
  context: {
    map: Snapshot
    series: Series
    existing: Array<{ notebook: string; made: boolean }>
  }
) => {
  const order: string[] = []
  for (const episode of plan.episodes) {
    if (episode.episode) {
      const was = context.existing.find((e) => e.notebook === episode.episode)
      if (was && !was.made)
        await setEpisodePages(episode.episode, context.map, episode.pages)
      order.push(episode.episode)
      continue
    }
    const made = await addMapEpisode(seriesId, {
      title: episode.title,
      slides: episode.pages
    })
    order.push(made.notebook.project.id)
  }
  await setSeriesOrder(seriesId, order)
  await settleCuts(context.map.project.id, order)
  const lineName = new Map(plan.lines.map((line) => [line.id, line.name]))
  const madeOnes = new Set(
    context.existing.filter((e) => e.made).map((e) => e.notebook)
  )
  for (const [index, notebook] of order.entries()) {
    const episode = plan.episodes[index]
    await changeProject(notebook, (current) => {
      const ref = current.project.episode
      if (!ref) return
      // An open episode is called what the plan made it, unless the creator
      // named it; a made one keeps the name its video has.
      const renamed =
        !madeOnes.has(notebook) &&
        !ref.named &&
        current.project.title !== episode.title
      if (renamed) current.project.title = episode.title
      ref.part = { title: episode.title, carries: episode.carries }
      ref.threads = episode.lines
        .map((id) => lineName.get(id) || '')
        .filter(Boolean)
      if (context.series.length) ref.length = context.series.length
      addEvent(
        current,
        'slide',
        renamed
          ? `Planned as episode ${index + 1}, “${episode.title}”: ${episode.win}`
          : `Planned as episode ${index + 1}: ${episode.win}`
      )
    })
  }
  const at = new Date().toISOString()
  await changeSeries(seriesId, (current) => {
    for (const item of current.episodes) {
      const index = order.indexOf(item.notebookId)
      if (index < 0) continue
      const episode = plan.episodes[index]
      item.outline = {
        win: episode.win,
        teaches: episode.teaches,
        needs: episode.needs.map((need) => ({
          what: need.what,
          ...(need.from && order[need.from - 1]
            ? { from: order[need.from - 1] }
            : {}),
          ...(need.gap ? { gap: need.gap } : {})
        })),
        lines: episode.lines
      }
    }
    const suggested = new Set(current.suggested || [])
    if (plan.outcome && (!current.outcome || suggested.has('outcome'))) {
      current.outcome = plan.outcome
      suggested.add('outcome')
    }
    if (plan.audience && (!current.audience || suggested.has('audience'))) {
      current.audience = plan.audience
      suggested.add('audience')
    }
    current.suggested = [...suggested]
    current.lines = plan.lines
    current.gaps = mergeGaps(current.gaps, plan.gaps, order, plan.resolved)
    current.flags = plan.flags
      .filter((flag) => order[flag.episode - 1])
      .map((flag) => ({
        episode: order[flag.episode - 1],
        kind: flag.kind,
        line: flag.line
      }))
    current.left = plan.left.map((item) => item.page)
    // A new plan places every card, the ones held back from organising too.
    delete current.held
    current.through = current.outcome || plan.lines[0]?.line
    current.arc = {
      episodes: [plan.episodes.length, plan.episodes.length],
      parts: plan.episodes.map((episode) => ({
        title: episode.title,
        carries: episode.carries
      })),
      at
    }
    current.growth = 'arc'
    current.threads = plan.lines.map((line) => line.name)
    for (const direction of current.directions || []) {
      const answer = plan.answers.find((item) => item.id === direction.id)
      if (answer)
        direction.answer = { state: answer.state, why: answer.why, at }
    }
    delete current.planning
  })
  // A gap the plan no longer needs is said, not just gone.
  const dropped = plan.resolved
    .map((item) => ({
      ...item,
      missing: context.series.gaps?.find((gap) => gap.id === item.id)?.missing
    }))
    .filter((item) => item.missing)
  if (dropped.length)
    await changeProject(context.map.project.id, (current) => {
      for (const item of dropped)
        addEvent(
          current,
          'slide',
          `The series no longer misses “${item.missing}”: ${item.why}`
        )
    })
  for (const notebook of order) scheduleSegues(notebook)
  return order
}

/** The series' window on every episode whose video hasn't started: each
 * plans its storyboard to it. A made one keeps the length it was made to. */
export const applySeriesLength = async (seriesId: string) => {
  const series = await loadSeries(seriesId)
  if (!series) return
  for (const item of series.episodes) {
    if (isMade(await loadProject(item.notebookId))) continue
    await changeProject(item.notebookId, (current) => {
      const ref = current.project.episode
      if (!ref) return
      if (series.length) ref.length = series.length
      else delete ref.length
    })
  }
}

/** Puts an episode right after another (null: first), as wiring one
 * episode into another does on the canvas. */
export const placeEpisodeAfter = async (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const episode = String(value.episode || '')
  const after = value.after ? String(value.after) : null
  const series = await loadSeriesOrRefuse(seriesId)
  const order = series.episodes.map((item) => item.notebookId)
  if (!order.includes(episode) || (after && !order.includes(after)))
    throw new Refusal('Choose episodes of this series')
  if (episode === after) return series
  const rest = order.filter((id) => id !== episode)
  rest.splice(after ? rest.indexOf(after) + 1 : 0, 0, episode)
  if (rest.join() === order.join()) return series
  const saved = await setSeriesOrder(seriesId, rest)
  for (const item of saved.episodes) scheduleSegues(item.notebookId)
  return saved
}

const loadSeriesOrRefuse = async (seriesId: string) => {
  const series = await loadSeries(seriesId)
  if (!series?.map) throw new Refusal('This series has no content map')
  return series
}
