import { describe, expect, it } from 'vitest'
import { matchScore, parseScript, planFromScript, scriptFromSteps, tokenSpread, tokens } from './script-plan'
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

// Encoder → Attention → Decoder, a score label, and a title (chrome).
const page = (): SlideUnit[] => [
  unit('title', 'label', 'The machine', [40, 20, 400, 40], { chrome: true }),
  unit('encoder', 'box', 'Encoder', [100, 200, 200, 100]),
  unit('attention', 'box', 'Attention block', [400, 200, 200, 100]),
  unit('decoder', 'box', 'Decoder', [700, 200, 200, 100]),
  unit('arrow1', 'connector', 'Connector #1', [300, 250, 100, 2], { from: { x: 300, y: 250 }, to: { x: 400, y: 250 } }),
  unit('arrow2', 'connector', 'Connector #2', [600, 250, 100, 2], { from: { x: 600, y: 250 }, to: { x: 700, y: 250 } }),
  unit('score', 'label', '28.4', [700, 400, 80, 30]),
  unit('note', 'label', 'WMT14 test set', [700, 440, 200, 20]),
]
const viewBox = { width: 1280, height: 720 }

describe('parseScript', () => {
  it('splits paragraphs into beats, lifts titles and directions', () => {
    const beats = parseScript(`The setup:\nBefore 2017 a model read one word at a time. [open on me]\n\n**The chain**\nThe encoder hands the attention block a full sentence. [hero: attention block]\n\nAnd the decoder answers.`)
    expect(beats).toHaveLength(3)
    expect(beats[0]).toMatchObject({ title: 'The setup', directions: [{ kind: 'open' }] })
    expect(beats[0].text).toBe('Before 2017 a model read one word at a time.')
    expect(beats[1]).toMatchObject({ title: 'The chain', directions: [{ kind: 'hero', args: 'attention block' }] })
    expect(beats[2].title).toBe('And the decoder answers')
  })
})

describe('matchScore', () => {
  it('weighs words by rarity: one shared word is not a match, one rare word is', () => {
    const spread = tokenSpread(['Training loss', 'Training steps', 'Training data', 'Within one training example, the paper says'])
    const words = new Set(tokens('time was the one thing training could not buy'))
    expect(matchScore('Within one training example, the paper says', words, spread)).toBeLessThan(0.5)
    expect(matchScore('Encoder', new Set(tokens('the encoder reads')), spread)).toBe(1)
  })

  it('matches labels by distinctive words and numbers, never generic labels', () => {
    const words = new Set(tokens('the encoder hands the attention block a sentence, scoring 28.4'))
    expect(matchScore('Encoder', words)).toBeGreaterThanOrEqual(0.6)
    expect(matchScore('Attention block', words)).toBe(1)
    expect(matchScore('Decoder', words)).toBe(0)
    expect(matchScore('28.4', words)).toBeGreaterThanOrEqual(0.6)
    expect(matchScore('Connector #1', words)).toBe(0)
    expect(matchScore('Shape', words)).toBe(0)
  })
})

