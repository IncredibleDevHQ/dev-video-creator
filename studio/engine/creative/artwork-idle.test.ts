import { expect, it } from 'vitest'
import { atRest, idleLoop, idlePrompt, withIdle } from './artwork-idle'

// A drawing as the product keeps it, and Quiver's animation of it: a loop
// on its lamps (one class on both), its ring (by id) and its needle (on the
// element itself), with a colour and a complex rule that are not kept.
const drawing = [
  '<svg viewBox="0 0 80 60">',
  '<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>',
  '<g id="lamps" data-part="lamps"><circle cx="10" cy="10" r="2"/><circle cx="16" cy="10" r="2"/></g>',
  '<g id="ring"><path d="M0 0h10"/></g>',
  '<g id="needle" data-part="needle"><path d="M5 5l4 4"/></g>',
  '</svg>'
].join('')
const animated = drawing
  .replace(
    '<svg viewBox="0 0 80 60">',
    `<svg viewBox="0 0 80 60"><style>
@keyframes blink { 0%, 100% { opacity: 1; fill: red } 50% { opacity: .3 } }
@keyframes breathe { 50% { transform: scale(1.04) } }
@keyframes tremble { 50% { transform: rotate(4deg) } }
.blink { animation: blink 1.5s steps(2) infinite; fill: red; }
#ring { transform-origin: 5px 0px; animation: breathe 3s ease-in-out infinite; }
.lamps circle:nth-child(2) { animation: blink 1s infinite; }
</style>`
  )
  .replace(/<circle /g, '<circle class="blink" ')
  .replace(
    '<g id="needle" data-part="needle">',
    '<g id="needle" data-part="needle" style="transform-origin: 5px 5px; animation: tremble 2s infinite">'
  )

it('asks for a quiet loop of the object’s own parts, motion only', () => {
  const prompt = idlePrompt('A rate limiter gauge.', [
    { id: 'needle', what: 'the gauge needle' }
  ])
  expect(prompt).toContain('drawing of A rate limiter gauge:')
  expect(prompt).toContain('the gauge needle')
  expect(prompt).toContain('Animate only opacity and transform, never colours')
})

it('takes the loop Quiver added: motion only, named for the object, finite', () => {
  const { loop, problem } = idleLoop(drawing, animated, 'gauge')
  expect(problem).toBeUndefined()
  expect(loop!.classes).toEqual([
    { index: 5, names: ['gauge-blink'] },
    { index: 6, names: ['gauge-blink'] },
    { index: 7, names: ['gauge-idle-7'] },
    { index: 9, names: ['gauge-idle-9-own'] }
  ])
  expect(loop!.css).toContain(
    '@keyframes gauge-blink { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }'
  )
  expect(loop!.css).toContain(
    '.gauge-blink { animation: gauge-blink 1.5s steps(2) 999; }'
  )
  // An id outranks a class, and a style on the element both: each rule
  // says its class as often as its rank.
  expect(loop!.css).toContain(
    '\n.gauge-idle-7.gauge-idle-7 { transform-origin: 5px 0px; animation: gauge-breathe 3s ease-in-out 999; }'
  )
  expect(loop!.css).toContain(
    '\n.gauge-idle-9-own.gauge-idle-9-own.gauge-idle-9-own { transform-origin: 5px 5px; animation: gauge-tremble 2s 999; }'
  )
  // Colours and rules it can't place are left out.
  expect(loop!.css).not.toContain('red')
  expect(loop!.css).not.toContain('nth-child')
})

it('refuses an animation that redrew the drawing, or moved nothing of it', () => {
  expect(
    idleLoop(drawing, animated.replace('</svg>', '<rect/></svg>'), 'gauge')
      .problem
  ).toBe('it added, removed or regrouped shapes')
  expect(idleLoop(drawing, drawing, 'gauge').problem).toBe(
    'it added no loop to the drawing’s parts'
  )
})

