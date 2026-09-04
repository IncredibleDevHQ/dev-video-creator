import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
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
import { createRenderJob, executeRenderJob } from '@hyperframes/producer'
import {
  compileProject,
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
} from 'markdown-composition'
import {
  getObject,
  deleteProjectArtifact,
  getObjectMetadata,
  listProjectArtifacts,
  loadLatestProjectArtifact,
  loadProjectArtifact,
  persistenceHealth,
  saveProjectArtifact,
  saveRecordedBlock,
  storeAsset,
} from './persistence'
import {
  configureModelGateway,
  hasModelAccess,
  listModels,
  modelFetch,
  publicModelSettings,
  saveModelSettings,
  MODEL_PRESETS,
  type ModelSettingsV1,
} from './model-gateway'

const HOST = process.env.STUDIO_RENDER_HOST || '127.0.0.1'
const PORT = Number(process.env.STUDIO_RENDER_PORT || 4319)
const SERVE_DIST = process.argv.includes('--serve-dist')
const dataDirectory = fileURLToPath(
  new URL('../../../.studio-data/', import.meta.url),
)
const assetsDirectory = join(dataDirectory, 'assets')
const outputsDirectory = join(dataDirectory, 'outputs')
const jobsDirectory = join(dataDirectory, 'jobs')
const previewsDirectory = join(dataDirectory, 'previews')
const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
const require = createRequire(import.meta.url)
const gsapRuntimePath = join(dirname(require.resolve('gsap')), 'gsap.min.js')
const hyperframesRuntimePath = join(
  dirname(require.resolve('@hyperframes/core/package.json')),
  'dist',
  'hyperframe.runtime.iife.js',
)

const readEnvFileValue = async (name: string) => {
  const candidates = [
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
// The env key seeds the gateway until the user saves a provider in Models.
configureModelGateway({ envKey: openAIKey })

await Promise.all([
  mkdir(assetsDirectory, { recursive: true }),
  mkdir(outputsDirectory, { recursive: true }),
  mkdir(jobsDirectory, { recursive: true }),
  mkdir(previewsDirectory, { recursive: true }),
])

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

const generateSystemVoice = async (text: string, outputPath: string) => {
  if (process.platform !== 'darwin' || !(await commandExists('/usr/bin/say'))) {
    throw new Error(
      'No keyless system voice is available. Configure FISH_AUDIO_API_KEY or use microphone audio.',
    )
  }
  const intermediatePath = outputPath.replace(/\.mp3$/, '.aiff')
  await runProcess('/usr/bin/say', ['-o', intermediatePath, text])
  try {
    await runProcess('ffmpeg', [
      '-y',
      '-i',
      intermediatePath,
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '2',
      outputPath,
    ])
  } finally {
    await rm(intermediatePath, { force: true })
  }
}

const generateFishVoice = async (
  text: string,
  referenceId: string,
  outputPath: string,
) => {
  const apiKey = process.env.FISH_AUDIO_API_KEY
  if (!apiKey) throw new Error('FISH_AUDIO_API_KEY is not configured')
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      model: process.env.FISH_AUDIO_MODEL || 's2.1-pro',
    },
    body: JSON.stringify({
      text,
      reference_id: referenceId,
      format: 'mp3',
      normalize: true,
      prosody: { speed: 1, volume: 0, normalize_loudness: true },
    }),
  })
  if (!response.ok) {
    throw new Error(`Fish Audio failed (${response.status})`)
  }
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

const handleVoice = async (
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
  const outputPath = join(assetsDirectory, `${id}.mp3`)
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
  const browser = await puppeteer.launch()
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
  const browser = await puppeteer.launch()
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
    throw new Error('Planning from narration needs an AI provider — open Models in the top bar')
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
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const body = await readBody(request, 600 * 1024 * 1024)
  if (!body.length) throw new Error('Recorded canvas take is empty')
  const id = randomUUID()
  const jobDirectory = join(jobsDirectory, `recording-${id}`)
  const inputExtension = extensionForContentType(
    String(request.headers['content-type'] || 'video/webm'),
  )
  const inputPath = join(jobDirectory, `take${inputExtension}`)
  const outputPath = join(outputsDirectory, `${id}.mp4`)
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
  }>(request, 32_000)
  if (!body.projectId || !body.blockId || !body.assetId || !body.mediaUrl) {
    throw new Error('The recorded block is incomplete')
  }
  const recording = await saveRecordedBlock({
    projectId: body.projectId,
    blockId: body.blockId,
    assetId: body.assetId,
    mediaUrl: body.mediaUrl,
    durationMs: Math.max(1, Number(body.durationMs) || 1),
  })
  json(response, 201, { recording })
}

