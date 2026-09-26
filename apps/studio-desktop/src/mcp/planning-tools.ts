// Studio tools for a planning run (M0). These are the only studio tools a
// planning run is offered: read its context, read the accepted asset
// library, and hand a brief or a scene plan to the product, which checks it
// and keeps it or answers with problems. Nothing here generates artwork,
// audio, recordings, compositions or exports.
//
// The record a run submits to is read from the run's own inputs file, never
// taken from the harness's arguments, so a run can only answer for the
// brief or scene it was started for. Submissions are budgeted.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

type Json = Record<string, unknown>
type Context = { origin: string }

export const PLANNING_SUBMISSION_BUDGET = 6

const inside = (dir: string, file: string) => {
  const path = resolve(dir, file)
  const rel = relative(resolve(dir), path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Paths must stay inside the run directory')
  return path
}

const runOf = async (args: Json) => {
  const projectDir = String(args.projectDir || '')
  if (!isAbsolute(projectDir)) throw new Error('projectDir must be the absolute run directory')
  let inputs: { planning?: { recordId?: string; route?: string }; packet?: { files?: string[] } }
  try {
    inputs = JSON.parse(await readFile(join(projectDir, 'motion', 'inputs.json'), 'utf8'))
  } catch {
    throw new Error('This is not a planning run: motion/inputs.json is missing')
  }
  const recordId = String(inputs.planning?.recordId || '')
  if (!recordId) throw new Error('This is not a planning run: it names no planning record')
  // The run's own id, so the product can check this run owns the record.
  const runId = await readFile(join(projectDir, 'motion', 'run.json'), 'utf8').then(text => String(JSON.parse(text).id || ''), () => '')
  return { projectDir, recordId, runId, route: String(inputs.planning?.route || ''), files: inputs.packet?.files || [] }
}

const call = async <T>(context: Context, path: string, body?: unknown): Promise<{ status: number; body: T }> => {
  const response = await fetch(`${context.origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: (await response.json()) as T }
}

// A report kept beside the run: the evidence's frames are saved as PNGs of
// their own, not as text in it.
const withoutFrames = (body: Json) =>
  Array.isArray(body.evidence) ? { ...body, evidence: (body.evidence as Array<Json>).map(({ frames: _frames, ...item }) => item) } : body

// Counts the run's submissions in the run directory itself.
const spendSubmission = async (projectDir: string) => {
  const ledger = join(projectDir, 'planning', 'submissions.json')
  await mkdir(join(projectDir, 'planning'), { recursive: true })
  const used = await readFile(ledger, 'utf8').then(text => Number(JSON.parse(text).used) || 0).catch(() => 0)
  if (used >= PLANNING_SUBMISSION_BUDGET) {
    throw new Error(`The submission budget (${PLANNING_SUBMISSION_BUDGET}) is spent. Stop the run: the product keeps what was last reported, and the creator can retry.`)
  }
  await writeFile(ledger, JSON.stringify({ used: used + 1 }))
  return used + 1
}

// What a refusal tells the harness (R09 of the project-flow rereview): the
// problems, the player's evidence — both frames of a moment seeked twice,
// written beside the run to look at — and whether it may submit again. With
// its budget spent it stops: the product keeps the check, and the creator
// decides how to go on.
type Evidence = { at: number; pixels: number; region: unknown; layers: unknown; size: unknown; frames: { first: string; again: string } }
const writeEvidence = async (projectDir: string, attempt: number, evidence: unknown) => {
  const items = Array.isArray(evidence) ? (evidence as Evidence[]) : []
  const written: Array<Omit<Evidence, 'frames'> & { frames: { first: string; again: string } }> = []
  for (const [index, item] of items.entries()) {
    if (typeof item?.frames?.first !== 'string' || typeof item.frames.again !== 'string') continue
    const folder = join('planning', 'evidence', `attempt-${attempt}`)
    await mkdir(join(projectDir, folder), { recursive: true })
    const stem = `seek-${index + 1}-at-${Number(item.at).toFixed(2)}s`
    const first = join(folder, `${stem}-first.png`)
    const again = join(folder, `${stem}-again.png`)
    await writeFile(join(projectDir, first), Buffer.from(item.frames.first, 'base64'))
    await writeFile(join(projectDir, again), Buffer.from(item.frames.again, 'base64'))
    written.push({ at: item.at, pixels: item.pixels, region: item.region, layers: item.layers, size: item.size, frames: { first, again } })
  }
  return written
}
const refused = async (projectDir: string, attempt: number, body: Json) => {
  const remaining = Math.max(0, PLANNING_SUBMISSION_BUDGET - attempt)
  const evidence = await writeEvidence(projectDir, attempt, body.evidence)
  return {
    accepted: false,
    attempt,
    remaining,
    problems: body.problems,
    warnings: body.warnings,
    ...(evidence.length ? { evidence } : {}),
    next: remaining
      ? `${evidence.length ? 'Look at the evidence first: each frame, seeked twice, is saved as two PNGs in this run directory, with where they differ. Then fix' : 'Fix'} exactly these problems and submit again — ${remaining} submission${remaining === 1 ? '' : 's'} left.`
      : 'The submission budget is spent: stop the run now. The product keeps this check with its evidence, and the creator decides how to go on.',
  }
}

const contextTool = async (args: Json, context: Context) => {
  const run = await runOf(args)
  const sketch = run.route === 'Sketch Scene'
  // The product notes that the run read its packet and contract — a
  // milestone the creator sees (U3 of the scene workspace plan). Its answer
  // never holds the run up.
  void call(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/progress`, { runId: run.runId, milestone: 'context' }).catch(() => undefined)
  return {
    route: run.route,
    record: run.recordId,
    packet: run.files,
    writes: run.route === 'Prepare Brief' ? 'planning/brief.json' : sketch ? 'sketch/index.html and sketch/manifest.json (and sketch/assets/)' : 'planning/treatment.json',
    contract: run.route === 'Prepare Brief' ? 'references/brief-contract.md' : sketch ? 'references/sketch-contract.md' : 'references/treatment-contract.md',
    submissionBudget: PLANNING_SUBMISSION_BUDGET,
    boundary: sketch
      ? 'A rough preview of one plan only: no paid artwork, no narration, no recording, no approval, no production or export. Stop when the sketch is accepted.'
      : 'Planning only: no artwork, narration, recording, composition, finish or export. Stop when the submission is accepted.',
    // A scene plan's settled sections, shown to the creator while the run
    // works — a draft still being checked; the submitted plan is what counts.
    ...(run.route === 'Plan Scene'
      ? { drafts: 'While you plan, publish what is settled with plan_publish_draft: first section "explanation" with the question and the takeaway, as soon as they are clear; then section "moments" with the moments planned so far, each {id, title, summary}, again whenever they change. Use the ids your treatment will use. The creator sees them as a draft still being checked; plan_submit_treatment is still what hands the plan in.' }
      : {}),
  }
}

// A settled section of a scene plan, published while the run works.
const publishDraftTool = async (args: Json, context: Context) => {
  const run = await runOf(args)
  if (run.route !== 'Plan Scene') throw new Error('Drafts are for a scene plan: this run has none to publish')
  const { projectDir: _projectDir, ...section } = args
  const answer = await call<Json>(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/draft`, { ...section, runId: run.runId })
  return answer.body
}

// The sketch folder as the product receives it: text as text, images and
// fonts as bytes.
const TEXT_FILES = /\.(html|css|js|json|svg|txt|md)$/i
const BINARY_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.wav': 'audio/wav' }
const readSketch = async (root: string, folder = '', files: Record<string, string | { base64: string; contentType: string }> = {}) => {
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = folder ? `${folder}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await readSketch(root, path, files)
      continue
    }
    if (TEXT_FILES.test(entry.name)) files[path] = await readFile(join(root, path), 'utf8')
    else {
      const extension = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()
      if (BINARY_TYPES[extension]) files[path] = { base64: (await readFile(join(root, path))).toString('base64'), contentType: BINARY_TYPES[extension] }
    }
  }
  return files
}

