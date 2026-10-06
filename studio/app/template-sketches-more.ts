// The rest of the slot sketches: logs and safeguards, product capture, proof,
// terminals and code. Terminals keep their own dark ground in every look.
import {
  bar,
  box,
  camera,
  drawn,
  group,
  label,
  motion as m,
  path,
  rect,
  svg,
  traveller,
  windowFrame
} from './template-sketch-kit'

// Each typing clip gets its own id: a shared one breaks when the first copy
// sits in a hidden part of the page.
let serial = 0

const terminal = (x: number, y: number, w: number, h: number) =>
  rect(x, y, w, h, 'sk-chip', 10) +
  `<circle cx="${x + 12}" cy="${y + 12}" r="2.4" class="sk-bad"/><circle cx="${x + 20}" cy="${y + 12}" r="2.4" class="sk-warn"/><circle cx="${x + 28}" cy="${y + 12}" r="2.4" class="sk-ok"/>`

export const MORE_SKETCHES: Record<string, () => string> = {
  logzoom: () => {
    const rows: string[] = []
    for (let i = 0; i < 9; i++)
      rows.push(
        bar(
          24,
          24 + i * 15,
          120 + ((i * 37) % 120),
          i === 5 ? 'sk-bad' : 'sk-ink3',
          6
        )
      )
    return svg(
      rows.join('') +
        group(
          `sk-tb ${m.pop(1.6)}`,
          rect(118, 96, 188, 40, 'sk-card', 8) +
            label(130, 121, 'ERR rule file 2× its limit', 'sk-mono', 'start')
        ) +
        group(m.fade(1.4), path('M190 99L176 105', 'sk-sbad'))
    )
  },
  safeguard: () =>
    svg(
      box(240, 62, 64, 52, 'Origin') +
        group(
          m.move(0.6, 1.3, 0, -120, 0, 0),
          rect(196, 50, 14, 76, 'sk-acc', 3) +
            path('M196 62h14M196 76h14M196 90h14M196 104h14', 'sk-gate')
        ) +
        group(
          m.during(1.6, 3.4),
          group(
            m.move(1.6, 3.2, 0, 0, 160, 0),
            '<circle cx="24" cy="88" r="6" class="sk-bad"/>'
          )
        ) +
        group(
          `sk-tb ${m.pop(3.3)}`,
          '<circle cx="186" cy="88" r="12" class="sk-sbad"/>'
        ) +
        group(m.fade(3.6), label(203, 146, 'caught by the guard', 'sk-small'))
    ),
  resultfirst: () =>
    svg(
      windowFrame(30, 18, 260, 144) +
        group(
          m.during(0, 3.2),
          [0, 1, 2, 3]
            .map(
              (i) =>
                rect(48, 40 + i * 28, 224, 20, 'sk-ink3', 5) +
                rect(52, 44 + i * 28, 12, 12, 'sk-ok', 3) +
                bar(72, 47 + i * 28, 120 - i * 15, 'sk-ink2', 6)
            )
            .join('')
        ) +
        group(
          `sk-tb ${m.during(3.2, 4.4)}`,
          '<circle cx="160" cy="92" r="22" class="sk-acc"/><path d="M152 92l10-8v16z" class="sk-onacc"/><path d="M166 84v16" class="sk-onacc-line"/>'
        ) +
        group(
          m.fade(4.4),
          bar(48, 44, 120, 'sk-ink3', 8) +
            label(160, 110, 'start here', 'sk-small')
        )
    ),
  pileup: () =>
    svg(
      [0, 1, 2, 3, 4]
        .map((i) =>
          group(
            `sk-tb ${m.pop(0.4 + i * 0.55)}`,
            rect(
              46 + (i % 2) * 8,
              130 - i * 22,
              120,
              18,
              i === 4 ? 'sk-bad' : 'sk-card',
              5
            ) + bar(56 + (i % 2) * 8, 136 - i * 22, 70, 'sk-ink3', 5)
          )
        )
        .join('') +
        '<circle cx="238" cy="90" r="42" class="sk-card"/>' +
        group(
          m.spin(),
          path('M238 90V58', 'sk-sacc', 'stroke-linecap="round"'),
          'style="transform-origin:238px 90px"'
        ) +
        '<circle cx="238" cy="90" r="4" class="sk-ink"/>'
    ),
  cursorzoom: () =>
    svg(
      group(
        m.scale(3, 3.8, 1, 1.55),
        windowFrame(16, 14, 288, 152) +
          rect(16, 26, 62, 140, 'sk-ink3', 0) +
          [0, 1, 2, 3]
            .map((i) => bar(26, 40 + i * 16, 40, 'sk-ink2', 5))
            .join('') +
          rect(96, 40, 190, 50, 'sk-card', 7) +
          bar(108, 52, 110, 'sk-ink2', 7) +
          bar(108, 68, 150, 'sk-ink3', 6) +
          rect(204, 104, 82, 26, 'sk-acc', 6) +
          label(245, 121, 'Deploy', 'sk-white') +
          group(
            `sk-tb ${m.pulse(2.6)}`,
            '<circle cx="245" cy="117" r="14" class="sk-sacc"/>'
          ),
        'style="transform-origin:245px 117px"'
      ) +
        group(
          m.move(0.4, 2.4, 0, 0, 132, 52),
          '<path d="M113 65l0 18 5-5 4 9 3-1-4-9 7 0z" class="sk-cursor"/>'
        ) +
        group(
          `sk-tb ${m.pop(4)}`,
          rect(96, 22, 128, 22, 'sk-chip', 11) +
            label(160, 37, 'Deploys in one click', 'sk-white')
        )
    ),
  peel: () =>
    svg(
      group(
        m.fade(1.8),
        rect(14, 16, 292, 148, 'sk-card', 10) +
          box(40, 70, 64, 36, 'Button') +
          box(128, 70, 64, 36, 'Queue') +
          box(216, 70, 64, 36, 'Workers') +
          path('M104 88H128M192 88H216') +
          rect(40, 70, 64, 36, 'sk-sacc', 7)
      ) +
        group(
          m.move(1.4, 2.6, 0, 0, 0, -170),
          windowFrame(14, 16, 292, 148) +
            bar(36, 44, 120, 'sk-ink2', 8) +
            bar(36, 62, 180, 'sk-ink3', 6) +
            rect(40, 70, 64, 36, 'sk-acc', 7) +
            label(72, 92, 'Deploy', 'sk-white')
        )
    ),
  bars: () =>
    svg(
      label(26, 56, 'Before', 'sk-label', 'start') +
        label(26, 112, 'After', 'sk-label', 'start') +
        group(
          `sk-tl ${m.grow(0.4, 1.4)}`,
          rect(80, 42, 210, 20, 'sk-before', 5)
        ) +
        group(m.fade(1.8), label(286, 56, '320 ms', 'sk-small', 'end')) +
        group(`sk-tl ${m.grow(2, 0.8)}`, rect(80, 98, 28, 20, 'sk-acc', 5)) +
        group(m.fade(2.8), label(116, 112, '40 ms', 'sk-mid', 'start')) +
        group(
          `sk-tb ${m.pop(3.4)}`,
          rect(196, 128, 96, 26, 'sk-ok', 13) +
            label(244, 145, '8× FASTER', 'sk-white')
        )
    ),
  terminal: () => {
    const clip = `sk-type-${++serial}`
    return svg(
      terminal(14, 30, 196, 120) +
        `<clipPath id="${clip}"><rect class="sk-tl ${m.type(0.6, 1.8)}" x="26" y="60" width="170" height="16"/></clipPath>` +
        `<g clip-path="url(#${clip})"><text x="26" y="72" class="sk-term">$ npx studio init</text></g>` +
        group(
          m.fade(2.8),
          '<text x="26" y="94" class="sk-term-ok">✓ ready in 3s</text>'
        ) +
        group(
          m.fade(3.2),
          '<text x="26" y="114" class="sk-term-dim">docs: studio.dev/start</text>'
        ) +
        group(m.fade(0.2), camera(222, 30, 84, 120))
    )
  },
  codehl: () => {
    const rows: string[] = []
    for (let i = 0; i < 8; i++)
      rows.push(
        label(30, 34 + i * 17, String(i + 1), 'sk-small', 'end') +
          bar(
            40 + (i % 3) * 12,
            29 + i * 17,
            90 + ((i * 41) % 130),
            i === 3 || i === 4 ? 'sk-ink2' : 'sk-ink3',
            6
          )
      )
    return svg(
      rect(10, 14, 300, 152, 'sk-card', 10) +
        group(
          `sk-tl ${m.grow(1, 0.8)}`,
          rect(36, 76, 270, 32, 'sk-bad', 4, 'opacity=".22"')
        ) +
        rows.join('') +
        group(
          m.fade(2.2),
          rect(206, 120, 96, 22, 'sk-bad', 11) +
            label(254, 135, 'retries by hand', 'sk-white')
        )
    )
  },
  stream: () =>
    svg(
      terminal(14, 16, 210, 148) +
        [0, 1, 2, 3, 4, 5]
          .map((i) =>
            group(
              m.fade(0.4 + i * 0.45, 0.2),
              rect(
                26,
                34 + i * 18,
                80 + ((i * 29) % 90),
                6,
                i === 5 ? 'sk-term-bar-ok' : 'sk-term-bar',
                3
              )
            )
          )
          .join('') +
        group(
          `sk-tb ${m.pop(3.4)}`,
          rect(234, 54, 72, 72, 'sk-card', 12) +
            '<path d="M254 90l10 10 20-22" class="sk-sok" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
        ) +
        group(m.fade(0.2), camera(248, 134, 58, 38))
    ),
  layers: () =>
    svg(
      ['Edge', 'API', 'Queue', 'Workers', 'Database']
        .map((text, i) => {
          const t = 0.6 + i * 0.8
          return (
            rect(70, 16 + i * 31, 180, 25, 'sk-card', 6) +
            group(
              m.during(t, t + 0.9),
              rect(70, 16 + i * 31, 180, 25, 'sk-acc', 6)
            ) +
            label(160, 32 + i * 31, text)
          )
        })
        .join('') +
        traveller('M48 28V152', 0.6, 4.6, 'sk-acc', 5) +
        path('M48 22V158', 'sk-edge', 'stroke-dasharray="3 3"')
    ),
  limits: () =>
    svg(
      (
        [
          ['Batch jobs', true],
          ['Websockets', false],
          ['Multi-region', true]
        ] as Array<[string, boolean]>
      )
        .map(([text, works], i) => {
          const t = 1 + i * 0.8
          return group(
            `sk-tb ${m.flip(t)}`,
            rect(16 + i * 100, 40, 88, 100, 'sk-card', 10) +
              label(60 + i * 100, 66, text) +
              group(
                m.fade(t + 0.2, 0.1),
                `<circle cx="${60 + i * 100}" cy="104" r="16" class="${works ? 'sk-ok' : 'sk-warn'}"/>` +
                  label(
                    60 + i * 100,
                    108,
                    works ? 'works' : 'not yet',
                    'sk-white'
                  )
              )
          )
        })
        .join('')
    ),
  steps: () =>
    svg(
      [0, 1, 2]
        .map((i) =>
          group(
            `sk-tb ${m.pop(0.6 + i * 0.8)}`,
            `<circle cx="${40 + i * 58}" cy="64" r="15" class="sk-acc"/>` +
              label(40 + i * 58, 68, String(i + 1), 'sk-white') +
              bar(22 + i * 58, 92, 40, 'sk-ink2', 6) +
              bar(26 + i * 58, 104, 30, 'sk-ink3', 5)
          )
        )
        .join('') +
        drawn('M55 64H83M113 64H141', 'sk-edge', 1.2, 1.4) +
        group(m.fade(0.2), camera(206, 26, 98, 128))
    )
}