const handlePreview = async (
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
  await writeFile(join(previewsDirectory, `${id}.html`), composition.html, 'utf8')
  json(response, 200, {
    url: `/previews/${id}.html`,
    durationSeconds: composition.durationSeconds,
  })
}

const handleRender = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const project = await readJson<ProjectDocumentV1>(request, 3 * 1024 * 1024)
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
        localPath: join(assetsDirectory, assetName),
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
  })
  const stageNotebookMedia = (node: TiptapNode) => {
    if (
      (node.type === 'image' || node.type === 'screenRecording') &&
      typeof node.attrs?.src === 'string'
    ) {
      node.attrs.src = localAssetPath(node.attrs.src) || node.attrs.src
    }
    node.content?.forEach(stageNotebookMedia)
  }
  renderProject.notebook.content.forEach(stageNotebookMedia)
  const composition = compileProject(renderProject, {
    gsapUrl: './runtime/gsap.min.js',
    hyperframesRuntimeUrl: './runtime/hyperframes.iife.js',
  })
  if (composition.durationSeconds > 300) {
    throw new Error('Local MVP renders are limited to five minutes')
  }

  const id = randomUUID()
  const jobDirectory = join(jobsDirectory, id)
  const runtimeDirectory = join(jobDirectory, 'runtime')
  const inputPath = join(jobDirectory, 'index.html')
  const outputPath = join(outputsDirectory, `${id}.mp4`)
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
  await writeFile(inputPath, composition.html, 'utf8')
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
      await executeRenderJob(job, jobDirectory, outputPath)
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

  json(response, 200, {
    url: `${publicBaseUrl(request)}/outputs/${id}.mp4`,
    durationSeconds: composition.durationSeconds,
  })
}

const safeStaticPath = (root: string, pathname: string) => {
  const resolved = resolve(root, `.${normalize(pathname)}`)
  return resolved.startsWith(resolve(root)) ? resolved : null
}

const handleStaticApp = async (
  pathname: string,
  response: ServerResponse,
) => {
  if (!SERVE_DIST) return false
  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = safeStaticPath(distDirectory, requestedPath)
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
  await serveFile(response, join(distDirectory, 'index.html'))
  return true
}

const server = createServer(async (request, response) => {
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
        themeAI: await hasModelAccess(),
        persistence,
      })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/settings/models') {
      json(response, 200, { settings: await publicModelSettings(), presets: MODEL_PRESETS })
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
    if (request.method === 'GET' && url.pathname === '/api/projects') {
      json(response, 200, { projects: await listProjectArtifacts() })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/projects/latest') {
      json(response, 200, { project: await loadLatestProjectArtifact() })
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/projects/')) {
      const projectId = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
      json(response, 200, { project: await loadProjectArtifact(projectId) })
      return
    }
    if (request.method === 'PUT' && url.pathname.startsWith('/api/projects/')) {
      const projectId = decodeURIComponent(url.pathname.slice('/api/projects/'.length))
      const project = await readJson<ProjectDocumentV1>(request, 5 * 1024 * 1024)
      if (!projectId || project.id !== projectId) throw new Error('Project ID mismatch')
      await saveProjectArtifact(project)
      json(response, 200, { projectId, saved: true })
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
    if (
      request.method === 'POST' &&
      url.pathname === '/api/recordings/finalize'
    ) {
      await handleDirectedRecording(request, response)
      return
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/api/recordings/commit'
    ) {
      await handleCommitDirectedRecording(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/preview') {
      await handlePreview(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/voice') {
      await handleVoice(request, response)
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
    if (request.method === 'POST' && url.pathname === '/api/render') {
      await handleRender(request, response)
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      // Media is drawn onto canvases for junction thumbnails; without CORS
      // the capture canvas would be tainted.
      response.setHeader('access-control-allow-origin', '*')
      const filePath = safeStaticPath(assetsDirectory, url.pathname.slice(7))
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
      const filePath = safeStaticPath(outputsDirectory, url.pathname.slice(8))
      if (!filePath) throw new Error('Invalid output path')
      await serveFile(response, filePath)
      return
    }
    if (request.method === 'GET' && url.pathname.startsWith('/previews/')) {
      const filePath = safeStaticPath(previewsDirectory, url.pathname.slice(9))
      if (!filePath) throw new Error('Invalid preview path')
      await serveFile(response, filePath)
      return
    }
    if (await handleStaticApp(url.pathname, response)) return
    json(response, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected worker error'
    console.error(error)
    json(response, message.includes('too large') ? 413 : 500, { error: message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Incredible render worker listening on http://${HOST}:${PORT}`)
  if (SERVE_DIST) console.log('Serving the built studio from the same origin')
})
