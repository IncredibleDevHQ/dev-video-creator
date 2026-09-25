// A plan preview (P3): a rough, seekable Hyperframes composition a local
// harness builds from one approved or candidate scene plan, so the creator
// can feel its progression before anything is produced.
//
// The bundle is code plus a manifest that declares what the code really
// does: the plan revision it previews, the composition's size and length,
// an estimated interval for every moment of the plan, the layers and the
// moments each takes part in, which cast artwork it reuses, and everything
// provisional — estimated timing, a presenter stand-in, placeholder
// artwork. The Studio reads the manifest for its timeline; it never guesses
// one from the code. A sketch cannot publish, approve, choose a take or
// generate paid artwork: it is a preview of a plan, labelled as one.
import type { SceneTreatmentV1 } from './scene-treatment'
import { scheduleProblems, scheduleSummary, type SketchSchedule } from './sketch-schedule'

export const SKETCH_VERSION = 1 as const
export const SKETCH_RUNTIME = { hyperframes: '0.7.106' } as const
// The only scripts a sketch may load: the Studio's own pinned runtime.
export const SKETCH_RUNTIME_SCRIPTS = ['/runtime/gsap.min.js', '/runtime/hyperframes.iife.js'] as const
export const SKETCH_LAYER_KINDS = ['background', 'object', 'text', 'caption', 'camera', 'presenter'] as const
const MAX_FILES = 80
const MAX_BYTES = 6 * 1024 * 1024

export type SketchFile = string | { base64: string; contentType: string }
export type SketchFiles = Record<string, SketchFile>

export type SketchManifest = {
  version: typeof SKETCH_VERSION
  scene: string
  plan: { record: string; revision: number }
  composition: { id: string; width: number; height: number; fps: number; duration: number }
  runtime: { hyperframes: string }
  // One interval per plan moment, in the plan's order. Estimates until a
  // voice or a take gives the scene its real clock.
  moments: Array<{ id: string; title: string; start: number; end: number; estimated: boolean }>
  layers: Array<{
    id: string
    kind: (typeof SKETCH_LAYER_KINDS)[number]
    label: string
    moments: string[]
    // The cast ingredient it draws, by library key; absent for native shapes.
    asset?: { libraryKey: string; path?: string } | null
    // What stands in for artwork or media the sketch does not have yet.
    placeholder?: string | null
  }>
  // Everything a viewer must not mistake for the finished scene.
  provisional: string[]
  // Where the plan counts something: when each counted change happens, the
  // rule behind a steady rate and any pause that holds the clock (R11).
  schedule?: SketchSchedule | null
}

// What playing a sketch in the pinned player proved, kept with the preview
// against the hash of the bundle it played (see server/sketch-runtime.ts).
export type SketchProof = {
  version: 1
  bundle: string
  runtime: string
  checkedAt: string
  // As the player read them.
  duration: number
  timeline: { duration: number; tweens: number }
  // Every file the composition asked for, all found.
  loaded: string[]
  // A frame hash for each sampled time, and the times sought again.
  frames: Array<{ at: number; moment: string; frame: string }>
  reseeks: Array<{ at: number; same: boolean }>
  // Where each marked layer showed, and how much each planned change moved.
  layers: Array<{ id: string; moments: string[] }>
  changes: Array<{ moment: string; within: 'actors' | 'frame'; pixels: number }>
  // Each counted change seen in its layers when it happens, and each pause
  // shown while it holds the clock.
  schedule?: { events: Array<{ at: number; pixels: number }>; pauses: Array<{ start: number; end: number; shown: string }> }
}

export type SketchContext = {
  scene: string
  plan: { record: string; revision: number; content: SceneTreatmentV1 }
  // Library keys the sketch may reuse (the scene's cast and the library).
  assetKeys: string[]
}

export type SketchReport = { ok: boolean; problems: string[]; warnings: string[]; manifest: SketchManifest | null }

