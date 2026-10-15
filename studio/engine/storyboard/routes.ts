// The storyboard video's HTTP routes, beside the notebook's own.
//   PUT  /api/projects/:id/storyboard/scenes/:pageId/take   a scene's take (raw)
//   POST /api/projects/:id/storyboard/approve               {note?}
//   POST /api/projects/:id/storyboard/scenes/:pageId/build  {build}
//   POST /api/projects/:id/storyboard/retry
//   GET  /api/projects/:id/storyboard/sheet                 the contact sheet
//   GET  /api/projects/:id/storyboard/frames/:frameId/snapshot  a built frame
//   POST /api/projects/:id/storyboard/frames/:number/transition {transition}
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { frameId } from '../../shared/storyboard'
import { readAsset } from '../persistence'
import { loadProject } from '../projects'
import { productionDir } from './workspace'
import {
  approveStoryboard,
  retryStoryboard,
  saveStoryboardTake,
  setStoryboardBuild,
  setStoryboardTransition
} from './actions'

const ROUTE =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/storyboard\/(approve|retry|sheet|scenes\/([a-zA-Z0-9_-]+)\/(build|take))$/

const TRANSITION_ROUTE =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/storyboard\/frames\/(\d{1,3})\/transition$/

const FRAME_ROUTE =
  /^\/api\/projects\/([a-zA-Z0-9_-]+)\/storyboard\/frames\/(f\d{2}-[a-z0-9-]+)\/snapshot$/

/** A built frame as its trial saw it, at its middle: the Video page shows it
 * on the stage and in the frame strip before the episode is made. */
export const frameSnapshot = async (projectId: string, id: string) => {
  const storyboard = (await loadProject(projectId))?.project.video?.storyboard
  const known = storyboard?.plan?.scenes.some((scene) =>
    scene.frames.some((frame) => frameId(frame) === id)
  )
  if (!storyboard || !known) return null
  const dir = join(
    productionDir(projectId, storyboard.id),
    '.studio',
    'trial',
    id,
    'snapshots'
  )
  const names = existsSync(dir)
    ? (await readdir(dir))
        .filter((name) => /^frame-\d+-at-[\d.]+s\.png$/.test(name))
        .sort()
    : []
  const middle = names[Math.floor(names.length / 2)]
  return middle ? readFile(join(dir, middle)) : null
}

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
  const frame = url.pathname.match(FRAME_ROUTE)
  if (frame && request.method === 'GET') {
    const bytes = await frameSnapshot(frame[1], frame[2])
    if (!bytes) return { status: 404, value: { error: 'Not built yet' } }
    response.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-cache'
    })
    response.end(bytes)
    return 'sent'
  }
  const transition = url.pathname.match(TRANSITION_ROUTE)
  if (transition && request.method === 'POST')
    return {
      status: 200,
      value: await setStoryboardTransition(
        transition[1],
        Number(transition[2]),
        body
      )
    }
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
