// The planning service (M0): a video notebook's Explanation Brief and each
// scene's creative plan, from queue to review.
//
// Queueing pins every input the run will read — the fork's base snapshot,
// the retained source revision, the scenes' words, the theme, the creator's
// direction and delivery choices, the pinned skill bundle — and materialises
// the packet the harness reads as a durable object, so a retry or a reopened
// app reads exactly what the run read. A submitted result is checked against
// those pinned inputs and lands only if it is still the newest run for its
// subject and its inputs are still current; otherwise it is kept, marked
// superseded, and never shown as current. Every status change is a
// compare-and-swap. Reviewing a plan changes its status and nothing else: no
// artwork, narration, recording, construction or export is started here.
import type { Readable } from 'node:stream'
import type { ProjectDocumentV1, TiptapNode } from 'markdown-composition'
import {
  claimPlanningRecord,
  getObject,
  listPlanningInputs,
  listPlanningRecords,
  listPlanningRecordsForRun,
  loadPlanningRecord,
  loadProjectArtifact,
  loadSourceRevision,
  savePlanningInput,
  storeAsset,
  updatePlanningRecord,
  type PlanningInputRow,
} from './persistence'
import { skillVersions } from './skill-versions'
import { listArtwork } from './appearance-library'
import { fingerprintOf } from '../src/planning/fingerprint'
import { validateBrief, type BriefContext, type ExplanationBriefV1 } from '../src/planning/explanation-brief'
import { validateTreatment, type SceneTreatmentV1, type TreatmentContext } from '../src/planning/scene-treatment'
import { renderExplanation, renderNativeBrief, renderScenePacket } from '../src/planning/brief-adapter'
import {
  ACTIVE_STATUSES,
  PLANNING_SCHEMA,
  briefFingerprint,
  briefFreshness,
  currentBrief,
  landingFor,
  scenePlanningView,
  treatmentFingerprint,
  treatmentFreshness,
  type BriefInputs,
  type PlanningRecord,
  type SkillBundleRef,
  type TreatmentInputs,
} from '../src/planning/planning-records'
import type { CapabilityCatalog } from '../src/planning/capability-catalog'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

export class PlanningError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly detail?: unknown) {
    super(message)
  }
}

const PLANNER_SKILL = 'video-planner'
const SCENE_TYPES = new Set(['scene', 'slide', 'explainer'])

// ——— The pinned skill bundle ———
type Bundle = { ref: SkillBundleRef; catalog: CapabilityCatalog; skills: string[]; references: string[] }

const loadBundle = async (): Promise<Bundle | null> => {
  const root = process.env.STUDIO_SKILLS_DIR
  if (!root) return null
  const dir = join(root, PLANNER_SKILL)
  const version = (await skillVersions()).find(entry => entry.name === PLANNER_SKILL)
  if (!version) return null
  const manifest = JSON.parse(await readFile(join(dir, 'hyperframes', 'manifest.json'), 'utf8')) as { commit: string; files: Array<{ path: string }> }
  const catalog = JSON.parse(await readFile(join(dir, 'capabilities.json'), 'utf8')) as CapabilityCatalog
  const references = manifest.files.map(file => file.path).filter(path => path.startsWith('skills/'))
  const skills = [...new Set(references.map(path => path.split('/')[1]))]
  return { ref: { name: PLANNER_SKILL, version: version.version, hash: version.hash, upstreamCommit: manifest.commit }, catalog, skills, references }
}

// ——— What a video notebook pins ———
const readStream = async (stream: Readable) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

const scenesOf = (project: ProjectDocumentV1) =>
  (project.notebook?.content || []).filter(node => SCENE_TYPES.has(node.type) && node.attrs?.id) as TiptapNode[]

const attr = (node: TiptapNode, key: string) => (node.attrs as Record<string, unknown> | undefined)?.[key]
const stringAttr = (node: TiptapNode, key: string) => String(attr(node, key) ?? '').trim()

type PinnedPage = {
  scene: string
  title: string
  idea: string
  narration: string
  sourcePassages: string[]
  wireframe: string | null
  // Presentation-only metadata, shown as such and never used to plan video.
  presentationKind: string
  svg: string
}

