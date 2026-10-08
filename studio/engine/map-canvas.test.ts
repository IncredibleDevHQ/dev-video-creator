import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'
import {
  dropSpot,
  extent,
  mapGroups,
  mapLayout,
  newPages,
  QW
} from '../app/map-layout'
import {
  copyCard,
  laneHead,
  mapCard,
  mapNotes,
  segueCard
} from '../app/map-view'

const slide = (id: string, extra: Partial<Slide> = {}): Slide => ({
  id,
  title: `Page ${id}`,
  svg: `<svg data-page="${id}"></svg>`,
  ...extra
})
const map = (
  slides: Slide[],
  extra: Partial<Snapshot['project']> = {}
): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    slides,
    video: null,
    ...extra
  },
  status: 'ready',
  error: null,
  events: []
})
const episode = (
  notebook: string,
  number: number,
  copies: MapEpisode['copies']
): MapEpisode => ({
  notebook,
  number,
  title: `Episode ${number}`,
  status: 'ready',
  copies,
  video: null,
  teasers: [],
  posts: false
})
const copy = (
  id: string,
  page: string,
  extra: Partial<MapEpisode['copies'][number]> = {}
) => ({
  id,
  title: `Copy of ${page}`,
  svg: '<svg></svg>',
  copyOf: { notebook: 'map', slide: page, hash: 'h' },
  stale: false,
  orphan: false,
  ...extra
})

describe('the map’s layout', () => {
  const notes = [
    {
      id: 'n1',
      at: '2026-10-09T10:00:00Z',
      text: 'An idea',
      state: 'sorted' as const,
      results: [
        { kind: 'adds' as const, slideId: 'a', title: 'Page a', line: 'more' }
      ]
    }
  ]
  const snapshot = map(
    [
      slide('a', { topic: 'Why' }),
      slide('b', { topic: 'How' }),
      slide('c', { fromNote: 'n1', topic: 'Why' }),
      slide('d')
    ],
    { notes, topics: ['Why', 'How'] }
  )
  it('groups pages by the order they came in, or by topic', () => {
    expect(
      mapGroups(snapshot, 'order').map((g) => [g.label, g.slides])
    ).toEqual([
      ['From the source', ['a', 'b', 'd']],
      ['Note', ['c']]
    ])
    expect(
      mapGroups(snapshot, 'topic').map((g) => [g.label, g.slides])
    ).toEqual([
      ['Why', ['a', 'c']],
      ['How', ['b']],
      ['Not grouped yet', ['d']]
    ])
  })
  it('counts the latest note’s pages and additions as new', () => {
    expect([...newPages(snapshot)].sort()).toEqual(['a', 'c'])
  })
  it('lays out lanes of copies and finds where a dragged page lands', () => {
    const view: MapView = {
      notebook: 'map',
      title: 'Streamline',
      series: { id: 's', title: 'Series' },
      episodes: [
        episode('e1', 1, [copy('x', 'a'), copy('y', 'b')]),
        episode('e2', 2, [])
      ],
      usage: { a: ['e1'], b: ['e1'] }
    }
    const layout = mapLayout(snapshot, view, 'order')
    expect(layout.series).not.toBeNull()
    const [x, y] = [layout.copies.x, layout.copies.y]
    expect(y.x - x.x).toBe(QW + 40)
    expect(layout.bridges.map((b) => b.copy)).toEqual(['y'])
    expect(layout.segues.map((s) => s.key)).toEqual(['s:e1', 'e:e1'])
    expect(layout.empties.e2).toBeDefined()
    // Over the first copy's left half: lands before it.
    expect(dropSpot(layout, view, { x: x.x + 10, y: x.y + 10 })).toMatchObject({
      episode: 'e1',
      index: 0
    })
    expect(
      dropSpot(layout, view, { x: y.x + QW - 5, y: y.y + 10 })
    ).toMatchObject({ episode: 'e1', index: 2 })
    // Its own copy is left out while it moves.
    expect(
      dropSpot(layout, view, { x: y.x + QW - 5, y: y.y + 10 }, 'y')
    ).toMatchObject({ index: 1 })
    expect(dropSpot(layout, view, { x: 0, y: 0 })).toBeNull()
    const all = extent(layout)
    expect(all.x + all.w).toBeGreaterThan(layout.series!.x + layout.series!.w)
  })
})