it('puts the loop around the parts it moves, so a pose or a move of the part still shows', () => {
  const { loop } = idleLoop(drawing, animated, 'gauge')
  const svg = withIdle(drawing, {
    ...loop!,
    // And a stop in a gradient, where no wrapper may go.
    classes: [...loop!.classes, { index: 3, names: ['gauge-glint'] }]
  })
  expect(svg).toContain(
    '<svg viewBox="0 0 80 60"><style data-idle-loop="">@keyframes gauge-'
  )
  expect(svg).toContain(
    '<g class="gauge-blink" data-idle=""><circle cx="10" cy="10" r="2"/></g><g class="gauge-blink" data-idle=""><circle cx="16" cy="10" r="2"/></g>'
  )
  expect(svg).toContain(
    '<g class="gauge-idle-7" data-idle=""><g id="ring"><path d="M0 0h10"/></g></g>'
  )
  expect(svg).toContain(
    '<g class="gauge-idle-9-own" data-idle=""><g id="needle" data-part="needle"><path d="M5 5l4 4"/></g></g>'
  )
  expect(svg).toContain('<stop offset="0" class="gauge-glint"/>')
})

it('takes a group the animation added around shapes, and wraps the same run in the drawing', () => {
  const terminal = [
    '<svg viewBox="0 0 80 60">',
    '<g id="screen"><path d="M1 1h4"/><path d="M1 3h4"/><path d="M1 5h4"/><rect x="6" y="5" width="1" height="1"/></g>',
    '</svg>'
  ].join('')
  // Quiver grouped the three lines to make them glow together, and made
  // the cursor blink on its own.
  const grouped = terminal
    .replace(
      '<svg viewBox="0 0 80 60">',
      '<svg viewBox="0 0 80 60"><style>@keyframes glow { 50% { opacity: .8 } } @keyframes blink { 50% { opacity: 0 } } .glow { animation: glow 3s infinite } .blink { animation: blink 1s infinite }</style>'
    )
    .replace(
      '<path d="M1 1h4"/><path d="M1 3h4"/><path d="M1 5h4"/>',
      '<g id="code-lines" class="glow"><path d="M1 1h4"/><path d="M1 3h4"/><path d="M1 5h4"/></g>'
    )
    .replace('<rect ', '<rect class="blink" ')
  const { loop, problem } = idleLoop(terminal, grouped, 'runaway')
  expect(problem).toBeUndefined()
  expect(loop!.classes).toEqual([
    { index: 2, last: 4, names: ['runaway-glow'] },
    { index: 5, names: ['runaway-blink'] }
  ])
  expect(withIdle(terminal, loop!)).toContain(
    '<g id="screen"><g class="runaway-glow" data-idle=""><path d="M1 1h4"/><path d="M1 3h4"/><path d="M1 5h4"/></g><g class="runaway-blink" data-idle=""><rect x="6" y="5" width="1" height="1"/></g></g>'
  )
  // A wrapper and the one element it starts with nest, outer outside.
  const nested = withIdle(terminal, {
    css: '',
    classes: [
      { index: 2, last: 4, names: ['outer'] },
      { index: 2, names: ['inner'] }
    ]
  })
  expect(nested).toContain(
    '<g class="outer" data-idle=""><g class="inner" data-idle=""><path d="M1 1h4"/></g><path d="M1 3h4"/>'
  )
})

it('keeps only safe CSS from the animation: no markup, loads or odd names', () => {
  const unsafe = drawing
    .replace(
      '<svg viewBox="0 0 80 60">',
      `<svg viewBox="0 0 80 60"><style>
@keyframes x&lt;y { 50% { opacity: .5 } }
@keyframes ok { 50%, 60%) { opacity: 0 } 70% { transform: rotate(2deg) url(#a) } to { opacity: .4 } }
.blink { animation: ok 1s infinite; transform-origin: 5px 5px; animation-delay: expression(alert(1)); transform-box: fill-box !important }
</style>`
    )
    .replace(/<circle /g, '<circle class="blink" ')
  expect(idleLoop(drawing, unsafe, 'gauge').loop!.css).toBe(
    [
      '@keyframes gauge-ok { to { opacity: .4; } }',
      '.gauge-blink { animation: gauge-ok 1s 999; transform-origin: 5px 5px; transform-box: fill-box !important; }'
    ].join('\n')
  )
  // Names take the object's in a form CSS can carry.
  expect(idleLoop(drawing, animated, 'Rate Limiter!').loop!.classes[0]).toEqual(
    { index: 5, names: ['rate-limiter-blink'] }
  )
})

