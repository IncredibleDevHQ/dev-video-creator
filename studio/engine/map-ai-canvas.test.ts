import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../shared/api'
import type { MapView } from '../shared/content-map'
import {
  Aliases,
  canvasText,
  heldWords,
  targetWords
} from '../app/map-ai-canvas'

const snapshot = (): Snapshot => ({
  project: {
    id: 'map',
    title: 'Streamline',
    source: '',
    slides: [
      { id: 'p1', title: 'Why pipelines fail', svg: null },
      {
        id: 'p2',
        title: 'Deploy it to your account',
        svg: null,
        fromNote: 'n1'
      },
      { id: 'p3', title: 'Old benchmark', svg: null, aside: true }
    ],
    video: null
  },
  status: 'ready',
  error: null,
  events: []
})
const copy = (id: string, page: string, title: string) => ({
  id,
  title,
  copyOf: { notebook: 'map', slide: page, hash: 'h' },
  stale: false,
  orphan: false
})
const view = (): MapView => ({
  notebook: 'map',
  title: 'Streamline',
  series: {
    id: 's',
    title: 'Streamline in three',
    organize: true,
    outcome: 'Ship a pipeline',
    suggested: ['outcome'],
    directions: [
      {
        id: 'dir-a',
        text: 'Security before deploying',
        at: '',
        to: { episode: 'ep-2' }
      },
      {
        id: 'dir-b',
        text: 'Keep it light',
        at: '',
        answer: { state: 'partly', why: 'Ep 3 is dense', at: '' }
      }
    ],
    lines: [],
    gaps: [
      {
        id: 'gap-1',
        missing: 'IAM roles',
        episode: 'ep-2',
        why: 'Deploying needs them',
        ask: 'Which roles?',
        state: 'open'
      },
      { id: 'gap-2', missing: 'Costs', why: 'x', ask: 'y', state: 'ignored' }
    ],
    flags: [],
    left: [],
    held: []
  },
  episodes: [
    {
      notebook: 'ep-1',
      number: 1,
      title: 'Why it breaks',
      status: 'ready',
      made: true,
      outline: {
        win: 'Spot a failing stage',
        teaches: [],
        needs: [],
        lines: []
      },
      copies: [copy('c-1', 'p1', 'Why pipelines fail')],
      video: null,
      teasers: [],
      posts: null
    },
    {
      notebook: 'ep-2',
      number: 2,
      title: 'Ship it',
      status: 'ready',
      made: false,
      copies: [copy('c-2', 'p2', 'Deploy it to your account')],
      video: null,
      teasers: [],
      posts: null
    }
  ],
  usage: { p1: ['ep-1'], p2: ['ep-2'] },
  comments: [
    {
      id: 'k-1',
      at: '',
      by: 'creator',
      text: 'The intro drags',
      target: { kind: 'lane', id: 'ep-2' },
      state: 'open',
      kind: 'direction',
      replies: [{ id: 'r', at: '', by: 'ai', text: 'Shall I cut it?' }]
    },
    {
      id: 'k-2',
      at: '',
      by: 'creator',
      text: 'Done',
      target: { kind: 'series' },
      state: 'resolved',
      replies: []
    }
  ]
})

describe('the canvas as Studio AI reads it', () => {
  it('names each thing with a short id that stays for the call', () => {
    const aliases = new Aliases()
    const text = canvasText(snapshot(), view(), aliases, 'Ep 2 “Ship it” (e2)')
    expect(text).toContain('c1 “Why pipelines fail” — in Ep 1')
    expect(text).toContain(
      'c2 “Deploy it to your account” — in Ep 2 (from a note)'
    )
    expect(text).toContain('c3 “Old benchmark” — set aside')
    expect(text).toContain(
      'By the end a viewer can: “Ship a pipeline” (suggested by the plan)'
    )
    expect(text).toContain('For: not set')
    expect(text).toContain(
      'e1 = Ep 1 “Why it breaks” (video started: the plan keeps it)'
    )
    expect(text).toContain('  A viewer can then: “Spot a failing stage”')
    expect(text).toContain('  Cards: c2 “Deploy it to your account”')
    expect(text).toContain('d1 “Security before deploying” — guides Ep 2')
    expect(text).toContain(
      'd2 “Keep it light” — guides the whole series; the last plan partly followed it'
    )
    expect(text).toContain('g1 missing “IAM roles” in Ep 2')
    expect(text).not.toContain('Costs')
    expect(text).toContain(
      'k1 on Ep 2 “Ship it”, by the creator: “The intro drags” [direction] · 1 reply'
    )
    expect(text).not.toContain('“Done”')
    expect(text).toContain('The creator has selected Ep 2 “Ship it” (e2)')
    // A new card later keeps every earlier id.
    const later = snapshot()
    later.project.slides.unshift({ id: 'p0', title: 'A newer card', svg: null })
    const again = canvasText(later, view(), aliases)
    expect(again).toContain('c1 “Why pipelines fail”')
    expect(again).toContain('c4 “A newer card”')
  })

  it('finds what an id stands for, and says when it is not there', () => {
    const aliases = new Aliases()
    canvasText(snapshot(), view(), aliases)
    expect(aliases.need('E2', 'e')).toBe('ep-2')
    expect(aliases.find('c2', 'e')).toBeNull()
    expect(() => aliases.need('c9', 'c')).toThrow(
      'There is no card c9 on the canvas'
    )
    expect(() => aliases.need(undefined, 'd')).toThrow(
      'There is no direction (none given)'
    )
  })

  it('says what a comment is pinned to', () => {
    expect(targetWords({ kind: 'page', id: 'p2' }, snapshot(), view())).toBe(
      'card “Deploy it to your account”'
    )
    expect(targetWords({ kind: 'copy', id: 'c-1' }, snapshot(), view())).toBe(
      '“Why pipelines fail” in Ep 1'
    )
    expect(targetWords({ kind: 'spot', x: 1, y: 2 }, snapshot(), view())).toBe(
      'the canvas'
    )
    expect(
      canvasText(snapshot(), { ...view(), series: null }, new Aliases())
    ).toContain('No series yet: plan_series starts one from the cards.')
  })

  it('says why a change was held without repeating the creator’s words', () => {
    expect(
      heldWords(
        'Jev read “I wonder if it fits.” as talk about the episodes, not a request to change the canvas. Answer it, or ask'
      )
    ).toBe(
      'Heard as talk about the episodes, not a request to change the canvas'
    )
    expect(
      heldWords(
        'The creator has not said yes to this yet: say what will change and ask'
      )
    ).toBe(
      'The creator has not said yes to this yet: say what will change and ask'
    )
  })
})
