import { validateBehavior, type ObjectBehavior } from '../src/object-behavior'
import { isDeepStrictEqual } from 'node:util'
import { createHash, randomUUID } from 'node:crypto'
import { acceptArtwork, briefKey, objectBriefFrom, type ObjectBrief, type ObjectStyle } from './appearance'
import { generateObjectSvg, repairObjectSvg, reviseObjectSvg } from './providers/quiver'
import { loadSetting, saveSetting, storeAsset } from './persistence'

export type LibraryArtwork = ReturnType<typeof acceptArtwork> & {
  key: string; entity: string; accepted: boolean; brief: ObjectBrief; parentKey?: string
  url: string; createdAt: string; operation: 'generate' | 'edit' | 'animate' | 'local-repair' | 'extract'
  behaviors?: ObjectBehavior[]
  contentHash?: string
  reviewReceipt?: { sourceHash: string; frames: string[]; observations: string[] }
  provenance: { provider: 'quiver' | 'local-harness' | 'base-extraction'; model: string; requestId: string }
  // Where an extracted ingredient came from: the base, its page and node.
  origin?: { notebook: string; revision: string; page: string; node: string; castEntry: string }
}
const INDEX = 'artwork-library-v1'
// One writer for both the cache and the index, including requests from local agents.
let pending: Promise<unknown> = Promise.resolve()
export const listArtwork = async (): Promise<LibraryArtwork[]> => {
  const keys = await loadSetting(INDEX) as string[] | null
  return (await Promise.all((keys || []).map(key => loadSetting(`artwork:${key}`)))).filter(Boolean) as LibraryArtwork[]
}

// Cast verification (D4): every data-appearance-key subtree must resolve to
// an accepted library asset and actually contain its geometry — the import
// inlines the artwork verbatim (ids are prefixed per placement, path data is
// untouched), so a forged marker or a hand-retyped approximation is not the
// accepted artwork and cannot pass rich completion.
export type CastVerdict = { key: string; status: 'verified' | 'unknown' | 'mismatch'; tokensFound: number; tokensTotal: number }

export const verifyCast = async (sceneSvg: string): Promise<{ ok: boolean; cast: CastVerdict[] }> => {
  const library = await listArtwork()
  const byKey = new Map(library.map(asset => [asset.key, asset]))
  const geometryOf = (svg: string) => [...svg.matchAll(/\b(?:d|points)="([^"]+)"/g)].map(match => match[1])
  const cast: CastVerdict[] = []
  for (const match of sceneSvg.matchAll(/data-appearance-key="([^"]+)"/g)) {
    const key = match[1]
    // The element carrying the marker, from its opening tag to its balanced close.
    const open = sceneSvg.lastIndexOf('<', match.index)
    const tag = /^([a-zA-Z][\w:-]*)/.exec(sceneSvg.slice(open + 1))?.[1] || 'g'
    const tokenRe = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g')
    tokenRe.lastIndex = open
    let depth = 0
    let end = sceneSvg.length
    for (let token; (token = tokenRe.exec(sceneSvg));) {
      if (token[0].startsWith('</')) {
        depth -= 1
        if (depth === 0) { end = tokenRe.lastIndex; break }
      } else if (!token[0].endsWith('/>')) {
        depth += 1
      }
    }
    const subtree = sceneSvg.slice(open, end)
    const asset = byKey.get(key)
    if (!asset) {
      cast.push({ key, status: 'unknown', tokensFound: 0, tokensTotal: 0 })
      continue
    }
    const assetTokens = geometryOf(asset.svg)
    const subtreeTokens = new Set(geometryOf(subtree))
    const found = assetTokens.filter(token => subtreeTokens.has(token)).length
    const total = assetTokens.length
    const needed = total <= 3 ? total : Math.ceil(total * 0.8)
    cast.push({
      key,
      status: total > 0 && found >= needed ? 'verified' : 'mismatch',
      tokensFound: found,
      tokensTotal: total,
    })
  }
  return { ok: cast.every(entry => entry.status === 'verified'), cast }
}
// Reuse is earned by compatibility, not a matching name (D4): same entity
// and role, same visual family and palette, and every part the new scene
// needs present in the accepted drawing. A hit skips the provider call.
export const briefCompatible = (brief: ObjectBrief, candidate: LibraryArtwork): boolean => {
  const other = candidate.brief
  return Boolean(candidate.accepted)
    && candidate.entity === brief.entity
    && other.role === brief.role
    && isDeepStrictEqual(other.style, brief.style)
    && brief.parts.every(part => other.parts.some(existing => existing.id === part.id))
}

export const findCompatibleArtwork = async (brief: ObjectBrief): Promise<LibraryArtwork | null> =>
  (await listArtwork()).find(candidate => briefCompatible(brief, candidate)) || null

