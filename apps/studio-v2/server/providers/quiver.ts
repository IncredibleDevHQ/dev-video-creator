// The artwork provider.
//
// Quiver draws SVGs from a prompt. This is the whole of what the studio knows
// about it: where the endpoint is, what a request looks like, and how to read
// an answer. The key lives in the environment and never travels any further —
// not into a notebook, a render, a log line or the browser.
import { REFERENCE_STYLE, briefPrompt, type ObjectBrief } from '../appearance'

const BASE_URL = process.env.QUIVER_BASE_URL || 'https://api.quiver.ai'
const DEFAULT_MODEL = process.env.QUIVER_MODEL || 'arrow-2'

export type QuiverCapability = {
  configured: boolean
  baseUrl: string
  model: string
  /** Models this key may actually call, with the operations they advertise. */
  models?: Array<{ id: string; operations: string[] }>
  /** Whether this key may browse the catalogue at all. */
  canList?: boolean
  reason?: string
}

const apiKey = () => (process.env.QUIVER_API_KEY || '').trim()

export const quiverConfigured = () => Boolean(apiKey())

const headers = () => ({
  authorization: `Bearer ${apiKey()}`,
  'content-type': 'application/json',
})

/** What this key can do, asked of the provider rather than assumed. */
export const quiverCapability = async (): Promise<QuiverCapability> => {
  if (!quiverConfigured()) {
    return { configured: false, baseUrl: BASE_URL, model: DEFAULT_MODEL, reason: 'QUIVER_API_KEY is not set' }
  }
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, { headers: headers() })
    if (response.status === 401 || response.status === 403) {
      // Some keys may draw but may not browse the catalogue. That is a
      // narrower authority, not an unusable provider.
      return { configured: true, baseUrl: BASE_URL, model: DEFAULT_MODEL, canList: false, reason: 'this key may not list models; generation is attempted with the configured model' }
    }
    if (!response.ok) {
      return { configured: true, baseUrl: BASE_URL, model: DEFAULT_MODEL, canList: false, reason: `the provider answered ${response.status}: ${(await response.text()).slice(0, 160)}` }
    }
    const body = (await response.json()) as { data?: Array<Record<string, unknown>> }
    const models = (body.data || []).map(entry => ({
      id: String(entry.id || entry.model || ''),
      operations: (Array.isArray(entry.supported_operations) ? entry.supported_operations : []).map(String),
    }))
    return { configured: true, baseUrl: BASE_URL, model: DEFAULT_MODEL, canList: true, models }
  } catch (error) {
    return { configured: true, baseUrl: BASE_URL, model: DEFAULT_MODEL, reason: error instanceof Error ? error.message : 'the provider could not be reached' }
  }
}

/** The SVG in a provider answer, wherever it decided to put it. */
const svgFrom = (payload: unknown): string => {
  const seen: string[] = []
  const dig = (value: unknown, depth: number): string => {
    if (depth > 6 || !value) return ''
    if (typeof value === 'string') return value.trimStart().startsWith('<svg') ? value : ''
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = dig(item, depth + 1)
        if (found) return found
      }
      return ''
    }
    if (typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    for (const key of ['svg', 'content', 'markup', 'document', 'output', 'data', 'text']) {
      if (key in record) {
        const found = dig(record[key], depth + 1)
        if (found) return found
      }
    }
    if (typeof record.base64 === 'string') {
      const decoded = Buffer.from(record.base64, 'base64').toString('utf8')
      if (decoded.trimStart().startsWith('<svg')) return decoded
    }
    Object.keys(record).forEach(key => seen.push(key))
    for (const key of Object.keys(record)) {
      const found = dig(record[key], depth + 1)
      if (found) return found
    }
    return ''
  }
  const svg = dig(payload, 0)
  if (!svg) throw new Error(`The provider returned no SVG (keys seen: ${[...new Set(seen)].slice(0, 12).join(', ') || 'none'})`)
  return svg
}

export type GeneratedArtwork = {
  svg: string
  model: string
  requestId: string
  usage?: Record<string, unknown>
  credits?: number
}

