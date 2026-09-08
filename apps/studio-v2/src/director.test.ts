import { describe, expect, it } from 'vitest'
import { direct, legibilityFor } from './director'
import { planFromScript } from './script-plan'
import type { SlideUnit } from './slide-atoms'

const unit = (id: string, kind: SlideUnit['kind'], label: string, bbox: [number, number, number, number], extra: Partial<SlideUnit> = {}): SlideUnit => ({
  id,
  ids: kind === 'box' ? [id, `${id}-text`] : [id],
  kind,
  label,
  bbox: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] },
  chrome: false,
  children: [],
  ...extra,
})
const viewBox = { width: 1280, height: 720 }

const diagram = (): SlideUnit[] => [
  unit('encoder', 'box', 'Encoder', [100, 200, 200, 60]),
  unit('attention', 'box', 'Attention block', [400, 200, 200, 60]),
  unit('decoder', 'box', 'Decoder', [700, 200, 200, 60]),
  unit('arrow1', 'connector', 'Connector #1', [300, 230, 100, 2], { from: { x: 300, y: 230 }, to: { x: 400, y: 230 } }),
  unit('arrow2', 'connector', 'Connector #2', [600, 230, 100, 2], { from: { x: 600, y: 230 }, to: { x: 700, y: 230 } }),
  unit('arrow3', 'connector', 'Connector #3', [500, 260, 2, 100], { from: { x: 500, y: 260 }, to: { x: 500, y: 360 } }),
]
const titleCard = (): SlideUnit[] => [unit('t', 'label', 'Attention Is All You Need', [200, 300, 880, 90])]

describe('director', () => {
  it('measures legibility per required-area class', () => {
    const legibility = legibilityFor(diagram(), viewBox)
    // 60-unit boxes → 27 px text on the page; scaled to 1920 * share / 1280.
    expect(legibility.minTextPx.takeover).toBeCloseTo(27 * 1.5 * 0.94, 0)
    expect(legibility.minTextPx.slot).toBeLessThan(legibility.gatePx)
    expect(legibility.minTextPx.beside).toBeGreaterThan(legibility.gatePx)
  })

  it('hands a traced diagram the frame, opens on the person, comes back for the close', () => {
    const script = `Before 2017, order was everything. [open on me]\n\nThe encoder reads the sentence, the attention block relates every word, the decoder writes.\n\nThe wait was the price.`
    const planned = planFromScript(script, diagram(), { viewBox })!
    const result = direct({ title: 'The machine', units: diagram(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 2, count: 10 } })
    expect(result.kind).toBe('diagram')
    expect(result.arcRole).toBe('build')
    expect(result.requiredArea).toBe('takeover')
    // Opens on you, hands to the page, closes beside it, then you alone.
    expect(result.storyboard.map(entry => entry.family)).toEqual(['speaker-full', 'content-pip', 'speaker-panel', 'speaker-full'])
    expect(result.storyboard[0].label).toBe('Open')
    expect(result.storyboard[2].label).toBe('Outro')
    expect(result.cues.some(cue => cue.startsWith('Hand the frame'))).toBe(true)
    expect(result.cues.some(cue => cue.startsWith('Back to you'))).toBe(true)
    expect(result.brief.layout).toBe('content-pip')
  })

  it('keeps a title card behind the person and calls the first scene the hook', () => {
    const planned = planFromScript(`In 2017 a team at Google removed recurrence entirely.\n\nIt is called Attention Is All You Need.`, titleCard(), { viewBox })!
    const result = direct({ title: 'Cover', units: titleCard(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 0, count: 15 } })
    expect(result.kind).toBe('title')
    expect(result.arcRole).toBe('hook')
    expect(result.requiredArea).toBe('none')
    expect(result.storyboard.every(entry => entry.family === 'speaker-full')).toBe(true)
    // The title card stays behind you through the outro.
    expect(result.storyboard.some(entry => entry.treatment === 'overlay')).toBe(true)
    expect(result.storyboard.slice(-1)[0].label).toBe('Lead into the next scene')
  })

  it('respects [panel] and [takeover] directions', () => {
    const planned = planFromScript(`The encoder and the decoder. [panel]`, diagram(), { viewBox })!
    const result = direct({ title: 'x', units: diagram(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 3, count: 10 } })
    expect(result.requiredArea).toBe('beside')
    expect(result.storyboard[0].family).toBe('speaker-panel')
  })
})