const submitSketch = async (args: Json, context: Context) => {
  const run = await runOf(args)
  if (run.route !== 'Sketch Scene') throw new Error(`This run is for route ${run.route}; it cannot submit a sketch`)
  let files: Awaited<ReturnType<typeof readSketch>>
  try {
    files = await readSketch(inside(run.projectDir, 'sketch'))
  } catch (error) {
    throw new Error(`sketch/ is not readable: ${error instanceof Error ? error.message : error}`)
  }
  const attempt = await spendSubmission(run.projectDir)
  const { status, body } = await call<Json>(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/sketch`, { files, attempt, budget: PLANNING_SUBMISSION_BUDGET, ...(run.runId ? { runId: run.runId } : {}) })
  await writeFile(join(run.projectDir, 'planning', `sketch.report.${attempt}.json`), JSON.stringify({ status, ...withoutFrames(body) }, null, 2)).catch(() => {})
  if (status === 422) return refused(run.projectDir, attempt, body)
  if (status >= 400) throw new Error(String(body.error || `The studio answered ${status}`))
  return { accepted: true, status: body.status, warnings: body.warnings, next: 'Accepted. Stop the run now; the creator watches the preview in the product.' }
}

// ——— Production (P4): a scene produced from its approved plan ———
const productionContextTool = async (args: Json, context: Context) => {
  const run = await runOf(args)
  if (run.route !== 'Produce Scene') throw new Error(`This run is for route ${run.route}; it is not a production run`)
  // As for a plan: the product notes that the run read its packet, and the
  // creator sees the build begin (U3). Its answer never holds the run up.
  void call(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/progress`, { runId: run.runId, milestone: 'context' }).catch(() => undefined)
  return {
    route: run.route,
    record: run.recordId,
    packet: run.files,
    writes: 'production/index.html, production/manifest.json, production/audio/ (a generated voice, unchanged) and production/assets/. A take is supplied by the product at media/take.webm: never write under production/media/.',
    contract: 'references/production-contract.md',
    submissionBudget: PLANNING_SUBMISSION_BUDGET,
    boundary: 'Produce the approved plan on the clock in CLOCK.json: no re-planning, no audio made or changed, no recording, no generated artwork, no approval or export. Stop when the production is accepted.',
  }
}

