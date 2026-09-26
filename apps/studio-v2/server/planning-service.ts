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
import { validateDraft } from './plan-draft'
import { sceneRevisionOf, type ProjectDocumentV1, type TiptapNode } from 'markdown-composition'
import {
  claimPlanningRecord,
  compareAndSwapSetting,
  getObject,
  listPlanningInputs,
  listPlanningRecords,
  listPlanningRecordsForRun,
  listPresenterTakes,
  loadPlanningRecord,
  loadProjectArtifact,
  loadSetting,
  loadSourceRevision,
  savePlanningInput,
  storeAsset,
  updatePlanningRecord,
  type PlanningInputRow,
} from './persistence'
import { skillVersions } from './skill-versions'
import { listArtwork } from './appearance-library'
import { fingerprintOf } from '../src/planning/fingerprint'
import { studioRefOf } from '../src/studio-refs'
import { outlineSceneOf, pageObjectiveOf } from '../src/planning/page-objective'
import { validateBrief, type BriefContext, type ExplanationBriefV1 } from '../src/planning/explanation-brief'
import { continuityStatus, validateTreatment, visualMinimumOf, type NeighborPlan, type SceneTreatmentV1, type TreatmentContext } from '../src/planning/scene-treatment'
// A length as the review says it: to a tenth of a second.
const round1 = (seconds: number) => Math.round(seconds * 10) / 10
import { castEntriesForKeys, ensureVisualCast, loadVisualCast, readObject, type CastEntry, type VisualCastRevision } from './visual-cast'
import { SKETCH_RUNTIME, SKETCH_RUNTIME_SCRIPTS, sketchSummary, validateSketch, type SketchFiles, type SketchManifest, type SketchProof } from '../src/planning/sketch-bundle'
import { previewFileBody, sketchBundleHash, verifySketchRuntime, type RuntimeEvidence } from './sketch-runtime'
import { narrationClock, type NarrationLine } from './voice'
import { alignTake, composeTakes, normalizeTake, pictureSize, takeClockOf, takeFrame, type AlignedLine } from './take-clock'
import { lineFingerprints, scriptFingerprint, scriptLinesOf } from '../src/planning/recording-guide'
import { mkdtemp, rm, writeFile as writeLocalFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { renderProductionBundle } from './production-render'
import { controlValueProblems, productionSummary, validateProduction, withControlValues, type ControlValues, type ProductionClock, type ProductionManifest } from '../src/planning/production-bundle'
import { renderExplanation, renderNativeBrief, renderScenePacket } from '../src/planning/brief-adapter'
import { themeFacesNow, themeFacesOf, typeFacesOf } from './type-faces'
import { claimFlagsOf } from '../src/planning/claim-scope'
import {
  ACTIVE_STATUSES,
  PLANNING_SCHEMA,
  PLANNING_SUBMISSION_BUDGET,
  validationOf,
  type RefusedAttempt,
  type TypeFaces,
  type ValidationEvidence,
  type ValidationView,
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
  type TreatmentInputs, type ScenePlanningView, type ProgressMilestone, type PlanDraft, type PlanningStatus } from '../src/planning/planning-records'
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
  // What the page teaches, from the source outline; and the director's
  // staging notes for the slide, kept apart from it (reference only).
  objective: string
  layoutGuidance: string
  narration: string
  // What the page is — a designed slide, a schematic draft, or a page — and
  // its revision; and, when the video adopted a newer page of its base for
  // this scene, when and which (F1 of the Perplexity review).
  pageKind: string
  pageRevision: string
  adopted: { at: string; revision: string } | null
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
  // schematic: the schematic draft the scene's designed slide was made from.
  videoScenes: Array<{ id: string; title: string; index: number; originScenes: string[]; script: string; scriptSource: string | null; schematic: string | null }>
  source: { revision: string | null; text: string; kind: string; title: string; site: string; url: string }
  wordingPolicy: 'preserve' | 'assist' | 'draft'
  themeRef: string | null
  requestedSeconds: number | null
  inputs: PlanningInputRow[]
  bundle: Bundle | null
  // The revision the visual cast is extracted from: the pinned base, and
  // the pages its scenes adopted since.
  castRevision: string
  // The pickups recorded for each scene, newest first: takes of some of its
  // lines, which fill in for the selected take where it does not say them.
  pickups: Map<string, Array<{ recordingId: string; videoUrl: string; lines: string[]; recordedAt: string }>>
}

const pageKindOf = (node: TiptapNode) => {
  const kind = (attr(node, 'pageOrigin') as { kind?: string } | null | undefined)?.kind
  return kind === 'designed' || kind === 'schematic' ? kind : 'page'
}

// The pages a video's scenes adopted from their base since the fork, by
// base scene: the scene carries the page it took and which revision of the
// base's page that was. Only a scene made of one base page adopts.
const adoptedPagesOf = (project: ProjectDocumentV1) => {
  const adopted = new Map<string, { svg: string; kind: string; revision: string; at: string }>()
  for (const node of scenesOf(project)) {
    const reference = attr(node, 'reference') as { baseScene?: string; revision?: string; kind?: string; adoptedAt?: string } | null | undefined
    const origin = attr(node, 'origin') as { scene?: string; scenes?: string[] } | undefined
    const origins = (origin?.scenes?.length ? origin.scenes : origin?.scene ? [origin.scene] : []).map(String)
    if (!reference?.baseScene || !reference.revision || origins.length !== 1 || origins[0] !== reference.baseScene) continue
    adopted.set(reference.baseScene, { svg: stringAttr(node, 'svg'), kind: String(reference.kind || 'designed'), revision: String(reference.revision), at: String(reference.adoptedAt || '') })
  }
  return adopted
}

const pagesFrom = (base: ProjectDocumentV1): PinnedPage[] =>
  scenesOf(base).map(node => {
    const id = stringAttr(node, 'id')
    const attrs = (node.attrs || {}) as Record<string, unknown>
    const outline = outlineSceneOf(base.outline?.scenes, attrs)
    const passages = attr(node, 'sourcePassages')
    return {
      scene: id,
      title: stringAttr(node, 'title') || outline?.title || '',
      ...pageObjectiveOf(attrs, base.outline?.scenes),
      narration: stringAttr(node, 'script'),
      pageKind: pageKindOf(node),
      pageRevision: sceneRevisionOf(node).inputs.page,
      adopted: null,
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
      schematic: pageKindOf(node) === 'designed' ? String((attr(node, 'schematic') as { svg?: string } | null | undefined)?.svg || '') || null : null,
    }
  })

  const sourceRevision = project.source?.snapshotId || null
  let sourceText = ''
  if (sourceRevision) {
    const revision = (await loadSourceRevision(sourceRevision)) as { content?: { text?: unknown } } | null
    sourceText = String(revision?.content?.text || '')
  }
  const wordingPolicy = (['preserve', 'assist', 'draft'] as const).find(policy => policy === project.story?.wordingPolicy) || 'draft'
  // A scene that adopted a newer page of its base is planned from it: its
  // packet, its cast and its plan's inputs read the adopted page (F1).
  const adoptions = adoptedPagesOf(project)
  const basePages = pagesFrom(base).map(page => {
    const adopted = adoptions.get(page.scene)
    return adopted ? { ...page, svg: adopted.svg, pageKind: adopted.kind, pageRevision: adopted.revision, adopted: { at: adopted.at, revision: adopted.revision } } : page
  })
  const pickups = new Map<string, Array<{ recordingId: string; videoUrl: string; lines: string[]; recordedAt: string }>>()
  for (const take of await listPresenterTakes(project.id).catch(() => [] as Array<Record<string, unknown>>)) {
    const detail = (take.detail || {}) as { mediaUrl?: string; pickup?: boolean; script?: { lines?: unknown } }
    const lines = Array.isArray(detail.script?.lines) ? (detail.script!.lines as unknown[]).map(String) : []
    if (!detail.pickup || !detail.mediaUrl || !lines.length) continue
    const list = pickups.get(String(take.blockId)) || []
    list.push({ recordingId: String(take.id), videoUrl: detail.mediaUrl, lines, recordedAt: String(take.createdAt || '') })
    pickups.set(String(take.blockId), list)
  }
  for (const list of pickups.values()) list.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  const baseRevision = project.derivedFrom.baseRevision || ''
  const castRevision = adoptions.size
    ? `${baseRevision}~${fingerprintOf([...adoptions].map(([scene, adopted]) => [scene, adopted.revision]).sort())}`
    : baseRevision
  return {
    project,
    baseTitle: base.title,
    basePages,
    baseLimitation,
    castRevision,
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
    pickups,
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
    // A page the scene adopted is an input of its plan; a scene that adopted
    // nothing pins nothing more, so its plans stay as they were (F1).
    ...(() => {
      const adopted = scene.originScenes.map(origin => planning.basePages.find(page => page.scene === origin)?.adopted?.revision).filter(Boolean)
      return adopted.length ? { reference: adopted.join(',') } : {}
    })(),
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
    revision: planning.castRevision,
    pages: castSourcesOf(planning),
    theme: planning.project.theme,
    ...options,
  })
