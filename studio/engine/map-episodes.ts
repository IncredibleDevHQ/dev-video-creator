// Episodes copied from a content map. The map is a notebook whose wireframes
// keep growing; an episode is a notebook of copies of some of them, in its
// own order, ready to become a video. A copy remembers the page it came from
// and that page's version then, so the map can say where each page is used
// and an episode can see when an original changed. The map never changes
// because an episode did.
import { randomUUID } from 'node:crypto'
import type { Snapshot } from '../shared/api'
import type { MapCopy, MapEpisode, MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'
import type { Series } from '../shared/series'
import { addEvent } from './activity'
import { readRow, writeRow } from './persistence'
import { changeProject, loadProject } from './projects'
import { Refusal } from './refusal'
import { reconcileVideo } from './scene-model'
import { changeSeries, loadSeries, previouslyOf } from './series'
import {
  composeNarration,
  planScenes,
  scheduleAround,
  scheduleSegues
} from './map-segues'
import { copyOf, pageHash, syncEvidence } from './map-copy'
import { schedulePick } from './map-picking'
export { copyOf, pageHash, syncEvidence } from './map-copy'

const words = (value: unknown, limit: number) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)

const mapOf = async (id: string) => {
  const map = await loadProject(id)
  if (!map) throw new Refusal('Notebook not found')
  if (map.project.copyOfMap) throw new Refusal('An episode is not a map')
  return map
}

/** The series whose episodes copy this map's pages: the one it has, or a new one. */
export const startMapSeries = async (mapId: string, raw: unknown) => {
  const map = await mapOf(mapId)
  if (map.project.mapSeries) {
    const series = await loadSeries(map.project.mapSeries)
    if (series) return series
  }
  if (map.status !== 'ready' || !map.project.slides.some((s) => s.svg))
    throw new Refusal('Start a series once the wireframes are drawn')
  const value = (raw ?? {}) as Record<string, unknown>
  const series: Series = {
    id: randomUUID(),
    title: words(value.title, 120) || map.project.title,
    about:
      words(value.about, 4000) ||
      `Episodes made from the content map “${map.project.title}”.`,
    growth: 'one',
    createdAt: new Date().toISOString(),
    episodes: [],
    repos: map.project.repos || [],
    threads: [],
    map: mapId,
    ...(map.project.branding ? { branding: map.project.branding } : {})
  }
  await writeRow('series', series.id, series)
  await changeProject(mapId, (current) => {
    current.project.mapSeries = series.id
    addEvent(current, 'slide', `Started the series ${series.title}`)
  })
  return series
}

const adding = new Set<string>()
/**
 * A new episode of the map's series: a notebook of copies of the pages the
 * creator chose, in that order, drawn already and ready to become a video.
 */
export const addMapEpisode = async (seriesId: string, raw: unknown) => {
  if (adding.has(seriesId)) throw new Refusal('An episode is being added')
  adding.add(seriesId)
  try {
    return await addOne(seriesId, raw)
  } finally {
    adding.delete(seriesId)
  }
}

const addOne = async (seriesId: string, raw: unknown) => {
  const series = await loadSeries(seriesId)
  if (!series?.map) throw new Refusal('This series has no content map')
  const map = await mapOf(series.map)
  const value = (raw ?? {}) as Record<string, unknown>
  const ids = Array.isArray(value.slides) ? value.slides.map(String) : []
  const pages = ids
    .map((id) => map.project.slides.find((slide) => slide.id === id))
    .filter((slide): slide is Slide => Boolean(slide))
  if (pages.length !== ids.length) throw new Refusal('Choose pages of the map')
  if (pages.some((page) => !page.svg))
    throw new Refusal('Wait for the new pages to be drawn')
  if (new Set(ids).size !== ids.length)
    throw new Refusal('Copy each page into an episode once')
  const number = series.episodes.length + 1
  // Said what it is about, with no pages: the agent picks them.
  const about = ids.length ? '' : words(value.about, 400)
  const named = words(value.title, 120)
  const title =
    named || words(about, 80) || `${series.title}, episode ${number}`
  const copies = pages.map((page) => copyOf(map.project.id, page))
  const last = series.episodes.at(-1)
  const previously = previouslyOf(
    last ? await loadProject(last.notebookId) : null
  )
  const id = randomUUID()
  const snapshot: Snapshot = {
    project: {
      id,
      title,
      source: map.project.source,
      ...(map.project.sourceUrl ? { sourceUrl: map.project.sourceUrl } : {}),
      ...(map.project.branding ? { branding: map.project.branding } : {}),
      ...(map.project.harness ? { harness: map.project.harness } : {}),
      ...(map.project.narrative ? { narrative: map.project.narrative } : {}),
      ...(map.project.direction ? { direction: map.project.direction } : {}),
      ...(map.project.length ? { length: map.project.length } : {}),
      ...(map.project.repos ? { repos: map.project.repos } : {}),
      copyOfMap: map.project.id,
      episode: {
        series: seriesId,
        number,
        ...(previously ? { previously } : {})
      },
      slides: copies,
      video: null,
      ...(about
        ? {
            picking: {
              state: 'picking' as const,
              about,
              ...(named ? { titled: true } : {})
            }
          }
        : {})
    },
    status: 'ready',
    error: null,
    events: []
  }
  await writeRow('projects', id, snapshot)
  await syncEvidence(map.project.id, id)
  const notebook = await changeProject(id, (current) =>
    addEvent(
      current,
      'slide',
      `Episode ${number} of ${series.title}: ${copies.length} page${copies.length === 1 ? '' : 's'} copied from the map`
    )
  )
  const saved = await changeSeries(seriesId, (current) => {
    current.episodes.push({ notebookId: id, number })
  })
  if (value.only === true) await claimPages(map.project.id, ids, id)
  if (about) schedulePick(id)
  else scheduleSegues(id)
  // The episode before now leads into this one.
  if (last && !about) scheduleSegues(last.notebookId)
  return { series: saved, notebook }
}