it('keeps words whole: a loop inside a text goes on the element itself', () => {
  const label =
    '<svg viewBox="0 0 80 60"><text x="4" y="20"><tspan id="dot">•</tspan><tspan>Live</tspan></text></svg>'
  const pulsing = label
    .replace(
      '<svg viewBox="0 0 80 60">',
      '<svg viewBox="0 0 80 60"><style>@keyframes pulse { 50% { opacity: .2 } } .pulse { animation: pulse 2s infinite }</style>'
    )
    .replace('<tspan id="dot">', '<tspan id="dot" class="pulse">')
  const { loop, problem } = idleLoop(label, pulsing, 'badge')
  expect(problem).toBeUndefined()
  const svg = withIdle(label, loop!)
  expect(svg).toContain(
    '<text x="4" y="20"><tspan id="dot" class="badge-pulse">•</tspan><tspan>Live</tspan></text>'
  )
})

it('measures a drawing at rest: the loop’s style goes, its wrappers stay', () => {
  const { loop } = idleLoop(drawing, animated, 'gauge')
  const page = `<div data-artwork="gauge">${withIdle(drawing, loop!)}</div><style>.scene { opacity: 1 }</style>`
  const rest = atRest(page)
  expect(rest).not.toContain('@keyframes')
  expect(rest).toContain('<g class="gauge-blink" data-idle="">')
  expect(rest).toContain('<style>.scene { opacity: 1 }</style>')
})

it('leaves out what the browser would drop: open brackets, colour-only loops', () => {
  const loopWith = (css: string) =>
    drawing
      .replace(
        '<svg viewBox="0 0 80 60">',
        `<svg viewBox="0 0 80 60"><style>${css}</style>`
      )
      .replace(/<circle /g, '<circle class="blink" ')
  // An unclosed bracket would swallow the loop's later rules.
  expect(
    idleLoop(
      drawing,
      loopWith(
        '@keyframes b { 50% { opacity: .2 } } .blink { animation: b 1s steps(2 infinite }'
      ),
      'gauge'
    ).problem
  ).toBe('it added no loop to the drawing’s parts')
  // A loop that only changes colours moves nothing once colours are left out.
  expect(
    idleLoop(
      drawing,
      loopWith(
        '@keyframes tint { 50% { fill: red } } .blink { animation: tint 1s infinite }'
      ),
      'gauge'
    ).problem
  ).toBe('it added no loop to the drawing’s parts')
  // A name that starts with a digit is not a CSS name.
  expect(idleLoop(drawing, animated, '3D printer').loop!.classes[0]).toEqual({
    index: 5,
    names: ['art-3d-printer-blink']
  })
})

it('adds to a class however it is quoted, and finds the loop’s style however it is written', () => {
  const label =
    '<svg viewBox="0 0 80 60"><text x="4" y="20"><tspan id=\'dot\' class=\'q\'>•</tspan></text></svg>'
  const svg = withIdle(label, {
    css: '.badge-pulse { animation: badge-pulse 2s 999; }',
    classes: [{ index: 2, names: ['badge-pulse'] }]
  })
  expect(svg).toContain("<tspan id='dot' class='q badge-pulse'>")
  expect(atRest('<svg><STYLE  data-idle-loop >a{}</STYLE ><g/></svg>')).toBe(
    '<svg><g/></svg>'
  )
})