export const makeArtwork = (request: { brief?: unknown; key?: string; prompt?: string; operation?: 'generate' | 'edit' | 'animate'; projectId?: string; force?: boolean; palette?: Partial<ObjectStyle['palette']> }) => {
  const job = pending.catch(() => {}).then(async () => {
    const parent = request.key ? await loadSetting(`artwork:${request.key}`) as LibraryArtwork | null : null
    const operation = request.operation || 'generate'
    if (operation !== 'generate' && !parent) throw new Error('Choose an existing library object to edit or animate')
    if (operation !== 'generate' && !request.prompt?.trim()) throw new Error('Describe the change or named performance')
    const brief = objectBriefFrom(request.brief || parent?.brief)
    // The resolved project theme reaches the artwork brief (D1). Palette is
    // inside the brief key, so themed artwork caches and reuses separately.
    if (request.palette) {
      const hex = (value: unknown) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : undefined)
      brief.style = {
        ...brief.style,
        palette: {
          ...brief.style.palette,
          ...(hex(request.palette.ground) ? { ground: hex(request.palette.ground)! } : {}),
          ...(hex(request.palette.text) ? { text: hex(request.palette.text)! } : {}),
          ...(hex(request.palette.accent) ? { accent: hex(request.palette.accent)! } : {}),
          ...(hex(request.palette.secondary) ? { secondary: hex(request.palette.secondary)! } : {}),
          ...(hex(request.palette.warning) ? { warning: hex(request.palette.warning)! } : {}),
        },
      }
    }
    const key = createHash('sha256').update(JSON.stringify([briefKey(brief), operation, parent?.key, request.prompt || '', request.force ? randomUUID() : ''])).digest('hex').slice(0, 24)
    const cached = await loadSetting(`artwork:${key}`) as LibraryArtwork | null
    if (cached) return { appearance: cached, reused: true }
    // Then a compatible accepted sibling — same entity, role, family and
    // palette, with the parts this scene needs. No provider call.
    if (operation === 'generate' && !request.force) {
      const compatible = await findCompatibleArtwork(brief)
      if (compatible) return { appearance: compatible, reused: true }
    }
    const budgetKey = `appearance-budget:${request.projectId || 'library'}`
    const spent = Number(await loadSetting(budgetKey) || 0)
    const budget = Number(process.env.STUDIO_APPEARANCE_BUDGET || 24)
    const draw = async <T>(fn: () => Promise<T>): Promise<T> => {
      const current = Number(await loadSetting(budgetKey) || 0)
      if (current >= budget) throw new Error(`Artwork budget reached (${budget} provider calls); reuse a library object`)
      await saveSetting(budgetKey, current + 1)
      return fn()
    }
    if (spent >= budget) throw new Error(`Artwork budget reached (${budget} provider calls)`)
    // Revision inputs use the provider's original ids, not our composed scene ids.
    const rawParent = parent ? String(await loadSetting(`artwork-source:${parent.key}`) || '') : ''
    let generated = await draw(() => operation === 'generate' ? generateObjectSvg(brief) : reviseObjectSvg(rawParent, brief, request.prompt!, operation))
    let accepted = acceptArtwork(generated.svg, brief)
    if (!accepted.ok && accepted.missing.length && !accepted.problems.some(p => p.startsWith('it '))) {
      generated = await draw(() => repairObjectSvg(generated.svg, brief))
      accepted = acceptArtwork(generated.svg, brief)
    }
    if (!accepted.ok) throw new Error(`Artwork needs repair: ${accepted.problems.join('; ')}`)
    if (operation === 'animate' && !/<animate(?:Transform|Motion)?\b/.test(accepted.svg)) throw new Error('The provider returned no SVG animation; artwork was not accepted as a performance')
    // Independent of a notebook: deleting a video must not delete reusable art.
    const asset = await storeAsset({ body: Buffer.from(accepted.svg), contentType: 'image/svg+xml', kind: 'library-artwork', extension: '.svg' })
    const record: LibraryArtwork = { ...accepted, key, entity: brief.entity, brief, accepted: true, operation,
      ...(parent ? { parentKey: parent.key } : {}), createdAt: new Date().toISOString(), url: `/objects/${asset.objectKey}`,
      provenance: { provider: 'quiver', model: generated.model, requestId: generated.requestId } }
    await saveSetting(`artwork-source:${key}`, generated.svg)
    await saveSetting(`artwork:${key}`, record)
    const keys = (await loadSetting(INDEX) as string[] | null) || []
    await saveSetting(INDEX, [...new Set([key, ...keys])])
    return { appearance: record, reused: false }
  })
  pending = job
  return job
}

/**
 * A verified ingredient of a base presentation joins the library as its own
 * immutable version (P1): the same bytes always give the same key, and a
 * video's edit or recolour becomes a variant with a parent, never a change
 * to this one.
 */