const knownCast = (planning: VideoPlanning) => loadVisualCast(planning.project.derivedFrom!.notebook, planning.castRevision)
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
const themeFile = async (planning: VideoPlanning) => {
  const theme = planning.project.theme
  const brand = (theme?.brand || planning.project.brand || {}) as Record<string, string>
  const fonts = theme?.fonts
  // Which of the theme's families the Studio can set in their own faces
  // (Q01 of the BoltDB review): said to the harness, so none is swapped for
  // a generic family and reported missing after the creator approved.
  const faces = fonts ? await themeFacesOf(fonts) : []
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
        faces: Object.fromEntries(faces.map(face => [face.role, { family: face.family, available: face.available }])),
        note: fonts
          ? 'Name these families first in font-family declarations, each with its fallback after it — font-family: "Source Serif 4", serif. The Studio sets each available one in its own face before the scene is checked, played or rendered, the same on the stage and in the video; one that is not available falls back to its declared generic family alike in both. Never replace a theme family with a generic one, and never report one as missing: `faces` says which can be had.'
          : 'The theme names no type families: use the fallbacks.',
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
  // The artwork the plan names, by the key it used, even one an earlier
  // extraction gave: the entry says which of its keys the plan used.
  const named = await castEntriesForKeys(cast, castKeys)
  const formerKeys = new Map<string, string[]>()
  for (const [key, entry] of named) if (entry.libraryKey !== key) formerKeys.set(entry.id, [...(formerKeys.get(entry.id) || []), key])
  const carried = (entry: CastEntry) => origins.includes(entry.identity.base.page) || [...named.values()].some(found => found.id === entry.id)
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
      // The keys an earlier extraction gave it, which the plan may name.
      ...(formerKeys.get(entry.id) ? { formerKeys: formerKeys.get(entry.id) } : {}),
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
      rig: {
        object: entry.rig.object,
        status: entry.rig.status,
        missing: entry.rig.pieces.filter(piece => !piece.found).map(piece => piece.id),
        // The level, clipped to the shell: set its y and height within the
        // extent (x and width at the extent's) and it stays inside.
        ...(entry.rig.inside?.contained ? { inside: { level: entry.rig.inside.level, clipPath: entry.rig.inside.clipPath, extent: entry.rig.inside.extent } } : {}),
      },
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
      decide: 'Decide every verified entry of this scene\'s own page, in objects with its libraryKey as asset.ref: reuse it unchanged, adapt it (recolour, re-rig), enrich it (a richer version from its silhouette, role and parts), build it native (exact shapes, charts, counts, code) or generate something new in its place — or omit it, with asset.status "omit", when the scene does not need it. Each decision says why the viewer needs it. On a designed slide a plan that leaves one undecided is refused. A reference-only ingredient (verification mismatch) is not equivalent to the page.',
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

// Which page a scene is planned from — its kind and revision, and whether it
// was adopted — and whether its base has a newer page to offer: the
// designed slide that landed after this video was made from a schematic
// (F1 of the Perplexity review). Offered, never taken: adopting is the
// creator's call. Only a scene made of one base page can adopt.
const referenceOf = (planning: VideoPlanning, scene: VideoPlanning['videoScenes'][number], live: Map<string, TiptapNode>) => {
  if (scene.originScenes.length !== 1) return null
  const origin = scene.originScenes[0]
  const pinned = planning.basePages.find(page => page.scene === origin)
  if (!pinned) return null
  const node = live.get(origin)
  const revision = node ? sceneRevisionOf(node).inputs.page : null
  const pageOrigin = node ? (attr(node, 'pageOrigin') as { kind?: string; by?: string; designing?: unknown } | null | undefined) : null
  // Still being designed: a scene waiting for its first designed page. A
  // page the run has landed is offered at once, while the run goes on
  // checking the rest of its batch — its binding stays until the run ends,
  // and a page the run redraws is a newer revision again (BoltDB B06).
  const designing = Boolean(pageOrigin?.designing) && pageOrigin?.kind !== 'designed'
  const newer = node && revision && revision !== pinned.pageRevision
    ? {
        baseScene: origin,
        revision,
        kind: pageKindOf(node),
        by: String(pageOrigin?.by || ''),
        // Still being designed: said, not offered.
        designing,
        svg: designing ? '' : stringAttr(node, 'svg'),
        program: designing ? null : attr(node, 'program') ?? null,
        // The schematic the base's slide was designed from, kept beside it.
        schematic: designing ? null : String((attr(node, 'schematic') as { svg?: string } | null | undefined)?.svg || '') || null,
      }
    : null
  // The base still designing this scene's page, as yet unchanged — and the
  // run designing it, whose progress the waiting scene shows.
  const baseDesigning = designing && !newer
  const binding = pageOrigin?.designing as { runId?: string; page?: number; by?: string } | undefined
  const designRun = designing && binding?.runId ? { runId: String(binding.runId), page: Number(binding.page) || 0, by: String(binding.by || pageOrigin?.by || '') } : null
  return { baseScene: origin, kind: pinned.pageKind, revision: pinned.pageRevision, adopted: pinned.adopted, newer, baseDesigning, designRun }
}

export const planningOverview = async (projectId: string) => {
  const planning = await loadVideoPlanning(projectId)
  const records = await listPlanningRecords(projectId)
  const liveBase = await loadProjectArtifact(planning.project.derivedFrom!.notebook).catch(() => null)
  const live = new Map((liveBase ? scenesOf(liveBase) : []).map(node => [stringAttr(node, 'id'), node]))
  const fresh = freshnessOf(planning, records)
  const brief = fresh.brief
  // The cast is extracted in the background the first time it is asked for.
  const cast = await knownCast(planning)
  if (!cast) void visualCastFor(planning).catch(() => {})
  const previewNow = (view: ScenePlanningView, preview: PlanningRecord) => previewFreshness(planning, cast, records, view, preview)
  const producer = await producerRef(planning)
  const productionNow = (view: ScenePlanningView, production: PlanningRecord) => productionFreshness(planning, cast, records, view, production, producer)
  const edits = await editsOfShown(records)
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
        production: productionOf(records, scene.id, production => productionNow(view, production), edits),
        // What producing the approved plan waits for, in the creator's words.
        productionWaits: view.reviewed?.content ? clockSourceOf(planning, scene.id, view.reviewed.content as SceneTreatmentV1).missing || null : null,
        reference: referenceOf(planning, scene, live),
      }
    }),
    videoDirection: directionFor(planning, ''),
    basePages: planning.basePages,
    records,
    // The theme's type, as a produced scene will be set in it (Q01): known
    // once the renderer's font sources have answered, null until then.
    themeType: themeFacesNow(planning.project.theme?.fonts),
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

