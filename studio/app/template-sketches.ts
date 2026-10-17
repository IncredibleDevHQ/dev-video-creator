// One looping sketch per slot's signature move, for the template gallery and
// picker. Sketches show the idea of a slot, never the creator's content. The
// product and code sketches are in template-sketches-more.ts, the speaker
// with words on them in -speaker.ts, story moves in -story.ts, and product
// and systems moves in -product.ts, -systems.ts and -eng.ts.
import {
  bar,
  box,
  camera,
  drawn,
  flushMotion,
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
import { MORE_SKETCHES } from './template-sketches-more'
import { SPEAKER_SKETCHES } from './template-sketches-speaker'
import { STORY_SKETCHES } from './template-sketches-story'
import { PRODUCT_SKETCHES } from './template-sketches-product'
import { SYSTEMS_SKETCHES } from './template-sketches-systems'
import { ENG_SKETCHES } from './template-sketches-eng'

type Sketch = () => string

const fanOut = (nodes: Array<[number, number, string]>, w = 54) =>
  nodes.map(([x, y, text]) => box(x, y, w, 34, text)).join('')

const SKETCHES: Record<string, Sketch> = {
  decision: () =>
    svg(
      rect(16, 30, 184, 120, 'sk-card', 12) +
        bar(32, 50, 60, 'sk-acc', 7) +
        bar(32, 68, 140, 'sk-ink2', 9) +
        bar(32, 88, 150) +
        bar(32, 101, 128) +
        bar(32, 114, 140) +
        group(
          `sk-tb ${m.pop(1.2)}`,
          rect(106, 120, 84, 22, 'sk-ok', 6) +
            label(148, 134, 'DECIDED', 'sk-white')
        ) +
        group(m.fade(0.2), camera(212, 30, 92, 120))
    ),
  c4zoom: () =>
    svg(
      group(
        m.until(2.4),
        box(18, 70, 60, 34, 'Users') +
          box(126, 58, 76, 58, 'Checkout') +
          box(246, 70, 58, 34, 'Payments') +
          path('M78 87H126M202 87H246')
      ) +
        group(
          `sk-tb ${m.scale(2.4, 3.2, 0.35, 1)}`,
          group(
            m.fade(2.4, 0.3),
            rect(14, 18, 292, 144, 'sk-card', 12) +
              label(34, 34, 'Checkout', 'sk-label', 'start') +
              fanOut(
                [
                  [30, 72, 'API'],
                  [127, 72, 'Orders'],
                  [224, 72, 'Ledger']
                ],
                66
              ) +
              path('M96 89H127M193 89H224') +
              drawn('M96 89H127M193 89H224', 'sk-sbad', 3.6)
          )
        )
    ),
  spotlight: () => {
    const nodes: Array<[number, number, string, number]> = [
      [22, 74, 'Client', 54],
      [92, 40, 'Gateway', 54],
      [92, 108, 'Auth', 54],
      [176, 74, 'Rate limiter', 64],
      [252, 74, 'API', 54]
    ]
    return svg(
      path(
        'M76 91C84 91 84 57 92 57M76 91C84 91 84 125 92 125M154 57C166 57 164 91 176 91M154 125C166 125 164 91 176 91M240 91H252'
      ) +
        nodes
          .map(([x, y, text, w], i) =>
            group(
              m.spot(0.6 + i * 1.1, 1.5 + i * 1.1),
              box(x, y, w, 34, text) +
                (i === 3 ? rect(x, y, w, 34, 'sk-sacc', 7) : '')
            )
          )
          .join('') +
        traveller(
          'M49 91C84 91 84 57 120 57C166 57 164 91 208 91H279',
          0.7,
          5.6
        ) +
        group(m.fade(0.2), camera(250, 130, 62, 42))
    )
  },
  tradeoff: () => {
    const card = (
      x: number,
      title: string,
      scores: number[],
      lost: string,
      i: number
    ) =>
      group(
        lost ? m.until(2.6 + i * 0.6) : '',
        rect(x, 30, 88, 118, 'sk-card', 10) +
          label(x + 44, 50, title, 'sk-title') +
          scores
            .map((s, j) =>
              bar(x + 12, 64 + j * 14, s, j ? 'sk-ink3' : 'sk-acc', 7)
            )
            .join('') +
          (lost
            ? group(
                m.during(1.6 + i * 0.6, 2.6 + i * 0.6),
                label(x + 44, 136, `✕ ${lost}`, 'sk-small')
              )
            : group(
                m.fade(3.6),
                rect(x + 14, 118, 60, 20, 'sk-ok', 6) +
                  label(x + 44, 131, 'CHOSEN', 'sk-white')
              ))
      )
    return svg(
      card(12, 'Queue', [50, 34, 58], 'latency', 0) +
        card(116, 'Token bucket', [62, 56, 48], '', 0) +
        card(220, 'Shedding', [40, 60, 30], 'fairness', 1)
    )
  },
  rollout: () =>
    svg(
      drawn('M24 100H296', 'sk-edge', 0.4, 2) +
        [
          [60, 'Shadow'],
          [150, '10%'],
          [240, '100%']
        ]
          .map(([x, text], i) =>
            group(
              `sk-tb ${m.pop(0.9 + i * 0.7)}`,
              `<circle cx="${x}" cy="100" r="8" class="sk-acc"/>` +
                label(Number(x), 126, String(text))
            )
          )
          .join('') +
        group(
          `sk-tb ${m.pop(3.2)}`,
          path('M150 74l10-18 10 18z', 'sk-bad') +
            label(160, 70, '!', 'sk-white')
        ) +
        group(m.fade(3.3), label(160, 48, 'risk: hot keys', 'sk-small'))
    ),
  checklist: () =>
    svg(
      [0, 1, 2]
        .map(
          (i) =>
            rect(24, 40 + i * 36, 16, 16, 'sk-card', 4) +
            bar(50, 45 + i * 36, 110 - i * 14, 'sk-ink2', 7) +
            `<circle cx="${170 - i * 14}" cy="${48 + i * 36}" r="7" class="sk-acc"/>` +
            tick(26, 46 + i * 36, m.draw(1 + i * 0.8, 0.4))
        )
        .join('') + group(m.fade(0.2), camera(206, 26, 98, 128))
    ),
  spike: () => {
    const reading = (a: number, b: number, value: string) =>
      group(
        b ? m.during(a, b) : m.fade(a),
        rect(214, 26, 82, 40, 'sk-card', 8) + label(255, 52, value, 'sk-mid')
      )
    return svg(
      path('M24 140H296M24 30V140') +
        drawn(
          'M24 130L80 128L120 126L150 122L165 46L185 40L205 118L240 124L296 126',
          'sk-sbad',
          0.4,
          2.2
        ) +
        reading(0.4, 2, '0.2%') +
        reading(2, 3.2, '18%') +
        reading(3.2, 0, '41%') +
        group(m.fade(3.2), label(255, 78, 'requests failed', 'sk-small'))
    )
  },
  scrub: () =>
    svg(
      path('M24 110H296') +
        ['14:02', '14:10', '14:25', '14:41']
          .map(
            (t, i) =>
              path(`M${40 + i * 80} 106V114`) +
              label(40 + i * 80, 128, t, 'sk-small')
          )
          .join('') +
        group(m.move(0.3, 6, 0, 0, 240, 0), path('M40 40V118', 'sk-sacc')) +
        (
          [
            [60, 'deploy', 'sk-acc', 1.1],
            [120, 'alerts', 'sk-bad', 2.3],
            [180, 'cache?', 'sk-ink3', 3.5],
            [250, 'rollback', 'sk-ok', 4.9]
          ] as Array<[number, string, string, number]>
        )
          .map(([x, text, cls, t]) =>
            group(
              `sk-tb ${m.pop(t)}`,
              rect(x - 26, 64, 52, 22, cls, 6) +
                label(x, 79, text, cls === 'sk-ink3' ? 'sk-small' : 'sk-white')
            )
          )
          .join('') +
        group(
          m.fade(4.2),
          path('M154 92L206 92', 'sk-edge', 'stroke-dasharray="3 3"') +
            label(180, 56, 'false lead', 'sk-small')
        )
    ),
  fault: () => {
    const nodes: Array<[number, number, string]> = [
      [20, 72, 'Config'],
      [96, 40, 'Edge'],
      [96, 104, 'Proxy'],
      [176, 72, 'Workers'],
      [252, 72, 'Customers']
    ]
    return svg(
      path(
        'M74 89C86 89 84 57 96 57M74 89C86 89 84 121 96 121M150 57C164 57 162 89 176 89M150 121C164 121 162 89 176 89M230 89H252'
      ) +
        nodes
          .map(([x, y, text], i) => {
            const t = 0.8 + i * 0.9
            return (
              rect(x, y, 54, 34, 'sk-card', 7) +
              group(m.during(0.2, t), rect(x, y, 54, 34, 'sk-ok', 7)) +
              group(m.during(t, t + 0.7), rect(x, y, 54, 34, 'sk-warn', 7)) +
              group(m.fade(t + 0.7), rect(x, y, 54, 34, 'sk-bad', 7)) +
              label(x + 27, y + 20, text, 'sk-white')
            )
          })
          .join('') +
        traveller(
          'M47 89C86 89 84 57 123 57C164 57 162 89 203 89H279',
          0.8,
          4.6,
          'sk-bad',
          4.5
        )
    )
  },
  recover: () => {
    const nodes: Array<[number, number, string]> = [
      [20, 72, 'Config'],
      [96, 40, 'Edge'],
      [96, 104, 'Proxy'],
      [176, 72, 'Workers']
    ]
    return svg(
      path(
        'M74 89C86 89 84 57 96 57M74 89C86 89 84 121 96 121M150 57C164 57 162 89 176 89M150 121C164 121 162 89 176 89'
      ) +
        nodes
          .map(([x, y, text], i) => {
            const t = 0.8 + (3 - i) * 0.7
            return (
              group(m.during(0, t), rect(x, y, 54, 34, 'sk-bad', 7)) +
              group(m.fade(t, 0.3), rect(x, y, 54, 34, 'sk-ok', 7)) +
              label(x + 27, y + 20, text, 'sk-white')
            )
          })
          .join('') +
        [0, 1, 2]
          .map((i) =>
            group(
              m.fade(3.6 + i * 0.5),
              rect(244, 34 + i * 40, 66, 32, 'sk-card', 7) +
                bar(252, 44 + i * 40, 40, 'sk-ink2', 5) +
                `<circle cx="299" cy="${58 + i * 40}" r="5" class="sk-acc"/>` +
                bar(252, 54 + i * 40, 30, 'sk-ink3', 4)
            )
          )
          .join('')
    )
  },
  speaker: () =>
    svg(
      rect(0, 0, 320, 180, 'sk-cam', 0) +
        person(160, 108, 2.4) +
        group(
          m.move(0.6, 1.2, -200, 0, 0, 0),
          rect(18, 132, 190, 30, 'sk-acc', 6) +
            bar(30, 141, 110, 'sk-bg', 6) +
            bar(30, 151, 70, 'sk-bg', 4)
        )
    ),
  kinetic: () =>
    svg(
      label(160, 72, 'Why does one user', 'sk-mid') +
        group(
          `sk-tb ${m.during(0.6, 2.4)}`,
          label(160, 108, 'slow down…', 'sk-big')
        ) +
        group(
          `sk-tb ${m.during(2.4, 4.2)}`,
          label(160, 108, 'take down…', 'sk-big')
        ) +
        group(
          `sk-tb ${m.fade(4.2, 0.25)}`,
          label(160, 108, 'everyone?', 'sk-big') +
            rect(104, 118, 112, 5, 'sk-acc', 2.5)
        )
    ),
  onerequest: () =>
    svg(
      person(36, 96, 1.2) +
        path('M58 92H132M188 92H246') +
        box(132, 72, 56, 40, 'Server') +
        '<ellipse cx="274" cy="78" rx="24" ry="7" class="sk-card"/>' +
        path('M250 78V108A24 7 0 0 0 298 108V78', 'sk-card') +
        label(274, 98, 'DB') +
        traveller('M58 92H246', 0.6, 2.8, 'sk-acc', 5) +
        traveller('M246 100H58', 3.4, 5.6, 'sk-ok', 5) +
        group(m.during(0.6, 2.8), label(110, 82, 'GET /orders', 'sk-small')) +
        group(m.fade(3.4), label(110, 116, '200 OK · 42 ms', 'sk-small'))
    ),
  seqreveal: () => {
    const nodes: Array<[number, number, string]> = [
      [16, 72, 'Client'],
      [88, 72, 'Gateway'],
      [164, 40, 'Service'],
      [164, 104, 'Cache'],
      [244, 72, 'Database']
    ]
    return svg(
      nodes
        .map(([x, y, text], i) =>
          group(`sk-tb ${m.pop(0.4 + i * 0.7)}`, box(x, y, 58, 34, text))
        )
        .join('') +
        drawn('M74 89H88', 'sk-edge', 1.1, 0.4) +
        drawn('M146 89C156 89 154 57 164 57', 'sk-edge', 1.8, 0.4) +
        drawn('M146 89C156 89 154 121 164 121', 'sk-edge', 2.5, 0.4) +
        drawn('M222 57C234 57 232 89 244 89', 'sk-edge', 3.2, 0.4) +
        traveller(
          'M45 89H117C156 89 154 57 193 57C234 57 232 89 273 89',
          3.6,
          5.2
        ) +
        traveller('M45 89H117C156 89 154 121 193 121', 4.2, 5.6, 'sk-ok')
    )
  },
  calm: () =>
    svg(
      (
        [
          [16, 72, 'Client'],
          [88, 72, 'Edge'],
          [164, 72, 'Workers'],
          [244, 72, 'Origin']
        ] as Array<[number, number, string]>
      )
        .map(
          ([x, y, text]) =>
            box(x, y, 58, 34, text) + rect(x + 46, y + 6, 6, 6, 'sk-ok', 3)
        )
        .join('') +
        path('M74 89H88M146 89H164M222 89H244') +
        [0, 1.4, 2.8, 4.2]
          .map((t) => traveller('M45 89H273', t + 0.2, t + 2.2, 'sk-acc', 3.5))
          .join('')
    ),
  overload: () =>
    svg(
      box(196, 60, 84, 56, 'API') +
        group(`sk-tb ${m.pulse(2.2)}`, rect(190, 54, 96, 68, 'sk-sbad', 12)) +
        [0, 1, 2, 3, 4, 5]
          .map((i) =>
            group(
              `sk-tb ${m.pop(0.6 + i * 0.4)}`,
              rect(160 - i * 24, 76, 18, 24, i > 2 ? 'sk-bad' : 'sk-acc', 4)
            )
          )
          .join('') +
        group(m.fade(3), label(238, 140, 'queue backing up', 'sk-small')) +
        label(80, 60, 'requests', 'sk-small')
    ),
  zoomout: () => {
    const cells: string[] = []
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue
        const x = 60 + c * 70
        const y = 22 + r * 46
        cells.push(
          group(
            m.fade(2 + (r + c) * 0.15),
            rect(x, y, 60, 38, 'sk-card', 7) +
              bar(x + 10, y + 12, 30, 'sk-acc', 5) +
              bar(x + 10, y + 22, 40, 'sk-ink3', 5)
          )
        )
      }
    return svg(
      cells.join('') +
        group(
          `sk-tb ${m.scale(1.4, 2.2, 3, 1)}`,
          rect(130, 68, 60, 38, 'sk-card', 7) +
            bar(140, 80, 30, 'sk-acc', 5) +
            bar(140, 90, 40, 'sk-ink3', 5)
        ) +
        group(
          `sk-tb ${m.pop(3.4)}`,
          rect(92, 150, 136, 22, 'sk-acc', 11) +
            label(160, 165, 'the pattern: rate limiting', 'sk-white')
        )
    )
  },
  recap: () =>
    svg(
      [0, 1, 2]
        .map((i) =>
          group(
            m.move(0.5 + i * 0.7, 1 + i * 0.7, -30, 0, 0, 0),
            group(
              m.fade(0.5 + i * 0.7),
              `<circle cx="28" cy="${54 + i * 34}" r="7" class="sk-acc"/>` +
                bar(44, 49 + i * 34, 120 - i * 18, 'sk-ink2', 9)
            )
          )
        )
        .join('') +
        group(m.move(2.6, 3.2, 120, 0, 0, 0), camera(206, 26, 98, 128))
    ),
  status: () =>
    svg(
      group(
        m.during(0, 1.8),
        rect(60, 44, 200, 40, 'sk-ok', 20) +
          label(160, 69, 'ALL SYSTEMS OPERATIONAL', 'sk-white')
      ) +
        group(
          `sk-tb ${m.fade(1.8, 0.2)}`,
          rect(60, 44, 200, 40, 'sk-bad', 20) +
            label(160, 69, 'MAJOR OUTAGE', 'sk-white')
        ) +
        (
          [
            [100, '27m', 'down'],
            [220, '19%', 'of requests']
          ] as Array<[number, string, string]>
        )
          .map(([x, value, text], i) =>
            group(
              `sk-tb ${m.pop(2.6 + i * 0.6)}`,
              label(x, 124, value, 'sk-big') + label(x, 142, text, 'sk-small')
            )
          )
          .join('')
    )
}

/** The sketch for a slot, its motion put on the page. */
export const templateSketch = (name: string) => {
  const sketch =
    SKETCHES[name] ??
    MORE_SKETCHES[name] ??
    SPEAKER_SKETCHES[name] ??
    STORY_SKETCHES[name] ??
    PRODUCT_SKETCHES[name] ??
    SYSTEMS_SKETCHES[name] ??
    ENG_SKETCHES[name]
  const markup = sketch ? sketch() : svg('')
  flushMotion()
  return markup
}