/** A cut: the map's pages belong to one episode only. */
const claimPages = (map: string, ids: string[], episode: string) =>
  changeProject(map, (current) => {
    for (const slide of current.project.slides)
      if (ids.includes(slide.id)) slide.onlyIn = episode
  })

const episodeOf = async (id: string) => {
  const snapshot = await loadProject(id)
  if (!snapshot?.project.copyOfMap) throw new Refusal('Choose an episode')
  return snapshot
}

/** The map page a copy shows, without its episode's lines around it. */
const movedCopy = (copy: Slide): Slide => {
  const moved = { ...copy, id: randomUUID() }
  delete moved.bridge
  delete moved.outro
  delete moved.bridgeFor
  delete moved.outroFor
  moved.narration = composeNarration(moved) || copy.narration
  return moved
}
const clearOnly = (
  map: string,
  page: string | undefined,
  from: string,
  to?: string
) =>
  page
    ? changeProject(map, (current) => {
        const original = current.project.slides.find((s) => s.id === page)
        if (original?.onlyIn !== from) return
        if (to) original.onlyIn = to
        else delete original.onlyIn
      })
    : Promise.resolve()
const gone = () => new Refusal('That page is no longer in this episode')

/**
 * Changes an episode's copies: add a copy of a map page (or cut it in, so
 * it is this episode's only), move one within or to another episode,
 * remove one, bring one up to date with its original, or keep it as it is.
 * Each write checks again what it changes, so two quick requests cannot add
 * a page twice or move one that was just removed.
 */