const submitProduction = async (args: Json, context: Context) => {
  const run = await runOf(args)
  if (run.route !== 'Produce Scene') throw new Error(`This run is for route ${run.route}; it cannot submit a produced scene`)
  let files: Awaited<ReturnType<typeof readSketch>>
  try {
    files = await readSketch(inside(run.projectDir, 'production'))
  } catch (error) {
    throw new Error(`production/ is not readable: ${error instanceof Error ? error.message : error}`)
  }
  const attempt = await spendSubmission(run.projectDir)
  const { status, body } = await call<Json>(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/production`, { files, attempt, budget: PLANNING_SUBMISSION_BUDGET, ...(run.runId ? { runId: run.runId } : {}) })
  await writeFile(join(run.projectDir, 'planning', `production.report.${attempt}.json`), JSON.stringify({ status, ...withoutFrames(body) }, null, 2)).catch(() => {})
  if (status === 422) return refused(run.projectDir, attempt, body)
  if (status >= 400) throw new Error(String(body.error || `The studio answered ${status}`))
  return { accepted: true, status: body.status, warnings: body.warnings, next: 'Accepted. Stop the run now; the creator watches the produced scene and accepts it in the product.' }
}

const assetsTool = async (_args: Json, context: Context) => {
  const { body } = await call<{ assets?: Array<Json> }>(context, '/api/appearance/library')
  return {
    assets: (body.assets || [])
      .filter(asset => asset.accepted)
      .map(asset => {
        const brief = (asset.brief || {}) as Json
        const parts = (asset.parts || []) as Array<{ id?: string; as?: string }>
        return {
          key: asset.key,
          entity: asset.entity,
          represents: brief.represents || brief.role || '',
          parts: parts.map(part => part.as || part.id),
        }
      }),
  }
}

const submit = (kind: 'brief' | 'treatment') => async (args: Json, context: Context) => {
  const run = await runOf(args)
  if ((kind === 'brief') !== (run.route === 'Prepare Brief')) {
    throw new Error(`This run is for route ${run.route}; it cannot submit a ${kind === 'brief' ? 'brief' : 'scene plan'}`)
  }
  const file = typeof args.path === 'string' && args.path ? args.path : kind === 'brief' ? 'planning/brief.json' : 'planning/treatment.json'
  let content: unknown
  try {
    content = JSON.parse(await readFile(inside(run.projectDir, file), 'utf8'))
  } catch (error) {
    throw new Error(`${file} is not readable JSON: ${error instanceof Error ? error.message : error}`)
  }
  const attempt = await spendSubmission(run.projectDir)
  const { status, body } = await call<Json>(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/${kind}`, { [kind]: content, attempt, budget: PLANNING_SUBMISSION_BUDGET, ...(run.runId ? { runId: run.runId } : {}) })
  // Keep the product's answer beside the work, for the creator's raw view.
  await writeFile(join(run.projectDir, 'planning', `${kind}.report.${attempt}.json`), JSON.stringify({ status, ...body }, null, 2)).catch(() => {})
  if (status === 422) return refused(run.projectDir, attempt, body)
  if (status >= 400) throw new Error(String(body.error || `The studio answered ${status}`))
  return {
    accepted: true,
    status: body.status,
    ...(body.note ? { note: body.note } : {}),
    warnings: body.warnings,
    ...(body.constructionRisks ? { constructionRisks: body.constructionRisks } : {}),
    next: 'Accepted. Stop the run now; the creator reviews it in the product.',
  }
}