export type VideoPlanning = {
  project: ProjectDocumentV1
  baseTitle: string
  basePages: PinnedPage[]
  // A limitation worth telling the planner, when the pinned base is gone.
  baseLimitation: string | null
  videoScenes: Array<{ id: string; title: string; index: number; originScenes: string[]; script: string }>
  source: { revision: string | null; text: string; kind: string; title: string; site: string; url: string }
  wordingPolicy: 'preserve' | 'assist' | 'draft'
  themeRef: string | null
  requestedSeconds: number | null
  inputs: PlanningInputRow[]
  bundle: Bundle | null
}

const pagesFrom = (base: ProjectDocumentV1): PinnedPage[] =>
  scenesOf(base).map(node => {
    const id = stringAttr(node, 'id')
    const outline = base.outline?.scenes.find(scene => scene.nodeId === id)
    const passages = attr(node, 'sourcePassages')
    return {
      scene: id,
      title: stringAttr(node, 'title') || outline?.title || '',
      idea: stringAttr(node, 'directorNotes') || outline?.idea || '',
      narration: stringAttr(node, 'script'),
      sourcePassages: (Array.isArray(passages) ? passages : outline?.source || []).map(String).filter(Boolean),
      wireframe: stringAttr(node, 'svg') ? `pages/${id}.svg` : null,
      presentationKind: outline?.kind || stringAttr(node, 'kind'),
      svg: stringAttr(node, 'svg'),
    }
  })

export const loadVideoPlanning = async (projectId: string): Promise<VideoPlanning> => {
  const project = await loadProjectArtifact(projectId)
  if (!project) throw new PlanningError('Notebook not found', 404)
  if (!project.derivedFrom?.notebook) {
    throw new PlanningError('Planning belongs to a video notebook: create a video fork of this base first', 409)
  }
  // The base as it was when the video was made, not as it is now.
  let base: ProjectDocumentV1 | null = null
  let baseLimitation: string | null = null
  const snapshotKey = project.derivedFrom.snapshot?.objectKey
  if (snapshotKey) {
    try {
      base = JSON.parse((await readStream((await getObject(snapshotKey)).stream)).toString('utf8')) as ProjectDocumentV1
    } catch {
      baseLimitation = 'The pinned base snapshot could not be read; the current base is used instead.'
    }
  } else {
    baseLimitation = 'This video has no pinned base snapshot; the current base is used instead.'
  }
  if (!base) base = await loadProjectArtifact(project.derivedFrom.notebook)
  if (!base) throw new PlanningError('The base notebook of this video no longer exists', 409)

  const videoScenes = scenesOf(project).map((node, index) => {
    const origin = attr(node, 'origin') as { scene?: string; scenes?: string[] } | undefined
    return {
      id: stringAttr(node, 'id'),
      title: stringAttr(node, 'title'),
      index,
      originScenes: (origin?.scenes?.length ? origin.scenes : origin?.scene ? [origin.scene] : []).map(String),
      script: stringAttr(node, 'script'),
    }
  })

  const sourceRevision = project.source?.snapshotId || null
  let sourceText = ''
  if (sourceRevision) {
    const revision = (await loadSourceRevision(sourceRevision)) as { content?: { text?: unknown } } | null
    sourceText = String(revision?.content?.text || '')
  }
  const wordingPolicy = (['preserve', 'assist', 'draft'] as const).find(policy => policy === project.story?.wordingPolicy) || 'draft'
  return {
    project,
    baseTitle: base.title,
    basePages: pagesFrom(base),
    baseLimitation,
    videoScenes,
    source: {
      revision: sourceRevision,
      text: sourceText,
      kind: project.source?.kind || 'unknown',
      title: project.source?.title || project.title,
      site: project.source?.site || '',
      url: project.source?.url || '',
    },
    wordingPolicy,
    themeRef: project.theme ? `${project.theme.id}:${fingerprintOf(project.theme)}` : null,
    requestedSeconds: project.outline?.targetSeconds && project.outline.targetSeconds > 0 ? Math.round(project.outline.targetSeconds) : null,
    inputs: await listPlanningInputs(projectId),
    bundle: await loadBundle(),
  }
}

const directionFor = (planning: VideoPlanning, subject: string) => planning.inputs.find(row => row.subject === subject)?.direction || ''
const deliveryFor = (planning: VideoPlanning, scene: string) => {
  const value = planning.inputs.find(row => row.subject === scene)?.delivery
  return value === 'human' || value === 'generated' || value === 'silent' ? value : null
}
const sceneDecisionsOf = (planning: VideoPlanning) =>
  planning.videoScenes
    .map(scene => ({ scene: scene.id, voice: deliveryFor(planning, scene.id) }))
    .filter((entry): entry is { scene: string; voice: 'human' | 'generated' | 'silent' } => entry.voice !== null)

