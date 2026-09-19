import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { briefFromRole } from './appearance'

// D4 palette/behavior revisions: editing an accepted library object records a
// new content-addressed revision with its parentage — the parent survives
// untouched, the child's palette carries the override, and repeating the same
// edit reuses the cached revision instead of calling the provider again.
// The provider is mocked: revision mechanics are the product's, not Quiver's.

const EDITED_SVG = '<svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg"><rect id="body" x="10" y="10" width="200" height="120" rx="16" fill="#4f46e5"/><g id="contents"><circle cx="60" cy="60" r="18" fill="#ffffff"/></g></svg>'
const reviseObjectSvg = vi.fn(async () => ({ svg: EDITED_SVG, model: 'mock', requestId: 'mock-r', usage: {} }))
vi.mock('./providers/quiver', () => ({
  generateObjectSvg: vi.fn(async () => { throw new Error('the parent was seeded; generation should not run') }),
  repairObjectSvg: vi.fn(async () => { throw new Error('the mock drawing passes acceptance; repair should not run') }),
  reviseObjectSvg,
}))

// The library is read through persistence; pin the explicit file backend
// into a temp dir before importing it.
process.env.STUDIO_PERSISTENCE = 'local'
let dataDir = ''
let makeArtwork: typeof import('./appearance-library').makeArtwork
let loadSetting: typeof import('./persistence').loadSetting
let saveSetting: typeof import('./persistence').saveSetting

const brief = briefFromRole({ id: 'obj-slot-pool-2', label: 'Slot pool', kind: 'box', detail: 'a fixed pool of worker slots' })
const PARENT_KEY = 'aabbccddeeff00112233'
const parentRecord = {
  key: PARENT_KEY, entity: 'slot-pool', accepted: true,
  brief, parts: [], viewBox: { width: 320, height: 240 }, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
  url: '/objects/parent.svg', createdAt: '2026-09-01T00:00:00.000Z', operation: 'generate',
  provenance: { provider: 'quiver', model: 'q', requestId: 'r' },
}

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'artwork-revisions-'))
  process.env.STUDIO_DATA_DIR = dataDir
  ;({ makeArtwork } = await import('./appearance-library'))
  ;({ loadSetting, saveSetting } = await import('./persistence'))
  await saveSetting(`artwork:${PARENT_KEY}`, parentRecord)
  await saveSetting(`artwork-source:${PARENT_KEY}`, parentRecord.svg)
  await saveSetting('artwork-library-v1', [PARENT_KEY])
})

afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe('library revisions', () => {
  it('an edit records a new revision with its parent, leaving the parent untouched', async () => {
    const answer = await makeArtwork({ key: PARENT_KEY, operation: 'edit', prompt: 'round the corners' })
    expect(answer.reused).toBe(false)
    expect(answer.appearance.key).not.toBe(PARENT_KEY)
    expect(answer.appearance.parentKey).toBe(PARENT_KEY)
    expect(answer.appearance.operation).toBe('edit')
    expect(reviseObjectSvg).toHaveBeenCalledTimes(1)
    // The parent revision is immutable: same record, still in the index.
    expect(await loadSetting(`artwork:${PARENT_KEY}`)).toEqual(parentRecord)
    const index = (await loadSetting('artwork-library-v1')) as string[]
    expect(index).toContain(PARENT_KEY)
    expect(index).toContain(answer.appearance.key)
  })

  it('a palette override lands on the revision brief', async () => {
    const answer = await makeArtwork({ key: PARENT_KEY, operation: 'edit', prompt: 'recolor the accents', palette: { accent: '#112233' } })
    expect(answer.appearance.brief.style.palette.accent).toBe('#112233')
    expect(answer.appearance.parentKey).toBe(PARENT_KEY)
  })

  it('repeating the same edit reuses the cached revision — no provider call', async () => {
    const before = reviseObjectSvg.mock.calls.length
    const again = await makeArtwork({ key: PARENT_KEY, operation: 'edit', prompt: 'round the corners' })
    expect(again.reused).toBe(true)
    expect(reviseObjectSvg.mock.calls.length).toBe(before)
  })

  it('an edit without a prompt or parent is refused before any provider call', async () => {
    const before = reviseObjectSvg.mock.calls.length
    await expect(makeArtwork({ key: PARENT_KEY, operation: 'edit', prompt: ' ' })).rejects.toThrow(/Describe the change/)
    await expect(makeArtwork({ key: 'deadbeef000000000000', operation: 'edit', prompt: 'x' })).rejects.toThrow(/Choose an existing library object/)
    expect(reviseObjectSvg.mock.calls.length).toBe(before)
  })
})
