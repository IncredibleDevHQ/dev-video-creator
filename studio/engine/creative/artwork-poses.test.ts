import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { pathForm, posedDrawing, rgba, svgElements } from './artwork-poses'

// A drawing as Quiver draws one, cleaned: a ring painted by a gradient and a
// needle the plan names as a part.
const gauge = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 74 58" fill="none">',
  '<defs><linearGradient id="g-ring"><stop stop-color="#2A47B9" offset="0"/><stop stop-color="#ADC5FA" offset="1"/></linearGradient></defs>',
  '<g id="ring" data-part="ring"><path d="M10 10c1 2 3 4 5 6z" fill="url(#g-ring)"/></g>',
  '<g id="needle" data-part="needle"><path d="M28 26l5-4" stroke="#232F5A" stroke-width="1.2"/></g>',
  '</svg>'
].join('')
// The pose Quiver drew from it: the stops warmed, the needle turned about
// its pivot, an id added on the way. Every shape is still there.
const atLimit = gauge
  .replace('<stop stop-color="#2A47B9"', '<stop id="s1" stop-color="#C82D18"')
  .replace('stop-color="#ADC5FA"', 'stop-color="#FFA26B"')
  .replace(
    '<g id="needle" data-part="needle">',
    '<g id="needle" data-part="needle" transform="rotate(55 28.9 26.14)">'
  )

const poseOf = (svg: string, id: string, pose: string) => {
  const doc = parseHTML(`<div>${svg}</div>`).document
  const raw = doc.querySelector(`#${id}`)?.getAttribute(`data-pose-${pose}`)
  return raw ? JSON.parse(raw) : null
}

it('reads colours, transforms and path data in the forms a tween reads', () => {
  expect(rgba('#2A47B9')).toBe('rgba(42,71,185,1)')
  expect(rgba('#fff8')).toBe('rgba(255,255,255,0.5333)')
  expect(rgba('rgb(10 20 30 / 50%)')).toBe('rgba(10,20,30,0.5)')
  expect(rgba('Orange')).toBe('rgba(255,165,0,1)')
  expect(rgba('url(#g)')).toBeNull()
  // Every number apart, so a tween pairs them one for one.
  expect(pathForm('M0 0c1 2 3 4 5 6z')).toEqual({
    text: 'M 0 0 c 1 2 3 4 5 6 z',
    shape: 'M # # c # # # # # # z'
  })
  expect(pathForm('m41.48 11.48-4.147-.5')?.text).toBe(
    'm 41.48 11.48 -4.147 -0.5'
  )
  // Arc flags are kept as they are, and run together as drawings write them.
  expect(pathForm('M0 0a5 5 0 0110 10')).toEqual({
    text: 'M 0 0 a 5 5 0 0 1 10 10',
    shape: 'M # # a # # # 0 1 # #'
  })
  expect(pathForm('M0 0 X1 2')).toBeNull()
  expect(svgElements(gauge).map((element) => element.tag)).toEqual([
    'svg',
    'defs',
    'linearGradient',
    'stop',
    'stop',
    'g',
    'path',
    'g',
    'path'
  ])
})

it('puts a pose’s values on the shapes it changes, at rest in the same form', () => {
  const { svg, poses } = posedDrawing(gauge, [{ id: 'limit', svg: atLimit }])
  expect(poses).toEqual([
    {
      id: 'limit',
      problems: [],
      smooth: true,
      // The stops paint the ring, so the ring changes with them.
      parts: ['ring', 'needle'],
      shapes: 3
    }
  ])
  // The needle states its turn of 0 about the same pivot, so the tween turns it.
  expect(svg).toContain(
    '<g id="needle" data-part="needle" transform="rotate(0 28.9 26.14)" data-posed=""'
  )
  expect(poseOf(svg, 'needle', 'limit')).toEqual({
    attr: { transform: 'rotate(55 28.9 26.14)' }
  })
  // Colours are stated as rgba() at rest and in the pose.
  expect(svg).toContain('<stop stop-color="rgba(42,71,185,1)" offset="0"')
  const stop = parseHTML(`<div>${svg}</div>`).document.querySelector('stop')!
  expect(JSON.parse(stop.getAttribute('data-pose-limit')!)).toEqual({
    attr: { 'stop-color': 'rgba(200,45,24,1)' }
  })
  // The id the pose added is not taken: the drawing keeps its own.
  expect(svg).not.toContain('id="s1"')
  // Shapes the pose leaves alone are untouched.
  expect(svg).toContain('<path d="M10 10c1 2 3 4 5 6z" fill="url(#g-ring)"/>')
})