it('keeps the rules that tune a loop: lamps in turn, a duration set apart', () => {
  const inTurn = drawing
    .replace(
      '<svg viewBox="0 0 80 60">',
      '<svg viewBox="0 0 80 60"><style>@keyframes blink { 50% { opacity: .2 } } .blink { animation: blink 1s infinite } .lamp-2 { animation-delay: .5s }</style>'
    )
    .replace('<circle cx="10"', '<circle class="blink" cx="10"')
    .replace('<circle cx="16"', '<circle class="blink lamp-2" cx="16"')
  const { loop } = idleLoop(drawing, inTurn, 'gauge')
  expect(loop!.classes).toEqual([
    { index: 5, names: ['gauge-blink'] },
    { index: 6, names: ['gauge-blink', 'gauge-lamp-2'] }
  ])
  expect(loop!.css).toContain('.gauge-lamp-2 { animation-delay: .5s; }')
  // The name in one rule, its duration and count in another; a name that
  // holds “infinite” keeps it.
  const split = drawing.replace(
    '<svg viewBox="0 0 80 60">',
    '<svg viewBox="0 0 80 60"><style>@keyframes spin-infinite { to { transform: rotate(360deg) } } #needle { animation-name: spin-infinite } #needle { animation-duration: 3s; animation-iteration-count: infinite }</style>'
  )
  const css = idleLoop(drawing, split, 'gauge').loop!.css
  expect(css).toContain('@keyframes gauge-spin-infinite')
  expect(css).toContain(
    '\n.gauge-idle-9.gauge-idle-9 { animation-name: gauge-spin-infinite; }'
  )
  expect(css).toContain(
    '\n.gauge-idle-9.gauge-idle-9 { animation-duration: 3s; animation-iteration-count: 999; }'
  )
  // Names with no letters CSS can carry still differ.
  const scoped = (entity: string) =>
    idleLoop(drawing, animated, entity).loop!.classes[0].names[0]
  expect(scoped('数据库')).toMatch(/^drawing-[a-z0-9]+-blink$/)
  expect(scoped('数据库')).not.toBe(scoped('缓存'))
  // A bare class takes the loop's beside it.
  expect(
    withIdle(
      '<svg viewBox="0 0 8 8"><text><tspan class=q>•</tspan></text></svg>',
      {
        css: '',
        classes: [{ index: 2, names: ['badge-pulse'] }]
      }
    )
  ).toContain('<tspan class="q badge-pulse">')
})

it('keeps the animation’s order of rules: an id over a class, important over both', () => {
  // The fan turns in 3 s by its id; a class's slower duration loses to it,
  // as in the animation, unless it is important. In a keyframe an important
  // value is void, so it is left out.
  const fan = drawing.replace(
    '<svg viewBox="0 0 80 60">',
    '<svg viewBox="0 0 80 60"><style>@keyframes spin { 50% { opacity: .5 !important; transform: rotate(180deg) } } #needle { animation: spin 3s infinite } .slow { animation-duration: 6s } .slower { animation-delay: 1s !important }</style>'
  )
  const css = idleLoop(
    drawing,
    fan.replace('data-part="needle"', 'data-part="needle" class="slow slower"'),
    'gauge'
  ).loop!.css
  expect(css).toContain(
    '@keyframes gauge-spin { 50% { transform: rotate(180deg); } }'
  )
  expect(css).toContain(
    '\n.gauge-idle-9.gauge-idle-9 { animation: gauge-spin 3s 999; }'
  )
  expect(css).toContain('\n.gauge-slow { animation-duration: 6s; }')
  expect(css).toContain('\n.gauge-slower { animation-delay: 1s !important; }')
  // A block may even be called "important".
  const named = drawing.replace(
    '<svg viewBox="0 0 80 60">',
    '<svg viewBox="0 0 80 60"><style>@keyframes important { 50% { opacity: .2 } } #needle { animation: important 1s infinite; animation-delay: .5s !important }</style>'
  )
  expect(idleLoop(drawing, named, 'gauge').loop!.css).toContain(
    '{ animation: gauge-important 1s 999; animation-delay: .5s !important; }'
  )
  // Words that look like a class inside another attribute are not its class.
  expect(
    withIdle(
      '<svg viewBox="0 0 8 8"><text><tspan aria-label="see class=q here">•</tspan></text></svg>',
      { css: '', classes: [{ index: 2, names: ['badge-pulse'] }] }
    )
  ).toContain('<tspan aria-label="see class=q here" class="badge-pulse">')
})

it('renames only the blocks a rule plays: a pivot, a timing and a flag stay', () => {
  const loopWith = (css: string) =>
    drawing.replace(
      '<svg viewBox="0 0 80 60">',
      `<svg viewBox="0 0 80 60"><style>${css}</style>`
    )
  // A block called "center", played by name, beside a pivot at the centre
  // and a linear timing.
  const css = idleLoop(
    drawing,
    loopWith(
      '@keyframes center { 50% { opacity: .4 } } #needle { transform-origin: center; animation: center 2s linear infinite }'
    ),
    'gauge'
  ).loop!.css
  expect(css).toContain(
    '{ transform-origin: center; animation: gauge-center 2s linear 999; }'
  )
  // A block called "important" is no loop when the rule plays none.
  expect(
    idleLoop(
      drawing,
      loopWith(
        '@keyframes important { 50% { opacity: .4 } } #needle { animation: none !important }'
      ),
      'gauge'
    ).problem
  ).toBe('it added no loop to the drawing’s parts')
})