const briefPacket = async (planning: VideoPlanning) => {
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
    'packet/THEME.json': await themeFile(planning),
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
          page.objective ? `Teaching objective (from the source outline): ${page.objective}` : '',
          page.layoutGuidance ? `Page notes (slide layout, reference only): ${page.layoutGuidance}` : '',
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
      .map(({ scene: id, title, objective, layoutGuidance, narration, sourcePassages, wireframe }) => ({ scene: id, title, objective, layoutGuidance, narration, sourcePassages, wireframe })),
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
    // Both references: the designed slide (the page), and the schematic it
    // was designed from, for its structure.
    ...(scene.schematic ? { 'packet/references/schematic.svg': scene.schematic } : {}),
    'packet/THEME.json': await themeFile(planning),
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
        // The page's two references, when the scene keeps both.
        ...(scene.schematic ? { references: { designed: 'references/page.svg', schematic: 'references/schematic.svg', note: 'The designed slide is this scene\'s page reference; the schematic it was designed from shows the page\'s structure. Neither is the video\'s end state.' } } : {}),
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
  return { record, route: record.kind === 'brief' ? 'Prepare Brief' : record.kind === 'preview' ? 'Sketch Scene' : record.kind === 'production' ? 'Produce Scene' : 'Plan Scene', files: packet.files }
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
  const { files } = await briefPacket(planning)
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
// scene's current, fresh plan and the theme, the cast, the pinned skills and
// the pinned runtime are the ones it was sketched with. Anything else keeps
// it, as history.
const previewFreshness = (planning: VideoPlanning, cast: VisualCastRevision | null, records: PlanningRecord[], view: ScenePlanningView, preview: PlanningRecord) => {
  const treatment = records.find(record => record.id === String(preview.inputs.treatmentId || '') && record.kind === 'treatment')
  if (!treatment) return { current: false, staleBecause: 'the plan it sketches is gone' }
  if (treatment.id !== view.current?.id) return { current: false, staleBecause: `it sketches r${treatment.revision}; the scene's current plan is ${view.current ? `r${view.current.revision}` : 'not settled'}` }
  if (view.staleBecause) return { current: false, staleBecause: `its plan is stale — ${view.staleBecause}` }
  const runtime = (preview.content as SketchManifest | null)?.runtime?.hyperframes
  const changed = [
    ...inputsChanged(previewInputsOf(planning, treatment, cast), preview.inputs, castKeysKept(treatment, cast)),
    ...(runtime && runtime !== SKETCH_RUNTIME.hyperframes ? [`the pinned Hyperframes runtime changed (${runtime} → ${SKETCH_RUNTIME.hyperframes})`] : []),
  ]
  return changed.length ? { current: false, staleBecause: changed.join('; ') } : { current: true, staleBecause: null }
}
// The artwork a plan reuses, adapts or enriches, by library key.
const castKeysOf = (plan: SceneTreatmentV1 | null | undefined) =>
  [...new Set((plan?.objects || []).filter(object => ['reuse', 'adapt', 'enrich'].includes(object.asset.status) && object.asset.ref).map(object => object.asset.ref!))]
// A cast extracted again — because a scene adopted a newer page (F1) — is
// the same cast for a sketch whose every piece of artwork it still holds:
// library keys are content hashes, so a kept key is unchanged artwork.
const castKeysKept = (treatment: PlanningRecord, cast: VisualCastRevision | null) =>
  Boolean(cast && cast.status === 'ready') && castKeysOf(treatment.content as SceneTreatmentV1 | null).every(key => cast!.entries.some(entry => entry.libraryKey === key))
// What moved between the inputs a preview was sketched from and now.
const inputsChanged = (now: ReturnType<typeof previewInputsOf>, was: Record<string, unknown>, castKept = false) =>
  [
    now.treatmentFingerprint !== was.treatmentFingerprint ? 'the plan changed' : '',
    now.themeRef !== was.themeRef ? 'the theme changed' : '',
    // A cast still being extracted is not yet known, not changed.
    now.castId !== null && now.castId !== (was.castId ?? null) && !castKept ? 'the visual cast changed' : '',
    now.bundleHash !== was.bundleHash ? 'the planning skills changed' : '',
    now.schema !== was.schema ? 'the planning records changed format' : '',
  ].filter(Boolean)
const compositionIdOf = (treatment: PlanningRecord) => `sketch-${treatment.subject.replace(/[^a-z0-9-]/gi, '-').slice(-40)}-r${treatment.revision}`
// A first length for the sketch: the plan's estimates, bounded.
const sketchLengthOf = (plan: SceneTreatmentV1) =>
  Math.min(120, Math.max(6, Math.round(plan.moments.reduce((sum, moment) => sum + (moment.estimateSeconds || 4), 0) * 10) / 10))

// A sketch asked for again after one that could not be verified is given
// that check (R09 of the project-flow rereview): its problems and the frames
// the player kept, so the retry starts from what failed.
const lastCheckFiles = async (failed: PlanningRecord | null): Promise<PacketFiles> => {
  const refused = failed ? validationOf(failed) : null
  if (!failed || !refused) return {}
  const files: PacketFiles = {}
  const lines = [
    '# The last check of an earlier sketch of this plan',
    '',
    `An earlier sketch of this plan was refused ${refused.last.attempt} time${refused.last.attempt === 1 ? '' : 's'}: ${failed.error?.message || 'its run ended without a sketch that passed'}. Its last check found:`,
    '',
    ...refused.last.problems.map(problem => `- ${problem}`),
  ]
  for (const [index, item] of (refused.last.evidence || []).entries()) {
    const first = `last-check/seek-${index + 1}-first.png`
    const again = `last-check/seek-${index + 1}-again.png`
    files[`packet/${first}`] = { base64: (await readObject(item.frames.first.objectKey)).toString('base64'), contentType: 'image/png' }
    files[`packet/${again}`] = { base64: (await readObject(item.frames.again.objectKey)).toString('base64'), contentType: 'image/png' }
    const region = item.region ? ` within x ${item.region.left}–${item.region.right}, y ${item.region.top}–${item.region.bottom} of the ${item.size.width}×${item.size.height} frame` : ''
    lines.push('', `The frame at ${Number(item.at.toFixed(2))}s, seeked twice: \`${first}\`, then \`${again}\` — ${item.pixels} pixels differ${region}.`)
    for (const layer of item.layers) lines.push(`- Layer "${layer.id}": ${layer.first ? `x ${Math.round(layer.first.left)}–${Math.round(layer.first.right)}, y ${Math.round(layer.first.top)}–${Math.round(layer.first.bottom)}` : 'not shown'} the first time, ${layer.again ? `x ${Math.round(layer.again.left)}–${Math.round(layer.again.right)}, y ${Math.round(layer.again.top)}–${Math.round(layer.again.bottom)}` : 'not shown'} the second.`)
  }
  lines.push('', 'Find what made it fail, and build this sketch so it passes the same check. The check is not changed or worked around.', '')
  files['packet/LAST-CHECK.md'] = lines.join('\n')
  return files
}

const sketchPacket = async (planning: VideoPlanning, treatment: PlanningRecord, records: PlanningRecord[]) => {
  const briefRecord = records.find(record => record.id === String(treatment.inputs.briefId || '')) || currentBrief(records)
  if (!briefRecord?.content) throw new PlanningError('The brief this plan was made from is gone', 409)
  const plan = treatment.content as SceneTreatmentV1
  // The artwork the plan reuses, adapts or enriches, wherever in the base it is drawn.
  const castKeys = castKeysOf(plan)
  const files = await scenePacket(planning, briefRecord, treatment.subject, records, { castKeys })
  const compositionId = compositionIdOf(treatment)
  const length = sketchLengthOf(plan)
  // The newest sketch of this plan, when it could not be verified.
  const failed = records.filter(record => record.kind === 'preview' && record.subject === treatment.subject && String(record.inputs.treatmentId || '') === treatment.id).sort((a, b) => b.revision - a.revision)[0]
  const checked = await lastCheckFiles(failed?.status === 'failed' ? failed : null)
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
    ...(checked['packet/LAST-CHECK.md'] ? ['', 'An earlier sketch of this plan could not be verified. Read `LAST-CHECK.md` and look at its frames before you build: do not repeat what it found.'] : []),
    '',
  ].join('\n')
  Object.assign(files, checked)
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

// A bundle's type, prepared before anything checks it (R10 of the
// project-flow rereview): the faces the packet promised are supplied, a face
// declared with src: local() alone is replaced by the face itself, and the
// lint, the checks, the player and the render all read the prepared bundle.
const preparedType = async (html: unknown, recordId: string) =>
  typeof html === 'string' && html
    ? typeFacesOf(html).catch(error => {
      console.warn('type faces', recordId, error instanceof Error ? error.message : error)
      return null
    })
    : null
type LintReport = Awaited<ReturnType<typeof lintSketch>>
// The lint's findings on a prepared bundle. A family with no face, when the
// face could not be had, is not the run's to fix: its fallback is the same
// on the stage and in the video, and it is said — never charged as a
// refusal, and never answered with a local() declaration.
// A font the lint finds with no face of its own is answerable only when it
// is drawn: a face that cannot be had is said, never refused; and a family
// named after a face the bundle carries is never drawn at all.
const lintFindingsOf = (lint: LintReport | null, type?: Pick<TypeFaces, 'unresolved' | 'fallbacks'> | null) => {
  const missing = new Set([...(type?.unresolved || []), ...(type?.fallbacks || [])].map(face => face.toLowerCase()))
  const findings = lint?.findings || []
  const unanswerable = (finding: LintReport['findings'][number]) => {
    if (finding.code !== 'font_family_without_font_face') return false
    const named = (/declaration:\s*([^.]+)\./.exec(finding.message)?.[1] || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
    return named.length > 0 && named.every(name => missing.has(name))
  }
  const hint = (finding: LintReport['findings'][number]) =>
    finding.code === 'font_family_without_font_face' ? ' — Name the families the packet\'s theme names: Studio supplies every face it can have before checking, and says which it cannot. Never declare a face with src: local().' : finding.fixHint ? ` — ${finding.fixHint}` : ''
  return {
    problems: findings.filter(finding => finding.severity === 'error' && !unanswerable(finding)).map(finding => `hyperframes lint ${finding.code}: ${finding.message}${hint(finding)}`),
    warnings: findings.filter(finding => finding.severity === 'warning').map(finding => `hyperframes lint ${finding.code}: ${finding.message}`),
  }
}
const typeNotesOf = (type: TypeFaces | null | undefined) =>
  (type?.unresolved || []).map(face => `The type face “${face}” could not be had: the stage and the video both set it in the fallback its declaration names`)

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

export const submitSketch = async (recordId: string, raw: unknown, runId?: string, submission?: Submission) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'preview') throw new PlanningError('Preview record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This preview already finished as ${record.status}`, 409)
  if (record.status === 'verifying') throw new PlanningError('A submission of this sketch is being played to check it; wait for its answer', 409)
  assertOwner(record, runId)
  void noteProgress(record.id, { milestone: 'submitted' }, { runId })
  const treatment = await loadPlanningRecord(String(record.inputs.treatmentId || ''))
  if (!treatment?.content) throw new PlanningError('The plan this preview is of is gone', 409)
  const files = sketchFilesOf(raw)
  const typed = await preparedType(files['index.html'], record.id)
  if (typed) files['index.html'] = typed.html
  const report = validateSketch(files, {
    scene: record.subject,
    plan: { record: treatment.id, revision: treatment.revision, content: treatment.content as SceneTreatmentV1 },
    assetKeys: (await libraryAssets()).map(asset => asset.key),
  })
  const html = typeof files['index.html'] === 'string' ? files['index.html'] : ''
  const lint = html ? await lintSketch(html) : null
  const { problems: lintProblems, warnings: lintWarnings } = lintFindingsOf(lint, typed?.report)
  const typeNotes = typeNotesOf(typed?.report)
  const problems = [...report.problems, ...lintProblems]
  if (problems.length || !report.manifest) {
    const refused = await refuse(record, { runId, submission, bundle: sketchBundleHash(files), problems })
    return { accepted: false as const, problems, warnings: [...report.warnings, ...lintWarnings], ...refusalOf(refused) }
  }
  // Well formed is not working: the bundle plays in the pinned player
  // before it can read ready. While it plays, the record says so.
  const verifying = await updatePlanningRecord(record.id, { status: 'verifying' }, ['queued', 'running'], { runId: record.runId })
  if (!verifying) throw new PlanningError('This preview finished elsewhere while it was being checked', 409)
  void noteProgress(record.id, { milestone: 'checking' }, { runId })
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
    // Back to the run, to fix and submit again — with what the player saw.
    const back = await updatePlanningRecord(record.id, { status: 'running' }, ['verifying'], { runId: record.runId })
    if (!back) throw new PlanningError('This preview finished elsewhere while it was being checked', 409)
    const refused = await refuse(back, { runId, submission, bundle: sketchBundleHash(files), problems: runtime.problems, evidence: runtime.evidence })
    return { accepted: false as const, problems: runtime.problems, warnings: [...report.warnings, ...lintWarnings, ...runtime.warnings], ...refusalOf(refused) }
  }
  // The bundle is kept whole and immutable; the manifest is the record, and
  // the proof names the bundle it was taken from.
  const artifacts = await storeAsset({ body: Buffer.from(JSON.stringify({ record: record.id, files }), 'utf8'), contentType: 'application/json; charset=utf-8', projectId: record.projectId, kind: 'planning-preview', extension: '.json' })
  const planning = await loadVideoPlanning(record.projectId)
  const castNow = await knownCast(planning)
  const moved = inputsChanged(previewInputsOf(planning, treatment, castNow), record.inputs, castKeysKept(treatment, castNow))
  const warnings = [...report.warnings, ...lintWarnings, ...runtime.warnings, ...typeNotes, ...(moved.length ? [`While this sketch was made, ${moved.join('; ')} — it is kept, as out of date`] : [])]
  const updated = await updatePlanningRecord(record.id, { status: 'ready', content: report.manifest, report: { warnings, verification: runtime.proof, ...(typed ? { type: typed.report } : {}) }, artifacts }, ['verifying'], { runId: record.runId })
  if (!updated) throw new PlanningError('This preview finished elsewhere while it was being checked', 409)
  void noteProgress(record.id, { milestone: 'accepted' }, { statuses: ['ready'] })
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

// A record's refused submissions, for the creator: each attempt's problems
// and the player's evidence, its frames by URL (R09 of the project-flow
// rereview). Null for a record never refused.
const validationView = (record: PlanningRecord): ValidationView | null => {
  const validation = record.validation
  if (!validation?.attempts.length) return null
  const url = (frame: { objectKey: string }) => `/objects/${encodeURIComponent(frame.objectKey)}`
  return {
    budget: validation.budget,
    attempts: validation.attempts.map(attempt => ({
      attempt: attempt.attempt,
      at: attempt.at,
      bundle: attempt.bundle,
      problems: attempt.problems,
      evidence: (attempt.evidence || []).map(item => ({ kind: item.kind, at: item.at, pixels: item.pixels, region: item.region, layers: item.layers, size: item.size, frames: { first: url(item.frames.first), again: url(item.frames.again) } })),
    })),
  }
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
    latest: { id: newest.id, status: newest.status, revision: newest.revision, error: newest.error, runId: newest.runId, treatmentId: String(newest.inputs.treatmentId || ''), validation: validationView(newest) },
    ready,
    byTreatment,
  }
}

// ——— Production (P4): a scene made from its approved plan ———
// A production is of an exact approved plan, on the scene's real clock: the
// voice the product speaks from the plan's narration, the creator's take, or
// silence by choice. The clock is made before the run, once, and the run
// keeps to it. A production lands whatever happens to the scene afterwards,
// and reads as out of date once the approved plan, its inputs or the clock
// move. Accepting one renders it, once, into what the notebook plays and
// exports for the scene; nothing else starts anything.
const PRODUCER_SKILL = 'scene-producer'
const producerRef = async (planning: VideoPlanning): Promise<SkillBundleRef | null> => {
  const version = (await skillVersions()).find(entry => entry.name === PRODUCER_SKILL)
  return version && planning.bundle ? { name: PRODUCER_SKILL, version: version.version, hash: version.hash, upstreamCommit: planning.bundle.ref.upstreamCommit } : null
}
const roundClock = (seconds: number) => Math.round(seconds * 1000) / 1000

// The narration a scene speaks, moment by moment, from its approved plan.
const narrationOf = (plan: SceneTreatmentV1): NarrationLine[] =>
  plan.moments.map(moment => ({ id: moment.id, text: String(moment.narration?.guide || '').trim(), estimate: moment.estimateSeconds || 3, minimum: visualMinimumOf(moment) }))

