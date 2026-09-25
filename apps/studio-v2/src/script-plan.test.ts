import { describe, expect, it } from 'vitest'
import { estimateSeconds, matchScore, parseScript, planFromScript, planFromWindows, scriptFromSteps, splitWindows, tokenSpread, tokens } from './script-plan'
import type { SlideUnit } from './slide-atoms'
import { boxOnStageAt, unitsOnScreenPerBeat } from './placements'

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
    // The script asked for this shot by name, so it is taken — and the rect
    // is the one the driver will crop to, which holds the number it framed.
    const camera = b4.actions.find(a => a.op === 'camera')!
    const shot = camera.value as Record<string, number>
    expect(shot.x).toBeLessThanOrEqual(700)
    expect(shot.y).toBeLessThanOrEqual(400)
    expect(shot.x + shot.width).toBeGreaterThanOrEqual(780)
    expect(shot.y + shot.height).toBeGreaterThanOrEqual(430)
    // Beat 5: nothing new, camera returns to the page, intent recap.
    expect(b5.actions.find(a => a.op === 'camera')!.implicit).toBe(true)
    // The closing line is the outro: beside the page, a transition.
    expect(b5.intent).toBe('transition')
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

describe('splitWindows', () => {
  it('splits paragraphs into sentences and clauses, keeping directions with their sentence', () => {
    const script = `The chain:\nBefore 2017 a model read one word at a time. Word four waits for word three — so the cost grows with length. [camera: sequential steps]\n\nAnd that was the price.`
    const sentences = splitWindows(script, 'sentence')
    expect(sentences.map(beat => beat.text)).toEqual([
      'Before 2017 a model read one word at a time.',
      'Word four waits for word three — so the cost grows with length.',
      'And that was the price.',
    ])
    expect(sentences[0].title).toBe('The chain')
    expect(sentences[1].directions).toEqual([{ kind: 'camera', args: 'sequential steps' }])
    const clauses = splitWindows(script, 'clause')
    expect(clauses.map(beat => beat.text)).toEqual([
      'Before 2017 a model read one word at a time.',
      'Word four waits for word three',
      'so the cost grows with length.',
      'And that was the price.',
    ])
    expect(splitWindows(script, 'paragraph')).toHaveLength(2)
  })

  it('paces the estimate by words per minute', () => {
    const script = 'One two three four five six seven eight nine ten eleven twelve.'
    expect(estimateSeconds(script, { granularity: 'sentence', wpm: 120 })).toBeGreaterThan(estimateSeconds(script, { granularity: 'sentence', wpm: 180 }))
  })
})

describe('planFromWindows', () => {
  it('uses the windows\' part ids, hero, camera and layout instead of matching words', () => {
    const windows = [
      { say: 'A model reads one word at a time.', parts: [], layout: 'me' as const },
      { say: 'Two boxes talk to each other.', parts: ['encoder', 'attention'], hero: 'attention' },
      { say: 'Then the answer comes out here.', parts: ['decoder'], hero: 'decoder', camera: ['decoder'] },
      { say: 'And that is the score.', parts: ['score'], hero: 'score', layout: 'beside' as const },
    ]
    const result = planFromWindows(windows, page(), { viewBox })!
    const [w1, w2, w3, w4] = result.plan.steps
    expect(w1.actions.filter(a => a.op === 'reveal')).toHaveLength(0)
    expect(w2.actions.find(a => a.op === 'reveal')!.targets).toEqual(['encoder', 'encoder-text', 'attention', 'attention-text'])
    expect(w2.hero).toEqual(['attention', 'attention-text'])
    const framed = w3.actions.find(a => a.op === 'camera')!.value as Record<string, number>
    expect(framed.x).toBeLessThanOrEqual(700)
    expect(framed.x + framed.width).toBeGreaterThanOrEqual(900)
    expect(framed.y).toBeLessThanOrEqual(200)
    expect(w4.actions.find(a => a.op === 'count')!.targets).toEqual(['score'])
    expect(result.windows[0].layout).toBe('me')
    expect(result.coverage.beats.map(beat => beat.anchored)).toEqual([true, true, true, true])
  })
})

// F11 of the Perplexity review: "Combine step → Output tokens" was declared
// "becomes", and the planner moved the combine station onto the output and
// morphed it away — the routes from the experts left pointing at nothing.
describe('a becomes relation', () => {
  const moe = (): SlideUnit[] => [
    unit('same', 'box', 'Same-node experts', [100, 150, 200, 80]),
    unit('other', 'box', 'Other-node experts', [100, 400, 200, 80]),
    unit('combine', 'box', 'Combine step', [450, 275, 200, 80]),
    unit('output', 'box', 'Output tokens', [800, 275, 200, 80]),
    unit('e1', 'connector', 'Connector #1', [300, 190, 150, 120], { from: { x: 300, y: 190 }, to: { x: 450, y: 300 }, verb: 'merges into', declared: { from: 'same', to: 'combine' } }),
    unit('e2', 'connector', 'Connector #2', [300, 330, 150, 110], { from: { x: 300, y: 440 }, to: { x: 450, y: 330 }, verb: 'merges into', declared: { from: 'other', to: 'combine' } }),
    unit('e3', 'connector', 'Connector #3', [650, 315, 150, 2], { from: { x: 650, y: 315 }, to: { x: 800, y: 315 }, verb: 'becomes', declared: { from: 'combine', to: 'output' } }),
  ]

  it('keeps a station in place and lets its result emerge from it', () => {
    const script = 'The same-node experts and the other-node experts send their results to the combine step.\n\nThe combine step becomes the output tokens.'
    const { plan } = planFromScript(script, moe(), { viewBox })!
    const actions = plan.steps.flatMap(step => step.actions)
    expect(actions.some(action => action.op === 'trace' && action.targets.includes('e3'))).toBe(true)
    const onCombine = actions.filter(action => action.targets.some(id => id === 'combine' || id === 'combine-text'))
    expect(onCombine.filter(action => action.op === 'move' || action.op === 'morph' || action.op === 'exit')).toEqual([])
    expect(actions.some(action => action.op === 'emphasize' && action.targets.includes('output'))).toBe(true)
    // The causal state at the end: the station still stands where it was,
    // on screen, with the output beside it — not in its place.
    const last = plan.steps.length - 1
    expect(boxOnStageAt(plan, moe(), last, 'combine')).toEqual({ x: 450, y: 275, width: 200, height: 80 })
    const onScreen = unitsOnScreenPerBeat(plan, moe(), viewBox)[last].map(unit => unit.id)
    expect(onScreen).toEqual(expect.arrayContaining(['combine', 'output', 'same', 'other', 'e1', 'e2', 'e3']))
  })

  it('still turns data into data', () => {
    const units = [
      unit('scores', 'box', 'Raw scores', [100, 300, 200, 80]),
      unit('weights', 'box', 'Attention weights', [600, 300, 200, 80]),
      unit('e', 'connector', 'softmax', [300, 340, 300, 2], { from: { x: 300, y: 340 }, to: { x: 600, y: 340 }, verb: 'becomes', declared: { from: 'scores', to: 'weights' } }),
    ]
    const { plan } = planFromScript('The raw scores become the attention weights.', units, { viewBox })!
    const actions = plan.steps.flatMap(step => step.actions)
    expect(actions.some(action => action.op === 'morph' && action.targets.includes('scores') && action.targets.includes('weights'))).toBe(true)
  })
})
