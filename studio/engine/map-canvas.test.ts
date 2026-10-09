import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapEpisode, MapView } from '../shared/content-map'
import type { Slide } from '../shared/model'
import {
  dropSpot,
  extent,
  mapGroups,
  mapLayout,
  mapPages,
  newPages,
  QW
} from '../app/map-layout'
import { episodeChoices, moreChoices } from '../app/map-bar'
import type { MapCanvas, MapSel } from '../app/map-canvas'
import {
  copyCard,
  derivedBlock,
  laneHead,
  mapCard,
  mapNotes,
  segueCard
} from '../app/map-view'
const pageOf = (snapshot: Snapshot, index: number) => mapPages(snapshot)[index]

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
  posts: null
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
  it('keeps pages in the notebook’s order, numbered together, or by topic', () => {
    // A note's page sits where it was placed, not in a group of its own.
    expect(
      mapGroups(snapshot, 'order').map((g) => [g.label, g.slides])
    ).toEqual([['', ['a', 'b', 'c', 'd']]])
    expect(mapLayout(snapshot, null, 'order').groups).toEqual([])
    expect(mapCard(snapshot, null, pageOf(snapshot, 2), 3, false)).toContain(
      '· note'
    )
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
    expect(mapCard(snapshot, view, pageOf(snapshot, 0), 1, false)).toContain(
      '>E1</i>'
    )
    expect(mapCard(snapshot, view, pageOf(snapshot, 1), 2, false)).toMatch(
      /E1<\/i>.*E2<\/i>/
    )
    expect(mapCard(snapshot, view, pageOf(snapshot, 2), 3, false)).toContain(
      'unused'
    )
    expect(mapCard(snapshot, view, pageOf(snapshot, 3), 4, false)).toContain(
      'set aside'
    )
    expect(mapCard(snapshot, view, pageOf(snapshot, 4), 5, false)).toContain(
      'Ep 2 only'
    )
  })
  it('marks a copy whose original changed, and one used twice', () => {
    const [first, second] = view.episodes[0].copies
    expect(copyCard(view, view.episodes[0], second, 1, 2)).toContain(
      'source changed'
    )
    // Used twice: the other episode's chip, and the number stays.
    const twice = copyCard(
      view,
      view.episodes[1],
      view.episodes[1].copies[0],
      0,
      2
    )
    expect(twice).toContain('>E1</i>')
    expect(twice).toContain('class="map-num" style="--ep:#4f8fe0">1<')
    const made = copyCard(
      view,
      view.episodes[0],
      {
        ...first,
        scene: { made: true }
      } as typeof first,
      0,
      1
    )
    expect(made).toContain('>1<')
    expect(made).toContain('✓ made')
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
  it('offers Make before a video; once made, its place among the socials offers a teaser and posts', () => {
    expect(laneHead(view, view.episodes[0])).toContain(
      'data-map="open:e1">Make…<'
    )
    const made = {
      ...view.episodes[0],
      video: { scenes: 2, made: 2, joined: true }
    }
    expect(laneHead(view, made)).not.toContain('teaser:')
    const place = derivedBlock(view, made)
    expect(place).toContain('data-map="teaser:e1"')
    expect(place).toContain('data-map="posts:e1"')
  })
  it('puts the series under the map and the socials beside it, with lines between', () => {
    const made = {
      ...view.episodes[0],
      video: { scenes: 2, made: 2, joined: true }
    }
    const layout = mapLayout(
      map([slide('a'), slide('b')]),
      {
        ...view,
        episodes: [made, view.episodes[1]]
      },
      'order'
    )
    expect(layout.series!.y).toBeGreaterThan(layout.map.y + layout.map.h)
    expect(layout.socials!.x).toBeGreaterThan(
      layout.series!.x + layout.series!.w
    )
    // Only the made episode has a place, level with its lane.
    expect(layout.derived.map((place) => place.episode)).toEqual(['e1'])
    expect(layout.derived[0].y).toBe(layout.lanes.e1.y)
    expect(layout.flows.map((flow) => flow.key)).toEqual(['f:series', 'f:e1'])
  })
  it('lets a made episode’s teaser be watched and its posts read', () => {
    const cut = derivedBlock(view, {
      ...view.episodes[0],
      teasers: [
        {
          id: 't1',
          channel: 'x',
          aspect: '9:16',
          state: 'ready',
          objectKey: 'k/t.mp4'
        },
        { id: 't2', channel: 'x', aspect: '1:1', state: 'cutting' }
      ],
      posts: { x: 'On X', linkedin: 'On LinkedIn', youtube: 'On YouTube' }
    })
    expect(cut).toContain('href="/objects/k/t.mp4"')
    expect(cut).toContain('cutting…')
    expect(cut).toContain('data-map="read-posts:e1"')
  })
  it('keeps what is used less behind More, and says which episode has a page', () => {
    const at = (sel: MapSel) =>
      ({
        snapshot: map([slide('a'), slide('b')]),
        view,
        sel
      }) as unknown as MapCanvas
    const page = moreChoices(at({ t: 'page', id: 'a' }), 'page')
    expect(page.map((item) => item.action)).toEqual([
      'copy',
      'cut',
      'open-page',
      'aside',
      'delete-page'
    ])
    expect(page.at(-1)?.danger).toBe(true)
    expect(
      moreChoices(at({ t: 'lane', id: 'e1' }), 'lane').map(
        (item) => item.action
      )
    ).toEqual(['segues:e1', 'order:1', 'remove-episode'])
    expect(
      moreChoices(at({ t: 'lane', id: 'e2' }), 'lane').map(
        (item) => item.action
      )
    ).toEqual(['segues:e2', 'order:-1', 'remove-episode'])
    // Ep 1 has page a already: it says so and cannot be chosen.
    const to = episodeChoices(
      at({ t: 'page', id: 'a' }),
      'copy-to',
      undefined,
      'a'
    )
    expect(to.find((item) => item.action === 'copy-to:e1')).toMatchObject({
      disabled: true,
      note: 'has it'
    })
    expect(
      to.find((item) => item.action === 'copy-to:e2')?.disabled
    ).toBeUndefined()
    expect(to.at(-1)?.action).toBe('copy-to:new')
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
    expect(html).toContain('<b>adds to</b><span>p.1 · Page a')
    expect(html).toContain('More on a.')
    // A result shows its page on the map.
    expect(html).toContain('data-map="reveal:a"')
    expect(mapNotes(map([slide('a')]))).toContain('Add notes here any time')
  })
})

