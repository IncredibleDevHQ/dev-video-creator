import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { briefFromRole, briefKey, objectBriefFrom, REFERENCE_STYLE, type ObjectBrief } from './appearance'

// The library is read through persistence; pin the explicit file backend
// into a temp dir before importing it.
process.env.STUDIO_PERSISTENCE = 'local'
let dataDir = ''
let makeArtwork: typeof import('./appearance-library').makeArtwork
let saveSetting: typeof import('./persistence').saveSetting

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'brief-compat-'))
  process.env.STUDIO_DATA_DIR = dataDir
  ;({ makeArtwork } = await import('./appearance-library'))
  ;({ saveSetting } = await import('./persistence'))
})

afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe('briefFromRole', () => {
  const brief = briefFromRole({ id: 'obj-slot-pool-2', label: 'Slot pool', kind: 'box', detail: 'a fixed pool of worker slots', subject: 'bounded concurrency' })

  it('builds a brief that passes the product validation', () => {
    const validated = objectBriefFrom(brief)
    expect(validated.entity).toBe('slot-pool')
    expect(validated.objectId).toBe('obj-slot-pool-2')
    expect(validated.role).toBe('slot pool')
    expect(validated.represents).toBe('a fixed pool of worker slots')
    expect(validated.parts.map(part => part.id)).toEqual(['body', 'contents'])
    expect(validated.ports).toEqual({ in: { x: 0, y: 0.5 }, out: { x: 1, y: 0.5 } })
  })

  it('keeps the model id out of the brief key, so models share drawings', () => {
    const other = briefFromRole({ id: 'obj-slot-pool-9', label: 'Slot pool', kind: 'box', detail: 'a fixed pool of worker slots', subject: 'bounded concurrency' })
    expect(briefKey(brief)).toBe(briefKey(other))
  })
})

describe('compatible reuse without provider calls', () => {
  const brief = briefFromRole({ id: 'obj-slot-pool-2', label: 'Slot pool', kind: 'box', detail: 'a fixed pool of worker slots' })
  const seededRecord = {
    key: 'aabbccddeeff00112233', entity: 'slot-pool', accepted: true,
    brief: { ...brief, subject: 'an older explanation' },
    parts: [], viewBox: { width: 320, height: 240 }, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    url: '/objects/x.svg', createdAt: '2026-09-01T00:00:00.000Z', operation: 'generate',
    provenance: { provider: 'quiver', model: 'q', requestId: 'r' },
  }

  it('reuses an accepted compatible asset instead of calling the provider', async () => {
    await saveSetting('artwork:aabbccddeeff00112233', seededRecord)
    await saveSetting('artwork-library-v1', ['aabbccddeeff00112233'])
    // Same role/family/palette/parts but different wording and subject: a new
    // brief key, a compatible drawing — no provider call (no key configured
    // here; a call would throw).
    const requestBrief: ObjectBrief = { ...brief, represents: 'the worker pool', subject: 'worker concurrency' }
    const answer = await makeArtwork({ brief: requestBrief, operation: 'generate' })
    expect(answer.reused).toBe(true)
    expect(answer.appearance.key).toBe('aabbccddeeff00112233')
  })

  it('does not reuse a different palette or a missing part', async () => {
    const offPalette = { ...brief, style: { ...brief.style, palette: { ...brief.style.palette, accent: '#00ff00' } } }
    await expect(makeArtwork({ brief: offPalette, operation: 'generate' })).rejects.toThrow(/budget|provider|Quiver|key/i)
    const missingPart: ObjectBrief = { ...brief, parts: [...brief.parts, { id: 'gate', what: 'the admission gate' }] }
    await expect(makeArtwork({ brief: missingPart, operation: 'generate' })).rejects.toThrow(/budget|provider|Quiver|key/i)
  })
})
