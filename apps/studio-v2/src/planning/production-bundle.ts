// A produced scene (P4): the Hyperframes composition a local harness builds
// from a scene's approved plan — its final code, artwork and sound, on the
// scene's real clock. It is what the Studio plays on the stage and what the
// export renders; it is not a sketch.
//
// The bundle is code plus a manifest that declares what the code does: the
// approved plan it produces, the composition, the clock it keeps (a voice
// the product generated from the plan's narration, the creator's take, or
// silence by choice), every moment's interval on that clock, the layers
// and the moments each takes part in, the cast artwork it uses, and what
// the approved plan asked for that the production could not meet. Nothing
// stands in: a missing rich artwork is an unmet requirement, never a
// labelled box that passes for it.
import type { SceneTreatmentV1 } from './scene-treatment'
import { scheduleProblems, scheduleSummary, type SketchSchedule } from './sketch-schedule'
import { bundleFileProblems, compositionProblems, isRecord, SKETCH_LAYER_KINDS, SKETCH_RUNTIME, textOf, type SketchFiles } from './sketch-bundle'

export const PRODUCTION_VERSION = 1 as const
// Moments keep to the clock within this, in seconds.
export const CLOCK_TOLERANCE = 0.1
const MAX_FILES = 120
const MAX_BYTES = 40 * 1024 * 1024

// The scene's real clock, which the product sets before the run: the
// narration it generated from the approved plan, or the creator's take,
// each measured moment by moment — or silence, when the scene is silent by
// the creator's choice (its moments then keep the plan's estimates).
export type ProductionClock = {
  kind: 'generated-voice' | 'take' | 'silent'
  // The sound file inside the bundle (the packet puts it there); none for silence.
  audio: string | null
  // A take's picture, when the plan shows the presenter.
  video: string | null
  duration: number
  moments: Array<{ id: string; start: number; end: number }>
}

export type ProductionManifest = {
  version: typeof PRODUCTION_VERSION
  kind: 'production'
  scene: string
  plan: { record: string; revision: number }
  composition: { id: string; width: number; height: number; fps: number; duration: number }
  runtime: { hyperframes: string }
  clock: { kind: ProductionClock['kind']; audio: string | null; video?: string | null }
  moments: Array<{ id: string; title: string; start: number; end: number }>
  layers: Array<{
    id: string
    kind: (typeof SKETCH_LAYER_KINDS)[number]
    label: string
    moments: string[]
    asset?: { libraryKey: string; path?: string } | null
  }>
  // What the approved plan asked for and this production could not meet.
  unmet: string[]
  schedule?: SketchSchedule | null
  // The values the code reads and the Studio may change (P6): each binds a
  // parameter the composition consumes, within its declared range.
  controls?: ProductionControl[]
}

export type ProductionControl = {
  id: string
  label: string
  // hold: seconds a moment holds its end state before the next begins;
  // offset: seconds an action of a moment starts later (or earlier).
  kind: 'hold' | 'offset'
  moment: string
  default: number
  min: number
  max: number
}

export type ProductionContext = {
  scene: string
  plan: { record: string; revision: number; content: SceneTreatmentV1 }
  compositionId: string
  clock: ProductionClock
  assetKeys: string[]
}

export type ProductionReport = { ok: boolean; problems: string[]; warnings: string[]; manifest: ProductionManifest | null }

const near = (a: number, b: number) => Math.abs(a - b) <= CLOCK_TOLERANCE + 1e-9

