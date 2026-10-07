// The routes for repos, series, demos and release: what a notebook links to,
// the episodes it belongs with, and what goes out once it is made. Each
// returns null when the path is not its own, so the server falls through.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { captureDemo } from './product-capture'
import { draftPosts, updateRelease, uploadBundle } from './release'
import { makeTeaser } from './teasers'
import { askRepo, setNotebookRepos } from './repo-answers'
import { inspectRepo } from './repo-git'
import { Refusal } from './refusal'
import {
  addEpisode,
  createSeries,
  listSeries,
  planArc,
  seriesPage,
  updateSeries
} from './series'

type Reply = { status: number; value: unknown } | null
const ok = (value: unknown): Reply => ({ status: 200, value })

const projectRoute =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/(repos|repo-answers|captures|teasers|posts|release|bundle)$/

export const studioRoute = (
  url: URL,
  request: IncomingMessage,
  body: Record<string, unknown>,
  response: ServerResponse
): Promise<Reply | 'sent'> =>
  route(url, request, body, response).catch((error: unknown) => {
    if (error instanceof Refusal)
      return { status: 400, value: { error: error.message } }
    throw error
  })

const route = async (
  url: URL,
  request: IncomingMessage,
  body: Record<string, unknown>,
  response: ServerResponse
): Promise<Reply | 'sent'> => {
  const method = request.method || 'GET'
  if (url.pathname === '/api/repos/inspect' && method === 'POST')
    return ok(await inspectRepo(body.path))
  if (url.pathname === '/api/series')
    return method === 'POST'
      ? ok(await createSeries(body))
      : ok(await listSeries())
  const series = url.pathname.match(
    /^\/api\/series\/([a-zA-Z0-9_-]+)(?:\/(arc|episodes))?$/
  )
  if (series) {
    const [, id, action] = series
    if (!action && method === 'GET') return ok(await seriesPage(id))
    if (!action && method === 'POST') {
      await updateSeries(id, body)
      return ok(await seriesPage(id))
    }
    if (action === 'arc' && method === 'POST') {
      await planArc(id)
      return ok(await seriesPage(id))
    }
    if (action === 'episodes' && method === 'POST')
      return ok(await addEpisode(id, body))
  }
  const project = url.pathname.match(projectRoute)
  if (project) {
    const [, id, action] = project
    if (action === 'repos' && method === 'POST')
      return ok(await setNotebookRepos(id, body))
    if (action === 'repo-answers' && method === 'POST')
      return ok(await askRepo(id, body))
    if (action === 'captures' && method === 'POST')
      return ok(await captureDemo(id, body))
    if (action === 'teasers' && method === 'POST')
      return ok(await makeTeaser(id, body))
    if (action === 'posts' && method === 'POST') return ok(await draftPosts(id))
    if (action === 'release' && method === 'POST')
      return ok(await updateRelease(id, body))
    if (action === 'bundle' && method === 'GET') {
      const bundle = await uploadBundle(id)
      response.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(bundle.name)}"; filename*=UTF-8''${encodeURIComponent(bundle.name)}`,
        'Content-Length': bundle.bytes.length
      })
      response.end(bundle.bytes)
      return 'sent'
    }
  }
  return null
}
