import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => new Map<string, unknown>())
const provider = vi.hoisted(() => ({ svg: '<svg viewBox="0 0 200 200"><g id="shell"><circle cx="100" cy="100" r="80"/></g></svg>', model: 'test', requestId: 'test-request' }))
vi.mock('./persistence', () => ({
  loadSetting: vi.fn(async (key: string) => storage.get(key)),
  saveSetting: vi.fn(async (key: string, value: unknown) => { storage.set(key, value) }),
  storeAsset: vi.fn(async () => ({ objectKey: 'library/object.svg' })),
}))
vi.mock('./providers/quiver', () => ({
  generateObjectSvg: vi.fn(async () => provider),
  repairObjectSvg: vi.fn(async () => provider),
  reviseObjectSvg: vi.fn(async () => provider),
}))
import { generateObjectSvg, reviseObjectSvg } from './providers/quiver'
import { storeAsset } from './persistence'
import { listArtwork, makeArtwork, registerLocalArtwork } from './appearance-library'
import { referenceObjects } from './appearance'
const brief = { ...referenceObjects()[0], entity: 'cache-shard', role: 'cache', represents: 'A shard that stores a reusable result', parts: [{ id: 'shell', what: 'the store' }], size: { width: 200, height: 200 } }
beforeEach(() => { storage.clear(); vi.clearAllMocks() })
describe('permanent Quiver object library', () => {
  it('reuses a semantic brief across notebooks without another provider call', async () => {
    const first = await makeArtwork({ brief, projectId: 'one' })
    const second = await makeArtwork({ brief, projectId: 'two' })
    expect(second.reused).toBe(true)
    expect(second.appearance.key).toBe(first.appearance.key)
    expect(generateObjectSvg).toHaveBeenCalledTimes(1)
    expect((await listArtwork()).map(a => a.entity)).toEqual(['cache-shard'])
    expect(storeAsset).toHaveBeenCalledWith(expect.not.objectContaining({ projectId: expect.anything() }))
  })
  it('registers an immutable local repair and reuses its behavior without a provider call', async () => {
    const original = await makeArtwork({ brief })
    const svg = provider.svg.replace('r="80"', 'r="70"')
    const input = { parentKey: original.appearance.key, svg, review: { sourceHash: createHash('sha256').update(svg).digest('hex'), frames: ['fixture-rest.png', 'fixture-settled.png'], observations: ['The repaired shell retains its circular silhouette at both inspected frames.'] }, behaviors: [{ version: 1 as const, key: 'receive', artworkKey: original.appearance.key, name: 'receive' as const, requiredParts: ['shell'], port: 'shell', duration: { minMs: 100, defaultMs: 500, maxMs: 1000 } }] }
    const first = await registerLocalArtwork(input)
    const second = await registerLocalArtwork(input)
    expect(second.reused).toBe(true)
    expect(second.appearance.key).toBe(first.appearance.key)
    expect(first.appearance.parentKey).toBe(original.appearance.key)
    expect(first.appearance.svg).toBe(svg)
    expect(createHash('sha256').update(first.appearance.svg).digest('hex')).toBe(first.appearance.contentHash)
    expect(first.appearance.behaviors?.[0].artworkKey).toBe(first.appearance.key)
    expect((await listArtwork()).find(a => a.key === original.appearance.key)?.svg).toBe(original.appearance.svg)
    expect(generateObjectSvg).toHaveBeenCalledTimes(1)
    expect(reviseObjectSvg).not.toHaveBeenCalled()
    await expect(registerLocalArtwork({ ...input, svg: svg.replace('70', '60') })).rejects.toThrow('exact reviewed SVG')
  })
  it('requires every palette and visual-style field to match for reuse', async () => {
    await makeArtwork({ brief })
    for (const style of [
      { ...brief.style, angle: 'front' as const },
      { ...brief.style, density: 'rich' as const },
      { ...brief.style, depth: 'soft' as const },
      { ...brief.style, palette: { ...brief.style.palette, text: '#112233' } },
      { ...brief.style, palette: { ...brief.style.palette, secondary: '#223344' } },
      { ...brief.style, palette: { ...brief.style.palette, warning: '#334455' } },
    ]) {
      const changed = await makeArtwork({ brief: { ...brief, style } })
      expect(changed.reused).toBe(false)
    }
    expect(generateObjectSvg).toHaveBeenCalledTimes(7)
  })
  it('keeps the original and saves an editable revision with parent provenance', async () => {
    const original = await makeArtwork({ brief })
    const edit = await makeArtwork({ key: original.appearance.key, operation: 'edit', prompt: 'Give the lid a stronger silhouette' })
    expect(edit.appearance.key).not.toBe(original.appearance.key)
    expect(edit.appearance.parentKey).toBe(original.appearance.key)
    expect(await listArtwork()).toHaveLength(2)
    expect(reviseObjectSvg).toHaveBeenCalledWith(provider.svg, expect.objectContaining({ entity: 'cache-shard' }), 'Give the lid a stronger silhouette', 'edit')
    expect((await makeArtwork({ key: original.appearance.key, operation: 'edit', prompt: 'Give the lid a stronger silhouette' })).reused).toBe(true)
    expect(reviseObjectSvg).toHaveBeenCalledTimes(1)
  })
  it('does not label a static provider reply as an animated performance', async () => {
    const original = await makeArtwork({ brief })
    await expect(makeArtwork({ key: original.appearance.key, operation: 'animate', prompt: 'Open and settle' })).rejects.toThrow('no SVG animation')
    expect(await listArtwork()).toHaveLength(1)
  })
})
