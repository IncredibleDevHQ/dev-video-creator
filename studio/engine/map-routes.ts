// The routes for the content map: notes that pile into a notebook's pages,
// topics, the series made from it, and its episodes' copies. Each returns
// null when the path is not its own, so the server falls through.
import type { IncomingMessage } from 'node:http'
import {
  addMapEpisode,
  changeCopies,
  mapView,
  moveEpisode,
  removeEpisode,
  retitleEpisode,
  setAside,
  startMapSeries
} from './map-episodes'
import { addNote, retryNote } from './map-notes'
import { changeComment } from './map-comments'
import { retryPick } from './map-picking'
import { planSeries } from './series-plan'
import { applySeriesLength, placeEpisodeAfter } from './series-apply'
import {
  removeDirection,
  saveDirection,
  setGap,
  updateBrief
} from './series-directions'
import { organizeNewPages, undoOrganize } from './series-organize'
import { loadSeries } from './series'
import { answerSegueCheck, scheduleSegues } from './map-segues'
import { groupTopics } from './map-topics'
import { loadProject } from './projects'
import { Refusal } from './refusal'

type Reply = { status: number; value: unknown } | null
const ok = (value: unknown): Reply => ({ status: 200, value })

const projectRoute =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/(map|notes|topics|map-series|copies|aside|segues|pick|episode-title|comments)$/
const seriesRoute =
  /^\/api\/series\/([a-zA-Z0-9_-]+)\/(map-episodes|episode-order|episode-remove|plan|directions|direction-remove|brief|gap|organize|organize-undo)$/

export const mapRoute = (
  url: URL,
  request: IncomingMessage,
  body: Record<string, unknown>
): Promise<Reply> =>
  route(url, request.method || 'GET', body).catch((error: unknown) => {
    if (error instanceof Refusal)
      return { status: 400, value: { error: error.message } }
    throw error
  })

const route = async (
  url: URL,
  method: string,
  body: Record<string, unknown>
): Promise<Reply> => {
  const series = url.pathname.match(seriesRoute)
  if (series && method === 'POST')
    return ok(await seriesAction(series[1], series[2], body))
  const project = url.pathname.match(projectRoute)
  if (!project) return null
  const [, id, action] = project
  if (action === 'map' && method === 'GET') return ok(await mapView(id))
  if (method !== 'POST') return null
  if (action === 'notes')
    return ok(
      typeof body.retry === 'string'
        ? await retryNote(id, body.retry)
        : await addNote(id, body)
    )
  if (action === 'pick') return ok(await retryPick(id))
  if (action === 'comments')
    return ok({ comments: await changeComment(id, body) })
  if (action === 'episode-title') return ok(await retitleEpisode(id, body))
  if (action === 'topics') return ok(await groupTopics(id))
  if (action === 'map-series') return ok(await startMapSeries(id, body))
  if (action === 'copies') return ok(await changeCopies(id, body))
  if (action === 'aside') return ok(await setAside(id, body))
  if (action === 'segues') {
    if (!(await loadProject(id))?.project.copyOfMap)
      throw new Refusal('Choose an episode')
    // A flagged line: kept as it is, or written again alone (review 8).
    if (body.check) return ok(await answerSegueCheck(id, body.check))
    // Asked for by the creator: every line is written anew.
    scheduleSegues(id, true)
    return ok({ writing: true })
  }
  return null
}

const seriesAction = async (
  id: string,
  action: string,
  body: Record<string, unknown>
) => {
  if (action === 'plan') return planSeries(id, body)
  if (action === 'episode-order')
    return body.after !== undefined
      ? placeEpisodeAfter(id, body)
      : moveEpisode(id, body)
  if (action === 'episode-remove') return removeEpisode(id, body)
  if (action === 'directions') return saveDirection(id, body)
  if (action === 'direction-remove') return removeDirection(id, body)
  if (action === 'brief') {
    const before = await loadSeries(id)
    const saved = await updateBrief(id, body)
    if (body.length !== undefined) await applySeriesLength(id)
    // Turned on, organising places the cards that were waiting, now.
    if (body.organize === true && before?.organize === false && saved.map)
      void organizeNewPages(saved.map).catch(() => {})
    return saved
  }
  if (action === 'gap') return setGap(id, body)
  if (action === 'organize-undo') return undoOrganize(id, body)
  if (action === 'organize') {
    const series = await loadSeries(id)
    if (!series?.map) throw new Refusal('This series has no content map')
    await organizeNewPages(series.map)
    return loadSeries(id)
  }
  return addMapEpisode(id, body)
}