// The lines a scene you present says, by moment: the approved plan's
// narration, as the recording guide asks for them and a take is recorded
// against. A moment without words is not a line.
const spokenLinesOf = (plan: SceneTreatmentV1) =>
  plan.moments.map(moment => ({ id: moment.id, say: scriptLinesOf(String(moment.narration?.guide || '')).join(' '), minimum: visualMinimumOf(moment) }))
// The stored object a take's URL names, on this Studio — by its path, or
// an address from any start of the app (F01 of the fix verification).
const objectKeyOf = (url: string | undefined) => {
  const ref = studioRefOf(url)
  return ref?.root === 'objects' ? ref.path : null
}

// What the scene's clock will be made from, before it is made. The same
// approved words in the same voice make the same clock; the same take
// makes the same clock.
// takes: the selected take, then any pickups, each with the moments whose
// lines it gives.
type ClockSource = { kind: ProductionClock['kind']; ref: string; missing?: string; takes?: Array<{ recordingId: string; objectKey: string; lines: string[] }> }
const clockSourceOf = (planning: VideoPlanning, sceneId: string, plan: SceneTreatmentV1): ClockSource => {
  const delivery = deliveryFor(planning, sceneId)
  if (delivery === 'generated') return { kind: 'generated-voice', ref: fingerprintOf({ lines: narrationOf(plan), voice: process.env.FISH_AUDIO_API_KEY ? 'fish' : 'system' }) }
  if (delivery === 'silent') return { kind: 'silent', ref: fingerprintOf({ moments: plan.moments.map(moment => [moment.id, moment.estimateSeconds || 3]) }) }
  if (delivery === 'human') {
    const take = planning.project.recordedBlocks?.[sceneId]
    if (!take) return { kind: 'take', ref: '', missing: 'Record and select a take of this scene first: a scene you present is produced on your take\'s clock.' }
    // Your picture and voice: the camera of a take, never a recording of the canvas.
    const camera = take.cameraUrl || (take.role === 'presenter' ? take.videoUrl : '')
    const objectKey = objectKeyOf(camera)
    if (!camera) return { kind: 'take', ref: '', missing: 'This take records the whole canvas, not you: production needs your camera take. Record the scene with the camera, then produce it.' }
    if (!objectKey) return { kind: 'take', ref: '', missing: 'This take\'s file is not stored in this Studio: record the scene again, then produce it.' }
    // Spoken against the approved plan's lines, which the moments are timed
    // by: each line from the selected take when it says it, else from the
    // newest pickup that does.
    const lines = spokenLinesOf(plan).filter(line => line.say)
    if (!lines.length) return { kind: 'take', ref: '', missing: 'The approved plan gives this scene no words: there is nothing for a take to be aligned to. Plan the scene again with its narration.' }
    const script = lines.map(line => line.say).join('\n\n')
    const recorded = take.script
    const wholeScript = !recorded?.lines && recorded?.hash === scriptFingerprint(script)
    const selected = { recordingId: take.recordingId, objectKey, lines: [] as string[] }
    const pickups = (planning.pickups.get(sceneId) || []).map(pickup => ({ ...pickup, objectKey: objectKeyOf(pickup.videoUrl) })).filter(pickup => pickup.objectKey)
    const used = new Map<string, { recordingId: string; objectKey: string; lines: string[] }>()
    const unsaid: string[] = []
    for (const line of lines) {
      const hash = lineFingerprints(line.say)[0]
      if (wholeScript || recorded?.lines?.includes(hash)) {
        selected.lines.push(line.id)
        continue
      }
      const pickup = pickups.find(entry => entry.lines.includes(hash))
      if (!pickup) {
        unsaid.push(line.say)
        continue
      }
      const entry = used.get(pickup.recordingId) || { recordingId: pickup.recordingId, objectKey: pickup.objectKey!, lines: [] }
      entry.lines.push(line.id)
      used.set(pickup.recordingId, entry)
    }
    if (unsaid.length === lines.length) return { kind: 'take', ref: '', missing: 'Your take was not recorded against the approved plan\'s lines. Use the plan\'s lines as the scene\'s script, record them, then produce the scene.' }
    if (unsaid.length) return { kind: 'take', ref: '', missing: `Your take does not say ${unsaid.length === 1 ? 'the plan\'s line' : `${unsaid.length} of the plan's lines, first`} “${unsaid[0]}”. Record only ${unsaid.length === 1 ? 'that line' : 'those lines'} — a pickup — or the whole scene again.` }
    const takes = [...(selected.lines.length ? [selected] : []), ...used.values()]
    return { kind: 'take', ref: takes.map(entry => `${entry.recordingId}:${entry.objectKey}:${entry.lines.join(',')}`).join('+'), takes }
  }
  return { kind: 'silent', ref: '', missing: 'Choose how this scene is delivered — you present it, a generated voice, or silent. A plan is made for its delivery, so plan and approve the scene again once it is chosen.' }
}

const productionInputsOf = (planning: VideoPlanning, approved: PlanningRecord, cast: VisualCastRevision | null, producer: SkillBundleRef | null, source: ClockSource) => ({
  schema: PLANNING_SCHEMA,
  scene: approved.subject,
  treatmentId: approved.id,
  treatmentFingerprint: approved.fingerprint,
  approvedAt: approved.approval?.at || '',
  castId: cast?.status === 'ready' ? cast.id : null,
  themeRef: planning.themeRef,
  producer: producer?.hash || '',
  runtime: SKETCH_RUNTIME.hyperframes,
  clock: `${source.kind}:${source.ref}`,
})
const productionIdOf = (approved: PlanningRecord) => `production-${approved.subject.replace(/[^a-z0-9-]/gi, '-').slice(-40)}-r${approved.revision}`

// The clock, made: the voice spoken and measured, or the plan's estimates
// held as silence when the scene is silent by choice.
// media: the files the product supplies to the production by path (the
// take, normalized), pinned by their stored objects. review: what the
// creator may want to look at on the clock.
type MadeClock = { clock: ProductionClock; audio: Buffer | null; provider: string | null; words: Array<{ id: string; words: string; spokenEnd: number }>; media?: Record<string, string>; review?: string[]; frame?: Buffer | null }
// The take, normalized, lives at this path in every production of it.
const TAKE_MEDIA = 'media/take.webm'
// A take's normalized file and its alignment, once per set of takes and plan lines.
type TakeMade = { objectKey: string; picture: boolean; duration: number; aligned: AlignedLine[]; frame: string | null }
// A take, normalized once: the file every production of it plays.
type NormalizedTake = { objectKey: string; picture: boolean; duration: number }
const normalizedTakeOf = async (projectId: string, sceneId: string, objectKey: string, dir: string) => {
  const key = `take-normal:${objectKey}`
  const path = join(dir, `${fingerprintOf(objectKey).slice(0, 16)}.webm`)
  let made = (await loadSetting(key)) as NormalizedTake | null
  if (made) {
    await writeLocalFile(path, await readStream((await getObject(made.objectKey)).stream))
    return { ...made, path }
  }
  const original = `${path}.original`
  await writeLocalFile(original, await readStream((await getObject(objectKey)).stream))
  const { picture, duration } = await normalizeTake(original, path)
  const stored = await storeAsset({ body: await readFile(path), contentType: 'video/webm', projectId, blockId: sceneId, kind: 'production-take', extension: '.webm' })
  made = { objectKey: stored.objectKey, picture, duration }
  await compareAndSwapSetting(key, null, made)
  return { ...made, path }
}
// Where a run of lines starts before its first word, and ends after its last.
const LEAD = 0.3
const TAIL = 0.45
const takeClock = async (projectId: string, sceneId: string, source: ClockSource, plan: SceneTreatmentV1): Promise<MadeClock> => {
  const lines = spokenLinesOf(plan)
  const spoken = lines.filter(line => line.say)
  const takes = source.takes || []
  const key = `take-clock:${fingerprintOf({ takes, lines: spoken })}`
  let made = (await loadSetting(key)) as TakeMade | null
  if (!made) {
    const dir = await mkdtemp(join(tmpdir(), 'studio-take-clock-'))
    try {
      const sources: Array<{ normalized: NormalizedTake & { path: string }; aligned: AlignedLine[] }> = []
      for (const take of takes) {
        const normalized = await normalizedTakeOf(projectId, sceneId, take.objectKey, dir)
        sources.push({ normalized, aligned: await alignTake(normalized.path, spoken.filter(line => take.lines.includes(line.id))) })
      }
      let result: { objectKey: string; picture: boolean; duration: number; aligned: AlignedLine[]; path: string }
      if (sources.length === 1) {
        result = { ...sources[0].normalized, aligned: sources[0].aligned }
      } else {
        // Runs of consecutive lines from one take, in the plan's order, each
        // cut in the pauses around its words and joined.
        const found = new Map(sources.flatMap((entry, index) => entry.aligned.map(line => [line.id, { index, line }] as const)))
        const runs: Array<{ index: number; lines: AlignedLine[] }> = []
        for (const line of spoken) {
          const at = found.get(line.id)
          if (!at || at.line.coverage < 0.5 || !at.line.words.length) throw new PlanningError(`Your ${at && at.index > 0 ? 'pickup' : 'take'} does not say “${line.say}”: record that line again.`, 409)
          const last = runs[runs.length - 1]
          if (last && last.index === at.index) last.lines.push(at.line)
          else runs.push({ index: at.index, lines: [at.line] })
        }
        const cuts = runs.map((run, at) => {
          const from = sources[run.index].normalized
          const first = run.lines[0].words[0].startMs / 1000
          const lastWords = run.lines[run.lines.length - 1].words
          const end = lastWords[lastWords.length - 1].endMs / 1000
          return { path: from.path, from: at === 0 ? 0 : Math.max(0, first - LEAD), to: at === runs.length - 1 ? from.duration : Math.min(from.duration, end + TAIL) }
        })
        const size = sources[0].normalized.picture ? await pictureSize(sources[0].normalized.path) : null
        const path = join(dir, 'composed.webm')
        const duration = await composeTakes(cuts, path, size)
        // Each line's words on the joined take's clock.
        const aligned: AlignedLine[] = []
        let offset = 0
        runs.forEach((run, at) => {
          const cut = cuts[at]
          const shift = (ms: number) => Math.round((offset + ms / 1000 - cut.from) * 1000)
          for (const line of run.lines) aligned.push({ ...line, startMs: shift(line.startMs), words: line.words.map(word => ({ ...word, startMs: shift(word.startMs), endMs: shift(word.endMs) })) })
          offset += cut.to - cut.from
        })
        const stored = await storeAsset({ body: await readFile(path), contentType: 'video/webm', projectId, blockId: sceneId, kind: 'production-take', extension: '.webm' })
        result = { objectKey: stored.objectKey, picture: Boolean(size), duration, aligned, path }
      }
      let frame: string | null = null
      if (result.picture) {
        const still = join(dir, 'frame.jpg')
        await takeFrame(result.path, Math.min(result.duration / 2, 2), still).catch(() => {})
        frame = await readFile(still).then(bytes => bytes.toString('base64'), () => null)
      }
      made = { objectKey: result.objectKey, picture: result.picture, duration: result.duration, aligned: result.aligned, frame }
      await compareAndSwapSetting(key, null, made)
    } catch (error) {
      if (error instanceof PlanningError) throw error
      throw new PlanningError(`Your take could not set the scene's clock: ${error instanceof Error ? error.message : String(error)}`, 503)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
  const clock = takeClockOf(lines, made.aligned, made.duration)
  if (clock.problems.length) throw new PlanningError(`Your take cannot set this scene's clock: ${clock.problems.join('; ')}. Record the scene again with every line, or ask for a plan that fits your take.`, 409)
  return {
    clock: { kind: 'take', audio: TAKE_MEDIA, video: made.picture ? TAKE_MEDIA : null, duration: made.duration, moments: clock.moments },
    audio: null,
    provider: takes.length > 1 ? 'Your take, with a pickup' : 'Your take',
    words: clock.spoken,
    media: { [TAKE_MEDIA]: made.objectKey },
    review: clock.review,
    frame: made.frame ? Buffer.from(made.frame, 'base64') : null,
  }
}

const makeClock = async (source: ClockSource, plan: SceneTreatmentV1, where: { projectId: string; sceneId: string }): Promise<MadeClock> => {
  if (source.kind === 'take') return takeClock(where.projectId, where.sceneId, source, plan)
  if (source.kind === 'generated-voice') {
    let voice: Awaited<ReturnType<typeof narrationClock>>
    try {
      voice = await narrationClock(narrationOf(plan))
    } catch (error) {
      throw new PlanningError(`The scene's voice could not be generated: ${error instanceof Error ? error.message : String(error)}`, 503)
    }
    return {
      clock: { kind: 'generated-voice', audio: 'audio/narration.mp3', video: null, duration: voice.duration, moments: voice.moments.map(({ id, start, end }) => ({ id, start, end })) },
      audio: voice.audio,
      provider: voice.provider,
      words: voice.moments.map(({ id, words, spokenEnd }) => ({ id, words, spokenEnd })),
      // The moments held after their words, said.
      review: voice.moments.filter(moment => moment.held > 0).map(moment => `moment ${moment.id} is held ${moment.held}s after its words, so what changes in it can be seen — ${round1(moment.end - moment.start)}s in all`),
    }
  }
  let at = 0
  const moments = plan.moments.map(moment => {
    const start = at
    at = roundClock(at + (moment.estimateSeconds || 3))
    return { id: moment.id, start, end: at }
  })
  return { clock: { kind: 'silent', audio: null, video: null, duration: at, moments }, audio: null, provider: null, words: [] }
}

// The newest ready sketch of a plan revision, whose code and ids production builds on.
const sketchFilesFor = async (records: PlanningRecord[], treatmentId: string) => {
  const sketch = records.filter(record => record.kind === 'preview' && record.status === 'ready' && record.artifacts && String(record.inputs.treatmentId || '') === treatmentId).sort((a, b) => b.revision - a.revision)[0]
  if (!sketch?.artifacts) return null
  return (JSON.parse((await readStream((await getObject(sketch.artifacts.objectKey)).stream)).toString('utf8')) as { files: SketchFiles }).files
}

const productionPacket = async (planning: VideoPlanning, approved: PlanningRecord, records: PlanningRecord[], made: MadeClock, note = '') => {
  const briefRecord = records.find(record => record.id === String(approved.inputs.briefId || '')) || currentBrief(records)
  if (!briefRecord?.content) throw new PlanningError('The brief this plan was made from is gone', 409)
  const plan = approved.content as SceneTreatmentV1
  const files = await scenePacket(planning, briefRecord, approved.subject, records, { castKeys: castKeysOf(plan) })
  const compositionId = productionIdOf(approved)
  files['packet/PLAN.json'] = JSON.stringify({ record: approved.id, revision: approved.revision, status: approved.status, approvedAt: approved.approval?.at || null, plan }, null, 2)
  const presenter = plan.moments.map(moment => ({ id: moment.id, visibility: moment.presenter?.visibility || 'hidden' }))
  files['packet/CLOCK.json'] = JSON.stringify({ ...made.clock, provider: made.provider, spoken: made.words, ...(made.clock.kind === 'take' ? { presenter, review: made.review || [], media: Object.keys(made.media || {}) } : {}) }, null, 2)
  if (made.audio) files['packet/audio/narration.mp3'] = { base64: made.audio.toString('base64'), contentType: 'audio/mpeg' }
  if (made.frame) files['packet/references/take-frame.jpg'] = { base64: made.frame.toString('base64'), contentType: 'image/jpeg' }
  const sketch = await sketchFilesFor(records, approved.id)
  for (const [name, file] of Object.entries(sketch || {})) files[`packet/references/sketch/${name}`] = file
  files['packet/PRODUCTION.md'] = [
    `# Production: scene “${approved.subject}” from approved plan r${approved.revision}`,
    '',
    'Build the scene itself: one standalone Hyperframes composition that realizes the approved plan with its final artwork, on the clock in `CLOCK.json`. This is the scene the creator accepts, the notebook plays and the export renders — not a sketch.',
    '',
    `- Composition id: \`${compositionId}\` — the root's \`data-composition-id\` and the \`window.__timelines\` key.`,
    `- Canvas: 1920×1080 at 30 fps. Length: the clock's ${made.clock.duration}s (at most 2s more to settle). Every moment keeps its interval on the clock, in the plan's order.`,
    made.clock.kind === 'generated-voice'
      ? `- Sound: copy \`audio/narration.mp3\` into \`production/audio/\` and play it from the start with an \`<audio>\` element (\`src="audio/narration.mp3"\`). The voice says each moment's words inside its interval; time what the viewer sees to what is said.`
      : made.clock.kind === 'take'
        ? [
            `- Sound and picture: the creator's own take, at \`${TAKE_MEDIA}\`. The product supplies that file to the production; do not copy it and write nothing under \`production/media/\`. Its moments are where the creator says each line (\`CLOCK.json\` \`spoken\`); time what the viewer sees to what they say.`,
            `- Play its sound from the start, once: \`<audio id="voice" src="${TAKE_MEDIA}" data-start="0" data-duration="${made.clock.duration}" data-track-index="20"></audio>\`. The voice carries on through every moment, whether or not the creator is in view.`,
            made.clock.video
              ? `- Play its picture in one presenter layer: a single muted \`<video id="take" src="${TAKE_MEDIA}" muted playsinline data-start="0" data-duration="${made.clock.duration}">\` for the whole scene, inside a wrapper your timeline moves. Each moment's \`presenter\` in \`CLOCK.json\` says where the creator is: \`full\` fills the frame, \`shared\` sits beside the graphics (the side the graphics leave free), \`hidden\` is out of view while the voice continues. Never restart or offset the picture: it stays in step with the voice. \`references/take-frame.jpg\` shows the framing.`
              : '- The take has no picture: the scene has no presenter layer.',
          ].join('\n')
        : '- Sound: the scene is silent by the creator\'s choice. Its moments keep the plan\'s estimates.',
    `- Runtime: load only \`${SKETCH_RUNTIME_SCRIPTS.join('` and `')}\` (Hyperframes ${SKETCH_RUNTIME.hyperframes}, pinned). Nothing from the network, no clock, no randomness.`,
    '- Artwork: the approved plan\'s objects, from the cast (`assets/<id>/asset.svg`, copied into `production/assets/`) or precise native shapes. No placeholders and no stand-ins: what the plan asked for that you cannot draw goes in `manifest.unmet`, by name.',
    sketch ? '- The approved plan\'s own sketch is in `references/sketch/`: build on its code and keep its moment and entity ids where they serve; it is a reference, not the result.' : '- There is no sketch of this plan; build from the plan and the cast.',
    '',
    'Write `production/index.html`, `production/manifest.json`, `production/audio/` and any `production/assets/`, following `references/production-contract.md`, then call `produce_submit_scene`. Fix exactly the problems it names; stop when it is accepted.',
    '',
    ...(note
      ? [
          '## The creator asks for a change',
          '',
          'The creator watched the previous production of this scene and asked for this change, which its controls could not make. Make it within the approved plan and the clock; if it needs a different plan, produce what the plan allows and name the rest in `manifest.unmet`.',
          '',
          ...note.split('\n').map(line => `> ${line}`),
          '',
        ]
      : []),
  ].join('\n')
  const context = JSON.parse(String(files['packet/CONTEXT.json'])) as Record<string, unknown>
  files['packet/CONTEXT.json'] = JSON.stringify({ ...context, route: 'Produce Scene', plan: { record: approved.id, revision: approved.revision }, clock: { kind: made.clock.kind, duration: made.clock.duration }, composition: { id: compositionId, width: 1920, height: 1080, fps: 30, duration: made.clock.duration }, runtime: { hyperframes: SKETCH_RUNTIME.hyperframes, scripts: SKETCH_RUNTIME_SCRIPTS } }, null, 2)
  return files
}

// Produce this scene from its approved plan. The same approved plan on the
// same clock is produced once, unless a new production is asked for.
export const queueProduction = async (projectId: string, sceneId: string, options: { again?: boolean; note?: string } = {}) => {
  const planning = await loadVideoPlanning(projectId)
  const producer = await producerRef(planning)
  if (!planning.bundle || !producer) throw new PlanningError('Production runs in the desktop app, where the pinned skills and your local harness are', 409)
  const records = await listPlanningRecords(projectId)
  const fresh = freshnessOf(planning, records)
  const view = scenePlanningView(records, sceneId, fresh.sceneNow(sceneId))
  const approved = view.reviewed
  if (!approved?.content) throw new PlanningError('Approve this scene\'s plan before producing it', 409)
  const freshness = fresh.treatment(approved)
  if (!freshness.fresh) throw new PlanningError(`The approved plan is stale: ${freshness.reason}. Plan and approve the scene again first.`, 409)
  const plan = approved.content as SceneTreatmentV1
  const source = clockSourceOf(planning, sceneId, plan)
  if (source.missing) throw new PlanningError(source.missing, 409)
  const cast = await visualCastFor(planning)
  // A change the creator asked for, which the controls could not make, is
  // part of what this production is made from.
  const note = String(options.note || '').trim().slice(0, 2000)
  const inputs = { ...productionInputsOf(planning, approved, cast, producer, source), ...(note ? { note } : {}) }
  const fingerprint = fingerprintOf(inputs)
  const existing = reuseActive(records, 'production', sceneId, fingerprint)
  if (existing) return { record: existing, reused: true }
  if (!options.again) {
    const made = records.filter(record => record.kind === 'production' && record.subject === sceneId && ['ready', 'reviewed'].includes(record.status) && record.fingerprint === fingerprint).sort((a, b) => b.revision - a.revision)[0]
    if (made) return { record: made, reused: true }
  }
  // The clock is made now, once: the voice spoken and measured before the run.
  const made = await makeClock(source, plan, { projectId, sceneId })
  const files = await productionPacket(planning, approved, records, made, note)
  const packet = await storePacket(projectId, files)
  return claimPlanningRecord({
    projectId,
    kind: 'production',
    subject: sceneId,
    fingerprint,
    inputs: { ...inputs, packetObjectKey: packet.objectKey, clockDetail: made.clock, voiceProvider: made.provider, media: made.media || null, clockReview: made.review || [] },
    direction: '',
    skillBundle: producer,
    workflow: 'production',
  })
}

// A production stays what its approved plan asks for now only while that
// plan is the scene's approved, fresh plan and its theme, cast, clock and
// pinned skills are the ones it was made with.
const productionFreshness = (planning: VideoPlanning, cast: VisualCastRevision | null, records: PlanningRecord[], view: ScenePlanningView, production: PlanningRecord, producer: SkillBundleRef | null) => {
  const approved = records.find(record => record.id === String(production.inputs.treatmentId || '') && record.kind === 'treatment')
  if (!approved?.content) return { current: false, staleBecause: 'the plan it produces is gone' }
  if (approved.id !== view.reviewed?.id) return { current: false, staleBecause: `it produces r${approved.revision}; the scene's approved plan is ${view.reviewed ? `r${view.reviewed.revision}` : 'none now'}` }
  const planFresh = freshnessOf(planning, records).treatment(approved)
  if (!planFresh.fresh) return { current: false, staleBecause: `its approved plan is stale — ${planFresh.reason}` }
  const source = clockSourceOf(planning, approved.subject, approved.content as SceneTreatmentV1)
  const now = productionInputsOf(planning, approved, cast, producer, source)
  const was = production.inputs
  const changed = [
    now.treatmentFingerprint !== was.treatmentFingerprint ? 'the plan changed' : '',
    now.approvedAt !== was.approvedAt ? 'the plan was approved again' : '',
    now.themeRef !== was.themeRef ? 'the theme changed' : '',
    now.castId !== null && now.castId !== (was.castId ?? null) && !castKeysKept(approved, cast) ? 'the visual cast changed' : '',
    producer && now.producer !== was.producer ? 'the production skills changed' : '',
    now.clock !== was.clock ? (source.kind === 'take' ? 'the scene\'s take changed' : 'the scene\'s voice or delivery changed') : '',
  ].filter(Boolean)
  return changed.length ? { current: false, staleBecause: changed.join('; ') } : { current: true, staleBecause: null }
}

const clockOfRecord = (record: PlanningRecord) => record.inputs.clockDetail as ProductionClock | undefined
// The manifest as the pinned player's check reads a composition.
const asPlayable = (manifest: ProductionManifest): SketchManifest => ({
  version: 1,
  scene: manifest.scene,
  plan: manifest.plan,
  composition: manifest.composition,
  runtime: manifest.runtime,
  moments: manifest.moments.map(moment => ({ ...moment, estimated: false })),
  layers: manifest.layers.map(layer => ({ ...layer, placeholder: null })),
  provisional: [],
  schedule: manifest.schedule || null,
})

export const submitProduction = async (recordId: string, raw: unknown, runId?: string, submission?: Submission) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'production') throw new PlanningError('Production record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This production already finished as ${record.status}`, 409)
  if (record.status === 'verifying') throw new PlanningError('A submission of this production is being played to check it; wait for its answer', 409)
  assertOwner(record, runId)
  void noteProgress(record.id, { milestone: 'submitted' }, { runId })
  const approved = await loadPlanningRecord(String(record.inputs.treatmentId || ''))
  if (!approved?.content) throw new PlanningError('The approved plan this production is of is gone', 409)
  const clock = clockOfRecord(record)
  if (!clock) throw new PlanningError('This production has no clock', 409)
  // The harness's own files; what the product supplies is added to check
  // and play it, and is never taken from the submission.
  const own = Object.fromEntries(Object.entries(sketchFilesOf(raw)).filter(([path]) => !path.startsWith('media/')))
  // Its type, set in faces the stage and the render share (B11), prepared
  // before anything checks it (R10): the bundle checked, played and
  // rendered is this one.
  const typed = await preparedType(own['index.html'], record.id)
  if (typed) own['index.html'] = typed.html
  const files = { ...own, ...(await productionMedia(record)) }
  const report = validateProduction(files, {
    scene: record.subject,
    plan: { record: approved.id, revision: approved.revision, content: approved.content as SceneTreatmentV1 },
    compositionId: productionIdOf(approved),
    clock,
    assetKeys: (await libraryAssets()).map(asset => asset.key),
  })
  const html = typeof files['index.html'] === 'string' ? files['index.html'] : ''
  const lint = html ? await lintSketch(html) : null
  const { problems: lintProblems, warnings: lintWarnings } = lintFindingsOf(lint, typed?.report)
  const problems = [...report.problems, ...lintProblems]
  if (problems.length || !report.manifest) {
    const refused = await refuse(record, { runId, submission, bundle: sketchBundleHash(own), problems })
    return { accepted: false as const, problems, warnings: [...report.warnings, ...lintWarnings], ...refusalOf(refused) }
  }
  const verifying = await updatePlanningRecord(record.id, { status: 'verifying' }, ['queued', 'running'], { runId: record.runId })
  if (!verifying) throw new PlanningError('This production finished elsewhere while it was being checked', 409)
  void noteProgress(record.id, { milestone: 'checking' }, { runId })
  const typeNotes = typeNotesOf(typed?.report)
  let runtime: Awaited<ReturnType<typeof verifySketchRuntime>>
  try {
    runtime = await verifySketchRuntime(files, asPlayable(report.manifest), approved.content as SceneTreatmentV1)
  } catch (error) {
    const message = `The production could not be played to check it: ${error instanceof Error ? error.message : String(error)}`
    await updatePlanningRecord(record.id, { status: 'failed', error: { message, category: 'verification', recovery: ['Retry'] } }, ['verifying'])
    throw new PlanningError(`${message}. Stop the run; the creator can retry the production.`, 503)
  }
  // Its sound, when it has one, was asked for and found.
  const sound = clock.audio && runtime.proof && !runtime.proof.loaded.some(path => path.endsWith(clock.audio!)) ? [`the composition never loaded its sound "${clock.audio}" when played`] : []
  if (runtime.problems.length || !runtime.proof || sound.length) {
    const back = await updatePlanningRecord(record.id, { status: 'running' }, ['verifying'], { runId: record.runId })
    if (!back) throw new PlanningError('This production finished elsewhere while it was being checked', 409)
    const refused = await refuse(back, { runId, submission, bundle: sketchBundleHash(own), problems: [...runtime.problems, ...sound], evidence: runtime.evidence })
    return { accepted: false as const, problems: [...runtime.problems, ...sound], warnings: [...report.warnings, ...lintWarnings, ...runtime.warnings], ...refusalOf(refused) }
  }
  const artifacts = await storeAsset({ body: Buffer.from(JSON.stringify({ record: record.id, files: own }), 'utf8'), contentType: 'application/json; charset=utf-8', projectId: record.projectId, kind: 'planning-production', extension: '.json' })
  const planning = await loadVideoPlanning(record.projectId)
  const castNow = await knownCast(planning)
  const records = await listPlanningRecords(record.projectId)
  const view = scenePlanningView(records, record.subject, freshnessOf(planning, records).sceneNow(record.subject))
  const moved = productionFreshness(planning, castNow, records, view, record, await producerRef(planning))
  const warnings = [...report.warnings, ...lintWarnings, ...runtime.warnings, ...typeNotes, ...(moved.current ? [] : [`While this scene was produced, ${moved.staleBecause} — it is kept, as out of date`])]
  const updated = await updatePlanningRecord(record.id, { status: 'ready', content: report.manifest, report: { warnings, verification: runtime.proof, ...(typed ? { type: typed.report } : {}) }, artifacts }, ['verifying'], { runId: record.runId })
  if (!updated) throw new PlanningError('This production finished elsewhere while it was being checked', 409)
  await carryEdits(updated).catch(error => console.warn('carrying edits to a new production failed', updated.id, error))
  void noteProgress(record.id, { milestone: 'accepted' }, { statuses: ['ready'] })
  return { accepted: true as const, status: 'ready', record: updated, warnings }
}

// The files the product supplies to a production (the creator's take), by
// path. They are pinned by the record and never stored in its bundle; the
// stage reads them as bytes, the check and the render as bundle files.
const mediaBytes = new Map<string, Buffer>()
const mediaOf = async (record: PlanningRecord) => {
  const media = (record.inputs.media || {}) as Record<string, string>
  const found: Record<string, { body: Buffer; contentType: string }> = {}
  for (const [path, objectKey] of Object.entries(media)) {
    let body = mediaBytes.get(objectKey)
    if (!body) {
      body = await readStream((await getObject(objectKey)).stream)
      if (mediaBytes.size >= 3) mediaBytes.delete(mediaBytes.keys().next().value as string)
      mediaBytes.set(objectKey, body)
    }
    found[path] = { body, contentType: path.endsWith('.webm') ? 'video/webm' : 'application/octet-stream' }
  }
  return found
}
const productionMedia = async (record: PlanningRecord): Promise<SketchFiles> =>
  Object.fromEntries(Object.entries(await mediaOf(record)).map(([path, file]) => [path, { base64: file.body.toString('base64'), contentType: file.contentType }]))
const productionFiles = async (record: PlanningRecord) => ({ ...(await bundleFilesOf(record)), ...(await productionMedia(record)) })
// The bundle's own files, without what the product supplies.
const bundleFilesOf = async (record: PlanningRecord) => {
  if (!record.artifacts) throw new PlanningError('Production not found', 404)
  let files = bundles.get(record.artifacts.objectKey)
  if (!files) {
    files = (JSON.parse((await readStream((await getObject(record.artifacts.objectKey)).stream)).toString('utf8')) as { files: SketchFiles }).files
    if (bundles.size > 24) bundles.delete(bundles.keys().next().value as string)
    bundles.set(record.artifacts.objectKey, files)
  }
  return files
}
// A production's files, for the Studio's stage: the bundle as it was
// submitted, playing with the creator's current values for its controls.
export const loadProductionFile = async (recordId: string, path: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'production' || !['ready', 'reviewed'].includes(record.status)) throw new PlanningError('Production not found', 404)
  // The take, as bytes: a player asks for it range by range.
  if (path in ((record.inputs.media || {}) as Record<string, string>)) {
    const media = (await mediaOf(record))[path]
    if (media) return media
  }
  const files = await bundleFilesOf(record)
  const file = path === 'index.html' && typeof files[path] === 'string' ? withControlValues(files[path] as string, (await productionEdits(record.id)).values) : files[path]
  if (file === undefined) throw new PlanningError('No such file in the production', 404)
  return previewFileBody(path, file)
}

// ——— Edits (P6): the creator's values for a production's controls ———
// Stored per production, revision by revision; the composition's code reads
// them through the controls its manifest declares, in the stage, the check
// and the render alike. The bundle hash and the edit revision name a result.
export type ProductionEdits = {
  revision: number
  values: ControlValues
  updatedAt: string | null
  // Edits carried from an earlier production of the scene when this one
  // landed: what was applied, and what no longer fits, with why.
  carried: { from: string; applied: string[]; conflicts: Array<{ id: string; value: number; reason: string }> } | null
}
const NO_EDITS: ProductionEdits = { revision: 0, values: {}, updatedAt: null, carried: null }
const editsKey = (recordId: string) => `production-edits:${recordId}`
export const productionEdits = async (recordId: string) => ((await loadSetting(editsKey(recordId))) as ProductionEdits | null) || NO_EDITS
const editedFiles = async (record: PlanningRecord, values: ControlValues): Promise<SketchFiles> => {
  const files = await productionFiles(record)
  const html = files['index.html']
  return typeof html === 'string' ? { ...files, 'index.html': withControlValues(html, values) } : files
}

// Saves the creator's values, against the revision they were made on: an
// edit made on an older revision is refused, never merged. A value is kept
// only inside its control's declared range.
export const saveProductionEdits = async (recordId: string, input: { revision?: unknown; values?: unknown }) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'production' || !record.content || !['ready', 'reviewed'].includes(record.status)) throw new PlanningError('Only a produced scene can be edited', 409)
  const controls = (record.content as ProductionManifest).controls || []
  if (!controls.length) throw new PlanningError('This production exposes no controls: ask for the change, and the scene is produced again with it', 409)
  const values = (input.values && typeof input.values === 'object' ? input.values : {}) as ControlValues
  const problems = controlValueProblems(controls, values)
  if (problems.length) throw new PlanningError(problems.join('; '), 422)
  const stored = (await loadSetting(editsKey(recordId))) as ProductionEdits | null
  const current = stored || NO_EDITS
  if (input.revision !== current.revision) throw new PlanningError(`These edits were made on edit ${String(input.revision)}; the scene is at edit ${current.revision} now. Reload it and make the change again.`, 409)
  const next: ProductionEdits = { revision: current.revision + 1, values: Object.fromEntries(Object.entries(values).map(([id, value]) => [id, Math.round(value * 1000) / 1000])), updatedAt: new Date().toISOString(), carried: current.carried }
  if (!(await compareAndSwapSetting(editsKey(recordId), stored, next))) throw new PlanningError('The edits changed while this one was saved. Reload them and make the change again.', 409)
  return next
}

