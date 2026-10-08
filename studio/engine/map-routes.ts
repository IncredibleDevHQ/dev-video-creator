// The routes for the content map: notes that pile into a notebook's pages,
// topics, the series made from it, and its episodes' copies. Each returns
// null when the path is not its own, so the server falls through.
import type { IncomingMessage } from 'node:http'
import {
  addMapEpisode,
  changeCopies,
  mapView,
  moveEpisode,
  setAside,
  startMapSeries
} from './map-episodes'
import { addNote, retryNote } from './map-notes'
import { retryPick } from './map-picking'
import { scheduleSegues } from './map-segues'
import { groupTopics } from './map-topics'
import { loadProject } from './projects'
import { Refusal } from './refusal'

type Reply = { status: number; value: unknown } | null
const ok = (value: unknown): Reply => ({ status: 200, value })

const projectRoute =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/(map|notes|topics|map-series|copies|aside|segues|pick)$/
const seriesRoute =
  /^\/api\/series\/([a-zA-Z0-9_-]+)\/(map-episodes|episode-order)$/

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
    return ok(
      series[2] === 'episode-order'
        ? await moveEpisode(series[1], body)
        : await addMapEpisode(series[1], body)
    )
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
  if (action === 'topics') return ok(await groupTopics(id))
  if (action === 'map-series') return ok(await startMapSeries(id, body))
  if (action === 'copies') return ok(await changeCopies(id, body))
  if (action === 'aside') return ok(await setAside(id, body))
  if (action === 'segues') {
    if (!(await loadProject(id))?.project.copyOfMap)
      throw new Refusal('Choose an episode')
    // Asked for by the creator: every line is written anew.
    scheduleSegues(id, true)
    return ok({ writing: true })
  }
  return null
}
