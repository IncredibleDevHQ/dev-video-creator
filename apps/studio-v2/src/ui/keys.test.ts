import { describe, expect, it } from 'vitest'
import { stageKeyOf } from './keys'
import { folio } from './overview'

describe('the keys of the one stage layout', () => {
  it('turns the pages with every arrow, bare keys only', () => {
    expect(stageKeyOf({ key: 'ArrowRight' })).toBe('next')
    expect(stageKeyOf({ key: 'ArrowDown' })).toBe('next')
    expect(stageKeyOf({ key: 'PageUp' })).toBe('previous')
    expect(stageKeyOf({ key: 'ArrowLeft' })).toBe('previous')
    expect(stageKeyOf({ key: 'Home' })).toBe('first')
    expect(stageKeyOf({ key: 'End' })).toBe('last')
    expect(stageKeyOf({ key: 'o' })).toBe('overview')
    expect(stageKeyOf({ key: 'F' })).toBe('fullscreen')
    expect(stageKeyOf({ key: 'f', metaKey: true })).toBeNull()
    expect(stageKeyOf({ key: 'ArrowLeft', altKey: true })).toBeNull()
    expect(stageKeyOf({ key: 'x' })).toBeNull()
  })
  it('moves on with Space only where Space does not press a button', () => {
    expect(stageKeyOf({ key: ' ' })).toBe('next')
    expect(stageKeyOf({ key: ' ' }, { space: false })).toBeNull()
  })
  it('in a video\'s scenes, moves between scenes up and down, and along the moments sideways', () => {
    const scenes = { space: false, sideways: 'moments' as const }
    expect(stageKeyOf({ key: 'ArrowDown' }, scenes)).toBe('next')
    expect(stageKeyOf({ key: 'PageUp' }, scenes)).toBe('previous')
    expect(stageKeyOf({ key: 'ArrowRight' }, scenes)).toBe('forward')
    expect(stageKeyOf({ key: 'ArrowLeft' }, scenes)).toBe('back')
    expect(stageKeyOf({ key: ' ' }, { sideways: 'moments' })).toBeNull()
  })
  it('writes numbers as two figures', () => {
    expect(folio(3)).toBe('03')
    expect(folio(12)).toBe('12')
  })
})
