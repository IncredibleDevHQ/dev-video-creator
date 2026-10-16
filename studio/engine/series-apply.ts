// Puts a series outline into the episodes. Open episodes get exactly the
// cards the plan gave them, in its order (a card they already hold keeps its
// copy and its lines); new episodes are made; the series' order is set in one
// step, with each episode's "previously" worked out from the one now before
// it. A made episode is the creator's video and is never touched.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { Slide } from '../shared/model'
import type { Series, SeriesGap } from '../shared/series'
import { addEvent } from './activity'
import { addMapEpisode } from './map-episodes'
import { copyOf, pageHash, syncEvidence } from './map-copy'
import {
  composeNarration,
  planScenes,
  scheduleSegues,
  settledSegues
} from './map-segues'
import { deleteRow } from './persistence'
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
export const untouched = (copy: Slide) =>
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
  pages: string[],
  carried: Map<string, Slide> = new Map(),
  stay: Set<string> = new Set()
) => {
  const cards = new Map(
    map.project.slides
      .filter((slide) => slide.svg && !slide.aside)
      .map((slide) => [slide.id, slide])
  )
  let changed = false
  await changeProject(notebook, (current) => {
    if (isMade(current))
      throw new Refusal('An episode’s video started; plan again')
    const slides = current.project.slides
    // A card listed twice is placed once.
    const wanted = [...new Set(pages)]
    const held = new Map<string, Slide>()
    for (const slide of slides) {
      const page = slide.copyOf?.slide
      if (page && cards.has(page) && !held.has(page)) held.set(page, slide)
    }
    // A second copy of a card (the creator duplicated it) stays theirs:
    // beside the card's own when the card stays, else at the end, with
    // their own pages and copies of cards the map no longer shows (review 7).
    const second = (slide: Slide) => {
      const page = slide.copyOf?.slide
      return Boolean(page && cards.has(page) && held.get(page) !== slide)
    }
    const beside = (page: string) =>
      slides.filter((slide) => slide.copyOf?.slide === page && second(slide))
    const extras = slides.filter((slide) => {
      const page = slide.copyOf?.slide
      return (
        !page || !cards.has(page) || (second(slide) && !wanted.includes(page))
      )
    })
    // A copy the creator edited or kept that no other episode takes stays
    // where it is: a plan never throws their work away (review 7).
    const worked = slides.filter(
      (slide) =>
        stay.has(slide.id) &&
        held.get(slide.copyOf?.slide || '') === slide &&
        !wanted.includes(slide.copyOf!.slide)
    )
    // The plan read the map's cards as they are now: an open episode holds
    // them as they are, unless the creator edited or kept a copy.
    let updated = 0
    const next = [
      ...wanted
        .filter((page) => cards.has(page))
        .flatMap((page) => [placed(page), ...alongside(page), ...beside(page)]),
      ...worked,
      ...extras
    ]
    // A copy carried here whose card this episode's own copy now holds, as
    // the creator edited that one meanwhile, stays beside it: neither edit
    // is lost (review 7).
    function alongside(page: string) {
      const edited = carried.get(page)
      const was = held.get(page)
      if (!edited || !was || edited.id === was.id) return []
      if (untouched(was) && !was.copyOf?.kept) return []
      if (slides.some((slide) => slide.id === edited.id)) return []
      return [arrived(edited)]
    }
    function arrived(copy: Slide) {
      const moved = structuredClone(copy)
      delete moved.bridge
      delete moved.outro
      moved.narration = moved.base || moved.narration
      return moved
    }
    function placed(page: string) {
      const was = held.get(page)
      // An edited or kept copy goes with its card, over an untouched copy
      // here too (review 7: the edit was lost when both held the card).
      const edited = carried.get(page)
      const replaces =
        !was || (untouched(was) && !was.copyOf?.kept && edited?.id !== was.id)
      if (edited && replaces) return arrived(edited)
      if (!was) return copyOf(map.project.id, cards.get(page)!)
      const fresh = caughtUp(map.project.id, was, cards.get(page)!)
      if (fresh) updated += 1
      return fresh || was
    }
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
    // A card's answer holds; one a plan only called resolved opens again
    // when a later plan names it (review 7).
    const kept =
      was &&
      (was.state === 'explained' ||
        was.state === 'ignored' ||
        (was.state === 'closed' && Boolean(was.closedBy)))
    return {
      id: gap.id,
      missing: gap.missing,
      ...(gap.episode && order[gap.episode - 1]
        ? { episode: order[gap.episode - 1] }
        : {}),
      why: gap.why,
      ask: gap.ask,
      state: kept ? was.state : 'open',
      ...(kept && was.closedBy ? { closedBy: was.closedBy } : {}),
      ...(kept && was.resolved ? { resolved: was.resolved } : {})
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

/** How to put back the episodes a plan or a placement changed. */
export type PutBack = Map<string, { slides: Slide[]; written: string }>

const slidesOf = async (id: string) =>
  (await loadProject(id))?.project.slides || []

/** Gives an open episode its cards, noting how to put them back. */
export const setPagesNoted = async (
  before: PutBack,
  notebook: string,
  map: Snapshot,
  pages: string[],
  carried?: Map<string, Slide>,
  stay?: Set<string>
) => {
  const slides = await slidesOf(notebook)
  await setEpisodePages(notebook, map, pages, carried, stay)
  const written = JSON.stringify(await slidesOf(notebook))
  before.set(notebook, { slides, written })
}

/** All or nothing: what a stopped run changed goes back as it was, unless
 * the creator changed it since (review 7). A copy the run moved, by its id
 * and the episode it came from, ends in one episode: home, when home holds
 * it or can take it back, else where it went. It goes home first and only
 * then leaves where it went, so it is always in one of them; held in two,
 * the one away gets its own id. Returns the moved copies that stay away. */
export const putBack = async (
  before: PutBack,
  moved: Map<string, string> = new Map()
) => {
  const now = new Map<string, Snapshot | null>()
  for (const notebook of before.keys())
    now.set(notebook, await loadProject(notebook))
  const slidesNow = (notebook: string) =>
    now.get(notebook)?.project.slides || []
  // One the creator changed since, or whose video started, keeps what it
  // holds: a copy moved into it stays there.
  const keeps = [...before.keys()].filter(
    (notebook) =>
      JSON.stringify(slidesNow(notebook)) !== before.get(notebook)!.written ||
      isMade(now.get(notebook) ?? null)
  )
  const stays = new Set(
    keeps.flatMap((notebook) => slidesNow(notebook).map((slide) => slide.id))
  )
  // What putBack wrote, and where each moved copy waits: a copy leaves only
  // an episode still as putBack left it.
  const left = new Map<string, string>()
  const went = new Map<string, string[]>()
  const change = (
    notebook: string,
    as: string,
    next: (slides: Slide[]) => Slide[]
  ) =>
    changeProject(notebook, (current) => {
      if (isMade(current) || JSON.stringify(current.project.slides) !== as)
        return
      current.project.slides = next(current.project.slides)
      reconcileVideo(current.project, current, new Set())
      left.set(notebook, JSON.stringify(current.project.slides))
    }).catch(() => {})
  for (const [notebook, { slides, written }] of before) {
    if (keeps.includes(notebook)) continue
    // A copy moved in stays until it is home again.
    await change(notebook, written, (current) => {
      const waiting = current.filter(
        (s) => moved.has(s.id) && !slides.some((was) => was.id === s.id)
      )
      for (const { id } of waiting)
        went.set(id, [...(went.get(id) || []), notebook])
      return [
        ...slides.filter((s) => !(moved.has(s.id) && stays.has(s.id))),
        ...waiting
      ]
    })
  }
  const away = new Set<string>()
  for (const [id, source] of moved) {
    // Home first, in one write: it holds the copy, or takes it back while
    // its video hasn't started and no episode that keeps it has it.
    const original = before.get(source)?.slides.find((s) => s.id === id)
    let home = false
    await changeProject(source, (current) => {
      home = current.project.slides.some((slide) => slide.id === id)
      if (home || !original || stays.has(id) || isMade(current)) return
      current.project.slides = [...current.project.slides, original]
      reconcileVideo(current.project, current, new Set())
      home = true
      if (left.has(source))
        left.set(source, JSON.stringify(current.project.slides))
    }).catch(() => {})
    if (!home) away.add(id)
    // Then out of where it went.
    for (const notebook of home ? went.get(id) || [] : [])
      if (notebook !== source && left.has(notebook))
        await change(notebook, left.get(notebook)!, (current) =>
          current.filter((slide) => slide.id !== id)
        )
    const holders: string[] = []
    for (const notebook of new Set([source, ...before.keys()]))
      if ((await slidesOf(notebook)).some((slide) => slide.id === id))
        holders.push(notebook)
    // Held twice still: a made episode keeps the id (it can't change); the
    // others get their own.
    const keeper =
      (
        await Promise.all(
          holders.map(async (notebook) => ({
            notebook,
            made: isMade(await loadProject(notebook))
          }))
        )
      ).find((holder) => holder.made)?.notebook || holders[0]
    for (const notebook of holders.filter((h) => h !== keeper))
      await changeProject(notebook, (current) => {
        const slide = current.project.slides.find((s) => s.id === id)
        if (!slide || isMade(current)) return
        slide.id = `${id}-${randomUUID().slice(0, 8)}`
        reconcileVideo(current.project, current, new Set())
      }).catch(() => {})
  }
  return away
}

/** An episode a run started and nobody touched: out of the series, and
 * gone. */
export const discardEpisode = async (seriesId: string, notebook: string) => {
  await changeSeries(seriesId, (series) => {
    series.episodes = series.episodes.filter((e) => e.notebookId !== notebook)
  })
  // Its segues may be being written: a late write would bring it back.
  await settledSegues(notebook)
  for (const kind of ['projects', 'outlines', 'sources', 'source-briefs'])
    await deleteRow(kind, notebook).catch(() => {})
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
  // What each open episode holds, and the copies the creator worked on.
  const worked: Array<{ notebook: string; copy: Slide }> = []
  const holds = new Map<string, Map<string, Slide>>()
  const members = new Set(
    ((await loadSeries(seriesId))?.episodes || []).map((e) => e.notebookId)
  )
  for (const entry of context.existing) {
    const latest = await loadProject(entry.notebook)
    if (!entry.made && isMade(latest))
      throw new Refusal('An episode’s video started; plan again')
    // One taken out of the series while the plan was written is the
    // creator's now: the plan doesn't touch it (review 7).
    if (!members.has(entry.notebook))
      throw new Refusal('An episode left the series meanwhile; plan again')
    if (entry.made || !latest) continue
    const own = new Map<string, Slide>()
    for (const copy of latest.project.slides) {
      // A second copy of a card (a duplicate) stays where it is; only the
      // first goes with its card (review 7).
      if (!copy.copyOf || own.has(copy.copyOf.slide)) continue
      own.set(copy.copyOf.slide, copy)
      if (!untouched(copy) || copy.copyOf.kept)
        worked.push({ notebook: entry.notebook, copy })
    }
    holds.set(entry.notebook, own)
  }
  // Where the plan puts each card: an open episode, or a new one (never a
  // made one, which nothing changes).
  const madeOnes = new Set(
    context.existing.filter((e) => e.made).map((e) => e.notebook)
  )
  const target = new Map<string, string>()
  plan.episodes.forEach((episode, index) => {
    if (episode.episode && madeOnes.has(episode.episode)) return
    for (const page of episode.pages)
      if (!target.has(page)) target.set(page, episode.episode || `new:${index}`)
  })
  // A worked copy goes with its card to the episode that gets it, unless
  // that episode keeps its own worked copy; otherwise it stays (review 7).
  const carried = new Map<string, Slide>()
  const movedFrom = new Map<string, string>()
  const stay = new Set<string>()
  for (const { notebook, copy } of worked) {
    const page = copy.copyOf!.slide
    const to = target.get(page)
    if (to === notebook) continue
    const own = to ? holds.get(to)?.get(page) : undefined
    if (
      to &&
      !carried.has(page) &&
      (!own || (untouched(own) && !own.copyOf?.kept))
    ) {
      carried.set(page, copy)
      movedFrom.set(copy.id, notebook)
    } else stay.add(copy.id)
  }
  const order: string[] = []
  // All or nothing: an episode whose video starts meanwhile stops the plan,
  // and what it changed so far goes back as it was (review 7).
  const before: PutBack = new Map()
  const created: string[] = []
  try {
    for (const episode of plan.episodes) {
      if (episode.episode) {
        const was = context.existing.find((e) => e.notebook === episode.episode)
        if (was && !was.made)
          await setPagesNoted(
            before,
            episode.episode,
            context.map,
            episode.pages,
            carried,
            stay
          )
        order.push(episode.episode)
        continue
      }
      const made = await addMapEpisode(
        seriesId,
        {
          title: episode.title,
          slides: []
        },
        true
      )
      created.push(made.notebook.project.id)
      // Noted as the others are: a copy carried into it goes home from it.
      await setPagesNoted(
        before,
        made.notebook.project.id,
        context.map,
        episode.pages,
        carried,
        stay
      )
      order.push(made.notebook.project.id)
    }
  } catch (error) {
    const away = await putBack(before, movedFrom)
    // A new episode goes, unless it holds an edit that can't go home: it
    // stays with that alone, so the creator's work is never lost.
    for (const notebook of created) {
      const slides = (await loadProject(notebook))?.project.slides || []
      if (slides.some((slide) => away.has(slide.id))) continue
      await discardEpisode(seriesId, notebook).catch(() => {})
    }
    // The neighbours of a discarded episode say their lines again.
    if (created.length)
      for (const item of (await loadSeries(seriesId))?.episodes || [])
        scheduleSegues(item.notebookId)
    throw error
  }
  await setSeriesOrder(seriesId, order)
  await settleCuts(context.map.project.id, order)
  const lineName = new Map(plan.lines.map((line) => [line.id, line.name]))
  const latestSeries = await loadSeries(seriesId)
  for (const [index, notebook] of order.entries()) {
    const episode = plan.episodes[index]
    await changeProject(notebook, (current) => {
      const ref = current.project.episode
      if (!ref || isMade(current)) return
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
      if (latestSeries?.length) ref.length = latestSeries.length
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
    // A new plan supersedes the placement Undo, whose copies may have moved.
    delete current.organized
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
      if (!ref || isMade(current)) return
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
