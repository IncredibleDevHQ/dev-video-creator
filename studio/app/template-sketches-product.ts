// Sketches for product stories: a pull request's files, a quickstart against
// the clock, an error and its fix, a deprecation's dates, a customer's
// numbers, an integration, an API call, a roadmap, a maintenance window, a
// status report, a year in numbers, a plan change, recipes and onboarding.
// Text stays out of the top left, where a card names its slot.
import {
  bar,
  box,
  drawn,
  group,
  label,
  motion as m,
  path,
  rect,
  svg,
  terminalFrame,
  tick,
  traveller
} from './template-sketch-kit'

type Sketch = () => string
let serial = 0

const pill = (x: number, y: number, w: number, text: string, cls: string) =>
  rect(x, y, w, 20, cls, 10) + label(x + w / 2, y + 14, text, 'sk-white')

/** A dot that moves along a path and stays where it arrives. */
const mover = (route: string, a: number, b: number, cls: string) =>
  `<circle r="6" class="${cls} ${m.along(a, b)}" style="offset-path:path('${route}');offset-rotate:0deg"/>`

export const PRODUCT_SKETCHES: Record<string, Sketch> = {
  stages: () =>
    svg(
      path('M40 92H280', 'sk-edge') +
        (
          [
            ['Private', 60, 0.3],
            ['Public preview', 160, 0.8],
            ['Generally available', 260, 1.3]
          ] as Array<[string, number, number]>
        )
          .map(([name, x, t]) =>
            group(
              `sk-tb ${m.pop(t)}`,
              `<circle cx="${x}" cy="92" r="9" class="sk-ink3"/>` +
                label(x, 120, name, 'sk-label')
            )
          )
          .join('') +
        group(
          m.move(1.8, 2.6, -100, 0, 0, 0),
          `<circle cx="160" cy="92" r="9" class="sk-acc"/>`
        ) +
        group(
          `sk-tb ${m.pop(2.7)}`,
          pill(112, 52, 96, 'YOU ARE HERE', 'sk-acc')
        ) +
        group(
          m.fade(3.4),
          label(
            160,
            150,
            'no uptime promise until it is generally available',
            'sk-small'
          )
        )
    ),
  eventcard: () =>
    svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        label(296, 36, 'Live session', 'sk-label', 'end') +
        group(
          `sk-tb ${m.pop(0.4)}`,
          rect(30, 52, 70, 76, 'sk-acc', 10) +
            label(65, 76, 'THU', 'sk-white') +
            label(65, 110, '14', 'sk-cap-big')
        ) +
        group(
          m.fade(1),
          label(116, 70, 'Rate limits in practice', 'sk-title', 'start') +
            label(116, 86, '17:00 UTC · 45 minutes', 'sk-small', 'start')
        ) +
        group(
          m.fade(1.6),
          `<circle cx="126" cy="112" r="10" class="sk-ink3"/>` +
            label(142, 116, 'Your name, speaker', 'sk-small', 'start')
        ) +
        group(`sk-tb ${m.pop(2.6)}`, pill(200, 136, 92, 'REGISTER', 'sk-acc'))
    ),
  hill: () =>
    svg(
      path('M24 140C80 140 110 50 160 50S240 140 296 140', 'sk-edge') +
        path('M160 44V146', 'sk-edge sk-dashed') +
        label(92, 162, 'figuring it out', 'sk-small') +
        label(228, 162, 'making it happen', 'sk-small') +
        `<circle cx="52" cy="137" r="6" class="sk-warn"/>` +
        mover('M70 128C95 110 120 56 160 50', 0.4, 2.4, 'sk-acc') +
        mover('M160 50C200 52 225 100 262 132', 1, 3.2, 'sk-ok') +
        [
          ['Export', 'sk-warn'],
          ['Auth', 'sk-acc'],
          ['Billing', 'sk-ok']
        ]
          .map(
            ([name, cls], i) =>
              `<circle cx="${190 + i * 38}" cy="30" r="4" class="${cls}"/>` +
              label(197 + i * 38, 33, name, 'sk-small', 'start')
          )
          .join('')
    ),
  mapping: () => {
    const pairs: Array<[string, string]> = [
      ['Dyno', 'Service'],
      ['Add-on', 'Database'],
      ['Procfile', 'Blueprint']
    ]
    return svg(
      label(70, 52, 'Where you come from', 'sk-small') +
        label(250, 52, 'Here', 'sk-small') +
        pairs
          .map(
            ([theirs, ours], i) =>
              group(
                m.fade(0.4 + i * 0.6),
                box(28, 62 + i * 34, 84, 26, theirs)
              ) +
              drawn(`M112 ${75 + i * 34}H208`, 'sk-sacc', 0.7 + i * 0.6, 0.5) +
              group(m.fade(1 + i * 0.6), box(208, 62 + i * 34, 84, 26, ours))
          )
          .join('') +
        group(
          `sk-tb ${m.pop(3)}`,
          pill(104, 154, 112, 'ONE IMPORT COMMAND', 'sk-acc')
        )
    )
  },
  badge: () =>
    svg(
      group(
        `sk-tb ${m.pop(0.4)}`,
        path(
          'M96 42l50 18v34c0 30-22 48-50 58-28-10-50-28-50-58V60z',
          'sk-acc'
        ) +
          label(96, 100, 'SOC 2', 'sk-cap-big') +
          label(96, 118, 'TYPE II', 'sk-white')
      ) +
        ['Security reviews in days', 'Regulated workloads', 'Enterprise plans']
          .map(
            (text, i) =>
              group(
                m.fade(1.4 + i * 0.5),
                label(194, 78 + i * 26, text, 'sk-label', 'start')
              ) +
              group(
                m.fade(1.6 + i * 0.5),
                tick(176, 74 + i * 26, m.draw(1.6 + i * 0.5, 0.3))
              )
          )
          .join('')
    ),
  prfiles: () => {
    const files: Array<[string, string, string]> = [
      ['src/retry.ts', '+38', '−12'],
      ['src/client.ts', '+6', '−2'],
      ['test/retry.test.ts', '+54', '']
    ]
    return svg(
      rect(12, 14, 296, 152, 'sk-card', 10) +
        label(296, 34, 'PR #4182', 'sk-label', 'end') +
        label(28, 60, 'Retry with backoff', 'sk-mid', 'start') +
        files
          .map(
            ([name, add, del], i) =>
              group(
                m.fade(0.5 + i * 0.4),
                label(32, 90 + i * 22, name, 'sk-mono', 'start') +
                  label(250, 90 + i * 22, add, 'sk-ok-text', 'end') +
                  label(290, 90 + i * 22, del, 'sk-bad-text', 'end')
              ) +
              (i === 0
                ? group(
                    m.fade(1.8),
                    rect(22, 77 + i * 22, 276, 18, 'sk-acc', 4, 'opacity=".16"')
                  )
                : '')
          )
          .join('') +
        group(`sk-tb ${m.pop(3)}`, pill(200, 140, 96, 'APPROVED', 'sk-ok'))
    )
  },
  quickstart: () =>
    svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        ['Install', 'Add your key', 'First request']
          .map(
            (step, i) =>
              group(
                m.fade(0.5 + i * 0.9),
                `<circle cx="40" cy="${64 + i * 30}" r="9" class="sk-ink3"/>` +
                  label(58, 68 + i * 30, step, 'sk-label', 'start')
              ) +
              group(
                m.fade(0.9 + i * 0.9),
                tick(34, 64 + i * 30, m.draw(0.9 + i * 0.9, 0.3))
              )
          )
          .join('') +
        (
          [
            ['0:42', 0.3, 1.5],
            ['2:15', 1.5, 2.7],
            ['4:51', 2.7, 6.2]
          ] as Array<[string, number, number]>
        )
          .map(([time, a, b]) =>
            group(m.during(a, b), label(246, 78, time, 'sk-big'))
          )
          .join('') +
        label(246, 96, 'minutes', 'sk-small') +
        group(`sk-tb ${m.pop(3.4)}`, pill(200, 126, 92, 'IT WORKS', 'sk-ok'))
    ),
  errorfix: () =>
    svg(
      group(
        m.fade(0.3),
        rect(20, 40, 280, 46, 'sk-bad', 8, 'opacity=".14"') +
          rect(20, 40, 5, 46, 'sk-bad', 2) +
          label(36, 60, 'Error: ECONNRESET', 'sk-mono', 'start') +
          label(36, 76, 'socket hang up at retry.ts:42', 'sk-small', 'start')
      ) +
        group(m.fade(1.3), path('M160 90v12M154 96l6 6 6-6', 'sk-edge')) +
        group(
          m.fade(1.8),
          rect(20, 108, 280, 46, 'sk-ok', 8, 'opacity=".14"') +
            rect(20, 108, 5, 46, 'sk-ok', 2) +
            label(36, 128, 'Fix: keepAlive: false', 'sk-mono', 'start') +
            label(36, 144, 'or upgrade to 2.3.2', 'sk-small', 'start')
        ) +
        group(m.fade(3), tick(272, 131, m.draw(3, 0.4)))
    ),
  deprecation: () => {
    const marks: Array<[number, string, string, string, number]> = [
      [56, 'Today', 'notice', 'sk-acc', 0.4],
      [128, 'Jan 15', 'deprecated', 'sk-warn', 1],
      [206, 'Apr 1', 'read-only', 'sk-warn', 1.6],
      [282, 'Jul 1', 'removed', 'sk-bad', 2.2]
    ]
    return svg(
      drawn('M30 96H300', 'sk-edge', 0.2, 2.2) +
        marks
          .map(([x, date, phase, cls, t]) =>
            group(
              `sk-tb ${m.pop(t)}`,
              `<circle cx="${x}" cy="96" r="7" class="${cls}"/>` +
                label(x, 80, date, 'sk-label') +
                label(x, 118, phase, 'sk-small')
            )
          )
          .join('') +
        group(
          `sk-tb ${m.pop(3.2)}`,
          pill(92, 138, 136, 'MIGRATE TO V2 →', 'sk-acc')
        )
    )
  },
  customer: () =>
    svg(
      rect(204, 18, 100, 36, 'sk-card', 10) +
        label(254, 41, 'ACME', 'sk-mid') +
        label(28, 92, '“', 'sk-quote-mark') +
        group(
          m.fade(0.4),
          bar(52, 70, 150, 'sk-ink2', 9) + bar(52, 86, 120, 'sk-ink2', 9)
        ) +
        (
          [
            [24, '−62%', 'p99 latency', 1.6],
            [124, '3×', 'deploys a week', 2.1],
            [224, '$1.2M', 'saved a year', 2.6]
          ] as Array<[number, string, string, number]>
        )
          .map(([x, value, text, t]) =>
            group(
              `sk-tb ${m.pop(t)}`,
              rect(x, 112, 84, 50, 'sk-card', 10) +
                label(x + 42, 138, value, 'sk-mid') +
                label(x + 42, 152, text, 'sk-small')
            )
          )
          .join('')
    ),
  integration: () =>
    svg(
      rect(28, 54, 80, 72, 'sk-acc', 16) +
        label(68, 95, 'Your app', 'sk-white') +
        rect(212, 54, 80, 72, 'sk-card', 16) +
        label(252, 95, 'Payments', 'sk-label') +
        drawn('M108 90H212', 'sk-sacc', 0.3, 0.8) +
        [1.2, 2, 2.8]
          .map((t) => traveller('M108 84H212', t, t + 0.8, 'sk-acc', 4))
          .join('') +
        [1.6, 2.4]
          .map((t) => traveller('M212 98H108', t, t + 0.8, 'sk-ok', 4))
          .join('') +
        group(
          `sk-tb ${m.pop(3.8)}`,
          pill(110, 140, 100, 'CONNECTED ✓', 'sk-ok')
        )
    ),
  apiflow: () => {
    const clip = `sk-api-${++serial}`
    return svg(
      terminalFrame(10, 18, 148, 144) +
        `<clipPath id="${clip}"><rect class="sk-tl ${m.type(0.5, 1.4)}" x="20" y="44" width="134" height="56"/></clipPath>` +
        `<g clip-path="url(#${clip})"><text x="22" y="58" class="sk-term">$ curl -X POST</text><text x="22" y="74" class="sk-term">  /v1/videos</text><text x="22" y="90" class="sk-term-dim">  -d @post.json</text></g>` +
        rect(166, 18, 144, 144, 'sk-card', 10) +
        ['{', '  "id": "vid_42",', '  "status": "ready"', '}']
          .map((line, i) =>
            group(
              m.fade(2.2 + i * 0.25),
              label(178, 58 + i * 16, line, 'sk-mono', 'start')
            )
          )
          .join('') +
        group(`sk-tb ${m.pop(3.4)}`, pill(204, 132, 92, '201 CREATED', 'sk-ok'))
    )
  },
  roadmap: () => {
    const column = (x: number, name: string) =>
      rect(x, 16, 92, 148, 'sk-card', 10) + label(x + 46, 34, name, 'sk-title')
    const card = (x: number, y: number, w: number) =>
      rect(x, y, 76, 26, 'sk-bg', 6, 'stroke-width="1"') +
      bar(x + 8, y + 10, w, 'sk-ink3', 6)
    return svg(
      column(14, 'Now') +
        column(114, 'Next') +
        column(214, 'Later') +
        card(22, 46, 50) +
        card(22, 78, 40) +
        card(222, 46, 56) +
        card(222, 78, 36) +
        group(
          m.move(1.4, 2.4, 100, 0, 0, 0),
          group(
            `sk-tb ${m.pop(0.4)}`,
            card(22, 110, 58) + rect(22, 110, 76, 26, 'sk-sacc', 6)
          )
        ) +
        card(122, 46, 46)
    )
  },
  maintenance: () => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    return svg(
      rect(16, 18, 288, 144, 'sk-card', 12) +
        days.map((day, i) => label(46 + i * 38, 50, day, 'sk-label')).join('') +
        days
          .map((_, i) =>
            rect(30 + i * 38, 60, 32, 50, 'sk-ink3', 6, 'opacity=".5"')
          )
          .join('') +
        group(`sk-tb ${m.pop(0.6)}`, rect(258, 60, 32, 50, 'sk-acc', 6)) +
        label(160, 130, 'Sat 02:00–04:00 UTC', 'sk-label') +
        group(m.during(1, 2.6), pill(118, 136, 84, 'SCHEDULED', 'sk-acc')) +
        group(m.during(2.6, 4.2), pill(118, 136, 84, 'UNDERWAY', 'sk-warn')) +
        group(m.fade(4.2), pill(118, 136, 84, 'COMPLETE', 'sk-ok'))
    )
  },
  rag: () => {
    const rows: Array<[string, string, string]> = [
      ['Scope', 'sk-ok', 'on track'],
      ['Schedule', 'sk-warn', 'one week late'],
      ['Budget', 'sk-ok', 'on track'],
      ['Risk', 'sk-bad', 'vendor API']
    ]
    return svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        label(296, 34, 'Milestone 3 of 5', 'sk-label', 'end') +
        rect(160, 42, 136, 8, 'sk-ink3', 4) +
        group(`sk-tl ${m.grow(0.4, 1.2)}`, rect(160, 42, 82, 8, 'sk-acc', 4)) +
        rows
          .map(([name, cls, note], i) =>
            group(
              m.fade(0.8 + i * 0.4),
              `<circle cx="34" cy="${74 + i * 22}" r="6" class="${cls}"/>` +
                label(48, 78 + i * 22, name, 'sk-label', 'start') +
                label(140, 78 + i * 22, note, 'sk-small', 'start')
            )
          )
          .join('') +
        group(`sk-tb ${m.pop(3)}`, pill(214, 136, 82, 'ONE ASK', 'sk-acc'))
    )
  },
  wrapped: () => {
    const tiles: Array<[number, number, string, string, string, number]> = [
      [14, 14, '1.2M', 'deploys', 'sk-acc', 0.3],
      [164, 14, '38', 'releases', 'sk-ok', 0.8],
      [14, 98, '99.99%', 'uptime', 'sk-warn', 1.3],
      [164, 98, '212', 'contributors', 'sk-bad', 1.8]
    ]
    return svg(
      tiles
        .map(([x, y, value, text, cls, t]) =>
          group(
            `sk-tb ${m.pop(t)}`,
            rect(x, y, 142, 68, cls, 12) +
              label(x + 71, y + 40, value, 'sk-cap-big') +
              label(x + 71, y + 58, text, 'sk-cap-small', 'middle')
          )
        )
        .join('')
    )
  },
  pricing: () => {
    const plan = (x: number, name: string, price: string, hot: boolean) =>
      rect(x, 26, 88, 128, 'sk-card', 12) +
      (hot ? rect(x, 26, 88, 128, 'sk-sacc', 12) : '') +
      label(x + 44, 50, name, 'sk-title') +
      (hot ? '' : label(x + 44, 86, price, 'sk-mid')) +
      bar(x + 14, 106, 60, 'sk-ink3', 6) +
      bar(x + 14, 120, 48, 'sk-ink3', 6)
    return svg(
      plan(16, 'Free', '$0', false) +
        plan(116, 'Pro', '', true) +
        plan(216, 'Team', '$49', false) +
        group(m.until(2), label(160, 86, '$20', 'sk-mid')) +
        group(m.during(1.4, 2.2), path('M140 82H180', 'sk-sbad')) +
        group(
          `sk-tb ${m.pop(2.2)}`,
          label(160, 86, '$16', 'sk-mid') + pill(128, 128, 64, 'NEW', 'sk-acc')
        )
    )
  },
  recipes: () =>
    svg(
      [0, 1, 2]
        .map((i) => {
          const x = 18 + i * 100
          return (
            group(
              `sk-tb ${m.pop(0.4 + i * 0.5)}`,
              rect(x, 38, 84, 104, 'sk-card', 12) +
                `<circle cx="${x + 42}" cy="66" r="14" class="sk-acc"/>` +
                label(x + 42, 71, String(i + 1), 'sk-white') +
                bar(x + 14, 96, 56, 'sk-ink2', 7) +
                bar(x + 14, 110, 44, 'sk-ink3', 6)
            ) +
            group(
              m.during(2 + i * 1.3, 3.3 + i * 1.3),
              rect(x, 38, 84, 104, 'sk-sacc', 12)
            )
          )
        })
        .join('')
    ),
  onboarding: () =>
    svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        '<circle cx="246" cy="90" r="38" class="sk-gauge-track"/>' +
        drawn('M246 52a38 38 0 1 1 -0.1 0', 'sk-sacc sk-gauge-fill', 0.4, 3.2) +
        group(m.fade(3.6), label(246, 96, '100%', 'sk-mid')) +
        ['Create a project', 'Invite your team', 'Ship your first video']
          .map(
            (step, i) =>
              group(
                m.fade(0.4),
                `<circle cx="38" cy="${62 + i * 30}" r="9" class="sk-ink3"/>` +
                  label(56, 66 + i * 30, step, 'sk-label', 'start')
              ) +
              group(
                m.fade(1.2 + i * 1),
                tick(32, 62 + i * 30, m.draw(1.2 + i * 1, 0.3))
              )
          )
          .join('')
    )
}
