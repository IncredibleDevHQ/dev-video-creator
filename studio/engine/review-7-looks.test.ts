// Review 7, the look's fonts and logo: a family name CSS can't read bare is
// quoted wherever the studio writes one (SR-13), a font change alone leaves
// the colours as drawn (UX-5), and a logo says when it blends into the
// look's ground (UX-6).
import { describe, expect, it } from 'vitest'
import { cssFamily, NEUTRAL_LOOK, recolourLook } from '../shared/looks'
import { logoContrast } from '../app/look-panel'
import { deckSpec } from './creative/page-spec'
import { renderPage, type PageBrand } from './source-page'
import type { OutlineScene } from './source-outline'

const brand: PageBrand = {
  ground: '#ffffff',
  text: '#111111',
  muted: '#555555',
  line: '#dddddd',
  accent: '#635bff',
  secondary: '#00d4ff',
  panel: '#f6f9fc',
  display: 'Source Sans 3',
  body: 'Source Sans 3',
  mono: 'Source Code Pro'
}

const scene = {
  title: 'Why limits exist',
  idea: 'One client can take a shared API down',
  kind: 'concept',
  seconds: 8,
  parts: [],
  relations: [],
  narration: '',
  source: []
} as unknown as OutlineScene

/** Pixels as a canvas gives them: [r, g, b, a] each. */
const pixels = (...rgba: number[][]) => rgba.flat()

describe('review 7: the look’s fonts and logo', () => {
  it('quotes a family the studio writes when CSS can’t read it bare', () => {
    expect(cssFamily('Source Sans 3')).toBe("'Source Sans 3'")
    expect(cssFamily('Segoe UI')).toBe('Segoe UI')
    const svg = renderPage(scene, 0, 3, brand, {
      title: 'Rate limits',
      site: 'stripe.com'
    })
    expect(svg).toContain(`font-family="'Source Sans 3', Segoe UI, sans-serif"`)
    expect(svg).not.toContain('font-family="Source Sans 3,')
    // The drawing agent is shown the same, quoted, for every role.
    const spec = deckSpec({ title: 'Rate limits', brand, total: 3 })
    expect(spec).toContain(`font-family="'Source Sans 3', Inter`)
    expect(spec).toContain("headings: `'Source Sans 3', Inter")
    // A name CSS reads bare stays bare.
    expect(spec).toContain('mono: `Source Code Pro, Menlo, monospace`')
  })

  it('keeps the drawn colours when only a font changes', () => {
    const drawn =
      '<svg><rect fill="#f6f3ec"/><rect fill="#e3ead9"/><text font-size="40" font-family="Inter, sans-serif">Hi</text></svg>'
    const palette = NEUTRAL_LOOK.palette
    const fonts = { ...NEUTRAL_LOOK.fonts, display: 'Inter', body: 'Inter' }
    const swapped = recolourLook(
      drawn,
      palette,
      { ...palette },
      {
        from: fonts,
        to: { ...fonts, display: 'Source Sans 3' }
      }
    )
    expect(swapped).toContain('fill="#f6f3ec"')
    expect(swapped).toContain('fill="#e3ead9"')
    expect(swapped).toContain(`font-family="'Source Sans 3', sans-serif"`)
  })

  it('measures how much of a logo stands out from a ground', () => {
    // A dark wordmark, a transparent margin around it.
    const dark = pixels([20, 20, 30, 255], [24, 22, 35, 255], [0, 0, 0, 0])
    expect(logoContrast(dark, '#ffffff')).toBe(1)
    expect(logoContrast(dark, '#151820')).toBe(0)
    // Half of it in the ground's colour: under the warning's line.
    const half = pixels([20, 20, 30, 255], [250, 250, 250, 255])
    expect(logoContrast(half, '#ffffff')).toBe(0.5)
    expect(logoContrast(pixels([0, 0, 0, 0]), '#ffffff')).toBe(1)
  })
})
