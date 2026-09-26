import { startExportJob, getExportJob, cancelExportJob, exportJobView, listProjectExports, type ExportReport } from './export-jobs'
import { generateFishVoice, generateSystemVoice, probeSeconds } from './voice'
import { landPagesOnce, runPagesIn, type LandingDeps, type PageCheck } from './page-landing'
import { containerView, holdNotebook, nameContainer, type ContainerDeps } from './containers'
import { exportPlanOf, exportSlidesOf, presentationPdf, slidesOf } from './presentation-export'
import { buildWireframeOnce, type WireframeDeps, type WireframeSource } from './wireframe-build'
import { storedArticleOf } from '../src/wireframe-attempt'
import { registerLocalArtwork } from './appearance-library'
import { type IncomingMessage, type ServerResponse } from 'node:http'
import JSZip from 'jszip'
import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, extname, join, normalize, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { skillVersions } from './skill-versions'
import { handlePlanningRoute } from './planning-routes'
import { HARNESS_STAGES, HarnessPreferenceError, loadHarnessPreferences, saveHarnessPreferences } from './harness-preferences'
import { createRenderJob, executeRenderJob } from '@hyperframes/producer'
import {
  baseStatusOf,
  compileProject,
  forkNotebook,
  generateSpeakerNotes,
  generateThemeDirections,
  mergedShapeCollection,
  normalizeStudioTheme,
  renderExplainerDiagram,
  sanitizeExplainerPlan,
  type ExplainerPlanV1,
  type ProjectDocumentV1,
  type ShapeDefV1,
  type StudioThemeV1,
  type ThemeCanvasTreatment,
  type TiptapNode,
  captionCuesForProject,
  formatWebVtt,
  formatSrt,
} from 'markdown-composition'
import {
  getObject,
  deleteProjectArtifact,
  deleteProjectContainer,
  getObjectMetadata,
  listProjectArtifacts,
  listProjectContainers,
  loadProjectContainer,
  saveProjectContainer,
  listProjectIdsAwaitingPages,
  listProjectIdsAwaitingWireframes,
  listThemeLibrary,
  loadLatestProjectArtifact,
  loadProjectArtifact,
  loadSetting,
  loadSourceRevision,
  persistenceHealth,
  saveBuildRun,
  listBuildRuns,
  recordBuildStage,
  listBuildStages,
  listPresenterTakes,
  selectPresenterTake,
  listTakeSelections,
  clearPresenterTake,
  saveProjectArtifact,
  saveSetting,
  saveRecordedBlock,
  savePickupTake,
  saveSourceRevision,
  saveNarrativeRevision,
  saveExplanationModel,
  saveThemeRevision,
  storeAsset,
  deleteTheme,
  findNotebooksReferencing,
  settingsWithPrefix,
  type BuildRunInput,
} from './persistence'
import {
  configureModelGateway,
  hasModelAccess,
  listModels,
  modelFetch,
  publicModelSettings,
  saveModelSettings,
  MODEL_PRESETS,
  type ModelSettingsV1, imageGenerate } from './model-gateway'

const HOST = process.env.STUDIO_RENDER_HOST || '127.0.0.1'
const PORT = Number(process.env.STUDIO_RENDER_PORT || 4319)
import { checkPageContract, outlinePrompt, outlineSchema, pageBrandFrom, readSourceNarrative, readSourceUrl, renderPage, sanitizeOutline, type Outline, type OutlineScene, type SourceRead } from './source'
import { buildExplanationModel, wordingPolicyFrom } from './story-model'
import { listArtwork, makeArtwork, verifyCast } from './appearance-library'
import { REFERENCE_STYLE, briefKey, briefPrompt, knownObjects } from './appearance'
import { quiverCapability } from './providers/quiver'
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
const require = createRequire(import.meta.url)
// A host a long round trip away: Node gives each of its addresses 250 ms to
// connect before racing the next (happy eyeballs), so every attempt timed
// out and reading its article failed ("fetch failed", ETIMEDOUT). Each
// attempt now has time to connect; an address that refuses still gives way.
setDefaultAutoSelectFamilyAttemptTimeout(2500)
// Projects read and write their notebooks through the store (the
// four-notebook model).
const containerDeps: ContainerDeps = {
  loadContainer: loadProjectContainer,
  saveContainer: saveProjectContainer,
  listNotebooks: listProjectArtifacts,
  loadNotebook: loadProjectArtifact,
}
const gsapRuntimePath = join(dirname(require.resolve('gsap')), 'gsap.min.js')
const hyperframesRuntimePath = join(
  dirname(require.resolve('@hyperframes/core/package.json')),
  'dist',
  'hyperframe.runtime.iife.js',
)

const readEnvFileValue = async (name: string) => {
  const candidates = [
    // The repository's own .env, resolved from this file rather than from
    // whatever directory the command happened to be run in.
    fileURLToPath(new URL('../../../.env', import.meta.url)),
    fileURLToPath(new URL('../../../../.env', import.meta.url)),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../agents/.env'),
    fileURLToPath(new URL('../../../../agents/.env', import.meta.url)),
  ]
  for (const candidate of candidates) {
    try {
      const contents = await readFile(candidate, 'utf8')
      const line = contents
        .split(/\r?\n/)
        .find(entry => entry.trim().startsWith(`${name}=`))
      if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
    } catch {
      // The local app can still run with its keyless fallbacks.
    }
  }
  return ''
}

const openAIKey =
  process.env.OPENAI_API_KEY || (await readEnvFileValue('OPENAI_API_KEY'))
// The env key serves the direct API until the creator saves a key of their
// own in AI settings; it is used, never saved.
configureModelGateway({ envKey: openAIKey })
// The artwork provider reads its key from the environment. A value the
// deployment already supplied wins; otherwise the repository's .env fills it
// in for local work. It stays on the server: never a browser variable, never
// a prompt, a log line, a saved notebook or a render artifact.
if (!process.env.QUIVER_API_KEY) {
  const key = await readEnvFileValue('QUIVER_API_KEY')
  if (key) process.env.QUIVER_API_KEY = key
}

export type StudioHandlerOptions = {
  dataDir?: string
  persistence?: 'local' | 'postgres'
  serveDist?: boolean
  distDir?: string
  // Where published MP4s land; STUDIO_OUTPUTS_DIR overrides for dev/tests.
  outputsDir?: string
  // Reads a designed page as the studio does: given by the desktop app,
  // whose worker then lands design runs' pages on their notebooks (B06).
  pageCheck?: PageCheck
}

// Option-dependent state the request handlers close over.
type StudioWorkerContext = {
  assetsDirectory: string
  outputsDirectory: string
  jobsDirectory: string
  previewsDirectory: string
  serveDist: boolean
  distDirectory: string
}

const json = (
  response: ServerResponse,
  status: number,
  value: Record<string, unknown>,
) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

const setCors = (request: IncomingMessage, response: ServerResponse) => {
  const origin = request.headers.origin
  if (
    origin === 'http://127.0.0.1:4173' ||
    origin === 'http://localhost:4173' ||
    origin === `http://${HOST}:${PORT}`
  ) {
    response.setHeader('access-control-allow-origin', origin)
  }
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
  response.setHeader(
    'access-control-allow-headers',
    'content-type,x-asset-name,x-project-id,x-block-id,x-duration-ms',
  )
  response.setHeader('cross-origin-resource-policy', 'cross-origin')
}

const readBody = async (request: IncomingMessage, maximumBytes: number) => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maximumBytes) throw new Error('Request body is too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

// The base a video was forked from, as it was at the fork. Missing or
// unreadable is not an error: the video simply has less to compare against.
const readSnapshot = async (objectKey: string | undefined): Promise<ProjectDocumentV1 | null> => {
  if (!objectKey) return null
  try {
    const { stream } = await getObject(objectKey)
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProjectDocumentV1
  } catch {
    return null
  }
}

const readJson = async <T>(request: IncomingMessage, maximumBytes: number) =>
  JSON.parse((await readBody(request, maximumBytes)).toString('utf8')) as T

const publicBaseUrl = (request: IncomingMessage) =>
  `http://${request.headers.host || `${HOST}:${PORT}`}`

const extensionForContentType = (contentType = '') => {
  if (contentType.includes('image/svg+xml')) return '.svg'
  if (contentType.includes('image/png')) return '.png'
  if (contentType.includes('image/jpeg')) return '.jpg'
  if (contentType.includes('image/webp')) return '.webp'
  if (contentType.includes('image/gif')) return '.gif'
  if (contentType.includes('video/mp4')) return '.mp4'
  if (contentType.includes('video/quicktime')) return '.mov'
  if (contentType.includes('audio/mpeg')) return '.mp3'
  if (contentType.includes('audio/wav')) return '.wav'
  if (contentType.includes('audio/aiff')) return '.aiff'
  return '.webm'
}

const contentTypeForFile = (path: string) => {
  const extension = extname(path).toLowerCase()
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aiff': 'audio/aiff',
  }
  return types[extension] || 'application/octet-stream'
}

const serveFile = async (response: ServerResponse, filePath: string) => {
  try {
    const file = await readFile(filePath)
    response.writeHead(200, {
      'content-type': contentTypeForFile(filePath),
      'content-length': file.length,
      'cache-control': 'no-store',
      'accept-ranges': 'bytes',
    })
    response.end(file)
  } catch {
    json(response, 404, { error: 'File not found' })
  }
}

const runProcess = (
  command: string,
  args: string[],
  timeoutMilliseconds = 60_000,
) =>
  new Promise<void>((resolvePromise, reject) => {
    const process = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let errorOutput = ''
    const timeout = setTimeout(() => {
      process.kill('SIGTERM')
      reject(new Error(`${command} timed out`))
    }, timeoutMilliseconds)
    process.stderr.on('data', chunk => {
      errorOutput += chunk.toString()
    })
    process.on('error', reject)
    process.on('close', code => {
      clearTimeout(timeout)
      if (code === 0) resolvePromise()
      else reject(new Error(errorOutput.trim() || `${command} exited with ${code}`))
    })
  })

const runProcessOutput = (
  command: string,
  args: string[],
  timeoutMilliseconds = 60_000,
) =>
  new Promise<string>((resolvePromise, reject) => {
    const process = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let errorOutput = ''
    const timeout = setTimeout(() => {
      process.kill('SIGTERM')
      reject(new Error(`${command} timed out`))
    }, timeoutMilliseconds)
    process.stdout.on('data', chunk => {
      output += chunk.toString()
    })
    process.stderr.on('data', chunk => {
      errorOutput += chunk.toString()
    })
    process.on('error', reject)
    process.on('close', code => {
      clearTimeout(timeout)
      if (code === 0) resolvePromise(output)
      else reject(new Error(errorOutput.trim() || `${command} exited with ${code}`))
    })
  })

const mediaHasAudioStream = async (path: string) => {
  try {
    const output = await runProcessOutput('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'csv=p=0',
      path,
    ])
    return output.trim().length > 0
  } catch {
    return false
  }
}

const commandExists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const handleVoice = async (
  context: StudioWorkerContext,
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    text?: string
    referenceId?: string
    projectId?: string
    blockId?: string
  }>(
    request,
    32_000,
  )
  const text = body.text?.trim()
  if (!text) throw new Error('Add a script before generating voice')
  if (text.length > 5_000) throw new Error('Voice script is limited to 5,000 characters')

  const id = randomUUID()
  const outputPath = join(context.assetsDirectory, `${id}.mp3`)
  const useFish = Boolean(body.referenceId && process.env.FISH_AUDIO_API_KEY)
  if (useFish) {
    await generateFishVoice(text, body.referenceId as string, outputPath)
  } else {
    await generateSystemVoice(text, outputPath)
  }
  const stored = await storeAsset({
    body: await readFile(outputPath),
    contentType: 'audio/mpeg',
    projectId: body.projectId,
    blockId: body.blockId,
    kind: 'generated-voice',
    extension: '.mp3',
  })
  await rm(outputPath, { force: true })
  json(response, 200, {
    url: `${publicBaseUrl(request)}/objects/${stored.objectKey}`,
    assetId: stored.assetId,
    provider: useFish ? 'Fish Audio authorized voice' : 'Local system voice',
  })
}

const extractResponseText = (response: {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
}) =>
  response.output
    ?.flatMap(item => item.content || [])
    .find(item => item.type === 'output_text')?.text || ''

const handleNotesGeneration = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    project?: ProjectDocumentV1
    blockId?: string
    targetMinutes?: number
  }>(request, 3 * 1024 * 1024)
  if (!body.project || !body.blockId) {
    throw new Error('Notes need the project and a block to narrate')
  }
  const targetMinutes = Math.min(15, Math.max(0.5, Number(body.targetMinutes) || 1))
  const fallback = generateSpeakerNotes(body.project, body.blockId, targetMinutes)

  if (!(await hasModelAccess())) {
    json(response, 200, { notes: fallback, provider: 'local-generator' })
    return
  }

  try {
    const blockIndex = body.project.notebook.content.findIndex(
      node => node.attrs?.id === body.blockId,
    )
    const blockJson = JSON.stringify(
      body.project.notebook.content[blockIndex],
    ).slice(0, 8_000)
    const notebookJson = JSON.stringify(body.project.notebook).slice(0, 24_000)
    const wordBudget = Math.round(targetMinutes * 140)
    const apiResponse = await modelFetch('writing', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
        input: `Write presenter speaker notes for one block of a developer video titled "${body.project.title}". The presenter is on camera and reveals the block's content step by step while talking. Target roughly ${targetMinutes} minute(s) of speech (~${wordBudget} words at 140 wpm). Write short spoken-style lines, one per beat, matching the block's structure (one line per bullet point or code line where that applies), grounded ONLY in the notebook content provided — do not invent facts. Include a one-line opening hook and a one-line handoff to the next block. Block being narrated (Tiptap JSON): ${blockJson}. Full notebook for context (Tiptap JSON): ${notebookJson}.`,
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'speaker_notes',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['notes'],
              properties: { notes: { type: 'string' } },
            },
          },
        },
      }),
    })
    if (!apiResponse.ok) {
      throw new Error(`OpenAI notes generation failed (${apiResponse.status})`)
    }
    const apiBody = (await apiResponse.json()) as Parameters<
      typeof extractResponseText
    >[0]
    const parsed = JSON.parse(extractResponseText(apiBody)) as { notes?: string }
    const notes = String(parsed.notes || '').trim().slice(0, 8_000)
    if (!notes) throw new Error('OpenAI returned empty notes')
    json(response, 200, { notes, provider: 'openai' })
  } catch {
    json(response, 200, { notes: fallback, provider: 'local-generator' })
  }
}

// ——— Explainer blocks: expand a statement, then plan a diagram ———

const EXPLAINER_WORD_BUDGETS = { brief: 80, standard: 170, detailed: 320 } as const
type ExplainerVerbosity = keyof typeof EXPLAINER_WORD_BUDGETS

const fallbackExplainerAbstract = (
  topic: string,
  verbosity: ExplainerVerbosity,
) => {
  const sentences = [
    `${topic} is easiest to understand as a small system of moving parts.`,
    `Each part has one job, and the parts hand their work to each other in a fixed order.`,
    `Start by naming the pieces involved, then follow one piece of data as it travels through them.`,
    `Along the way, notice what every part receives, what it changes, and what it passes on.`,
    `Seen end to end, the flow explains why ${topic.toLowerCase()} behaves the way it does.`,
    `Edge cases aside, the same loop repeats every time the system runs.`,
  ]
  const count = verbosity === 'brief' ? 2 : verbosity === 'detailed' ? 6 : 4
  return sentences.slice(0, count).join(' ')
}

const fallbackExplainerPlan = (
  topic: string,
  abstract: string,
): ExplainerPlanV1 => {
  const sentences = abstract
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .slice(0, 4)
  const shapes = ['circle', 'box', 'diamond', 'rounded']
  const labels = ['Input', 'Process', 'Decision', 'Result'].slice(
    0,
    Math.max(2, sentences.length),
  )
  const entities = labels.map((label, index) => ({
    id: `part-${index + 1}`,
    label,
    shape: shapes[index % shapes.length],
    x: 50,
    y: 50,
    level: index,
    order: 0,
  }))
  const connectors = entities.slice(1).map((entity, index) => ({
    id: `flow-${index + 1}`,
    from: entities[index].id,
    to: entity.id,
    style: 'arrow' as const,
  }))
  const steps = entities.map((entity, index) => ({
    title: index === 0 ? `Meet ${topic}` : `Then: ${entity.label.toLowerCase()}`,
    explanation: sentences[index] || `The ${entity.label.toLowerCase()} plays its part.`,
    reveals: [entity.id, ...(index > 0 ? [connectors[index - 1].id] : [])],
  }))
  return { entities, connectors, steps }
}

const handleExplainerAbstract = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    topic?: string
    verbosity?: string
    instructions?: string
  }>(request, 256 * 1024)
  const topic = String(body.topic || '').trim().slice(0, 600)
  if (!topic) throw new Error('Tell the explainer what to explain')
  const verbosity = (
    ['brief', 'standard', 'detailed'] as const
  ).includes(body.verbosity as ExplainerVerbosity)
    ? (body.verbosity as ExplainerVerbosity)
    : 'standard'
  const fallback = fallbackExplainerAbstract(topic, verbosity)
  if (!(await hasModelAccess())) {
    json(response, 200, { abstract: fallback, provider: 'local-generator' })
    return
  }
  try {
    const wordBudget = EXPLAINER_WORD_BUDGETS[verbosity]
    const instructions = String(body.instructions || '').slice(0, 1_000)
    const apiResponse = await modelFetch('writing', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
        input: `Expand the following statement into a clear spoken-style explanation for a technical video, roughly ${wordBudget} words. Plain language, concrete, no headings or lists — flowing prose a presenter can narrate while a diagram animates. Statement to explain: "${topic}".${instructions ? ` Additional instructions from the author: ${instructions}.` : ''}`,
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'explainer_abstract',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['abstract'],
              properties: { abstract: { type: 'string' } },
            },
          },
        },
      }),
    })
    if (!apiResponse.ok) {
      throw new Error(`OpenAI abstract generation failed (${apiResponse.status})`)
    }
    const apiBody = (await apiResponse.json()) as Parameters<
      typeof extractResponseText
    >[0]
    const parsed = JSON.parse(extractResponseText(apiBody)) as {
      abstract?: string
    }
    const abstract = String(parsed.abstract || '').trim().slice(0, 6_000)
    if (!abstract) throw new Error('OpenAI returned an empty abstract')
    json(response, 200, { abstract, provider: 'openai' })
  } catch {
    json(response, 200, { abstract: fallback, provider: 'local-generator' })
  }
}