// ——— Current fingerprints ———
export const briefInputsOf = (planning: VideoPlanning): BriefInputs => ({
  schema: PLANNING_SCHEMA,
  baseNotebook: planning.project.derivedFrom!.notebook,
  baseRevision: planning.project.derivedFrom!.baseRevision || '',
  sourceRevision: planning.source.revision,
  narrativeRevision: planning.project.story?.narrativeId || null,
  modelRevision: planning.project.story?.modelId || null,
  wordingPolicy: planning.wordingPolicy,
  scripts: planning.videoScenes.map(scene => ({ scene: scene.id, text: scene.script })),
  themeRef: planning.themeRef,
  requestedSeconds: planning.requestedSeconds,
  videoDirection: directionFor(planning, ''),
  sceneDecisions: sceneDecisionsOf(planning),
  bundleHash: planning.bundle?.ref.hash || '',
})

export const treatmentInputsOf = (planning: VideoPlanning, brief: PlanningRecord, sceneId: string): TreatmentInputs => {
  const scene = planning.videoScenes.find(entry => entry.id === sceneId)
  if (!scene) throw new PlanningError(`Scene ${sceneId} is not in this video`, 404)
  return {
    schema: PLANNING_SCHEMA,
    briefId: brief.id,
    briefFingerprint: brief.fingerprint,
    scene: scene.id,
    originScenes: scene.originScenes,
    direction: directionFor(planning, scene.id),
    videoDirection: directionFor(planning, ''),
    themeRef: planning.themeRef,
    delivery: deliveryFor(planning, scene.id),
    bundleHash: planning.bundle?.ref.hash || '',
    script: scene.script,
  }
}

// The one freshness check. The workspace, queueing, landing and review all
// ask it, so none of them can disagree about what is current.
const freshnessOf = (planning: VideoPlanning, records: PlanningRecord[]) => {
  const brief = currentBrief(records)
  const briefNow = briefInputsOf(planning)
  const briefFresh = briefFreshness(brief, briefNow)
  const sceneNow = (sceneId: string) => ({ briefFresh, inputs: brief ? treatmentInputsOf(planning, brief, sceneId) : null })
  return {
    brief,
    briefNow,
    briefFresh,
    sceneNow,
    treatment: (record: PlanningRecord) => treatmentFreshness(record, { brief, ...sceneNow(record.subject) }),
  }
}

// ——— The overview the workspace reads ———
export const planningOverview = async (projectId: string) => {
  const planning = await loadVideoPlanning(projectId)
  const records = await listPlanningRecords(projectId)
  const fresh = freshnessOf(planning, records)
  const brief = fresh.brief
  return {
    projectId,
    available: Boolean(planning.bundle),
    bundle: planning.bundle?.ref || null,
    baseTitle: planning.baseTitle,
    baseLimitation: planning.baseLimitation,
    brief: {
      current: brief,
      latest: records.filter(record => record.kind === 'brief').sort((a, b) => b.revision - a.revision)[0] || null,
      stale: Boolean(brief && !fresh.briefFresh.fresh),
      staleBecause: brief && !fresh.briefFresh.fresh ? fresh.briefFresh.reason : null,
    },
    scenes: planning.videoScenes.map(scene => ({
      ...scene,
      direction: directionFor(planning, scene.id),
      delivery: deliveryFor(planning, scene.id),
      view: scenePlanningView(records, scene.id, fresh.sceneNow(scene.id)),
    })),
    videoDirection: directionFor(planning, ''),
    basePages: planning.basePages,
    records,
  }
}

// ——— Packets: exactly what the harness reads ———
const numberedSource = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => `¶${index + 1}  ${paragraph}`)
    .join('\n\n')

