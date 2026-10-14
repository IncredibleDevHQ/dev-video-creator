import { expect, it } from 'vitest'
import { checkShots } from './shots'
import { frameShapeProblems, workerPacket } from './frames'
import { keepGreys, presetFor, tokensFor } from './workspace'
import { evenWords, frameWords } from './voice'
import { lookTimes } from './check'
import { frameId } from '../../shared/storyboard'

const frames = [
  {
    number: 4,
    duration: 5,
    voiceover:
      'First the snowball, then the hill, then the speed it gathers on the way.'
  }
]
const shot = (over: Record<string, unknown> = {}) => ({
  number: 4,
  blueprint: 'dataviz-countup (Adapt)',
  adapt: 'Keep the ring',
  focal: 'the snowball',
  roles: 'snowball = foreground subject',
  windows: [
    { from: 0, to: 2, text: 'The snowball enters' },
    { from: 2, to: 5, text: 'It rolls and holds' }
  ],
  ...over
})

it('accepts a shot paced across the frame with a known blueprint', () => {
  const report = checkShots({ frames: [shot()] }, frames, ['dataviz-countup'])
  expect(report.problems).toEqual([])
  expect(report.value[0].windows).toHaveLength(2)
})

it('refuses gaps, short shots, unknown blueprints and one-window long lines', () => {
  const report = checkShots(
    {
      frames: [
        shot({
          blueprint: 'nope (Adapt)',
          windows: [{ from: 0, to: 3, text: 'Everything at once' }]
        })
      ]
    },
    frames,
    ['dataviz-countup']
  )
  const text = report.problems.join(' | ')
  expect(text).toMatch(/nope is not a blueprint/)
  expect(text).toMatch(/end at 3 s; the frame runs 5 s/)
  expect(text).toMatch(/more than one window/)
  expect(
    checkShots(
      { frames: [shot({ blueprint: 'compose', adapt: '' })] },
      frames,
      []
    ).problems
  ).toEqual([])
  expect(
    checkShots({ frames: [shot({ adapt: '' })] }, frames, [
      'dataviz-countup'
    ]).problems.join()
  ).toMatch(/an Adapt says/)
})

it('checks a frame’s shape before Hyperframes runs', () => {
  const id = frameId({ number: 3, title: 'How it compounds!' })
  expect(id).toBe('f03-how-it-compounds')
  const good = `<template><div id="root" data-composition-id="${id}"><script>window.__timelines["${id}"] = gsap.timeline({ paused: true })</script></div></template>`
  expect(frameShapeProblems(good, id)).toEqual([])
  expect(
    frameShapeProblems(`<!doctype html>${good}<audio src="x">`, id).join(' ')
  ).toMatch(/template.*<audio>/s)
})

it('points a worker packet at its own folder', () => {
  const packet =
    '# Frame packet: f01\n\n## Project inputs\n\n- Project: /abs/project\n- Design tokens: production/frame.md\n- RULES_DIR: /abs/rules\n'
  expect(workerPacket(packet)).toMatch(/- Project: production\n/)
  expect(workerPacket(packet)).toMatch(
    /- RULES_DIR: \.claude\/skills\/storyboard-master\/.*\/rules\n/
  )
})

it('carries the look into build-frame by the job each colour does', () => {
  const branding = {
    name: '',
    tagline: '',
    accent: '#5eb0ff',
    useAccent: true,
    palette: { ground: '#15181d', text: '#eef1f4', secondary: '#93a0ae' },
    fonts: { display: 'Inter', body: 'Inter', mono: 'ui-monospace' },
    logoKey: null,
    look: { id: 'ink', name: 'Ink' }
  }
  expect(presetFor(branding)).toBe('code-editorial')
  expect(
    presetFor({
      ...branding,
      look: { id: 'saved:x', name: 'x' },
      palette: { ...branding.palette, ground: '#fefefe' }
    })
  ).toBe('blue-professional')
  const tokens = tokensFor('T', 'D', branding)
  expect(tokens.colorStats[0]).toMatchObject({ hex: '#15181d', areaBg: 1000 })
  expect(tokens.fonts).toEqual([{ family: 'Inter' }])
})

it('times words for captions, from the aligner or spread evenly', () => {
  expect(evenWords('a b', 1)).toEqual([
    { id: 'w0', text: 'a', start: 0, end: 0.5 },
    { id: 'w1', text: 'b', start: 0.5, end: 1 }
  ])
  const line = (words: Array<[string, number, number]>) => ({
    id: '2',
    say: 'x',
    coverage: 1,
    startMs: 0,
    durationMs: 0,
    review: null,
    words: words.map(([word, startMs, endMs]) => ({ word, startMs, endMs }))
  })
  // Heard words keep their times inside the frame's clip, which starts 3 s in.
  expect(
    frameWords(
      'hello there',
      line([
        ['hello', 3200, 3600],
        ['there', 3600, 4000]
      ]),
      3,
      2
    )
  ).toEqual([
    { id: 'w0', text: 'hello', start: 0.2, end: 0.6 },
    { id: 'w1', text: 'there', start: 0.6, end: 1 }
  ])
  // A missed word shares the gap; a dash is no word; a word heard in the
  // next frame's clip is not this frame's.
  const words = frameWords(
    'run a custom video pipeline —',
    line([
      ['run', 0, 200],
      ['a', 200, 300],
      ['video', 700, 1000],
      ['pipeline', 1000, 1500],
      ['—', 5400, 5500]
    ]),
    0,
    2
  )
  expect(words.map((word) => word.text)).toEqual([
    'run',
    'a',
    'custom',
    'video',
    'pipeline'
  ])
  expect(words[2]).toMatchObject({ start: 0.3, end: 0.7 })
  expect(words.every((word) => word.end <= 2)).toBe(true)
  // Too little heard: the line is spread evenly.
  expect(frameWords('one two three', line([]), 0, 3, 0)).toEqual(
    evenWords('one two three', 3)
  )
  expect(lookTimes(4)).toEqual([0.8, 2.2, 3.75])
})

it('keeps a preset grey grey when the remix paints it a brand colour', () => {
  const preset = 'colors:\n  bg: "#fdfae7"\n  text-muted: "#6b6b6b"\nradii:\n'
  const made = 'colors:\n  bg: "#ffffff"\n  text-muted: "#99ffe4"\nradii:\n'
  expect(keepGreys(made, preset)).toBe(
    'colors:\n  bg: "#ffffff"\n  text-muted: "#6b6b6b"\nradii:\n'
  )
  // On a dark brand ground the grey is mirrored.
  const dark = 'colors:\n  bg: "#101010"\n  text-muted: "#99ffe4"\nradii:\n'
  expect(keepGreys(dark, preset)).toContain('text-muted: "#949494"')
  // A grey that stayed grey is left alone.
  const fine = 'colors:\n  bg: "#ffffff"\n  text-muted: "#6a6a6c"\nradii:\n'
  expect(keepGreys(fine, preset)).toBe(fine)
})