export const registerExtractedArtwork = (input: {
  entry: {
    id: string
    kind: string
    identity: { entity: string; entityKind: string | null; object: string | null; objectId: string | null; base: { notebook: string; revision: string; page: string; node: string }; contentHash: string }
    meaning: { label: string; detail: string[] }
    artwork: { svg: { url: string }; viewBox: { width: number; height: number } }
    parts: Array<{ id: string; name: string; element: string; animations: string[] }>
  }
  svg: string
  castId: string
}) => {
  const job = pending.catch(() => {}).then(async () => {
    const { entry } = input
    const key = `cast-${entry.identity.contentHash.slice(0, 20)}`
    const existing = await loadSetting(`artwork:${key}`) as LibraryArtwork | null
    if (existing) return existing
    const brief: ObjectBrief = {
      entity: entry.identity.entity,
      ...(entry.identity.objectId ? { objectId: entry.identity.objectId } : {}),
      role: entry.identity.object || entry.identity.entityKind || entry.kind,
      represents: [entry.meaning.label, ...entry.meaning.detail].filter(Boolean).join(' — ') || entry.identity.entity,
      states: [],
      parts: entry.parts.map(part => ({ id: part.name, what: `${part.element}${part.animations.length ? `, animated on the page (${part.animations.join(', ')})` : ''}` })),
      ports: {},
      labelAnchor: 'none',
      size: entry.artwork.viewBox,
      style: { family: `base:${entry.identity.base.notebook}`, palette: { ground: '', text: '', accent: '', secondary: '' }, angle: 'front', density: 'considered', depth: 'flat' },
      keepsTextOut: [],
    }
    const record: LibraryArtwork = {
      ok: true,
      svg: input.svg,
      viewBox: entry.artwork.viewBox,
      parts: entry.parts.map(part => ({ id: part.id, element: part.element, as: part.name })),
      missing: [],
      ports: {},
      problems: [],
      key,
      entity: entry.identity.entity,
      accepted: true,
      brief,
      url: entry.artwork.svg.url,
      createdAt: new Date().toISOString(),
      operation: 'extract',
      contentHash: entry.identity.contentHash,
      provenance: { provider: 'base-extraction', model: 'visual-cast', requestId: input.castId },
      origin: { notebook: entry.identity.base.notebook, revision: entry.identity.base.revision, page: entry.identity.base.page, node: entry.identity.base.node, castEntry: entry.id },
    }
    await saveSetting(`artwork:${key}`, record)
    const keys = (await loadSetting(INDEX) as string[] | null) || []
    await saveSetting(INDEX, [...new Set([key, ...keys])])
    return record
  })
  pending = job
  return job
}

/** Accepted local repairs are immutable library versions, just like provider output. */
export const registerLocalArtwork = (input: { parentKey: string; svg: string; behaviors?: ObjectBehavior[]; review: { sourceHash: string; frames: string[]; observations: string[] } }) => {
  const job = pending.catch(() => {}).then(async () => {
    const parent = await loadSetting(`artwork:${input.parentKey}`) as LibraryArtwork | null
    if (!parent?.accepted) throw new Error('A local repair must name an accepted parent')
    const hash = createHash('sha256').update(input.svg).digest('hex')
    if (input.review?.sourceHash !== hash || !input.review.frames?.length || !input.review.observations?.length || input.review.observations.some(note => note.trim().length < 20)) throw new Error('Register the exact reviewed SVG with frame evidence and concrete observations')
    const accepted = acceptArtwork(input.svg, parent.brief)
    if (!accepted.ok) throw new Error(accepted.problems.join('; '))
    // Validation must not rewrite the bytes that the local review approved.
    const prefix = `ap-${briefKey(parent.brief).slice(0, 8)}-`
    accepted.svg = input.svg
    accepted.parts = accepted.parts.map(part => ({ ...part, id: part.id.slice(prefix.length) }))
    const box = /viewBox\s*=\s*["']([^"']+)["']/i.exec(input.svg)?.[1].split(/[\s,]+/).map(Number)
    if (box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) accepted.viewBox = { width: box[2], height: box[3] }
    const parts = Object.fromEntries(accepted.parts.map(part => [part.as || part.id, part.id]))
    for (const definition of input.behaviors || []) validateBehavior(definition, parts)
    const key = createHash('sha256').update(input.parentKey).update(hash).update(JSON.stringify(input.behaviors || [])).digest('hex').slice(0, 24)
    const existing = await loadSetting(`artwork:${key}`) as LibraryArtwork | null
    if (existing) return { appearance: existing, reused: true }
    const asset = await storeAsset({ body: Buffer.from(accepted.svg), contentType: 'image/svg+xml', kind: 'library-artwork', extension: '.svg' })
    const record: LibraryArtwork = { ...accepted, key, parentKey: parent.key, entity: parent.entity, brief: parent.brief, accepted: true,
      operation: 'local-repair', contentHash: hash, behaviors: (input.behaviors || []).map(def => ({ ...def, artworkKey: key, key: `${key}:${def.name}` })),
      reviewReceipt: input.review, url: `/objects/${asset.objectKey}`, createdAt: new Date().toISOString(), provenance: { provider: 'local-harness', model: 'local-repair', requestId: hash } }
    await saveSetting(`artwork:${key}`, record)
    const keys = await loadSetting(INDEX) as string[] | null
    await saveSetting(INDEX, [...new Set([key, ...(keys || [])])])
    return { appearance: record, reused: false }
  })
  pending = job
  return job
}