const briefContextOf = (planning: VideoPlanning): BriefContext & { videoScenes: VideoPlanning['videoScenes'] } => ({
  baseSceneIds: planning.basePages.map(page => page.scene),
  sourceRevision: planning.source.revision,
  sourceText: planning.source.text,
  // The creator's own words. A base page's notes are the presentation's
  // layout notes for its slides and presenter: reference, never quotable as
  // the creator's.
  creatorText: [
    planning.source.kind === 'narrative' ? planning.source.text : '',
    ...planning.videoScenes.map(scene => scene.script),
    ...planning.basePages.map(page => page.narration),
    ...planning.inputs.map(row => row.direction),
  ].filter(Boolean).join('\n\n'),
  wordingPolicy: planning.wordingPolicy,
  // The words the video's scenes speak, keyed by video scene: what a
  // preserved wording keeps verbatim.
  scripts: planning.videoScenes.filter(scene => scene.script).map(scene => ({ scene: scene.id, text: scene.script })),
  baseNotebookRef: planning.project.derivedFrom!.notebook,
  baseRevision: planning.project.derivedFrom!.baseRevision || '',
  themeRef: planning.themeRef,
  sceneDecisions: sceneDecisionsOf(planning),
  requestedSeconds: planning.requestedSeconds,
  videoScenes: planning.videoScenes,
})

const briefPacket = (planning: VideoPlanning) => {
  const context = briefContextOf(planning)
  const files: Record<string, string> = {
    'packet/CONTEXT.json': JSON.stringify(
      {
        route: 'Prepare Brief',
        video: { id: planning.project.id, title: planning.project.title },
        baseNotebook: context.baseNotebookRef,
        baseRevision: context.baseRevision,
        baseTitle: planning.baseTitle,
        basePages: planning.basePages.map(page => ({ scene: page.scene, title: page.title })),
        videoScenes: planning.videoScenes.map(scene => ({ id: scene.id, title: scene.title, originScenes: scene.originScenes })),
        sourceRevision: context.sourceRevision,
        narrativeRevision: planning.project.story?.narrativeId || null,
        wordingPolicy: context.wordingPolicy,
        themeRef: context.themeRef,
        requestedSeconds: context.requestedSeconds,
        sceneDecisions: context.sceneDecisions,
        videoDirection: directionFor(planning, ''),
        limitations: [
          ...(planning.baseLimitation ? [planning.baseLimitation] : []),
          ...(planning.source.text ? [] : ['Only fragments of the source were retained: the per-page source passages in PRESENTATION.md.']),
        ],
      },
      null,
      2,
    ),
    'packet/SOURCE.md': planning.source.text
      ? `# ${planning.source.title}\n\n${planning.source.site ? `From ${planning.source.site}${planning.source.url ? ` — ${planning.source.url}` : ''}. ` : ''}Retained source revision \`${planning.source.revision}\`, paragraph-numbered.\n\n${numberedSource(planning.source.text)}\n`
      : `# Source\n\nThe full source was not retained for this notebook. Only the passages attached to each base page survive; they are listed in PRESENTATION.md.\n`,
    'packet/NARRATIVE.md': [
      '# What the creator wrote',
      '',
      planning.source.kind === 'narrative' ? `## The narrative they supplied\n\n${planning.source.text}\n` : '',
      '## Scene scripts (the words each scene speaks now)',
      '',
      ...planning.videoScenes.map(scene => `### ${scene.id}: ${scene.title}\n\n${scene.script || '_No script._'}\n`),
      '## Direction for the video',
      '',
      directionFor(planning, '') || '_None given._',
      '',
      ...(planning.inputs.some(row => row.subject && row.direction)
        ? ['## Direction for individual scenes', '', ...planning.inputs.filter(row => row.subject && row.direction).map(row => `- ${row.subject}: ${row.direction}`), '']
        : []),
    ].join('\n'),
    'packet/PRESENTATION.md': [
      '# The base presentation (reference only)',
      '',
      'These are the pages the presentation designer drew and what each was given. They divide the material for slides; they are a storyboard and a lineage map, not the video\'s scenes, layouts or durations. Each page\'s notes were written for the slide\'s layout and presenter — reference only, not the creator\'s decisions for the video.',
      '',
      ...planning.basePages.map(page =>
        [
          `## ${page.scene}: ${page.title}`,
          '',
          page.idea ? `Page notes (slide layout, reference only): ${page.idea}` : '',
          page.narration ? `Narration: ${page.narration}` : '',
          ...(page.sourcePassages.length ? ['', 'Source passages:', ...page.sourcePassages.map(passage => `- "${passage}"`)] : []),
          '',
        ].join('\n'),
      ),
    ].join('\n'),
  }
  return { files, context }
}

