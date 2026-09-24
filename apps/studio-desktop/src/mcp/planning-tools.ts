// Studio tools for a planning run (M0). These are the only studio tools a
// planning run is offered: read its context, read the accepted asset
// library, and hand a brief or a scene plan to the product, which checks it
// and keeps it or answers with problems. Nothing here generates artwork,
// audio, recordings, compositions or exports.
//
// The record a run submits to is read from the run's own inputs file, never
// taken from the harness's arguments, so a run can only answer for the
// brief or scene it was started for. Submissions are budgeted.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

const contextTool = async (args: Json) => {
  const run = await runOf(args)
  return {
    route: run.route,
    record: run.recordId,
    packet: run.files,
    writes: run.route === 'Prepare Brief' ? 'planning/brief.json' : 'planning/treatment.json',
    contract: run.route === 'Prepare Brief' ? 'references/brief-contract.md' : 'references/treatment-contract.md',
    submissionBudget: PLANNING_SUBMISSION_BUDGET,
    boundary: 'Planning only: no artwork, narration, recording, composition, finish or export. Stop when the submission is accepted.',
  }
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
  const { status, body } = await call<Json>(context, `/api/planning/records/${encodeURIComponent(run.recordId)}/${kind}`, { [kind]: content, ...(run.runId ? { runId: run.runId } : {}) })
  // Keep the product's answer beside the work, for the creator's raw view.
  await writeFile(join(run.projectDir, 'planning', `${kind}.report.${attempt}.json`), JSON.stringify({ status, ...body }, null, 2)).catch(() => {})
  if (status === 422) {
    return { accepted: false, attempt, remaining: PLANNING_SUBMISSION_BUDGET - attempt, problems: body.problems, warnings: body.warnings, next: 'Fix exactly these problems and submit again.' }
  }
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
  { name: 'plan_submit_brief', description: 'Hand planning/brief.json to the product. It is checked against the pinned inputs; the answer is accepted, or the problems to fix.', inputSchema: { type: 'object', properties: { ...common, path: { type: 'string' } }, required: ['projectDir'] }, call: submit('brief') },
  { name: 'plan_submit_treatment', description: 'Hand planning/treatment.json (this scene\'s creative plan) to the product. It is checked against the brief and the pinned catalog; the answer is accepted, or the problems to fix.', inputSchema: { type: 'object', properties: { ...common, path: { type: 'string' } }, required: ['projectDir'] }, call: submit('treatment') },
]

export const PLANNING_TOOL_NAMES = new Set(PLANNING_TOOLS.map(tool => tool.name))