const explainerPlanSchema = (shapes: ShapeDefV1[]) => {
  const connectorSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'from', 'to', 'style', 'label'],
    properties: {
      id: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      style: { type: 'string', enum: ['line', 'arrow', 'dashed'] },
      label: { type: 'string' },
    },
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['entities', 'connectors', 'steps'],
    properties: {
      entities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label', 'shape', 'level', 'order'],
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            shape: { type: 'string', enum: shapes.map(shape => shape.key) },
            level: { type: 'integer' },
            order: { type: 'integer' },
          },
        },
      },
      connectors: { type: 'array', items: connectorSchema },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'explanation', 'reveals'],
          properties: {
            title: { type: 'string' },
            explanation: { type: 'string' },
            reveals: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }
}

// Renders a plan exactly as the composition will (same shared renderer),
// with every item visible, for the visual-feedback loop to screenshot.
const explainerReviewHtml = (plan: ExplainerPlanV1, shapes: ShapeDefV1[]) => {
  return `<!doctype html><html><head><style>
    body { margin: 0; background: #0f1411; display: grid; place-items: center; }
    svg.explainer-diagram { width: 1600px; height: 860px; --ex-fill: rgba(74,222,128,.12); --ex-stroke: #4ade80; }
    .ex-item { opacity: 1 !important; }
    .ex-entity-label { fill: #f4f4f5; font: 700 30px system-ui, sans-serif; text-anchor: middle; }
    .ex-connector-label { fill: #a1a1aa; font: 600 24px system-ui, sans-serif; text-anchor: middle; }
  </style></head><body>${renderExplainerDiagram(plan, shapes)}</body></html>`
}

const screenshotExplainerPlan = async (
  plan: ExplainerPlanV1,
  shapes: ShapeDefV1[],
) => {
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({ handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 860 })
    await page.setContent(explainerReviewHtml(plan, shapes), {
      waitUntil: 'load',
    })
    const shot = await page.screenshot({ type: 'png' })
    return Buffer.from(shot).toString('base64')
  } finally {
    await browser.close()
  }
}

// The agent loop the studio calls after planning: render the plan, look at
// the actual pixels, critique, revise, repeat — up to two passes.
// ——— Canvas agent harness ———
// A full coding agent for explainer animations: the model writes a complete
// Canvas 2D program against a fixed contract, the harness runs it in a
// disposable sandbox (fresh headless Chrome page, all network blocked,
// nothing but a canvas), screenshots every step, and feeds the pixels back
// for critique — iterating until the animation matches the narration. The
// runner is an interface: a docker/pi-based backend can replace the
// in-browser sandbox without touching the loop.

const EXPLAINER_CANVAS_CONTRACT = `Write a COMPLETE JavaScript program (no imports, no markdown fences) that assigns:
globalThis.explainer = {
  stepCount: <number — exactly the number of narration steps>,
  drawFrame(ctx, stepIndex, progress, width, height, theme) { ... }
}
drawFrame draws the ENTIRE frame for narration step stepIndex on the CanvasRenderingContext2D ctx (canvas is width x height, cleared for you, transparent background — the video's dark scene shows through):
- Everything introduced by earlier steps is drawn fully settled.
- The elements this step introduces animate in using progress (0..1): apply your own easing; at progress 1 they are settled.
- Nothing from later steps appears.
- theme = { stroke, fill, text, muted } — brand colors; use theme.text for labels (system-ui font), theme.stroke for shape outlines and connectors, theme.fill for shape fills, theme.muted for secondary annotations.
Rules: deterministic (no Date.now/Math.random), no network, no DOM beyond ctx, no external images or fonts. Layout for 1600x860. Draw crisp diagram graphics: clear spatial hierarchy, generous spacing, no overlapping labels, arrowheads on directed connectors, readable 26-34px labels.
Text discipline: every text run owns its own clear space — never draw two text runs at or near the same anchor. When a later step updates a card's content (a subtitle becomes values, a placeholder becomes a result), draw the NEW content INSTEAD of the old, never both. Charts, bars and icons must not intersect any text. Reserve vertical room inside cards for their tallest step's content.`

type CanvasAgentStep = { title: string; explanation: string }

const screenCanvasCode = (code: string) => {
  if (
    /\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|document\s*\.\s*cookie|localStorage|indexedDB|sessionStorage|window\s*\.\s*(top|parent|open)|<\/?script)/i.test(
      code,
    ) ||
    /\bimport\s*\(/.test(code)
  ) {
    throw new Error('Generated code used a capability the sandbox forbids')
  }
  return code
}

const runCanvasCodeSandbox = async (
  code: string,
  steps: CanvasAgentStep[],
) => {
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({ handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 860 })
    await page.setRequestInterception(true)
    page.on('request', request => {
      // The sandbox page itself is the only allowed document.
      if (request.url().startsWith('data:')) void request.continue()
      else void request.abort()
    })
    await page.setContent(
      `<!doctype html><html><head><style>body{margin:0;background:#0f1411}canvas{display:block}</style></head><body><canvas id="stage" width="1600" height="860"></canvas></body></html>`,
    )
    const setupError = await page.evaluate(async source => {
      try {
        // eslint-disable-next-line no-new-func
        new Function(source)()
        const contract = (globalThis as { explainer?: { stepCount?: number; drawFrame?: unknown } }).explainer
        if (!contract || typeof contract.drawFrame !== 'function') {
          return 'The program never assigned globalThis.explainer.drawFrame'
        }
        return ''
      } catch (error) {
        return error instanceof Error ? `${error.name}: ${error.message}` : 'Program crashed while loading'
      }
    }, code)
    if (setupError) return { error: setupError, frames: [] as string[] }
    const frames: string[] = []
    for (let step = 0; step < steps.length; step += 1) {
      const drawError = await page.evaluate((stepIndex: number) => {
        try {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement
          const ctx = canvas.getContext('2d')!
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ;(globalThis as unknown as {
            explainer: {
              drawFrame: (
                c: CanvasRenderingContext2D,
                s: number,
                p: number,
                w: number,
                h: number,
                t: Record<string, string>,
              ) => void
            }
          }).explainer.drawFrame(ctx, stepIndex, 1, canvas.width, canvas.height, {
            stroke: '#4ade80',
            fill: 'rgba(74,222,128,.12)',
            text: '#f4f4f5',
            muted: '#a1a1aa',
          })
          return ''
        } catch (error) {
          return error instanceof Error ? `${error.name}: ${error.message}` : 'drawFrame crashed'
        }
      }, step)
      if (drawError) return { error: `drawFrame(step ${step}) failed: ${drawError}`, frames }
      const shot = await page.screenshot({ type: 'png' })
      frames.push(Buffer.from(shot).toString('base64'))
    }
    return { error: '', frames }
  } finally {
    await browser.close()
  }
}

const extractCanvasCode = (raw: string) =>
  raw
    .replace(/^```(?:javascript|js)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

const handleExplainerCanvasAgent = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    topic?: string
    abstract?: string
    plan?: ExplainerPlanV1
    instructions?: string
  }>(request, 1024 * 1024)
  const topic = String(body.topic || '').trim().slice(0, 600)
  const plan = sanitizeExplainerPlan(body.plan, mergedShapeCollection(undefined))
  if (!topic || !plan.steps.length) {
    throw new Error('The canvas agent needs the topic and the planned steps')
  }
  if (!(await hasModelAccess())) {
    throw new Error('The canvas agent needs an OpenAI key')
  }
  const instructions = String(body.instructions || '').slice(0, 1_000)
  const steps: CanvasAgentStep[] = plan.steps.map(step => ({
    title: step.title,
    explanation: step.explanation,
  }))
  const stepBrief = steps
    .map(
      (step, index) =>
        `Step ${index} — ${step.title}: ${step.explanation}`,
    )
    .join('\n')
  const entityBrief = plan.entities
    .map(entity => `${entity.label} (level ${entity.level})`)
    .join('; ')
  let code = ''
  let notes = ''
  let feedback = ''
  let iterations = 0
  for (let pass = 0; pass < 3; pass += 1) {
    const content: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: `You are an expert HTML5 Canvas 2D animator building the diagram animation for a technical explainer video about "${topic}". The narration has ${steps.length} sequential steps — the animation MUST map one-to-one onto them: step k of your program is what plays while the narrator reads step k.\n${stepBrief}\nSuggested entities and hierarchy from the approved plan: ${entityBrief}.\n${EXPLAINER_CANVAS_CONTRACT}${instructions ? `\nAuthor's instructions: ${instructions}.` : ''}${feedback ? `\nYour previous attempt needs work. Feedback: ${feedback}\nReturn the full corrected program.` : ''}`,
      },
    ]
    if (code && !feedback.startsWith('drawFrame') && iterations > 0) {
      // On critique passes the previous code travels along for revision.
      content.push({ type: 'input_text', text: `Previous program:\n${code}` })
    }
    const apiResponse = await modelFetch('coding', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
        input: [{ role: 'user', content }],
        reasoning: { effort: 'medium' },
        text: {
          format: {
            type: 'json_schema',
            name: 'canvas_program',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'notes'],
              properties: {
                code: { type: 'string' },
                notes: { type: 'string' },
              },
            },
          },
        },
      }),
    })
    if (!apiResponse.ok) {
      throw new Error(`Canvas agent generation failed (${apiResponse.status})`)
    }
    const apiBody = (await apiResponse.json()) as Parameters<
      typeof extractResponseText
    >[0]
    const generated = JSON.parse(extractResponseText(apiBody)) as {
      code?: string
      notes?: string
    }
    code = screenCanvasCode(extractCanvasCode(String(generated.code || '')))
    notes = String(generated.notes || '').slice(0, 300)
    iterations += 1
    const run = await runCanvasCodeSandbox(code, steps)
    if (run.error) {
      feedback = run.error
      continue
    }
    if (pass >= 2) break
    // Show the agent its own frames, one per narration step, for review.
    const reviewContent: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: `These are the rendered frames of your canvas program, one per narration step, in order. Inspect every frame INDIVIDUALLY and closely — zoom into every card and label. Hard gates, any one of which forces approved=false: (1) any text overlapping other text, even partially — double-exposed or ghosted words are the most common defect, look for them inside cards where content changed between steps; (2) any chart, bar or icon intersecting text; (3) any element painted outside the frame or clipped. Then check the narration mapping:\n${stepBrief}\nDoes frame k depict exactly what step k narrates; do earlier elements persist; arrows pointing the right way; balanced composition. List each frame's issues in your feedback as "frame N: …". Only respond approved=true with feedback "" if every single frame is clean.`,
      },
      ...run.frames.map(frame => ({
        type: 'input_image',
        image_url: `data:image/png;base64,${frame}`,
      })),
    ]
    const reviewResponse = await modelFetch('vision', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
        input: [{ role: 'user', content: reviewContent }],
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'canvas_review',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['approved', 'feedback'],
              properties: {
                approved: { type: 'boolean' },
                feedback: { type: 'string' },
              },
            },
          },
        },
      }),
    })
    if (!reviewResponse.ok) break
    const reviewBody = (await reviewResponse.json()) as Parameters<
      typeof extractResponseText
    >[0]
    const review = JSON.parse(extractResponseText(reviewBody)) as {
      approved?: boolean
      feedback?: string
    }
    if (review.approved) {
      notes = notes || 'Approved after reviewing every step frame'
      break
    }
    feedback = String(review.feedback || '').slice(0, 1_200)
  }
  const finalRun = await runCanvasCodeSandbox(code, steps)
  if (finalRun.error) {
    throw new Error(`The canvas agent could not produce a working program: ${finalRun.error}`)
  }
  json(response, 200, { code, iterations, notes, provider: 'openai' })
}

// ——— Image-animation experiment ———
// Isolated harness for a prospective "image animation" block: the author
// supplies a still image plus a description of what should move, and the
// coding agent writes a Canvas 2D program that animates ONLY that part on a
// transparent overlay above the image. Single-shot generate with optional
// author-feedback revision; the experiment page is the sandbox.
const IMAGE_ANIMATION_CONTRACT = `Write a COMPLETE JavaScript program (no imports, no markdown fences) that assigns:
globalThis.imageAnimation = {
  duration: <number — seconds for one seamless loop>,
  drawFrame(ctx, time, width, height) { ... }
}
drawFrame draws ONE frame of an animated overlay on the CanvasRenderingContext2D ctx. The canvas sits exactly on top of the still image you were shown, is width x height (the image's pixel size), and is cleared to full transparency before every call — the image stays visible beneath everything you do not paint.
Rules:
- Animate ONLY what the author described, positioned precisely over the matching region of the image; leave every other pixel untouched (transparent).
- time is seconds; the animation must loop seamlessly with period duration (use phases of time % duration, or continuous periodic functions).
- Deterministic: derive all motion from time (no Date.now, no Math.random at draw time — precompute any pseudo-random values with a seeded function).
- Match the image's artistic style: soft alpha, gentle gradients, painterly strokes; never stamp solid boxes or harsh vector shapes over artwork; no text unless the author asks for text.
- No network, no DOM beyond ctx, no external images or fonts.`

const handleImageAnimationExperiment = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    image?: string
    instructions?: string
    previousCode?: string
    feedback?: string
  }>(request, 12 * 1024 * 1024)
  const image = String(body.image || '')
  const instructions = String(body.instructions || '').trim().slice(0, 1_200)
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    throw new Error('The experiment needs the image as a png/jpeg/webp data URL')
  }
  if (!instructions) {
    throw new Error('Describe the animation you want on top of the image')
  }
  if (!(await hasModelAccess())) {
    throw new Error('The image-animation agent needs an OpenAI key')
  }
  const previousCode = String(body.previousCode || '').slice(0, 40_000)
  const feedback = String(body.feedback || '').trim().slice(0, 1_200)
  const content: Array<Record<string, unknown>> = [
    {
      type: 'input_text',
      text: `You are an expert HTML5 Canvas 2D animator. The attached image is a still frame; the author wants part of it brought to life with an animated overlay.\nAuthor's animation description: ${instructions}\nStudy the image to locate the exact region the description refers to and measure its position and proportions by eye — your coordinates must land on it.\n${IMAGE_ANIMATION_CONTRACT}${
        previousCode && feedback
          ? `\nYour previous attempt needs work. Author feedback: ${feedback}\nPrevious program:\n${previousCode}\nReturn the full corrected program.`
          : ''
      }`,
    },
    { type: 'input_image', image_url: image },
  ]
  const apiResponse = await modelFetch('coding', {
    method: 'POST',
    body: JSON.stringify({
      model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
      input: [{ role: 'user', content }],
      reasoning: { effort: 'medium' },
      text: {
        format: {
          type: 'json_schema',
          name: 'image_animation_program',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'notes'],
            properties: {
              code: { type: 'string' },
              notes: { type: 'string' },
            },
          },
        },
      },
    }),
  })
  if (!apiResponse.ok) {
    throw new Error(`Image-animation generation failed (${apiResponse.status})`)
  }
  const apiBody = (await apiResponse.json()) as Parameters<
    typeof extractResponseText
  >[0]
  const generated = JSON.parse(extractResponseText(apiBody)) as {
    code?: string
    notes?: string
  }
  const code = screenCanvasCode(extractCanvasCode(String(generated.code || '')))
  json(response, 200, {
    code,
    notes: String(generated.notes || '').slice(0, 400),
    provider: 'openai',
  })
}

// ——— Slide build-order planning ———
// Turns a slide's narration into a build order over its atomised parts, or
// rewrites an existing order from a plain-language instruction. The parts
// inventory comes from the studio's atomiser; ids are validated on return.
const handleSlidePlan = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    title?: string
    narration?: string
    instruction?: string
    units?: Array<{ id: string; kind: string; label: string; x: number; y: number; w: number; h: number; group?: string }>
    steps?: Array<{ title: string; explanation: string; reveals: string[]; verb: string }>
  }>(request, 2 * 1024 * 1024)
  const units = Array.isArray(body.units) ? body.units.slice(0, 400) : []
  if (!units.length) throw new Error('The slide has no parts to plan')
  if (!(await hasModelAccess())) {
    throw new Error('Planning from narration needs an AI provider — add one under Direct API in AI settings')
  }
  const narration = String(body.narration || '').trim().slice(0, 6_000)
  const instruction = String(body.instruction || '').trim().slice(0, 1_500)
  const current = Array.isArray(body.steps) ? body.steps.slice(0, 40) : []
  const inventory = units
    .map(unit => `${unit.id} · ${unit.kind} · "${String(unit.label || '').slice(0, 60)}" · at ${Math.round(unit.x)},${Math.round(unit.y)} size ${Math.round(unit.w)}×${Math.round(unit.h)}${unit.group ? ` · in ${unit.group}` : ''}`)
    .join('\n')
  const validIds = new Set(units.map(unit => unit.id))
  const prompt = `You plan the build order of an animated slide for a narrated technical video titled "${String(body.title || 'Slide').slice(0, 120)}". The slide is a static diagram; parts appear on screen step by step while the presenter speaks.

PARTS (id · kind · label · position; positions are in the slide's coordinate space, y grows downward):
${inventory}

${narration ? `NARRATION (what the presenter says, in order):\n${narration}\n` : ''}${current.length ? `CURRENT STEPS:\n${current.map((step, index) => `${index + 1}. ${step.title} — reveals ${step.reveals.join(', ')} — verb ${step.verb} — says: ${step.explanation}`).join('\n')}\n` : ''}${instruction ? `INSTRUCTION FROM THE AUTHOR: ${instruction}\nApply it to the current steps and keep everything the instruction does not mention.\n` : `Derive the steps from the narration: each step is one beat of the explanation, revealing exactly the parts that beat talks about, in the order the narration reaches them.\n`}
Rules: every part id appears in exactly one step (a part never appears twice); a connector reveals in the step of the part it leads to; a label reveals with the part it describes; frames reveal with the first part inside them; use verb "trace" when a step's parts include connectors, "focus" for a step that re-emphasises already visible parts, else "reveal". Titles are short (2–5 words). explanation is the narration text to speak over that step (quote or lightly adapt the narration; if there is none, write one natural sentence). Keep between 3 and 24 steps.`
  const apiResponse = await modelFetch('writing', {
    method: 'POST',
    body: JSON.stringify({
      model: 'ignored',
      input: prompt,
      reasoning: { effort: 'medium' },
      text: {
        format: {
          type: 'json_schema',
          name: 'slide_build_order',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['steps'],
            properties: {
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'explanation', 'reveals', 'verb'],
                  properties: {
                    title: { type: 'string' },
                    explanation: { type: 'string' },
                    reveals: { type: 'array', items: { type: 'string' } },
                    verb: { type: 'string', enum: ['reveal', 'trace', 'focus'] },
                  },
                },
              },
            },
          },
        },
      },
    }),
  })
  if (!apiResponse.ok) throw new Error(`Slide planning failed (${apiResponse.status})`)
  const apiBody = (await apiResponse.json()) as Parameters<typeof extractResponseText>[0]
  const generated = JSON.parse(extractResponseText(apiBody)) as {
    steps?: Array<{ title?: string; explanation?: string; reveals?: string[]; verb?: string }>
  }
  const seen = new Set<string>()
  const steps = (generated.steps || [])
    .map(step => ({
      title: String(step.title || '').trim().slice(0, 120),
      explanation: String(step.explanation || '').trim().slice(0, 1_200),
      reveals: (Array.isArray(step.reveals) ? step.reveals : [])
        .map(id => String(id).trim())
        .filter(id => validIds.has(id) && !seen.has(id) && (seen.add(id), true)),
      verb: step.verb === 'trace' || step.verb === 'focus' ? step.verb : 'reveal',
    }))
    .filter(step => step.reveals.length)
  json(response, 200, { steps, provider: 'openai' })
}

