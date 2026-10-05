// Artwork drawn for a scene's main actors. The plan names the objects the
// viewer watches act (a server, a gate, a queue) and the parts its scene
// moves; Quiver draws each as a rich, layered SVG in the scene's look, with
// every named part its own group, so the animation moves the needle rather
// than redrawing a gauge out of plain shapes.
//
// The key lives in the environment (QUIVER_API_KEY) and goes nowhere else:
// not into a packet, a row, a log line or the browser. Without it, nothing is
// drawn here and the build draws what it can, saying what is missing.
import { createHash } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { readRow, writeRow, storeAsset, readAsset } from '../persistence'
import type { SceneTreatmentV1 } from './scene-treatment'

const BASE_URL = () => process.env.QUIVER_BASE_URL || 'https://api.quiver.ai'
const MODEL = () => process.env.QUIVER_MODEL || 'arrow-2'
const key = () => (process.env.QUIVER_API_KEY || '').trim()
const CONCURRENCY = 3
// A rich drawing can take more than five minutes, longer than Node's fetch
// waits for an answer to begin (so requests use node:https); one request
// never holds the scene longer.
const REQUEST_MS = 8 * 60_000
const VIEWBOX = { width: 480, height: 360 }

export const artworkConfigured = () => Boolean(key())

type PlanObject = SceneTreatmentV1['objects'][number]
export type DrawnObject = {
  entity: string
  file: string
  parts: string[]
  missing: string[]
  objectKey?: string
  error?: string
}
type CachedArtwork = {
  objectKey: string
  parts: string[]
  missing: string[]
  model: string
  createdAt: string
}

/** The objects a plan asks to have drawn: generated, or enriched from the page. */
export const objectsToDraw = (treatment: SceneTreatmentV1) =>
  treatment.objects.filter(
    (object) =>
      object.asset.status === 'generate' || object.asset.status === 'enrich'
  )

const partsOf = (object: PlanObject) =>
  object.parts?.length
    ? object.parts
    : [{ id: `${object.entity}-body`, what: object.role }]

/**
 * What Quiver is asked to draw: the object alone and at rest, its look, and
 * its parts by id. How it performs stays out: the scene animates that, and
 * draws the things it acts on itself.
 */
export const artworkPrompt = (object: PlanObject, look: string) =>
  [
    `${object.role}. ${object.appearance}`.trim(),
    'Draw this one object alone, centred and at rest: no other objects, people, arrows, request tokens, connectors or scenery.',
    'Style: a rich, layered technical illustration for an explainer video:',
    'crisp vector shapes, soft depth (subtle gradients, one soft drop shadow,',
    'gentle highlights), a consistent three-quarter view.',
    look ? `The scene's look: ${look}` : '',
    'No text, numbers or letters anywhere. Leave room below for a label.',
    'Parts the animation will move, each its own <g> with exactly this id:',
    partsOf(object)
      .map((part) => `id "${part.id}": ${part.what}`)
      .join('; ') + '.'
  ]
    .filter(Boolean)
    .join(' ')

const INSTRUCTIONS =
  'Return one standalone SVG of the one object the prompt names and nothing else. Every part named in the prompt is its own <g> with exactly that id. No <image>, no external href, no <script>, no <foreignObject>, no embedded raster. Transparent background: draw no full-bleed background rectangle.'

const plain = (id: string) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Marks each named part with data-part, whatever id the drawing gave it: the
 * exact id, the same words spelled differently (pulse_ring), with the
 * object's name in front, or split into numbered pieces (dial--part-1,
 * dial--part-2) that move together.
 */
export const markParts = (svg: string, parts: string[], entity: string) => {
  const prefix = `${plain(entity)}-`
  const partOf = (id: string) => {
    let name = plain(id)
    if (name.startsWith(prefix) && !parts.includes(name))
      name = name.slice(prefix.length)
    return parts.find(
      (part) =>
        name === part ||
        (name.startsWith(`${part}-`) &&
          /^(?:(?:part|piece|group|layer)-?)?\d+$/.test(
            name.slice(part.length + 1)
          ))
    )
  }
  const found = new Set<string>()
  const marked = svg
    .replace(/\sdata-part\s*=\s*"[^"]*"/g, '')
    .replace(/<g\b([^>]*?)\bid\s*=\s*"([^"]+)"/g, (whole, before, id) => {
      const part = partOf(id)
      if (!part) return whole
      found.add(part)
      return `<g${before}id="${id}" data-part="${part}"`
    })
  return { svg: marked, found: parts.filter((part) => found.has(part)) }
}

const STYLE = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi

/** A drawing's styles without motion: no keyframes, animations or transitions. */
const still = (css: string) =>
  css
    .replace(
      /@(?:-webkit-)?keyframes\b[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi,
      ''
    )
    .replace(
      /(?<![\w-])(?:-webkit-)?(?:animation|transition)(?:-[a-z-]+)?\s*:[^;}"]*;?\s*/gi,
      ''
    )

/**
 * Only drawing survives: scripts, foreign content, embedded or remote images,
 * event handlers and links that leave the file are removed. So is motion a
 * drawing brings (SMIL, CSS keyframes): the scene's seekable timeline moves
 * it, as the plan says, and nothing else.
 */
export const safeSvg = (svg: string) => {
  const body = svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    // Notes and credits carry outside links a production may not hold.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata\b[\s\S]*?<\/metadata\s*>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<image\b[^>]*\/?>(?:\s*<\/image>)?/gi, '')
    .replace(/<(animate\w*|set)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1\s*>)/gi, '')
    .replace(STYLE, (_, open, css, close) => `${open}${still(css)}${close}`)
    .replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_, css) => ` style="${still(css)}"`)
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
    .trim()
  if (!/^<svg\b/i.test(body)) throw new Error('The drawing is not an SVG')
  return body
}

/**
 * Ids only the drawing uses (gradients, filters, clips) and the classes its
 * styles define take the object's name, so two drawings inlined in one page
 * never share one. Part ids stay as the plan named them.
 */
export const scopeIds = (svg: string, prefix: string, keep: string[]) => {
  const named = new Map(
    [...svg.matchAll(/(?<![\w:-])id\s*=\s*"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((id) => !keep.includes(id) && !id.startsWith(`${prefix}-`))
      .map((id) => [id, `${prefix}-${id}`])
  )
  const scoped = (id: string) => named.get(id) || id
  const css = [...svg.matchAll(STYLE)].map((match) => match[2]).join(' ')
  const classes = new Set(
    [...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)]
      .map((match) => match[1])
      .filter((name) => !name.startsWith(`${prefix}-`))
  )
  const classed = (name: string) =>
    classes.has(name) ? `${prefix}-${name}` : name
  return svg
    .replace(STYLE, (_, open, styles: string, close) => {
      const renamed = styles.replace(
        /\.(-?[_a-zA-Z][\w-]*)/g,
        (_, name: string) => `.${classed(name)}`
      )
      return `${open}${renamed}${close}`
    })
    .replace(
      /(?<![\w:-])class\s*=\s*"([^"]*)"/g,
      (_, names: string) =>
        `class="${names.split(/\s+/).filter(Boolean).map(classed).join(' ')}"`
    )
    .replace(
      /(?<![\w:-])id\s*=\s*"([^"]+)"/g,
      (_, id: string) => `id="${scoped(id)}"`
    )
    .replace(
      /url\(\s*#([^)\s]+)\s*\)/g,
      (_, id: string) => `url(#${scoped(id)})`
    )
    .replace(
      /((?:xlink:)?href\s*=\s*")#([^"]+)"/g,
      (_, head: string, id: string) => `${head}#${scoped(id)}"`
    )
}

/** The SVG in a provider answer, wherever it put it. */
const svgFrom = (payload: unknown, depth = 0): string => {
  if (depth > 6 || !payload) return ''
  if (typeof payload === 'string')
    return payload.trimStart().startsWith('<svg') ? payload : ''
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = svgFrom(item, depth + 1)
      if (found) return found
    }
    return ''
  }
  if (typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  for (const name of ['svg', 'content', 'markup', 'output', 'data', 'text']) {
    const found = svgFrom(record[name], depth + 1)
    if (found) return found
  }
  for (const value of Object.values(record)) {
    const found = svgFrom(value, depth + 1)
    if (found) return found
  }
  return ''
}

const post = (url: URL, body: string) =>
  new Promise<{ status: number; text: string }>((resolve, reject) => {
    const send = url.protocol === 'http:' ? httpRequest : httpsRequest
    const request = send(
      url,
      {
        method: 'POST',
        // A connection of its own: the shared agent's keep-alive probes go
        // unanswered on some networks, which drops a drawing still in progress.
        agent: false,
        headers: {
          authorization: `Bearer ${key()}`,
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(body))
        }
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('error', reject)
        response.on('end', () =>
          resolve({
            status: response.statusCode || 0,
            text: Buffer.concat(chunks).toString('utf8')
          })
        )
      }
    )
    request.setTimeout(REQUEST_MS, () =>
      request.destroy(new Error('Quiver did not answer within 8 minutes'))
    )
    request.on('error', reject)
    request.end(body)
  })