const scenePacket = async (planning: VideoPlanning, briefRecord: PlanningRecord, sceneId: string, records: PlanningRecord[]) => {
  const brief = briefRecord.content as ExplanationBriefV1
  const scene = planning.videoScenes.find(entry => entry.id === sceneId)!
  const unitsFor = (origins: string[]) =>
    [...new Set(brief.coverage.filter(entry => origins.includes(entry.scene)).flatMap(entry => entry.units))]
  const reviewedOf = (id: string) => scenePlanningView(records, id, null).reviewed
  const neighbours = [
    { position: 'before' as const, scene: planning.videoScenes[scene.index - 1] },
    { position: 'after' as const, scene: planning.videoScenes[scene.index + 1] },
  ].filter(entry => entry.scene)
  const reviewed = reviewedOf(scene.id)
  const assets = await libraryAssets()
  const packet = renderScenePacket({
    videoTitle: planning.project.title,
    scene: { id: scene.id, title: scene.title, index: scene.index, originScenes: scene.originScenes },
    presentation: planning.basePages
      .filter(page => scene.originScenes.includes(page.scene))
      .map(({ scene: id, title, idea, narration, sourcePassages, wireframe }) => ({ scene: id, title, idea, narration, sourcePassages, wireframe })),
    script: scene.script,
    units: unitsFor(scene.originScenes),
    adjacent: neighbours.map(entry => ({
      position: entry.position,
      id: entry.scene!.id,
      title: entry.scene!.title,
      units: unitsFor(entry.scene!.originScenes),
      takeaway: (reviewedOf(entry.scene!.id)?.content as SceneTreatmentV1 | null)?.takeaway || null,
    })),
    direction: { video: directionFor(planning, ''), scene: directionFor(planning, scene.id) },
    delivery: deliveryFor(planning, scene.id),
    reviewed: (reviewed?.content as SceneTreatmentV1 | null) || null,
    assets,
  })
  const files: Record<string, string> = {
    'packet/BRIEF.md': renderNativeBrief(brief),
    'packet/EXPLANATION.md': renderExplanation(brief),
    'packet/SCENE.md': packet,
    'packet/CONTEXT.json': JSON.stringify(
      {
        route: 'Plan Scene',
        video: { id: planning.project.id, title: planning.project.title },
        scene: { id: scene.id, title: scene.title, originScenes: scene.originScenes },
        videoScenes: planning.videoScenes.map(entry => entry.id),
        briefRecord: briefRecord.id,
        delivery: deliveryFor(planning, scene.id),
        assetKeys: assets.map(asset => asset.key),
      },
      null,
      2,
    ),
  }
  return files
}

// The accepted object library a plan may reuse from: what each object is,
// and the named parts a performance can drive.
const libraryAssets = async () =>
  (await listArtwork().catch(() => []))
    .filter(asset => asset.accepted)
    .map(asset => ({
      key: asset.key,
      role: `${asset.entity}: ${asset.brief?.represents || asset.brief?.role || 'object'}`,
      parts: (asset.parts || []).map(part => part.as || part.id),
    }))

const storePacket = async (projectId: string, files: Record<string, string>) =>
  storeAsset({
    body: Buffer.from(JSON.stringify({ files }), 'utf8'),
    contentType: 'application/json; charset=utf-8',
    projectId,
    kind: 'planning-packet',
    extension: '.json',
  })

export const loadPacket = async (recordId: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record) throw new PlanningError('Planning record not found', 404)
  const key = String(record.inputs.packetObjectKey || '')
  if (!key) throw new PlanningError('This planning record has no packet', 409)
  const packet = JSON.parse((await readStream((await getObject(key)).stream)).toString('utf8')) as { files: Record<string, string> }
  return { record, route: record.kind === 'brief' ? 'Prepare Brief' : 'Plan Scene', files: packet.files }
}

// ——— Queueing ———
// The same inputs queued twice are one run: a second click, a retry after a
// dropped response, or a refreshed page gets the record already running.
const reuseActive = (records: PlanningRecord[], kind: PlanningRecord['kind'], subject: string, fingerprint: string) =>
  records.find(record => record.kind === kind && record.subject === subject && ACTIVE_STATUSES.includes(record.status) && record.fingerprint === fingerprint) || null

