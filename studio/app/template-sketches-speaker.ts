// Sketches of the speaker with words and graphics on them: captions over a
// headshot, a headline beside the face, the newsroom's over-the-shoulder
// box, a camera bubble over a screen, a keynote stage and a lightboard.
import {
  bar,
  box,
  camera,
  drawn,
  group,
  label,
  motion as m,
  path,
  person,
  rect,
  svg,
  terminalFrame,
  windowFrame
} from './template-sketch-kit'

type Sketch = () => string
let serial = 0

/** The camera filling the frame, the speaker in it. */
const headshot = (cx = 160, s = 2.4) =>
  rect(0, 0, 320, 180, 'sk-cam', 0) + person(cx, 112, s)

/** A caption's width, word by word, at the caption size. */
const wordWidth = (word: string) => word.length * 7.4 + 2
/**
 * One caption line, centred: each word arrives in turn from second `from`,
 * the key words in the accent, and the line clears at second `until`.
 */
const caption = (
  words: string[],
  hot: string[],
  y: number,
  from: number,
  until: number
) => {
  const gap = 5
  const total =
    words.reduce((sum, word) => sum + wordWidth(word), 0) +
    gap * (words.length - 1)
  let x = 160 - total / 2
  return words
    .map((word, i) => {
      const at = x
      x += wordWidth(word) + gap
      return group(
        m.during(from + i * 0.28, until),
        label(
          at,
          y,
          word,
          hot.includes(word) ? 'sk-cap sk-cap-hi' : 'sk-cap',
          'start'
        )
      )
    })
    .join('')
}

/** A round camera bubble, the speaker inside it. */
const bubbleCam = (cx: number, cy: number, r: number) => {
  const clip = `sk-bubble-${++serial}`
  return (
    `<clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
    `<g clip-path="url(#${clip})">${rect(cx - r, cy - r, r * 2, r * 2, 'sk-cam', 0)}${person(cx, cy + r * 0.32, r / 30)}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" class="sk-ring"/>`
  )
}

