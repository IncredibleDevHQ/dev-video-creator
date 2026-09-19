import { createHash, randomUUID } from 'node:crypto'
import { acceptArtwork, briefKey, objectBriefFrom, type ObjectBrief, type ObjectStyle } from './appearance'
import { generateObjectSvg, repairObjectSvg, reviseObjectSvg } from './providers/quiver'
import { loadSetting, saveSetting, storeAsset } from './persistence'

export type LibraryArtwork = ReturnType<typeof acceptArtwork> & {
  key: string; entity: string; accepted: boolean; brief: ObjectBrief; parentKey?: string
  url: string; createdAt: string; operation: 'generate' | 'edit' | 'animate'
  provenance: { provider: 'quiver'; model: string; requestId: string }
}
const INDEX = 'artwork-library-v1'
// One writer for both the cache and the index, including requests from local agents.
let pending: Promise<unknown> = Promise.resolve()
export const listArtwork = async (): Promise<LibraryArtwork[]> => {
  const keys = await loadSetting(INDEX) as string[] | null
  return (await Promise.all((keys || []).map(key => loadSetting(`artwork:${key}`)))).filter(Boolean) as LibraryArtwork[]
}
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
