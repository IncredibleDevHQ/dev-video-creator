// Sketches for the moves particular stories make: a face-off and a scoring
// matrix for decisions, a flame graph and a diff for performance work, a
// traffic cutover for migrations, an attack path for advisories, a paper's
// figure, the suspects of a bug hunt, a build log's weeks, a then-and-now
// wipe and a decision tree.
import {
  bar,
  box,
  drawn,
  group,
  label,
  motion as m,
  path,
  person,
  rect,
  svg,
  tick,
  traveller
} from './template-sketch-kit'

type Sketch = () => string
let serial = 0

const strike = (x: number, y: number, w: number, t: number) =>
  drawn(`M${x} ${y}L${x + w} ${y}`, 'sk-sbad', t, 0.4)

export const STORY_SKETCHES: Record<string, Sketch> = {
  versus: () => {
    const side = (x: number, name: string, scores: number[], win: boolean) =>
      rect(x, 16, 140, 148, 'sk-card', 12) +
      label(x + 70, 40, name, 'sk-mid') +
      scores
        .map(
          (score, i) =>
            bar(x + 16, 62 + i * 26, 108, 'sk-ink3', 9) +
            group(
              `sk-tl ${m.grow(0.8 + i * 0.8, 0.6)}`,
              bar(
                x + 16,
                62 + i * 26,
                score,
                i % 2 === Number(win) ? 'sk-ink2' : 'sk-acc',
                9
              )
            )
        )
        .join('') +
      (win
        ? group(
            `sk-tb ${m.pop(3.6)}`,
            rect(x + 36, 136, 68, 20, 'sk-ok', 10) +
              label(x + 70, 150, 'WINNER', 'sk-white')
          )
        : '')
    return svg(
      side(12, 'REST', [92, 60, 70], false) +
        side(168, 'gRPC', [64, 100, 96], true) +
        group(
          `sk-tb ${m.pop(0.4)}`,
          '<circle cx="160" cy="90" r="17" class="sk-acc"/>' +
            label(160, 94, 'VS', 'sk-white')
        )
    )
  },
  matrix: () => {
    const rows = ['Latency', 'Cost', 'Ops load']
    const cols = ['Queue', 'Bucket', 'Shed']
    const marks = [
      'sk-warn',
      'sk-ok',
      'sk-bad',
      'sk-ok',
      'sk-ok',
      'sk-warn',
      'sk-bad',
      'sk-ok',
      'sk-ok'
    ]
    return svg(
      rect(12, 16, 296, 148, 'sk-card', 12) +
        cols
          .map((name, c) => label(150 + c * 64, 40, name, 'sk-label'))
          .join('') +
        rows
          .map(
            (name, r) =>
              label(28, 70 + r * 30, name, 'sk-label', 'start') +
              cols
                .map((_, c) =>
                  group(
                    `sk-tb ${m.pop(0.5 + (r * 3 + c) * 0.22)}`,
                    `<circle cx="${150 + c * 64}" cy="${66 + r * 30}" r="7" class="${marks[r * 3 + c]}"/>`
                  )
                )
                .join('')
          )
          .join('') +
        group(m.fade(3), rect(186, 26, 56, 128, 'sk-sacc', 10)) +
        group(
          `sk-tb ${m.pop(3.4)}`,
          rect(186, 140, 56, 18, 'sk-acc', 9) +
            label(214, 152, 'CHOSEN', 'sk-white')
        )
    )
  },
  flame: () => {
    const row = (y: number, parts: Array<[number, number, string]>) =>
      parts.map(([x, w, cls]) => rect(x, y, w, 18, cls, 3)).join('')
    return svg(
      row(138, [[20, 280, 'sk-ink3']]) +
        row(116, [
          [20, 90, 'sk-ink3'],
          [112, 188, 'sk-ink3']
        ]) +
        row(94, [
          [20, 60, 'sk-ink3'],
          [112, 40, 'sk-ink3']
        ]) +
        group(
          m.until(3),
          rect(154, 94, 146, 18, 'sk-bad', 3) +
            label(227, 106, 'serialize() · 46%', 'sk-white')
        ) +
        group(
          m.fade(3.2),
          rect(154, 94, 52, 18, 'sk-ok', 3) + label(180, 106, '9%', 'sk-white')
        ) +
        group(
          `sk-tb ${m.pop(3.8)}`,
          rect(220, 52, 80, 26, 'sk-acc', 13) +
            label(260, 69, '−38% CPU', 'sk-white')
        ) +
        label(300, 40, 'CPU profile, checkout', 'sk-label', 'end')
    )
  },
  diff: () => {
    const line = (y: number, cls: string, sign: string, w: number, t: number) =>
      group(
        m.fade(t),
        rect(22, y - 10, 276, 15, cls, 3, 'opacity=".2"') +
          label(32, y, sign, 'sk-mono') +
          bar(46, y - 6, w, 'sk-ink2', 6)
      )
    return svg(
      rect(12, 14, 296, 152, 'sk-card', 10) +
        label(296, 32, 'retry.ts', 'sk-label', 'end') +
        line(56, 'sk-bad', '−', 180, 0.5) +
        line(74, 'sk-bad', '−', 140, 0.8) +
        line(92, 'sk-bad', '−', 200, 1.1) +
        line(114, 'sk-ok', '+', 150, 1.8) +
        line(132, 'sk-ok', '+', 110, 2.1) +
        group(
          `sk-tb ${m.pop(3)}`,
          rect(222, 142, 76, 20, 'sk-ink', 10) +
            label(260, 156, '+12  −40', 'sk-chip-text')
        )
    )
  },
  traffic: () =>
    svg(
      box(18, 70, 64, 40, 'Traffic') +
        box(222, 30, 80, 40, 'Old') +
        box(222, 112, 80, 40, 'New', 'sk-card') +
        path('M82 90C150 90 150 50 222 50M82 90C150 90 150 132 222 132') +
        [0.3, 1.1]
          .map((t) =>
            traveller('M82 90C150 90 150 50 222 50', t, t + 1.2, 'sk-ink2', 4)
          )
          .join('') +
        [2.8, 3.6, 4.4]
          .map((t) =>
            traveller('M82 90C150 90 150 132 222 132', t, t + 1.2, 'sk-acc', 4)
          )
          .join('') +
        rect(30, 160, 260, 8, 'sk-ink3', 4) +
        group(`sk-tl ${m.grow(2.4, 2.4)}`, rect(30, 160, 260, 8, 'sk-acc', 4)) +
        group(m.during(0, 2.4), label(160, 152, 'old 100%', 'sk-small')) +
        group(m.fade(4.8), label(160, 152, 'new 100%', 'sk-small'))
    ),
  progress: () =>
    svg(
      path('M30 150H296M30 150V24') +
        drawn(
          'M30 146C80 144 100 120 140 104S220 60 290 30',
          'sk-sacc',
          0.4,
          3
        ) +
        (
          [
            [96, 128, 'Reads', 1.2],
            [176, 84, 'Writes', 2.2],
            [282, 32, 'Old DB off', 3.4]
          ] as Array<[number, number, string, number]>
        )
          .map(([x, y, text, t]) =>
            group(
              `sk-tb ${m.pop(t)}`,
              `<circle cx="${x}" cy="${y}" r="5" class="sk-acc"/>` +
                label(x, y - 10, text, 'sk-small')
            )
          )
          .join('') +
        group(`sk-tb ${m.pop(4)}`, label(250, 132, '100%', 'sk-big'))
    ),
  attack: () =>
    svg(
      person(34, 96, 1.1) +
        box(130, 72, 64, 38, 'API') +
        '<ellipse cx="270" cy="78" rx="24" ry="7" class="sk-card"/>' +
        path('M246 78V108A24 7 0 0 0 294 108V78', 'sk-card') +
        label(270, 98, 'Data') +
        path('M56 91H130M194 91H246') +
        traveller('M56 91H130', 0.4, 1.4, 'sk-bad', 5) +
        group(
          m.during(1.4, 3),
          rect(130, 72, 64, 38, 'sk-sbad', 7) +
            traveller('M194 91H246', 1.6, 2.6, 'sk-bad', 5)
        ) +
        group(m.during(0.4, 3), label(92, 80, 'crafted header', 'sk-small')) +
        group(
          `sk-tb ${m.pop(3.4)}`,
          path('M104 70l14 6v14c0 9-6 15-14 18-8-3-14-9-14-18V76z', 'sk-ok')
        ) +
        traveller('M56 91H94', 4.2, 5, 'sk-bad', 5) +
        group(m.fade(5), label(160, 136, 'patched in 2.3.2', 'sk-small'))
    ),
  advisory: () =>
    svg(
      rect(14, 16, 292, 148, 'sk-card', 12) +
        label(30, 148, 'ADV-2026-0142', 'sk-mono', 'start') +
        group(
          `sk-tb ${m.pop(0.5)}`,
          rect(232, 26, 60, 20, 'sk-bad', 10) +
            label(262, 40, 'HIGH', 'sk-white')
        ) +
        bar(30, 54, 180, 'sk-ink2', 9) +
        group(
          m.fade(1.2),
          `<circle cx="36" cy="94" r="5" class="sk-bad"/>` +
            label(48, 98, '≤ 2.3.1   affected', 'sk-mono', 'start')
        ) +
        group(
          m.fade(1.8),
          `<circle cx="36" cy="118" r="5" class="sk-ok"/>` +
            label(48, 122, '2.3.2     fixed', 'sk-mono', 'start')
        ) +
        group(
          `sk-tb ${m.pop(2.6)}`,
          rect(200, 126, 92, 26, 'sk-acc', 7) +
            label(246, 143, 'Upgrade now', 'sk-white')
        )
    ),
  figure: () =>
    svg(
      rect(18, 12, 132, 156, 'sk-card', 6) +
        bar(30, 26, 90, 'sk-ink2', 7) +
        [40, 50, 60].map((y) => bar(30, y, 104, 'sk-ink3', 5)).join('') +
        rect(30, 72, 108, 50, 'sk-card', 4) +
        [0, 1, 2, 3]
          .map((i) =>
            rect(
              40 + i * 24,
              112 - (i + 1) * 9,
              14,
              (i + 1) * 9,
              i === 3 ? 'sk-acc' : 'sk-ink3',
              2
            )
          )
          .join('') +
        [130, 140, 150].map((y) => bar(30, y, 104, 'sk-ink3', 5)).join('') +
        group(m.fade(1), rect(28, 70, 112, 54, 'sk-sacc', 5)) +
        group(
          `sk-tb ${m.scale(1.4, 2.2, 0.4, 1)}`,
          group(
            m.fade(1.4, 0.4),
            rect(168, 30, 136, 104, 'sk-card', 8) +
              [0, 1, 2, 3]
                .map((i) =>
                  rect(
                    184 + i * 28,
                    118 - (i + 1) * 18,
                    18,
                    (i + 1) * 18,
                    i === 3 ? 'sk-acc' : 'sk-ink3',
                    3
                  )
                )
                .join('') +
              group(
                m.fade(2.8),
                label(236, 48, 'Fig. 3: 4× fewer stalls', 'sk-small')
              )
          )
        )
    ),
  suspects: () => {
    const card = (x: number, name: string, struck: number) =>
      rect(x, 52, 82, 76, 'sk-card', 10) +
      label(x + 41, 84, '?', 'sk-big') +
      label(x + 41, 112, name, 'sk-label') +
      (struck ? strike(x + 8, 92, 66, struck) : '')
    return svg(
      label(300, 34, 'Why are checkouts slow?', 'sk-title', 'end') +
        card(20, 'DNS', 1.2) +
        card(119, 'Cache', 2.2) +
        card(218, 'Deploy', 0) +
        drawn(
          'M259 48c26 0 34 22 34 42s-12 42-34 42-34-20-34-42 8-42 34-42z',
          'sk-sacc',
          3,
          0.8
        ) +
        group(
          `sk-tb ${m.pop(4)}`,
          rect(214, 140, 90, 22, 'sk-ok', 11) +
            label(259, 155, 'FOUND IT', 'sk-white')
        )
    )
  },
  montage: () =>
    svg(
      [0, 1, 2, 3, 4, 5]
        .map((i) => {
          const x = 16 + (i % 3) * 100
          const y = 18 + Math.floor(i / 3) * 70
          return (
            rect(x, y, 88, 58, 'sk-card', 8) +
            label(x + 10, y + 14, `W${i + 1}`, 'sk-small', 'start') +
            group(
              m.fade(0.4 + i * 0.6),
              bar(x + 10, y + 24, 40 + i * 6, 'sk-ink2', 6) +
                bar(x + 10, y + 36, 58, 'sk-ink3', 6) +
                (i === 5 ? rect(x + 52, y + 40, 28, 12, 'sk-ok', 6) : '')
            )
          )
        })
        .join('') +
        rect(16, 164, 288, 6, 'sk-ink3', 3) +
        group(`sk-tl ${m.grow(0.4, 3.6)}`, rect(16, 164, 288, 6, 'sk-acc', 3))
    ),
  thennow: () => {
    const clip = `sk-wipe-${++serial}`
    const messy = [
      [24, 30],
      [92, 60],
      [40, 104],
      [120, 120],
      [70, 40]
    ]
      .map(([x, y]) => box(x, y, 50, 28, 'svc'))
      .join('')
    return svg(
      path(
        'M49 44L117 74M65 118L145 134M95 54L145 134M74 58L49 118',
        'sk-edge'
      ) +
        messy +
        label(80, 168, 'Then', 'sk-label') +
        `<clipPath id="${clip}"><rect class="sk-tl ${m.grow(1, 2)}" x="0" y="0" width="320" height="180"/></clipPath>` +
        `<g clip-path="url(#${clip})">${rect(0, 0, 320, 180, 'sk-bg', 0)}${box(40, 74, 70, 32, 'Gateway')}${box(150, 74, 70, 32, 'Service')}${box(250, 74, 54, 32, 'DB')}${path('M110 90H150M220 90H250')}${label(160, 168, 'Now', 'sk-label')}</g>`
    )
  },
  cta: () =>
    svg(
      group(
        `sk-tb ${m.pop(0.3)}`,
        rect(144, 30, 32, 32, 'sk-acc', 9) + label(160, 51, '✦', 'sk-white')
      ) +
        group(
          m.until(2.9),
          rect(100, 84, 120, 34, 'sk-acc', 17) +
            label(160, 105, 'TRY IT FREE', 'sk-white')
        ) +
        group(
          m.fade(3, 0.2),
          rect(100, 84, 120, 34, 'sk-ok', 17) +
            label(160, 105, '✓ INSTALLED', 'sk-white')
        ) +
        group(
          `sk-tb ${m.pulse(2.4)}`,
          '<circle cx="190" cy="110" r="12" class="sk-sacc"/>'
        ) +
        group(
          m.move(0.6, 2.3, 80, 50, 0, 0),
          path('M190 108l0 14 4-4 4 8 3-1-4-8 6 0z', 'sk-cursor')
        ) +
        group(m.fade(3.4), label(160, 146, 'npx studio init', 'sk-mono'))
    ),
  ticklist: () =>
    svg(
      rect(24, 18, 272, 144, 'sk-card', 12) +
        [0, 1, 2, 3]
          .map(
            (i) =>
              group(
                m.fade(0.4 + i * 0.6),
                `<circle cx="48" cy="${46 + i * 30}" r="9" class="sk-ink3"/>` +
                  bar(66, 41 + i * 30, 180 - i * 24, 'sk-ink2', 9)
              ) +
              group(
                m.fade(0.7 + i * 0.6),
                tick(42, 46 + i * 30, m.draw(0.7 + i * 0.6, 0.3))
              )
          )
          .join('')
    ),
  crew: () =>
    svg(
      (
        [
          ['Platform', 'dual writes'],
          ['Data', 'backfill'],
          ['SRE', 'cutover']
        ] as Array<[string, string]>
      )
        .map(([team, job], i) =>
          group(
            `sk-tb ${m.pop(0.5 + i * 0.6)}`,
            rect(18 + i * 100, 36, 84, 108, 'sk-card', 12) +
              person(60 + i * 100, 84, 0.95) +
              label(60 + i * 100, 120, team, 'sk-title') +
              label(60 + i * 100, 134, job, 'sk-small')
          )
        )
        .join('')
    ),
  phases: () => {
    const db = (x: number, name: string) =>
      `<ellipse cx="${x}" cy="112" rx="30" ry="8" class="sk-card"/>` +
      path(`M${x - 30} 112V144A30 8 0 0 0 ${x + 30} 144V112`, 'sk-card') +
      label(x, 134, name)
    const steps: Array<[string, number, number, string]> = [
      ['1 · Dual write', 0.2, 1.7, 'M150 50L96 102M170 50L224 102'],
      ['2 · Read new', 1.7, 3.2, 'M150 50L96 102M224 102L170 50'],
      ['3 · Write new', 3.2, 4.7, 'M170 50L224 102'],
      ['4 · Delete old', 4.7, 6.3, 'M170 50L224 102']
    ]
    return svg(
      box(120, 18, 80, 32, 'App') +
        group(m.until(4.7), db(90, 'Old')) +
        db(230, 'New') +
        steps
          .map(([name, a, b, d]) =>
            group(
              m.during(a, b),
              path(d, 'sk-sacc') + label(160, 170, name, 'sk-title')
            )
          )
          .join('')
    )
  },
  race: () =>
    svg(
      rect(12, 24, 144, 132, 'sk-card', 12) +
        rect(164, 24, 144, 132, 'sk-card', 12) +
        label(84, 50, 'Before', 'sk-mid') +
        label(236, 50, 'After', 'sk-mid') +
        rect(28, 78, 112, 10, 'sk-ink3', 5) +
        group(`sk-tl ${m.grow(0.4, 4)}`, rect(28, 78, 112, 10, 'sk-ink2', 5)) +
        rect(180, 78, 112, 10, 'sk-ink3', 5) +
        group(
          `sk-tl ${m.grow(0.4, 0.9)}`,
          rect(180, 78, 112, 10, 'sk-acc', 5)
        ) +
        group(`sk-tb ${m.pop(1.4)}`, label(236, 124, '40 ms', 'sk-big')) +
        group(m.fade(4.5), label(84, 124, '320 ms', 'sk-big'))
    ),
  attempts: () =>
    svg(
      [0, 1, 2]
        .map((i) => {
          const x = 18 + i * 100
          const ok = i === 2
          return group(
            `sk-tb ${m.pop(0.4 + i * 1.4)}`,
            rect(x, 30, 84, 116, 'sk-card', 10) +
              label(x + 42, 50, `Attempt ${i + 1}`, 'sk-title') +
              bar(x + 12, 64, 60, 'sk-ink3', 8) +
              bar(x + 12, 78, 44 + i * 6, 'sk-ink3', 8) +
              group(
                `sk-tb ${m.pop(1 + i * 1.4)}`,
                `<circle cx="${x + 42}" cy="116" r="13" class="${ok ? 'sk-ok' : 'sk-bad'}"/>` +
                  label(x + 42, 120, ok ? '✓' : '✕', 'sk-white')
              )
          )
        })
        .join('')
    ),
  columns: () =>
    svg(
      (
        [
          ['Went well', 'sk-ok'],
          ['Went wrong', 'sk-bad'],
          ['Got lucky', 'sk-warn']
        ] as Array<[string, string]>
      )
        .map(([title, cls], c) => {
          const x = 14 + c * 100
          return (
            rect(x, 16, 92, 148, 'sk-card', 10) +
            `<circle cx="${x + 14}" cy="32" r="4" class="${cls}"/>` +
            label(x + 22, 35, title, 'sk-label', 'start') +
            [0, 1, 2]
              .map((r) =>
                group(
                  `sk-tb ${m.pop(0.4 + c * 1.4 + r * 0.35)}`,
                  rect(x + 10, 48 + r * 36, 72, 28, 'sk-ink3', 4) +
                    bar(x + 16, 56 + r * 36, 50 - r * 8, 'sk-ink2', 5)
                )
              )
              .join('')
          )
        })
        .join('')
    ),
  tree: () =>
    svg(
      box(118, 12, 84, 30, 'Streaming?') +
        path('M140 42L76 74M180 42L244 74M244 104L204 136M244 104L284 136') +
        label(100, 60, 'yes', 'sk-small') +
        label(220, 60, 'no', 'sk-small') +
        box(38, 74, 76, 30, 'gRPC') +
        box(206, 74, 76, 30, 'Caching?') +
        box(166, 136, 76, 30, 'REST') +
        box(258, 136, 52, 30, 'RPC') +
        drawn('M180 42L244 74M244 104L204 136', 'sk-sacc', 0.8, 1.6) +
        group(m.fade(2.6), rect(166, 136, 76, 30, 'sk-sacc', 7)) +
        group(m.fade(3.2), tick(250, 150, m.draw(3.2, 0.4)))
    )
}