const request = async (path: string, body: Record<string, unknown>) => {
  const response = await post(
    new URL(`${BASE_URL()}${path}`),
    JSON.stringify({ model: MODEL(), ...body })
  )
  const text = response.text
  if (response.status < 200 || response.status >= 300) {
    let message = text.slice(0, 240)
    try {
      const failure = JSON.parse(text) as { code?: string; message?: string }
      message = [failure.code, failure.message].filter(Boolean).join(' · ')
    } catch {
      // Not the documented failure shape; the text stands.
    }
    throw new Error(`Quiver answered ${response.status}: ${message}`)
  }
  const svg = svgFrom(JSON.parse(text))
  if (!svg) throw new Error('Quiver returned no SVG')
  return svg
}

/**
 * One object, drawn (or, for an enriched page object, redrawn from its page
 * artwork) and then, if its named parts did not come back as groups, asked
 * once to group them without changing the drawing.
 */
const drawObject = async (
  object: PlanObject,
  look: string,
  source?: Buffer
) => {
  const prompt = artworkPrompt(object, look)
  let svg = source
    ? await request('/v1/svgs/edits', {
        svg_source: { base64: source.toString('base64') },
        prompt: `Redraw this as ${prompt} Keep its silhouette and meaning.`,
        reasoning_effort: 'high'
      })
    : await request('/v1/svgs/generations', {
        prompt,
        instructions: INSTRUCTIONS,
        attributes: { viewBox: { minX: 0, minY: 0, ...VIEWBOX } },
        n: 1,
        reasoning_effort: 'high'
      })
  const wanted = partsOf(object)
  const ids = wanted.map((part) => part.id)
  const missing = () => {
    const { found } = markParts(svg, ids, object.entity)
    return wanted.filter((part) => !found.includes(part.id))
  }
  if (missing().length) {
    try {
      svg = await request('/v1/svgs/edits', {
        svg_source: { base64: Buffer.from(svg).toString('base64') },
        prompt: [
          'Do not change what this drawing looks like. Change only its structure.',
          `Wrap the existing shapes into groups the animation can move: ${wanted
            .map((part) => `<g id="${part.id}"> around ${part.what}`)
            .join('; ')}.`,
          'Every shape stays exactly as drawn, in its drawing order. Add no new shapes, no text and no background.'
        ].join(' ')
      })
    } catch {
      // The drawing stands; the parts it lacks are reported to the build.
    }
  }
  const marked = markParts(safeSvg(svg), ids, object.entity)
  return {
    svg: scopeIds(marked.svg, object.entity, ids),
    parts: marked.found,
    missing: ids.filter((id) => !marked.found.includes(id))
  }
}

const cacheKey = (object: PlanObject, look: string, source?: Buffer) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        model: MODEL(),
        prompt: artworkPrompt(object, look),
        source: source
          ? createHash('sha256').update(source).digest('hex')
          : null,
        viewBox: VIEWBOX
      })
    )
    .digest('hex')
    .slice(0, 32)

/**
 * Draw every object the plan asks for, a few at a time. A drawing is kept by
 * what was asked, so a rebuild with the same plan reuses it. An object that
 * cannot be drawn is returned with its error, for the build to report.
 */
export const drawSceneArtwork = async (input: {
  projectId: string
  sceneId: string
  treatment: SceneTreatmentV1
  /** Page artwork by library key, for enriched objects. */
  sources?: Record<string, Buffer>
  onProgress?: (message: string) => unknown
}): Promise<DrawnObject[]> => {
  const objects = objectsToDraw(input.treatment)
  if (!objects.length || !artworkConfigured()) return []
  const look = input.treatment.treatments?.text || ''
  const drawn: DrawnObject[] = []
  let done = 0
  await input.onProgress?.(
    `Drawing the scene's objects (0 of ${objects.length})`
  )
  const queue = [...objects]
  const work = async () => {
    for (let object = queue.shift(); object; object = queue.shift()) {
      const file = `assets/generated-${object.entity}/asset.svg`
      const source = object.asset.ref
        ? input.sources?.[object.asset.ref]
        : undefined
      const id = cacheKey(object, look, source)
      try {
        let cached = await readRow<CachedArtwork>('generated-artwork', id)
        if (!cached) {
          const result = await drawObject(object, look, source)
          const asset = await storeAsset({
            body: Buffer.from(result.svg),
            contentType: 'image/svg+xml',
            extension: '.svg',
            kind: 'scene-artwork',
            projectId: input.projectId,
            sceneId: input.sceneId
          })
          cached = {
            objectKey: asset.objectKey,
            parts: result.parts,
            missing: result.missing,
            model: MODEL(),
            createdAt: new Date().toISOString()
          }
          await writeRow('generated-artwork', id, cached)
        }
        drawn.push({
          entity: object.entity,
          file,
          parts: cached.parts,
          missing: cached.missing,
          objectKey: cached.objectKey
        })
      } catch (error) {
        drawn.push({
          entity: object.entity,
          file,
          parts: [],
          missing: partsOf(object).map((part) => part.id),
          error: error instanceof Error ? error.message : String(error)
        })
      }
      await input.onProgress?.(
        `Drawing the scene's objects (${++done} of ${objects.length})`
      )
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, work))
  return objects.map(
    (object) => drawn.find((item) => item.entity === object.entity)!
  )
}

