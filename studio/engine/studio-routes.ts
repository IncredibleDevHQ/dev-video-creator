// The routes for repos, series, demos and release: what a notebook links to,
// the episodes it belongs with, and what goes out once it is made. Each
// returns null when the path is not its own, so the server falls through.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { askRepo, setNotebookRepos } from './repo-answers'
import { inspectRepo } from './repo-git'
import { Refusal } from './refusal'

type Reply = { status: number; value: unknown } | null
const ok = (value: unknown): Reply => ({ status: 200, value })

const projectRoute = /^\/api\/projects\/([a-zA-Z0-9_-]+)\/(repos|repo-answers)$/

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
  void response
  const method = request.method || 'GET'
  if (url.pathname === '/api/repos/inspect' && method === 'POST')
    return ok(await inspectRepo(body.path))
  const project = url.pathname.match(projectRoute)
  if (project) {
    const [, id, action] = project
    if (action === 'repos' && method === 'POST')
      return ok(await setNotebookRepos(id, body))
    if (action === 'repo-answers' && method === 'POST')
      return ok(await askRepo(id, body))
  }
  return null
}
