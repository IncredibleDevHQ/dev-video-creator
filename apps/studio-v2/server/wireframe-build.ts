// A project's wireframe, made in the background (the four-notebook model).
// The import opens on the project's text as soon as the brand is chosen,
// and saves the wireframe at once, holding only what it waits for: the
// story run outlining the article, or the direct model. This sees it
// through when the outline is there — the outline checked, the explanation
// model kept, a schematic page drawn for each scene, the pages saved into
// the wireframe — or says why it could not be made. It is resumable: a pass
// finds a wireframe still waiting however the app was closed, and a direct
// model outline lost to a restart is asked for again.
//
// Each start, and each time it is made again, is an attempt of its own
// (R07 of the project-flow rereview). The direct model's outline is kept
// under its attempt until the pages made from it are saved: a save that
// loses to the creator's edit is made again on the edit with the same
// outline — the provider is asked once — and an attempt made again never
// takes an older attempt's outline.
import { randomUUID } from 'node:crypto'
import type { NotebookBuildV1, ProjectDocumentV1, TiptapNode } from 'markdown-composition'
import { pageBrandFrom, renderPage, sanitizeOutline, type Outline, type OutlineScene, type SourceRead } from './source'
import { buildExplanationModel } from './story-model'
import type { StoredArticle } from '../src/wireframe-attempt'

export type WireframeRun = { status: string; projectDir: string; failure?: Record<string, unknown> | null }
export type WireframeSource = StoredArticle

export type WireframeDeps = {
  load: (id: string) => Promise<ProjectDocumentV1 | null>
  save: (notebook: ProjectDocumentV1, expected: ProjectDocumentV1) => Promise<void>
  run: (runId: string) => Promise<WireframeRun | null>
  // The outline a story run wrote, as it wrote it.
  readOutline: (projectDir: string) => Promise<unknown>
  // The article's stored read, for an outline the direct model makes.
  source: (revisionId: string) => Promise<WireframeSource | null>
  outlineViaApi: (source: WireframeSource, targetSeconds: number | null, wording: NotebookBuildV1['wording']) => Promise<Outline>
  saveModel: (input: { projectId: string; sourceRevision?: string; narrativeRevision?: string; model: unknown }) => Promise<{ id: string }>
  newId?: () => string
  now?: () => string
}

export type WireframeResult = { notebook: string; state: 'none' | 'waiting' | 'built' | 'failed' | 'conflict'; pages?: number; reason?: string }

const ENDED = new Set(['done', 'error', 'cancelled', 'interrupted'])
const nowOf = (deps: WireframeDeps) => deps.now?.() || new Date().toISOString()

// Outlines the direct model is making, and has made, by attempt: asked for
// once, kept until the pages made from them are saved, and asked for again
// only when a restart lost them.
const asked = new Map<string, Promise<Outline>>()
const settledOutlines = new Map<string, { outline?: Outline; error?: string }>()
const attemptKey = (notebookId: string, build: NotebookBuildV1) => `${notebookId}#${build.attempt || build.startedAt}`
// An attempt's outline is let go once what was made from it is saved — and
// an older attempt's, once the notebook has moved on to another.
const forgetOutlines = (notebookId: string, keep?: string) => {
  for (const key of [...settledOutlines.keys()]) if (key.startsWith(`${notebookId}#`) && key !== keep) settledOutlines.delete(key)
}

type Outlined = { outline?: unknown; waiting?: boolean; failure?: string; recovery?: string[] }

const outlineOf = async (build: NotebookBuildV1, notebookId: string, deps: WireframeDeps): Promise<Outlined> => {
  if (build.via === 'harness') {
    if (!build.runId) return { failure: 'No story run was started for it' }
    const run = await deps.run(build.runId)
    if (!run) return { failure: 'The story run is no longer known' }
    if (!ENDED.has(run.status)) return { waiting: true }
    if (run.status === 'cancelled') return { failure: 'It was stopped' }
    if (run.status === 'interrupted') return { failure: 'The app closed while the article was being outlined' }
    if (run.status !== 'done') {
      const said = run.failure && typeof run.failure.message === 'string' ? `: ${run.failure.message}` : ''
      const recovery = Array.isArray(run.failure?.recovery) ? (run.failure.recovery as unknown[]).filter((step): step is string => typeof step === 'string' && Boolean(step.trim())) : []
      return { failure: `The story run failed${said}`, ...(recovery.length ? { recovery } : {}) }
    }
    const outline = await deps.readOutline(run.projectDir).catch(() => null)
    return outline ? { outline } : { failure: 'The story run wrote no outline' }
  }
  const key = attemptKey(notebookId, build)
  forgetOutlines(notebookId, key)
  const settled = settledOutlines.get(key)
  if (settled) return settled.error ? { failure: settled.error } : { outline: settled.outline }
  if (!asked.has(key)) {
    const source = build.sourceRevision ? await deps.source(build.sourceRevision) : null
    if (!source?.text?.trim()) return { failure: 'The article it is made from could not be found' }
    const pending = deps.outlineViaApi(source, build.targetSeconds ?? null, build.wording)
    asked.set(key, pending)
    pending
      .then(outline => settledOutlines.set(key, { outline }))
      .catch(error => settledOutlines.set(key, { error: error instanceof Error ? error.message : String(error) }))
      .finally(() => asked.delete(key))
  }
  return { waiting: true }
}

