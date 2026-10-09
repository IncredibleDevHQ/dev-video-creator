import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, it } from 'vitest'
import { LOOKS, NEUTRAL_LOOK, lookColour, recolourLook } from '../shared/looks'
const root = await mkdtemp(join(tmpdir(), 'studio-looks-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { startingLook, withLook, validateLook } = await import('./looks')
const { saveLibraryBrand } = await import('./brand-library')
const { readSourceNarrative } = await import('./source-document')
afterAll(() => rm(root, { recursive: true, force: true }))

// The orange the old brand dialog presented as Stripe's (review 5).
const fallback = {
  ground: '#ffffff',
  text: '#1a1a1a',
  accent: '#f5a623',
  secondary: '#f5a623'
}

it('re-mixes a page’s tints in the new look and keeps colours that mean something', () => {
  const paper = NEUTRAL_LOOK.palette
  expect(lookColour('#f5a623', fallback, paper)).toBe(paper.accent)
  expect(lookColour('#ffffff', fallback, paper)).toBe(paper.ground)
  // An accent tint stays a light tint, now of the new accent.
  const tint = lookColour('#fdf4e3', fallback, paper)
  expect(tint).not.toBe('#fdf4e3')
  expect(parseInt(tint.slice(5, 7), 16)).toBeGreaterThan(230)
  // A refusal red is not a mix of the look, so it stays red.
  expect(lookColour('#d64545', fallback, paper)).toBe('#d64545')
  const svg =
    '<svg><rect fill="#FDF4E3" stroke="#f5a623"/><text font-family="Segoe UI, sans-serif" fill="#1a1a1a">A</text></svg>'
  const moved = recolourLook(svg, fallback, paper, {
    from: { display: 'Segoe UI', body: 'Segoe UI', mono: 'Consolas' },
    to: NEUTRAL_LOOK.fonts
  })
  expect(moved).toContain(`stroke="${paper.accent}"`)
  expect(moved).toContain('font-family="Inter, sans-serif"')
  expect(moved).not.toMatch(/f5a623|Segoe/i)
})

it('starts a notebook with a saved look, else the site’s colours, else Paper — never the fallback orange', async () => {
  const notes = readSourceNarrative('Plain notes have no site and no colours.')
  expect((await startingLook(notes)).id).toBe('paper')
  const site = {
    ...notes,
    url: 'https://example.com/post',
    site: 'example.com',
    palette: {
      ...notes.palette,
      accent: '#635bff',
      provenance: 'extracted' as const,
      from: 'example.com'
    }
  }
  expect(await startingLook(site)).toMatchObject({
    id: 'site',
    name: 'example.com',
    palette: { accent: '#635bff' }
  })
  await saveLibraryBrand({
    domain: 'example.com',
    brand: withLook(undefined, LOOKS[2])
  })
  expect((await startingLook(site)).name).toBe('Blueprint')
  // A look carries no identity: the lower third's name stays the creator's.
  expect(
    withLook({ ...withLook(undefined, LOOKS[0]), name: 'Sam' }, LOOKS[1])
  ).toMatchObject({ name: 'Sam', look: { id: 'ink' } })
  expect(() => validateLook({ id: 'x', name: 'X', palette: {} })).toThrow()
  expect(validateLook({ id: 'ember' }).name).toBe('Ember')
})