const common = { projectDir: { type: 'string', description: 'The absolute run directory' } }

export const PLANNING_TOOLS: Array<{
  name: string
  description: string
  inputSchema: Json
  call: (args: Json, context: Context) => Promise<unknown>
}> = [
  { name: 'plan_context', description: 'Read this planning run\'s route, its packet files, the file to write and the contract the product checks.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: contextTool },
  { name: 'plan_assets', description: 'List the accepted, reusable objects in the asset library — what each represents and its named parts. Read-only.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: assetsTool },
  {
    name: 'plan_publish_draft',
    description: 'Publish a settled section of this scene plan while you work, before handing the plan in: section "explanation" with question and takeaway, or section "moments" with the moments planned so far, each {id, title, summary}. The creator sees it as a draft still being checked. It never replaces plan_submit_treatment.',
    inputSchema: {
      type: 'object',
      properties: {
        ...common,
        section: { type: 'string', enum: ['explanation', 'moments'] },
        question: { type: 'string' },
        takeaway: { type: 'string' },
        moments: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' } }, required: ['id', 'title'] } },
      },
      required: ['projectDir', 'section'],
    },
    call: publishDraftTool,
  },
  { name: 'plan_submit_brief', description: 'Hand planning/brief.json to the product. It is checked against the pinned inputs; the answer is accepted, or the problems to fix.', inputSchema: { type: 'object', properties: { ...common, path: { type: 'string' } }, required: ['projectDir'] }, call: submit('brief') },
  { name: 'plan_submit_sketch', description: 'Hand the sketch/ folder (index.html, manifest.json, assets) — a rough, seekable preview of one scene plan — to the product. It is checked against the plan and the pinned runtime; the answer is accepted, or the problems to fix.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: submitSketch },
  { name: 'plan_submit_treatment', description: 'Hand planning/treatment.json (this scene\'s creative plan) to the product. It is checked against the brief and the pinned catalog; the answer is accepted, or the problems to fix.', inputSchema: { type: 'object', properties: { ...common, path: { type: 'string' } }, required: ['projectDir'] }, call: submit('treatment') },
]

export const PLANNING_TOOL_NAMES = new Set(PLANNING_TOOLS.map(tool => tool.name))

// A production run's tools: its context, the accepted library, and the
// submission of the produced scene.
export const PRODUCTION_TOOLS: typeof PLANNING_TOOLS = [
  { name: 'produce_context', description: 'Read this production run\'s route, its packet files, what to write and the contract the product checks.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: productionContextTool },
  { name: 'produce_assets', description: 'List the accepted, reusable objects in the asset library — what each represents and its named parts. Read-only.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: assetsTool },
  { name: 'produce_submit_scene', description: 'Hand the production/ folder (index.html, manifest.json, the clock\'s sound in audio/, assets) — the scene produced from its approved plan — to the product. It is checked against the plan, the clock and the pinned runtime, and played; the answer is accepted, or the problems to fix.', inputSchema: { type: 'object', properties: common, required: ['projectDir'] }, call: submitProduction },
]
export const PRODUCTION_TOOL_NAMES = new Set(PRODUCTION_TOOLS.map(tool => tool.name))
