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
import { continuityStatus, validateTreatment, type NeighborPlan, type SceneTreatmentV1, type TreatmentContext } from '../src/planning/scene-treatment'
import { ensureVisualCast, loadVisualCast, readObject, type CastEntry, type VisualCastRevision } from './visual-cast'
import { SKETCH_RUNTIME, SKETCH_RUNTIME_SCRIPTS, sketchSummary, validateSketch, type SketchFiles, type SketchManifest, type SketchProof } from '../src/planning/sketch-bundle'
import { previewFileBody, verifySketchRuntime } from './sketch-runtime'
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
  type TreatmentInputs, type ScenePlanningView } from '../src/planning/planning-records'
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
  // scriptSource: the plan record whose lines the scene's script was taken from.
  videoScenes: Array<{ id: string; title: string; index: number; originScenes: string[]; script: string; scriptSource: string | null }>
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
      scriptSource: String((attr(node, 'scriptSource') as { treatment?: string } | null | undefined)?.treatment || '') || null,
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
  const sceneNow = (sceneId: string) => ({ briefFresh, inputs: brief ? treatmentInputsOf(planning, brief, sceneId) : null, scriptAdoptedFrom: planning.videoScenes.find(scene => scene.id === sceneId)?.scriptSource || null })
  return {
    brief,
    briefNow,
    briefFresh,
    sceneNow,
    treatment: (record: PlanningRecord) => treatmentFreshness(record, { brief, ...sceneNow(record.subject) }),
  }
}

// ——— The visual cast and the theme a packet carries (P1) ———
// A packet file is text, or bytes — a preview image — carried as base64.
export type PacketFile = string | { base64: string; contentType: string }
export type PacketFiles = Record<string, PacketFile>

const castSourcesOf = (planning: VideoPlanning) =>
  planning.basePages.map(page => ({ scene: page.scene, title: page.title, svg: page.svg, sourcePassages: page.sourcePassages }))
// The cast of this video's pinned base: extracted once per base revision.
export const visualCastFor = (planning: VideoPlanning, options: { retryFailed?: boolean } = {}) =>
  ensureVisualCast({
    notebook: planning.project.derivedFrom!.notebook,
    revision: planning.project.derivedFrom!.baseRevision || '',
    pages: castSourcesOf(planning),
    theme: planning.project.theme,
    ...options,
  })
const knownCast = (planning: VideoPlanning) => loadVisualCast(planning.project.derivedFrom!.notebook, planning.project.derivedFrom!.baseRevision || '')
export const retryVisualCast = async (projectId: string) => visualCastFor(await loadVideoPlanning(projectId), { retryFailed: true })