describe('the map while it forms', () => {
  it('shows every planned page by its title, filling in as each is drawn', () => {
    const snapshot: Snapshot = {
      ...map([
        { id: 'p1', title: 'Drawn', svg: '<svg></svg>' },
        { id: 'p2', title: 'Draft', svg: '<svg></svg>', draft: true }
      ]),
      status: 'building',
      plan: [
        { id: 'p1', title: 'Drawn', narration: '' },
        { id: 'p2', title: 'Draft', narration: '' },
        { id: 'p3', title: 'Being drawn', narration: '' },
        { id: 'p4', title: 'Planned', narration: '' }
      ],
      drawing: [2]
    }
    expect(mapPages(snapshot).map((p) => [p.id, p.state])).toEqual([
      ['p1', 'drawn'],
      ['p2', 'draft'],
      ['p3', 'drawing'],
      ['p4', 'planned']
    ])
    const layout = mapLayout(snapshot, null, 'order')
    expect(Object.keys(layout.cards)).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(mapCard(snapshot, null, mapPages(snapshot)[3], 4, false)).toContain(
      'planned'
    )
    expect(mapCard(snapshot, null, mapPages(snapshot)[2], 3, false)).toContain(
      'drawing…'
    )
    // A first draft being checked shows as drawn.
    expect(
      mapCard(snapshot, null, mapPages(snapshot)[1], 2, false)
    ).not.toContain('checking')
    // Once ready, the pages are the drawn ones.
    expect(mapPages({ ...snapshot, status: 'ready' }).map((p) => p.id)).toEqual(
      ['p1', 'p2']
    )
  })
})
