// Sketches for systems stories: growth with its milestones, a cost curve
// stepping down, an eval table, an A/B readout, an error budget burning, a
// trace waterfall, a data pipeline, a game day, an open source repository,
// a myth turned to fact, a team, a talk's slides and a quick tip. Text stays
// out of the top left, where a card names its slot.
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
  terminalFrame,
  traveller
} from './template-sketch-kit'

type Sketch = () => string
let serial = 0

const pill = (x: number, y: number, w: number, text: string, cls: string) =>
  rect(x, y, w, 20, cls, 10) + label(x + w / 2, y + 14, text, 'sk-white')
const axes = path('M30 150H296M30 150V30')

export const SYSTEMS_SKETCHES: Record<string, Sketch> = {
  scaling: () =>
    svg(
      axes +
        drawn(
          'M32 146C120 144 170 132 210 104S262 52 292 34',
          'sk-sacc',
          0.3,
          3
        ) +
        (
          [
            [120, 140, '10k', 1],
            [212, 102, '100k', 2],
            [288, 36, '1M', 3]
          ] as Array<[number, number, string, number]>
        )
          .map(([x, y, users, t]) =>
            group(
              `sk-tb ${m.pop(t)}`,
              `<circle cx="${x}" cy="${y}" r="5" class="sk-acc"/>` +
                label(x - 8, y - 9, users, 'sk-label', 'end')
            )
          )
          .join('') +
        [0, 1, 2, 3, 4, 5, 6, 7, 8]
          .map((i) =>
            group(
              `sk-tb ${m.pop(i === 0 ? 0.4 : i < 3 ? 2 : 3.2)}`,
              rect(
                52 + (i % 3) * 18,
                42 + Math.floor(i / 3) * 18,
                14,
                14,
                'sk-ink3',
                3
              )
            )
          )
          .join('')
    ),
  bignumber: () =>
    svg(
      (
        [
          ['12k', 0.2, 1.2],
          ['48k', 1.2, 2.2]
        ] as Array<[string, number, number]>
      )
        .map(([value, a, b]) =>
          group(m.during(a, b), label(160, 104, value, 'sk-hero'))
        )
        .join('') +
        group(`sk-tb ${m.pop(2.2)}`, label(160, 104, '120k', 'sk-hero')) +
        label(160, 132, 'teams building with it', 'sk-label') +
        group(`sk-tl ${m.grow(0.4, 2)}`, rect(100, 144, 120, 4, 'sk-acc', 2))
    ),
  invoice: () => {
    const lines: Array<[string, string, boolean]> = [
      ['Compute', '$48,210', true],
      ['Storage', '$21,904', false],
      ['Egress', '$13,298', false]
    ]
    return svg(
      rect(40, 14, 240, 152, 'sk-card', 10) +
        label(268, 36, 'Cloud bill · March', 'sk-label', 'end') +
        lines
          .map(
            ([name, cost, hot], i) =>
              (hot
                ? group(
                    m.fade(2),
                    rect(50, 50 + i * 24, 220, 20, 'sk-bad', 4, 'opacity=".16"')
                  )
                : '') +
              group(
                m.fade(0.4 + i * 0.35),
                label(60, 64 + i * 24, name, 'sk-label', 'start') +
                  label(262, 64 + i * 24, cost, 'sk-mono', 'end')
              )
          )
          .join('') +
        path('M56 128H264', 'sk-edge') +
        label(60, 150, 'Total', 'sk-title', 'start') +
        group(m.during(0.4, 1.6), label(262, 150, '$61,020', 'sk-mid', 'end')) +
        group(m.fade(1.6, 0.2), label(262, 150, '$83,412', 'sk-mid', 'end'))
    )
  },
  costdown: () =>
    svg(
      axes +
        drawn('M32 46H96V78H170V104H240V122H292', 'sk-sacc', 0.3, 3) +
        (
          [
            [96, 62, 'reserved', 1],
            [170, 90, 'right-sized', 1.8],
            [240, 112, 'spot', 2.6]
          ] as Array<[number, number, string, number]>
        )
          .map(([x, y, text, t]) =>
            group(m.fade(t), label(x + 4, y, text, 'sk-small', 'start'))
          )
          .join('') +
        group(`sk-tb ${m.pop(3.4)}`, pill(206, 36, 84, '−40% A MONTH', 'sk-ok'))
    ),
  evals: () => {
    const cases: Array<[string, string, string]> = [
      ['Refunds', 'sk-bad', 'sk-ok'],
      ['Shipping', 'sk-ok', 'sk-ok'],
      ['Tone', 'sk-warn', 'sk-ok'],
      ['Jailbreak', 'sk-bad', 'sk-warn']
    ]
    return svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        label(176, 36, 'v1', 'sk-label') +
        label(226, 36, 'v2', 'sk-label') +
        cases
          .map(
            ([name, before, after], i) =>
              label(32, 60 + i * 22, name, 'sk-label', 'start') +
              group(
                `sk-tb ${m.pop(0.4 + i * 0.25)}`,
                `<circle cx="176" cy="${56 + i * 22}" r="6" class="${before}"/>`
              ) +
              group(
                `sk-tb ${m.pop(1.6 + i * 0.25)}`,
                `<circle cx="226" cy="${56 + i * 22}" r="6" class="${after}"/>`
              )
          )
          .join('') +
        label(32, 154, 'pass rate', 'sk-small', 'start') +
        rect(88, 146, 200, 10, 'sk-ink3', 5) +
        group(`sk-tl ${m.grow(0.4, 1)}`, rect(88, 146, 124, 10, 'sk-ink2', 5)) +
        group(`sk-tl ${m.grow(2.6, 1)}`, rect(88, 146, 182, 10, 'sk-acc', 5)) +
        group(m.fade(3.6), label(296, 140, '62% → 91%', 'sk-label', 'end'))
    )
  },
  abtest: () =>
    svg(
      path('M40 150H280') +
        group(`sk-bl ${m.rise(0.4, 1.2)}`, rect(80, 70, 56, 80, 'sk-ink2', 6)) +
        group(`sk-bl ${m.rise(0.8, 1.2)}`, rect(184, 56, 56, 94, 'sk-acc', 6)) +
        group(
          m.fade(2),
          path(
            'M108 60V80M100 60H116M100 80H116M212 46V66M204 46H220M204 66H220',
            'sk-edge'
          )
        ) +
        label(108, 166, 'A · 3.1%', 'sk-label') +
        label(212, 166, 'B · 3.4%', 'sk-label') +
        group(
          `sk-tb ${m.pop(2.8)}`,
          pill(176, 18, 120, '+9.7% · p < 0.01', 'sk-ok')
        )
    ),
  slo: () =>
    svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        label(296, 36, 'SLO 99.9% · 30 days', 'sk-label', 'end') +
        label(32, 74, 'Error budget', 'sk-label', 'start') +
        rect(32, 84, 256, 18, 'sk-ok', 9) +
        group(
          `sk-tr ${m.grow(0.6, 3)}`,
          rect(122, 84, 166, 18, 'sk-bad', 9, 'opacity=".85"')
        ) +
        group(
          m.fade(1.6),
          label(32, 124, 'burning 4× too fast', 'sk-small', 'start')
        ) +
        group(
          `sk-tb ${m.pop(2.2)}`,
          pill(32, 134, 96, 'PAGE THE TEAM', 'sk-warn')
        ) +
        group(m.fade(3.8), label(288, 124, '35% left', 'sk-label', 'end'))
    ),
  trace: () => {
    const spans: Array<[string, number, number, number, string]> = [
      ['GET /checkout', 0, 0, 252, 'sk-ink2'],
      ['auth', 1, 6, 30, 'sk-ink3'],
      ['cart', 1, 40, 46, 'sk-ink3'],
      ['payments', 1, 90, 156, 'sk-bad'],
      ['db.query', 2, 100, 132, 'sk-bad']
    ]
    return svg(
      rect(12, 14, 296, 152, 'sk-card', 10) +
        label(296, 34, '1.8 s', 'sk-label', 'end') +
        spans
          .map(
            ([name, depth, x, w, cls], i) =>
              label(20 + depth * 8, 60 + i * 22, name, 'sk-small', 'start') +
              group(
                `sk-tl ${m.grow(0.3 + i * 0.35, 0.5)}`,
                rect(96 + x * 0.78, 52 + i * 22, w * 0.78, 12, cls, 3)
              )
          )
          .join('') +
        group(m.fade(2.6), rect(166, 116, 128, 36, 'sk-sbad', 4))
    )
  },
  pipeline: () => {
    const stages: Array<[number, string, string]> = [
      [14, 'Ingest', '2M/s'],
      [90, 'Clean', '1.9M/s'],
      [166, 'Store', '40 TB'],
      [242, 'Serve', '8 ms']
    ]
    return svg(
      stages
        .map(
          ([x, name, rate]) =>
            box(x, 70, 64, 36, name) +
            group(m.fade(2.4), label(x + 32, 124, rate, 'sk-small'))
        )
        .join('') +
        path('M78 88H90M154 88H166M230 88H242') +
        [0.3, 0.9, 1.5]
          .map((t) => traveller('M46 88H274', t, t + 2.4, 'sk-acc', 3.5))
          .join('')
    )
  },
  chaos: () =>
    svg(
      box(18, 70, 60, 36, 'Edge') +
        box(130, 30, 64, 36, 'Zone A') +
        group(m.until(1.6), box(130, 112, 64, 36, 'Zone B')) +
        group(
          m.fade(1.6),
          rect(130, 112, 64, 36, 'sk-bad', 7) +
            label(162, 134, 'killed', 'sk-white')
        ) +
        box(246, 70, 58, 36, 'Data') +
        path(
          'M78 88C104 88 104 48 130 48M78 88C104 88 104 130 130 130M194 48C220 48 220 88 246 88M194 130C220 130 220 88 246 88'
        ) +
        traveller('M78 88C104 88 104 130 130 130', 0.2, 1.4, 'sk-acc', 4) +
        [2.2, 3, 3.8]
          .map((t) =>
            traveller('M78 88C104 88 104 48 130 48', t, t + 0.8, 'sk-acc', 4)
          )
          .join('') +
        group(
          `sk-tb ${m.pop(4.6)}`,
          pill(112, 154, 96, 'NO ONE NOTICED', 'sk-ok')
        )
    ),
  stars: () =>
    svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        label(32, 64, 'acme / ratelimit', 'sk-mid', 'start') +
        group(m.during(0.2, 1.6), label(292, 64, '★ 9.8k', 'sk-mid', 'end')) +
        group(m.fade(1.6, 0.2), label(292, 64, '★ 12.4k', 'sk-mid', 'end')) +
        bar(32, 76, 160, 'sk-ink3', 6) +
        rect(32, 92, 256, 6, 'sk-ink3', 3) +
        group(
          `sk-tl ${m.grow(0.4, 0.8)}`,
          rect(32, 92, 150, 6, 'sk-acc', 3) + rect(182, 92, 70, 6, 'sk-warn', 3)
        ) +
        [0, 1, 2, 3, 4, 5]
          .map((i) =>
            group(
              `sk-tb ${m.pop(1.4 + i * 0.2)}`,
              `<circle cx="${44 + i * 22}" cy="128" r="10" class="${i % 2 ? 'sk-ink2' : 'sk-ink3'}"/>`
            )
          )
          .join('') +
        group(
          `sk-tb ${m.pop(3)}`,
          pill(186, 118, 104, 'GOOD FIRST ISSUE', 'sk-ok')
        )
    ),
  mythfact: () =>
    svg(
      group(
        `sk-tb ${m.flip(2.2)}`,
        group(
          m.until(2.4),
          rect(60, 36, 200, 108, 'sk-card', 14) +
            pill(76, 50, 64, 'MYTH', 'sk-bad') +
            bar(76, 84, 168, 'sk-ink2', 9) +
            bar(76, 100, 140, 'sk-ink2', 9) +
            drawn('M70 136L250 44', 'sk-sbad', 1.4, 0.5)
        ) +
          group(
            m.fade(2.4, 0.1),
            rect(60, 36, 200, 108, 'sk-card', 14) +
              pill(76, 50, 64, 'FACT', 'sk-ok') +
              bar(76, 84, 168, 'sk-ink2', 9) +
              bar(76, 100, 120, 'sk-ink2', 9) +
              bar(76, 116, 150, 'sk-ink3', 7)
          )
      )
    ),
  teamgrid: () =>
    svg(
      ['Infra', 'Payments', 'Mobile', 'Data', 'SRE', 'Developer tools']
        .map((team, i) => {
          const x = 18 + (i % 3) * 100
          const y = 18 + Math.floor(i / 3) * 76
          return group(
            `sk-tb ${m.pop(0.3 + i * 0.3)}`,
            rect(x, y, 84, 66, 'sk-card', 10) +
              person(x + 42, y + 34, 0.8) +
              label(x + 42, y + 60, team, 'sk-small')
          )
        })
        .join('')
    ),
  slides: () =>
    svg(
      rect(56, 14, 208, 112, 'sk-card', 8) +
        bar(74, 32, 120, 'sk-ink2', 10) +
        [0, 1, 2]
          .map((i) =>
            group(
              m.fade(0.6 + i * 0.6),
              `<circle cx="80" cy="${64 + i * 18}" r="3" class="sk-acc"/>` +
                bar(90, 60 + i * 18, 140 - i * 24, 'sk-ink3', 7)
            )
          )
          .join('') +
        group(m.fade(2.4), rect(72, 74, 176, 16, 'sk-sacc', 4)) +
        [0, 1, 2, 3, 4]
          .map((i) =>
            rect(36 + i * 52, 140, 44, 25, i === 1 ? 'sk-sacc' : 'sk-card', 4)
          )
          .join('') +
        group(`sk-tb ${m.pop(3.2)}`, pill(226, 18, 80, '40 MIN → 2', 'sk-acc'))
    ),
  tipcard: () => {
    const clip = `sk-tip-${++serial}`
    return svg(
      group(`sk-tb ${m.pop(0.2)}`, pill(244, 18, 54, 'TIL', 'sk-acc')) +
        terminalFrame(18, 46, 284, 72) +
        `<clipPath id="${clip}"><rect class="sk-tl ${m.type(0.6, 1.4)}" x="30" y="70" width="260" height="18"/></clipPath>` +
        `<g clip-path="url(#${clip})"><text x="32" y="82" class="sk-term">$ git log -S "retryDelay" --oneline</text></g>` +
        group(
          m.fade(2.3),
          '<text x="32" y="104" class="sk-term-ok">a41f9c2 cap the retry delay</text>'
        ) +
        group(
          `sk-tb ${m.pop(3.2)}`,
          pill(104, 134, 112, 'FOUND IN SECONDS', 'sk-ok')
        )
    )
  }
}
