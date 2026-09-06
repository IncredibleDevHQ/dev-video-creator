// Studio MCP tools (skills/motion-master/scripts/README.md contracts).
// Every tool takes absolute paths, writes files under <projectDir>/motion/
// and returns a compact JSON summary (surfaced as the MCP text content).
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { captureHiddenPage, runAtomizer } from './hidden-window'
import { validateArtefact } from 'markdown-composition/src/schemas'
import {
  MotionRules,
  buildReceipt,
  validateResolved,
  type BriefStep,
  type Geometry,
  type GeometryUnit,
  type ResolvedStep,
} from './motion-rules'

export type ToolContext = {
  // http origin of the in-process studio worker.
  origin: string
}

type Json = Record<string, unknown>

const asRecord = (value: unknown, name: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
  return value as Json
}

// Reads a JSON argument given either inline or as an absolute file path.
const readJsonArg = async (value: unknown, name: string): Promise<Json> => {
  if (typeof value === 'string') {
    return JSON.parse(await readFile(value, 'utf8')) as Json
  }
  if (value === undefined || value === null) throw new Error(`${name} is required`)
  return asRecord(value, name)
}

// projectDir: explicit, else the parent of the first path-like argument.
const projectDirFor = async (args: Json, ...pathArgs: Array<unknown>) => {
  const explicit = typeof args.projectDir === 'string' ? args.projectDir : ''
  const dir =
    explicit ||
    (() => {
      for (const candidate of pathArgs) {
        if (typeof candidate === 'string' && candidate) return dirname(candidate)
      }
      return process.cwd()
    })()
  const motionDir = join(dir, 'motion')
  await mkdir(motionDir, { recursive: true })
  return { projectDir: dir, motionDir }
}

const writeJson = async (path: string, value: unknown) => {
  await writeFile(path, JSON.stringify(value, null, 2))
  return path
}

// ——— atomize ———

type AtomizeResult = {
  svg: string
  viewBox: { x: number; y: number; w: number; h: number }
  readingMode: string
  units: GeometryUnit[]
  edges: Array<{ connector: string; from: string | null; to: string | null; directed: boolean }>
  contains: Record<string, string[]>
  rows: string[][]
}

const svgForBlock = async (origin: string, projectId: string, blockId: string) => {
  const response = await fetch(`${origin}/api/projects/${encodeURIComponent(projectId)}`)
  if (!response.ok) throw new Error(`project fetch failed (${response.status})`)
  const body = (await response.json()) as { project?: { notebook?: { content?: unknown[] } } }
  const stack = [...(body.project?.notebook?.content || [])] as Array<Record<string, unknown>>
  while (stack.length) {
    const node = stack.pop()!
    const attrs = (node.attrs || {}) as Record<string, unknown>
    if (attrs.id === blockId && typeof attrs.svg === 'string') return attrs.svg
    if (Array.isArray(node.content)) stack.push(...(node.content as Array<Record<string, unknown>>))
  }
  throw new Error(`no slide block "${blockId}" with an SVG in project "${projectId}"`)
}

const atomize = async (args: Json, context: ToolContext) => {
  let markup = typeof args.svg === 'string' ? args.svg : ''
  if (!markup && typeof args.svgPath === 'string') markup = await readFile(args.svgPath, 'utf8')
  if (!markup && typeof args.blockId === 'string') {
    if (typeof args.projectId !== 'string') {
      throw new Error('atomize with blockId also needs projectId')
    }
    markup = await svgForBlock(context.origin, args.projectId, args.blockId)
  }
  if (!markup) throw new Error('atomize needs svg, svgPath or blockId (+projectId)')
  const { motionDir } = await projectDirFor(args, args.svgPath)
  const result = await runAtomizer<AtomizeResult>('atomize', markup)
  const geometry = {
    version: 1,
    svgHash: createHash('sha1').update(markup).digest('hex').slice(0, 12),
    ...result,
  }
  const file = await writeJson(join(motionDir, 'geometry.json'), geometry)
  return {
    file,
    units: result.units.length,
    edges: result.edges.length,
    readingMode: result.readingMode,
    svgHash: geometry.svgHash,
  }
}