export const queueBrief = async (projectId: string) => {
  const planning = await loadVideoPlanning(projectId)
  if (!planning.bundle) throw new PlanningError('Planning runs in the desktop app, where the pinned skill bundle and your local harness are', 409)
  const records = await listPlanningRecords(projectId)
  const inputs = briefInputsOf(planning)
  const fingerprint = briefFingerprint(inputs)
  const existing = reuseActive(records, 'brief', '', fingerprint)
  if (existing) return { record: existing, reused: true }
  const { files } = briefPacket(planning)
  const packet = await storePacket(projectId, files)
  return claimPlanningRecord({
    projectId,
    kind: 'brief',
    subject: '',
    fingerprint,
    inputs: { ...inputs, packetObjectKey: packet.objectKey },
    direction: inputs.videoDirection,
    skillBundle: planning.bundle.ref,
  })
}

export const queueTreatment = async (projectId: string, sceneId: string) => {
  const planning = await loadVideoPlanning(projectId)
  if (!planning.bundle) throw new PlanningError('Planning runs in the desktop app, where the pinned skill bundle and your local harness are', 409)
  const records = await listPlanningRecords(projectId)
  const fresh = freshnessOf(planning, records)
  const brief = fresh.brief
  if (!brief) throw new PlanningError('Prepare the video\'s explanation brief before planning a scene', 409)
  // A plan made from a stale brief could never become current.
  if (!fresh.briefFresh.fresh) throw new PlanningError(`The explanation brief is stale: ${fresh.briefFresh.reason}. Prepare it again before planning scenes.`, 409)
  const inputs = treatmentInputsOf(planning, brief, sceneId)
  const fingerprint = treatmentFingerprint(inputs)
  const existing = reuseActive(records, 'treatment', sceneId, fingerprint)
  if (existing) return { record: existing, reused: true }
  const files = await scenePacket(planning, brief, sceneId, records)
  const packet = await storePacket(projectId, files)
  return claimPlanningRecord({
    projectId,
    kind: 'treatment',
    subject: sceneId,
    fingerprint,
    inputs: { ...inputs, packetObjectKey: packet.objectKey },
    direction: inputs.direction,
    skillBundle: planning.bundle.ref,
    workflow: (brief.content as ExplanationBriefV1).route.workflow,
  })
}

// The run that serves a record claims it as it starts: queued → running,
// once. The same run asking again (a retry after a lost response) gets the
// record; any other run is refused, so a record never changes owner.
export const attachRun = async (recordId: string, run: { runId: string; adapter?: string; model?: string }) => {
  const claimed = await updatePlanningRecord(recordId, { status: 'running', runId: run.runId, adapter: run.adapter || null, model: run.model || null }, ['queued'], { runId: null })
  if (claimed) return claimed
  const record = await loadPlanningRecord(recordId)
  if (!record) throw new PlanningError('Planning record not found', 404)
  if (record.status === 'running' && record.runId === run.runId) return record
  if (ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This planning request is already running as ${record.runId}`, 409)
  throw new PlanningError(`This planning record already finished as ${record.status}`, 409)
}

// The model the owning run's harness session reported. Only the owner may
// say; it changes nothing else about the record.
export const recordReportedModel = async (recordId: string, run: { runId: string; model: string }) => {
  const model = String(run.model || '').slice(0, 200)
  if (!model) throw new PlanningError('A reported model is required', 400)
  const updated = await updatePlanningRecord(recordId, { reportedModel: model }, undefined, { runId: run.runId })
  if (!updated) throw new PlanningError('Only the run that owns this planning record can report its model', 409)
  return updated
}

// A submission must come from the record's own run when it names one.
const assertOwner = (record: PlanningRecord, runId?: string) => {
  if (runId && record.runId && record.runId !== runId) throw new PlanningError('This run does not own the planning record it is submitting to', 409)
}

// ——— Submitting a result ———
const storeResult = async (record: PlanningRecord, files: Record<string, string>) =>
  storeAsset({
    body: Buffer.from(JSON.stringify({ record: record.id, files }), 'utf8'),
    contentType: 'application/json; charset=utf-8',
    projectId: record.projectId,
    kind: `planning-${record.kind}`,
    extension: '.json',
  })

// Rebuilds the check's context from what the record pinned, not from now:
// the source revision, the words and the choices the run was given, even if
// the notebook has moved on since. Moving on is caught by the landing check.
const pinnedBriefContext = async (record: PlanningRecord) => {
  const planning = await loadVideoPlanning(record.projectId)
  const context = briefContextOf(planning)
  const pinned = record.inputs as unknown as BriefInputs
  if ((pinned.sourceRevision || null) !== context.sourceRevision) {
    context.sourceRevision = pinned.sourceRevision || null
    const revision = pinned.sourceRevision ? ((await loadSourceRevision(pinned.sourceRevision)) as { content?: { text?: unknown } } | null) : null
    context.sourceText = String(revision?.content?.text || '')
  }
  context.scripts = (pinned.scripts || []).filter(entry => entry.text)
  context.sceneDecisions = (pinned.sceneDecisions || []) as BriefContext['sceneDecisions']
  context.requestedSeconds = pinned.requestedSeconds ?? null
  context.themeRef = pinned.themeRef ?? null
  return { planning, context }
}

export const submitBrief = async (recordId: string, raw: unknown, runId?: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'brief') throw new PlanningError('Brief record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This brief already finished as ${record.status}`, 409)
  assertOwner(record, runId)
  const { planning, context } = await pinnedBriefContext(record)
  const report = validateBrief(raw, context)
  if (!report.ok) return { accepted: false as const, problems: report.problems, warnings: report.warnings }
  const records = await listPlanningRecords(record.projectId)
  const landing = landingFor(record, records, briefFreshness(record, briefInputsOf(planning)))
  const artifacts = await storeResult(record, {
    'brief.json': JSON.stringify(report.brief, null, 2),
    'BRIEF.md': renderNativeBrief(report.brief),
    'EXPLANATION.md': renderExplanation(report.brief),
  })
  const status = landing.lands ? 'ready' : 'superseded'
  const updated = await updatePlanningRecord(
    record.id,
    {
      status,
      content: report.brief,
      report: { warnings: report.warnings },
      artifacts,
      workflow: report.brief.route.workflow,
      ...(landing.lands ? {} : { error: { message: landing.reason } }),
    },
    ['queued', 'running'],
    { runId: record.runId },
  )
  if (!updated) throw new PlanningError('This brief finished elsewhere while it was being checked', 409)
  return { accepted: true as const, status, record: updated, warnings: report.warnings, ...(landing.lands ? {} : { note: landing.reason }) }
}