describe('outro', () => {
  it('closes a scene beside the page, then alone, when the last window is a closing line', () => {
    const script = `The encoder reads the sentence and the attention block relates every word.\n\nThe decoder writes the answer.\n\nAnd that is the whole machine — next, why it was so much faster.`
    const planned = planFromScript(script, diagram(), { viewBox })!
    const result = direct({ title: 'Machine', units: diagram(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 4, count: 15 } })
    const tail = result.storyboard.slice(-2)
    expect(tail.map(entry => entry.family)).toEqual(['speaker-panel', 'speaker-full'])
    expect(tail[0].label).toBe('Outro')
    expect(tail[0].fromEndMs).toBeUndefined()
    expect(tail[1].fromEndMs).toBeGreaterThan(0)
    expect(result.cues.some(cue => cue.startsWith('Outro: turn to camera'))).toBe(true)
    expect(planned.windows[2].layout).toBe('beside')
  })

  it('cuts the outro into the last beat when no closing line was written, and skips the last scene', () => {
    const script = `The encoder reads the sentence.\n\nThe attention block relates every word and the decoder writes.`
    const planned = planFromScript(script, diagram(), { viewBox })!
    const result = direct({ title: 'Machine', units: diagram(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 4, count: 15 } })
    const tail = result.storyboard.slice(-2)
    expect(tail.map(entry => entry.family)).toEqual(['speaker-panel', 'speaker-full'])
    expect(tail[0].fromEndMs).toBeGreaterThan(tail[1].fromEndMs!)
    expect(result.cues.some(cue => cue.includes('write an outro line'))).toBe(true)
    const last = direct({ title: 'Machine', units: diagram(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 14, count: 15 } })
    expect(last.storyboard.some(entry => entry.label === 'Outro')).toBe(false)
  })
})

describe('layout options', () => {
  it('scores every family per beat with a reason, and the pick leads', () => {
    const planned = planFromScript(`Here is the encoder. [panel]\n\nThe attention block bridges to the decoder.`, diagram(), { viewBox })!
    const result = direct({ title: 'x', units: diagram(), viewBox, beats: planned.beats, plan: planned.plan, position: { index: 3, count: 10 } })
    expect(result.layoutOptions).toHaveLength(planned.beats.length)
    const first = result.layoutOptions[0]
    expect(first[0].family).toBe('speaker-panel')
    expect(first.map(option => option.family)).toEqual(expect.arrayContaining(['speaker-lead', 'content-lead', 'content-pip', 'speaker-full']))
    expect(first.every(option => option.why.length > 0)).toBe(true)
    expect(first.every((option, index) => index === 0 || option.score <= first[index - 1].score)).toBe(true)
    expect(result.storyboard[0].why).toBeTruthy()
  })

  it('prefers a light layout for a light beat and the frame for a traced one', () => {
    const light: SlideUnit[] = [
      unit('a', 'box', 'One term', [100, 100, 300, 60]),
      unit('b', 'box', 'Its meaning in a line', [100, 200, 500, 60]),
      unit('c', 'box', 'An example', [100, 300, 400, 60]),
    ]
    const planned = planFromScript(`One term, its meaning in a line, and an example.`, light, { viewBox })!
    const result = direct({ title: 'x', units: light, viewBox, beats: planned.beats, plan: planned.plan, position: { index: 3, count: 10 } })
    const pick = result.layoutOptions[0][0]
    expect(['speaker-lead', 'speaker-panel', 'speaker-full']).toContain(pick.family)
    expect(pick.textPx).toBeGreaterThanOrEqual(18)
  })
})