// ——— measure ———

const measure = async (args: Json) => {
  const geometryPath = typeof args.geometryPath === 'string' ? args.geometryPath : ''
  if (!geometryPath) throw new Error('measure needs geometryPath')
  const { motionDir } = await projectDirFor(args, geometryPath)
  const geometry = JSON.parse(await readFile(geometryPath, 'utf8')) as AtomizeResult
  if (!geometry.svg) throw new Error(`${geometryPath} has no svg — re-run atomize`)
  const measured = await runAtomizer<{
    measured: { fontsReady: boolean; at: string }
    members: Record<string, { bbox: unknown; ctm: number[] | null; fontPx?: number }>
  }>('measure', geometry.svg)
  // Roll members up to units: smallest text px per unit.
  const units: Record<string, unknown> = {}
  for (const unit of geometry.units || []) {
    const members = (unit.ids || [])
      .filter(id => measured.members[id])
      .map(id => ({ id, ...measured.members[id] }))
    const fontPx = members.reduce(
      (min, member) => Math.min(min, member.fontPx ?? Infinity),
      Infinity,
    )
    units[unit.id] = {
      bbox: unit.ids?.[0] ? measured.members[unit.ids[0]]?.bbox : unit.bbox,
      members,
      ...(fontPx !== Infinity ? { fontPx } : {}),
    }
  }
  const output = { ...measured.measured, renderScale: Number(args.renderScale) || 1, units }
  const file = await writeJson(join(motionDir, 'measure.json'), output)
  return { file, units: Object.keys(units).length, fontsReady: true }
}

// ——— plan_beats ———

// The quick-plan contract (profiles/quick-plan.md): meaning only — the model
// never names timing, easing or coordinates. Anything else is rejected.
const ALLOWED_STEP_KEYS = new Set([
  'id', 'title', 'explanation', 'narration', 'intent', 'template',
  'hero', 'supporting', 'actions', 'reveals', 'verb',
])
const ALLOWED_ACTION_KEYS = new Set(['id', 'op', 'targets', 'from', 'to', 'value', 'release'])
const FORBIDDEN_VALUE_KEYS = new Set([
  'timing', 'ease', 'easing', 'duration', 'durationMs', 'delay', 'startMs',
  'x', 'y', 'cx', 'cy', 'w', 'h', 'coordinates', 'points',
])

const enforceStrictSteps = (steps: Array<Record<string, unknown>>, validIds: Set<string>) => {
  const seen = new Set<string>()
  return steps.map((step, index) => {
    for (const key of Object.keys(step)) {
      if (!ALLOWED_STEP_KEYS.has(key)) {
        throw new Error(`plan_beats rejected step ${index + 1}: field "${key}" is not meaning (timing/ease/coordinates are forbidden)`)
      }
    }
    for (const action of (step.actions as Array<Record<string, unknown>> | undefined) || []) {
      for (const key of Object.keys(action)) {
        if (!ALLOWED_ACTION_KEYS.has(key)) {
          throw new Error(`plan_beats rejected an action in step ${index + 1}: field "${key}" is forbidden`)
        }
      }
      const value = (action.value || {}) as Record<string, unknown>
      for (const key of Object.keys(value)) {
        if (FORBIDDEN_VALUE_KEYS.has(key)) {
          throw new Error(`plan_beats rejected an action value in step ${index + 1}: "${key}" is timing/ease/coordinates`)
        }
      }
      for (const target of (action.targets as string[] | undefined) || []) {
        if (validIds.size && !validIds.has(target)) {
          throw new Error(`plan_beats rejected step ${index + 1}: unknown target "${target}"`)
        }
      }
    }
    for (const id of (step.reveals as string[] | undefined) || []) {
      if (validIds.size && !validIds.has(id)) {
        throw new Error(`plan_beats rejected step ${index + 1}: unknown reveal "${id}"`)
      }
      if (seen.has(id)) {
        throw new Error(`plan_beats rejected step ${index + 1}: "${id}" is revealed twice`)
      }
      seen.add(id)
    }
    return step
  })
}

