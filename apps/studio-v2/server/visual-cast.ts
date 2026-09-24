// The visual cast (P1): the reusable ingredients of a base presentation —
// its icons and its explanatory objects — lifted out as standalone,
// verified artwork a video can reuse, adapt or deliberately replace.
//
// A cast is extracted from a pinned base revision, once: the page is laid
// out in a real browser, each drawn thing is lifted with its definitions and
// inherited styles, ids are namespaced, and the lifted artwork is rendered
// beside the same elements rendered in place on the page. An ingredient
// that does not match its original is kept as a reference, never offered as
// equivalent. Artwork, originals and previews live in the object store;
// the revision and its entity mapping live in the settings store beside the
// artwork library, and verified entries join that library so a plan can
// reuse them by key. Nothing here changes the base page.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import type { StudioThemeV1 } from 'markdown-composition'
import { CAST_PAGE_SCRIPT } from './visual-cast-page'
import { getObject, loadSetting, saveSetting, storeAsset } from './persistence'
import { registerExtractedArtwork } from './appearance-library'

export const EXTRACTOR_VERSION = 1
// The share of painted pixels that may differ between the lifted artwork
// and the original before it is refused as not equivalent.
const MATCH_TOLERANCE = 0.005

export type ObjectRef = { objectKey: string; url: string; contentType: string; bytes: number }
export type CastBounds = { x: number; y: number; width: number; height: number }
export type CastPart = {
  // The id in the lifted artwork, its name, and whether the page declared
  // the name (data-part) or the extractor derived it.
  id: string
  name: string
  named: 'declared' | 'derived'
  element: string
  count: number
  bounds: CastBounds
  // What the page already animates on it — an affordance, never a plan.
  animations: string[]
}
export type CastEntry = {
  id: string
  libraryKey: string | null
  kind: 'icon' | 'object' | 'chart'
  kindBasis: 'size' | 'markup' | 'shape'
  identity: {
    entity: string
    // The drawn node's kind of thing, the rigged object it asks for, and
    // the explanation model's stable id.
    entityKind: string | null
    object: string | null
    objectId: string | null
    base: { notebook: string; revision: string; page: string; pageTitle: string; node: string }
    groups: string[]
    contentHash: string
  }
  meaning: {
    label: string
    detail: string[]
    interactions: Array<{ verb: string; direction: 'out' | 'in'; with: string; withLabel: string }>
    // The page's source passages: what the page was drawn to say.
    evidence: string[]
    // The label is drawn on the page; the kind of thing is declared by the
    // page's markup or inferred by the extractor.
    basis: { label: 'drawn on the page'; kind: 'declared' | 'inferred' | 'unresolved' }
  }
  artwork: {
    svg: ObjectRef
    original: ObjectRef
    thumbnail: ObjectRef
    viewBox: { width: number; height: number }
    bounds: CastBounds
    themeBindings: Array<{ color: string; token: string | null }>
    fonts: string[]
  }
  parts: CastPart[]
  rig: { object: string | null; status: 'verified' | 'partial' | 'none'; pieces: Array<{ id: string; found: string | null }> }
  reuse: { provenance: 'base-extraction'; license: string | null; variants: string[] }
  confidence: { grouping: 'declared' | 'inferred'; entity: 'declared' | 'inferred' | 'unresolved'; checks: string[] }
  verification: { status: 'verified' | 'mismatch'; differingRatio: number; notes: string[] }
}
export type CastPage = {
  scene: string
  title: string
  page: ObjectRef
  preview: ObjectRef
  contactSheet: ObjectRef | null
  // Page furniture, classified apart from the cast: backgrounds, headers,
  // footers, decoration, cards, connectors and actors.
  furniture: Array<{ id: string | null; role: string; [key: string]: unknown }>
  entries: string[]
  labels: Array<{ node: string; label: string; detail: string[] }>
  notes: string[]
}
export type VisualCastRevision = {
  id: string
  version: typeof EXTRACTOR_VERSION
  base: { notebook: string; revision: string }
  createdAt: string
  status: 'ready' | 'failed'
  error?: string
  pages: CastPage[]
  entries: CastEntry[]
}

