import { describe, expect, it } from 'vitest'
import { lengthBriefFor, briefVerdict } from './length-brief'
import type { SlideUnit } from './slide-atoms'

const unit = (id: string, kind: SlideUnit['kind'], label: string, [x, y, w, h]: number[], extra: Partial<SlideUnit> = {}): SlideUnit =>
  ({ id, ids: [id], kind, label, bbox: { x, y, width: w, height: h }, chrome: false, children: [], ...extra }) as SlideUnit
const viewBox = { width: 1280, height: 720 }

const title = (): SlideUnit[] => [unit('t', 'label', 'Attention Is All You Need', [200, 300, 880, 90]), unit('f', 'label', 'SHEET 01 / 15', [1000, 680, 200, 20], { chrome: true })]
const diagram = (): SlideUnit[] => [
  {
    ...unit('enc', 'group', 'Encoder', [90, 180, 240, 300]),
    children: [
      unit('e1', 'box', 'Input Embedding', [100, 400, 200, 40]),
      unit('e2', 'box', 'Multi-Head Attention', [100, 330, 200, 40]),
      unit('e3', 'box', 'Add & Norm', [100, 270, 200, 40]),
      unit('e4', 'box', 'Feed Forward', [100, 210, 200, 40]),
    ],
  },
  {
    ...unit('dec', 'group', 'Decoder', [400, 120, 240, 360]),
    children: [
      unit('d1', 'box', 'Output Embedding', [410, 400, 200, 40]),
      unit('d2', 'box', 'Masked Multi-Head Attention', [410, 330, 200, 40]),
      unit('d3', 'box', 'Multi-Head Attention', [410, 270, 200, 40]),
      unit('d4', 'box', 'Feed Forward', [410, 210, 200, 40]),
      unit('d5', 'box', 'Linear', [410, 150, 200, 40]),
    ],
  },
  unit('a1', 'connector', 'Connector #1', [200, 300, 2, 30], { from: { x: 200, y: 330 }, to: { x: 200, y: 300 } }),
  unit('a2', 'connector', 'Connector #2', [300, 290, 100, 2], { from: { x: 300, y: 290 }, to: { x: 400, y: 290 } }),
  unit('a3', 'connector', 'Connector #3', [510, 240, 2, 30], { from: { x: 510, y: 270 }, to: { x: 510, y: 240 } }),
  unit('n1', 'label', 'd_model = 512, one width for every sub-layer output', [700, 200, 400, 24]),
  unit('n2', 'label', 'h = 8 heads, each a 64-wide subspace of the model', [700, 260, 400, 24]),
  unit('cap', 'label', 'INPUTS', [180, 460, 60, 12]),
  unit('foot', 'label', 'AIAYN · 2017', [1000, 680, 200, 20], { chrome: true }),
]
const list = (): SlideUnit[] => [
  unit('h', 'label', 'What this drawing set covers', [80, 80, 700, 40]),
  ...[1, 2, 3, 4, 5].map(n => unit(`r${n}`, 'box', `${n === 1 ? 'The bottleneck' : n === 2 ? 'The architecture' : n === 3 ? 'Attention step by step' : n === 4 ? 'Training and results' : 'Legacy'} — a line about it`, [120, 140 + n * 80, 900, 50])),
]

describe('length brief', () => {
  it('lands a title card in a few seconds and two windows', () => {
    const brief = lengthBriefFor(title(), viewBox, { arcRole: 'hook' })
    expect(brief.kind).toBe('title')
    expect(brief.seconds).toBeGreaterThanOrEqual(8)
    expect(brief.seconds).toBeLessThanOrEqual(14)
    expect(brief.windows).toBe(2)
    expect(brief.coverage.find(entry => entry.id === 'f')?.treatment).toBe('skip')
  })

  it('gives a diagram the time its boxes, arrows and notes cost, walked group by group', () => {
    const brief = lengthBriefFor(diagram(), viewBox, { arcRole: 'explain' })
    expect(brief.kind).toBe('diagram')
    expect(brief.seconds).toBeGreaterThan(50)
    expect(brief.windows).toBeGreaterThanOrEqual(7)
    expect(brief.outline[0].label).toBe('Overview')
    expect(brief.outline.map(stretch => stretch.label)).toEqual(expect.arrayContaining(['Encoder', 'Decoder', 'Takeaway']))
    expect(brief.coverage.find(entry => entry.id === 'a1')?.treatment).toBe('passing')
    expect(brief.coverage.find(entry => entry.id === 'cap')?.treatment).toBe('passing')
    expect(brief.coverage.find(entry => entry.id === 'e2')?.treatment).toBe('walk')
    expect(brief.why).toMatch(/boxes and 3 arrows/)
  })

  it('walks a list row by row and scales with depth and role', () => {
    const walk = lengthBriefFor(list(), viewBox, { arcRole: 'map' })
    const skim = lengthBriefFor(list(), viewBox, { arcRole: 'map', depth: 'skim' })
    const deep = lengthBriefFor(list(), viewBox, { arcRole: 'map', depth: 'deep' })
    expect(walk.kind).toBe('list')
    expect(skim.seconds).toBeLessThan(walk.seconds)
    expect(deep.seconds).toBeGreaterThan(walk.seconds)
    expect(walk.windows).toBeGreaterThanOrEqual(5)
    const hook = lengthBriefFor(list(), viewBox, { arcRole: 'hook' })
    expect(hook.seconds).toBeLessThan(walk.seconds)
  })

  it('calls a draft thin under sixty percent of the brief', () => {
    const brief = { seconds: 60, range: [48, 72] as [number, number] }
    expect(briefVerdict(brief, 20)).toBe('thin')
    expect(briefVerdict(brief, 55)).toBe('fits')
    expect(briefVerdict(brief, 100)).toBe('long')
    expect(briefVerdict(brief, 0)).toBe('none')
  })
})
