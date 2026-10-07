import { saveLibraryBrand, redetectBrand } from './brand-library'
import { answerEvidence, chatSlide, scheduleChanges } from './slide-changes'
import { applyLook } from './look-apply'
import { setNotebookLength, setNotebookTemplate } from './notebook-intake'
import {
  startPresentation,
  refreshNotebookSource,
  editNotebookSource
} from './notebook-intake'
import { watchSnapshots } from './live-snapshots'
import {
  saveDialogueExtension,
  suggestDialogueExtension
} from './dialogue-extension'
import { sceneCover } from './video-cover'
import { withProgress } from './progress'
import { exportPresentation } from './presentation-export'
import { creativeContext } from './creative/stage'
import { loadHarnessPreference } from './harness/preference'
import { chatNotebook } from './notebook-chat'
import { createServer, type ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'
import { configureModelGateway } from './model-gateway'
import { uploadLogo } from './brand-logo'
import {
  getStudioSettings,
  saveStudioSettings,
  validateVoiceChoice
} from './settings'
import {
  createClone,
  deleteClone,
  retryClone,
  previewVoice,
  listClones
} from './voice-library'
import {
  createProject,
  replaceBlockedSource,
  listNotebooks,
  editSlide,
  loadProject,
  scheduleSlides,
  retrySlides,
  stopSlides
} from './projects'
import {
  makeVideo,
  retryScene,
  makeScene,
  leaveOutScene,
  previewPresence,
  replanPresence,
  setSceneBeats,
  setSceneShot,
  schedulePlanning,
  chatVideo,
  updateVideoSettings
} from './video'
import { notebookArtifacts } from './artifacts'
import { handleEngineRpc } from './harness/submissions'
import {
  recoverEngineRuns,
  inspectHarnesses,
  stopEngineRuns
} from './harness/runtime'
import { recoverProjects } from './recovery'
import { produceScene } from './production'
import { produceVideo, updateTransition } from './video-export'
import { sceneView, videoView } from '../shared/state'
import { saveRecording } from './takes'
import {
  readAsset,
  validObjectKey,
  assetIdOf,
  readRow,
  initializePersistence
} from './persistence'
import {
  requestObject,
  chatRequest,
  slideRequest,
  extensionRequest,
  numberField,
  recordingParts
} from './request-body'
import { validateHarnessSelection } from './harness/preference'
const send = (response: ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(value))
}
export const createStudioServer = (
  options: { readOnly?: boolean; eventsLifetimeMs?: number } = {}
) =>
  createServer(async (request, response) => {
    try {
      if (options.readOnly && request.method !== 'GET')
        return send(response, 403, {
          error: 'This is a saved review. Generation and editing are disabled.'
        })
      const url = new URL(request.url || '/', 'http://localhost')
      if (url.pathname === '/api/settings/logo' && request.method === 'PUT') {
        const chunks: Uint8Array[] = []
        let size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > 5000000) throw new Error('Logo too large')
          chunks.push(new Uint8Array(chunk))
        }
        return send(
          response,
          201,
          await uploadLogo(
            Buffer.concat(chunks),
            String(request.headers['content-type'] || '')
          )
        )
      }
      const voiceRoute = url.pathname.match(
        /^\/api\/settings\/voice(?:\/([a-zA-Z0-9_-]+))?(?:\/(retry))?$/
      )
      if (voiceRoute && request.method === 'PUT') {
        const chunks: Uint8Array[] = []
        let size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > 25000000) throw new Error('Voice recording too large')
          chunks.push(new Uint8Array(chunk))
        }
        return send(
          response,
          201,
          await createClone(
            Buffer.concat(chunks),
            String(request.headers['content-type'] || ''),
            request.headers['x-studio-consent'] === 'own-voice'
          )
        )
      }
      if (voiceRoute && request.method === 'DELETE' && voiceRoute[1]) {
        await deleteClone(voiceRoute[1])
        return send(response, 200, await getStudioSettings())
      }
      const recordingRoute = url.pathname.match(
        /^\/api\/projects\/([a-zA-Z0-9_-]+)\/scenes\/([a-zA-Z0-9_-]+)\/recordings$/
      )
      if (recordingRoute && request.method === 'PUT') {
        const parts = recordingParts(
          JSON.parse(
            String(request.headers['x-studio-parts'] || '[]')
          ) as unknown
        )
        const chunks: Uint8Array[] = []
        let size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > 150_000_000) throw new Error('Recording too large')
          chunks.push(new Uint8Array(chunk))
        }
        return send(
          response,
          200,
          await saveRecording(
            recordingRoute[1],
            recordingRoute[2],
            parts,
            Buffer.concat(chunks),
            String(request.headers['content-type'] || ''),
            request.headers['x-studio-upload-id']
              ? String(request.headers['x-studio-upload-id'])
              : undefined
          )
        )
      }
      let body: Record<string, unknown> = {}
      if (request.method === 'POST' || request.method === 'PATCH') {
        const chunks: Uint8Array[] = []
        let size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > 2_000_000) throw new Error('Request too large')
          chunks.push(new Uint8Array(chunk))
        }
        body = requestObject(
          JSON.parse(Buffer.concat(chunks).toString()) as unknown
        )
      }
      const extensionRoute = url.pathname.match(
        /^\/api\/projects\/([a-zA-Z0-9_-]+)\/scenes\/([a-zA-Z0-9_-]+)\/moments\/([a-zA-Z0-9_-]+)\/extension(?:\/(suggest))?$/
      )
      if (extensionRoute && request.method === 'POST') {
        const extension = extensionRequest(body)
        return send(
          response,
          200,
          extensionRoute[4]
            ? await suggestDialogueExtension(
                extensionRoute[1],
                extensionRoute[2],
                extensionRoute[3],
                { ...extension, seconds: numberField(body, 'seconds') }
              )
            : await saveDialogueExtension(
                extensionRoute[1],
                extensionRoute[2],
                extensionRoute[3],
                extension
              )
        )
      }
      if (url.pathname === '/mcp' && request.method === 'POST') {
        const reply = await handleEngineRpc(
          url.searchParams.get('run') || '',
          body
        )
        return send(response, reply.httpStatus, reply.body)
      }
      if (url.pathname === '/api/harnesses' && request.method === 'GET')
        return send(response, 200, {
          selected: await loadHarnessPreference(),
          available: await inspectHarnesses(
            creativeContext('http://127.0.0.1'),
            url.searchParams.has('adapter')
              ? validateHarnessSelection({
                  adapter: url.searchParams.get('adapter')
                }).adapter
              : undefined
          )
        })
      if (url.pathname === '/api/settings/brands' && request.method === 'POST')
        return send(response, 200, await saveLibraryBrand(body))
      if (url.pathname === '/api/settings') {
        return send(
          response,
          200,
          request.method === 'POST'
            ? await saveStudioSettings(body)
            : await getStudioSettings(
                url.searchParams.get('refresh') === 'voices'
              )
        )
      }
      if (
        voiceRoute &&
        request.method === 'POST' &&
        voiceRoute[2] === 'retry' &&
        voiceRoute[1]
      )
        return send(response, 200, await retryClone(voiceRoute[1]))
      if (
        url.pathname === '/api/settings/voice-preview' &&
        request.method === 'POST'
      )
        return send(response, 200, {
          objectKey: await previewVoice(validateVoiceChoice(body))
        })
      if (url.pathname === '/api/projects' && request.method === 'GET')
        return send(response, 200, await listNotebooks())
      if (url.pathname === '/api/projects' && request.method === 'POST')
        return send(
          response,
          201,
          await createProject(
            String(body?.source || ''),
            body.harness === undefined
              ? undefined
              : validateHarnessSelection(body.harness),
            body.sourceOnly !== false
          )
        )
      const sceneRoute = url.pathname.match(
        /^\/api\/projects\/([a-zA-Z0-9_-]+)\/scenes\/([a-zA-Z0-9_-]+)\/(retry|presence-preview|presence|beats|shot|produce|download|cover|make|leave-out)$/
      )
      if (sceneRoute && sceneRoute[3] === 'cover' && request.method === 'GET') {
        const bytes = await sceneCover(
          sceneRoute[1],
          sceneRoute[2],
          !options.readOnly
        )
        response.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': bytes.length,
          'Cache-Control': 'no-cache'
        })
        response.end(bytes)
        return
      }
      if (
        sceneRoute &&
        sceneRoute[3] === 'download' &&
        request.method === 'GET'
      ) {
        const snapshot = await loadProject(sceneRoute[1])
        const video = snapshot?.project.video
        const scene = video?.scenes.find((scene) => scene.id === sceneRoute[2])
        if (
          !scene ||
          !video ||
          !sceneView(scene, video.settings.voice).produced ||
          !scene.produced
        )
          return send(response, 409, {
            error: 'Produce this scene before downloading it'
          })
        const bytes = await readAsset(scene.produced.objectKey)
        response.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="scene.mp4"',
          'Content-Length': bytes.length
        })
        response.end(bytes)
        return
      }
      if (sceneRoute && request.method === 'POST') {
        const [, id, sceneId, action] = sceneRoute
        if (action === 'produce')
          return send(response, 200, await produceScene(id, sceneId))
        if (action === 'make')
          return send(response, 200, await makeScene(id, sceneId))
        if (action === 'leave-out')
          return send(response, 200, await leaveOutScene(id, sceneId))
        if (action === 'beats')
          return send(
            response,
            200,
            await setSceneBeats(id, sceneId, body?.beats)
          )
        if (action === 'shot')
          return send(
            response,
            200,
            await setSceneShot(id, sceneId, body?.shot)
          )
        if (action === 'retry') {
          const snapshot = await loadProject(id)
          return send(
            response,
            200,
            snapshot?.project.video?.scenes.find(
              (scene) => scene.id === sceneId
            )?.failure === 'production'
              ? await produceScene(id, sceneId)
              : await retryScene(id, sceneId)
          )
        }
        if (action === 'presence-preview')
          return send(
            response,
            200,
            await previewPresence(id, sceneId, body?.presence)
          )
        return send(
          response,
          200,
          await replanPresence(id, sceneId, body?.presence)
        )
      }
      const match = url.pathname.match(
        /^\/api\/projects\/([a-zA-Z0-9_-]+)(?:\/(events|slides|export|chat|video|produce|download|transitions|retry|stop|artifacts|source|brand-detection|look|length|template|answers))?$/
      )
      if (match) {
        const [, id, action] = match
        const snapshot = await loadProject(id)
        if (!snapshot)
          return send(response, 404, { error: 'Project not found' })
        if (action === 'events') {
          response.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
          })
          response.flushHeaders()
          response.write('retry: 2000\n\n')
          let closed = false
          const unsubscribe = watchSnapshots(id, (value) => {
            if (!closed)
              response.write(
                `data: ${JSON.stringify(
                  options.readOnly ? { ...value, readOnly: true } : value
                )}\n\n`
              )
          })
          const heartbeat = setInterval(() => {
            if (!closed) response.write('event: heartbeat\ndata: {}\n\n')
          }, 10000)
          const lease =
            options.eventsLifetimeMs === undefined
              ? undefined
              : setTimeout(() => response.end(), options.eventsLifetimeMs)
          response.on('close', () => {
            closed = true
            clearInterval(heartbeat)
            clearTimeout(lease)
            unsubscribe()
          })
          return
        }
        if (action === 'artifacts' && request.method === 'GET')
          return send(response, 200, await notebookArtifacts(id))
        if (action === 'stop' && request.method === 'POST')
          return send(response, 200, await stopSlides(id))
        if (action === 'retry' && request.method === 'POST')
          return send(response, 200, await retrySlides(id))
        if (action === 'produce' && request.method === 'POST')
          return send(response, 200, await produceVideo(id))
        if (action === 'transitions' && request.method === 'PATCH')
          return send(
            response,
            200,
            await updateTransition(
              id,
              numberField(body, 'index'),
              body.transition
            )
          )
        if (action === 'download' && request.method === 'GET') {
          const video = snapshot.project.video
          if (
            videoView(snapshot.project).action !== 'export' ||
            !video?.produced
          )
            return send(response, 409, {
              error: 'Produce this video before downloading it'
            })
          const bytes = await readAsset(video.produced.objectKey)
          response.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Content-Disposition': 'attachment; filename="video.mp4"',
            'Content-Length': bytes.length
          })
          response.end(bytes)
          return
        }
        if (action === 'video' && request.method === 'PATCH')
          return send(response, 200, await updateVideoSettings(id, body))
        if (action === 'look' && request.method === 'POST')
          return send(response, 200, await applyLook(id, body?.look))
        if (action === 'length' && request.method === 'POST')
          return send(response, 200, await setNotebookLength(id, body?.length))
        if (action === 'template' && request.method === 'POST')
          return send(response, 200, await setNotebookTemplate(id, body))
        if (action === 'answers' && request.method === 'POST')
          return send(response, 200, await answerEvidence(id, body))
        if (action === 'brand-detection' && request.method === 'POST')
          return send(response, 200, await redetectBrand(id))
        if (action === 'source' && request.method === 'GET')
          return send(response, 200, await readRow('sources', id))
        if (action === 'source' && request.method === 'PATCH')
          return send(
            response,
            200,
            body.action === 'edit'
              ? await editNotebookSource(id, body.text, body.title)
              : await replaceBlockedSource(id, body?.text)
          )
        if (action === 'source' && request.method === 'POST')
          return send(response, 200, await refreshNotebookSource(id))
        if (action === 'video' && request.method === 'POST')
          return send(response, 200, await makeVideo(id, body))
        if (action === 'chat' && request.method === 'POST') {
          const chat = chatRequest(body)
          const changed =
            chat.anchor.stage === 'video'
              ? await chatVideo(id, chat)
              : chat.anchor.stage === 'notebook'
                ? await chatNotebook(id, chat)
                : await chatSlide(id, chat)
          schedulePlanning(id)
          return send(response, 200, changed)
        }
        if (action === 'slides' && request.method === 'POST')
          return send(response, 200, await startPresentation(id, body.harness))
        if (action === 'slides' && request.method === 'PATCH') {
          const changed = await editSlide(id, slideRequest(body))
          schedulePlanning(id)
          return send(response, 200, changed)
        }
        if (action === 'export' && request.method === 'GET') {
          if (snapshot.status !== 'ready')
            return send(response, 409, {
              error: 'Wait for the presentation to finish before exporting'
            })
          const pdf = await exportPresentation(snapshot.project)
          response.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="slides.pdf"',
            'Content-Length': pdf.length
          })
          response.end(pdf)
          return
        }

        return send(
          response,
          200,
          await withProgress(
            options.readOnly ? { ...snapshot, readOnly: true } : snapshot
          )
        )
      }
      if (url.pathname.startsWith('/objects/')) {
        const name = decodeURIComponent(url.pathname.slice(9))
        if (!validObjectKey(name))
          return send(response, 404, { error: 'Not found' })
        const bytes = await readAsset(name)
        const metadata = await readRow<{ contentType: string }>(
          'assets',
          assetIdOf(name)
        )
        const headers = {
          'Content-Type': metadata?.contentType || 'application/octet-stream',
          'Accept-Ranges': 'bytes'
        }
        const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
        if (range) {
          const from = Number(range[1])
          const to = Math.min(
            range[2] ? Number(range[2]) : bytes.length - 1,
            bytes.length - 1
          )
          if (from > to || from >= bytes.length) {
            response.writeHead(416, {
              'Content-Range': `bytes */${bytes.length}`
            })
            response.end()
            return
          }
          response.writeHead(206, {
            ...headers,
            'Content-Range': `bytes ${from}-${to}/${bytes.length}`,
            'Content-Length': to - from + 1
          })
          response.end(bytes.subarray(from, to + 1))
          return
        }
        response.writeHead(200, { ...headers, 'Content-Length': bytes.length })
        response.end(bytes)
        return
      }
      send(response, 404, { error: 'Not found' })
    } catch {
      send(response, 400, {
        error:
          'Unable to complete this request. Check the input and your AI settings.'
      })
    }
  })
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  configureModelGateway({ envKey: process.env.OPENAI_API_KEY || '' })
  await initializePersistence()
  await recoverEngineRuns()
  await listClones()
  await recoverProjects({
    changes: scheduleChanges,
    slides: scheduleSlides,
    planning: schedulePlanning,
    scene: produceScene,
    video: produceVideo
  })
  const server = createStudioServer().listen(
    Number(process.env.MINIMAL_STUDIO_PORT || 4320),
    '127.0.0.1',
    () =>
      console.log(
        `Minimal Studio engine: http://127.0.0.1:${
          process.env.MINIMAL_STUDIO_PORT || 4320
        }`
      )
  )
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    server.close()
    server.closeAllConnections()
    const finished = await stopEngineRuns()
    const { closePersistence } = await import('./persistence')
    await closePersistence().catch(() => {})
    process.exit(finished ? 0 : 1)
  }
  process.on('SIGTERM', () => void stop())
  process.on('SIGINT', () => void stop())
}