describe('planFromScript', () => {
  const script = `Before 2017 a model read a sentence one word at a time. [open on me]

The encoder reads the whole sentence at once and hands it to the attention block.

The decoder answers, one token at a time, looking back through attention.

The score: 28.4 BLEU — better than anything before it, at a fraction of the training cost. [camera: 28.4]

That is the whole machine.`

  it('brings units in when first spoken, traces connectors after their boxes, counts numbers', () => {
    const result = planFromScript(script, page(), { viewBox })!
    expect(result).not.toBeNull()
    const [b1, b2, b3, b4, b5] = result.plan.steps
    // Beat 1 names nothing: on the presenter, nothing enters.
    expect(b1.actions.filter(a => a.op === 'reveal')).toHaveLength(0)
    // Beat 2: encoder + attention enter, the arrow between them traces after.
    const reveal = b2.actions.find(a => a.op === 'reveal')!
    expect(reveal.targets).toEqual(['encoder', 'encoder-text', 'attention', 'attention-text'])
    const trace = b2.actions.find(a => a.op === 'trace')!
    expect(trace.targets).toEqual(['arrow1'])
    expect(trace.startMs).toBeGreaterThan(0)
    expect(b2.intent).toBe('flow')
    // Beat 3: decoder enters, arrow2 traces, attention (re-mentioned) pops.
    expect(b3.actions.find(a => a.op === 'reveal')!.targets).toEqual(['decoder', 'decoder-text'])
    expect(b3.actions.find(a => a.op === 'trace')!.targets).toEqual(['arrow2'])
    expect(b3.actions.find(a => a.op === 'emphasize')!.targets).toEqual(['attention', 'attention-text'])
    // Beat 4: the number counts and the camera moves in on it.
    expect(b4.actions.find(a => a.op === 'count')!.targets).toEqual(['score'])
    const camera = b4.actions.find(a => a.op === 'camera')!
    expect(camera.value).toMatchObject({ x: 700, y: 400 })
    // Beat 5: nothing new, camera returns to the page, intent recap.
    expect(b5.actions.find(a => a.op === 'camera')!.implicit).toBe(true)
    expect(b5.intent).toBe('recap')
    // The unnamed caption follows its neighbour (the score) into beat 4, so
    // the beat both counts and reveals — its V1 verb is reveal.
    expect(b4.actions.find(a => a.op === 'reveal')!.targets).toEqual(['note'])
    expect(result.steps.map(step => step.verb)).toEqual(['reveal', 'trace', 'trace', 'reveal', 'reveal'])
  })

  it('reports coverage: anchored beats, neighbourhood placements, unresolved directions', () => {
    const result = planFromScript(`${script}\n\nAnd this bit names nothing. [hero: gearbox]`, page(), { viewBox })!
    expect(result.coverage.beats.map(beat => beat.anchored)).toEqual([true, true, true, true, false, false])
    expect(result.coverage.inferredUnits).toEqual(['WMT14 test set'])
    expect(result.coverage.unresolvedDirections).toEqual(['[hero: gearbox]'])
    expect(result.coverage.score).toBeCloseTo(4 / 6, 2)
  })

  it('falls back to page order when the script names nothing, with zero coverage', () => {
    const result = planFromScript('One.\n\nTwo.\n\nThree.', page(), { viewBox })!
    expect(result.coverage.score).toBe(0)
    const entering = result.plan.steps.map(step => step.actions.filter(a => a.op === 'reveal' || a.op === 'trace' || a.op === 'count').flatMap(a => a.targets))
    expect(entering.flat().length).toBeGreaterThan(0)
    expect(entering.every(list => list.length > 0)).toBe(true)
  })

  it('dims the rest on a focus beat and lifts it on the next', () => {
    const result = planFromScript(`The encoder, the attention block and the decoder.\n\nLook at the attention block alone.\n\nNow the whole machine again.`, page(), { viewBox })!
    const [, focus, after] = result.plan.steps
    const dim = focus.actions.find(a => a.op === 'dim')!
    expect(dim.targets).toContain('encoder')
    expect(dim.targets).not.toContain('attention')
    expect(after.actions.find(a => a.op === 'undim')!.targets).toContain('encoder')
  })

  it('synthesizes a connect for two named units without an arrow', () => {
    const result = planFromScript(`The encoder and the decoder. [connect: encoder -> decoder]`, page(), { viewBox })!
    const connect = result.plan.steps[0].actions.find(a => a.op === 'connect')!
    expect(connect.ports).toEqual({ from: 'encoder', to: 'decoder' })
  })
})

describe('scriptFromSteps', () => {
  it('turns beats back into a script', () => {
    expect(scriptFromSteps([{ title: 'Why', explanation: 'Because it works.' }, { title: 'It works', explanation: 'It works.' }])).toBe('Why:\nBecause it works.\n\nIt works.')
  })
})
