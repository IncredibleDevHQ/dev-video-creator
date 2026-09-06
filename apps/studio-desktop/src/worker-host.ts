// Worker host: starts the existing studio-v2 request handler in-process on a
// free 127.0.0.1 port. The handler comes from the esbuild bundle
// dist-electron/worker.mjs (built from apps/studio-v2/server/index.ts), so no
// tsx is needed at runtime (spec §1.3).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app } from 'electron'

export type WorkerHandle = {
  origin: string
  port: number
  dataDir: string
  stop: () => Promise<void>
}

type StudioWorkerModule = {
  createStudioHandler: (options: {
    dataDir?: string
    persistence?: 'local' | 'postgres'
    serveDist?: boolean
    distDir?: string
  }) => (request: IncomingMessage, response: ServerResponse) => Promise<void>
}

// Tried before the studio handler; return true when the request was handled
// (used for the MCP endpoint, which shares the app's origin).
export type PreHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<boolean>

const log = (...args: unknown[]) => console.log('[worker-host]', ...args)

// Ask the OS for a free port on a throwaway probe server, release it and
// reuse it for the worker. (Tiny race with other processes, acceptable here.)
const pickFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => {
        if (address && typeof address === 'object' && address.port) {
          resolve(address.port)
        } else {
          reject(new Error('Could not find a free port'))
        }
      })
    })
  })

// STUDIO_DIST_DIR overrides the location of the built front end; otherwise
// resolve apps/studio-v2/dist from the workspace layout relative to this
// bundled file (dist-electron/main.js → ../../studio-v2/dist).
const resolveDistDir = () =>
  process.env.STUDIO_DIST_DIR ||
  fileURLToPath(new URL('../../studio-v2/dist/', import.meta.url))

export const startWorker = async (
  options: { preHandler?: PreHandler } = {},
): Promise<WorkerHandle> => {
  const port = await pickFreePort()
  const dataDir =
    process.env.STUDIO_DATA_DIR || join(app.getPath('userData'), 'studio')
  const distDir = resolveDistDir()
  if (!existsSync(join(distDir, 'index.html'))) {
    log(
      `studio-v2 build not found at ${distDir} — run \`yarn studio:build\` at the repo root first`,
    )
  }
  // The worker module reads these at load time for logging and CORS.
  process.env.STUDIO_RENDER_HOST = '127.0.0.1'
  process.env.STUDIO_RENDER_PORT = String(port)
  const workerModuleUrl = pathToFileURL(
    fileURLToPath(new URL('./worker.mjs', import.meta.url)),
  ).href
  const { createStudioHandler } = (await import(
    workerModuleUrl
  )) as StudioWorkerModule
  const handler = createStudioHandler({
    dataDir,
    persistence: 'local',
    serveDist: true,
    distDir,
  })
  const server = createServer(async (request, response) => {
    if (options.preHandler && (await options.preHandler(request, response))) return
    await handler(request, response)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })
  const origin = `http://127.0.0.1:${port}`
  log(`worker in-process on ${origin} (data: ${dataDir})`)
  return {
    origin,
    port,
    dataDir,
    // closeAllConnections first so keep-alive sockets can't hold the port;
    // quit must leave no orphan listener behind.
    stop: () =>
      new Promise<void>(resolveStop => {
        server.closeAllConnections()
        server.close(() => resolveStop())
      }),
  }
}
