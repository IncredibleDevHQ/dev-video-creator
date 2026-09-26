import { describe, expect, it } from 'vitest'
import { familiesOf, readableList } from './font-families'

// R05 of the project-flow rereview: a slide named its face bare —
// "Source Serif 4, Segoe UI, sans-serif" — which CSS cannot read, so the
// stage set it in the studio's sans-serif and the PDF in Times.
describe('a font-family list as CSS reads it', () => {
  it('reads the families of a list, quoted or not', () => {
    expect(familiesOf(`"Source Serif 4", Georgia, 'Times New Roman', serif`)).toEqual(['Source Serif 4', 'Georgia', 'Times New Roman', 'serif'])
    expect(familiesOf('var(--a, serif), monospace')).toEqual(['var(--a, serif)', 'monospace'])
  })

  it('quotes a list CSS cannot read, and leaves one it can', () => {
    expect(readableList('Source Serif 4, Segoe UI, sans-serif')).toBe(`'Source Serif 4', 'Segoe UI', sans-serif`)
    expect(readableList('Segoe UI, Inter, sans-serif')).toBeNull()
    expect(readableList(`'Source Serif 4', serif`)).toBeNull()
    expect(readableList('var(--display), 3D Serif')).toBe(`var(--display), '3D Serif'`)
  })
})