// A provisional line names a placeholder layer however the harness phrases
// it: it says the layer's id ("presenter"), shares two of its words (the id,
// or the lead phrase of its label), or names what the lead phrase ends on
// ("inlet drop" → "the drop").
const PLAIN_WORDS = new Set(['the', 'and', 'for', 'with', 'into', 'onto', 'that', 'this', 'its', 'are', 'from', 'too', 'not', 'all', 'each', 'any', 'one', 'only', 'their', 'there', 'than', 'then', 'but', 'has', 'have', 'was', 'were', 'will'])
const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .filter(word => /^\d+$/.test(word) || (word.length >= 3 && !PLAIN_WORDS.has(word)))
const namesLayer = (line: string, layer: SketchManifest['layers'][number]) => {
  const said = new Set(wordsOf(line))
  const id = wordsOf(layer.id)
  if (id.length && id.every(word => said.has(word))) return true
  const lead = wordsOf(layer.label.split(/[:(,;—–]/)[0] || layer.label)
  const words = [...new Set([...id, ...lead])]
  const shared = words.filter(word => said.has(word)).length
  return (words.length > 0 && shared >= Math.min(2, words.length)) || (lead.length > 0 && said.has(lead[lead.length - 1]))
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const textOf = (file: SketchFile | undefined) => (typeof file === 'string' ? file : '')
const sizeOf = (file: SketchFile) => (typeof file === 'string' ? new TextEncoder().encode(file).length : Math.floor((file.base64.length * 3) / 4))

// Code a preview must never run: network, storage, clocks, randomness.
const FORBIDDEN = [
  { pattern: /\bfetch\s*\(/, why: 'fetches from the network' },
  { pattern: /\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/, why: 'opens a network connection' },
  { pattern: /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/, why: 'reads or writes browser storage' },
  { pattern: /\bimport\s*\(/, why: 'loads code at run time' },
  { pattern: /\bDate\.now\s*\(|\bnew Date\s*\(|performance\.now\s*\(/, why: 'reads the clock — the timeline must be seekable' },
  { pattern: /\bMath\.random\s*\(/, why: 'is random — every seek must show the same frame' },
  { pattern: /repeat\s*:\s*-1/, why: 'repeats forever — use a finite count' },
]
const NAMESPACES = /^https?:\/\/www\.w3\.org\//

const pathSafe = (path: string) => /^[a-z0-9][a-z0-9._\-/]*$/i.test(path) && !path.split('/').some(part => part === '..' || part === '')

// Checks a submitted sketch against its plan. The engine's own lint runs
// separately (server side) and adds its errors.
export const validateSketch = (files: SketchFiles, context: SketchContext): SketchReport => {
  const problems: string[] = []
  const warnings: string[] = []
  const names = Object.keys(files)
  if (!names.length) return { ok: false, problems: ['the sketch has no files'], warnings, manifest: null }
  if (names.length > MAX_FILES) problems.push(`the sketch has ${names.length} files — keep it under ${MAX_FILES}`)
  const total = names.reduce((sum, name) => sum + sizeOf(files[name]), 0)
  if (total > MAX_BYTES) problems.push(`the sketch is ${(total / 1024 / 1024).toFixed(1)} MB — keep it under ${MAX_BYTES / 1024 / 1024} MB`)
  for (const name of names) if (!pathSafe(name)) problems.push(`"${name}" is not a plain relative path inside the sketch`)

  // The manifest.
  let manifest: SketchManifest | null = null
  try {
    const parsed = JSON.parse(textOf(files['manifest.json']) || 'null') as unknown
    if (!isRecord(parsed)) throw new Error('missing')
    manifest = parsed as SketchManifest
  } catch {
    problems.push('manifest.json is missing or is not JSON')
  }
  const html = textOf(files['index.html'])
  if (!html) problems.push('index.html is missing')
  if (!manifest) return { ok: false, problems, warnings, manifest: null }

  const plan = context.plan.content
  if (manifest.version !== SKETCH_VERSION) problems.push(`manifest.version must be ${SKETCH_VERSION}`)
  if (manifest.scene !== context.scene) problems.push(`manifest.scene is "${manifest.scene}", but this preview is for "${context.scene}"`)
  if (manifest.plan?.record !== context.plan.record || manifest.plan?.revision !== context.plan.revision) {
    problems.push(`manifest.plan must name the plan it previews: record "${context.plan.record}", revision ${context.plan.revision}`)
  }
  const composition = manifest.composition
  if (!isRecord(composition) || !composition.id) problems.push('manifest.composition needs an id, width, height, fps and duration')
  const duration = Number(composition?.duration)
  if (!(duration >= 2 && duration <= 180)) problems.push('manifest.composition.duration must be between 2 and 180 seconds')
  if (!(Number(composition?.width) > 0 && Number(composition?.height) > 0)) problems.push('manifest.composition needs a width and a height')
  if (!(Number(composition?.fps) > 0)) problems.push('manifest.composition.fps must be positive')
  if (manifest.runtime?.hyperframes !== SKETCH_RUNTIME.hyperframes) problems.push(`manifest.runtime.hyperframes must be the pinned ${SKETCH_RUNTIME.hyperframes}`)

  // Moments: every plan moment, in order, inside the composition, estimated.
  const planIds = plan.moments.map(moment => moment.id)
  const moments = Array.isArray(manifest.moments) ? manifest.moments : []
  const manifestIds = moments.map(moment => moment.id)
  if (JSON.stringify(manifestIds) !== JSON.stringify(planIds)) problems.push(`manifest.moments must be the plan's moments in order (${planIds.join(', ')}); it has ${manifestIds.join(', ') || 'none'}`)
  let previousEnd = 0
  for (const moment of moments) {
    const where = `moment ${moment.id}`
    if (!(moment.start >= 0 && moment.end > moment.start)) problems.push(`${where} needs a start and an end after it`)
    else {
      if (moment.start < previousEnd - 0.001) problems.push(`${where} starts at ${moment.start}s, before the previous moment ends (${previousEnd}s)`)
      if (moment.end > duration + 0.001) problems.push(`${where} ends at ${moment.end}s, after the composition (${duration}s)`)
      previousEnd = moment.end
    }
    if (moment.estimated !== true) problems.push(`${where} must say its timing is estimated — no voice or take has set it`)
  }

  // Layers: what is drawn, over which moments, from which artwork.
  const layers = Array.isArray(manifest.layers) ? manifest.layers : []
  if (!layers.length) problems.push('manifest.layers is empty — declare what the sketch draws')
  const layerIds = layers.map(layer => layer.id)
  for (const id of layerIds.filter((value, index) => layerIds.indexOf(value) !== index)) problems.push(`layer id "${id}" is used twice`)
  const keys = new Set(context.assetKeys)
  for (const layer of layers) {
    const where = `layer ${layer.id || '?'}`
    if (!(SKETCH_LAYER_KINDS as readonly string[]).includes(layer.kind)) problems.push(`${where} kind must be one of ${SKETCH_LAYER_KINDS.join(', ')}`)
    for (const moment of layer.moments || []) if (!planIds.includes(moment)) problems.push(`${where} names moment "${moment}", which the plan does not have`)
    if (layer.asset) {
      if (!keys.has(layer.asset.libraryKey)) problems.push(`${where} reuses "${layer.asset.libraryKey}", which is not in the cast or the library`)
      if (layer.asset.path && !(layer.asset.path in files)) problems.push(`${where} points at "${layer.asset.path}", which is not in the sketch`)
    }
  }
  // A presenter the plan shows is a stand-in until a take exists.
  const presenterMoments = plan.moments.filter(moment => moment.presenter && ['full', 'shared'].includes(moment.presenter.visibility)).map(moment => moment.id)
  const presenterLayer = layers.find(layer => layer.kind === 'presenter')
  if (presenterMoments.length && !presenterLayer) problems.push(`the plan shows a presenter in ${presenterMoments.join(', ')}: add a presenter layer with a labelled stand-in`)
  if (presenterLayer && !presenterLayer.placeholder) problems.push('the presenter layer must say it is a stand-in (placeholder) — no take is recorded')

  // The mechanism's clock, replayed against the plan's count.
  problems.push(...scheduleProblems(manifest.schedule, plan, { duration, moments, layers }))

  // Provisional: what the viewer must not take for the finished scene.
  const provisional = Array.isArray(manifest.provisional) ? manifest.provisional.filter(item => typeof item === 'string' && item.trim()) : []
  if (!provisional.some(item => /tim/i.test(item))) problems.push('manifest.provisional must say the timing is estimated')
  for (const layer of layers.filter(item => item.placeholder)) {
    if (!provisional.some(item => item.includes(layer.label) || item.includes(String(layer.placeholder)) || namesLayer(item, layer))) warnings.push(`layer ${layer.id} has a placeholder that manifest.provisional does not mention`)
  }

  // The composition: one standalone root, its timeline registered, only
  // the pinned runtime, nothing fetched, nothing random.
  if (html) {
    const id = String(composition?.id || '')
    if (!new RegExp(`data-composition-id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(html)) problems.push(`index.html has no root with data-composition-id="${id}"`)
    if (!new RegExp(`__timelines\\s*\\[\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s*\\]\\s*=`).test(html)) problems.push(`index.html does not register window.__timelines["${id}"]`)
    const rootDuration = /data-composition-id=["'][^"']+["'][^>]*data-duration=["']([\d.]+)["']|data-duration=["']([\d.]+)["'][^>]*data-composition-id=/.exec(html)
    const declared = Number(rootDuration?.[1] || rootDuration?.[2])
    if (!Number.isFinite(declared) || Math.abs(declared - duration) > 0.05) problems.push(`the root's data-duration must equal manifest.composition.duration (${duration}s)`)
    for (const src of [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1])) {
      if (!(SKETCH_RUNTIME_SCRIPTS as readonly string[]).includes(src) && !(src in files)) problems.push(`index.html loads "${src}" — only the Studio runtime (${SKETCH_RUNTIME_SCRIPTS.join(', ')}) or the sketch's own files`)
    }
    for (const name of names) {
      const text = /\.(html|js|css|svg|json)$/i.test(name) ? textOf(files[name]) : ''
      if (!text) continue
      for (const url of text.match(/https?:\/\/[^\s"'<>)]+/g) || []) if (!NAMESPACES.test(url)) problems.push(`${name} refers to "${url}" — a preview uses nothing outside itself`)
      if (/\.(html|js)$/i.test(name)) for (const rule of FORBIDDEN) if (rule.pattern.test(text)) problems.push(`${name} ${rule.why}`)
    }
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], warnings, manifest }
}

// The preview a manifest describes, for the Studio's timeline and labels.
export const sketchSummary = (manifest: SketchManifest) => ({
  duration: manifest.composition.duration,
  moments: manifest.moments.map(({ id, title, start, end }) => ({ id, title, start, end })),
  layers: manifest.layers.map(({ id, kind, label, moments, asset, placeholder }) => ({ id, kind, label, moments, reuses: asset?.libraryKey || null, placeholder: placeholder || null })),
  provisional: manifest.provisional,
  schedule: scheduleSummary(manifest.schedule),
})