describe('the map’s markup', () => {
  const view: MapView = {
    notebook: 'map',
    title: 'Streamline',
    series: { id: 's', title: 'Series' },
    episodes: [
      episode('e1', 1, [
        copy('x', 'a', { bridge: 'So, why?' }),
        copy('y', 'b', { stale: true, outro: 'Next time: how.' })
      ]),
      episode('e2', 2, [copy('z', 'b')])
    ],
    usage: { a: ['e1'], b: ['e1', 'e2'] }
  }
  it('says where each page is used, or that it is not', () => {
    const snapshot = map([
      slide('a'),
      slide('b'),
      slide('c'),
      slide('d', { aside: true }),
      slide('e', { onlyIn: 'e2' })
    ])
    expect(
      mapCard(snapshot, view, snapshot.project.slides[0], false)
    ).toContain('>E1</i>')
    expect(mapCard(snapshot, view, snapshot.project.slides[1], false)).toMatch(
      /E1<\/i>.*E2<\/i>/
    )
    expect(
      mapCard(snapshot, view, snapshot.project.slides[2], false)
    ).toContain('unused')
    expect(
      mapCard(snapshot, view, snapshot.project.slides[3], false)
    ).toContain('set aside')
    expect(
      mapCard(snapshot, view, snapshot.project.slides[4], false)
    ).toContain('Ep 2 only')
  })
  it('marks a copy whose original changed, and one used twice', () => {
    const [first, second] = view.episodes[0].copies
    expect(copyCard(view, view.episodes[0], second, 1, 2)).toContain(
      'source changed'
    )
    expect(
      copyCard(view, view.episodes[1], view.episodes[1].copies[0], 0, 2)
    ).toContain('repeat')
    expect(copyCard(view, view.episodes[0], first, 0, 1)).toContain(
      'from page 1'
    )
  })
  it('names the segues by where the episode sits', () => {
    expect(segueCard(view.episodes[0], false, false)).toContain('Cold open')
    expect(segueCard(view.episodes[0], false, false)).toContain('So, why?')
    expect(segueCard(view.episodes[0], true, false)).toContain('Next time')
    expect(segueCard(view.episodes[0], true, false)).toContain(
      'Next time: how.'
    )
    expect(segueCard(view.episodes[1], false, true)).toContain('Last time')
    expect(segueCard(view.episodes[1], true, true)).toContain('Wrap-up')
    expect(
      segueCard({ ...view.episodes[0], segues: 'writing' }, false, false)
    ).toContain('writing…')
  })
  it('offers Make before a video, and teaser and posts once it is made', () => {
    expect(laneHead(view, view.episodes[0])).toContain(
      'data-map="open:e1">Make<'
    )
    const made = {
      ...view.episodes[0],
      video: { scenes: 2, made: 2, joined: true }
    }
    const head = laneHead(view, made)
    expect(head).toContain('data-map="teaser:e1"')
    expect(head).toContain('data-map="posts:e1"')
  })
  it('lists each note with what it became', () => {
    const snapshot = map([slide('a')], {
      notes: [
        {
          id: 'n',
          at: '2026-10-09T10:00:00Z',
          text: 'More on a.',
          state: 'sorted',
          results: [
            { kind: 'adds', slideId: 'a', title: 'Page a', line: 'more' }
          ]
        }
      ]
    })
    const html = mapNotes(snapshot)
    expect(html).toContain('adds to 1')
    expect(html).toContain('More on a.')
    expect(mapNotes(map([slide('a')]))).toContain('Add notes here any time')
  })
})