/** One object, drawn to its brief. */
export const generateObjectSvg = async (
  brief: ObjectBrief,
  options: { model?: string; signal?: AbortSignal; traceId?: string } = {},
): Promise<GeneratedArtwork> => {
  if (!quiverConfigured()) throw new Error('The artwork provider is not configured (QUIVER_API_KEY is not set)')
  const model = options.model || DEFAULT_MODEL
  const response = await fetch(`${BASE_URL}/v1/svgs/generations`, {
    method: 'POST',
    headers: { ...headers(), ...(options.traceId ? { 'x-trace-id': options.traceId } : {}) },
    signal: options.signal,
    body: JSON.stringify({
      model,
      prompt: briefPrompt(brief),
      instructions: [
        'Return one standalone SVG and nothing else.',
        'Every part named in the prompt is its own <g> with exactly that id.',
        'No <image>, no external href, no <script>, no <foreignObject>, no embedded raster.',
        'Transparent background: draw no full-bleed background rectangle.',
      ].join(' '),
      attributes: { viewBox: { minX: 0, minY: 0, width: brief.size.width, height: brief.size.height } },
      n: 1,
      reasoning_effort: 'high',
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    let message = text.slice(0, 300)
    try {
      const failure = JSON.parse(text) as { code?: string; message?: string; param?: string }
      message = [failure.code, failure.message, failure.param].filter(Boolean).join(' · ')
    } catch {
      // The body was not the documented failure shape; the text stands.
    }
    throw new Error(`The artwork provider answered ${response.status}: ${message}`)
  }
  const payload = JSON.parse(text) as Record<string, unknown>
  return {
    svg: svgFrom(payload),
    model,
    requestId: String(payload.id || ''),
    usage: (payload.usage as Record<string, unknown>) || undefined,
    credits: typeof payload.credits === 'number' ? payload.credits : undefined,
  }
}

/**
 * A bounded repair: the drawing is right but the scene cannot hold it, because
 * the pieces it must move are not separable. The provider is asked to group
 * and name them, changing nothing that is drawn. One attempt, then the
 * limitation is reported rather than papered over.
 */
export const repairObjectSvg = async (
  svg: string,
  brief: ObjectBrief,
  options: { model?: string; signal?: AbortSignal; traceId?: string } = {},
): Promise<GeneratedArtwork> => {
  if (!quiverConfigured()) throw new Error('The artwork provider is not configured (QUIVER_API_KEY is not set)')
  const model = options.model || DEFAULT_MODEL
  const response = await fetch(`${BASE_URL}/v1/svgs/edits`, {
    method: 'POST',
    headers: { ...headers(), ...(options.traceId ? { 'x-trace-id': options.traceId } : {}) },
    signal: options.signal,
    body: JSON.stringify({
      model,
      svg_source: { base64: Buffer.from(svg, 'utf8').toString('base64') },
      prompt: [
        'Do not change what this drawing looks like. Change only its structure.',
        `Wrap the existing shapes into groups so the animation can move them: ${brief.parts.map(part => `<g id="${part.id}"> around ${part.what}`).join('; ')}.`,
        'Every shape already in the file must end up inside exactly one of those groups, keeping its own attributes and its drawing order.',
        'Add no new shapes, no text, and no background rectangle.',
      ].join(' '),
    }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`The artwork provider could not group the parts (${response.status}): ${text.slice(0, 200)}`)
  const payload = JSON.parse(text) as Record<string, unknown>
  return {
    svg: svgFrom(payload),
    model,
    requestId: String(payload.id || ''),
    usage: (payload.usage as Record<string, unknown>) || undefined,
    credits: typeof payload.credits === 'number' ? payload.credits : undefined,
  }
}

/** A brief for one of the reference objects, by entity name. */
export const referenceBriefFor = (entity: string, objects: ObjectBrief[]) =>
  objects.find(object => object.entity === entity) ||
  ({ ...objects[0], entity, style: REFERENCE_STYLE } as ObjectBrief)