/** The asset key a production's manifest names a drawing by. */
export const drawnKey = (entity: string) => `generated-${entity}`

/** A drawing's own box, for sizing the place it goes. */
export const viewBoxOf = (svg: string) =>
  /<svg\b[^>]*\bviewBox\s*=\s*"([^"]+)"/i.exec(svg)?.[1] || ''

/** The drawing fills whatever box the page gives it, keeping its shape. */
const filling = (svg: string) =>
  svg.replace(/<svg\b[^>]*>/i, (tag) => {
    const size = (name: string) =>
      Number.parseFloat(
        new RegExp(`\\s${name}\\s*=\\s*"([\\d.]+)`, 'i').exec(tag)?.[1] || ''
      )
    const box =
      /\sviewBox\s*=/i.test(tag) || !(size('width') > 0 && size('height') > 0)
        ? ''
        : ` viewBox="0 0 ${size('width')} ${size('height')}"`
    return tag
      .replace(/\s(?:width|height|preserveAspectRatio)\s*=\s*"[^"]*"/gi, '')
      .replace(
        /^<svg/i,
        `<svg${box} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`
      )
  })

/**
 * Puts each drawing into the page's empty placeholder for it, exactly as
 * drawn and sized to fill it, so a build never retypes path data:
 * <div data-artwork="api"></div>.
 */
export const inlineArtwork = (
  html: string,
  drawings: Record<string, string>
) => {
  const placed: string[] = []
  const page = html.replace(
    /(<div\b[^>]*?\bdata-artwork\s*=\s*"([^"]+)"[^>]*>)\s*(<\/div>)/g,
    (whole, open: string, entity: string, close: string) => {
      if (!drawings[entity]) return whole
      placed.push(entity)
      return `${open}${filling(drawings[entity])}${close}`
    }
  )
  return { html: page, placed }
}

/** The drawings and what to do with them, for the build's packet. */
export const artworkPacket = async (drawn: DrawnObject[]) => {
  const files: Record<string, Buffer> = {}
  // Kept drawings are cleaned again, so one drawn before a cleaning rule
  // existed meets it without being drawn again.
  for (const item of drawn)
    if (item.objectKey)
      files[`packet/${item.file}`] = Buffer.from(
        scopeIds(
          safeSvg((await readAsset(item.objectKey)).toString()),
          item.entity,
          item.parts
        )
      )
  if (!drawn.length) return files
  files['packet/ARTWORK.json'] = Buffer.from(
    JSON.stringify(
      {
        rule: [
          'These objects were drawn for this scene from the plan.',
          'Place each one with an empty <div data-artwork="ENTITY"></div>, sized and positioned where the object goes, in the aspect of its viewBox: when you submit, the app puts the drawing into it exactly as drawn, sized to fill it, so never paste or retype its path data.',
          'Its manifest layer names it as asset { "libraryKey": "generated-ENTITY" }, with no path: the drawing is inline.',
          'Animate each named part by its data-part attribute ([data-artwork="ENTITY"] [data-part="PART"]; a part may be several groups that move together), never redraw a drawn object from plain shapes, and keep it clear of text and other layers.',
          'A part listed as missing is not separable: move the whole drawing instead.',
          'An object with an error has no drawing: draw it yourself and say so in manifest.unmet.'
        ].join(' '),
        objects: drawn.map((item) => ({
          entity: item.entity,
          ...(item.objectKey
            ? {
                file: item.file,
                libraryKey: drawnKey(item.entity),
                place: `<div data-artwork="${item.entity}"></div>`,
                viewBox: viewBoxOf(
                  files[`packet/${item.file}`]?.toString() || ''
                )
              }
            : {}),
          parts: item.parts,
          missing: item.missing,
          ...(item.error ? { error: item.error } : {})
        }))
      },
      null,
      2
    )
  )
  return files
}