// A schematic page for each scene of the outline, drawn in the project's
// brand: the wireframe's pages.
export const wireframePagesOf = (outline: Outline, brand: NotebookBuildV1['brand'], newId: () => string): TiptapNode[] => {
  const drawn = pageBrandFrom(brand.palette as unknown as SourceRead['palette'], (brand.fonts || { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas', seen: [] }) as unknown as SourceRead['fonts'], (brand.mode as 'dark' | 'light' | 'auto') || 'auto')
  const scenes = outline.scenes as OutlineScene[]
  return scenes.map((scene, index) => {
    const svg = renderPage(scene, index, scenes.length, drawn, { title: outline.title, site: brand.site })
    return {
      type: 'scene',
      attrs: {
        id: newId(),
        title: scene.title,
        svg,
        svgSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        program: null,
        directorNotes: scene.idea,
        script: scene.narration,
        sourcePassages: scene.source || [],
        structureApproved: true,
        pageOrigin: { kind: 'schematic' },
      },
    }
  })
}

export const buildWireframe = async (notebookId: string, deps: WireframeDeps): Promise<WireframeResult> => {
  const stored = await deps.load(notebookId)
  const build = stored?.build
  if (!stored || !build || build.kind !== 'wireframe' || build.failure) return { notebook: notebookId, state: 'none' }
  const got = await outlineOf(build, notebookId, deps)
  if (got.waiting) return { notebook: notebookId, state: 'waiting' }
  const fail = async (reason: string, recovery?: string[]): Promise<WireframeResult> => {
    const next = structuredClone(stored)
    next.build = { ...build, failure: { message: reason, at: nowOf(deps), ...(recovery?.length ? { recovery } : {}) } }
    try {
      await deps.save(next, stored)
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 409) return { notebook: notebookId, state: 'conflict' }
      throw error
    }
    forgetOutlines(notebookId)
    return { notebook: notebookId, state: 'failed', reason }
  }
  if (got.failure) return fail(got.failure, got.recovery)
  // Its passages verbatim, or not at all: checked against the article.
  const read = build.sourceRevision ? await deps.source(build.sourceRevision).catch(() => null) : null
  const outline = sanitizeOutline(got.outline, stored.title || 'Untitled', read?.text || '')
  if (!outline.scenes.length) return fail('The outline has no scenes')
  const newId = deps.newId || randomUUID
  const pages = wireframePagesOf(outline, build.brand, newId)
  // The outline becomes the explanation model, kept as its own record (D2).
  const model = buildExplanationModel(outline)
  const saved = await deps.saveModel({ projectId: notebookId, sourceRevision: build.sourceRevision, narrativeRevision: build.narrativeRevision, model }).catch(() => null)
  const next = structuredClone(stored)
  delete next.build
  // Anything written into the wireframe while it waited stays, above its pages.
  next.notebook = { ...next.notebook, content: [...(next.notebook?.content || []).filter(node => node.type !== 'paragraph' || (node.content || []).length), ...pages] }
  next.outline = {
    title: outline.title,
    targetSeconds: outline.targetSeconds,
    scenes: outline.scenes.map((scene, index) => ({ nodeId: String(pages[index].attrs?.id || ''), title: scene.title, kind: scene.kind, seconds: scene.seconds, idea: scene.idea, ...(scene.source?.length ? { source: scene.source } : {}), narration: scene.narration, parts: scene.parts, relations: scene.relations })),
    glossary: outline.glossary,
    ...(model.objects.length ? { objects: model.objects } : {}),
    pageBrand: { palette: build.brand.palette, fonts: build.brand.fonts, mode: build.brand.mode },
  }
  next.story = { ...(next.story || {}), wordingPolicy: build.wording, ...(build.narrativeRevision ? { narrativeId: build.narrativeRevision } : {}), ...(saved ? { modelId: saved.id } : {}) }
  try {
    await deps.save(next, stored)
  } catch (error) {
    // Edited while it was built: the next pass builds on the edit, from the
    // same outline.
    if ((error as { statusCode?: number }).statusCode === 409) return { notebook: notebookId, state: 'conflict' }
    throw error
  }
  forgetOutlines(notebookId)
  return { notebook: notebookId, state: 'built', pages: pages.length }
}

// One pass at a time per notebook.
const passes = new Map<string, Promise<WireframeResult>>()
export const buildWireframeOnce = (notebookId: string, deps: WireframeDeps) => {
  const running = passes.get(notebookId)
  if (running) return running
  const pass = buildWireframe(notebookId, deps).finally(() => passes.delete(notebookId))
  passes.set(notebookId, pass)
  return pass
}