const planBeats = async (args: Json, context: ToolContext) => {
  const narration = String(args.narration || '').trim()
  if (!narration) throw new Error('plan_beats needs narration')
  const geometry = (await readJsonArg(args.geometry, 'geometry')) as unknown as AtomizeResult
  const contract = (args.contract || {}) as Record<string, unknown>
  const units = (geometry.units || []).map(unit => ({
    id: unit.id,
    kind: unit.kind,
    label: String(unit.label || ''),
    x: unit.bbox?.x ?? 0,
    y: unit.bbox?.y ?? 0,
    w: unit.bbox?.w ?? 0,
    h: unit.bbox?.h ?? 0,
    ...(unit.role ? { group: unit.role } : {}),
  }))
  if (!units.length) throw new Error('geometry has no units — run atomize first')
  const { motionDir } = await projectDirFor(args, args.geometry)
  const response = await fetch(`${context.origin}/api/slides/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: String(contract.title || 'Slide'),
      narration,
      units,
      steps: (args.currentSteps as unknown[]) || [],
      ...(args.instruction ? { instruction: String(args.instruction) } : {}),
    }),
  })
  const body = (await response.json()) as { steps?: Array<Record<string, unknown>>; error?: string; provider?: string }
  if (!response.ok) throw new Error(body.error || `planning failed (${response.status})`)
  const validIds = new Set(units.map(unit => unit.id))
  // V1 steps reveal element ids; the unit's member ids are valid too.
  for (const unit of geometry.units || []) for (const id of unit.ids || []) validIds.add(id)
  const steps = enforceStrictSteps(body.steps || [], validIds)
  const output = { version: 1, provider: body.provider || 'unknown', steps }
  const file = await writeJson(join(motionDir, 'brief.blocks.json'), output)
  return {
    file,
    provider: output.provider,
    steps: steps.length,
    titles: steps.map(step => String(step.title || '')).slice(0, 8),
  }
}

// ——— resolve ———

const resolveTool = async (args: Json) => {
  const brief = (await readJsonArg(args.brief, 'brief')) as unknown as { steps: BriefStep[] }
  const geometry = (await readJsonArg(args.geometry, 'geometry')) as unknown as Geometry
  if (!Array.isArray(brief.steps) || !brief.steps.length) throw new Error('brief has no steps')
  const rules = new MotionRules(geometry)
  const steps = rules.resolve(brief)
  const resolved = {
    version: 1,
    preset: 'technical-trace',
    steps,
  }
  const { motionDir } = await projectDirFor(args, args.brief, args.geometry)
  const file = await writeJson(join(motionDir, 'resolved.json'), resolved)
  const beat = typeof args.beat === 'string' ? args.beat : ''
  const focus = beat ? steps.find(step => step.id === beat) : undefined
  return {
    file,
    steps: steps.length,
    actions: steps.reduce((count, step) => count + step.actions.length, 0),
    ...(focus
      ? { beat: focus.id, motionWindowMs: focus.motionWindowMs, holdMs: focus.holdMs }
      : { totalMs: steps.reduce((sum, step) => sum + step.motionWindowMs + step.holdMs, 0) }),
  }
}

// ——— validate ———

const validateTool = async (args: Json) => {
  const resolved = (await readJsonArg(args.resolved, 'resolved')) as unknown as { steps: ResolvedStep[] }
  const geometry = (await readJsonArg(args.geometry, 'geometry')) as unknown as Geometry
  const stage = args.stage === 'early' ? 'early' : 'final'
  const rules = new MotionRules(geometry)
  const report = validateResolved(resolved, rules, { quick: Boolean(args.quick) })
  // Shape-check against the §3.2 resolved-tier schema; shape errors join
  // errors[] with class "schema" (spec §6).
  const shape = validateArtefact('resolved', resolved)
  for (const error of shape.errors) {
    report.errors.push({
      class: 'schema',
      message: `${error.path}: ${error.message}`,
    })
  }
  const { motionDir } = await projectDirFor(args, args.resolved, args.geometry)
  const file = await writeJson(join(motionDir, `validate.${stage}.json`), { stage, ...report })
  return {
    file,
    stage,
    errors: report.errors,
    warnings: report.warnings,
    gateSignal: report.gateSignal,
  }
}

// ——— receipt ———

const receiptTool = async (args: Json) => {
  const brief = (await readJsonArg(args.brief, 'brief')) as unknown as { steps: BriefStep[] }
  const resolved = (await readJsonArg(args.resolved, 'resolved')) as unknown as { steps: ResolvedStep[] }
  const receipt = buildReceipt(brief, resolved)
  const { motionDir } = await projectDirFor(args, args.brief, args.resolved)
  const file = await writeJson(join(motionDir, 'receipt.json'), receipt)
  const absences = receipt.beats.flatMap(beat => beat.absences)
  return { file, beats: receipt.beats.length, absences }
}

// ——— frames ———
// Review sheet: for each [stepIndex, t] the fold (visibility/dim state from
// the resolved plan) is applied to the page SVG in the hidden window and
// captured. NOTE: the studio renderer has no ?step=&t= driver yet, so frames
// are settled-state stills (in-progress actions at 50 % opacity), not true
// motion frames — documented deviation for iteration 1.

const framesTool = async (args: Json) => {
  const resolved = (await readJsonArg(args.resolved, 'resolved')) as unknown as { steps: ResolvedStep[] }
  const geometry = (await readJsonArg(args.geometry, 'geometry')) as unknown as AtomizeResult
  if (!geometry.svg) throw new Error('geometry has no svg — re-run atomize')
  const at = (args.at as Array<[number, number]> | undefined) || []
  if (!Array.isArray(at) || !at.length) throw new Error('frames needs at: [[step, t], …]')
  const { motionDir } = await projectDirFor(args, args.resolved, args.geometry)
  const framesDir = join(motionDir, 'frames')
  await mkdir(framesDir, { recursive: true })
  const unitOfElement = new Map<string, GeometryUnit>()
  for (const unit of geometry.units || []) {
    for (const id of unit.ids || [unit.id]) unitOfElement.set(id, unit)
  }
  const elementIdsOf = (unitIds: string[]) =>
    unitIds.flatMap(id => unitOfElement.get(id)?.ids || [id])
  const files: string[] = []
  for (const [stepIndex, t] of at) {
    const hidden = new Set<string>()
    const dimmed: Record<string, number> = {}
    resolved.steps.forEach((step, index) => {
      const inProgress = index === stepIndex
      for (const action of step.actions) {
        const settled = index < stepIndex || (inProgress && action.startMs + action.durationMs <= t)
        const active = inProgress && action.startMs <= t && !settled
        if (action.op === 'reveal' && !settled && !active) {
          elementIdsOf(action.targets).forEach(id => hidden.add(id))
        }
        if (action.op === 'reveal' && active) {
          elementIdsOf(action.targets).forEach(id => (dimmed[id] = 0.5))
        }
        if (action.op === 'trace' && !settled && !active) {
          elementIdsOf(action.targets).forEach(id => hidden.add(id))
        }
        if (action.op === 'exit' && settled) {
          elementIdsOf(action.targets).forEach(id => hidden.add(id))
        }
        if (action.op === 'dim' && (settled || active)) {
          const level = Number(action.value?.level) || 0.35
          elementIdsOf(action.targets).forEach(id => (dimmed[id] = level))
        }
        if (action.op === 'undim' && settled) {
          elementIdsOf(action.targets).forEach(id => delete dimmed[id])
        }
      }
    })
    await runAtomizer('renderFold', geometry.svg, [...hidden], dimmed)
    const png = await captureHiddenPage()
    const file = join(framesDir, `step-${stepIndex}-t-${t}.png`)
    await writeFile(file, png)
    files.push(file)
  }
  return { files, frames: files.length }
}

// ——— registry ———

const geometryArg = {
  description: 'motion/geometry.json — inline object or absolute path',
}
const pathOrObject = { oneOf: [{ type: 'object' }, { type: 'string' }] }

export const TOOLS: Array<{
  name: string
  description: string
  inputSchema: Json
  call: (args: Json, context: ToolContext) => Promise<unknown>
}> = [
  {
    name: 'atomize',
    description:
      'Atomise a slide page (SVG) into motion units, edges, containment and reading rows; writes motion/geometry.json with ids stamped back into the SVG.',
    inputSchema: {
      type: 'object',
      properties: {
        svg: { type: 'string', description: 'SVG markup (inline)' },
        svgPath: { type: 'string', description: 'absolute path of an .svg file' },
        blockId: { type: 'string', description: 'slide block id in a studio project' },
        projectId: { type: 'string', description: 'studio project id (with blockId)' },
        projectDir: { type: 'string', description: 'project directory (motion/ is created inside)' },
      },
    },
    call: atomize,
  },
  {
    name: 'measure',
    description:
      'Measure an atomized page after document.fonts.ready: root-space bbox, member CTM and smallest text px per unit; writes motion/measure.json.',
    inputSchema: {
      type: 'object',
      properties: {
        geometryPath: { type: 'string', description: 'absolute path of motion/geometry.json' },
        renderScale: { type: 'number', description: 'frame px per viewBox unit' },
        projectDir: { type: 'string' },
      },
      required: ['geometryPath'],
    },
    call: measure,
  },
  {
    name: 'plan_beats',
    description:
      'Plan beats from narration against atomized geometry (the only model call in the loop). Returns strict JSON restricted to meaning — timing, easing and coordinates in the model output are rejected. Wraps POST /api/slides/plan.',
    inputSchema: {
      type: 'object',
      properties: {
        narration: { type: 'string' },
        geometry: { ...pathOrObject, ...geometryArg },
        contract: { type: 'object', description: 'confirmed motion contract (title, pace, …)' },
        currentSteps: { type: 'array' },
        instruction: { type: 'string' },
        projectDir: { type: 'string' },
      },
      required: ['narration', 'geometry'],
    },
    call: planBeats,
  },
  {
    name: 'resolve',
    description:
      'Resolve a beat brief into timed actions (startMs, durationMs, ease, pivot, ports, persistence) by pure deterministic rules; writes motion/resolved.json.',
    inputSchema: {
      type: 'object',
      properties: {
        brief: { ...pathOrObject, description: 'brief steps (or motion/brief.blocks.json) inline or absolute path' },
        lock: { ...pathOrObject, description: 'motion lock (reserved; defaults apply)' },
        geometry: { ...pathOrObject, ...geometryArg },
        beat: { type: 'string', description: 'resolve/report a single step id' },
        projectDir: { type: 'string' },
      },
      required: ['brief', 'geometry'],
    },
    call: resolveTool,
  },
  {
    name: 'validate',
    description:
      'Validate a resolved plan: errors (missing target, duty on a never-entered unit, dim on chrome) and warnings (budgets) plus the gate signal; writes motion/validate.<stage>.json.',
    inputSchema: {
      type: 'object',
      properties: {
        resolved: { ...pathOrObject, description: 'motion/resolved.json inline or absolute path' },
        geometry: { ...pathOrObject, ...geometryArg },
        stage: { type: 'string', enum: ['early', 'final'] },
        quick: { type: 'boolean' },
        projectDir: { type: 'string' },
      },
      required: ['resolved', 'geometry', 'stage'],
    },
    call: validateTool,
  },
  {
    name: 'receipt',
    description:
      'Reconcile brief vs resolved plan: per beat the hero, ops fired, primitives, dwell, budget and absences; writes motion/receipt.json.',
    inputSchema: {
      type: 'object',
      properties: {
        brief: { ...pathOrObject },
        resolved: { ...pathOrObject },
        projectDir: { type: 'string' },
      },
      required: ['brief', 'resolved'],
    },
    call: receiptTool,
  },
  {
    name: 'frames',
    description:
      'Capture review frames of the page at [step, t] positions with the resolved fold applied; writes PNGs under motion/frames/.',
    inputSchema: {
      type: 'object',
      properties: {
        resolved: { ...pathOrObject },
        geometry: { ...pathOrObject, ...geometryArg },
        at: {
          type: 'array',
          items: { type: 'array', items: [{ type: 'number' }, { type: 'number' }] },
          description: '[stepIndex, tMs] positions to capture',
        },
        projectDir: { type: 'string' },
      },
      required: ['resolved', 'geometry', 'at'],
    },
    call: framesTool,
  },
]