// ——— Scene dialogue (picture-aware) and breakdown ———
// The writer sees the page: every part with id, kind, label and position,
// the arrows and what they join, what the driver can do to a part, and the
// pacing target. It returns windows of attention that reference part ids,
// so nothing has to be matched by words afterwards. The breakdown keeps the
// approved words untouched and only assigns parts / hero / camera / layout
// per window.
type SceneUnitInput = { id: string; kind: string; label: string; x: number; y: number; w: number; h: number; group?: string }
type SceneRelationInput = { connector: string; from: string; to: string; verb?: string }
type SceneDiagramInput = { id: string; kind: string; parts: string[]; hops: Array<{ from: string; to: string; verb: string }> }
type SceneEntityInput = { id: string; label: string; type: string; states: string[] }

const sceneInventory = (units: SceneUnitInput[], relations: SceneRelationInput[], diagrams: SceneDiagramInput[] = [], entities: SceneEntityInput[] = []) => {
  const lines = units.map(unit =>
    `${unit.id} · ${unit.kind} · "${String(unit.label || '').slice(0, 70)}" · at ${Math.round(unit.x)},${Math.round(unit.y)} size ${Math.round(unit.w)}×${Math.round(unit.h)}${unit.group ? ` · in ${unit.group}` : ''}`,
  )
  const arrows = relations.map(relation => `${relation.connector}: ${relation.from} → ${relation.to}${relation.verb ? ` (${relation.verb})` : ''}`)
  const shapes = diagrams.slice(0, 6).map(diagram => `${diagram.id}: a ${diagram.kind} of ${diagram.parts.length} — ${diagram.parts.slice(0, 10).join(' → ')}${diagram.hops.length ? `; the relations mean: ${[...new Set(diagram.hops.map(hop => hop.verb))].join(', ')}` : ''}`)
  const typed = entities.slice(0, 12).map(entity => `${entity.id} "${String(entity.label).slice(0, 40)}" is a ${entity.type} (can be ${entity.states.join(' / ')})`)
  return `PARTS (id · kind · label · position; y grows downward):\n${lines.join('\n')}\n${arrows.length ? `\nARROWS (connector: from → to (what the arrow means)):\n${arrows.join('\n')}\n` : ''}${shapes.length ? `\nDIAGRAMS (what the arrangement depicts; speak the process, not the geometry — say what waits for what, what splits, what merges):\n${shapes.join('\n')}\n` : ''}${typed.length ? `\nENTITIES (things with states; a state is worth naming when the story changes it):\n${typed.join('\n')}\n` : ''}`
}

const SCENE_CAPABILITIES = `WHAT THE MOTION ENGINE CAN DO WITH A PART (one window at a time):
- bring a part on screen when it is first spoken (boxes and labels settle in; arrows draw from tail to head after the boxes they join);
- count a number up in place (any label that is a number ≥ 10, a decimal, or a number with a unit);
- pop the hero of the window (a short scale-and-glow), also for a part already on screen when it is spoken again;
- dim everything except the parts the window is about (a focus window), lifted on the next window;
- move the camera in on the parts of a tight window (never tighter than a third of the page), back to the page when the next window's parts fall outside;
- draw a connection between two parts that have no arrow;
- stage the presenter: full frame with nothing else ("me"), beside the page in a panel ("beside"), or as a small chip while the page owns the frame ("page").
CONSTRAINTS: a part is highlighted only after it has been brought on screen; a window brings in at most ~8 parts (more reads as a wall); a window has at most one hero; the first window of a hook or a close belongs to the presenter; numbers are spoken when they count.
OUTRO: every scene except the last one in the video ends with an outro window — one sentence that closes the scene's idea and hands over to what comes next, spoken to camera, naming no new parts; its layout is "beside" (the presenter fully in frame beside the page) and its intent is "transition". The director then cuts to the presenter alone to lead into the next scene, so the sentence must land on its own.`

const windowSchema = (withSay: boolean) => ({
  type: 'object',
  additionalProperties: false,
  required: ['windows'],
  properties: {
    windows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [...(withSay ? ['say'] : ['index']), 'title', 'parts', 'hero', 'intent', 'camera', 'layout'],
        properties: {
          ...(withSay ? { say: { type: 'string' } } : { index: { type: 'integer' } }),
          title: { type: 'string' },
          parts: { type: 'array', items: { type: 'string' } },
          hero: { type: 'string' },
          intent: { type: 'string', enum: ['introduce', 'locate', 'relate', 'contrast', 'transform', 'quantify', 'emphasize', 'flow', 'recap', 'transition'] },
          camera: { type: 'array', items: { type: 'string' } },
          layout: { type: 'string', enum: ['page', 'beside', 'me'] },
        },
      },
    },
  },
})

const handleSceneDialogue = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{
    title?: string
    role?: string
    notes?: string
    existing?: string
    instruction?: string
    granularity?: string
    targetSeconds?: number
    wpm?: number
    position?: { index: number; count: number }
    units?: SceneUnitInput[]
    relations?: SceneRelationInput[]
    diagrams?: SceneDiagramInput[]
    entities?: SceneEntityInput[]
    // The video plan's slice for this scene: what came before, what comes
    // next (the outro hands over to it), and the names the video shares.
    neighbours?: { previous?: { title: string; idea: string } | null; next?: { title: string; idea: string } | null }
    glossary?: string[]
    // The article's own sentences behind this scene, verbatim.
    passages?: string[]
    // The director's length brief, read from the picture: how long, how
    // many windows, what to walk in what order, what to name in passing.
    brief?: {
      seconds: number
      windows: number
      words: number
      outline: Array<{ label: string; seconds: number; parts: Array<{ id: string; label: string }> }>
      passing: Array<{ id: string; label: string }>
      skip: Array<{ id: string; label: string }>
    }
  }>(request, 2 * 1024 * 1024)
  const units = Array.isArray(body.units) ? body.units.slice(0, 400) : []
  if (!units.length) throw new Error('The page has no parts to write about')
  if (!(await hasModelAccess())) throw new Error('Writing with the page needs an AI provider — add one under Direct API in AI settings')
  const relations = Array.isArray(body.relations) ? body.relations.slice(0, 200) : []
  const diagrams = Array.isArray(body.diagrams) ? body.diagrams.slice(0, 12) : []
  const entities = Array.isArray(body.entities) ? body.entities.slice(0, 40) : []
  const granularity = body.granularity === 'paragraph' || body.granularity === 'clause' ? body.granularity : 'sentence'
  const wpm = Math.max(90, Math.min(200, Number(body.wpm) || 150))
  const brief = body.brief && Number.isFinite(Number(body.brief.seconds)) && Array.isArray(body.brief.outline) ? body.brief : null
  const targetSeconds = Math.max(8, Math.min(240, Number(body.targetSeconds) || (brief ? Number(brief.seconds) : 0) || 40))
  const targetWords = Math.round((targetSeconds / 60) * wpm)
  // When the author's target differs from the brief, the brief's shape holds
  // (what to walk, in what order) and its seconds scale to the target.
  const briefScale = brief ? targetSeconds / Math.max(1, Number(brief.seconds)) : 1
  const briefWindows = brief ? Math.max(2, Math.min(14, Math.round(Number(brief.windows) * briefScale))) : 0
  const briefText = brief
    ? `LENGTH BRIEF (the director read the picture): explain this page in ≈ ${targetSeconds} s (≈ ${targetWords} words) in about ${briefWindows} windows (${Math.max(2, briefWindows - 2)}–${briefWindows + 2}). The default must be this long — a thinner draft leaves the page unexplained.
Walk, in this order:
${brief.outline
  .slice(0, 12)
  .map((stretch, index) => `${index + 1}. ${String(stretch.label).slice(0, 60)} (≈ ${Math.max(3, Math.round(Number(stretch.seconds) * briefScale))} s)${stretch.parts?.length ? ` — ${stretch.parts.slice(0, 12).map(part => `${part.id} "${String(part.label).slice(0, 40)}"`).join(', ')}${stretch.parts.length > 12 ? ` +${stretch.parts.length - 12}` : ''}` : ''}`)
  .join('\n')}
Cover the causal idea rather than every drawn label. Omit decorative shapes and ordinal badges from speech; their presence never earns a sentence. Arrows and connectors are drawn by the motion engine when the parts they join are named — never say "connector" or "arrow #N"; list an arrow's id in a window's parts only when the line follows it. ${brief.passing?.length ? `Optional context, only if it contributes to the explanation: ${brief.passing.slice(0, 16).map(part => `"${String(part.label).slice(0, 30)}"`).join(', ')}. ` : ''}${brief.skip?.length ? `Do not mention: ${brief.skip.slice(0, 10).map(part => `"${String(part.label).slice(0, 30)}"`).join(', ')}.` : ''}`
    : ''
  const notes = String(body.notes || '').trim().slice(0, 4_000)
  const existing = String(body.existing || '').trim().slice(0, 6_000)
  const instruction = String(body.instruction || '').trim().slice(0, 1_000)
  const position = body.position && Number.isFinite(body.position.index) ? `scene ${body.position.index + 1} of ${body.position.count}${body.position.index + 1 >= (body.position.count || 0) ? ' — the last scene, so it closes the video instead of handing over' : ''}` : ''
  const passages = (Array.isArray(body.passages) ? body.passages : []).map(line => String(line).slice(0, 320)).filter(Boolean).slice(0, 4)
  const neighbourText = [
    body.neighbours?.previous ? `PREVIOUS SCENE (what the viewer just heard; do not repeat it): "${String(body.neighbours.previous.title).slice(0, 80)}"${body.neighbours.previous.idea ? ` — ${String(body.neighbours.previous.idea).slice(0, 200)}` : ''}` : '',
    body.neighbours?.next ? `NEXT SCENE (the outro hands over to it, by its name or its idea): "${String(body.neighbours.next.title).slice(0, 80)}"${body.neighbours.next.idea ? ` — ${String(body.neighbours.next.idea).slice(0, 200)}` : ''}` : '',
    Array.isArray(body.glossary) && body.glossary.length ? `GLOSSARY (the video's shared names; use them exactly): ${body.glossary.slice(0, 24).map(entry => String(entry).slice(0, 120)).join('; ')}` : '',
    passages.length ? `THE SOURCE'S OWN WORDS for this scene — the article this video comes from, quoted exactly:\n${passages.map(line => `· ${line}`).join('\n')}\nThese carry what the page cannot: the motivating example, the number, the reason a thing happens. Use their facts, causes and figures in your own spoken words; prefer a concrete cause from them over a general statement about the picture. Never contradict them and never invent a fact they do not contain.` : '',
  ].filter(Boolean).join('\n')
  const prompt = `You write the spoken dialogue for one scene of a narrated technical video, and you can see the page the presenter is explaining. Title: "${String(body.title || 'Scene').slice(0, 120)}"${position ? ` (${position}` : ''}${body.role ? `${position ? ', ' : ' ('}role in the story: ${String(body.role).slice(0, 40)})` : position ? ')' : ''}.

${sceneInventory(units, relations, diagrams, entities)}
${SCENE_CAPABILITIES}

${neighbourText ? `${neighbourText}\n` : ''}${notes ? `SOURCE NOTES (what this scene must convey):\n${notes}\n` : ''}${existing ? `CURRENT DIALOGUE (rewrite it; keep what works):\n${existing}\n` : ''}${instruction ? `INSTRUCTION FROM THE AUTHOR: ${instruction}\n` : ''}
Explain what happens, why it happens, and what the viewer should infer. Never narrate page construction, a row number, a Circle label, a title, or truncated inventory text. Geometry names are metadata, not source facts. Write the dialogue as a sequence of windows of attention. One window = ${granularity === 'paragraph' ? 'a short paragraph (2–3 sentences)' : granularity === 'clause' ? 'one clause or a very short sentence' : 'one sentence'} that is about specific parts of the page. Name the parts with the words the page uses (their labels), in an order the page can support: what is on screen before what depends on it, arrows after the boxes they join, a number when it is quoted. Every window lists the ids of the parts it is about (the ones that come on screen or are highlighted while it is spoken), exactly one hero id (or "" if the window belongs to the presenter), the camera ids (parts to move in on; [] to stay on the page), the layout ("me" for a line that needs no page, "beside" when a small figure sits next to the presenter, "page" when the page needs the frame), and the intent. Do not name parts that are not on the page. ${briefText ? `${briefText}\n` : `Aim for about ${targetWords} words in total (≈ ${targetSeconds} s at ${wpm} words a minute), between 3 and 12 windows.`} Spoken, plain, first person plural or second person; no bullet points, no headings inside "say".`
  const windows = await sceneWindowsFromModel(prompt, windowSchema(true), units)
  json(response, 200, { windows, provider: 'openai' })
}

// An edit asked from the frame: the author selected parts of the page (or
// the speaker) on one line and asked for a change. The model returns the
// whole dialogue with the lines it changed and why — knock-on changes
// inside the chosen scope included — so the studio can show a change set.
const editSchema = () => {
  const base = windowSchema(true) as { properties: { windows: { items: { properties: Record<string, unknown>; required: string[] } } } }
  // The edit answer may also pick a stage family for a line.
  base.properties.windows.items.properties = { ...base.properties.windows.items.properties, stage: { type: 'string' } }
  base.properties.windows.items.required = [...base.properties.windows.items.required, 'stage']
  return {
    type: 'object',
    additionalProperties: false,
    required: ['windows', 'changes', 'summary'],
    properties: {
      windows: base.properties.windows,
      changes: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['index', 'why'], properties: { index: { type: 'integer' }, why: { type: 'string' } } },
      },
      summary: { type: 'string' },
    },
  }
}