export const submitTreatment = async (recordId: string, raw: unknown, runId?: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'treatment') throw new PlanningError('Scene plan record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This scene plan already finished as ${record.status}`, 409)
  assertOwner(record, runId)
  const planning = await loadVideoPlanning(record.projectId)
  const briefRecord = await loadPlanningRecord(String(record.inputs.briefId || ''))
  if (!briefRecord?.content) throw new PlanningError('The brief this plan was made from is gone', 409)
  const scene = planning.videoScenes.find(entry => entry.id === record.subject)
  if (!scene) throw new PlanningError('This scene is no longer in the video', 409)
  if (!planning.bundle) throw new PlanningError('The pinned skill bundle is not available', 409)
  const context: TreatmentContext = {
    brief: briefRecord.content as ExplanationBriefV1,
    scene: scene.id,
    originScenes: scene.originScenes,
    videoScenes: planning.videoScenes.map(entry => entry.id),
    catalog: planning.bundle.catalog,
    bundleSkills: planning.bundle.skills,
    bundleReferences: planning.bundle.references,
    delivery: ((record.inputs as { delivery?: string | null }).delivery as TreatmentContext['delivery']) ?? null,
    assetKeys: (await libraryAssets()).map(asset => asset.key),
  }
  const report = validateTreatment(raw, context)
  if (!report.ok) return { accepted: false as const, problems: report.problems, warnings: report.warnings }
  const records = await listPlanningRecords(record.projectId)
  const landing = landingFor(record, records, freshnessOf(planning, records).treatment(record))
  const artifacts = await storeResult(record, { 'treatment.json': JSON.stringify(report.treatment, null, 2) })
  const status = landing.lands ? 'candidate' : 'superseded'
  const updated = await updatePlanningRecord(
    record.id,
    {
      status,
      content: report.treatment,
      report: { warnings: report.warnings, constructionRisks: report.constructionRisks },
      artifacts,
      ...(landing.lands ? {} : { error: { message: landing.reason } }),
    },
    ['queued', 'running'],
    { runId: record.runId },
  )
  if (!updated) throw new PlanningError('This scene plan finished elsewhere while it was being checked', 409)
  return { accepted: true as const, status, record: updated, warnings: report.warnings, constructionRisks: report.constructionRisks, ...(landing.lands ? {} : { note: landing.reason }) }
}