export const SPEAKER_SKETCHES: Record<string, Sketch> = {
  headcaps: () =>
    svg(
      headshot() +
        caption(
          ['We', 'shipped', 'a', 'bad', 'config'],
          ['bad', 'config'],
          160,
          0.4,
          3
        ) +
        caption(['and', 'checkout', 'went', 'dark'], ['dark'], 160, 3.4, 6.2)
    ),
  headline: () =>
    svg(
      headshot(226, 2.3) +
        group(`sk-tb ${m.pop(0.7)}`, label(96, 84, '2h 14m', 'sk-cap-big')) +
        group(
          m.fade(1.3),
          label(96, 104, 'of failed checkouts', 'sk-cap-small')
        ) +
        group(`sk-tl ${m.grow(1.7, 0.5)}`, rect(42, 114, 108, 4, 'sk-acc', 2))
    ),
  anchor: () =>
    svg(
      headshot(92, 2.1) +
        group(
          `sk-tb ${m.pop(0.6)}`,
          rect(170, 20, 136, 86, 'sk-glass', 8) +
            label(182, 36, 'TIMELINE', 'sk-cap-tag', 'start') +
            rect(184, 70, 108, 2, 'sk-onacc', 1) +
            [
              [194, 'sk-acc', 1.2],
              [236, 'sk-bad', 1.7],
              [278, 'sk-ok', 2.2]
            ]
              .map(([x, cls, t]) =>
                group(
                  `sk-tb ${m.pop(t as number)}`,
                  `<circle cx="${x}" cy="71" r="6" class="${cls}"/>`
                )
              )
              .join('') +
            label(194, 92, '14:02', 'sk-cap-small', 'middle') +
            label(278, 92, '16:16', 'sk-cap-small', 'middle')
        ) +
        group(
          m.move(2.6, 3.1, -230, 0, 0, 0),
          rect(14, 134, 118, 30, 'sk-acc', 4) +
            label(24, 153, 'CHECKOUT OUTAGE', 'sk-white', 'start')
        )
    ),
  bubble: () =>
    svg(
      windowFrame(10, 10, 300, 160) +
        bar(30, 34, 90, 'sk-ink2', 8) +
        bar(30, 52, 200, 'sk-ink3', 6) +
        bar(30, 64, 170, 'sk-ink3', 6) +
        group(
          `sk-tb ${m.pop(1.6)}`,
          rect(150, 92, 96, 30, 'sk-acc', 7) +
            label(198, 111, 'Run query', 'sk-white')
        ) +
        group(
          m.move(0.4, 1.5, 120, 60, 0, 0),
          path('M226 112l0 14 4-4 4 8 3-1-4-8 6 0z', 'sk-cursor')
        ) +
        group(
          m.fade(2.4),
          label(160, 142, '✓ 1,204 rows · 38 ms', 'sk-small')
        ) +
        bubbleCam(52, 128, 30)
    ),
  bubbleterm: () => {
    const clip = `sk-bt-${++serial}`
    return svg(
      terminalFrame(10, 12, 300, 156) +
        `<clipPath id="${clip}"><rect class="sk-tl ${m.type(0.5, 1.6)}" x="24" y="40" width="270" height="18"/></clipPath>` +
        `<g clip-path="url(#${clip})"><text x="24" y="52" class="sk-term">$ curl -s localhost:8080/health</text></g>` +
        group(
          m.fade(2.3),
          '<text x="24" y="74" class="sk-term-dim">{"status":"ok","p99":"41ms"}</text>'
        ) +
        group(
          m.fade(2.8),
          rect(20, 82, 224, 16, 'sk-bad', 3, 'opacity=".28"') +
            '<text x="24" y="94" class="sk-term">{"queue":4182,"retries":"off"}</text>'
        ) +
        bubbleCam(266, 126, 30)
    )
  },
  question: () =>
    svg(
      headshot(226, 2.3) +
        group(
          `sk-tb ${m.pop(0.5)}`,
          rect(14, 26, 180, 56, 'sk-glass', 12) +
            label(28, 46, 'A VIEWER ASKS', 'sk-cap-tag', 'start') +
            label(28, 68, 'Why not just cache it?', 'sk-cap', 'start')
        ) +
        group(m.fade(0.9), path('M44 82l-6 14 22-14z', 'sk-glass'))
    ),
  alert: () =>
    svg(
      headshot(220, 2.3) +
        group(
          `sk-tb ${m.pop(0.4)}`,
          rect(14, 20, 172, 42, 'sk-bad', 8) +
            label(26, 36, 'CRITICAL · PAGED', 'sk-cap-tag', 'start') +
            label(26, 52, 'checkout 5xx above 20%', 'sk-cap-small', 'start')
        ) +
        group(
          m.move(1.2, 1.6, -200, 0, 0, 0),
          rect(14, 132, 126, 30, 'sk-glass', 4) +
            rect(14, 132, 5, 30, 'sk-bad', 1) +
            label(28, 152, '02:14:07 UTC', 'sk-cap', 'start')
        )
    ),
  readalong: () =>
    svg(
      windowFrame(10, 10, 300, 160) +
        bar(30, 28, 160, 'sk-ink2', 10) +
        [0, 1, 2, 3, 4, 5]
          .map((i) => bar(30, 50 + i * 14, 230 - (i % 3) * 30, 'sk-ink3', 7))
          .join('') +
        [0, 1, 2]
          .map((i) =>
            group(
              `sk-tl ${m.grow(0.6 + i * 1.2, 0.9)}`,
              rect(
                27,
                47 + i * 14,
                236 - (i % 3) * 30,
                13,
                'sk-acc',
                3,
                'opacity=".26"'
              )
            )
          )
          .join('') +
        bubbleCam(266, 128, 28)
    ),
  keynote: () =>
    svg(
      rect(0, 0, 320, 180, 'sk-chip', 0) +
        '<ellipse cx="160" cy="170" rx="120" ry="34" class="sk-spot"/>' +
        group(
          `sk-tb ${m.scale(0.3, 1.6, 0.85, 1)}`,
          group(m.fade(0.3, 0.8), label(160, 76, 'Studio 2', 'sk-cap-huge'))
        ) +
        person(160, 128, 1.7) +
        group(m.fade(2.6), label(160, 164, 'ONE MORE THING', 'sk-cap-tag'))
    ),
  roundup: () =>
    svg(
      headshot(236, 2.2) +
        rect(16, 18, 52, 20, 'sk-acc', 10) +
        label(42, 32, 'v2.4', 'sk-white') +
        [
          ['Faster builds', 0.4, 2.4],
          ['Live preview', 2.6, 4.4],
          ['Dark mode', 4.6, 6.3]
        ]
          .map(([title, a, b], i) =>
            group(
              m.during(a as number, b as number),
              group(
                m.move(a as number, (a as number) + 0.4, -40, 0, 0, 0),
                rect(16, 62, 150, 58, 'sk-glass', 8) +
                  rect(28, 74, 30, 14, 'sk-ok', 4) +
                  label(43, 84, 'NEW', 'sk-white') +
                  label(28, 106, title as string, 'sk-cap', 'start') +
                  label(150, 84, `${i + 1}/3`, 'sk-cap-small', 'end')
              )
            )
          )
          .join('')
    ),
  whiteboard: () =>
    svg(
      rect(12, 14, 196, 152, 'sk-chip', 10) +
        drawn(
          'M38 64h44v28H38zM128 52h52v28h-52zM128 104h52v28h-52z',
          'sk-chalk',
          0.4,
          1.4
        ) +
        drawn(
          'M82 78C104 78 106 66 128 66M82 78C104 78 106 118 128 118',
          'sk-chalk-acc',
          1.9,
          1
        ) +
        group(m.fade(3), label(60, 112, 'request', 'sk-cap-small', 'middle')) +
        group(m.fade(0.2), camera(216, 14, 92, 152))
    ),
  behind: () =>
    svg(
      rect(0, 0, 320, 180, 'sk-cam', 0) +
        group(
          `sk-tb ${m.scale(0.3, 1.4, 1.25, 1)}`,
          group(m.fade(0.3, 0.5), label(160, 96, 'RATE LIMITS', 'sk-cap-huge'))
        ) +
        person(160, 118, 2.5) +
        group(
          m.fade(2.2),
          label(160, 166, 'the part nobody explains', 'sk-cap-small')
        )
    ),
  jumpcut: () =>
    svg(
      rect(0, 0, 320, 180, 'sk-cam', 0) +
        group(`sk-tb ${m.scale(2.2, 2.25, 1, 1.32)}`, person(160, 112, 2.4)) +
        group(
          m.during(0.4, 2.2),
          label(160, 160, 'here’s the catch', 'sk-cap')
        ) +
        group(m.fade(2.3, 0.1), label(160, 160, 'it never retried', 'sk-cap'))
    ),
  quote: () =>
    svg(
      label(44, 80, '“', 'sk-quote-mark') +
        bar(64, 58, 210, 'sk-ink2', 11) +
        bar(64, 78, 190, 'sk-ink2', 11) +
        group(`sk-tl ${m.grow(1.2, 0.8)}`, rect(64, 92, 120, 4, 'sk-acc', 2)) +
        bar(64, 98, 140, 'sk-ink2', 11) +
        group(
          m.fade(2.2),
          bar(64, 128, 70, 'sk-ink3', 7) +
            `<circle cx="54" cy="131" r="6" class="sk-acc"/>`
        )
    ),
  lowerthird: () =>
    svg(
      headshot(170, 2.4) +
        group(
          m.move(0.5, 1, -240, 0, 0, 0),
          rect(16, 128, 170, 36, 'sk-glass', 4) +
            rect(16, 128, 5, 36, 'sk-acc', 1) +
            label(30, 144, 'Your name', 'sk-cap', 'start') +
            label(30, 157, 'Your role, your team', 'sk-cap-small', 'start')
        ) +
        group(m.fade(3.2), box(196, 22, 108, 30, 'Lesson 1 of 3', 'sk-card'))
    )
}