// A new production of a scene takes the creator's edits from the one before
// it where they still fit: the same control, on the same moment, inside its
// new range. Anything else is kept as a conflict, never applied elsewhere.
const carryEdits = async (record: PlanningRecord) => {
  const manifest = record.content as ProductionManifest | null
  const controls = manifest?.controls || []
  if (!manifest || (await loadSetting(editsKey(record.id)))) return
  const earlier = (await listPlanningRecords(record.projectId))
    .filter(entry => entry.kind === 'production' && entry.subject === record.subject && entry.revision < record.revision && entry.content)
    .sort((a, b) => b.revision - a.revision)
  for (const previous of earlier) {
    // The newest production the creator edited decides, even when they reset it.
    const edits = await productionEdits(previous.id)
    if (!edits.revision) continue
    if (!Object.keys(edits.values).length) return
    const before = (previous.content as ProductionManifest).controls || []
    const applied: ControlValues = {}
    const conflicts: Array<{ id: string; value: number; reason: string }> = []
    for (const [id, value] of Object.entries(edits.values)) {
      const was = before.find(control => control.id === id)
      const now = controls.find(control => control.id === id)
      if (!now) conflicts.push({ id, value, reason: `the new production has no control “${was?.label || id}”` })
      else if (was && was.moment !== now.moment) conflicts.push({ id, value, reason: `“${now.label}” is on moment ${now.moment} now, not ${was.moment}` })
      else if (value < now.min || value > now.max) conflicts.push({ id, value, reason: `${value}s is outside “${now.label}”'s new range, ${now.min}–${now.max}s` })
      else applied[id] = value
    }
    const next: ProductionEdits = { revision: 1, values: applied, updatedAt: new Date().toISOString(), carried: { from: previous.id, applied: Object.keys(applied), conflicts } }
    await compareAndSwapSetting(editsKey(record.id), null, next)
    return
  }
}

