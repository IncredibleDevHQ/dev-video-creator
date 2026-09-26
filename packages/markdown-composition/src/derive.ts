// Deriving one notebook from another.
//
// A base notebook holds the narrative, the facts and the wireframes. A video
// is a separate notebook taken from it: its own scenes, its own artwork, its
// own timing. The two never share a mutable thing — the fork copies what the
// video may change and keeps a reference to where each piece came from, so a
// video can always say which base revision and which source scene it is made
// of, and editing either one cannot reach into the other.
import type { ProjectDerivationV1, ProjectDocumentV1, TiptapNode } from './types'

// A value as stable text: the same value always reads the same, whatever
// order its keys happen to be in. `skip` names keys left out at any depth.
const stableText = (value: unknown, skip: Set<string> = new Set()): string => {
  const stable = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(stable)
    if (entry && typeof entry === 'object') {
      return Object.keys(entry as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((out, key) => {
          if (skip.has(key)) return out
          out[key] = stable((entry as Record<string, unknown>)[key])
          return out
        }, {})
    }
    return entry
  }
  return JSON.stringify(stable(value)) ?? ''
}
// FNV-1a, 64 bits as two 32-bit halves: no crypto, same answer in the
// browser and on the server.
const hashOf = (text: string) => {
  let high = 0x811c9dc5
  let low = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    high = Math.imul(high ^ code, 0x01000193) >>> 0
    low = Math.imul(low ^ ((code << 5) | (code >>> 3)), 0x01000193) >>> 0
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

/** A stable content revision for a notebook: the same document always hashes
 * the same, whatever order its keys happen to be in. */
export const revisionOf = (project: ProjectDocumentV1): string => hashOf(stableText(project, new Set(['derivedFrom'])))

const SCENE_TYPES = new Set(['scene', 'slide', 'explainer'])

/** What a scene is made of, for telling whether it changed: its title, its
 * page (the drawing, its program, any explainer), its words and the source
 * passages it rests on. Staging derived from those, timestamps and a page
 * still being designed are not part of it. */
export const SCENE_INPUTS = ['title', 'page', 'script', 'source'] as const
export type SceneInput = (typeof SCENE_INPUTS)[number]
const sceneInputsOf = (node: TiptapNode): Record<SceneInput, unknown> => {
  const attrs = (node.attrs || {}) as Record<string, unknown>
  return {
    title: String(attrs.title || ''),
    page: { svg: String(attrs.svg || ''), program: attrs.program ?? null, explainer: attrs.explainer ?? null },
    script: String(attrs.script || ''),
    source: Array.isArray(attrs.sourcePassages) ? attrs.sourcePassages.map(String) : [],
  }
}
/** Each input's fingerprint, and the scene's revision from them. */
export const sceneRevisionOf = (node: TiptapNode) => {
  const inputs = sceneInputsOf(node)
  const fingerprints = Object.fromEntries(SCENE_INPUTS.map(input => [input, hashOf(stableText(inputs[input]))])) as Record<SceneInput, string>
  return { inputs: fingerprints, revision: hashOf(stableText(fingerprints)) }
}

/** The scenes a fork carries, with the id each one had in the base. */
export const sceneOriginsOf = (project: ProjectDocumentV1) =>
  (project.notebook?.content || [])
    .filter(node => SCENE_TYPES.has(node.type))
    .map(node => ({ id: String(node.attrs?.id || ''), title: String(node.attrs?.title || ''), ...sceneRevisionOf(node) }))
    .filter(entry => entry.id)

export type ForkOptions = {
  id: string
  title?: string
  kind?: string
  forkKey?: string
  at?: string
  snapshot?: { assetId: string; objectKey: string }
  /** Ids for the child's blocks, in scene order. The caller supplies them so
   * a retried fork can be made to produce the same document. */
  blockIds?: string[]
}

/**
 * A video notebook taken from a base. Every scene keeps a reference to the
 * scene it came from — one base scene may later become several video scenes,
 * and the reference survives that — while the video's own ids are its own.
 */
export const forkNotebook = (
  base: ProjectDocumentV1,
  options: ForkOptions,
): { project: ProjectDocumentV1; origins: Array<{ from: string; to: string }> } => {
  const at = options.at || new Date().toISOString()
  const child = structuredClone(base)
  child.id = options.id
  child.title = options.title || `${base.title} · video`
  const origins: Array<{ from: string; to: string }> = []
  let counter = 0
  const content = (child.notebook?.content || []).map((node): TiptapNode => {
    if (!SCENE_TYPES.has(node.type)) return node
    const from = String(node.attrs?.id || '')
    if (!from) return node
    counter += 1
    const to = options.blockIds?.[counter - 1] || `${options.id}-s${String(counter).padStart(2, '0')}`
    origins.push({ from, to })
    // A page the base is still designing keeps landing on the base only: the
    // video is the base as it was, and hears of later pages as base changes.
    const pageOrigin = node.attrs?.pageOrigin as Record<string, unknown> | null | undefined
    const settled = pageOrigin && typeof pageOrigin === 'object' && 'designing' in pageOrigin
      ? { pageOrigin: Object.fromEntries(Object.entries(pageOrigin).filter(([key]) => key !== 'designing')) }
      : {}
    return {
      ...node,
      attrs: {
        ...node.attrs,
        ...settled,
        id: to,
        // Where this scene came from. `scenes` is the array form: a merge
        // later lists several base scenes, a split shares one across two
        // video scenes, and the reference survives both.
        origin: { notebook: base.id, scene: from, scenes: [from] },
      },
    }
  })
  child.notebook = { ...(child.notebook || { type: 'doc', content: [] }), content }
  const moved = new Map(origins.map(entry => [entry.from, entry.to]))
  const remap = <T>(record: Record<string, T> | undefined) =>
    Object.fromEntries(
      Object.entries(record || {})
        .filter(([key]) => moved.has(key))
        .map(([key, value]) => {
          const id = moved.get(key)!
          const carried = structuredClone(value) as T & { blockId?: string }
          if (carried && typeof carried === 'object' && 'blockId' in carried) carried.blockId = id
          return [id, carried]
        }),
    ) as Record<string, T>
  child.blocks = remap(child.blocks)
  child.presenterTracks = remap(child.presenterTracks)
  // Takes belong to the notebook that recorded them, and produced scenes to
  // the notebook that accepted them: a fresh video has none.
  delete child.recordedBlocks
  delete child.recordedBlockTakes
  delete child.producedScenes
  const derivation: ProjectDerivationV1 = {
    notebook: base.id,
    kind: options.kind || 'video',
    baseRevision: revisionOf(base),
    baseTitle: base.title,
    forkedAt: at,
    ...(options.forkKey ? { forkKey: options.forkKey } : {}),
    ...(options.snapshot ? { snapshot: options.snapshot } : {}),
    receipt: { scenes: origins.length, assets: 0, at },
  }
  child.derivedFrom = derivation
  return { project: child, origins }
}

export type BaseSceneStatus = {
  scene: string
  title: string
  state: 'same' | 'changed' | 'removed'
  // What changed in it, and its revision then and now.
  changed: SceneInput[]
  was: string | null
  now: string | null
}

/** Whether a video's base has moved since the fork, and which of the scenes
 * it was made from have changed — by what they are made of, not only their
 * titles. Nothing is merged: this only reports. */
export const baseStatusOf = (
  child: ProjectDocumentV1,
  base: ProjectDocumentV1 | null,
  snapshot: ProjectDocumentV1 | null,
) => {
  const pinned = child.derivedFrom?.baseRevision || ''
  if (!base) return { stale: false, moved: false, missing: true, pinned, revision: '', scenes: [] as BaseSceneStatus[] }
  const revision = revisionOf(base)
  const was = new Map(sceneOriginsOf(snapshot || base).map(entry => [entry.id, entry]))
  const now = new Map(sceneOriginsOf(base).map(entry => [entry.id, entry]))
  const usedByChild = new Set(
    (child.notebook?.content || [])
      .flatMap(node => {
        const origin = node.attrs?.origin as { scene?: string; scenes?: string[] } | undefined
        return origin?.scenes?.length ? origin.scenes : origin?.scene ? [origin.scene] : []
      })
      .filter(Boolean),
  )
  const scenes = [...usedByChild].map((scene): BaseSceneStatus => {
    const before = was.get(scene)
    const after = now.get(scene)
    if (!after) return { scene, title: before?.title || scene, state: 'removed', changed: [], was: before?.revision || null, now: null }
    const changed = before ? SCENE_INPUTS.filter(input => before.inputs[input] !== after.inputs[input]) : [...SCENE_INPUTS]
    return { scene, title: after.title, state: changed.length ? 'changed' : 'same', changed, was: before?.revision || null, now: after.revision }
  })
  // Without the snapshot the fork pinned, which scenes changed cannot be
  // told: only that the base moved.
  const moved = Boolean(pinned) && pinned !== revision
  return {
    stale: snapshot ? scenes.some(entry => entry.state !== 'same') : moved,
    moved,
    missing: false,
    pinned,
    revision,
    scenes,
  }
}