const handleSceneEdit = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{
    title?: string
    units?: SceneUnitInput[]
    relations?: SceneRelationInput[]
    windows?: Array<{ say: string; title?: string; parts?: string[]; hero?: string; camera?: string[]; layout?: string }>
    stages?: string[]
    // The director's measured staging options per line: the answer may
    // pick one by name when the ask is about the frame.
    options?: Array<Array<{ family: string; variant?: string; treatment?: string; score: number; textPx: number; why: string }>>
    focus?: { line: number; parts?: Array<{ id: string; label: string }>; speaker?: boolean; scope?: 'line' | 'part' | 'scene' }
    instruction?: string
    wpm?: number
    position?: { index: number; count: number }
    screenshot?: string
  }>(request, 6 * 1024 * 1024)
  const units = Array.isArray(body.units) ? body.units.slice(0, 400) : []
  const windows = Array.isArray(body.windows) ? body.windows.slice(0, 48) : []
  if (!units.length || !windows.length) throw new Error('An edit needs the page and the dialogue')
  if (!(await hasModelAccess())) throw new Error('Editing with the page needs an AI provider — add one under Direct API in AI settings')
  const relations = Array.isArray(body.relations) ? body.relations.slice(0, 200) : []
  const focus = body.focus || { line: 0, scope: 'line' as const }
  const scope = focus.scope === 'scene' || focus.scope === 'part' ? focus.scope : 'line'
  const instruction = String(body.instruction || '').trim().slice(0, 1_000)
  const selected = (focus.parts || []).slice(0, 12).map(part => `${part.id} "${String(part.label).slice(0, 40)}"`).join(', ')
  const current = windows
    .map((window, index) => `${index + 1}. [${body.stages?.[index] || 'page'}] "${String(window.say).slice(0, 400)}" — parts: ${(window.parts || []).join(', ') || 'none'}${window.hero ? ` · hero ${window.hero}` : ''}${window.camera?.length ? ` · camera in on ${window.camera.join(', ')}` : ''} · layout ${window.layout || 'page'}`)
    .join('\n')
  const prompt = `You edit the spoken dialogue of one scene of a narrated technical video, with the page in front of you. Scene: "${String(body.title || 'Scene').slice(0, 120)}"${body.position ? ` (scene ${body.position.index + 1} of ${body.position.count})` : ''}.

${sceneInventory(units, relations)}
${SCENE_CAPABILITIES}

CURRENT DIALOGUE (one line per window; [frame] is who owns the frame on that line):
${current}
${Array.isArray(body.options) && body.options.length ? `STAGING OPTIONS (measured by the director for each line, best first: family, score, smallest text on the page in px, why). The measurements are authoritative; the first is what the director would choose:\n${body.options.slice(0, 40).map((list, index) => `${index + 1}. ${(list || []).slice(0, 4).map(option => `${option.family}${option.variant ? `/${option.variant}` : ''}${option.treatment ? ` (${option.treatment})` : ''} · ${Number(option.score).toFixed(2)} · text ${Math.round(Number(option.textPx))}px${option.why ? ` · ${String(option.why).slice(0, 60)}` : ''}`).join(' | ') || 'no options'}`).join('\n')}\n` : ''}
THE AUTHOR'S ASK, made on line ${focus.line + 1}${selected ? ` with these parts selected: ${selected}` : ''}${focus.speaker ? ' with the presenter selected' : ''}:
"${instruction || 'improve this'}"
SCOPE: ${scope === 'line' ? 'this line — change other lines only if this change breaks their flow (a repeated word, a hand-over that no longer lands, the outro)' : scope === 'part' ? 'the selected parts wherever the scene speaks about them — every line that names them may change' : 'the whole scene — rethink the lines as a whole around this ask'}.
${body.screenshot ? 'A picture of the frame at that line is attached: use it to judge crowding, legibility and where the presenter sits.\n' : ''}
Every window also has "stage": "" to leave the frame to the director, or — only when the ask is about the frame (more room, closer, show me, keep the page) — ONE family name from that line's STAGING OPTIONS; pick a family other than the first only when the ask calls for it and its text stays at least 18 px. Return the WHOLE dialogue as windows in order (keep unchanged windows word for word, with the same parts, hero, camera and layout), and "changes": one entry per window whose words, parts, hero, camera, layout or stage changed — its index (0-based) and one short clause saying why. "summary": one sentence saying what changed overall. Keep the author's words where they were not asked to change. Arrows and connectors are drawn when their boxes are named — never say "connector".`
  const content: Array<{ type: string; text?: string; image_url?: string }> = [{ type: 'input_text', text: prompt }]
  if (body.screenshot && /^data:image\/(png|jpeg);base64,/.test(body.screenshot) && body.screenshot.length < 4_000_000) content.push({ type: 'input_image', image_url: body.screenshot })
  const call = async (withImage: boolean) =>
    modelFetch(withImage ? 'vision' : 'writing', {
      method: 'POST',
      body: JSON.stringify({
        model: withImage ? process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna' : 'ignored',
        input: withImage ? [{ role: 'user', content }] : prompt,
        reasoning: { effort: 'medium' },
        text: { format: { type: 'json_schema', name: 'scene_edit', strict: true, schema: editSchema() } },
      }),
    })
  let apiResponse = await call(content.length > 1)
  if (!apiResponse.ok && content.length > 1) apiResponse = await call(false)
  if (!apiResponse.ok) throw new Error(`The editor failed (${apiResponse.status})`)
  const apiBody = (await apiResponse.json()) as Parameters<typeof extractResponseText>[0]
  const generated = JSON.parse(extractResponseText(apiBody)) as {
    windows?: Array<{ say?: string; title?: string; parts?: string[]; hero?: string; intent?: string; camera?: string[]; layout?: string }>
    changes?: Array<{ index?: number; why?: string }>
    summary?: string
  }
  const validIds = new Set(units.map(unit => unit.id))
  const ids = (list: unknown) => (Array.isArray(list) ? list : []).map(id => String(id).trim()).filter(id => validIds.has(id))
  const edited = (generated.windows || []).map(window => ({
    say: String(window.say || '').trim().slice(0, 1_200),
    title: String(window.title || '').trim().slice(0, 60),
    parts: [...new Set(ids(window.parts))],
    hero: validIds.has(String(window.hero || '')) ? String(window.hero) : '',
    intent: String(window.intent || ''),
    camera: [...new Set(ids(window.camera))],
    layout: window.layout === 'me' || window.layout === 'beside' ? window.layout : 'page',
    stage: String((window as { stage?: unknown }).stage || '').trim().slice(0, 32),
  }))
  const changes = (generated.changes || [])
    .filter(change => Number.isFinite(Number(change.index)))
    .map(change => ({ index: Number(change.index), why: String(change.why || '').slice(0, 160) }))
  json(response, 200, { windows: edited, changes, summary: String(generated.summary || '').slice(0, 240), provider: 'openai' })
}


// ——— Phase 0: how a video begins ———
// A link or a narrative is read into text, headings, a palette, fonts and
// logo candidates; the model turns the text into an outline with a runtime;
// pages are rendered here from the outline so they carry the contract.
// Every read is captured as an immutable source revision (D1): content and
// brand evidence are stored separately, and a pasted narrative may name an
// optional brand website for colours/fonts/logo — text alone cannot
// reveal them.
const handleSourceRead = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{ url?: string; narrative?: string; title?: string; projectId?: string; brandUrl?: string; wordingPolicy?: string; attribution?: string }>(request, 400 * 1024)
  const projectId = String(body.projectId || request.headers['x-project-id'] || '') || undefined
  const source = body.url?.trim() ? await readSourceUrl(body.url, { projectId }) : readSourceNarrative(String(body.narrative || ''), String(body.title || ''))
  if (!source.text.trim()) throw new Error('Nothing to read — paste a link to an article or a narrative of your own')
  // Text pasted in place of a link that could not be read keeps that link as
  // where it came from (F4 of the Perplexity review). It is not fetched.
  const attribution = !body.url?.trim() && body.attribution?.trim() ? (() => { try { return new URL(body.attribution!.trim()) } catch { return null } })() : null
  if (attribution && /^https?:$/.test(attribution.protocol)) {
    source.url = attribution.toString()
    source.site = attribution.hostname.replace(/^www\./, '')
    source.warnings = [...source.warnings, `The article's text was pasted; ${source.site} is kept as where it came from.`]
  }
  let brandEvidence: SourceRead | null = null
  // The brand website is its own source, for a link as for pasted text (U1
  // of the scene workspace plan): its colours, fonts and logo only.
  if (body.brandUrl?.trim()) {
    try {
      brandEvidence = await readSourceUrl(body.brandUrl, { projectId })
      // Brand from the website; the words stay the creator's own.
      source.palette = brandEvidence.palette
      source.logos = brandEvidence.logos
      if (brandEvidence.fonts.seen.length) source.fonts = brandEvidence.fonts
      source.site = source.site || brandEvidence.site
    } catch (error) {
      source.warnings = [...source.warnings, `Brand website could not be read: ${error instanceof Error ? error.message : error}`]
      // Pasted text's colours stay defaults, and say so (F5 of the Perplexity
      // review); a link keeps what its own page showed.
      const host = (() => { try { return new URL(body.brandUrl!.trim()).hostname.replace(/^www\./, '') } catch { return 'the brand website' } })()
      if (!body.url?.trim()) source.palette = { ...source.palette, provenance: 'fallback', from: `${host} could not be read` }
    }
  }
  const snapshot = await saveSourceRevision({
    projectId,
    kind: body.url?.trim() ? 'url' : 'narrative',
    url: body.url?.trim() || (attribution ? source.url : undefined),
    brandUrl: brandEvidence ? body.brandUrl?.trim() : undefined,
    title: source.title,
    site: source.site,
    content: source,
    brandContent: brandEvidence || undefined,
  })
  // An authored narrative is also a narrative revision under its wording
  // policy (D2): the creator's voice and editorial intent are durable
  // records, not dialog state.
  let narrative = null
  if (!body.url?.trim()) {
    narrative = await saveNarrativeRevision({
      projectId,
      sourceRevision: snapshot.id,
      origin: 'authored',
      wordingPolicy: wordingPolicyFrom(body.wordingPolicy, 'preserve'),
      text: source.text,
      takeaway: source.title,
    })
  }
  // The site the colours were read from, by the name themes are saved for:
  // the brand website, else a link's own page — never an article merely credited.
  const brandSite = brandEvidence && brandEvidence.palette.provenance === 'extracted' ? brandEvidence.site : body.url?.trim() && source.palette.provenance === 'extracted' ? source.site : null
  json(response, 200, { source, snapshot, narrative, brandSite })
}

// A brand website read on its own, at the brand step (U1 of the scene
// workspace plan): its colours, fonts and logo, never its words.
const handleSourceBrand = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{ url?: string; projectId?: string }>(request, 16 * 1024)
  const url = String(body.url || '').trim()
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Give the brand website as a full link, like https://yoursite.com')
  const projectId = String(body.projectId || request.headers['x-project-id'] || '') || undefined
  const read = await readSourceUrl(url, { projectId })
  json(response, 200, { brand: { palette: read.palette, logos: read.logos, fonts: read.fonts, site: read.site } })
}

// An outline from the direct model: the import's fallback when no local
// harness makes it, and a wireframe's in the background (the four-notebook
// model).
const outlineViaApi = async (source: Pick<SourceRead, 'title' | 'site' | 'text' | 'words'>, targetSeconds: number | null, wordingPolicy: ReturnType<typeof wordingPolicyFrom>) => {
  if (!(await hasModelAccess())) throw new Error('Outlining a source needs an AI provider — add one under Direct API in AI settings')
  const apiResponse = await modelFetch('writing', {
    method: 'POST',
    body: JSON.stringify({
      model: 'ignored',
      input: outlinePrompt({ title: String(source.title || ''), site: String(source.site || ''), text: String(source.text), words: Number(source.words) || String(source.text).split(/\s+/).length }, targetSeconds, wordingPolicy),
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_schema', name: 'video_outline', strict: true, schema: outlineSchema() } },
    }),
  })
  if (!apiResponse.ok) throw new Error(`The outliner failed (${apiResponse.status})`)
  const apiBody = (await apiResponse.json()) as Parameters<typeof extractResponseText>[0]
  const outline = sanitizeOutline(JSON.parse(extractResponseText(apiBody)), String(source.title || ''), String(source.text || ''))
  if (!outline.scenes.length) throw new Error('The outliner returned no scenes')
  return outline
}

const handleSourceOutline = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{ source?: Pick<SourceRead, 'title' | 'site' | 'text' | 'words'>; targetSeconds?: number; wordingPolicy?: string }>(request, 400 * 1024)
  const source = body.source
  if (!source || !String(source.text || '').trim()) throw new Error('The outline needs the source text')
  const targetSeconds = Number.isFinite(Number(body.targetSeconds)) && Number(body.targetSeconds) > 0 ? Math.round(Number(body.targetSeconds)) : null
  const outline = await outlineViaApi(source, targetSeconds, wordingPolicyFrom(body.wordingPolicy, 'draft'))
  json(response, 200, { outline, provider: 'openai' })
}

// A project's wireframe, made in the background from its outline (the
// four-notebook model).
const wireframeDeps: WireframeDeps = {
  load: loadProjectArtifact,
  save: (notebook, expected) => saveProjectArtifact(notebook, { expectedProject: expected }),
  run: async runId => (await listBuildRuns()).find(row => row.id === runId) || null,
  readOutline: async projectDir => JSON.parse(await readFile(join(projectDir, 'story', 'outline.json'), 'utf8')),
  // The article as stored, read through the one shape the studio's "Make
  // it again" reads it with (R01 of the project-flow rereview).
  source: async (revisionId): Promise<WireframeSource | null> => storedArticleOf(await loadSourceRevision(revisionId)),
  outlineViaApi: (source, targetSeconds, wording) => outlineViaApi(source, targetSeconds, wording),
  saveModel: saveExplanationModel,
}

const handleSourcePages = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{
    outline?: Outline
    palette?: SourceRead['palette']
    fonts?: SourceRead['fonts']
    site?: string
    mode?: 'dark' | 'light' | 'auto'
  }>(request, 1024 * 1024)
  const outline = body.outline
  if (!outline || !Array.isArray(outline.scenes) || !outline.scenes.length) throw new Error('Pages need an outline with scenes')
  const palette = body.palette || { candidates: [], ground: '#0b1f3a', text: '#e8f1fa', accent: '#f5a623', secondary: '#9cc3e6', themeColor: '', provenance: 'fallback' as const, from: '' }
  const fonts = body.fonts || { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas', seen: [] }
  const brand = pageBrandFrom(palette, fonts, body.mode || 'auto')
  const scenes = outline.scenes as OutlineScene[]
  const pages = scenes.map((scene, index) => {
    const svg = renderPage(scene, index, scenes.length, brand, { title: outline.title, site: String(body.site || '') })
    return { title: scene.title, kind: scene.kind, seconds: scene.seconds, idea: scene.idea, narration: scene.narration, svg, contract: checkPageContract(svg) }
  })
  json(response, 200, { pages, brand })
}

const handleSceneBreakdown = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{
    title?: string
    windows?: Array<{ index: number; say: string }>
    units?: SceneUnitInput[]
    relations?: SceneRelationInput[]
  }>(request, 2 * 1024 * 1024)
  const units = Array.isArray(body.units) ? body.units.slice(0, 400) : []
  const windows = Array.isArray(body.windows) ? body.windows.slice(0, 48) : []
  if (!units.length || !windows.length) throw new Error('The breakdown needs the page and the approved dialogue')
  if (!(await hasModelAccess())) throw new Error('The breakdown needs an AI provider — add one under Direct API in AI settings')
  const relations = Array.isArray(body.relations) ? body.relations.slice(0, 200) : []
  const prompt = `You break an approved dialogue down for the motion engine. The words are final and must not change; you decide, per window, which parts of the page the window is about.

Scene: "${String(body.title || 'Scene').slice(0, 120)}".

${sceneInventory(units, relations)}
${SCENE_CAPABILITIES}

WINDOWS (index · what is said):
${windows.map(window => `${window.index} · ${String(window.say || '').slice(0, 600)}`).join('\n')}

For every window index return: the part ids the window is about (what should come on screen or be highlighted while it is spoken — include a part only when the words refer to it, by name, by number, or unmistakably by description), one hero id (or ""), camera ids (parts to move in on when the window is about a small region; [] otherwise), the layout ("me" when the line needs no page at all, "beside" when one small figure would sit next to the presenter, "page" otherwise), the intent, and a 2–5 word title. A part that is never referred to by any window is left out; do not invent ids.`
  const assigned = await sceneWindowsFromModel(prompt, windowSchema(false), units)
  json(response, 200, { windows: assigned, provider: 'openai' })
}

const sceneWindowsFromModel = async (
  prompt: string,
  schema: ReturnType<typeof windowSchema>,
  units: SceneUnitInput[],
) => {
  const apiResponse = await modelFetch('writing', {
    method: 'POST',
    body: JSON.stringify({
      model: 'ignored',
      input: prompt,
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_schema', name: 'scene_windows', strict: true, schema } },
    }),
  })
  if (!apiResponse.ok) throw new Error(`The writer failed (${apiResponse.status})`)
  const apiBody = (await apiResponse.json()) as Parameters<typeof extractResponseText>[0]
  const generated = JSON.parse(extractResponseText(apiBody)) as {
    windows?: Array<{ index?: number; say?: string; title?: string; parts?: string[]; hero?: string; intent?: string; camera?: string[]; layout?: string }>
  }
  const validIds = new Set(units.map(unit => unit.id))
  const ids = (list: unknown) => (Array.isArray(list) ? list : []).map(id => String(id).trim()).filter(id => validIds.has(id))
  return (generated.windows || []).map(window => ({
    ...(typeof window.index === 'number' ? { index: window.index } : {}),
    ...(typeof window.say === 'string' ? { say: window.say.trim().slice(0, 1_200) } : {}),
    title: String(window.title || '').trim().slice(0, 60),
    parts: [...new Set(ids(window.parts))],
    hero: validIds.has(String(window.hero || '')) ? String(window.hero) : '',
    intent: String(window.intent || ''),
    camera: [...new Set(ids(window.camera))],
    layout: window.layout === 'me' || window.layout === 'beside' ? window.layout : 'page',
  }))
}

const handleExplainerRefine = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    topic?: string
    abstract?: string
    plan?: ExplainerPlanV1
    shapes?: ShapeDefV1[]
    instructions?: string
  }>(request, 1024 * 1024)
  const topic = String(body.topic || '').trim().slice(0, 600)
  const shapes = mergedShapeCollection(
    Array.isArray(body.shapes) ? body.shapes : undefined,
  )
  let plan = sanitizeExplainerPlan(body.plan, shapes)
  if (!topic || !plan.entities.length) {
    throw new Error('Refinement needs the topic and a planned diagram')
  }
  if (!(await hasModelAccess())) {
    json(response, 200, { plan, iterations: 0, notes: 'No OpenAI key — visual review skipped', provider: 'local-generator' })
    return
  }
  const instructions = String(body.instructions || '').slice(0, 1_000)
  let iterations = 0
  let notes = 'The rendered layout was approved as-is'
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const screenshot = await screenshotExplainerPlan(plan, shapes)
      const apiResponse = await modelFetch('vision', {
        method: 'POST',
        body: JSON.stringify({
          model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `You designed a diagram explaining "${topic}" and this screenshot is how it actually renders. Review it like an editor: overlapping shapes or labels, text colliding with other text or connectors, connectors crossing through shapes, cramped or unbalanced levels, redundant or confusing links. If it reads cleanly, return approved=true and the plan unchanged. Otherwise return approved=false with an improved plan — adjust levels and sibling order for spacing, shorten labels, drop or reroute confusing connectors (same schema: levels are 0-based top-down, order is left-to-right among siblings) — and one sentence of notes describing the fix. Current plan JSON: ${JSON.stringify(plan)}.${instructions ? ` Author's instructions: ${instructions}.` : ''}`,
                },
                {
                  type: 'input_image',
                  image_url: `data:image/png;base64,${screenshot}`,
                },
              ],
            },
          ],
          reasoning: { effort: 'low' },
          text: {
            format: {
              type: 'json_schema',
              name: 'explainer_review',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['approved', 'notes', 'plan'],
                properties: {
                  approved: { type: 'boolean' },
                  notes: { type: 'string' },
                  plan: explainerPlanSchema(shapes),
                },
              },
            },
          },
        }),
      })
      if (!apiResponse.ok) {
        throw new Error(`OpenAI visual review failed (${apiResponse.status})`)
      }
      const apiBody = (await apiResponse.json()) as Parameters<
        typeof extractResponseText
      >[0]
      const review = JSON.parse(extractResponseText(apiBody)) as {
        approved?: boolean
        notes?: string
        plan?: ExplainerPlanV1
      }
      iterations += 1
      if (review.approved) {
        notes = String(review.notes || 'Approved after visual review').slice(0, 300)
        break
      }
      const revised = sanitizeExplainerPlan(review.plan, shapes)
      if (!revised.entities.length) break
      plan = revised
      notes = String(review.notes || 'Adjusted after visual review').slice(0, 300)
    }
    json(response, 200, { plan, iterations, notes, provider: 'openai' })
  } catch {
    json(response, 200, {
      plan,
      iterations,
      notes: 'Visual review unavailable — kept the current layout',
      provider: 'local-generator',
    })
  }
}