export const changeCopies = async (id: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const action = String(value.action || '')
  const episode = await episodeOf(id)
  const mapId = episode.project.copyOfMap!
  const position = (count: number) =>
    value.index === undefined || value.index === null
      ? count
      : Math.max(0, Math.min(Number(value.index) || 0, count))
  if (action === 'add') {
    const map = await mapOf(mapId)
    const page = map.project.slides.find((s) => s.id === String(value.slide))
    if (!page) throw new Refusal('Choose a page of the map')
    if (!page.svg) throw new Refusal('Wait for this page to be drawn')
    const used = await usersOf(mapId, page.id)
    const cut = value.only === true && !used.some((other) => other !== id)
    await changeProject(id, (current) => {
      const slides = current.project.slides
      if (slides.some((s) => s.copyOf?.slide === page.id))
        throw new Refusal('This episode already has a copy of that page')
      slides.splice(position(slides.length), 0, copyOf(mapId, page))
      reconcileVideo(current.project, current, new Set())
      addEvent(current, 'slide', `Copied “${page.title}” from the map`)
    })
    await syncEvidence(mapId, id)
    await planScenes(id)
    if (cut) await claimPages(mapId, [page.id], id)
    else if (page.onlyIn && page.onlyIn !== id)
      await clearOnly(mapId, page.id, page.onlyIn)
    await scheduleAround(id)
    return { cut, shared: !cut && value.only === true }
  }
  const slideId = String(value.slide || '')
  const copy = episode.project.slides.find((s) => s.id === slideId)
  if (!copy) throw gone()
  if (action === 'move') {
    const to = value.to ? String(value.to) : id
    if (to === id) {
      await changeProject(id, (current) => {
        const slides = current.project.slides
        const from = slides.findIndex((s) => s.id === slideId)
        if (from < 0) throw gone()
        const [moved] = slides.splice(from, 1)
        slides.splice(position(slides.length), 0, moved)
        reconcileVideo(current.project, current, new Set())
      })
      await planScenes(id)
      await scheduleAround(id)
      return { moved: true }
    }
    const target = await episodeOf(to)
    if (target.project.copyOfMap !== mapId)
      throw new Refusal('Move it to an episode of the same map')
    const page = copy.copyOf?.slide
    const moved = movedCopy(copy)
    // Into the other episode first, then out of this one; put back if it
    // had already left this one.
    await changeProject(to, (current) => {
      const slides = current.project.slides
      if (page && slides.some((s) => s.copyOf?.slide === page))
        throw new Refusal('That episode already has a copy of this page')
      slides.splice(position(slides.length), 0, moved)
      reconcileVideo(current.project, current, new Set())
    })
    try {
      await changeProject(id, (current) => {
        if (!current.project.slides.some((s) => s.id === slideId)) throw gone()
        current.project.slides = current.project.slides.filter(
          (s) => s.id !== slideId
        )
        reconcileVideo(current.project, current, new Set())
      })
    } catch (error) {
      await changeProject(to, (current) => {
        current.project.slides = current.project.slides.filter(
          (s) => s.id !== moved.id
        )
        reconcileVideo(current.project, current, new Set())
      })
      throw error
    }
    await clearOnly(mapId, page, id, to)
    await syncEvidence(mapId, to)
    await planScenes(id)
    await planScenes(to)
    await scheduleAround(id)
    await scheduleAround(to)
    return { moved: true }
  }
  if (action === 'remove') {
    await changeProject(id, (current) => {
      if (!current.project.slides.some((s) => s.id === slideId)) throw gone()
      current.project.slides = current.project.slides.filter(
        (s) => s.id !== slideId
      )
      reconcileVideo(current.project, current, new Set())
      addEvent(current, 'slide', `Removed “${copy.title}”; the map keeps it`)
    })
    await clearOnly(mapId, copy.copyOf?.slide, id)
    await planScenes(id)
    await scheduleAround(id)
    return { removed: true }
  }
  if (action === 'update' || action === 'keep') {
    const map = await loadProject(mapId)
    const original = map?.project.slides.find(
      (s) => s.id === copy.copyOf?.slide
    )
    if (!original) throw new Refusal('The map no longer has this page')
    await changeProject(id, (current) => {
      const index = current.project.slides.findIndex((s) => s.id === slideId)
      if (index < 0) throw gone()
      const now = current.project.slides[index]
      if (action === 'keep') {
        now.copyOf = { ...now.copyOf!, kept: pageHash(original) }
        return
      }
      const fresh = copyOf(mapId, original)
      current.project.slides[index] = {
        ...fresh,
        id: now.id,
        ...(now.bridge ? { bridge: now.bridge } : {}),
        ...(now.outro ? { outro: now.outro } : {})
      }
      current.project.slides[index].narration = composeNarration(
        current.project.slides[index]
      )
      reconcileVideo(current.project, current, new Set())
      addEvent(current, 'slide', `Updated “${original.title}” from the map`)
    })
    if (action === 'update') {
      await planScenes(id)
      await scheduleAround(id)
    }
    return { [action === 'keep' ? 'kept' : 'updated']: true }
  }
  throw new Refusal('Choose add, move, remove, update or keep')
}

/**
 * After the creator edits an episode on the Wireframe stage (move, delete,
 * duplicate, add, undo, its script): its segues and its neighbours', and a
 * deleted copy's map page no longer "this episode only".
 */
export const afterEpisodeEdit = async (id: string, snapshot: Snapshot) => {
  const map = snapshot.project.copyOfMap
  if (!map) return
  const removed = snapshot.deletedSlide?.slide.copyOf?.slide
  if (
    removed &&
    !snapshot.project.slides.some((s) => s.copyOf?.slide === removed)
  )
    await clearOnly(map, removed, id)
  await scheduleAround(id)
}

/**
 * Moves an episode up or down the series: the episodes are numbered again,
 * and every episode whose neighbours changed has its segues written again.
 */
