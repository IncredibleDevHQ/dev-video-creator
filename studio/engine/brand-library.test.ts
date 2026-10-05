import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test, vi } from 'vitest'
vi.mock('./source-reader', () => ({
  readSourceUrl: vi.fn(async () => ({
    text: 'Fresh fetched text',
    site: 'Example',
    palette: { ground: '#ffffff' },
    fonts: { display: 'Inter' },
    logos: []
  }))
}))
const root = await mkdtemp(join(tmpdir(), 'studio-brand-library-'))
process.env.MINIMAL_STUDIO_DATA_DIR = root
const { saveLibraryBrand, loadBrandLibrary, brandDomain, redetectBrand } =
  await import('./brand-library')
const { writeRow, readRow } = await import('./persistence')
afterAll(() => rm(root, { recursive: true, force: true }))
const brand = {
  name: 'Example',
  tagline: '',
  logoKey: null,
  useAccent: true,
  accent: '#336699',
  palette: { ground: '#ffffff', text: '#111111', secondary: '#ddeeff' },
  fonts: { display: 'Inter', body: 'Inter', mono: 'Consolas' }
}
test('domain brands persist, reject implicit and stale overwrites, and preserve other brands', async () => {
  expect(brandDomain('https://WWW.Example.com/article')).toBe('example.com')
  const saved = await saveLibraryBrand({ brand, domain: 'example.com' })
  await saveLibraryBrand({
    brand: { ...brand, name: 'Other' },
    domain: 'other.com'
  })
  await expect(
    saveLibraryBrand({ brand, domain: 'example.com' })
  ).rejects.toThrow('already saved')
  await expect(
    saveLibraryBrand({
      brand,
      domain: 'example.com',
      overwriteId: saved.id,
      expectedUpdatedAt: 'stale'
    })
  ).rejects.toThrow('changed')
  const changed = await saveLibraryBrand({
    brand: { ...brand, accent: '#123456' },
    domain: 'example.com',
    overwriteId: saved.id,
    expectedUpdatedAt: saved.updatedAt
  })
  expect(changed.id).toBe(saved.id)
  const reloaded = await loadBrandLibrary()
  expect(reloaded).toHaveLength(2)
  expect(
    reloaded.find((entry) => entry.domain === 'example.com')?.brand
  ).toMatchObject({
    accent: '#123456',
    fonts: brand.fonts,
    palette: brand.palette
  })
})
test('fresh detection leaves edited notebook text and stored brand untouched', async () => {
  const source = {
    url: 'https://example.com/blog',
    text: 'Creator edits',
    site: 'Old',
    palette: { ground: '#000000' },
    fonts: { display: 'Old' },
    logos: []
  }
  await writeRow('sources', 'fixture', source)
  const previous = await loadBrandLibrary()
  expect(await redetectBrand('fixture')).toMatchObject({
    text: 'Creator edits',
    palette: { ground: '#ffffff' }
  })
  expect(await readRow('sources', 'fixture')).toEqual(source)
  expect(await loadBrandLibrary()).toEqual(previous)
})