export const validateProduction = (files: SketchFiles, context: ProductionContext): ProductionReport => {
  const problems: string[] = []
  const warnings: string[] = []
  if (!Object.keys(files).length) return { ok: false, problems: ['the production has no files'], warnings, manifest: null }
  problems.push(...bundleFileProblems(files, 'production', { files: MAX_FILES, bytes: MAX_BYTES }))

  let manifest: ProductionManifest | null = null
  try {
    const parsed = JSON.parse(textOf(files['manifest.json']) || 'null') as unknown
    if (!isRecord(parsed)) throw new Error('missing')
    manifest = parsed as ProductionManifest
  } catch {
    problems.push('manifest.json is missing or is not JSON')
  }
  const html = textOf(files['index.html'])
  if (!html) problems.push('index.html is missing')
  if (!manifest) return { ok: false, problems, warnings, manifest: null }

  const plan = context.plan.content
  const clock = context.clock
  if (manifest.version !== PRODUCTION_VERSION || manifest.kind !== 'production') problems.push(`manifest.version must be ${PRODUCTION_VERSION} and manifest.kind "production"`)
  if (manifest.scene !== context.scene) problems.push(`manifest.scene is "${manifest.scene}", but this production is of "${context.scene}"`)
  if (manifest.plan?.record !== context.plan.record || manifest.plan?.revision !== context.plan.revision) {
    problems.push(`manifest.plan must name the approved plan it produces: record "${context.plan.record}", revision ${context.plan.revision}`)
  }
  const composition = manifest.composition
  if (!isRecord(composition) || composition.id !== context.compositionId) problems.push(`manifest.composition.id must be "${context.compositionId}"`)
  const duration = Number(composition?.duration)
  // The scene lasts as long as its clock, with at most two seconds to settle.
  if (!(duration >= clock.duration - CLOCK_TOLERANCE && duration <= clock.duration + 2)) problems.push(`manifest.composition.duration must be the clock's ${clock.duration}s, with at most 2s after it to settle (it is ${Number.isFinite(duration) ? duration : 'missing'})`)
  if (!(Number(composition?.width) > 0 && Number(composition?.height) > 0)) problems.push('manifest.composition needs a width and a height')
  if (!(Number(composition?.fps) > 0)) problems.push('manifest.composition.fps must be positive')
  if (manifest.runtime?.hyperframes !== SKETCH_RUNTIME.hyperframes) problems.push(`manifest.runtime.hyperframes must be the pinned ${SKETCH_RUNTIME.hyperframes}`)

  // The clock the product set, kept moment by moment.
  if (manifest.clock?.kind !== clock.kind || (manifest.clock?.audio ?? null) !== clock.audio) problems.push(`manifest.clock must be the packet's: ${clock.kind}${clock.audio ? `, sound "${clock.audio}"` : ''}`)
  const planIds = plan.moments.map(moment => moment.id)
  const moments = Array.isArray(manifest.moments) ? manifest.moments : []
  const ids = moments.map(moment => moment.id)
  if (JSON.stringify(ids) !== JSON.stringify(planIds)) problems.push(`manifest.moments must be the approved plan's moments in order (${planIds.join(', ')}); it has ${ids.join(', ') || 'none'}`)
  for (const moment of moments) {
    const timed = clock.moments.find(entry => entry.id === moment.id)
    if (!timed) continue
    if (!near(moment.start, timed.start) || !near(moment.end, timed.end)) problems.push(`moment ${moment.id} must keep the clock: ${timed.start}–${timed.end}s (it says ${moment.start}–${moment.end}s)`)
  }

  // Layers: what is drawn, from which artwork — and nothing standing in.
  const layers = Array.isArray(manifest.layers) ? manifest.layers : []
  if (!layers.length) problems.push('manifest.layers is empty — declare what the scene draws')
  const layerIds = layers.map(layer => layer.id)
  for (const id of layerIds.filter((value, index) => layerIds.indexOf(value) !== index)) problems.push(`layer id "${id}" is used twice`)
  const keys = new Set(context.assetKeys)
  for (const layer of layers) {
    const where = `layer ${layer.id || '?'}`
    if (!(SKETCH_LAYER_KINDS as readonly string[]).includes(layer.kind)) problems.push(`${where} kind must be one of ${SKETCH_LAYER_KINDS.join(', ')}`)
    for (const moment of layer.moments || []) if (!planIds.includes(moment)) problems.push(`${where} names moment "${moment}", which the plan does not have`)
    if ((layer as { placeholder?: unknown }).placeholder) problems.push(`${where} is a placeholder — a produced scene has no stand-ins; name what is missing in manifest.unmet instead`)
    if (layer.asset) {
      if (!keys.has(layer.asset.libraryKey)) problems.push(`${where} uses "${layer.asset.libraryKey}", which is not in the cast or the library`)
      if (layer.asset.path && !(layer.asset.path in files)) problems.push(`${where} points at "${layer.asset.path}", which is not in the production`)
    }
  }
  // The presenter: a take's own picture, or nobody.
  const presenter = layers.find(layer => layer.kind === 'presenter')
  if (clock.kind === 'take' && clock.video && plan.moments.some(moment => moment.presenter && ['full', 'shared'].includes(moment.presenter.visibility)) && !presenter) {
    problems.push('the plan shows the presenter and a take exists: add a presenter layer that plays the take\'s picture')
  }
  if (presenter && !(clock.kind === 'take' && clock.video)) problems.push('there is no take to show: a generated or silent scene has no presenter layer, and reserves no empty camera box')

  // Sound: the clock's own file, played from the start.
  if (clock.audio) {
    if (!(clock.audio in files)) problems.push(`the clock's sound "${clock.audio}" is not in the production — copy it from the packet`)
    if (html && !new RegExp(`<audio\\b[^>]*\\bsrc=["']${clock.audio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(html)) problems.push(`index.html must play the clock's sound: an <audio> element with src="${clock.audio}"`)
  }
  if (clock.video && presenter && html && !new RegExp(`<video\\b[^>]*\\bsrc=["']${clock.video.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(html)) problems.push(`the presenter layer must play the take: a <video> element with src="${clock.video}"`)

  // Unmet requirements are stated, never hidden.
  const unmet = Array.isArray(manifest.unmet) ? manifest.unmet.filter(item => typeof item === 'string' && item.trim()) : null
  if (!unmet) problems.push('manifest.unmet must be a list — empty when the approved plan is met in full')
  for (const object of plan.objects.filter(entry => entry.asset.status === 'enrich' || entry.asset.status === 'generate')) {
    const drawn = layers.some(layer => layer.id === object.entity || layer.label.toLowerCase().includes(object.entity.toLowerCase()))
    if (!drawn && !(unmet || []).some(item => item.toLowerCase().includes(object.entity.toLowerCase()))) problems.push(`the plan asks for richer artwork of ${object.entity}: draw it, or say in manifest.unmet that it is missing`)
  }

  // The controls the code reads (P6): real parameters, within range.
  for (const control of Array.isArray(manifest.controls) ? manifest.controls : []) {
    const where = `control ${control.id || '?'}`
    if (!['hold', 'offset'].includes(control.kind)) problems.push(`${where} kind must be hold or offset`)
    if (!planIds.includes(control.moment)) problems.push(`${where} names moment "${control.moment}", which the plan does not have`)
    if (!(control.min <= control.default && control.default <= control.max)) problems.push(`${where} needs min ≤ default ≤ max`)
    if (html && !html.includes(control.id)) problems.push(`${where} is not read by index.html — a control must bind a parameter the code consumes`)
  }

  problems.push(...scheduleProblems(manifest.schedule, plan, { duration, moments: moments.map(moment => ({ ...moment, estimated: false })), layers: layers.map(layer => ({ ...layer, placeholder: null })) }))
  if (html) problems.push(...compositionProblems(files, html, String(composition?.id || ''), duration, 'production'))
  return { ok: problems.length === 0, problems: [...new Set(problems)], warnings, manifest }
}

// The production a manifest describes, for the Studio's timeline.
export const productionSummary = (manifest: ProductionManifest) => ({
  duration: manifest.composition.duration,
  clock: manifest.clock.kind,
  moments: manifest.moments.map(({ id, title, start, end }) => ({ id, title, start, end })),
  layers: manifest.layers.map(({ id, kind, label, moments, asset }) => ({ id, kind, label, moments, reuses: asset?.libraryKey || null, placeholder: null })),
  unmet: manifest.unmet,
  controls: manifest.controls || [],
  schedule: scheduleSummary(manifest.schedule),
})