const handleExplainerPlan = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    topic?: string
    abstract?: string
    instructions?: string
    shapes?: ShapeDefV1[]
  }>(request, 512 * 1024)
  const topic = String(body.topic || '').trim().slice(0, 600)
  const abstract = String(body.abstract || '').trim().slice(0, 6_000)
  if (!topic || !abstract) {
    throw new Error('A plan needs the topic and the approved abstract')
  }
  const shapes = mergedShapeCollection(
    Array.isArray(body.shapes) ? body.shapes : undefined,
  )
  const fallback = sanitizeExplainerPlan(
    fallbackExplainerPlan(topic, abstract),
    shapes,
  )
  if (!(await hasModelAccess())) {
    json(response, 200, { plan: fallback, provider: 'local-generator' })
    return
  }
  try {
    const instructions = String(body.instructions || '').slice(0, 1_000)
    const shapeVocabulary = shapes
      .map(shape => `${shape.key} (${shape.label})`)
      .join(', ')
    const apiResponse = await modelFetch('writing', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.OPENAI_NOTES_MODEL || 'gpt-5.6-luna',
        input: `Design an animated diagram that explains "${topic}" for a technical video. The explanation being narrated: "${abstract}". Identify the concrete entities involved and represent each with an atomic shape from this vocabulary: ${shapeVocabulary}. Choose shapes by meaning — cylinder for data stores and datasets, box for processes and components, rounded for outputs and results, diamond for decisions and comparisons, cloud for external systems, hexagon for algorithms and optimizers, circle for atomic units like nodes or neurons, pill for interfaces and APIs, note for documents and annotations — so the same kind of thing always gets the same kind of shape. Organize the entities as a layered dependency DAG: level 0 holds the root inputs at the top, and each deeper level depends on the levels above it. Give every entity its level (0-based integer) and its order among the siblings on that level (0-based, left to right). Connect entities with connectors: arrows for dependencies flowing from one level into the next, and — where siblings on the same level have an execution-order relationship between them — sibling-to-sibling connectors (arrow or dashed) expressing that order. Label connectors with a short verb phrase (two or three words) describing what flows or happens. Then break the reveal into 3 to 6 narrated steps that follow the dependency order: reveal root-level entities first, then each deeper level together with the connectors feeding it — never reveal a connector before both of its endpoints. Each step names the entity and connector ids appearing at that moment and explains, in one or two spoken sentences tied to the narration, what the viewer is seeing. Use at most 8 entities. Every entity and connector id must be revealed by exactly one step.${instructions ? ` Additional instructions from the author: ${instructions}.` : ''}`,
        reasoning: { effort: 'medium' },
        text: {
          format: {
            type: 'json_schema',
            name: 'explainer_plan',
            strict: true,
            schema: explainerPlanSchema(shapes),
          },
        },
      }),
    })
    if (!apiResponse.ok) {
      throw new Error(`OpenAI plan generation failed (${apiResponse.status})`)
    }
    const apiBody = (await apiResponse.json()) as Parameters<
      typeof extractResponseText
    >[0]
    const parsed = JSON.parse(
      extractResponseText(apiBody),
    ) as Partial<ExplainerPlanV1>
    const plan = sanitizeExplainerPlan(parsed, shapes)
    if (!plan.entities.length) throw new Error('OpenAI returned no entities')
    json(response, 200, { plan, provider: 'openai' })
  } catch {
    json(response, 200, { plan: fallback, provider: 'local-generator' })
  }
}

const handleThemeGeneration = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    brandColor?: string
    secondaryColor?: string
    accentColor?: string
    name?: string
    treatment?: ThemeCanvasTreatment | 'both'
    mood?: string
  }>(request, 16_000)
  const brandColor = /^#[0-9a-f]{6}$/i.test(body.brandColor || '')
    ? (body.brandColor as string)
    : '#16a34a'
  const name = body.name?.trim().slice(0, 60) || 'My brand'
  const secondaryColor = /^#[0-9a-f]{6}$/i.test(body.secondaryColor || '')
    ? (body.secondaryColor as string)
    : '#15803d'
  const accentColor = /^#[0-9a-f]{6}$/i.test(body.accentColor || '')
    ? (body.accentColor as string)
    : '#4ade80'
  const treatment = ['solid', 'gradient', 'grid', 'both'].includes(
    body.treatment || '',
  )
    ? (body.treatment as ThemeCanvasTreatment | 'both')
    : 'both'
  const fallback = generateThemeDirections(brandColor, name, treatment, {
    secondary: secondaryColor,
    accent: accentColor,
  })

  if (!(await hasModelAccess())) {
    json(response, 200, { themes: fallback, provider: 'local-generator' })
    return
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['themes'],
    properties: {
      themes: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name',
            'description',
            'background',
            'surface',
            'text',
            'mutedText',
            'primary',
            'secondary',
            'accent',
            'codeBackground',
            'canvasTreatment',
            'gradient',
            'gridColor',
            'videoLayout',
            'videoBorderStyle',
            'videoBorderWidth',
            'videoBorderRadius',
            'titleStyle',
            'contentStyle',
            'listStyle',
            'codeStyle',
            'codeSyntaxTheme',
            'codeInternalAnimation',
            'quoteStyle',
            'titleLayout',
            'contentLayout',
            'listLayout',
            'codeLayout',
            'quoteLayout',
            'surfaceStyle',
            'blockBorderRadius',
            'titleMotion',
            'contentMotion',
            'listMotion',
            'codeMotion',
            'quoteMotion',
          ],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            background: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            surface: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            text: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            mutedText: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            primary: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            secondary: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            accent: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            codeBackground: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            canvasTreatment: { enum: ['solid', 'gradient', 'grid'] },
            gradient: {
              type: 'array',
              minItems: 2,
              maxItems: 2,
              items: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            },
            gridColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            videoLayout: {
              enum: [
                'information-circle',
                'information-tile',
                'portrait-overlay',
                'portrait-rail',
                'split',
                'person-background-left',
                'person-background-right',
                'person-only',
              ],
            },
            videoBorderStyle: { enum: ['none', 'solid', 'gradient'] },
            videoBorderWidth: { type: 'number', minimum: 0, maximum: 20 },
            videoBorderRadius: { type: 'number', minimum: 0, maximum: 100 },
            titleStyle: { enum: ['statement', 'split', 'lower-third', 'editorial', 'framed', 'gradient', 'outline', 'highlight', 'compact'] },
            contentStyle: { enum: ['editorial', 'card', 'columns', 'lede', 'callout', 'minimal', 'highlight', 'caption'] },
            listStyle: { enum: ['bullets', 'cards', 'timeline', 'steps', 'pills', 'checklist', 'number-grid', 'spotlight', 'columns', 'compact'] },
            codeStyle: { enum: ['panel', 'terminal', 'full', 'editor', 'glass', 'minimal', 'spotlight', 'split', 'paper'] },
            codeSyntaxTheme: { enum: ['light_vs', 'light_plus', 'quietlight', 'solarized_light', 'abyss', 'dark_vs', 'dark_plus', 'kimbie_dark', 'monokai', 'monokai_dimmed', 'red', 'solarized_dark', 'tomorrow_night_blue', 'hc_black'] },
            codeInternalAnimation: { enum: ['type-lines', 'highlight-lines'] },
            quoteStyle: { enum: ['bar', 'card', 'statement', 'pull', 'speech', 'highlight', 'framed', 'minimal', 'oversized'] },
            titleLayout: { enum: ['center', 'left', 'right', 'upper', 'lower', 'split-left', 'split-right', 'full'] },
            contentLayout: { enum: ['center', 'left', 'right', 'upper', 'lower', 'split-left', 'split-right', 'full'] },
            listLayout: { enum: ['center', 'left', 'right', 'upper', 'lower', 'split-left', 'split-right', 'full'] },
            codeLayout: { enum: ['center', 'left', 'right', 'upper', 'lower', 'split-left', 'split-right', 'full'] },
            quoteLayout: { enum: ['center', 'left', 'right', 'upper', 'lower', 'split-left', 'split-right', 'full'] },
            surfaceStyle: { enum: ['none', 'outline', 'card'] },
            blockBorderRadius: { type: 'number', minimum: 0, maximum: 80 },
            titleMotion: { enum: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop'] },
            contentMotion: { enum: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop'] },
            listMotion: { enum: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop', 'line-by-line'] },
            codeMotion: {
              enum: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop', 'line-by-line'],
            },
            quoteMotion: { enum: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop'] },
          },
        },
      },
    },
  }

  try {
    const apiResponse = await modelFetch('writing', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.OPENAI_THEME_MODEL || 'gpt-5.6-luna',
        input: `Create four visually distinct, production-ready video themes for Incredible Studio. The brand is ${name}; its supplied palette is primary ${brandColor}, secondary ${secondaryColor}, accent ${accentColor}; desired canvas treatment is ${treatment}; mood is ${body.mood || 'confident, human and technical'}. Preserve a coherent multi-color palette while varying tonal use. Maintain accessible text contrast. Treat every Markdown block as a composed system with independent layout, rendering style and motion. Choose intentionally different recipes for titles, body text, lists, code and quotes while keeping each theme coherent. For code, choose both an authentic VS Code syntax theme and an internal animation: type-lines constructs code progressively, while highlight-lines dims context and walks through focused lines. Motion semantics include quiet fades, directional slides, focus blur, masks, playful pops, type reveals, and line-by-line sequences. Video layout semantics: information-circle and information-tile keep content dominant; portrait-overlay and portrait-rail balance the person with content; split uses equal space; person-background-left/right put the real person full-frame with information overlaid on the named side; person-only is full camera. Avoid cosmetic variations of the same idea.`,
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'studio_theme_directions',
            strict: true,
            schema,
          },
        },
      }),
    })
    if (!apiResponse.ok) {
      throw new Error(`OpenAI theme generation failed (${apiResponse.status})`)
    }
    const apiBody = (await apiResponse.json()) as Parameters<
      typeof extractResponseText
    >[0]
    const parsed = JSON.parse(extractResponseText(apiBody)) as {
      themes: Array<Record<string, unknown>>
    }
    const themes = parsed.themes.map((item, index): StudioThemeV1 =>
      normalizeStudioTheme(
        {
          version: 1,
          id: `ai-${Date.now()}-${index}`,
          name: String(item.name || `${name} ${index + 1}`),
          description: String(item.description || 'AI-generated brand direction.'),
          source: 'generated',
          brand: {
            background: String(item.background),
            surface: String(item.surface),
            text: String(item.text),
            mutedText: String(item.mutedText),
            primary: String(item.primary),
            secondary: String(item.secondary),
            accent: String(item.accent),
            codeBackground: String(item.codeBackground),
          },
          logo: { url: '', placement: 'footer-left', size: 28 },
          canvas: {
            treatment: item.canvasTreatment as StudioThemeV1['canvas']['treatment'],
            gradient: item.gradient as [string, string],
            gridColor: String(item.gridColor),
          },
          video: {
            layout: item.videoLayout as StudioThemeV1['video']['layout'],
            borderStyle: item.videoBorderStyle as StudioThemeV1['video']['borderStyle'],
            borderWidth: Number(item.videoBorderWidth),
            borderRadius: Number(item.videoBorderRadius),
          },
          blocks: {
            title: item.titleStyle as StudioThemeV1['blocks']['title'],
            content: item.contentStyle as StudioThemeV1['blocks']['content'],
            list: item.listStyle as StudioThemeV1['blocks']['list'],
            code: item.codeStyle as StudioThemeV1['blocks']['code'],
            codeTheme: item.codeSyntaxTheme as StudioThemeV1['blocks']['codeTheme'],
            codeAnimation: item.codeInternalAnimation as StudioThemeV1['blocks']['codeAnimation'],
            quote: item.quoteStyle as StudioThemeV1['blocks']['quote'],
            surface: item.surfaceStyle as StudioThemeV1['blocks']['surface'],
            borderRadius: Number(item.blockBorderRadius),
            layout: {
              title: item.titleLayout as StudioThemeV1['blocks']['layout']['title'],
              content: item.contentLayout as StudioThemeV1['blocks']['layout']['content'],
              list: item.listLayout as StudioThemeV1['blocks']['layout']['list'],
              code: item.codeLayout as StudioThemeV1['blocks']['layout']['code'],
              quote: item.quoteLayout as StudioThemeV1['blocks']['layout']['quote'],
            },
          },
          motion: {
            title: item.titleMotion as StudioThemeV1['motion']['title'],
            content: item.contentMotion as StudioThemeV1['motion']['content'],
            list: item.listMotion as StudioThemeV1['motion']['list'],
            code: item.codeMotion as StudioThemeV1['motion']['code'],
            quote: item.quoteMotion as StudioThemeV1['motion']['quote'],
          },
        },
        fallback[index]?.brand,
      ),
    )
    json(response, 200, { themes, provider: 'openai' })
  } catch (error) {
    json(response, 200, {
      themes: fallback,
      provider: 'local-fallback',
      warning: error instanceof Error ? error.message : 'AI generation unavailable',
    })
  }
}

