import { describe, expect, it } from 'vitest'
import { canonicalJson, draftHoldsEdits, sameDocument } from './draft-state'

const notebook = (fill: string, order: 'page' | 'store' = 'page') =>
  order === 'page'
    ? { version: 1, id: 'n1', notebook: { type: 'doc', content: [{ type: 'scene', attrs: { id: 's1', svg: `<rect fill="${fill}"/>` } }] }, blocks: {} }
    : { blocks: {}, id: 'n1', notebook: { content: [{ attrs: { svg: `<rect fill="${fill}"/>`, id: 's1' }, type: 'scene' }], type: 'doc' }, version: 1 }

describe('a local draft', () => {
  it('compares notebooks whatever order the store keeps their keys in', () => {
    expect(canonicalJson(notebook('#4f46e5'))).toBe(canonicalJson(notebook('#4f46e5', 'store')))
    expect(sameDocument(notebook('#4f46e5'), notebook('#4f46e5', 'store'))).toBe(true)
    expect(sameDocument(notebook('#4f46e5'), notebook('#dc2626', 'store'))).toBe(false)
    expect(sameDocument(null, null)).toBe(false)
  })

  it('holds edits only while it differs from its base and from the store', () => {
    const base = notebook('#4f46e5', 'store')
    // An edit the store never saw: it outranks the store.
    expect(draftHoldsEdits(notebook('#16a34a'), base, base)).toBe(true)
    // A draft written again for content the store already acknowledged —
    // while the store's copy changed elsewhere — holds nothing to recover:
    // the store's newer copy must win.
    expect(draftHoldsEdits(notebook('#4f46e5'), base, notebook('#dc2626', 'store'))).toBe(false)
    // The store already has what the draft says.
    expect(draftHoldsEdits(notebook('#16a34a'), base, notebook('#16a34a', 'store'))).toBe(false)
    // An older draft without a base still counts unless the store matches it.
    expect(draftHoldsEdits(notebook('#16a34a'), null, base)).toBe(true)
    expect(draftHoldsEdits(null, base, base)).toBe(false)
  })
})