// The edits of the productions an overview shows: each scene's newest
// produced one and the one accepted.
const editsOfShown = async (records: PlanningRecord[]) => {
  const shown = new Set<string>()
  const productions = records.filter(record => record.kind === 'production').sort((a, b) => b.revision - a.revision)
  for (const scene of new Set(productions.map(record => record.subject))) {
    const mine = productions.filter(record => record.subject === scene)
    const ready = mine.find(record => record.status === 'ready' || record.status === 'reviewed')
    const accepted = mine.find(record => record.status === 'reviewed' && record.approval?.render)
    if (ready) shown.add(ready.id)
    if (accepted) shown.add(accepted.id)
  }
  return new Map(await Promise.all([...shown].map(async id => [id, await productionEdits(id)] as const)))
}

// Accepting a production pins it as the scene's output: the bundle is
// rendered once by the pinned producer, and that render is what the
// notebook plays and exports for the scene. Only a current production can
// be accepted; an earlier acceptance stays, as history.
export const acceptProduction = async (recordId: string) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'production') throw new PlanningError('Production record not found', 404)
  const edits = await productionEdits(record.id)
  // An accepted production is accepted again only to render newer edits.
  const reaccept = record.status === 'reviewed' && record.approval?.render && (record.approval.render.edits?.revision ?? 0) !== edits.revision
  if ((record.status !== 'ready' && !reaccept) || !record.content) throw new PlanningError(record.status === 'reviewed' ? 'This produced scene is already accepted, with these edits' : `Only a produced scene can be accepted (this one is ${record.status})`, 409)
  const planning = await loadVideoPlanning(record.projectId)
  const records = await listPlanningRecords(record.projectId)
  const view = scenePlanningView(records, record.subject, freshnessOf(planning, records).sceneNow(record.subject))
  const freshness = productionFreshness(planning, await knownCast(planning), records, view, record, await producerRef(planning))
  if (!freshness.current) throw new PlanningError(`This production is out of date: ${freshness.staleBecause}. Produce the scene again first.`, 409)
  const manifest = record.content as ProductionManifest
  const files = await editedFiles(record, edits.values)
  // Edited, it is played again before it is rendered: values inside their
  // ranges are still code that must play.
  if (edits.revision) {
    const approved = records.find(entry => entry.id === String(record.inputs.treatmentId || ''))
    const runtime = await verifySketchRuntime(files, asPlayable(manifest), approved?.content as SceneTreatmentV1)
    if (runtime.problems.length || !runtime.proof) throw new PlanningError(`With your edits the scene does not play: ${runtime.problems.join('; ') || 'it could not be checked'}. Undo the edit, or ask for the change.`, 422)
  }
  let video: Buffer
  try {
    video = await renderProductionBundle(files, { fps: manifest.composition.fps || 30 })
  } catch (error) {
    throw new PlanningError(`The produced scene could not be rendered: ${error instanceof Error ? error.message : String(error)}`, 503)
  }
  const stored = await storeAsset({ body: video, contentType: 'video/mp4', projectId: record.projectId, blockId: record.subject, kind: 'produced-scene', extension: '.mp4' })
  const approved = records.find(entry => entry.id === String(record.inputs.treatmentId || ''))
  const at = new Date().toISOString()
  const approval = {
    at,
    fingerprint: record.fingerprint,
    briefId: String(approved?.inputs.briefId || ''),
    briefFingerprint: String(approved?.inputs.briefFingerprint || ''),
    castId: (record.inputs.castId as string | null) ?? null,
    render: { assetId: stored.assetId, objectKey: stored.objectKey, durationMs: Math.round(manifest.composition.duration * 1000), bundle: record.report?.verification?.bundle || '', edits: { revision: edits.revision, values: edits.values } },
  }
  const updated = await updatePlanningRecord(record.id, { status: 'reviewed', reviewedAt: at, approval }, reaccept ? ['reviewed'] : ['ready'])
  if (!updated) throw new PlanningError('This production changed while it was being accepted', 409)
  return updated
}