it('tweens a path point for point, and sets one whose commands changed halfway', () => {
  const moved = gauge.replace('d="M28 26l5-4"', 'd="M28 26l7-1"')
  const redrawn = gauge.replace('d="M28 26l5-4"', 'd="M28 26c1 1 2 2 7-1"')
  const { svg, poses } = posedDrawing(gauge, [
    { id: 'moved', svg: moved },
    { id: 'redrawn', svg: redrawn }
  ])
  const doc = parseHTML(`<div>${svg}</div>`).document
  const path = doc.querySelector('#needle path')!
  expect(path.getAttribute('d')).toBe('M 28 26 l 5 -4')
  expect(JSON.parse(path.getAttribute('data-pose-moved')!)).toEqual({
    attr: { d: 'M 28 26 l 7 -1' }
  })
  expect(JSON.parse(path.getAttribute('data-pose-redrawn')!)).toEqual({
    snap: { d: 'M28 26c1 1 2 2 7-1' }
  })
  expect(poses.map((pose) => [pose.id, pose.smooth])).toEqual([
    ['moved', true],
    ['redrawn', false]
  ])
})

it('turns transforms of different kinds into matrices that tween', () => {
  const turned = gauge.replace(
    '<g id="needle" data-part="needle">',
    '<g id="needle" data-part="needle" transform="rotate(90)">'
  )
  const shifted = gauge.replace(
    '<g id="needle" data-part="needle">',
    '<g id="needle" data-part="needle" transform="translate(4 2)">'
  )
  const { svg } = posedDrawing(gauge, [
    { id: 'turned', svg: turned },
    { id: 'shifted', svg: shifted }
  ])
  expect(svg).toContain('transform="matrix(1 0 0 1 0 0)"')
  expect(poseOf(svg, 'needle', 'turned')).toEqual({
    attr: { transform: 'matrix(0 1 -1 0 0 0)' }
  })
  expect(poseOf(svg, 'needle', 'shifted')).toEqual({
    attr: { transform: 'matrix(1 0 0 1 4 2)' }
  })
})

it('refuses a pose that redrew the drawing instead of changing it', () => {
  const problems = (svg: string) =>
    posedDrawing(gauge, [{ id: 'p', svg }]).poses[0].problems
  expect(
    problems(gauge.replace('</svg>', '<circle cx="1" cy="1" r="1"/></svg>'))
  ).toEqual([
    'it has 10 elements where the drawing has 9: it added or removed shapes'
  ])
  expect(
    problems(gauge.replace('<path d="M28 26l5-4"', '<line x1="28"'))
  ).toEqual([
    'its element 9 is a <line> where the drawing has a <path>: it reordered or regrouped shapes'
  ])
  expect(problems(gauge.replace('0 0 74 58', '0 0 80 60'))).toEqual([
    'it changed the viewBox'
  ])
  expect(problems(gauge)).toEqual(['it looks the same as the drawing'])
  // A refused pose leaves the drawing as drawn.
  expect(
    posedDrawing(gauge, [{ id: 'p', svg: gauge.replace('0 0 74', '0 0 99') }])
      .svg
  ).toBe(gauge)
})

it('follows ids a pose renamed back to the drawing’s own', () => {
  const renamed = atLimit
    .replace('id="g-ring"', 'id="ring-paint"')
    .replace('url(#g-ring)', 'url(#ring-paint)')
  const { svg, poses } = posedDrawing(gauge, [{ id: 'limit', svg: renamed }])
  expect(poses[0].problems).toEqual([])
  // The ring still paints with the drawing's gradient.
  expect(svg).toContain('fill="url(#g-ring)"')
  expect(svg).not.toContain('ring-paint')
})

