// Sketches for more engineering stories: a delivery journey whose waiting
// collapses, a code heatmap cooling down, a test pyramid turning into a
// honeycomb, a countdown to a peak day, a league table and numbered lessons.
// Text stays out of the top left, where a card names its slot.
import {
  drawn,
  group,
  label,
  motion as m,
  path,
  rect,
  svg
} from './template-sketch-kit'

type Sketch = () => string

const pill = (x: number, y: number, w: number, text: string, cls: string) =>
  rect(x, y, w, 20, cls, 10) + label(x + w / 2, y + 14, text, 'sk-white')

export const ENG_SKETCHES: Record<string, Sketch> = {
  journey: () => {
    const steps = ['Code', 'Review', 'CI', 'Staging', 'Prod']
    const before = [16, 72, 128, 184, 240]
    const after = [56, 104, 152, 200, 248]
    return svg(
      label(296, 40, 'Idea to production', 'sk-label', 'end') +
        steps
          .map((step, i) =>
            group(
              m.move(2, 2.8, before[i] - after[i], 0, 0, 0),
              rect(after[i], 74, 44, 30, 'sk-card', 7) +
                label(after[i] + 22, 93, step, 'sk-small')
            )
          )
          .join('') +
        group(
          m.until(2),
          [0, 1, 2, 3]
            .map((i) => rect(before[i] + 46, 84, 8, 10, 'sk-ink3', 2))
            .join('') + label(160, 132, '2 weeks, mostly waiting', 'sk-label')
        ) +
        group(m.fade(2.8), label(160, 132, 'under an hour', 'sk-label')) +
        group(
          `sk-tb ${m.pop(3.4)}`,
          pill(118, 142, 84, 'GOLDEN PATH', 'sk-acc')
        )
    )
  },
  heatmap: () => {
    const heat = [
      3, 1, 0, 2, 3, 1, 0, 0, 2, 1, 3, 0, 1, 2, 0, 1, 0, 3, 1, 0, 2, 0, 1, 0
    ]
    const hot = ['sk-ink3', 'sk-warn', 'sk-bad', 'sk-bad']
    return svg(
      label(296, 36, 'Code hotspots', 'sk-label', 'end') +
        heat
          .map((level, i) => {
            const x = 40 + (i % 8) * 30
            const y = 50 + Math.floor(i / 8) * 34
            return (
              rect(x, y, 26, 28, hot[level], 4, 'opacity=".85"') +
              (level > 1
                ? group(
                    m.fade(2 + (i % 5) * 0.3, 0.6),
                    rect(x, y, 26, 28, 'sk-ok', 4)
                  )
                : '')
            )
          })
          .join('') +
        group(
          `sk-tb ${m.pop(3.8)}`,
          pill(112, 154, 96, '−70% HOTSPOTS', 'sk-ok')
        )
    )
  },
  testshape: () => {
    const hex = (cx: number, cy: number) =>
      `<path d="M${cx - 16} ${cy}l8-14h16l8 14-8 14h-16z" class="sk-card"/>`
    return svg(
      group(
        m.until(2.4),
        path('M160 30L260 150H60Z', 'sk-card') +
          path('M110 90H210M85 120H235', 'sk-edge') +
          label(160, 70, 'E2E', 'sk-small') +
          label(160, 108, 'Integration', 'sk-small') +
          label(160, 140, 'Unit', 'sk-small')
      ) +
        group(
          m.fade(2.4, 0.5),
          [
            [160, 62],
            [132, 78],
            [188, 78],
            [132, 110],
            [188, 110],
            [160, 94],
            [160, 126]
          ]
            .map(([cx, cy]) => hex(cx, cy))
            .join('') + label(160, 160, 'Integration-heavy', 'sk-label')
        ) +
        group(m.fade(3.4), label(296, 40, 'CI: 41 → 12 min', 'sk-label', 'end'))
    )
  },
  countdown: () =>
    svg(
      (
        [
          ['T−30 days', 0.2, 1.2],
          ['T−7 days', 1.2, 2.2]
        ] as Array<[string, number, number]>
      )
        .map(([text, a, b]) =>
          group(m.during(a, b), label(296, 44, text, 'sk-mid', 'end'))
        )
        .join('') +
        group(m.fade(2.2, 0.2), label(296, 44, 'Peak day', 'sk-mid', 'end')) +
        path('M30 150H296M30 150V60') +
        group(
          m.fade(0.3),
          path(
            'M32 140C90 136 150 110 200 90S260 70 292 64',
            'sk-edge sk-dashed'
          )
        ) +
        drawn(
          'M32 142C90 138 150 116 200 96S262 76 292 72',
          'sk-sacc',
          2.4,
          1.6
        ) +
        label(240, 112, 'forecast', 'sk-small') +
        group(m.fade(3.6), label(246, 84, 'actual', 'sk-small')) +
        group(
          `sk-tb ${m.pop(4.2)}`,
          pill(46, 70, 110, 'HELD AT 3× LOAD', 'sk-ok')
        )
    ),
  league: () => {
    const rows: Array<[string, string, number]> = [
      ['Model C', '0.51%', 3],
      ['Model A', '0.89%', 1],
      ['Model D', '1.24%', 0],
      ['Model B', '2.07%', 2]
    ]
    return svg(
      rect(14, 14, 292, 152, 'sk-card', 12) +
        label(296, 36, 'Failure rate, Q3', 'sk-label', 'end') +
        rows
          .map(([name, rate, from], i) =>
            group(
              m.move(0.6, 1.6, 0, (from - i) * 28, 0, 0),
              label(34, 66 + i * 28, String(i + 1), 'sk-title', 'start') +
                label(54, 66 + i * 28, name, 'sk-label', 'start') +
                rect(
                  132,
                  56 + i * 28,
                  120 - i * 22,
                  12,
                  i === 3 ? 'sk-bad' : 'sk-ink3',
                  3
                ) +
                label(292, 66 + i * 28, rate, 'sk-mono', 'end')
            )
          )
          .join('')
    )
  },
  numbered: () =>
    svg(
      (
        [
          ['07', 'Most outages start with a config change', 0.2, 2.2],
          ['08', 'Boring technology is a feature', 2.2, 4.2],
          ['09', 'Delete code with pride', 4.2, 6.3]
        ] as Array<[string, string, number, number]>
      )
        .map(([n, text, a, b]) =>
          group(
            m.during(a, b),
            group(`sk-tb ${m.pop(a)}`, label(92, 112, n, 'sk-hero')) +
              rect(150, 74, 4, 52, 'sk-acc', 2) +
              label(
                166,
                96,
                text.split(' ').slice(0, 3).join(' '),
                'sk-title',
                'start'
              ) +
              label(
                166,
                112,
                text.split(' ').slice(3).join(' '),
                'sk-title',
                'start'
              )
          )
        )
        .join('')
    )
}
