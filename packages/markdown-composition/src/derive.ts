// Deriving one notebook from another.
//
// A base notebook holds the narrative, the facts and the wireframes. A video
// is a separate notebook taken from it: its own scenes, its own artwork, its
// own timing. The two never share a mutable thing — the fork copies what the
// video may change and keeps a reference to where each piece came from, so a
// video can always say which base revision and which source scene it is made
// of, and editing either one cannot reach into the other.
import type { ProjectDerivationV1, ProjectDocumentV1, TiptapNode } from './types'

/** A stable content revision for a notebook: the same document always hashes
 * the same, whatever order its keys happen to be in. */
export const revisionOf = (project: ProjectDocumentV1): string => {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((out, key) => {
          if (key === 'derivedFrom') return out
          out[key] = stable((value as Record<string, unknown>)[key])
          return out
        }, {})
    }
    return value
  }
  const text = JSON.stringify(stable(project))
  // FNV-1a, 64 bits as two 32-bit halves: no crypto, same answer in the
  // browser and on the server.
  let high = 0x811c9dc5
  let low = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    high = Math.imul(high ^ code, 0x01000193) >>> 0
    low = Math.imul(low ^ ((code << 5) | (code >>> 3)), 0x01000193) >>> 0
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

const SCENE_TYPES = new Set(['scene', 'slide', 'explainer'])

/** The scenes a fork carries, with the id each one had in the base. */
export const sceneOriginsOf = (project: ProjectDocumentV1) =>
  (project.notebook?.content || [])
    .filter(node => SCENE_TYPES.has(node.type))
    .map(node => ({ id: String(node.attrs?.id || ''), title: String(node.attrs?.title || '') }))
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
    return {
      ...node,
      attrs: {
        ...node.attrs,
        id: to,
        // Where this scene came from. A split later gives both halves the
        // same origin, which is how one source scene becomes two video ones.
        origin: { notebook: base.id, scene: from },
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
  // Takes belong to the notebook that recorded them: a fresh video has none.
  delete child.recordedBlocks
  delete child.recordedBlockTakes
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

/** Whether a video's base has moved since the fork, and which of the scenes
 * it was made from have changed. Nothing is merged: this only reports. */
export const baseStatusOf = (
  child: ProjectDocumentV1,
  base: ProjectDocumentV1 | null,
  snapshot: ProjectDocumentV1 | null,
) => {
  const pinned = child.derivedFrom?.baseRevision || ''
  if (!base) return { stale: false, missing: true, pinned, revision: '', scenes: [] as Array<{ scene: string; title: string; state: string }> }
  const revision = revisionOf(base)
  const was = new Map(sceneOriginsOf(snapshot || base).map(entry => [entry.id, entry]))
  const now = new Map(sceneOriginsOf(base).map(entry => [entry.id, entry]))
  const usedByChild = new Set(
    (child.notebook?.content || [])
      .map(node => String((node.attrs?.origin as { scene?: string } | undefined)?.scene || ''))
      .filter(Boolean),
  )
  const scenes = [...usedByChild].map(scene => {
    const before = was.get(scene)
    const after = now.get(scene)
    if (!after) return { scene, title: before?.title || scene, state: 'removed' }
    if (before && JSON.stringify(before) !== JSON.stringify(after)) return { scene, title: after.title, state: 'changed' }
    return { scene, title: after.title, state: 'same' }
  })
  return {
    stale: Boolean(pinned) && pinned !== revision,
    missing: false,
    pinned,
    revision,
    scenes,
  }
}