// A scene's productions: the newest of any status, the newest ready one,
// and the one accepted as its output — each saying whether it is still
// what the approved plan asks for now, and if not, why.
const productionOf = (records: PlanningRecord[], sceneId: string, freshness: (production: PlanningRecord) => { current: boolean; staleBecause: string | null }, edits: Map<string, ProductionEdits>) => {
  const mine = records.filter(record => record.kind === 'production' && record.subject === sceneId).sort((a, b) => b.revision - a.revision)
  const newest = mine[0]
  if (!newest) return null
  const viewOf = (production: PlanningRecord) => {
    const manifest = production.content as ProductionManifest | null
    if (!manifest) return null
    const { current, staleBecause } = freshness(production)
    return {
      id: production.id,
      url: `/api/planning/productions/${encodeURIComponent(production.id)}/index.html`,
      of: { record: String(production.inputs.treatmentId || ''), revision: manifest.plan.revision },
      current,
      staleBecause,
      summary: productionSummary(manifest),
      warnings: production.report?.warnings || [],
      adapter: production.adapter,
      model: production.reportedModel || production.model,
      checked: checkedOf(production.report?.verification),
      voice: (production.inputs.voiceProvider as string | null) ?? null,
      clockReview: Array.isArray(production.inputs.clockReview) ? (production.inputs.clockReview as string[]) : [],
      type: production.report?.type || null,
      accepted: production.status === 'reviewed' && production.approval?.render
        ? { at: production.approval.at, url: `/objects/${production.approval.render.objectKey}`, durationMs: production.approval.render.durationMs, bundle: production.approval.render.bundle, edits: production.approval.render.edits?.revision ?? 0 }
        : null,
      // The creator's values for its controls, as the stage plays them.
      edits: edits.get(production.id) || NO_EDITS,
    }
  }
  const ready = mine.find(record => record.status === 'ready' || record.status === 'reviewed')
  const accepted = mine.find(record => record.status === 'reviewed' && record.approval?.render)
  return {
    latest: { id: newest.id, status: newest.status, revision: newest.revision, error: newest.error, runId: newest.runId, treatmentId: String(newest.inputs.treatmentId || ''), validation: validationView(newest) },
    ready: ready ? viewOf(ready) : null,
    accepted: accepted ? viewOf(accepted) : null,
  }
}

