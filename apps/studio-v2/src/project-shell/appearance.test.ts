import { describe, expect, it } from 'vitest'
import { appearanceOf, shownAppearance } from './appearance'

describe('the studio\'s appearance', () => {
  it('reads a kept choice, and anything else as the system\'s', () => {
    expect(appearanceOf('dark')).toBe('dark')
    expect(appearanceOf('light')).toBe('light')
    expect(appearanceOf(null)).toBe('system')
    expect(appearanceOf('sepia')).toBe('system')
  })
  it('follows the system unless a choice is made', () => {
    expect(shownAppearance('system', true)).toBe('dark')
    expect(shownAppearance('system', false)).toBe('light')
    expect(shownAppearance('light', true)).toBe('light')
    expect(shownAppearance('dark', false)).toBe('dark')
  })
})
