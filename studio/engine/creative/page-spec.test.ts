import { expect, it } from 'vitest'
import { ICON_NAMES, deckSpec, expandIcons } from './page-spec'
import { mix, pageBrandFrom } from '../source-page'
import { readSourceNarrative } from '../source-document'

it('writes a short spec from the look: its colours, type, layout and icon names', () => {
  const source = readSourceNarrative('Synthetic spec fixture.')
  const brand = pageBrandFrom(source.palette, source.fonts)
  const spec = deckSpec({ title: 'Fixture', brand, total: 10 })
  for (const colour of [
    brand.ground,
    brand.text,
    brand.accent,
    mix(brand.ground, brand.accent, 0.1)
  ])
    expect(spec).toContain(colour)
  expect(spec).toContain(brand.display)
  for (const name of ICON_NAMES()) expect(spec).toContain(name)
  // The spec every page call reads stays a page or two, not a manual.
  expect(Buffer.byteLength(spec)).toBeLessThan(8_000)
})

it('draws an icon in once, however often a page is expanded', () => {
  const page =
    '<svg viewBox="0 0 1280 720"><g data-icon="clock" transform="translate(10 10)" stroke="#000"/></svg>'
  const once = expandIcons(page)
  expect(once.unknown).toEqual([])
  expect(once.svg).toMatch(/<g data-icon="clock"[^>]*><path /)
  expect(expandIcons(once.svg).svg).toBe(once.svg)
  expect(expandIcons('<g data-icon="../secret"/>').unknown).toEqual([
    '../secret'
  ])
})