// ——— A run's progress, as the product confirmed it (U3 of the scene workspace plan) ———
// Milestones are what the product itself saw — the run claiming its record,
// reading its packet, publishing a checked draft, handing its result in, the
// check's answer — never a guess from what the harness says it reads. One
// update at a time per record, only while it is active (or in the statuses
// given), and only from the run that owns it; a bounded list on the record.
const PROGRESS_EVENTS = 40
const progressQueues = new Map<string, Promise<unknown>>()
type Milestone = { milestone: ProgressMilestone; section?: 'explanation' | 'moments'; count?: number; note?: string }
export const noteProgress = (recordId: string, event: Milestone, options: { runId?: string; draft?: Omit<PlanDraft, 'at'>; statuses?: PlanningStatus[] } = {}) => {
  const next = (progressQueues.get(recordId) || Promise.resolve())
    .catch(() => null)
    .then(async () => {
      const record = await loadPlanningRecord(recordId)
      const statuses = options.statuses || [...ACTIVE_STATUSES]
      if (!record || !statuses.includes(record.status)) return null
      if (options.runId && record.runId && record.runId !== options.runId) return null
      const at = new Date().toISOString()
      const progress = record.progress || { events: [], draft: null }
      const seq = (progress.events[progress.events.length - 1]?.seq ?? 0) + 1
      const events = [...progress.events, { seq, at, ...event }].slice(-PROGRESS_EVENTS)
      const draft = options.draft ? { ...(progress.draft || {}), ...options.draft, at } : progress.draft
      return updatePlanningRecord(record.id, { progress: { events, draft } }, statuses)
    })
  progressQueues.set(recordId, next)
  void next.finally(() => {
    if (progressQueues.get(recordId) === next) progressQueues.delete(recordId)
  })
  return next
}

// A section of a scene plan, published by its run while it works: checked
// here, then shown to the creator as a draft still being checked.
export const publishDraft = async (recordId: string, runId: string, section: unknown, input: Record<string, unknown>) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'treatment') throw new PlanningError('Scene plan record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This scene plan already finished as ${record.status}`, 409)
  assertOwner(record, runId)
  const checked = validateDraft(section, input)
  if (!checked.ok) return { accepted: false as const, problems: checked.problems }
  const count = 'moments' in checked.draft ? checked.draft.moments.length : undefined
  await noteProgress(record.id, { milestone: 'draft', section: checked.section, ...(count !== undefined ? { count } : {}) }, { runId, draft: checked.draft })
  return { accepted: true as const }
}

// The run that serves a record claims it as it starts: queued → running,
// once. The same run asking again (a retry after a lost response) gets the
// record; any other run is refused, so a record never changes owner.
export const attachRun = async (recordId: string, run: { runId: string; adapter?: string; model?: string }) => {
  const claimed = await updatePlanningRecord(recordId, { status: 'running', runId: run.runId, adapter: run.adapter || null, model: run.model || null }, ['queued'], { runId: null })
  if (claimed) {
    void noteProgress(recordId, { milestone: 'started' }, { runId: run.runId })
    return claimed
  }
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

export const submitBrief = async (recordId: string, raw: unknown, runId?: string, submission?: Submission) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'brief') throw new PlanningError('Brief record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This brief already finished as ${record.status}`, 409)
  assertOwner(record, runId)
  void noteProgress(record.id, { milestone: 'submitted' }, { runId })
  const { planning, context } = await pinnedBriefContext(record)
  const report = validateBrief(raw, context)
  if (!report.ok) {
    const refused = await refuse(record, { runId, submission, bundle: null, problems: report.problems })
    return { accepted: false as const, problems: report.problems, warnings: report.warnings, attempt: refused.attempt, remaining: refused.remaining }
  }
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
  void noteProgress(record.id, { milestone: 'accepted' }, { statuses: [status] })
  return { accepted: true as const, status, record: updated, warnings: report.warnings, ...(landing.lands ? {} : { note: landing.reason }) }
}

// The verified objects of a scene's own page, which its plan decides one by
// one, and what that page is (a designed slide, a schematic, a page).
const pageObjectsOf = async (planning: VideoPlanning, origins: string[]) => {
  const cast = await knownCast(planning)
  const pageKind = planning.basePages.find(page => origins.includes(page.scene))?.pageKind || 'page'
  if (cast?.status !== 'ready') return { pageKind, pageObjects: [] }
  const pageObjects = cast.entries
    .filter(entry => origins.includes(entry.identity.base.page) && entry.verification.status === 'verified' && entry.libraryKey)
    .map(entry => ({ key: String(entry.libraryKey), label: entry.meaning.label }))
  return { pageKind, pageObjects }
}

export const submitTreatment = async (recordId: string, raw: unknown, runId?: string, submission?: Submission) => {
  const record = await loadPlanningRecord(recordId)
  if (!record || record.kind !== 'treatment') throw new PlanningError('Scene plan record not found', 404)
  if (!ACTIVE_STATUSES.includes(record.status)) throw new PlanningError(`This scene plan already finished as ${record.status}`, 409)
  assertOwner(record, runId)
  void noteProgress(record.id, { milestone: 'submitted' }, { runId })
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
    ...(await pageObjectsOf(planning, scene.originScenes)),
  }
  const report = validateTreatment(raw, context)
  if (!report.ok) {
    const refused = await refuse(record, { runId, submission, bundle: null, problems: report.problems })
    return { accepted: false as const, problems: report.problems, warnings: report.warnings, attempt: refused.attempt, remaining: refused.remaining }
  }
  const records = await listPlanningRecords(record.projectId)
  const landing = landingFor(record, records, freshnessOf(planning, records).treatment(record))
  const artifacts = await storeResult(record, { 'treatment.json': JSON.stringify(report.treatment, null, 2) })
  const status = landing.lands ? 'candidate' : 'superseded'
  const updated = await updatePlanningRecord(
    record.id,
    {
      status,
      content: report.treatment,
      // What it claims more strongly than its evidence, or keeps saying
      // after a direction asked to drop it (B07): shown before approval.
      report: { warnings: report.warnings, constructionRisks: report.constructionRisks, claims: claimFlagsOf(report.treatment, context.brief, String(record.inputs.direction || '')) },
      artifacts,
      ...(landing.lands ? {} : { error: { message: landing.reason } }),
    },
    ['queued', 'running'],
    { runId: record.runId },
  )
  if (!updated) throw new PlanningError('This scene plan finished elsewhere while it was being checked', 409)
  void noteProgress(record.id, { milestone: 'accepted' }, { statuses: [status] })
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

// ——— Refusals, kept (R09 of the project-flow rereview) ———
// A submission the product refused is kept on its record: the attempt it
// was, the bundle, the problems and what the player saw — both frames of a
// moment seeked twice, stored — so the run's next attempt, a retry, a
// refresh and the creator all read the same check. The last submission a
// run may make ends the record, saying so, its checks kept: never
// "without submitting a result".
export type Submission = { attempt?: unknown; budget?: unknown }
const counted = (value: unknown) => {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number > 0 ? number : 0
}
const UNVERIFIED: Record<PlanningRecord['kind'], { what: string; recovery: string[] }> = {
  preview: { what: 'The preview could not be verified', recovery: ['Inspect the failed checks', 'Preview it again, with a direction or on another harness', 'Approve the plan without a preview'] },
  production: { what: 'The production could not be verified', recovery: ['Inspect the failed checks', 'Produce it again, with a direction or on another harness'] },
  treatment: { what: 'The plan did not pass its checks', recovery: ['Plan the scene again, with a direction or on another harness'] },
  brief: { what: 'The brief did not pass its checks', recovery: ['Prepare the brief again, with a direction or on another harness'] },
}
const storeFrame = (record: PlanningRecord, base64: string) =>
  storeAsset({ body: Buffer.from(base64, 'base64'), contentType: 'image/png', projectId: record.projectId, kind: 'planning-evidence', extension: '.png' })

const refuse = async (record: PlanningRecord, input: { runId?: string; submission?: Submission; bundle: string | null; problems: string[]; evidence?: RuntimeEvidence[] }) => {
  const kept = (await loadPlanningRecord(record.id))?.validation || record.validation || null
  const budget = counted(input.submission?.budget) || kept?.budget || PLANNING_SUBMISSION_BUDGET
  const attempt = counted(input.submission?.attempt) || (kept?.attempts[kept.attempts.length - 1]?.attempt ?? 0) + 1
  const shown = (input.evidence || []).filter(item => item.frames.first && item.frames.again)
  const evidence: ValidationEvidence[] = []
  for (const item of shown) {
    evidence.push({ kind: item.kind, at: item.at, pixels: item.pixels, region: item.region, layers: item.layers, size: item.size, frames: { first: await storeFrame(record, item.frames.first), again: await storeFrame(record, item.frames.again) } })
  }
  const entry: RefusedAttempt = { attempt, at: new Date().toISOString(), bundle: input.bundle, problems: input.problems, ...(evidence.length ? { evidence } : {}) }
  const attempts = [...(kept?.attempts || []).filter(item => item.attempt !== attempt), entry].sort((a, b) => a.attempt - b.attempt).slice(-budget)
  await updatePlanningRecord(record.id, { validation: { budget, attempts } }, [...ACTIVE_STATUSES])
  await noteProgress(record.id, { milestone: 'refused', count: input.problems.length || 1 }, { runId: input.runId })
  const remaining = Math.max(0, budget - attempt)
  if (!remaining) {
    const words = UNVERIFIED[record.kind]
    await failRecord(record.id, { message: `${words.what} after ${attempt} attempt${attempt === 1 ? '' : 's'}`, category: 'verification', recovery: words.recovery })
  }
  return { attempt, remaining, evidence: shown }
}
// What a refusal tells the run: its attempt, what is left, and the player's
// evidence, both frames as PNG, to look at before it repairs.
const refusalOf = (refused: Awaited<ReturnType<typeof refuse>>) => ({
  attempt: refused.attempt,
  remaining: refused.remaining,
  ...(refused.evidence.length ? { evidence: refused.evidence } : {}),
})

export const failRecord = async (recordId: string, error: NonNullable<PlanningRecord['error']>) => {
  await noteProgress(recordId, { milestone: /^Stopped|was cancelled/.test(error.message) ? 'stopped' : 'failed', note: error.message.slice(0, 200) })
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
    // A run whose submissions were all refused says so, its checks kept
    // (R09 of the project-flow rereview).
    const refused = validationOf(record)
    const submissions = refused ? `${refused.last.attempt} submission${refused.last.attempt === 1 ? '' : 's'}, none of which passed its checks` : ''
    const message =
      outcome.status === 'cancelled'
        ? refused ? `Stopped after ${submissions}.` : 'The run was cancelled before it submitted a result.'
        : outcome.status === 'interrupted'
          ? 'Interrupted: the app closed while this run was working. Retry it; any earlier result is unchanged.'
          : `The run ended (${outcome.status}${outcome.exitCode !== undefined && outcome.exitCode !== null ? `, exit ${outcome.exitCode}` : ''}) ${refused ? `after ${submissions}.` : 'without submitting a result.'}`
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