// The theme's actual tokens, not its id: colours with what each means,
// the type families with their fallbacks, and the shapes it keeps.
const COLOUR_MEANINGS: Record<string, string> = {
  background: 'the ground every scene sits on',
  surface: 'cards and panels on the ground',
  text: 'primary text and labels',
  mutedText: 'secondary text, captions and quiet detail',
  primary: 'the main structural colour of the drawn things',
  secondary: 'a second family, for contrast between things',
  accent: 'emphasis — what the viewer must look at now; keep it one meaning',
  codeBackground: 'code and data blocks',
}
const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i
const themeFile = (planning: VideoPlanning) => {
  const theme = planning.project.theme
  const brand = (theme?.brand || planning.project.brand || {}) as Record<string, string>
  const fonts = theme?.fonts
  return JSON.stringify(
    {
      ref: planning.themeRef,
      name: theme?.name || null,
      colors: Object.fromEntries(Object.entries(brand).filter(([, value]) => typeof value === 'string' && COLOUR.test(value))),
      meanings: Object.fromEntries(Object.entries(brand).filter(([key, value]) => COLOUR_MEANINGS[key] && typeof value === 'string' && COLOUR.test(value)).map(([key]) => [key, COLOUR_MEANINGS[key]])),
      typography: {
        display: fonts?.display || null,
        body: fonts?.body || null,
        mono: fonts?.mono || null,
        fallbacks: { display: 'Inter, system-ui, sans-serif', body: 'Inter, system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
        note: fonts ? 'The families the theme names; where one is not installed, its fallback renders.' : 'The theme names no type families: use the fallbacks.',
      },
      shape: { cornerRadius: theme?.blocks?.borderRadius ?? null, canvas: theme?.canvas || null },
    },
    null,
    2,
  )
}

// What a scene's packet carries of the cast: its pages as reference (SVG
// and a usable preview), the page's contact sheet, and every ingredient's
// standalone artwork, preview and parts. Every path it declares is a file.
// A packet carries the cast of the scene's own pages, plus any entry named
// by library key in castKeys — the artwork a plan chose from elsewhere in the
// base, which a sketch must be able to draw.
const castFiles = async (cast: VisualCastRevision | null, origins: string[], castKeys: string[] = []): Promise<PacketFiles> => {
  if (!cast || cast.status !== 'ready') {
    return {
      'packet/VISUAL_CAST.json': JSON.stringify({ status: cast ? 'failed' : 'not extracted', reason: cast?.error || 'The visual cast has not been extracted.', note: 'Plan from the brief and the scene; name the objects that need artwork in requirements.assets.' }, null, 2),
    }
  }
  const files: PacketFiles = {}
  const pages = cast.pages.filter(page => origins.includes(page.scene))
  const carried = (entry: CastEntry) => origins.includes(entry.identity.base.page) || Boolean(entry.libraryKey && castKeys.includes(entry.libraryKey))
  const entries = cast.entries.filter(carried)
  const bytes = async (objectKey: string) => (await readObject(objectKey)).toString('base64')
  const pageRefs = []
  for (const [index, page] of pages.entries()) {
    const suffix = pages.length > 1 ? `-${index + 1}` : ''
    const reference = `references/page${suffix}.svg`
    const preview = `references/page${suffix}.png`
    const sheet = page.contactSheet ? `references/visual-cast${suffix}.png` : null
    files[`packet/${reference}`] = (await readObject(page.page.objectKey)).toString('utf8')
    files[`packet/${preview}`] = { base64: await bytes(page.preview.objectKey), contentType: 'image/png' }
    if (sheet && page.contactSheet) files[`packet/${sheet}`] = { base64: await bytes(page.contactSheet.objectKey), contentType: 'image/png' }
    pageRefs.push({ scene: page.scene, title: page.title, reference, preview, contactSheet: sheet, furniture: page.furniture.map(item => item.role).filter((role, at, all) => all.indexOf(role) === at), notes: page.notes })
  }
  const entryOf = (entry: CastEntry) => {
    const folder = `assets/${entry.id}`
    return {
      id: entry.id,
      libraryKey: entry.libraryKey,
      kind: entry.kind,
      label: entry.meaning.label,
      detail: entry.meaning.detail,
      entity: entry.identity.entity,
      entityKind: entry.identity.entityKind,
      object: entry.identity.object,
      objectId: entry.identity.objectId,
      page: entry.identity.base.page,
      node: entry.identity.base.node,
      interactions: entry.meaning.interactions,
      parts: entry.parts.map(part => ({ id: part.id, name: part.name, named: part.named, count: part.count, animations: part.animations })),
      rig: { object: entry.rig.object, status: entry.rig.status, missing: entry.rig.pieces.filter(piece => !piece.found).map(piece => piece.id) },
      confidence: entry.confidence,
      verification: { status: entry.verification.status, notes: entry.verification.notes },
      themeBindings: entry.artwork.themeBindings,
      fonts: entry.artwork.fonts,
      size: entry.artwork.viewBox,
      files: { svg: `${folder}/asset.svg`, preview: `${folder}/preview.png`, parts: `${folder}/parts.json` },
    }
  }
  for (const entry of entries) {
    const folder = `packet/assets/${entry.id}`
    files[`${folder}/asset.svg`] = (await readObject(entry.artwork.svg.objectKey)).toString('utf8')
    files[`${folder}/preview.png`] = { base64: await bytes(entry.artwork.thumbnail.objectKey), contentType: 'image/png' }
    files[`${folder}/parts.json`] = JSON.stringify({ parts: entry.parts, rig: entry.rig }, null, 2)
  }
  files['packet/VISUAL_CAST.json'] = JSON.stringify(
    {
      status: 'ready',
      cast: cast.id,
      extractor: cast.version,
      base: cast.base,
      pages: pageRefs,
      entries: entries.map(entryOf),
      // The rest of the base's cast: reusable by library key.
      elsewhere: cast.entries.filter(entry => !carried(entry)).map(entry => ({ id: entry.id, libraryKey: entry.libraryKey, kind: entry.kind, label: entry.meaning.label, page: entry.identity.base.page, verification: entry.verification.status })),
      decide: 'For each thing the scene needs: reuse it unchanged, adapt it (recolour, re-rig), enrich it (a richer version from its silhouette, role and parts), build it native (exact shapes, charts, counts, code), or omit it — with the reason the viewer needs it. A reference-only ingredient (verification mismatch) is not equivalent to the page.',
    },
    null,
    2,
  )
  return files
}

// Every path VISUAL_CAST.json declares must be a file of the packet before
// a run is dispatched with it.
const assertPacketPaths = (files: PacketFiles) => {
  const cast = files['packet/VISUAL_CAST.json']
  if (typeof cast !== 'string') return
  const declared = JSON.parse(cast) as { pages?: Array<Record<string, unknown>>; entries?: Array<{ files?: Record<string, string> }> }
  const paths = [
    ...(declared.pages || []).flatMap(page => [page.reference, page.preview, page.contactSheet]),
    ...(declared.entries || []).flatMap(entry => Object.values(entry.files || {})),
  ].filter((path): path is string => typeof path === 'string' && Boolean(path))
  const missing = paths.filter(path => !(`packet/${path}` in files))
  if (missing.length) throw new PlanningError(`The planning packet declares files it does not carry: ${missing.join(', ')}`, 500)
}

// The adjacent scenes and their plans now (R8): a reviewed plan is what an
// agreed seam can rest on; a candidate or no plan leaves the seam open.
const neighborsOf = (planning: VideoPlanning, records: PlanningRecord[], sceneId: string) => {
  const scene = planning.videoScenes.find(entry => entry.id === sceneId)
  if (!scene) return []
  return [
    { position: 'before' as const, entry: planning.videoScenes[scene.index - 1] },
    { position: 'after' as const, entry: planning.videoScenes[scene.index + 1] },
  ]
    .filter(item => item.entry)
    .map(item => {
      const view = scenePlanningView(records, item.entry!.id, null)
      const reviewedPlan = view.reviewed?.content as SceneTreatmentV1 | null | undefined
      const currentPlan = view.current?.content as SceneTreatmentV1 | null | undefined
      return {
        position: item.position,
        scene: item.entry!.id,
        title: item.entry!.title,
        reviewed: view.reviewed && reviewedPlan ? { recordId: view.reviewed.id, revision: view.reviewed.revision, entry: reviewedPlan.continuity.entry, exit: reviewedPlan.continuity.exit } : null,
        candidate: view.current && view.current.status === 'candidate' && currentPlan ? { recordId: view.current.id, revision: view.current.revision, entry: currentPlan.continuity.entry, exit: currentPlan.continuity.exit } : null,
      }
    })
}
const agreementBasis = (neighbors: ReturnType<typeof neighborsOf>): NeighborPlan[] =>
  neighbors.map(({ position, scene, reviewed }) => ({ position, scene, reviewed }))

// ——— The overview the workspace reads ———
// What the workspace shows of the cast: every ingredient with its preview.
const castSummary = (cast: VisualCastRevision | null) =>
  cast
    ? {
        id: cast.id,
        status: cast.status,
        error: cast.error || null,
        createdAt: cast.createdAt,
        pages: cast.pages.map(page => ({ scene: page.scene, title: page.title, preview: page.preview.url, contactSheet: page.contactSheet?.url || null, notes: page.notes })),
        entries: cast.entries.map(entry => ({
          id: entry.id,
          libraryKey: entry.libraryKey,
          kind: entry.kind,
          label: entry.meaning.label,
          page: entry.identity.base.page,
          node: entry.identity.base.node,
          object: entry.identity.object,
          svg: entry.artwork.svg.url,
          thumbnail: entry.artwork.thumbnail.url,
          parts: entry.parts.map(part => ({ name: part.name, count: part.count, animations: part.animations })),
          rig: entry.rig.status,
          grouping: entry.confidence.grouping,
          checks: entry.confidence.checks,
          verification: entry.verification.status,
        })),
      }
    : { id: null, status: 'extracting' as const, error: null, createdAt: null, pages: [], entries: [] }

export const planningOverview = async (projectId: string) => {
  const planning = await loadVideoPlanning(projectId)
  const records = await listPlanningRecords(projectId)
  const fresh = freshnessOf(planning, records)
  const brief = fresh.brief
  // The cast is extracted in the background the first time it is asked for.
  const cast = await knownCast(planning)
  if (!cast) void visualCastFor(planning).catch(() => {})
  const previewNow = (view: ScenePlanningView, preview: PlanningRecord) => previewFreshness(planning, cast, records, view, preview)
  return {
    visualCast: castSummary(cast),
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
    scenes: planning.videoScenes.map(scene => {
      const view = scenePlanningView(records, scene.id, fresh.sceneNow(scene.id))
      const plan = view.current?.content as SceneTreatmentV1 | null | undefined
      return {
        ...scene,
        direction: directionFor(planning, scene.id),
        delivery: deliveryFor(planning, scene.id),
        view,
        // How the current plan meets its neighbours now: an agreement breaks
        // when the reviewed plan it rests on changes.
        continuity: plan?.continuity ? continuityStatus(plan, agreementBasis(neighborsOf(planning, records, scene.id))) : null,
        preview: previewOf(records, scene.id, preview => previewNow(view, preview)),
      }
    }),
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

// The passages kept on each base page, with the page they belong to: the
// source evidence a run has when the full text was not retained.
const sourceFragmentsOf = (planning: VideoPlanning) =>
  planning.basePages.flatMap(page => page.sourcePassages.map(text => ({ scene: page.scene, text })))

const briefContextOf = (planning: VideoPlanning): BriefContext & { videoScenes: VideoPlanning['videoScenes'] } => ({
  baseSceneIds: planning.basePages.map(page => page.scene),
  sourceRevision: planning.source.revision,
  sourceText: planning.source.text,
  sourceFragments: sourceFragmentsOf(planning),
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
  const fragments = context.sourceFragments || []
  const keptOn = planning.basePages.filter(page => page.sourcePassages.length)
  const sourcePool = planning.source.text
    ? { coverage: 'full' as const }
    : fragments.length
      ? { coverage: 'fragments' as const, passages: fragments.length, pagesWithPassages: keptOn.length, pages: planning.basePages.length }
      : { coverage: 'none' as const }
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
        sourcePool,
        limitations: [
          ...(planning.baseLimitation ? [planning.baseLimitation] : []),
          ...(sourcePool.coverage === 'fragments'
            ? [`Only fragments of the source were retained: ${sourcePool.passages} passages kept on ${sourcePool.pagesWithPassages} of ${sourcePool.pages} base pages, listed by page in SOURCE.md.`]
            : sourcePool.coverage === 'none'
              ? ['Nothing of the source was retained: source claims can rest only on the creator\'s words, or stay open.']
              : []),
        ],
      },
      null,
      2,
    ),
    'packet/THEME.json': themeFile(planning),
    'packet/SOURCE.md': planning.source.text
      ? `# ${planning.source.title}\n\n${planning.source.site ? `From ${planning.source.site}${planning.source.url ? ` — ${planning.source.url}` : ''}. ` : ''}Retained source revision \`${planning.source.revision}\`, paragraph-numbered.\n\n${numberedSource(planning.source.text)}\n`
      : fragments.length
        ? [
            `# ${planning.source.title} — retained fragments`,
            '',
            `The full source was not retained for this notebook. These passages, kept on the base pages, are all the source evidence there is: quote one exactly as \`source\` evidence, and the page it was kept on is recorded with it. A quotation never joins passages from two pages.`,
            '',
            ...keptOn.map(page => [`## ${page.scene}: ${page.title}`, '', ...page.sourcePassages.map(passage => `- "${passage}"`), ''].join('\n')),
            ...(keptOn.length < planning.basePages.length
              ? [`Pages that kept no passage: ${planning.basePages.filter(page => !page.sourcePassages.length).map(page => page.scene).join(', ')}.`, '']
              : []),
          ].join('\n')
        : `# Source\n\nNothing of the source was retained for this notebook — not even passages on the base pages. Source claims can rest only on the creator's words (NARRATIVE.md), or stay open as uncertainty.\n`,
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

const scenePacket = async (planning: VideoPlanning, briefRecord: PlanningRecord, sceneId: string, records: PlanningRecord[], options: { castKeys?: string[] } = {}) => {
  const brief = briefRecord.content as ExplanationBriefV1
  const scene = planning.videoScenes.find(entry => entry.id === sceneId)!
  const unitsFor = (origins: string[]) =>
    [...new Set(brief.coverage.filter(entry => origins.includes(entry.scene)).flatMap(entry => entry.units))]
  const reviewed = scenePlanningView(records, scene.id, null).reviewed
  const neighbors = neighborsOf(planning, records, scene.id)
  const assets = await libraryAssets()
  const packet = renderScenePacket({
    videoTitle: planning.project.title,
    scene: { id: scene.id, title: scene.title, index: scene.index, originScenes: scene.originScenes },
    presentation: planning.basePages
      .filter(page => scene.originScenes.includes(page.scene))
      .map(({ scene: id, title, idea, narration, sourcePassages, wireframe }) => ({ scene: id, title, idea, narration, sourcePassages, wireframe })),
    script: scene.script,
    units: unitsFor(scene.originScenes),
    adjacent: neighbors.map(entry => {
      const origin = planning.videoScenes.find(candidate => candidate.id === entry.scene)!
      const reviewedPlan = entry.reviewed ? (records.find(record => record.id === entry.reviewed!.recordId)?.content as SceneTreatmentV1 | null) : null
      return {
        position: entry.position,
        id: entry.scene,
        title: entry.title,
        units: unitsFor(origin.originScenes),
        takeaway: reviewedPlan?.takeaway || null,
        plan: entry.reviewed
          ? { state: 'reviewed' as const, revision: entry.reviewed.revision, entry: entry.reviewed.entry, exit: entry.reviewed.exit }
          : entry.candidate
            ? { state: 'candidate' as const, revision: entry.candidate.revision, entry: entry.candidate.entry, exit: entry.candidate.exit }
            : null,
      }
    }),
    direction: { video: directionFor(planning, ''), scene: directionFor(planning, scene.id) },
    delivery: deliveryFor(planning, scene.id),
    reviewed: (reviewed?.content as SceneTreatmentV1 | null) || null,
    assets,
  })
  const cast = await visualCastFor(planning)
  const files: PacketFiles = {
    ...(await castFiles(cast, scene.originScenes, options.castKeys)),
    'packet/THEME.json': themeFile(planning),
    // The plan this scene already has, kept unless the direction changes it.
    'packet/PREVIOUS_PLAN.json': JSON.stringify(reviewed ? { record: reviewed.id, revision: reviewed.revision, status: reviewed.status, plan: reviewed.content, retainedEdits: [] } : { record: null, note: 'This scene has no reviewed plan yet.' }, null, 2),
    'packet/BRIEF.md': renderNativeBrief(brief),
    'packet/EXPLANATION.md': renderExplanation(brief),
    'packet/SCENE.md': packet,
    // The seams: what each neighbour's plan promises now. Only a reviewed
    // plan's boundary can be agreed; a candidate's is a proposal; with no
    // plan the neighbour's image is unknown.
    'packet/NEIGHBORS.json': JSON.stringify(
      {
        scene: scene.id,
        neighbors: neighbors.map(entry => ({
          position: entry.position,
          scene: entry.scene,
          title: entry.title,
          plan: entry.reviewed ? 'reviewed' : entry.candidate ? 'candidate' : 'none',
          ...(entry.reviewed ? { reviewed: { revision: entry.reviewed.revision, [entry.position === 'before' ? 'exit' : 'entry']: entry.position === 'before' ? entry.reviewed.exit : entry.reviewed.entry } } : {}),
          ...(entry.candidate ? { candidate: { revision: entry.candidate.revision, [entry.position === 'before' ? 'exit' : 'entry']: entry.position === 'before' ? entry.candidate.exit : entry.candidate.entry } } : {}),
        })),
        rule: 'A seam may be agreed only with a reviewed plan. Otherwise open (or end) self-contained, or record a proposal that stays provisional until both sides agree.',
      },
      null,
      2,
    ),
  }
  files['packet/CONTEXT.json'] = JSON.stringify(
      {
        route: 'Plan Scene',
        video: { id: planning.project.id, title: planning.project.title },
        scene: { id: scene.id, title: scene.title, originScenes: scene.originScenes },
        videoScenes: planning.videoScenes.map(entry => entry.id),
        briefRecord: briefRecord.id,
        delivery: deliveryFor(planning, scene.id),
        assetKeys: assets.map(asset => asset.key),
        visualCast: { id: cast.id, status: cast.status },
        // Look at the pictures, not only their paths: the page previews and
        // contact sheets, with your image-reading tool.
        images: Object.keys(files).filter(path => /^packet\/references\/.*\.png$/.test(path)).map(path => path.slice('packet/'.length)).sort(),
      },
      null,
      2,
    )
  assertPacketPaths(files)
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

const storePacket = async (projectId: string, files: PacketFiles) =>
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
  const packet = JSON.parse((await readStream((await getObject(key)).stream)).toString('utf8')) as { files: PacketFiles }
  return { record, route: record.kind === 'brief' ? 'Prepare Brief' : record.kind === 'preview' ? 'Sketch Scene' : 'Plan Scene', files: packet.files }
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

// ——— Plan previews (P3): a rough, seekable sketch of one plan revision ———
// A preview is of an exact plan: its revision, the cast it may reuse and
// the theme. It lands whatever happens to the scene afterwards, and reads
// as out of date once the scene's current plan is another revision.
const previewInputsOf = (planning: VideoPlanning, treatment: PlanningRecord, cast: VisualCastRevision | null) => ({
  schema: PLANNING_SCHEMA,
  scene: treatment.subject,
  treatmentId: treatment.id,
  treatmentFingerprint: treatment.fingerprint,
  castId: cast?.status === 'ready' ? cast.id : null,
  themeRef: planning.themeRef,
  bundleHash: planning.bundle?.ref.hash || '',
})
// A preview shows what its plan would show now only while that plan is the
// scene's current, fresh plan and the theme, the cast and the pinned skills
// are the ones it was sketched with. Anything else keeps it, as history.
const previewFreshness = (planning: VideoPlanning, cast: VisualCastRevision | null, records: PlanningRecord[], view: ScenePlanningView, preview: PlanningRecord) => {
  const treatment = records.find(record => record.id === String(preview.inputs.treatmentId || '') && record.kind === 'treatment')
  if (!treatment) return { current: false, staleBecause: 'the plan it sketches is gone' }
  if (treatment.id !== view.current?.id) return { current: false, staleBecause: `it sketches r${treatment.revision}; the scene's current plan is ${view.current ? `r${view.current.revision}` : 'not settled'}` }
  if (view.staleBecause) return { current: false, staleBecause: `its plan is stale — ${view.staleBecause}` }
  const changed = inputsChanged(previewInputsOf(planning, treatment, cast), preview.inputs)
  return changed.length ? { current: false, staleBecause: changed.join('; ') } : { current: true, staleBecause: null }
}
// What moved between the inputs a preview was sketched from and now.
const inputsChanged = (now: ReturnType<typeof previewInputsOf>, was: Record<string, unknown>) =>
  [
    now.treatmentFingerprint !== was.treatmentFingerprint ? 'the plan changed' : '',
    now.themeRef !== was.themeRef ? 'the theme changed' : '',
    now.castId !== (was.castId ?? null) ? 'the visual cast changed' : '',
    now.bundleHash !== was.bundleHash ? 'the planning skills changed' : '',
    now.schema !== was.schema ? 'the planning records changed format' : '',
  ].filter(Boolean)
const compositionIdOf = (treatment: PlanningRecord) => `sketch-${treatment.subject.replace(/[^a-z0-9-]/gi, '-').slice(-40)}-r${treatment.revision}`
// A first length for the sketch: the plan's estimates, bounded.
const sketchLengthOf = (plan: SceneTreatmentV1) =>
  Math.min(120, Math.max(6, Math.round(plan.moments.reduce((sum, moment) => sum + (moment.estimateSeconds || 4), 0) * 10) / 10))

const sketchPacket = async (planning: VideoPlanning, treatment: PlanningRecord, records: PlanningRecord[]) => {
  const briefRecord = records.find(record => record.id === String(treatment.inputs.briefId || '')) || currentBrief(records)
  if (!briefRecord?.content) throw new PlanningError('The brief this plan was made from is gone', 409)
  const plan = treatment.content as SceneTreatmentV1
  // The artwork the plan reuses, adapts or enriches, wherever in the base it is drawn.
  const castKeys = [...new Set(plan.objects.filter(object => ['reuse', 'adapt', 'enrich'].includes(object.asset.status) && object.asset.ref).map(object => object.asset.ref!))]
  const files = await scenePacket(planning, briefRecord, treatment.subject, records, { castKeys })
  const compositionId = compositionIdOf(treatment)
  const length = sketchLengthOf(plan)
  files['packet/PLAN.json'] = JSON.stringify({ record: treatment.id, revision: treatment.revision, status: treatment.status, plan }, null, 2)
  files['packet/SKETCH.md'] = [
    `# Sketch: a rough preview of plan r${treatment.revision}`,
    '',
    'Build one standalone Hyperframes composition that lets the creator feel how this plan unfolds. It is a sketch, not the scene: show the whole progression, one representative object interaction, the intended camera framing, the major text and any presenter transition. A montage of static wireframes is not a sketch.',
    '',
    `- Composition id: \`${compositionId}\` — the root's \`data-composition-id\` and the \`window.__timelines\` key.`,
    `- Canvas: 1920×1080 at 30 fps. Length: about ${length}s, from the plan's estimates; every moment gets an interval, in the plan's order.`,
    `- Runtime: load only \`${SKETCH_RUNTIME_SCRIPTS.join('` and `')}\` (Hyperframes ${SKETCH_RUNTIME.hyperframes}, pinned). Nothing from the network, no clock, no randomness.`,
    '- Artwork: reuse the cast in `assets/<id>/asset.svg` (copy what you use into `sketch/assets/`), or draw native shapes. Never generate paid artwork. Where the plan wants artwork you do not have, draw a labelled placeholder and say so in the manifest.',
    '- A presenter the plan shows is a labelled stand-in: a framed silhouette in its reserved region, never a person.',
    '- Timing is an estimate: no voice or take exists yet. Say so in the manifest.',
    '',
    'Write `sketch/index.html`, `sketch/manifest.json` and any `sketch/assets/`, following `references/sketch-contract.md`, then call `plan_submit_sketch`. Fix exactly the problems it names; stop when it is accepted.',
    '',
  ].join('\n')
  const context = JSON.parse(String(files['packet/CONTEXT.json'])) as Record<string, unknown>
  files['packet/CONTEXT.json'] = JSON.stringify({ ...context, route: 'Sketch Scene', plan: { record: treatment.id, revision: treatment.revision }, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: length }, runtime: { hyperframes: SKETCH_RUNTIME.hyperframes, scripts: SKETCH_RUNTIME_SCRIPTS } }, null, 2)
  return files
}

// Preview this scene's current plan, or a named revision of it. The same
// plan already previewed is shown again unless a new sketch is asked for.
export const queuePreview = async (projectId: string, sceneId: string, options: { recordId?: string; again?: boolean } = {}) => {
  const planning = await loadVideoPlanning(projectId)
  if (!planning.bundle) throw new PlanningError('Previews run in the desktop app, where the pinned skill bundle and your local harness are', 409)
  const records = await listPlanningRecords(projectId)
  // A named revision may be sketched on purpose, stale or not; what it
  // produces is judged against the current inputs when it is shown.
  const view = scenePlanningView(records, sceneId, freshnessOf(planning, records).sceneNow(sceneId))
  const treatment = options.recordId ? records.find(record => record.id === options.recordId && record.kind === 'treatment' && record.subject === sceneId) : view.current
  if (!treatment?.content) throw new PlanningError('Plan this scene before previewing it', 409)
  const cast = await visualCastFor(planning)
  const inputs = previewInputsOf(planning, treatment, cast)
  const fingerprint = fingerprintOf(inputs)
  const existing = reuseActive(records, 'preview', sceneId, fingerprint)
  if (existing) return { record: existing, reused: true }
  if (!options.again) {
    const ready = records.filter(record => record.kind === 'preview' && record.subject === sceneId && record.status === 'ready' && record.fingerprint === fingerprint).sort((a, b) => b.revision - a.revision)[0]
    if (ready) return { record: ready, reused: true }
  }
  const files = await sketchPacket(planning, treatment, records)
  const packet = await storePacket(projectId, files)
  return claimPlanningRecord({
    projectId,
    kind: 'preview',
    subject: sceneId,
    fingerprint,
    inputs: { ...inputs, packetObjectKey: packet.objectKey },
    direction: '',
    skillBundle: planning.bundle.ref,
    workflow: 'sketch',
  })
}

// The engine's own lint, pinned with the runtime the Studio plays.
const lintSketch = async (html: string) => {
  try {
    const { lintHyperframeHtml } = await import('@hyperframes/lint')
    return await lintHyperframeHtml(html, { filePath: 'index.html' })
  } catch (error) {
    return { ok: false, errorCount: 1, warningCount: 0, infoCount: 0, findings: [{ code: 'lint_unavailable', severity: 'error' as const, message: `The Hyperframes lint could not run: ${error instanceof Error ? error.message : error}` }] }
  }
}

const sketchFilesOf = (raw: unknown): SketchFiles => {
  const files: SketchFiles = {}
  if (!raw || typeof raw !== 'object') return files
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') files[name] = value
    else if (value && typeof value === 'object' && typeof (value as { base64?: unknown }).base64 === 'string') {
      files[name] = { base64: String((value as { base64: string }).base64), contentType: String((value as { contentType?: string }).contentType || 'application/octet-stream') }
    }
  }
  return files
}

export const submitSketch = async (recordId: string, raw: unknown, runId?: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'preview') throw new PlanningError('Preview record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This preview already finished as ${record.status}`, 409)
  if (record.status === 'verifying') throw new PlanningError('A submission of this sketch is being played to check it; wait for its answer', 409)
  assertOwner(record, runId)
  const treatment = await loadPlanningRecord(String(record.inputs.treatmentId || ''))
  if (!treatment?.content) throw new PlanningError('The plan this preview is of is gone', 409)
  const files = sketchFilesOf(raw)
  const report = validateSketch(files, {
    scene: record.subject,
    plan: { record: treatment.id, revision: treatment.revision, content: treatment.content as SceneTreatmentV1 },
    assetKeys: (await libraryAssets()).map(asset => asset.key),
  })
  const html = typeof files['index.html'] === 'string' ? files['index.html'] : ''
  const lint = html ? await lintSketch(html) : null
  const lintProblems = (lint?.findings || []).filter(finding => finding.severity === 'error').map(finding => `hyperframes lint ${finding.code}: ${finding.message}${finding.fixHint ? ` — ${finding.fixHint}` : ''}`)
  const lintWarnings = (lint?.findings || []).filter(finding => finding.severity === 'warning').map(finding => `hyperframes lint ${finding.code}: ${finding.message}`)
  const problems = [...report.problems, ...lintProblems]
  if (problems.length || !report.manifest) return { accepted: false as const, problems, warnings: [...report.warnings, ...lintWarnings] }
  // Well formed is not working: the bundle plays in the pinned player
  // before it can read ready. While it plays, the record says so.
  const verifying = await updatePlanningRecord(record.id, { status: 'verifying' }, ['queued', 'running'], { runId: record.runId })
  if (!verifying) throw new PlanningError('This preview finished elsewhere while it was being checked', 409)
  let runtime: Awaited<ReturnType<typeof verifySketchRuntime>>
  try {
    runtime = await verifySketchRuntime(files, report.manifest, treatment.content as SceneTreatmentV1)
  } catch (error) {
    // The check could not run at all: not the sketch's fault, and nothing
    // the run can fix. The record says why; the creator can retry.
    const message = `The sketch could not be played to check it: ${error instanceof Error ? error.message : String(error)}`
    await updatePlanningRecord(record.id, { status: 'failed', error: { message, category: 'verification', recovery: ['Retry'] } }, ['verifying'])
    throw new PlanningError(`${message}. Stop the run; the creator can retry the preview.`, 503)
  }
  if (runtime.problems.length || !runtime.proof) {
    // Back to the run, to fix and submit again.
    const back = await updatePlanningRecord(record.id, { status: 'running' }, ['verifying'], { runId: record.runId })
    if (!back) throw new PlanningError('This preview finished elsewhere while it was being checked', 409)
    return { accepted: false as const, problems: runtime.problems, warnings: [...report.warnings, ...lintWarnings, ...runtime.warnings] }
  }
  // The bundle is kept whole and immutable; the manifest is the record, and
  // the proof names the bundle it was taken from.
  const artifacts = await storeAsset({ body: Buffer.from(JSON.stringify({ record: record.id, files }), 'utf8'), contentType: 'application/json; charset=utf-8', projectId: record.projectId, kind: 'planning-preview', extension: '.json' })
  const planning = await loadVideoPlanning(record.projectId)
  const moved = inputsChanged(previewInputsOf(planning, treatment, await knownCast(planning)), record.inputs)
  const warnings = [...report.warnings, ...lintWarnings, ...runtime.warnings, ...(moved.length ? [`While this sketch was made, ${moved.join('; ')} — it is kept, as out of date`] : [])]
  const updated = await updatePlanningRecord(record.id, { status: 'ready', content: report.manifest, report: { warnings, verification: runtime.proof }, artifacts }, ['verifying'], { runId: record.runId })
  if (!updated) throw new PlanningError('This preview finished elsewhere while it was being checked', 409)
  return { accepted: true as const, status: 'ready', record: updated, warnings }
}

// A preview's files, for the Studio's player: the bundle as it was accepted.
const bundles = new Map<string, Record<string, SketchFiles[string]>>()
export const loadPreviewFile = async (recordId: string, path: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'preview' || record.status !== 'ready' || !record.artifacts) throw new PlanningError('Preview not found', 404)
  let files = bundles.get(record.artifacts.objectKey)
  if (!files) {
    files = (JSON.parse((await readStream((await getObject(record.artifacts.objectKey)).stream)).toString('utf8')) as { files: SketchFiles }).files
    if (bundles.size > 24) bundles.delete(bundles.keys().next().value as string)
    bundles.set(record.artifacts.objectKey, files)
  }
  const file = files[path]
  if (file === undefined) throw new PlanningError('No such file in the preview', 404)
  return previewFileBody(path, file)
}

// What playing a sketch proved, in brief; null for one never played (made
// before sketches were checked in the player).
const checkedOf = (proof: SketchProof | undefined) =>
  proof
    ? { at: proof.checkedAt, runtime: proof.runtime, bundle: proof.bundle, duration: proof.duration, tweens: proof.timeline.tweens, files: proof.loaded.length, reseeks: proof.reseeks.length, layers: proof.layers.length, changes: proof.changes.length }
    : null

// A scene's previews: the newest of any status, the newest ready one of each
// plan revision, and the one of the scene's current plan. Each says whether
// it still shows what that plan would show now, and if not, why.
const previewOf = (records: PlanningRecord[], sceneId: string, freshness: (preview: PlanningRecord) => { current: boolean; staleBecause: string | null }) => {
  const mine = records.filter(record => record.kind === 'preview' && record.subject === sceneId).sort((a, b) => b.revision - a.revision)
  const newest = mine[0]
  if (!newest) return null
  const viewOf = (preview: PlanningRecord) => {
    const manifest = preview.content as SketchManifest | null
    if (!manifest) return null
    const { current, staleBecause } = freshness(preview)
    return {
      id: preview.id,
      url: `/api/planning/previews/${encodeURIComponent(preview.id)}/index.html`,
      of: { record: String(preview.inputs.treatmentId || ''), revision: manifest.plan.revision },
      current,
      staleBecause,
      summary: sketchSummary(manifest),
      warnings: preview.report?.warnings || [],
      adapter: preview.adapter,
      model: preview.reportedModel || preview.model,
      checked: checkedOf(preview.report?.verification),
    }
  }
  // Newest first, so a late result never replaces a newer one of its plan.
  const byTreatment: Record<string, NonNullable<ReturnType<typeof viewOf>>> = {}
  for (const preview of mine.filter(record => record.status === 'ready')) {
    const key = String(preview.inputs.treatmentId || '')
    if (key && !byTreatment[key]) {
      const view = viewOf(preview)
      if (view) byTreatment[key] = view
    }
  }
  const ready = Object.values(byTreatment).find(view => view.current) || Object.values(byTreatment).sort((a, b) => b.of.revision - a.of.revision)[0] || null
  return {
    latest: { id: newest.id, status: newest.status, revision: newest.revision, error: newest.error, runId: newest.runId, treatmentId: String(newest.inputs.treatmentId || '') },
    ready,
    byTreatment,
  }
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
    neighbors: agreementBasis(neighborsOf(planning, await listPlanningRecords(record.projectId), scene.id)),
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
// Approving a scene plan (P2) pins it: the plan's own inputs, the brief it
// came from and the visual cast it saw are recorded with it. It is this
// scene's decision alone, and it starts nothing — no artwork, voice,
// recording or production.
export const reviewTreatment = async (recordId: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'treatment') throw new PlanningError('Scene plan record not found', 404)
  if (record.status !== 'candidate') throw new PlanningError(`Only a candidate plan can be approved (this one is ${record.status})`, 409)
  const planning = await loadVideoPlanning(record.projectId)
  const records = await listPlanningRecords(record.projectId)
  const fresh = freshnessOf(planning, records)
  const freshness = fresh.treatment(record)
  if (!freshness.fresh) throw new PlanningError(`This plan is stale: ${freshness.reason}. Generate a new candidate first.`, 409)
  const cast = await knownCast(planning)
  const at = new Date().toISOString()
  const approval = {
    at,
    fingerprint: record.fingerprint,
    briefId: String(record.inputs.briefId || ''),
    briefFingerprint: String(record.inputs.briefFingerprint || fresh.brief?.fingerprint || ''),
    castId: cast?.status === 'ready' ? cast.id : null,
  }
  const updated = await updatePlanningRecord(record.id, { status: 'reviewed', reviewedAt: at, approval }, ['candidate'])
  if (!updated) throw new PlanningError('This plan changed while it was being approved', 409)
  return updated
}
export const approveTreatment = reviewTreatment

export const failRecord = async (recordId: string, error: NonNullable<PlanningRecord['error']>) => {
  const updated = await updatePlanningRecord(recordId, { status: 'failed', error }, [...ACTIVE_STATUSES])
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
