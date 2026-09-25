import { describe, expect, it } from 'vitest'
import { controlValueProblems, validateProduction, withControlValues, type ProductionClock, type ProductionControl } from './production-bundle'
import type { SceneTreatmentV1 } from './scene-treatment'

// The controls a production exposes (P6): real parameters its code reads,
// whose ranges keep each nudged action inside its moment on the clock.
const plan = {
  moments: [
    { id: 'm1', title: 'Requests arrive', presenter: { visibility: 'hidden', reason: '' } },
    { id: 'm2', title: 'The limit bites', presenter: { visibility: 'hidden', reason: '' } },
  ],
  objects: [],
} as unknown as SceneTreatmentV1
const clock: ProductionClock = { kind: 'silent', audio: null, video: null, duration: 6, moments: [{ id: 'm1', start: 0, end: 3 }, { id: 'm2', start: 3, end: 6 }] }
const context = { scene: 's1', plan: { record: 'plan-1', revision: 1, content: plan }, compositionId: 'production-s1-r1', clock, assetKeys: [] }
const html = (reads: string) => `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script></head><body>
<div id="root" data-composition-id="production-s1-r1" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="m1" class="clip" data-start="0" data-duration="3" data-track-index="0"><div class="title" data-sketch-layer="titles">Requests arrive</div></div>
<div id="m2" class="clip" data-start="3" data-duration="3" data-track-index="0"><div class="title" data-sketch-layer="titles">The limit bites</div></div>
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.fromTo('#m1 .title', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0)
tl.fromTo('#m2 .title', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 3 + ${reads})
window.__timelines["production-s1-r1"] = tl</script></body></html>`
const manifest = (controls: unknown[]) => JSON.stringify({
  version: 1, kind: 'production', scene: 's1', plan: { record: 'plan-1', revision: 1 },
  composition: { id: 'production-s1-r1', width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' },
  clock: { kind: 'silent', audio: null }, moments: [{ id: 'm1', title: 'Requests arrive', start: 0, end: 3 }, { id: 'm2', title: 'The limit bites', start: 3, end: 6 }],
  layers: [{ id: 'titles', kind: 'text', label: 'Moment titles', moments: ['m1', 'm2'] }], unmet: [], controls,
})
const reveal: ProductionControl = { id: 'm2-reveal', label: 'When the limit bites', kind: 'offset', moment: 'm2', default: 0, min: 0, max: 2 }
const reads = '(window.__controls?.["m2-reveal"] ?? 0)'

describe('the controls a production exposes', () => {
  it('accepts an offset its code reads, whose range stays inside its moment', () => {
    const report = validateProduction({ 'index.html': html(reads), 'manifest.json': manifest([reveal]) }, context)
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('refuses a control the code never reads, a range that leaves its moment, and a hold', () => {
    const unread = validateProduction({ 'index.html': html('0'), 'manifest.json': manifest([reveal]) }, context)
    expect(unread.problems).toEqual(expect.arrayContaining([expect.stringMatching(/^control m2-reveal is not read by index.html/)]))
    const late = validateProduction({ 'index.html': html(reads), 'manifest.json': manifest([{ ...reveal, max: 3 }]) }, context)
    expect(late.problems).toEqual(expect.arrayContaining([expect.stringMatching(/^control m2-reveal must keep its action inside moment m2: min at least 0 and max at most 2.75s/)]))
    const early = validateProduction({ 'index.html': html(reads), 'manifest.json': manifest([{ ...reveal, min: -1 }]) }, context)
    expect(early.problems).toEqual(expect.arrayContaining([expect.stringMatching(/must keep its action inside moment m2/)]))
    const hold = validateProduction({ 'index.html': html(reads), 'manifest.json': manifest([{ ...reveal, kind: 'hold' }]) }, context)
    expect(hold.problems).toEqual(expect.arrayContaining([expect.stringMatching(/kind must be offset — a hold .* is a new production/)]))
    const twice = validateProduction({ 'index.html': html(reads), 'manifest.json': manifest([reveal, reveal]) }, context)
    expect(twice.problems).toEqual(expect.arrayContaining(['control id "m2-reveal" is used twice']))
  })

  it('takes a creator\'s values only inside each control\'s range', () => {
    expect(controlValueProblems([reveal], { 'm2-reveal': 1.5 })).toEqual([])
    expect(controlValueProblems([reveal], { 'm2-reveal': 2.5 })).toEqual(['When the limit bites must be between 0s and 2s — 2.5s would move it out of its moment'])
    expect(controlValueProblems([reveal], { other: 1 })).toEqual(['"other" is not a control of this production'])
    expect(controlValueProblems([reveal], { 'm2-reveal': Number.NaN })).toEqual(['When the limit bites must be a number of seconds'])
  })

  it('sets the values before any of the composition\'s scripts run', () => {
    const edited = withControlValues(html(reads), { 'm2-reveal': 1.5 })
    expect(edited.indexOf('window.__controls = {"m2-reveal":1.5}')).toBeGreaterThan(-1)
    expect(edited.indexOf('window.__controls = ')).toBeLessThan(edited.indexOf('/runtime/gsap.min.js'))
    expect(withControlValues('<div></div>', {})).toBe('<script>window.__controls = {}</script><div></div>')
  })
})

// A scene the creator presents (P5): the take's voice plays once, whole,
// from the start; its picture is muted and in step with the voice wherever
// it is shown — full frame, beside the graphics, or out of view.
describe('a production on the creator\'s take', () => {
  const presented = {
    moments: [
      { id: 'm1', title: 'On camera', presenter: { visibility: 'full', reason: '' } },
      { id: 'm2', title: 'The graphics', presenter: { visibility: 'hidden', reason: '' } },
    ],
    objects: [],
  } as unknown as SceneTreatmentV1
  const take: ProductionClock = { kind: 'take', audio: 'media/take.webm', video: 'media/take.webm', duration: 6, moments: [{ id: 'm1', start: 0, end: 3 }, { id: 'm2', start: 3, end: 6 }] }
  const onTake = { ...context, plan: { ...context.plan, content: presented }, clock: take }
  const page = (voice: string, picture: string) => `<!doctype html><html><head><meta charset="utf-8"><script src="/runtime/gsap.min.js"></script><script src="/runtime/hyperframes.iife.js"></script></head><body>
<div id="root" data-composition-id="production-s1-r1" data-start="0" data-width="1920" data-height="1080" data-duration="6">
<div id="presenter" data-sketch-layer="presenter">${picture}</div>
<div id="m2" class="clip" data-start="3" data-duration="3" data-track-index="1"><div class="title" data-sketch-layer="titles">The graphics</div></div>
${voice}
</div><script>window.__timelines = window.__timelines || {}
const tl = gsap.timeline({ paused: true })
tl.to('#presenter', { opacity: 0, duration: 0.4 }, 3)
window.__timelines["production-s1-r1"] = tl</script></body></html>`
  const voice = '<audio id="voice" src="media/take.webm" data-start="0" data-duration="6" data-track-index="20"></audio>'
  const picture = '<video src="media/take.webm" muted playsinline data-start="0" data-duration="6" data-track-index="10"></video>'
  const manifestOf = () => JSON.stringify({
    version: 1, kind: 'production', scene: 's1', plan: { record: 'plan-1', revision: 1 },
    composition: { id: 'production-s1-r1', width: 1920, height: 1080, fps: 30, duration: 6 }, runtime: { hyperframes: '0.7.106' },
    clock: { kind: 'take', audio: 'media/take.webm', video: 'media/take.webm' }, moments: [{ id: 'm1', title: 'On camera', start: 0, end: 3 }, { id: 'm2', title: 'The graphics', start: 3, end: 6 }],
    layers: [{ id: 'presenter', kind: 'presenter', label: 'You', moments: ['m1'] }, { id: 'titles', kind: 'text', label: 'Titles', moments: ['m2'] }], unmet: [],
  })
  const media = { 'media/take.webm': { base64: 'GkXfow==', contentType: 'video/webm' } }
  const check = (voiceTag: string, pictureTag: string) => validateProduction({ 'index.html': page(voiceTag, pictureTag), 'manifest.json': manifestOf(), ...media }, onTake).problems

  it('accepts one whole voice and a muted picture that keeps step with it', () => {
    expect(check(voice, picture)).toEqual([])
  })

  it('refuses a picture with its own sound, or out of step with the voice', () => {
    expect(check(voice, picture.replace(' muted', ''))).toEqual([expect.stringMatching(/^the take's picture "media\/take.webm" must be muted/)])
    expect(check(voice, picture.replace('data-start="0"', 'data-start="3"'))).toEqual([expect.stringMatching(/must stay in step with its voice: a clip that starts at 3s plays the take from 3s \(data-media-start\), not from 0s/)])
    expect(check(voice, picture.replace('data-start="0"', 'data-start="3" data-media-start="3"'))).toEqual([])
  })

  it('refuses a voice that is offset, cut short or played twice', () => {
    expect(check(voice.replace('data-start="0"', 'data-start="0" data-media-start="1.2"'), picture)).toEqual([expect.stringMatching(/must play from the scene's start/)])
    expect(check(voice.replace('data-duration="6"', 'data-duration="4"'), picture)).toEqual([expect.stringMatching(/must play whole: data-duration at least 6/)])
    expect(check(`${voice}${voice.replace('id="voice"', 'id="again"')}`, picture)).toEqual(['the clock\'s sound "media/take.webm" plays 2 times — play it once'])
  })
})
