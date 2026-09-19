import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// verifyCast reads the artwork library through the persistence layer; pin the
// explicit file backend into a temp dir before importing it.
process.env.STUDIO_PERSISTENCE = 'local'
let dataDir = ''
let verifyCast: typeof import('./appearance-library').verifyCast
let saveSetting: typeof import('./persistence').saveSetting

const ARTWORK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 L50 90 L90 10 Z" fill="#635bff"/><circle cx="50" cy="50" r="8" fill="#fff"/></svg>'
// The scene import prefixes ids and wraps the artwork in a transformed group;
// path data arrives verbatim.
const sceneWith = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><g data-appearance-for="n1" data-appearance-key="abc123" transform="translate(10 10) scale(2)"><g id="n1-art-root">${inner}</g></g></svg>`

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'verify-cast-'))
  process.env.STUDIO_DATA_DIR = dataDir
  const library = await import('./appearance-library')
  const persistence = await import('./persistence')
  verifyCast = library.verifyCast
  saveSetting = persistence.saveSetting
  await saveSetting('artwork:abc123', { key: 'abc123', entity: 'bucket', svg: ARTWORK_SVG, accepted: true })
  await saveSetting('artwork-library-v1', ['abc123'])
})

afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe('verifyCast', () => {
  it('verifies a subtree that is the accepted artwork', async () => {
    const result = await verifyCast(sceneWith('<path d="M10 10 L50 90 L90 10 Z" fill="#635bff"/><circle cx="50" cy="50" r="8" fill="#fff"/>'))
    expect(result.ok).toBe(true)
    expect(result.cast).toEqual([{ key: 'abc123', status: 'verified', tokensFound: 1, tokensTotal: 1 }])
  })

  it('refuses a marker naming no accepted asset', async () => {
    const result = await verifyCast(sceneWith('<rect width="10" height="10"/>').replace('abc123', 'nope'))
    expect(result.ok).toBe(false)
    expect(result.cast[0].status).toBe('unknown')
  })

  it('refuses a marker whose subtree is not the artwork', async () => {
    const result = await verifyCast(sceneWith('<path d="M0 0 L1 1" stroke="#000"/>'))
    expect(result.ok).toBe(false)
    expect(result.cast[0].status).toBe('mismatch')
  })

  it('accepts a scene with no markers (the rich validator rules on presence)', async () => {
    const result = await verifyCast('<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>')
    expect(result).toEqual({ ok: true, cast: [] })
  })

  it('handles a nested group inside the marker subtree', async () => {
    const nested = '<g><g><path d="M10 10 L50 90 L90 10 Z" fill="#635bff"/></g></g>'
    const result = await verifyCast(sceneWith(nested))
    expect(result.ok).toBe(true)
  })
})
