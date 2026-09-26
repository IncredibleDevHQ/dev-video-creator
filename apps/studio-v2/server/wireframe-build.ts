// A project's wireframe, made in the background (the four-notebook model).
// The import opens on the project's text as soon as the brand is chosen,
// and saves the wireframe at once, holding only what it waits for: the
// story run outlining the article, or the direct model. This sees it
// through when the outline is there — the outline checked, the explanation
// model kept, a schematic page drawn for each scene, the pages saved into
// the wireframe — or says why it could not be made. It is resumable: a pass
// finds a wireframe still waiting however the app was closed, and a direct
// model outline lost to a restart is asked for again.
import { randomUUID } from 'node:crypto'
import type { NotebookBuildV1, ProjectDocumentV1, TiptapNode } from 'markdown-composition'
import { pageBrandFrom, renderPage, sanitizeOutline, type Outline, type OutlineScene, type SourceRead } from './source'
import { buildExplanationModel } from './story-model'

export type WireframeRun = { status: string; projectDir: string; failure?: Record<string, unknown> | null }
export type WireframeSource = { title: string; site: string; text: string; words: number }

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

// Outlines the direct model is making, by notebook: one at a time, and
// asked for again when a restart lost it.
const asked = new Map<string, Promise<Outline>>()
const settledOutlines = new Map<string, { outline?: Outline; error?: string }>()

const outlineOf = async (build: NotebookBuildV1, notebookId: string, deps: WireframeDeps): Promise<{ outline?: unknown; waiting?: boolean; failure?: string }> => {
  if (build.via === 'harness') {
    if (!build.runId) return { failure: 'No story run was started for it' }
    const run = await deps.run(build.runId)
    if (!run) return { failure: 'The story run is no longer known' }
    if (!ENDED.has(run.status)) return { waiting: true }
    if (run.status === 'cancelled') return { failure: 'It was stopped' }
    if (run.status === 'interrupted') return { failure: 'The app closed while the article was being outlined' }
    if (run.status !== 'done') {
      const said = run.failure && typeof run.failure.message === 'string' ? `: ${run.failure.message}` : ''
      return { failure: `The story run failed${said}` }
    }
    const outline = await deps.readOutline(run.projectDir).catch(() => null)
    return outline ? { outline } : { failure: 'The story run wrote no outline' }
  }
  const settled = settledOutlines.get(notebookId)
  if (settled) {
    settledOutlines.delete(notebookId)
    return settled.error ? { failure: settled.error } : { outline: settled.outline }
  }
  if (!asked.has(notebookId)) {
    const source = build.sourceRevision ? await deps.source(build.sourceRevision) : null
    if (!source?.text?.trim()) return { failure: 'The article it is made from could not be found' }
    const pending = deps.outlineViaApi(source, build.targetSeconds ?? null, build.wording)
    asked.set(notebookId, pending)
    pending
      .then(outline => settledOutlines.set(notebookId, { outline }))
      .catch(error => settledOutlines.set(notebookId, { error: error instanceof Error ? error.message : String(error) }))
      .finally(() => asked.delete(notebookId))
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
  const fail = async (reason: string): Promise<WireframeResult> => {
    const next = structuredClone(stored)
    next.build = { ...build, failure: { message: reason, at: nowOf(deps) } }
    try {
      await deps.save(next, stored)
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 409) return { notebook: notebookId, state: 'conflict' }
      throw error
    }
    return { notebook: notebookId, state: 'failed', reason }
  }
  if (got.failure) return fail(got.failure)
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
    // Edited while it was built: the next pass builds on the edit.
    if ((error as { statusCode?: number }).statusCode === 409) return { notebook: notebookId, state: 'conflict' }
    throw error
  }
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