// ——— The creator's steps ———
export const reviewTreatment = async (recordId: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'treatment') throw new PlanningError('Scene plan record not found', 404)
  if (record.status !== 'candidate') throw new PlanningError(`Only a candidate plan can be marked reviewed (this one is ${record.status})`, 409)
  const planning = await loadVideoPlanning(record.projectId)
  const records = await listPlanningRecords(record.projectId)
  const freshness = freshnessOf(planning, records).treatment(record)
  if (!freshness.fresh) throw new PlanningError(`This plan is stale: ${freshness.reason}. Generate a new candidate first.`, 409)
  const updated = await updatePlanningRecord(record.id, { status: 'reviewed', reviewedAt: new Date().toISOString() }, ['candidate'])
  if (!updated) throw new PlanningError('This plan changed while it was being reviewed', 409)
  return updated
}

export const failRecord = async (recordId: string, error: NonNullable<PlanningRecord['error']>) => {
  const updated = await updatePlanningRecord(recordId, { status: 'failed', error }, ['queued', 'running'])
  return updated
}

// A run that ended without submitting leaves its records failed, with the
// provider's last word, so the creator sees why and can retry or switch.
export const runFinished = async (runId: string, outcome: { status: string; exitCode?: number | null; error?: string; failure?: { category?: string; message?: string; recovery?: string[] } }) => {
  const records = await listPlanningRecordsForRun(runId)
  const failed: PlanningRecord[] = []
  for (const record of records) {
    if (!ACTIVE_STATUSES.includes(record.status)) continue
    // What happened to the run; the provider's own last word travels apart.
    const message =
      outcome.status === 'cancelled'
        ? 'The run was cancelled before it submitted a result.'
        : outcome.status === 'interrupted'
          ? 'Interrupted: the app closed while this run was working. Retry it; any earlier result is unchanged.'
          : `The run ended (${outcome.status}${outcome.exitCode !== undefined && outcome.exitCode !== null ? `, exit ${outcome.exitCode}` : ''}) without submitting a result.`
    const providerStatus = (outcome.failure?.message || outcome.error || '').replace(/^[\s·:-]+/, '').trim()
    const category = outcome.status === 'interrupted' ? 'interrupted' : outcome.failure?.category
    const recovery = outcome.status === 'interrupted' ? ['Retry'] : outcome.failure?.recovery
    const updated = await failRecord(record.id, { message, ...(providerStatus ? { providerStatus } : {}), ...(category ? { category } : {}), ...(recovery?.length ? { recovery } : {}) })
    if (updated) failed.push(updated)
  }
  return failed
}

export const saveDirection = async (projectId: string, input: { subject: string; direction?: string; delivery?: string | null }) => {
  const planning = await loadVideoPlanning(projectId)
  if (input.subject && !planning.videoScenes.some(scene => scene.id === input.subject)) throw new PlanningError(`Scene ${input.subject} is not in this video`, 404)
  if (input.delivery !== undefined && input.delivery !== null && !['human', 'generated', 'silent'].includes(input.delivery)) {
    throw new PlanningError('Delivery is human, generated, silent or undecided', 400)
  }
  if (!input.subject && input.delivery !== undefined) throw new PlanningError('Delivery is chosen per scene', 400)
  return savePlanningInput({ projectId, subject: input.subject, ...(input.direction !== undefined ? { direction: String(input.direction).slice(0, 4000) } : {}), ...(input.delivery !== undefined ? { delivery: input.delivery } : {}) })
}

// The records the base's reader sees: one child's, read-only.
export const planningForBase = async (baseId: string, childId: string) => {
  const child = await loadProjectArtifact(childId)
  if (!child || child.derivedFrom?.notebook !== baseId) throw new PlanningError('That video notebook was not made from this base', 404)
  return planningOverview(childId)
}

// Files a finished run left, for the raw-artifact view.
export const runArtifacts = async (projectDir: string) => {
  const planningDir = join(projectDir, 'planning')
  const names = await readdir(planningDir).catch(() => [] as string[])
  const files: Record<string, string> = {}
  for (const name of names) {
    const text = await readFile(join(planningDir, name), 'utf8').catch(() => null)
    if (text !== null) files[relative(projectDir, join(planningDir, name))] = text.slice(0, 200_000)
  }
  return files
}
