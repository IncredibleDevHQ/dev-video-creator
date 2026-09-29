import { describe, expect, it } from 'vitest'
import { createWheelPager, notesOf, pageStateOf, pagesOf } from './pages'

describe('the page view\'s pages', () => {
  it('reads only the page blocks, in order, with their words', () => {
    const pages = pagesOf([
      { id: 'h1', node: { type: 'heading', attrs: {} } },
      { id: 'p1', node: { type: 'scene', attrs: { id: 'p1', title: 'One file', script: 'BoltDB keeps one file. [camera holds]\n\nIt maps it.', sourcePassages: ['A whole database in one file.', '  '] } } },
      { id: 'p2', node: { type: 'scene', attrs: { id: 'p2', title: '' } } },
    ])
    expect(pages.map(page => [page.id, page.index, page.title])).toEqual([['p1', 0, 'One file'], ['p2', 1, 'Page 2']])
    expect(pages[0].notes).toEqual(['BoltDB keeps one file.', 'It maps it.'])
    expect(pages[0].passages).toEqual(['A whole database in one file.'])
    expect(pages[1].notes).toEqual([])
  })
  it('says how a page was made, when it says', () => {
    expect(pageStateOf({})).toBeNull()
    expect(pageStateOf({ pageOrigin: { kind: 'designed', by: 'Claude Code' } })).toMatchObject({ label: 'Designed', tone: 'good', detail: 'A designed slide, drawn by Claude Code.' })
    expect(pageStateOf({ pageOrigin: { kind: 'schematic' } })).toMatchObject({ label: 'Schematic draft', tone: 'warn' })
    // A run designs the deck's pages, not this one at this moment: the page
    // waits for its design rather than claims to be drawn (F03).
    expect(pageStateOf({ pageOrigin: { kind: 'schematic', designing: { by: 'Kimi' } } })).toMatchObject({ label: 'Waiting for its design', tone: 'busy' })
    expect(pageStateOf({ pageOrigin: { kind: 'schematic', designing: { by: 'Kimi' } } })?.detail).toBe("Kimi is designing this presentation's pages. This one shows here when its design lands; its wireframe stands in until then.")
    expect(pageStateOf({ pageOrigin: { kind: 'schematic', designing: {} } })?.detail).toMatch(/^The designer is designing/)
  })
  it('does not call a wireframe\'s pages schematic drafts, as its notebook does not', () => {
    const blocks = [{ id: 'w1', node: { type: 'scene', attrs: { title: 'One file', pageOrigin: { kind: 'schematic' } } } }]
    expect(pagesOf(blocks, { wireframe: true })[0].state).toBeNull()
    expect(pagesOf(blocks)[0].state?.label).toBe('Schematic draft')
  })
  it('drops the video\'s directions from the notes', () => {
    expect(notesOf('[wide] Hello  there.\n\n\n[cut]')).toEqual(['Hello there.'])
    expect(notesOf(undefined)).toEqual([])
  })
})

describe('moving through the pages', () => {
  it('turns one page per wheel gesture, past a small threshold', () => {
    const pager = createWheelPager({ threshold: 12, restMs: 90 })
    expect(pager(5, 0, 0)).toBe(0)
    expect(pager(8, 0, 10)).toBe(1)
    // The same gesture's momentum does not turn another.
    expect(pager(40, 0, 30)).toBe(0)
    expect(pager(40, 0, 60)).toBe(0)
    // Rested, a new gesture turns again, either way.
    expect(pager(-20, 0, 400)).toBe(-1)
    // A sideways swipe is not a page turn.
    expect(pager(2, 30, 900)).toBe(0)
  })
})