// ——— The appearance layer: an illustration per thing ———
// One asset per entity, generated in the page palette by the image model
// when the provider has one, else a palette glyph by entity type. The
// client binds it to the unit's box and keeps the record in the library.
const GLYPH_PATHS: Record<string, (accent: string) => string> = {
  server: accent => `<rect x="12" y="10" width="40" height="13" rx="3" fill="${accent}" fill-opacity=".16" stroke="${accent}" stroke-width="2.5"/><rect x="12" y="26" width="40" height="13" rx="3" fill="${accent}" fill-opacity=".16" stroke="${accent}" stroke-width="2.5"/><rect x="12" y="42" width="40" height="13" rx="3" fill="${accent}" fill-opacity=".16" stroke="${accent}" stroke-width="2.5"/><circle cx="19" cy="16.5" r="2" fill="${accent}"/><circle cx="19" cy="32.5" r="2" fill="${accent}"/><circle cx="19" cy="48.5" r="2" fill="${accent}"/>`,
  database: accent => `<ellipse cx="32" cy="16" rx="20" ry="7" fill="${accent}" fill-opacity=".2" stroke="${accent}" stroke-width="2.5"/><path d="M12 16v32c0 3.9 9 7 20 7s20-3.1 20-7V16" fill="${accent}" fill-opacity=".1" stroke="${accent}" stroke-width="2.5"/><path d="M12 32c0 3.9 9 7 20 7s20-3.1 20-7" fill="none" stroke="${accent}" stroke-width="2.5"/>`,
  queue: accent => `<rect x="6" y="22" width="52" height="20" rx="5" fill="none" stroke="${accent}" stroke-width="2.5"/><rect x="11" y="27" width="8" height="10" rx="2" fill="${accent}"/><rect x="22" y="27" width="8" height="10" rx="2" fill="${accent}" fill-opacity=".7"/><rect x="33" y="27" width="8" height="10" rx="2" fill="${accent}" fill-opacity=".45"/><path d="M46 32h7m-3-3 3 3-3 3" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  client: accent => `<rect x="10" y="12" width="44" height="30" rx="4" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-width="2.5"/><path d="M26 52h12M32 42v10" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="27" r="6" fill="none" stroke="${accent}" stroke-width="2.5"/>`,
  service: accent => `<path d="M32 6l22 13v26L32 58 10 45V19z" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="32" r="9" fill="none" stroke="${accent}" stroke-width="2.5"/><circle cx="32" cy="32" r="3" fill="${accent}"/>`,
  cache: accent => `<rect x="8" y="14" width="48" height="36" rx="7" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-width="2.5"/><path d="M18 32h8l4-7 6 14 4-7h6" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  thing: accent => `<rect x="10" y="10" width="44" height="44" rx="8" fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-width="2.5"/><path d="M20 33l8 8 16-18" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
}
const glyphFor = (type: string, accent: string) => {
  const draw = GLYPH_PATHS[type] || GLYPH_PATHS.thing
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">${draw(accent)}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
const handleIllustrate = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJson<{ projectId?: string; nodeId?: string; label?: string; type?: string; palette?: { accent?: string; background?: string }; prefer?: string }>(request, 32_000)
  const label = String(body.label || '').trim().slice(0, 80)
  const type = String(body.type || 'thing').trim().slice(0, 24) || 'thing'
  if (!label) throw new Error('Say what to illustrate')
  const accent = /^#[0-9a-f]{6}$/i.test(String(body.palette?.accent || '')) ? String(body.palette!.accent) : '#4ade80'
  const background = /^#[0-9a-f]{6}$/i.test(String(body.palette?.background || '')) ? String(body.palette!.background) : '#0b0f17'
  const prompt = `A single ${label} drawn as a ${type} icon for a technical explainer video. Flat, minimal, front-facing, centred, one object only. No text, no labels, no scene, no shadow. Transparent background. Lines and fills in ${accent} with soft neutral greys, clean blueprint style, consistent weight.`
  if (body.prefer !== 'glyph') {
    try {
      const generated = await imageGenerate({ prompt })
      if (generated) {
        const stored = await storeAsset({ body: generated.buffer, contentType: generated.contentType, projectId: body.projectId, blockId: body.nodeId, kind: 'illustration', extension: '.png' })
        json(response, 200, { kind: 'image', url: `${publicBaseUrl(request)}/objects/${stored.objectKey}`, assetId: stored.assetId, model: generated.model, prompt, width: 1024, height: 1024, palette: { accent, background } })
        return
      }
    } catch (error) {
      console.warn('[illustrate] image model failed, using a glyph', error instanceof Error ? error.message : error)
    }
  }
  json(response, 200, { kind: 'glyph', url: glyphFor(type, accent), prompt, width: 256, height: 256, palette: { accent, background } })
}

// ——— Phase 0 doors: a PDF or a deck, read into text ———
// The text is read into a narrative and goes through the same outline and
// page steps as a link. A PDF reads through poppler when it is installed,
// else pypdf; a deck (.pptx) reads its slide texts and notes in order.
const decodeXml = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const textFromPdf = async (path: string) => {
  try {
    return await runProcessOutput('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], 120_000)
  } catch {
    const script = "import sys\nfrom pypdf import PdfReader\nr = PdfReader(sys.argv[1])\nprint('\\f'.join((p.extract_text() or '') for p in r.pages))"
    return runProcessOutput('python3', ['-c', script, path], 120_000)
  }
}
const textFromDeck = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer)
  const slideNumber = (name: string) => Number(/slide(\d+)\.xml$/.exec(name)?.[1] || 0)
  const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => slideNumber(a) - slideNumber(b))
  const parts: string[] = []
  for (const name of slides) {
    const xml = await zip.file(name)!.async('string')
    const paragraphs = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
      .map(match => [...match[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(run => decodeXml(run[1])).join('').trim())
      .filter(Boolean)
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${slideNumber(name)}.xml`)
    const notes = notesFile ? [...(await notesFile.async('string')).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(run => decodeXml(run[1])).join(' ').replace(/\s+/g, ' ').trim() : ''
    if (!paragraphs.length && !notes) continue
    parts.push(`## ${paragraphs[0] || `Slide ${slideNumber(name)}`}\n${paragraphs.slice(1).join('\n')}${notes ? `\n\n${notes}` : ''}`)
  }
  return { text: parts.join('\n\n'), slides: slides.length }
}
const handleSourceFile = async (context: StudioWorkerContext, request: IncomingMessage, response: ServerResponse) => {
  const body = await readBody(request, 80 * 1024 * 1024)
  if (!body.length) throw new Error('The file is empty')
  const name = decodeURIComponent(String(request.headers['x-file-name'] || 'source'))
  const lower = name.toLowerCase()
  const title = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
  let text = ''
  let kind: 'pdf' | 'deck' | 'text' = 'text'
  let pages = 0
  if (lower.endsWith('.pdf')) {
    const directory = join(context.jobsDirectory, `source-${randomUUID()}`)
    await mkdir(directory, { recursive: true })
    const path = join(directory, 'source.pdf')
    await writeFile(path, body)
    try {
      text = await textFromPdf(path)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
    kind = 'pdf'
    pages = (text.match(/\f/g) || []).length + 1
  } else if (lower.endsWith('.pptx')) {
    const deck = await textFromDeck(body)
    text = deck.text
    pages = deck.slides
    kind = 'deck'
  } else if (/\.(md|markdown|txt)$/.test(lower)) {
    text = body.toString('utf8')
  } else {
    throw new Error('Give a PDF, a PowerPoint (.pptx) or a text file — Keynote and Google Slides export to .pptx')
  }
  text = text.replace(/\r/g, '').replace(/\f/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length < 80) throw new Error(`Nothing readable in ${name} — a scanned PDF has no text layer`)
  json(response, 200, { title, kind, pages, characters: text.length, text: text.slice(0, 60_000) })
}

// ——— Fonts shipped with a render ———
// The pages name the site's faces. Google Fonts serves many of them; the
// rest get a substitute of the same class that also answers to the
// original name, so the SVGs render with a real face rather than the
// host's fallback. Files are cached under assets/fonts and copied into the
// job so the render stays hermetic.
const FONT_SUBSTITUTES: Array<[RegExp, string]> = [
  [/mono|consolas|menlo|courier|code|fira/i, 'JetBrains Mono'],
  [/serif|georgia|times|garamond|charter|tiempos|freight/i, 'Source Serif 4'],
  [/./, 'Inter'],
]
const fontFamiliesIn = (project: ProjectDocumentV1) => {
  const families = new Set<string>(['Inter'])
  project.notebook.content.forEach(node => {
    const svg = typeof node.attrs?.svg === 'string' ? node.attrs.svg : ''
    for (const match of svg.matchAll(/font-family="([^"]+)"/g)) {
      const first = match[1].split(',')[0].replace(/["']/g, '').trim()
      if (first && !/^(serif|sans-serif|monospace|system-ui|inherit)$/i.test(first)) families.add(first)
    }
  })
  return [...families]
}
const googleFontCss = async (family: string) => {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=block`
  const answer = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }, signal: AbortSignal.timeout(8_000) })
  return answer.ok ? answer.text() : null
}
const shipFonts = async (context: StudioWorkerContext, families: string[], mediaDirectory: string) => {
  const cacheDirectory = join(context.assetsDirectory, 'fonts')
  await mkdir(cacheDirectory, { recursive: true })
  const fontsDirectory = join(mediaDirectory, 'fonts')
  const css: string[] = []
  const shipped: string[] = []
  const substituted: Record<string, string> = {}
  // One file that will not download must not cost the others: every fetch
  // fails on its own, and a face that cannot be shipped is skipped.
  const fetchFile = async (url: string): Promise<[string, string]> => {
    const name = `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.woff2`
    const cached = join(cacheDirectory, name)
    try {
      try {
        await access(cached)
      } catch {
        const answer = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        if (!answer.ok) return [url, url]
        await writeFile(cached, Buffer.from(await answer.arrayBuffer()))
      }
      await mkdir(fontsDirectory, { recursive: true })
      await copyFile(cached, join(fontsDirectory, name))
      return [url, `./media/fonts/${name}`]
    } catch {
      return [url, url]
    }
  }
  for (const family of families) {
    try {
      let text = await googleFontCss(family).catch(() => null)
      let served = family
      if (!text) {
        served = FONT_SUBSTITUTES.find(([pattern]) => pattern.test(family))![1]
        if (served !== family) substituted[family] = served
        text = shipped.includes(served) ? '' : await googleFontCss(served).catch(() => null)
        if (text === null) continue
      }
      const urls = [...new Set([...text.matchAll(/url\((https:[^)]+)\)/g)].map(match => match[1]))]
      const mapping = new Map<string, string>()
      for (const url of urls) {
        const [from, to] = await fetchFile(url)
        mapping.set(from, to)
      }
      let local = text.replace(/url\((https:[^)]+)\)/g, (whole, url: string) => `url(${mapping.get(url) || url})`)
      if (served !== family && local) local = `${local}\n${local.replace(new RegExp(`font-family: '${served.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'), `font-family: '${family}'`)}`
      if (local) css.push(local)
      if (!shipped.includes(served)) shipped.push(served)
    } catch (error) {
      console.warn('[render] font not shipped', family, error instanceof Error ? error.message : error)
    }
  }
  return { css: css.join('\n'), shipped, substituted }
}

const handleAssetUpload = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readBody(request, 120 * 1024 * 1024)
  if (!body.length) throw new Error('Uploaded asset is empty')
  const contentType = String(request.headers['content-type'] || 'application/octet-stream')
  const extension = extensionForContentType(contentType)
  const projectId = String(request.headers['x-project-id'] || '') || undefined
  const blockId = String(request.headers['x-block-id'] || '') || undefined
  const stored = await storeAsset({
    body,
    contentType,
    projectId,
    blockId,
    kind: 'notebook-asset',
    extension,
  })
  json(response, 201, {
    url: `${publicBaseUrl(request)}/objects/${stored.objectKey}`,
    assetId: stored.assetId,
  })
}

const handleDirectedRecording = async (
  context: StudioWorkerContext,
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readBody(request, 600 * 1024 * 1024)
  if (!body.length) throw new Error('Recorded canvas take is empty')
  const id = randomUUID()
  const jobDirectory = join(context.jobsDirectory, `recording-${id}`)
  const inputExtension = extensionForContentType(
    String(request.headers['content-type'] || 'video/webm'),
  )
  const inputPath = join(jobDirectory, `take${inputExtension}`)
  const outputPath = join(context.outputsDirectory, `${id}.mp4`)
  await mkdir(jobDirectory, { recursive: true })
  await writeFile(inputPath, body)
  try {
    // A take captured without a microphone has no audio track. The composition
    // authors an audio element for every take, and the producer rejects audio
    // sources without an audio stream — so pad silent takes with silence.
    const hasAudio = await mediaHasAudioStream(inputPath)
    const silentAudioInputArguments = hasAudio
      ? []
      : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']
    await runProcess(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        ...silentAudioInputArguments,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        ...(hasAudio ? [] : ['-shortest']),
        '-movflags',
        '+faststart',
        outputPath,
      ],
      300_000,
    )
  } finally {
    await rm(jobDirectory, { recursive: true, force: true })
  }
  const projectId = String(request.headers['x-project-id'] || '')
  const blockId = String(request.headers['x-block-id'] || '')
  if (!projectId || !blockId) throw new Error('Recording requires a project and block ID')
  let mediaUrl = ''
  let assetId = ''
  try {
    const stored = await storeAsset({
      body: await readFile(outputPath),
      contentType: 'video/mp4',
      projectId,
      blockId,
      kind: 'directed-block-recording',
      extension: '.mp4',
    })
    assetId = stored.assetId
    mediaUrl = `${publicBaseUrl(request)}/objects/${stored.objectKey}`
  } finally {
    await rm(outputPath, { force: true })
  }
  json(response, 201, {
    url: mediaUrl,
    draft: {
      assetId,
      blockId,
      durationMs: Math.max(1, Number(request.headers['x-duration-ms']) || 1),
    },
  })
}

const handleCommitDirectedRecording = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readJson<{
    projectId?: string
    blockId?: string
    assetId?: string
    mediaUrl?: string
    durationMs?: number
    role?: string
    keepsPlan?: boolean
    cameraUrl?: string
    cameraAssetId?: string
    beatMarksMs?: number[]
    script?: { hash?: unknown; lines?: unknown; treatment?: unknown; revision?: unknown }
    pickup?: boolean
  }>(request, 64_000)
  if (!body.projectId || !body.blockId || !body.assetId || !body.mediaUrl) {
    throw new Error('The recorded block is incomplete')
  }
  const beatMarksMs = Array.isArray(body.beatMarksMs)
    ? body.beatMarksMs.map(Number).filter(ms => Number.isFinite(ms) && ms >= 0).slice(0, 400)
    : []
  // The script the take was spoken against, kept with the take (R4).
  const script = body.script && typeof body.script.hash === 'string' && /^[0-9a-f]{1,64}$/.test(body.script.hash)
    ? {
        hash: body.script.hash,
        ...(Array.isArray(body.script.lines) && body.script.lines.length <= 400 && body.script.lines.every(line => typeof line === 'string' && /^[0-9a-f]{8}$/.test(line)) ? { lines: body.script.lines as string[] } : {}),
        ...(typeof body.script.treatment === 'string' && body.script.treatment.length <= 200 ? { treatment: body.script.treatment } : {}),
        ...(Number.isInteger(body.script.revision) && Number(body.script.revision) > 0 ? { revision: Number(body.script.revision) } : {}),
      }
    : undefined
  // A pickup of some lines joins the archive; the selected take stays.
  if (body.pickup === true) {
    if (!script?.lines?.length) throw new Error('A pickup names the lines it was spoken against')
    const recording = await savePickupTake({ projectId: body.projectId, blockId: body.blockId, assetId: body.assetId, mediaUrl: body.mediaUrl, durationMs: Math.min(3_600_000, Math.max(1, Number(body.durationMs) || 1)), script })
    json(response, 201, { recording, project: await loadProjectArtifact(body.projectId) })
    return
  }
  const recording = await saveRecordedBlock({
    projectId: body.projectId,
    blockId: body.blockId,
    assetId: body.assetId,
    mediaUrl: body.mediaUrl,
  durationMs: Math.min(3_600_000, Math.max(1, Number(body.durationMs) || 1)),
    // A camera-dialog take is raw presenter footage; anything else is a
    // composed scene recording that may replace the scene at compile.
    ...(body.role === 'presenter' ? { role: 'presenter' as const } : {}),
    ...(body.keepsPlan && beatMarksMs.length
      ? {
          keepsPlan: true,
          beatMarksMs,
          ...(body.cameraUrl && body.cameraAssetId ? { cameraUrl: String(body.cameraUrl), cameraAssetId: String(body.cameraAssetId) } : {}),
        }
      : {}),
    ...(script ? { script } : {}),
  })
  json(response, 201, { recording, project: await loadProjectArtifact(body.projectId) })
}

const handlePreview = async (
  context: StudioWorkerContext,
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const payload = await readJson<
    | ProjectDocumentV1
    | {
        project: ProjectDocumentV1
        previewPresenter?: { imageUrl: string; name?: string }
        includeEmptyNodeId?: string
        contentViewNodeId?: string
      }
  >(request, 3 * 1024 * 1024)
  const project = 'project' in payload ? payload.project : payload
  const composition = compileProject(project, {
    gsapUrl: '/runtime/gsap.min.js',
    hyperframesRuntimeUrl: '/runtime/hyperframes.iife.js',
    previewPresenter: 'project' in payload ? payload.previewPresenter : undefined,
    includeEmptyNodeId: 'project' in payload ? payload.includeEmptyNodeId : undefined,
    contentViewNodeId: 'project' in payload ? payload.contentViewNodeId : undefined,
  })
  const id = createHash('sha256')
    .update(composition.html)
    .digest('hex')
    .slice(0, 20)
  await writeFile(join(context.previewsDirectory, `${id}.html`), composition.html, 'utf8')
  json(response, 200, {
    url: `/previews/${id}.html`,
    durationSeconds: composition.durationSeconds,
  })
}

const handleRender = async (context: StudioWorkerContext, request: IncomingMessage, response: ServerResponse) => {
  const project = await readJson<ProjectDocumentV1>(request, 3 * 1024 * 1024)
  json(response, 200, await renderProjectArtifact(context, project, publicBaseUrl(request)))
}
const renderProjectArtifact = async (context: StudioWorkerContext, project: ProjectDocumentV1, baseUrl: string, signal?: AbortSignal, report?: ExportReport) => {
  report?.({ stage: 'preparing', percent: 0 })
  const renderProject = structuredClone(project)
  type StagedRenderAsset = {
    localPath?: string
    objectKey?: string
    transcode: boolean
  }
  const stagedRenderAssets = new Map<string, StagedRenderAsset>()
  // The producer only localizes HTTPS media and cannot extract frames from
  // plain-HTTP local URLs, so every local asset must be staged as a relative
  // file inside the render job directory. MediaRecorder WebMs additionally
  // lack the duration/cue metadata frame extraction needs, so staged .webm
  // captures are converted to MP4.
  const stagedAssetName = (sourceName: string, key: string) => {
    const extension = extname(sourceName).toLowerCase()
    const transcode = extension === '.webm'
    const name = `${createHash('sha256').update(key).digest('hex').slice(0, 20)}${
      transcode ? '.mp4' : extension
    }`
    return { name, transcode }
  }
  const localAssetPath = (value: string | undefined) => {
    if (!value) return value
    try {
      const url = new URL(value)
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return value
      if (url.pathname.startsWith('/objects/')) {
        const objectKey = decodeURIComponent(
          url.pathname.slice('/objects/'.length),
        )
        if (!objectKey) return value
        const { name, transcode } = stagedAssetName(objectKey, objectKey)
        stagedRenderAssets.set(name, { objectKey, transcode })
        return `media/${name}`
      }
      if (!url.pathname.startsWith('/assets/')) return value
      const assetName = url.pathname.slice('/assets/'.length)
      if (!assetName || assetName !== basename(assetName)) return value
      const { name, transcode } = stagedAssetName(assetName, assetName)
      stagedRenderAssets.set(name, {
        localPath: join(context.assetsDirectory, assetName),
        transcode,
      })
      return `media/${name}`
    } catch {
      return value
    }
  }
  Object.values(renderProject.presenterTracks).forEach(tracks => {
    tracks.forEach(track => {
      if (track.kind === 'human-camera') {
        track.videoUrl = localAssetPath(track.videoUrl) || track.videoUrl
      }
      track.audioUrl = localAssetPath(track.audioUrl) || track.audioUrl
    })
  })
  Object.values(renderProject.recordedBlocks || {}).forEach(recording => {
    recording.videoUrl = localAssetPath(recording.videoUrl) || recording.videoUrl
    if (recording.cameraUrl) recording.cameraUrl = localAssetPath(recording.cameraUrl) || recording.cameraUrl
  })
  // A produced scene's render (P4) is staged like a take: the same bytes.
  Object.values(renderProject.producedScenes || {}).forEach(produced => {
    produced.videoUrl = localAssetPath(produced.videoUrl) || produced.videoUrl
  })
  const stageNotebookMedia = (node: TiptapNode) => {
    if (
      (node.type === 'image' || node.type === 'screenRecording') &&
      typeof node.attrs?.src === 'string'
    ) {
      node.attrs.src = localAssetPath(node.attrs.src) || node.attrs.src
    }
    // Appearance images inside a page's SVG (the asset library's
    // illustrations) are staged like any other local media.
    if ((node.type === 'scene' || node.type === 'slide') && typeof node.attrs?.svg === 'string' && node.attrs.svg.includes('/objects/')) {
      node.attrs.svg = node.attrs.svg.replace(/(<image\b[^>]*\bhref=")([^"]+)(")/g, (whole: string, open: string, href: string, close: string) => {
        const staged = localAssetPath(href)
        return staged && staged !== href ? `${open}${staged}${close}` : whole
      })
    }
    node.content?.forEach(stageNotebookMedia)
  }
  renderProject.notebook.content.forEach(stageNotebookMedia)
  const composition = compileProject(renderProject, {
    gsapUrl: './runtime/gsap.min.js',
    hyperframesRuntimeUrl: './runtime/hyperframes.iife.js',
  })
  if (composition.durationSeconds > 30 * 60) {
    throw new Error('Local renders are limited to thirty minutes')
  }

  const id = randomUUID()
  const jobDirectory = join(context.jobsDirectory, id)
  const runtimeDirectory = join(jobDirectory, 'runtime')
  const inputPath = join(jobDirectory, 'index.html')
  const outputPath = join(context.outputsDirectory, `${id}.mp4`)
  await mkdir(jobDirectory, { recursive: true })
  await mkdir(runtimeDirectory, { recursive: true })
  if (stagedRenderAssets.size) {
    const mediaDirectory = join(jobDirectory, 'media')
    await mkdir(mediaDirectory, { recursive: true })
    await Promise.all(
      [...stagedRenderAssets].map(async ([assetName, staged]) => {
        const targetPath = join(mediaDirectory, assetName)
        let sourcePath = staged.localPath
        if (!sourcePath && staged.objectKey) {
          sourcePath = staged.transcode ? `${targetPath}.download` : targetPath
          const { stream } = await getObject(staged.objectKey)
          const chunks: Buffer[] = []
          for await (const chunk of stream) {
            chunks.push(chunk as Buffer)
          }
          await writeFile(sourcePath, Buffer.concat(chunks))
        }
        if (!sourcePath) return
        if (!staged.transcode) {
          if (sourcePath !== targetPath) await copyFile(sourcePath, targetPath)
          return
        }
        try {
          await runProcess(
            'ffmpeg',
            [
              '-y',
              '-i',
              sourcePath,
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-crf',
              '20',
              '-pix_fmt',
              'yuv420p',
              '-c:a',
              'aac',
              '-b:a',
              '160k',
              '-movflags',
              '+faststart',
              targetPath,
            ],
            300_000,
          )
        } finally {
          if (sourcePath.endsWith('.download')) {
            await rm(sourcePath, { force: true })
          }
        }
      }),
    )
  }
  // The faces the pages name travel with the job (or a substitute of the
  // same class that answers to the same name).
  const fonts = await shipFonts(context, fontFamiliesIn(renderProject), join(jobDirectory, 'media')).catch(error => {
    console.warn('[render] fonts not shipped', error instanceof Error ? error.message : error)
    return { css: '', shipped: [] as string[], substituted: {} as Record<string, string> }
  })
  const html = fonts.css ? composition.html.replace('</head>', `<style data-shipped-fonts>\n${fonts.css}\n</style>\n</head>`) : composition.html
  await writeFile(inputPath, html, 'utf8')
  await copyFile(gsapRuntimePath, join(runtimeDirectory, 'gsap.min.js'))
  await copyFile(
    hyperframesRuntimePath,
    join(runtimeDirectory, 'hyperframes.iife.js'),
  )

  try {
    const job = createRenderJob({
      fps: project.fps,
      quality: 'standard',
      workers: 1,
      entryFile: 'index.html',
      outputResolution: 'landscape',
    })
    try {
      report?.({ stage: 'rendering', percent: 0 })
      // The renderer's own progress, kept with the export job (F8).
      await executeRenderJob(job, jobDirectory, outputPath, progress => report?.({ stage: progress.currentStage || 'rendering', percent: progress.progress || 0, ...(progress.totalFrames ? { frame: progress.framesRendered || 0, frames: progress.totalFrames } : {}) }), signal)
    } catch (error) {
      const warningDetails = job.warnings
        .map(warning => warning.message)
        .filter(Boolean)
        .join('; ')
      if (warningDetails) throw new Error(warningDetails)
      throw error
    }
  } finally {
    await rm(jobDirectory, { recursive: true, force: true })
  }

  // The file is what the creator gets: its length is measured, and a video
  // longer or shorter than its scenes by more than a frame is not called
  // ready — longer is a blank tail (BoltDB review B10), shorter a cut end.
  const renderedSeconds = await probeSeconds(outputPath).catch(() => null)
  if (renderedSeconds !== null && Math.abs(renderedSeconds - composition.durationSeconds) > 1 / (renderProject.fps || 30) + 0.05) {
    throw new Error(`The rendered video lasts ${renderedSeconds.toFixed(2)} s but its scenes last ${composition.durationSeconds.toFixed(2)} s, so it was not kept: it would ${renderedSeconds > composition.durationSeconds ? 'end on a blank tail' : 'cut its ending'}. Export again; if it recurs, it is a bug.`)
  }
  report?.({ stage: 'storing', percent: 100 })
  // An export is a durable artifact, not just a file in an outputs folder:
  // register the MP4 in the object store with its own asset row (D0a).
  let exportAsset: { assetId: string; objectKey: string } | null = null
  try {
    exportAsset = await storeAsset({
      body: await readFile(outputPath),
      contentType: 'video/mp4',
      projectId: project.id,
      kind: 'export',
      extension: '.mp4',
    })
  } catch (error) {
    console.warn('[render] export could not be stored durably', error instanceof Error ? error.message : error)
  }

  return {
    url: exportAsset ? `${baseUrl}/objects/${exportAsset.objectKey}` : `${baseUrl}/outputs/${id}.mp4`,
    // What the file measures, not what the composition declared.
    durationSeconds: renderedSeconds ?? composition.durationSeconds,
    fonts: { shipped: fonts.shipped, substituted: fonts.substituted },
    exportAsset,
  }
}