export type CastSourcePage = { scene: string; title: string; svg: string; sourcePassages: string[] }

type PageIngredient = {
  node: string
  nodeKind: string | null
  entity: string | null
  object: string | null
  objectId: string | null
  label: string
  detail: string[]
  groups: string[]
  grouping: 'declared' | 'inferred'
  split: { index: number; of: number } | null
  kind: CastEntry['kind']
  kindBasis: CastEntry['kindBasis']
  bounds: CastBounds
  parts: Array<CastPart & { localId: string }>
  svg: string
  original: string
  thumbnail: string
  painted: number
  verification: { ratio: number; differing: number }
  colors: string[]
  fonts: string[]
}
type PageResult = {
  scene: string
  width: number
  height: number
  error?: string
  png: string
  contactSheet: string
  furniture: CastPage['furniture']
  labels: CastPage['labels']
  ingredients: PageIngredient[]
  styled: boolean
}

const hashOf = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const castKey = (notebook: string, revision: string) => `visual-cast:${notebook}:${revision || 'unpinned'}:v${EXTRACTOR_VERSION}`

// ——— The rigged objects the page-master skill can ask for ———
type RigPieces = Record<string, string[]>
let rigs: RigPieces | null = null
const rigPieces = async (): Promise<RigPieces> => {
  if (rigs) return rigs
  const root = process.env.STUDIO_SKILLS_DIR
  try {
    const file = JSON.parse(await readFile(join(root || '', 'page-master', 'references', 'objects.json'), 'utf8')) as { objects?: Array<{ entity: string; parts?: Array<{ id: string }> }> }
    rigs = Object.fromEntries((file.objects || []).map(object => [object.entity, (object.parts || []).map(part => part.id)]))
  } catch {
    rigs = {}
  }
  return rigs
}

// Which of the theme's colours a drawn colour is, if any.
export const themeTokens = (theme: StudioThemeV1 | null | undefined): Record<string, string> =>
  theme?.brand ? Object.fromEntries(Object.entries(theme.brand).filter(([, value]) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)).map(([token, value]) => [String(value).toLowerCase(), token])) : {}

// ——— Extraction ———
// One browser for the whole base; the page script does the drawing work.
export const extractPages = async (pages: CastSourcePage[], palette: { ground?: string; ink?: string; muted?: string } = {}): Promise<PageResult[]> => {
  const { default: puppeteer } = await import('puppeteer')
  // The host app owns SIGTERM/SIGINT: puppeteer's own handlers would
  // swallow the app's quit while a browser is open.
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
  try {
    const page = await browser.newPage()
    // Nothing the base page names may be fetched while it is drawn.
    await page.setRequestInterception(true)
    page.on('request', request => {
      if (request.url().startsWith('data:') || request.url() === 'about:blank') void request.continue()
      else void request.abort()
    })
    await page.setViewport({ width: 1400, height: 900 })
    await page.setContent('<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}#host{position:absolute;left:0;top:0}#host svg{display:block}</style></head><body><div id="host"></div></body></html>')
    const input = { pages: pages.map(({ scene, title, svg }) => ({ scene, title, svg })), ...palette }
    return (await page.evaluate(`(${CAST_PAGE_SCRIPT})(${JSON.stringify(input)})`)) as PageResult[]
  } finally {
    await browser.close()
  }
}

// Unattached, like the artwork library: a cast serves every video forked
// from its base revision, so deleting one video never deletes it.
const store = async (body: Buffer, contentType: string, extension: string): Promise<ObjectRef> => {
  const stored = await storeAsset({ body, contentType, kind: 'visual-cast', extension })
  return { objectKey: stored.objectKey, url: `/objects/${stored.objectKey}`, contentType, bytes: body.length }
}

