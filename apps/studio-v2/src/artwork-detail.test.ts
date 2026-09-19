import { describe, expect, it } from 'vitest'
import { artworkDetailFor, artworkDetailLine } from './artwork-detail'

describe('artworkDetailFor', () => {
  it('lists part ids from the record and behavior clips from the svg markers', () => {
    const asset = {
      parts: [{ id: 'body' }, { id: 'contents' }],
      svg: '<svg><g id="ap1-body" data-object-clip="fill"><rect data-object-clip="drain"/></g><circle data-object-clip="fill"/></svg>',
    }
    expect(artworkDetailFor(asset)).toEqual({ parts: ['body', 'contents'], behaviors: ['fill', 'drain'] })
  })

  it('keeps nothing when the record has neither parts nor markers', () => {
    expect(artworkDetailFor({})).toEqual({ parts: [], behaviors: [] })
    expect(artworkDetailFor({ svg: '<svg><rect id="x"/></svg>' }).behaviors).toEqual([])
  })
})

describe('artworkDetailLine', () => {
  it('renders parts and behaviors in one line', () => {
    expect(artworkDetailLine({ parts: [{ id: 'body' }], svg: '<g data-object-clip="fill"/>' })).toBe('parts: body · behaviors: fill')
  })

  it('truncates long part lists with a count', () => {
    const parts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({ id }))
    expect(artworkDetailLine({ parts })).toBe('parts: a, b, c, d, e +2')
  })

  it('says so when there are no parts', () => {
    expect(artworkDetailLine({})).toBe('parts: none')
  })
})