export const moveEpisode = async (seriesId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  const notebook = String(value.episode || '')
  const by = value.by === -1 || value.by === 1 ? value.by : 0
  if (!by) throw new Refusal('Move an episode up or down')
  const before = await loadSeries(seriesId)
  if (!before?.map) throw new Refusal('This series has no content map')
  const at = before.episodes.findIndex((item) => item.notebookId === notebook)
  if (at < 0) throw new Refusal('Choose an episode of this series')
  const to = at + by
  if (to < 0 || to >= before.episodes.length) return before
  const saved = await changeSeries(seriesId, (series) => {
    const [moved] = series.episodes.splice(at, 1)
    series.episodes.splice(to, 0, moved)
    series.episodes.forEach((item, index) => {
      item.number = index + 1
    })
  })
  for (const item of saved.episodes)
    await changeProject(item.notebookId, (current) => {
      if (current.project.episode) current.project.episode.number = item.number
    })
  for (const item of saved.episodes) scheduleSegues(item.notebookId)
  return saved
}

/** Sets a map page aside: it is not to be used, so it is not "unused". */
export const setAside = (mapId: string, raw: unknown) => {
  const value = (raw ?? {}) as Record<string, unknown>
  return changeProject(mapId, (current) => {
    const slide = current.project.slides.find((s) => s.id === value.slide)
    if (!slide) throw new Refusal('Choose a page of the map')
    if (value.aside) slide.aside = true
    else delete slide.aside
  })
}

/**
 * The episodes of the map's series, as saved, in series order. The canvas
 * asks every few seconds, so this reads the rows without the notebook's
 * views and token sums.
 */
const episodesOf = async (series: Series | null) => {
  const found: Snapshot[] = []
  for (const item of series?.episodes || []) {
    const notebook = await readRow<Snapshot>('projects', item.notebookId)
    if (notebook) found.push(notebook)
  }
  return found
}

const usersOf = async (map: string, page: string) => {
  const snapshot = await loadProject(map)
  const series = snapshot?.project.mapSeries
    ? await loadSeries(snapshot.project.mapSeries)
    : null
  return (await episodesOf(series))
    .filter((ep) => ep.project.slides.some((s) => s.copyOf?.slide === page))
    .map((ep) => ep.project.id)
}

/** Everything the map's canvas shows: its series, episodes and usage. */
export const mapView = async (mapId: string): Promise<MapView> => {
  const map = await readRow<Snapshot>('projects', mapId)
  if (!map) throw new Refusal('Notebook not found')
  if (map.project.copyOfMap) throw new Refusal('An episode is not a map')
  const series = map.project.mapSeries
    ? await loadSeries(map.project.mapSeries)
    : null
  const pages = new Map(map.project.slides.map((s) => [s.id, s]))
  const usage: Record<string, string[]> = {}
  const episodes: MapEpisode[] = []
  for (const ep of await episodesOf(series)) {
    const scenes = new Map(
      (ep.project.video?.scenes || []).map((scene) => [scene.slideId, scene])
    )
    const copies: MapCopy[] = ep.project.slides.map((slide) => {
      const original = slide.copyOf ? pages.get(slide.copyOf.slide) : undefined
      if (original) (usage[original.id] ||= []).push(ep.project.id)
      const now = original ? pageHash(original) : ''
      const scene = scenes.get(slide.id)
      return {
        id: slide.id,
        title: slide.title,
        ...(original && original.svg === slide.svg ? {} : { svg: slide.svg }),
        ...(slide.copyOf ? { copyOf: slide.copyOf } : {}),
        ...(slide.bridge ? { bridge: slide.bridge } : {}),
        ...(slide.outro ? { outro: slide.outro } : {}),
        stale: Boolean(
          original && now !== slide.copyOf!.hash && now !== slide.copyOf!.kept
        ),
        orphan: Boolean(slide.copyOf && !original),
        ...(scene
          ? { scene: { phase: scene.phase, made: Boolean(scene.produced) } }
          : {})
      }
    })
    const video = ep.project.video
    episodes.push({
      notebook: ep.project.id,
      number: ep.project.episode?.number || episodes.length + 1,
      title: ep.project.title,
      status: ep.status,
      ...(ep.project.segues ? { segues: ep.project.segues.state } : {}),
      ...(ep.project.picking
        ? {
            picking: {
              state: ep.project.picking.state,
              about: ep.project.picking.about
            }
          }
        : {}),
      copies,
      video: video
        ? {
            scenes: video.scenes.filter((s) => s.phase !== 'idle').length,
            made: video.scenes.filter((s) => s.produced).length,
            joined: Boolean(video.produced)
          }
        : null,
      teasers: (ep.project.release?.teasers || []).map((t) => ({
        id: t.id,
        channel: t.channel,
        state: t.state
      })),
      posts: Boolean(ep.project.release?.posts)
    })
  }
  return {
    notebook: mapId,
    title: map.project.title,
    series: series ? { id: series.id, title: series.title } : null,
    episodes,
    usage
  }
}
