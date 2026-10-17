import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { slotsIn, studioFigures } from './figures'
import { frameShapeProblems } from './frames'
import { presetDir } from './hyperframes'
import { poseProblems } from './stills'

const id = 'f06-a-real-probability'
const frame = (body: string, script = '') =>
  `<template><div id="${id}-root" data-composition-id="${id}"><style>#${id}-root .stat { width: 50%; }</style>${body}<script>window.__timelines["${id}"] = gsap.timeline({ paused: true });${script}</script></div></template>`

it('finds the slots the presets draw where a figure goes', () => {
  for (const [slot, html] of [
    ['NN%', '<div class="stat">NN%</div>'],
    ['+NN%', '<span>+NN%</span> growth'],
    ['N×', '<b>N×</b> faster'],
    ['{metric}', '<p>{metric}</p>'],
    ['— figure —', '<p>— figure —</p>'],
    ['↑ —', '<i>↑ —</i>'],
    ['NN JUN', '<time>NN JUN</time>'],
    ['N m', '<span>N m</span> long'],
    ['+N / −M', '<code>+N / −M</code>'],
    ['— %', '<p>— %</p>'],
    ['XX%', '<p>XX%</p>'],
    ['NN ms', '<p>NN ms</p>'],
    ['Lorem ipsum', '<p>Lorem ipsum dolor</p>'],
    ['NN%', '<p>NN&#37;</p>'],
    ['— figure —', '<p>&mdash; figure &mdash;</p>']
  ])
    expect(slotsIn(frame(html)), html).toEqual([slot])
  // A line a script types in is on screen too.
  expect(slotsIn(frame('<p id="n"></p>', 'n.textContent = "NN%";'))).toEqual([
    'NN%'
  ])
})

it('leaves real figures, code and chrome alone', () => {
  const real = frame(
    [
      '<div class="NN-card" id="f06-NN" data-label="NN%">92% <small>URGENT</small></div>',
      '<p>193.6× faster · 70–500 ms · 5–18× at Vercel · $0.042 · ↑ 12%</p>',
      '<p>An N×N matrix, top 10% of JSON, 01 / 05</p>',
      '<!-- NN% until the script supplies it -->'
    ].join(''),
    'const n = i % N; const s = `${metric}`; tl.set("#a", { x: 10 });'
  )
  expect(slotsIn(real)).toEqual([])
})

it('refuses a pose or a frame that shows a slot', () => {
  const good = frame('<div class="stat">92%</div>')
  const slot = frame('<div class="stat">NN%</div><p>{metric}</p>')
  expect(frameShapeProblems(good, id)).toEqual([])
  expect(poseProblems(good, id)).toEqual([])
  for (const problems of [frameShapeProblems(slot, id), poseProblems(slot, id)])
    expect(problems.join(' ')).toMatch(
      /placeholder where a figure goes \(“NN%”, “\{metric\}”\).*design that number out/
    )
})

it('gives every preset the studio’s rule on figures', () => {
  const presets = readdirSync(presetDir()).filter((name) =>
    readdirSync(join(presetDir(), name)).includes('FRAME.md')
  )
  expect(presets.length).toBeGreaterThan(10)
  const headings = (text: string) => text.match(/^## .*$/gm)
  for (const preset of presets) {
    const raw = readFileSync(join(presetDir(), preset, 'FRAME.md'), 'utf8')
    const ruled = studioFigures(raw)
    expect(ruled, preset).toMatch(/Nothing fills a slot later/)
    expect(ruled, preset).not.toMatch(/Render (?:data )?slots as/)
    expect(ruled, preset).not.toMatch(/carry placeholders/)
    expect(ruled, preset).not.toMatch(/else placeholder\./)
    expect(ruled, preset).toMatch(
      /^- \*\*Fabrication\*\* — .*designed out, never a placeholder\.$/m
    )
    expect(headings(ruled), preset).toEqual(headings(raw))
    expect(studioFigures(ruled), preset).toBe(ruled)
  }
})

it('adds the rule to a design without one', () => {
  const ruled = studioFigures('# Frame\n\n## Colors\n\nInk.\n')
  expect(ruled).toMatch(
    /^## Colors\n\nInk\.\n\n## Numerals & Claims \(hard rule\)\n[\s\S]*chrome\.\n$/m
  )
  expect(studioFigures(ruled)).toBe(ruled)
})
