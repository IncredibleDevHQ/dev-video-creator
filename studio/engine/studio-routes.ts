// The routes for repos, series, demos and release: what a notebook links to,
// the episodes it belongs with, and what goes out once it is made. Each
// returns null when the path is not its own, so the server falls through.
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  accountsView,
  connectAccount,
  disconnectAccount,
  finishConnect,
  saveAccountApp,
  saveXPrices,
  validProvider
} from './accounts'
import { enterNumbers, readNumbers, setYouTubeVideo } from './numbers'
import { changeItem, planCampaignFor, postItem } from './campaign'
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
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/(repos|repo-answers|captures|teasers|posts|release|bundle|numbers|campaign)$/

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
  if (url.pathname === '/api/accounts' && method === 'GET')
    return ok(await accountsView())
  if (url.pathname === '/api/accounts/prices' && method === 'POST')
    return ok(await saveXPrices(body))
  const account = url.pathname.match(
    /^\/api\/accounts\/([a-z]+)\/(app|connect|callback|disconnect)$/
  )
  if (account) {
    const provider = validProvider(account[1])
    if (account[2] === 'app' && method === 'POST')
      return ok(await saveAccountApp(provider, body))
    if (account[2] === 'connect' && method === 'POST')
      return ok(await connectAccount(provider))
    if (account[2] === 'disconnect' && method === 'POST')
      return ok(await disconnectAccount(provider))
    if (account[2] === 'callback' && method === 'GET') {
      const said = await finishConnect(provider, url.searchParams).then(
        (name) =>
          `Connected as ${name}. You can close this tab and go back to the studio.`,
        (error: unknown) =>
          error instanceof Refusal
            ? error.message
            : 'The sign-in did not finish. Try again from the studio.'
      )
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(
        `<!doctype html><meta charset="utf-8"><title>Incredible Studio</title><body style="font:16px system-ui;padding:48px;max-width:560px"><p>${said.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)}</p></body>`
      )
      return 'sent'
    }
  }
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
    if (action === 'numbers' && method === 'POST')
      return ok(
        body.action === 'video'
          ? await setYouTubeVideo(id, body)
          : body.action === 'enter'
            ? await enterNumbers(id, body)
            : await readNumbers(id)
      )
    if (action === 'campaign' && method === 'POST')
      return ok(
        body.action === 'post'
          ? await postItem(id, body)
          : body.action === 'change'
            ? await changeItem(id, body)
            : await planCampaignFor(id)
      )
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