it('tweens inline styles as styles', () => {
  const styled = gauge.replace(
    'stroke="#232F5A"',
    'stroke="#232F5A" style="opacity:.4;fill:#000"'
  )
  const lit = styled.replace('opacity:.4;fill:#000', 'opacity:1;fill:#f80')
  const { svg } = posedDrawing(styled, [{ id: 'lit', svg: lit }])
  const path = parseHTML(`<div>${svg}</div>`).document.querySelector(
    '#needle path'
  )!
  expect(JSON.parse(path.getAttribute('data-pose-lit')!)).toEqual({
    style: { opacity: '1', fill: '#f80' }
  })
})

it('plays a pose on the timeline and back, from the values at rest', () => {
  const two = gauge.replace(
    '<g id="ring" data-part="ring">',
    '<g id="ring" data-part="ring" opacity=".5">'
  )
  const { svg } = posedDrawing(two, [
    {
      id: 'limit',
      svg: atLimit.replace('<g id="ring"', '<g opacity=".5" id="ring"')
    },
    { id: 'glow', svg: two.replace('opacity=".5"', 'opacity="1"') }
  ])
  const { window, document } = parseHTML(
    `<html><body><div data-artwork="gauge">${svg}</div></body></html>`
  )
  new Function(
    'window',
    'document',
    readFileSync(new URL('./pose-player.js', import.meta.url), 'utf8')
  )(window, document)
  const calls: unknown[] = []
  const pops: Array<Record<string, unknown>> = []
  const tl = {
    to: (element: Element, vars: Record<string, unknown>, at: number) =>
      element.localName === 'svg'
        ? pops.push({ ...vars, at })
        : calls.push([
            'to',
            element.id || element.localName,
            vars.attr,
            at,
            vars.ease,
            vars.duration
          ]),
    set: (element: Element, vars: Record<string, unknown>, at: number) =>
      calls.push(['set', element.id || element.localName, vars.attr, at]),
    duration: () => 4
  }
  const play = (window as unknown as Record<string, Function>).artworkPose
  play(tl, 'gauge', 'glow', 1, 0.6)
  // A pose is a whole state: what it does not change goes to rest. The
  // change runs through the shapes in turn, each later one shorter so the
  // last arrives within the 0.6 s asked for, and the turning needle
  // overshoots and settles.
  const each = expect.closeTo(0.45, 6)
  expect(calls).toEqual([
    [
      'to',
      'stop',
      { 'stop-color': 'rgba(42,71,185,1)' },
      1,
      'power2.inOut',
      each
    ],
    [
      'to',
      'stop',
      { 'stop-color': 'rgba(173,197,250,1)' },
      1.05,
      'power2.inOut',
      each
    ],
    ['to', 'ring', { opacity: '1' }, 1.1, 'power2.inOut', each],
    [
      'to',
      'needle',
      { transform: 'rotate(0 28.9 26.14)' },
      1.15,
      'back.out(1.7)',
      each
    ]
  ])
  // The drawing pops as it arrives, from the scale the scene gave it, and
  // settles back to it.
  expect(pops).toEqual([
    expect.objectContaining({
      at: 1 + 0.6 * 0.6,
      duration: 0.15,
      yoyo: true,
      repeat: 1
    })
  ])
  ;(window as unknown as Record<string, unknown>).gsap = {
    getProperty: (_: Element, axis: string) => (axis === 'scaleX' ? 0.5 : 2)
  }
  const art = document.querySelector('svg')
  expect((pops[0].scaleX as Function)(0, art)).toBeCloseTo(0.52)
  expect((pops[0].scaleY as Function)(0, art)).toBeCloseTo(2.08)
  pops.length = 0
  calls.length = 0
  play(tl, 'gauge', 'limit', 2)
  // By default it takes 0.8 s, the last shape arriving at 2.8.
  expect(calls).toContainEqual([
    'to',
    'needle',
    { transform: 'rotate(55 28.9 26.14)' },
    2.15,
    'back.out(1.7)',
    expect.closeTo(0.65, 6)
  ])
  expect(calls).toContainEqual([
    'to',
    'ring',
    { opacity: '0.5' },
    2.1,
    'power2.inOut',
    expect.closeTo(0.65, 6)
  ])
  // Back to rest: no pop.
  pops.length = 0
  play(tl, 'gauge', 'rest', 3)
  expect(pops).toEqual([])
  // Nothing placed, nothing played.
  expect(play(tl, 'nothing', 'limit', 0)).toBe(tl)
})
