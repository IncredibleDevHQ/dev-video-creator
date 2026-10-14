// The storyboard video's HTTP routes, beside the notebook's own.
//   PUT  /api/projects/:id/storyboard/scenes/:pageId/take   a scene's take (raw)
//   POST /api/projects/:id/storyboard/approve               {note?}
//   POST /api/projects/:id/storyboard/scenes/:pageId/build  {build}
//   POST /api/projects/:id/storyboard/retry
//   GET  /api/projects/:id/storyboard/sheet                 the contact sheet
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readAsset } from '../persistence'
import { loadProject } from '../projects'
import {
  approveStoryboard,
  retryStoryboard,
  saveStoryboardTake,
  setStoryboardBuild
} from './actions'

const ROUTE =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/storyboard\/(approve|retry|sheet|scenes\/([a-zA-Z0-9_-]+)\/(build|take))$/

export const storyboardTakeRoute = (url: URL, method: string | undefined) => {
  const match = url.pathname.match(ROUTE)
  return match && match[4] === 'take' && method === 'PUT'
    ? { projectId: match[1], pageId: match[3] }
    : null
}

export const saveTakeRequest = (
  route: { projectId: string; pageId: string },
  bytes: Buffer,
  contentType: string
) => saveStoryboardTake(route.projectId, route.pageId, bytes, contentType)

export const storyboardRoute = async (
  url: URL,
  request: IncomingMessage,
  body: Record<string, unknown>,
  response: ServerResponse
): Promise<{ status: number; value: unknown } | 'sent' | null> => {
  const match = url.pathname.match(ROUTE)
  if (!match) return null
  const [, projectId, action, pageId, sceneAction] = match
  if (action === 'sheet' && request.method === 'GET') {
    const snapshot = await loadProject(projectId)
    const key = snapshot?.project.video?.storyboard?.contactSheetKey
    if (!key) return { status: 404, value: { error: 'No contact sheet yet' } }
    const bytes = await readAsset(key)
    response.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-cache'
    })
    response.end(bytes)
    return 'sent'
  }
  if (request.method !== 'POST') return null
  if (action === 'approve')
    return { status: 200, value: await approveStoryboard(projectId, body) }
  if (action === 'retry')
    return { status: 200, value: await retryStoryboard(projectId) }
  if (sceneAction === 'build')
    return {
      status: 200,
      value: await setStoryboardBuild(projectId, pageId, body?.build)
    }
  return null
}
