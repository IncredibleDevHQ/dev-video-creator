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
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createRenderJob, executeRenderJob } from '@hyperframes/producer'
import {
  compileProject,
  generateThemeDirections,
  normalizeStudioTheme,
  type ProjectDocumentV1,
  type StudioThemeV1,
  type ThemeCanvasTreatment,
} from 'markdown-composition'

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
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  response.setHeader(
    'access-control-allow-headers',
    'content-type,x-asset-name',
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
  const body = await readJson<{ text?: string; referenceId?: string }>(
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
  json(response, 200, {
    url: `${publicBaseUrl(request)}/assets/${id}.mp3`,
    provider: useFish ? 'Fish Audio authorized voice' : 'Local system voice',
  })
}

const extractResponseText = (response: {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
}) =>
  response.output
    ?.flatMap(item => item.content || [])
    .find(item => item.type === 'output_text')?.text || ''

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

  if (!openAIKey) {
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
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${openAIKey}`,
        'content-type': 'application/json',
      },
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
  const extension = extensionForContentType(request.headers['content-type'])
  const id = randomUUID()
  await writeFile(join(assetsDirectory, `${id}${extension}`), body)
  json(response, 201, {
    url: `${publicBaseUrl(request)}/assets/${id}${extension}`,
  })
}

const handlePreview = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const project = await readJson<ProjectDocumentV1>(request, 3 * 1024 * 1024)
  const composition = compileProject(project, {
    gsapUrl: '/runtime/gsap.min.js',
    hyperframesRuntimeUrl: '/runtime/hyperframes.iife.js',
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
  const composition = compileProject(project, {
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
    await executeRenderJob(job, jobDirectory, outputPath)
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
      json(response, 200, {
        renderer: true,
        systemVoice:
          process.platform === 'darwin' && (await commandExists('/usr/bin/say')),
        fishAudio: Boolean(process.env.FISH_AUDIO_API_KEY),
        themeAI: Boolean(openAIKey),
      })
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
    if (request.method === 'POST' && url.pathname === '/api/preview') {
      await handlePreview(request, response)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/voice') {
      await handleVoice(request, response)
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
      const filePath = safeStaticPath(assetsDirectory, url.pathname.slice(7))
      if (!filePath) throw new Error('Invalid asset path')
      await serveFile(response, filePath)
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
