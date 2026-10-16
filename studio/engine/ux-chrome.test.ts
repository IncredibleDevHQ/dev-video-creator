import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import type { MapCanvas } from '../app/map-canvas'
import { detailFor, noteCount, viewChoices } from '../app/map-chrome'
import { mapTools } from '../app/map-view'
import { tipParts } from '../app/tooltip'

const snapshot = (extra: Partial<Snapshot['project']> = {}): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    slides: [],
    video: null,
    ...extra
  },
  status: 'ready',
  error: null,
  events: []
})
const series = { id: 's', title: 'Streamline' } as NonNullable<
  MapView['series']
>
const view = (withSeries: boolean) =>
  ({
    notebook: 'map',
    title: 'Streamline',
    series: withSeries ? series : null,
    episodes: [],
    usage: {}
  }) as MapView
const note = (state: 'sorting' | 'sorted') => ({
  id: state,
  at: '',
  text: 'x',
  state
})

describe('the quiet chrome around the map', () => {
  it('shows less fine print the further out the canvas is', () => {
    expect(detailFor(1)).toBe('near')
    expect(detailFor(0.62)).toBe('near')
    expect(detailFor(0.5)).toBe('far')
    expect(detailFor(0.36)).toBe('far')
    expect(detailFor(0.3)).toBe('farthest')
  })

  it('keeps arranging and filtering behind one View button', () => {
    const tools = mapTools(snapshot(), view(true), 'order', 'all')
    expect(tools).toContain('data-map="view-menu"')
    expect(tools).toContain('By order')
    expect(tools).not.toContain('map-seg')
    expect(tools).not.toContain('map-chip')
    expect(tools).toContain('data-map="new-episode"')
    const filtered = mapTools(snapshot(), view(true), 'topic', 'unused')
    expect(filtered).toContain('By topic · unused')
    expect(filtered).toContain('is-filtered')
    expect(mapTools(snapshot(), view(false), 'order', 'all')).toContain(
      'data-map="start-series"'
    )
    expect(
      mapTools({ ...snapshot(), status: 'building' }, null, 'order', 'all')
    ).toBe('')
  })

  it('offers only the choices that apply, with the current ones ticked', () => {
    const map = {
      mode: 'order',
      filter: 'all',
      snapshot: snapshot({ notes: [note('sorted')] }),
      view: view(true)
    } as unknown as MapCanvas
    const items = viewChoices(map)
    expect(items.map((item) => item.action)).toEqual([
      'mode:order',
      'mode:topic',
      'filter:all',
      'filter:unused',
      'filter:new'
    ])
    expect(
      items.filter((item) => item.note === '✓').map((i) => i.action)
    ).toEqual(['mode:order', 'filter:all'])
    const bare = viewChoices({
      ...map,
      mode: 'topic',
      snapshot: snapshot({ grouping: { state: 'grouping' } }),
      view: view(false)
    } as unknown as MapCanvas)
    expect(bare.map((item) => item.action)).toEqual([
      'mode:order',
      'mode:topic',
      'filter:all',
      'group'
    ])
    expect(bare.at(-1)).toMatchObject({ disabled: true })
  })

  it('counts the notes, and says when one is being sorted', () => {
    const count = (notes: ReturnType<typeof note>[]) =>
      noteCount({ snapshot: snapshot({ notes }) } as unknown as MapCanvas)
    expect(count([])).toBe('')
    expect(count([note('sorted'), note('sorted')])).toBe('2')
    expect(count([note('sorting')])).toContain('map-note-busy')
  })
})

describe('the tooltip', () => {
  it('sets a trailing shortcut apart from the words', () => {
    expect(tipParts('Comment · C: say it or type it')).toEqual({
      text: 'Comment: say it or type it',
      keys: 'C'
    })
    expect(tipParts('Notes · N')).toEqual({ text: 'Notes', keys: 'N' })
    expect(tipParts('Hide the interface · ⌘\\')).toEqual({
      text: 'Hide the interface',
      keys: '⌘\\'
    })
    expect(
      tipParts('Fit everything · double-click a block to zoom to it')
    ).toEqual({
      text: 'Fit everything · double-click a block to zoom to it',
      keys: ''
    })
    expect(tipParts('Settings')).toEqual({ text: 'Settings', keys: '' })
  })
})