const rigOf = (object: string | null, parts: CastPart[], known: RigPieces): CastEntry['rig'] => {
  if (!object) return { object: null, status: 'none', pieces: [] }
  const pieces = (known[object] || []).map(piece => ({
    id: piece,
    found: parts.find(part => part.name === piece || part.name.endsWith(`-${piece}`) || part.name.startsWith(`${piece}-`))?.id || null,
  }))
  if (!pieces.length) return { object, status: 'none', pieces }
  const found = pieces.filter(piece => piece.found).length
  return { object, status: found === pieces.length ? 'verified' : found ? 'partial' : 'none', pieces }
}

// Turns the page script's findings into cast entries and stores their bytes.
const entriesFrom = async (
  results: PageResult[],
  sources: CastSourcePage[],
  base: { notebook: string; revision: string },
  theme: StudioThemeV1 | null | undefined,
) => {
  const known = await rigPieces()
  const tokens = themeTokens(theme)
  const entries: CastEntry[] = []
  const pages: CastPage[] = []
  for (const result of results) {
    const source = sources.find(entry => entry.scene === result.scene)!
    const notes: string[] = []
    if (result.error) notes.push(`Not extracted: ${result.error}`)
    if (result.styled) notes.push('The page carries a stylesheet: class-based styling may not travel with the lifted artwork.')
    const labelOf = new Map(result.labels.map(entry => [entry.node, entry.label]))
    const connectors = result.furniture.filter(item => item.role === 'connector') as Array<{ from?: string; to?: string; verb?: string }>
    const pageEntries: string[] = []
    for (const ingredient of result.ingredients || []) {
      const contentHash = hashOf(ingredient.svg)
      const id = `cast-${contentHash.slice(0, 12)}`
      const verified = ingredient.verification.ratio <= MATCH_TOLERANCE && ingredient.painted > 20
      const checks: string[] = []
      if (ingredient.grouping === 'inferred') {
        checks.push(ingredient.split ? `The page drew this as part ${ingredient.split.index} of ${ingredient.split.of} in one artwork group; the split is proposed — confirm it is one thing.` : 'The page declared no artwork group for this node; the grouping is inferred from what sits inside it.')
      }
      if (!ingredient.entity) checks.push('The page does not say what kind of thing this is; it is known only by its label.')
      if (ingredient.kind === 'chart') checks.push('A chart: keep it native where exact values matter.')
      const fonts = ingredient.fonts.map(family => family.split(',')[0].replace(/["']/g, '').trim()).filter(Boolean)
      const entry: CastEntry = {
        id,
        libraryKey: null,
        kind: ingredient.kind,
        kindBasis: ingredient.kindBasis,
        identity: {
          entity: ingredient.objectId || ingredient.node.replace(/^s\d+-node-/, ''),
          entityKind: ingredient.entity,
          object: ingredient.object,
          objectId: ingredient.objectId,
          base: { notebook: base.notebook, revision: base.revision, page: result.scene, pageTitle: source.title, node: ingredient.node },
          groups: ingredient.groups,
          contentHash,
        },
        meaning: {
          label: ingredient.label,
          detail: ingredient.detail,
          interactions: connectors
            .filter(edge => edge.from === ingredient.node || edge.to === ingredient.node)
            .map(edge => {
              const out = edge.from === ingredient.node
              const other = String((out ? edge.to : edge.from) || '')
              return { verb: String(edge.verb || 'relates to'), direction: out ? ('out' as const) : ('in' as const), with: other, withLabel: labelOf.get(other) || other }
            }),
          evidence: source.sourcePassages,
          basis: { label: 'drawn on the page', kind: ingredient.entity ? 'declared' : ingredient.object ? 'inferred' : 'unresolved' },
        },
        artwork: {
          svg: await store(Buffer.from(ingredient.svg), 'image/svg+xml', '.svg'),
          original: await store(Buffer.from(ingredient.original), 'image/svg+xml', '.svg'),
          thumbnail: await store(Buffer.from(ingredient.thumbnail, 'base64'), 'image/png', '.png'),
          viewBox: { width: ingredient.bounds.width, height: ingredient.bounds.height },
          bounds: ingredient.bounds,
          themeBindings: ingredient.colors.map(color => ({ color, token: tokens[color] || null })),
          fonts: [...new Set(fonts)],
        },
        parts: ingredient.parts.map(({ localId: _local, ...part }) => part),
        rig: rigOf(ingredient.object, ingredient.parts, known),
        reuse: { provenance: 'base-extraction', license: null, variants: [] },
        confidence: {
          grouping: ingredient.grouping,
          entity: ingredient.entity ? 'declared' : ingredient.object ? 'inferred' : 'unresolved',
          checks,
        },
        verification: {
          status: verified ? 'verified' : 'mismatch',
          differingRatio: Math.round(ingredient.verification.ratio * 10000) / 10000,
          notes: verified ? [] : [ingredient.painted <= 20 ? 'It draws almost nothing on its own.' : `It differs from the original in ${(ingredient.verification.ratio * 100).toFixed(1)}% of its painted pixels — kept as a reference, not offered as equivalent.`],
        },
      }
      if (entry.rig.status === 'partial') entry.confidence.checks.push(`It asks for the ${entry.rig.object} rig, but ${entry.rig.pieces.filter(piece => !piece.found).map(piece => piece.id).join(', ')} is not a separate part.`)
      entries.push(entry)
      pageEntries.push(id)
    }
    pages.push({
      scene: result.scene,
      title: source.title,
      page: await store(Buffer.from(source.svg), 'image/svg+xml', '.svg'),
      preview: await store(Buffer.from(result.png || '', 'base64'), 'image/png', '.png'),
      contactSheet: result.contactSheet ? await store(Buffer.from(result.contactSheet, 'base64'), 'image/png', '.png') : null,
      furniture: result.furniture,
      entries: pageEntries,
      labels: result.labels,
      notes,
    })
  }
  return { entries, pages }
}

// ——— The cast of a pinned base ———
const inFlight = new Map<string, Promise<VisualCastRevision>>()

export const loadVisualCast = async (notebook: string, revision: string) =>
  (await loadSetting(castKey(notebook, revision))) as VisualCastRevision | null

// Extracted once per base revision and extractor version; a failure is
// recorded with its reason and extracted again on the next request.
export const ensureVisualCast = (input: {
  notebook: string
  revision: string
  pages: CastSourcePage[]
  theme: StudioThemeV1 | null | undefined
  retryFailed?: boolean
}): Promise<VisualCastRevision> => {
  const key = castKey(input.notebook, input.revision)
  const running = inFlight.get(key)
  if (running) return running
  const job = (async () => {
    const existing = await loadVisualCast(input.notebook, input.revision)
    if (existing && (existing.status === 'ready' || !input.retryFailed)) return existing
    const base = { notebook: input.notebook, revision: input.revision }
    const drawable = input.pages.filter(page => page.svg.trim())
    let revision: VisualCastRevision
    try {
      const brand = input.theme?.brand
      const results = await extractPages(drawable, { ground: brand?.background, ink: brand?.text, muted: brand?.mutedText })
      const { entries, pages } = await entriesFrom(results, drawable, base, input.theme)
      revision = { id: key, version: EXTRACTOR_VERSION, base, createdAt: new Date().toISOString(), status: 'ready', pages, entries }
      // Verified ingredients join the reusable library, immutably.
      for (const entry of revision.entries.filter(item => item.verification.status === 'verified')) {
        const svg = await readObject(entry.artwork.svg.objectKey)
        entry.libraryKey = (await registerExtractedArtwork({ entry, svg: svg.toString('utf8'), castId: key })).key
      }
    } catch (error) {
      revision = { id: key, version: EXTRACTOR_VERSION, base, createdAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error), pages: [], entries: [] }
    }
    await saveSetting(key, revision)
    return revision
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

export const readObject = async (objectKey: string) => {
  const chunks: Buffer[] = []
  for await (const chunk of (await getObject(objectKey)).stream as Readable) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}