const safeStaticPath = (root: string, pathname: string) => {
  const resolved = resolve(root, `.${normalize(pathname)}`)
  return resolved.startsWith(resolve(root)) ? resolved : null
}

const handleStaticApp = async (
  context: StudioWorkerContext,
  pathname: string,
  response: ServerResponse,
) => {
  if (!context.serveDist) return false
  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = safeStaticPath(context.distDirectory, requestedPath)
  if (filePath) {
    try {
      const metadata = await stat(filePath)
      if (metadata.isFile()) {
        await serveFile(response, filePath)
        return true
      }
    } catch {
      // SPA fallback below.
    }
  }
  await serveFile(response, join(context.distDirectory, 'index.html'))
  return true
}

export const createStudioHandler = (options: StudioHandlerOptions = {}) => {
  if (options.persistence) process.env.STUDIO_PERSISTENCE = options.persistence
  if (options.dataDir) process.env.STUDIO_DATA_DIR = options.dataDir
  const dataDirectory =
    options.dataDir ||
    fileURLToPath(new URL('../../../.studio-data/', import.meta.url))
  const context: StudioWorkerContext = {
    assetsDirectory: join(dataDirectory, 'assets'),
    outputsDirectory:
      options.outputsDir ||
      process.env.STUDIO_OUTPUTS_DIR ||
      join(dataDirectory, 'outputs'),
    jobsDirectory: join(dataDirectory, 'jobs'),
    previewsDirectory: join(dataDirectory, 'previews'),
    serveDist: options.serveDist ?? process.argv.includes('--serve-dist'),
    distDirectory:
      options.distDir || fileURLToPath(new URL('../dist/', import.meta.url)),
  }
  const directoriesReady = Promise.all([
    mkdir(context.assetsDirectory, { recursive: true }),
    mkdir(context.outputsDirectory, { recursive: true }),
    mkdir(context.jobsDirectory, { recursive: true }),
    mkdir(context.previewsDirectory, { recursive: true }),
  ])

  // Design runs' pages land on their notebooks here, whether or not any
  // notebook window is open (BoltDB review B06): swept every few seconds
  // while a notebook waits for one, and on request.
  const pageLanding: LandingDeps | null = options.pageCheck
    ? {
        load: loadProjectArtifact,
        save: (project, expected) => saveProjectArtifact(project, { expectedProject: expected }),
        run: async runId => (await listBuildRuns()).find(row => row.id === runId) || null,
        pages: runPagesIn,
        check: options.pageCheck,
      }
    : null
  if (pageLanding) {
    let sweeping = false
    const sweep = async () => {
      if (sweeping) return
      sweeping = true
      try {
        for (const notebookId of await listProjectIdsAwaitingPages()) {
          const landed = await landPagesOnce(notebookId, pageLanding)
          if (landed.saved) console.log(`[pages] ${notebookId}: ${landed.landed.length} landed, ${landed.kept.length} kept their change, ${landed.stayed.length} stayed schematic, ${landed.waiting} waiting`)
        }
      } catch (error) {
        console.warn('[pages] a landing pass failed', error instanceof Error ? error.message : error)
      } finally {
        sweeping = false
      }
    }
    const timer = setInterval(() => void sweep(), 4000)
    timer.unref?.()
    void directoriesReady.then(() => sweep())
  }
  // Wireframes still being made in the background are seen through, a pass
  // every few seconds, whichever notebook is open (the four-notebook model).
  {
    let building = false
    const buildPass = async () => {
      if (building) return
      building = true
      try {
        for (const notebookId of await listProjectIdsAwaitingWireframes()) {
          const built = await buildWireframeOnce(notebookId, wireframeDeps)
          if (built.state === 'built' || built.state === 'failed') console.log(`[wireframe] ${notebookId}: ${built.state}${built.pages ? `, ${built.pages} pages` : ''}${built.reason ? ` — ${built.reason}` : ''}`)
        }
      } catch (error) {
        console.warn('[wireframe] a build pass failed', error instanceof Error ? error.message : error)
      } finally {
        building = false
      }
    }
    const buildTimer = setInterval(() => void buildPass(), 3000)
    buildTimer.unref?.()
    void directoriesReady.then(() => buildPass())
  }

  return async (request: IncomingMessage, response: ServerResponse) => {
  await directoriesReady
  setCors(request, response)
  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host}`)
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      let persistence: Awaited<ReturnType<typeof persistenceHealth>> | null = null
      try {
        persistence = await persistenceHealth()
      } catch {
        // The editor remains usable while local infrastructure is starting.
      }
      json(response, 200, {
        renderer: true,
        systemVoice:
          process.platform === 'darwin' && (await commandExists('/usr/bin/say')),
        fishAudio: Boolean(process.env.FISH_AUDIO_API_KEY),
        themeAI: await hasModelAccess().catch(() => false),
        persistence,
      })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/settings/models') {
      json(response, 200, { settings: await publicModelSettings(), presets: MODEL_PRESETS })
      return
    }
    // The creator's local harness and model, per stage, durably.
    if (request.method === 'GET' && url.pathname === '/api/settings/harness') {
      json(response, 200, { preferences: await loadHarnessPreferences(), stages: HARNESS_STAGES })
      return
    }
    if (request.method === 'PUT' && url.pathname === '/api/settings/harness') {
      const patch = await readJson<{ default?: unknown; stages?: Record<string, unknown> }>(request, 16 * 1024)
      try {
        json(response, 200, { preferences: await saveHarnessPreferences(patch || {}) })
      } catch (error) {
        if (!(error instanceof HarnessPreferenceError)) throw error
        json(response, 400, { error: error.message })
      }
      return
    }
    // Each harness's last provider status: its newest finished run, with the
    // failure (category, message, recovery) when that run failed.
    if (request.method === 'GET' && url.pathname === '/api/harness/status') {
      const status: Record<string, unknown> = {}
      for (const run of await listBuildRuns()) {
        if (!run.finishedAt || status[run.adapter]) continue
        status[run.adapter] = {
          state: run.status === 'error' ? 'error' : 'ok',
          runId: run.id,
          skill: run.skill,
          model: run.reportedModel || run.model,
          at: run.finishedAt,
          ...(run.failure ? { failure: run.failure } : {}),
        }
      }
      json(response, 200, { status })
      return
    }
    if (request.method === 'PUT' && url.pathname === '/api/settings/models') {
      const patch = await readJson<Partial<ModelSettingsV1>>(request, 64 * 1024)
      await saveModelSettings(patch)
      json(response, 200, { settings: await publicModelSettings() })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/settings/models/test') {
      const override = await readJson<Partial<ModelSettingsV1>>(request, 64 * 1024)
      const models = await listModels(override)
      json(response, 200, { ok: true, models: models.slice(0, 400) })
      return
    }
    // A secrets-free diagnostic bundle (D7): store health, counts, provider
    // availability flags, budget usage, and recent runs with their stage
    // outcomes. No credentials, no absolute user paths beyond what the app
    // itself prints.
    if (request.method === 'GET' && url.pathname === '/api/diagnostics') {
      const persistence = await persistenceHealth().catch(() => null)
      const [notebooks, themes, runs, budgets] = await Promise.all([
        listProjectArtifacts().catch(() => [] as Awaited<ReturnType<typeof listProjectArtifacts>>),
        listThemeLibrary().catch(() => [] as Awaited<ReturnType<typeof listThemeLibrary>>),
        listBuildRuns().catch(() => [] as Awaited<ReturnType<typeof listBuildRuns>>),
        settingsWithPrefix('appearance-budget:').catch(() => ({} as Record<string, unknown>)),
      ])
      const recent = runs.slice(0, 10)
      const withStages = await Promise.all(recent.map(async run => ({
        ...run,
        stages: await listBuildStages(String(run.id)).catch(() => [] as Array<Record<string, unknown>>),
      })))
      json(response, 200, {
        at: new Date().toISOString(),
        persistence,
        counts: {
          notebooks: notebooks.length,
          themes: themes.length,
          runs: runs.length,
          artworkCallsSpent: Object.values(budgets).reduce((sum: number, value) => sum + (Number(value) || 0), 0),
        },
        providers: {
          quiver: await quiverCapability().catch(() => ({ configured: false })),
          fishAudio: Boolean(process.env.FISH_AUDIO_API_KEY),
          themeAI: await hasModelAccess().catch(() => false),
        },
        // §8: which skills produced the evidence — name, version, fingerprint.
        skills: await skillVersions().catch(() => [] as Awaited<ReturnType<typeof skillVersions>>),
        runs: withStages,
      })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/projects') {
      json(response, 200, { projects: await listProjectArtifacts() })
      return
    }
    // Legacy file-store import (D0a): inspect what the file backend holds,
    // or import it into PostgreSQL + MinIO. Meaningful only when the durable
    // backend is the active one.
    if (url.pathname === '/api/migrate/local') {
      if (process.env.STUDIO_PERSISTENCE === 'local') {
        json(response, 400, { error: 'This server is running on the explicit file store; there is nothing to import into PostgreSQL from here.' })
        return
      }
      const legacy = await import('./persistence-pg')
      if (request.method === 'GET') {
        json(response, 200, { local: await legacy.inspectLocalStore() })
        return
      }
      if (request.method === 'POST') {
        json(response, 200, { report: await legacy.importLocalStore() })
        return
      }
    }
    // Theme library (D1): durable, revisioned, port-independent.
    if (request.method === 'GET' && url.pathname === '/api/themes') {
      json(response, 200, { themes: await listThemeLibrary() })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/themes') {
      const body = await readJson<{ theme?: unknown; site?: string }>(request, 512 * 1024)
      const input = body.theme as { id?: unknown; name?: unknown } | undefined
      if (!input || typeof input.id !== 'string' || !input.id || typeof input.name !== 'string') {
        json(response, 400, { error: 'A theme needs an id and a name' })
        return
      }
      // Normalize before hashing: what is stored is the resolved contract.
      const theme = normalizeStudioTheme(body.theme as Parameters<typeof normalizeStudioTheme>[0])
      const saved = await saveThemeRevision({ id: theme.id, name: theme.name, source: theme.source, theme, site: body.site })
      json(response, 200, { saved: { ...saved, theme } })
      return
    }
    if (request.method === 'DELETE' && /^\/api\/themes\/[^/]+$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split('/')[3])
      json(response, 200, { deleted: await deleteTheme(id) })
      return
    }
    // Immutable source revisions (D1): read back exactly what a run consumed
    // — { revision }, its article under content (storedArticleOf reads it).
    if (request.method === 'GET' && /^\/api\/source\/revisions\/[^/]+$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split('/')[4])
      const revision = await loadSourceRevision(id)
      if (!revision) {
        json(response, 404, { error: 'Unknown source revision' })
        return
      }
      json(response, 200, { revision })
      return
    }
    // Explanation model (D2): the outline becomes claims, objects and
    // relations with stable ids, persisted as its own immutable record.
    if (request.method === 'POST' && url.pathname === '/api/story/model') {
      const body = await readJson<{ outline?: unknown; projectId?: string; sourceRevisionId?: string; narrativeRevisionId?: string }>(request, 512 * 1024)
      const outline = sanitizeOutline(body.outline, 'Untitled')
      if (!outline.scenes.length) throw new Error('The outline has no scenes to model')
      const model = buildExplanationModel(outline)
      const saved = await saveExplanationModel({
        projectId: body.projectId,
        sourceRevision: body.sourceRevisionId,
        narrativeRevision: body.narrativeRevisionId,
        model,
      })
      json(response, 200, { model: { id: saved.id, hash: saved.hash, ...model }, outline })
      return
    }
    // A notebook's designed pages, landed now (B06): the notebook window asks
    // while its pages are designed, and gets the notebook as stored.
    if (request.method === 'POST' && url.pathname === '/api/pages/land') {
      const body = await readJson<{ notebook?: string }>(request, 16 * 1024)
      if (!pageLanding) {
        json(response, 501, { error: 'Designed pages land in the desktop app' })
        return
      }
      if (!body?.notebook) {
        json(response, 400, { error: 'Which notebook?' })
        return
      }
      const landed = await landPagesOnce(body.notebook, pageLanding)
      json(response, 200, { landed, project: await loadProjectArtifact(body.notebook) })
      return
    }
    // Durable build-run history and per-stage checkpoints (D3).
    // Planning (M0): the video's Explanation Brief and scene plans.
    if (await handlePlanningRoute(request, response, url)) return
    if (request.method === 'POST' && url.pathname === '/api/runs') {
      const run = await readJson<BuildRunInput>(request, 256 * 1024)
      if (!run?.id || !run.skill) {
        json(response, 400, { error: 'A run needs an id and a skill' })
        return
      }
      await saveBuildRun(run)
      json(response, 200, { saved: true })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/runs') {
      json(response, 200, { runs: await listBuildRuns(url.searchParams.get('projectId') || undefined) })
      return
    }
    if (request.method === 'POST' && /^\/api\/runs\/[^/]+\/stages$/.test(url.pathname)) {
      const runId = decodeURIComponent(url.pathname.split('/')[3])
      const stage = await readJson<{ stage?: string; subject?: string; status?: string; fingerprint?: string; detail?: unknown }>(request, 256 * 1024)
      if (!stage?.stage || !stage.status) {
        json(response, 400, { error: 'A stage checkpoint needs a stage and a status' })
        return
      }
      await recordBuildStage({ runId, stage: stage.stage, subject: typeof stage.subject === 'string' ? stage.subject : undefined, status: stage.status, fingerprint: stage.fingerprint, detail: stage.detail })
      json(response, 200, { saved: true })
      return
    }
    if (request.method === 'GET' && /^\/api\/runs\/[^/]+\/stages$/.test(url.pathname)) {
      const runId = decodeURIComponent(url.pathname.split('/')[3])
      json(response, 200, { stages: await listBuildStages(runId) })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/projects/latest') {
      json(response, 200, { project: await loadLatestProjectArtifact() })
      return
    }
    if (request.method === 'GET' && /^\/api\/projects\/[^/]+\/captions\.(vtt|srt)$/.test(url.pathname)) {
      const [, projectId, format] = url.pathname.match(/^\/api\/projects\/([^/]+)\/captions\.(vtt|srt)$/) as RegExpMatchArray
      const stored = await loadProjectArtifact(decodeURIComponent(projectId))
      if (!stored) throw new Error('Notebook not found')
      // An export of some of its blocks has the captions of those blocks.
      const blocks = url.searchParams.get('blocks')
      const chosen = blocks ? new Set(blocks.split(',')) : null
      const cues = captionCuesForProject(chosen ? { ...stored, notebook: { ...stored.notebook, content: stored.notebook.content.filter(node => typeof node.attrs?.id !== 'string' || chosen.has(node.attrs.id)) } } : stored)
      const body = format === 'vtt' ? formatWebVtt(cues) : formatSrt(cues)
      response.writeHead(200, { 'content-type': format === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8', 'content-disposition': `attachment; filename="${String(stored.title || 'captions').replace(/[^\w.-]+/g, '-').slice(0, 60)}.${format}"`, 'x-caption-count': String(cues.length) })
      response.end(body)
      return
    }
    // ——— Object artwork ———
    // What the artwork provider can do for this installation. Reported, not
    // assumed: an absent key is a plain answer, not an error.
    if (request.method === 'GET' && url.pathname === '/api/appearance/provider') {
      json(response, 200, await quiverCapability())
      return
    }
    // The briefs this scene's objects are drawn from.
    if (request.method === 'GET' && url.pathname === '/api/appearance/briefs') {
      const objects = knownObjects()
      json(response, 200, {
        style: REFERENCE_STYLE,
        briefs: objects.map(brief => ({ entity: brief.entity, role: brief.role, key: briefKey(brief), parts: brief.parts.map(part => part.id), prompt: briefPrompt(brief) })),
      })
      return
    }
    // Draw one object. The same brief is never drawn twice: the accepted
    // artwork is kept by what it draws, so rewording a scene reuses it.
    if (request.method === 'POST' && url.pathname === '/api/appearance/register') {
      const body = await readJson<Parameters<typeof registerLocalArtwork>[0]>(request, 4 * 1024 * 1024)
      json(response, 201, await registerLocalArtwork(body))
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/appearance/library') {
      const assets = await listArtwork()
      // "Used in": notebooks whose stored scenes carry the artwork's key.
      const withUsage = await Promise.all(assets.map(async asset => ({
        ...asset,
        usedIn: await findNotebooksReferencing(asset.key).catch(() => []),
      })))
      json(response, 200, { assets: withUsage })
      return
    }
    if (request.method === 'POST' && ['/api/appearance/generate', '/api/appearance/edit', '/api/appearance/animate'].includes(url.pathname)) {
      const body = await readJson<{ entity?: string; brief?: unknown; key?: string; prompt?: string; projectId?: string; force?: boolean }>(request, 256 * 1024)
      const operation = url.pathname.endsWith('/edit') ? 'edit' : url.pathname.endsWith('/animate') ? 'animate' : 'generate'
      const brief = body.brief || (body.entity ? knownObjects().find(object => object.entity === body.entity) : undefined)
      const answer = await makeArtwork({ ...body, brief, operation })
      json(response, answer.reused ? 200 : 201, answer)
      return
    }
    // Cast receipts (D4): prove each artwork marker in a scene is the
    // accepted library asset, present with its real geometry.
    if (request.method === 'POST' && url.pathname === '/api/appearance/verify-cast') {
      const body = await readJson<{ svg?: string }>(request, 2 * 1024 * 1024)
      if (!body.svg?.trim()) {
        json(response, 400, { error: 'verify-cast needs the scene SVG' })
        return
      }
      json(response, 200, await verifyCast(body.svg))
      return
    }
    // What a video was made from, and whether that base has moved since.
    // Nothing is merged here: the answer is for the author to act on.
    if (request.method === 'GET' && /^\/api\/projects\/[^/]+\/base$/.test(url.pathname)) {
      const childId = decodeURIComponent(url.pathname.split('/')[3])
      const child = await loadProjectArtifact(childId)
      if (!child) throw new Error('Notebook not found')
      const lineage = child.derivedFrom
      if (!lineage?.notebook) {
        json(response, 200, { derived: false })
        return
      }
      const base = await loadProjectArtifact(lineage.notebook)
      const snapshot = await readSnapshot(lineage.snapshot?.objectKey)
      json(response, 200, { derived: true, base: base ? { id: base.id, title: base.title } : null, lineage, status: baseStatusOf(child, base, snapshot) })
      return
    }
    // Projects (the four-notebook model): a project and its notebooks, each
    // counted in what its kind holds; every project, for the library; a
    // project named; a project removed with the notebooks it holds.
    if (request.method === 'GET' && url.pathname === '/api/containers') {
      const views = await Promise.all((await listProjectContainers()).map(container => containerView(container.id, containerDeps)))
      json(response, 200, { containers: views.filter(Boolean) })
      return
    }
    if (/^\/api\/containers\/[^/]+$/.test(url.pathname)) {
      const containerId = decodeURIComponent(url.pathname.split('/')[3])
      if (request.method === 'GET') {
        const view = await containerView(containerId, containerDeps)
        json(response, view ? 200 : 404, view || { error: 'No such project' })
        return
      }
      if (request.method === 'PUT') {
        const body = await readJson<{ title?: string }>(request, 64 * 1024)
        json(response, 200, { container: await nameContainer(containerId, String(body.title || '').trim(), containerDeps) })
        return
      }
      if (request.method === 'DELETE') {
        const held = (await listProjectArtifacts()).filter(row => row.container?.id === containerId)
        for (const row of held) await deleteProjectArtifact(row.id)
        json(response, 200, { deleted: await deleteProjectContainer(containerId), notebooks: held.map(row => row.id) })
        return
      }
    }
    // A presentation's slides as a PDF (the four-notebook model): printed
    // from the notebook as saved, and kept in the object store as an
    // artifact of that notebook. What it would hold is asked first — each
    // slide's state and the type — and the export is chosen: the designed
    // slides, or every slide as a draft, marked in the file (R04, R05 of
    // the project-flow rereview). The file is of the slides as they were
    // when it was asked for, named by revision in the answer.
    if (request.method === 'GET' && /^\/api\/projects\/[^/]+\/presentation-pdf$/.test(url.pathname)) {
      const notebook = await loadProjectArtifact(decodeURIComponent(url.pathname.split('/')[3]))
      if (!notebook) throw new Error('Notebook not found')
      json(response, 200, { plan: await exportPlanOf(notebook) })
      return
    }
    if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/presentation-pdf$/.test(url.pathname)) {
      const notebookId = decodeURIComponent(url.pathname.split('/')[3])
      const body = await readJson<{ scope?: string }>(request, 4 * 1024)
      const notebook = await loadProjectArtifact(notebookId)
      if (!notebook) throw new Error('Notebook not found')
      const slides = slidesOf(notebook)
      if (!slides.length) {
        json(response, 400, { error: 'This notebook has no slides to export yet' })
        return
      }
      const pending = slides.filter(slide => slide.state !== 'designed')
      const scope = body.scope === 'draft' || body.scope === 'ready' ? body.scope : pending.length ? null : 'ready'
      if (!scope) {
        json(response, 409, { error: `${pending.length} of ${slides.length} slides are not designed yet: export the designed slides, or every slide as a draft` })
        return
      }
      const taken = exportSlidesOf(slides, scope)
      if (!taken.length) {
        json(response, 409, { error: 'No slide is designed yet: export every slide as a draft, or wait for the designs' })
        return
      }
      const drafts = taken.filter(slide => slide.state !== 'designed').length
      // Named by its project, as the creator names it (R03).
      const name = (notebook.container?.id ? (await loadProjectContainer(notebook.container.id))?.title : null) || notebook.title
      const { pdf, type } = await presentationPdf(taken, { width: notebook.width || 1920, height: notebook.height || 1080, title: drafts ? `${name} — draft (${taken.length - drafts} of ${taken.length} designed)` : name })
      const stored = await storeAsset({ body: pdf, contentType: 'application/pdf', projectId: notebook.id, kind: 'presentation-export', extension: '.pdf' })
      json(response, 200, { url: `/objects/${stored.objectKey}`, scope, slides: taken.length, drafts, excluded: slides.length - taken.length, total: slides.length, bytes: pdf.length, type, revisions: taken.map(slide => ({ id: slide.id, state: slide.state, revision: slide.revision })) })
      return
    }
    // Fork a base notebook into its own video notebook. The snapshot and the
    // child are written before the caller is told about either, and a repeat
    // with the same fork key returns the child that already exists rather
    // than making another one.
    if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/fork$/.test(url.pathname)) {
      const baseId = decodeURIComponent(url.pathname.split('/')[3])
      const body = await readJson<{ forkKey?: string; title?: string; kind?: string }>(request, 64 * 1024)
      const forkKey = String(body.forkKey || '').trim()
      if (!forkKey) throw new Error('A fork key is required')
      const existing = (await listProjectArtifacts()).find(
        row => (row as { derivedFrom?: { forkKey?: string } }).derivedFrom?.forkKey === forkKey,
      )
      if (existing) {
        json(response, 200, { project: await loadProjectArtifact(existing.id), reused: true })
        return
      }
      const base = await loadProjectArtifact(baseId)
      if (!base) throw new Error('Base notebook not found')
      const childId = `video-${randomUUID()}`
      // The base as it was, kept with the child: the video stays renderable
      // and intelligible even if the base later changes or goes away. The
      // snapshot is a global (unattached) asset: it is not owned by the
      // child notebook, and it outlives either notebook being deleted.
      const snapshot = await storeAsset({
        body: Buffer.from(JSON.stringify(base), 'utf8'),
        contentType: 'application/json; charset=utf-8',
        kind: 'base-snapshot',
        extension: '.json',
      })
      const { project: child } = forkNotebook(base, {
        id: childId,
        title: String(body.title || '').trim() || undefined,
        kind: String(body.kind || 'video'),
        forkKey,
        snapshot,
      })
      // A video made from a project's presentation is that project's video.
      if (base.container) child.container = { id: base.container.id, kind: 'video', from: base.id }
      await saveProjectArtifact(child)
      await holdNotebook(child, containerDeps)
      json(response, 201, { project: child, reused: false })
      return
    }
    // A notebook's exports, newest first (F8): found again on every open.
    if (request.method === 'GET' && /^\/api\/projects\/[^/]+\/exports$/.test(url.pathname)) {
      json(response, 200, { exports: await listProjectExports(decodeURIComponent(url.pathname.split('/')[3])) })
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/projects/')) {
      const projectId = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
      json(response, 200, { project: await loadProjectArtifact(projectId) })
      return
    }
    if (request.method === 'PUT' && url.pathname.startsWith('/api/projects/')) {
      const projectId = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
      const body = await readJson<ProjectDocumentV1 | { project: ProjectDocumentV1; expectedProject: ProjectDocumentV1; clearTakeBlocks?: string[] }>(request, 10 * 1024 * 1024)
      const project = 'project' in body ? body.project : body
      const options = 'project' in body && body.expectedProject ? { expectedProject: body.expectedProject, clearTakeBlocks: body.clearTakeBlocks } : { createOnly: true }
      if (!projectId || project.id !== projectId) throw new Error('Project ID mismatch')
      try {
        await saveProjectArtifact(project, options)
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 409) { json(response, 409, { error: (error as Error).message }); return }
        throw error
      }
      await holdNotebook(project, containerDeps)
      json(response, 200, { projectId, saved: true, project })
      return
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/projects/')) {
      const projectId = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
      if (!projectId) throw new Error('Project ID is required')
      json(response, 200, { projectId, deleted: await deleteProjectArtifact(projectId) })
      return
    }
    if (request.method === 'GET' && url.pathname === '/runtime/gsap.min.js') {
      await serveFile(response, gsapRuntimePath)
      return
    }
    if (
      request.method === 'GET' &&
      url.pathname === '/runtime/hyperframes.iife.js'
    ) {
      await serveFile(response, hyperframesRuntimePath)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/assets') {
      await handleAssetUpload(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/source/file') {
      await handleSourceFile(context, request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/assets/illustrate') {
      await handleIllustrate(request, response)
      return
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/recordings/finalize'
    ) {
      await handleDirectedRecording(context, request, response)
      return
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/recordings/commit'
    ) {
      await handleCommitDirectedRecording(request, response)
      return
    }
    // Take archive and selections (D3): every preserved take, and the chosen
    // one per block, are durable records independent of document rewrites.
    if (request.method === 'GET' && url.pathname === '/api/takes') {
      const projectId = String(url.searchParams.get('projectId') || '')
      if (!projectId) {
        json(response, 400, { error: 'projectId is required' })
        return
      }
      const blockId = url.searchParams.get('blockId') || undefined
      json(response, 200, {
        takes: await listPresenterTakes(projectId, blockId),
        selections: await listTakeSelections(projectId),
      })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/takes/select') {
      const body = await readJson<{ projectId?: string; blockId?: string; takeId?: string }>(request, 64 * 1024)
      if (!body.projectId || !body.blockId || !body.takeId) {
        json(response, 400, { error: 'projectId, blockId and takeId are required' })
        return
      }
      await selectPresenterTake({ projectId: body.projectId, blockId: body.blockId, takeId: body.takeId })
      json(response, 200, { selected: true, project: await loadProjectArtifact(body.projectId) })
      return
    }
    // Clearing a selection (remove presenter): the active take and its
    // selection go; the archive keeps every take.
    if (request.method === 'POST' && url.pathname === '/api/takes/clear') {
      const body = await readJson<{ projectId?: string; blockId?: string }>(request, 64 * 1024)
      if (!body.projectId || !body.blockId) {
        json(response, 400, { error: 'projectId and blockId are required' })
        return
      }
      await clearPresenterTake({ projectId: body.projectId, blockId: body.blockId })
      json(response, 200, { cleared: true })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/preview') {
      await handlePreview(context, request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/voice') {
      await handleVoice(context, request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/explainer/abstract') {
      await handleExplainerAbstract(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/explainer/plan') {
      await handleExplainerPlan(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/explainer/refine') {
      await handleExplainerRefine(request, response)
      return
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/explainer/canvas-agent'
    ) {
      await handleExplainerCanvasAgent(request, response)
      return
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/experiments/image-animation'
    ) {
      await handleImageAnimationExperiment(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/scene/dialogue') {
      await handleSceneDialogue(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/source/read') {
      await handleSourceRead(request, response)
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/source/brand') {
      await handleSourceBrand(request, response)
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/source/outline') {
      await handleSourceOutline(request, response)
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/source/pages') {
      await handleSourcePages(request, response)
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/scene/edit') {
      await handleSceneEdit(request, response)
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/scene/breakdown') {
      await handleSceneBreakdown(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/slides/plan') {
      await handleSlidePlan(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/notes') {
      await handleNotesGeneration(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/themes/generate') {
      await handleThemeGeneration(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/review-fonts') {
      const project = await readJson<ProjectDocumentV1>(request, 10 * 1024 * 1024)
      const fonts = await shipFonts(context, fontFamiliesIn(project), join(context.previewsDirectory, 'media'))
      json(response, 200, { ...fonts, css: fonts.css.replaceAll('./media/fonts/', `${publicBaseUrl(request)}/assets/fonts/`) })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/exports') {
      const project = await readJson<ProjectDocumentV1>(request, 10 * 1024 * 1024)
      const baseUrl = publicBaseUrl(request)
      json(response, 202, { job: exportJobView(await startExportJob(project, (signal, report) => renderProjectArtifact(context, project, baseUrl, signal, report), url.searchParams.get('retry') === 'true')) })
      return
    }
    // A failed or cancelled export, again, from the manifest it was made of.
    if (request.method === 'POST' && /^\/api\/exports\/[a-f0-9]{64}\/retry$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3]
      const previous = await getExportJob(id)
      if (!previous?.project) {
        json(response, 404, { error: 'Export not found' })
        return
      }
      const manifest = previous.project
      json(response, 202, { job: exportJobView(await startExportJob(manifest, (signal, report) => renderProjectArtifact(context, manifest, publicBaseUrl(request), signal, report), true)) })
      return
    }
    if (/^\/api\/exports\/[a-f0-9]{64}$/.test(url.pathname) && ['GET', 'DELETE'].includes(request.method || '')) {
      const id = url.pathname.split('/').pop()!
      let job = request.method === 'DELETE' ? await cancelExportJob(id) : await getExportJob(id)
      if (request.method === 'GET' && job?.project && ['queued', 'running'].includes(job.status) && Date.now() - job.updatedAt >= 90000) {
        const manifest = job.project
        job = await startExportJob(manifest, (signal, report) => renderProjectArtifact(context, manifest, publicBaseUrl(request), signal, report))
      }
      json(response, job ? 200 : 404, { job: exportJobView(job) })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/render') {
      await handleRender(context, request, response)
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      // Media is drawn onto canvases for junction thumbnails; without CORS
      // the capture canvas would be tainted.
      response.setHeader('access-control-allow-origin', '*')
      const filePath = safeStaticPath(context.assetsDirectory, url.pathname.slice(7))
      if (!filePath) throw new Error('Invalid asset path')
      await serveFile(response, filePath)
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/objects/')) {
      response.setHeader('access-control-allow-origin', '*')
      const objectKey = decodeURIComponent(url.pathname.slice('/objects/'.length))
      if (!objectKey || objectKey.split('/').some(part => !part || part === '..')) {
        throw new Error('Invalid object key')
      }
      const metadata = await getObjectMetadata(objectKey)
      const rangeMatch = /^bytes=(\d+)-(\d*)$/.exec(String(request.headers.range || ''))
      const rangeStart = rangeMatch ? Number(rangeMatch[1]) : 0
      const rangeEnd = rangeMatch
        ? Math.min(Number(rangeMatch[2] || metadata.size - 1), metadata.size - 1)
        : metadata.size - 1
      const isRange = Boolean(rangeMatch && rangeStart <= rangeEnd)
      const object = isRange
        ? await getObject(objectKey, {
            offset: rangeStart,
            length: rangeEnd - rangeStart + 1,
          })
        : await getObject(objectKey)
      response.writeHead(isRange ? 206 : 200, {
        'content-type': object.metadata.metaData?.['content-type'] || 'application/octet-stream',
        'content-length': isRange ? rangeEnd - rangeStart + 1 : object.metadata.size,
        ...(isRange
          ? { 'content-range': `bytes ${rangeStart}-${rangeEnd}/${object.metadata.size}` }
          : {}),
        'cache-control': 'public, max-age=31536000, immutable',
        'accept-ranges': 'bytes',
      })
      object.stream.pipe(response)
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/outputs/')) {
      const filePath = safeStaticPath(context.outputsDirectory, url.pathname.slice(8))
      if (!filePath) throw new Error('Invalid output path')
      await serveFile(response, filePath)
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/previews/')) {
      const filePath = safeStaticPath(context.previewsDirectory, url.pathname.slice(9))
      if (!filePath) throw new Error('Invalid preview path')
      await serveFile(response, filePath)
      return
    }
    if (await handleStaticApp(context, url.pathname, response)) return
    json(response, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected worker error'
    console.error(error)
    json(response, message.includes('too large') ? 413 : 500, { error: message })
  }
  }
}
