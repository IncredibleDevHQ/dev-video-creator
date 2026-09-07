// Scene block: a video-notebook entity derived from a presentation page. Each
// scene wraps one mother SVG (copied at derive time — fork semantics, the
// copy may diverge) plus the director's work around it: arc role, plain-voice
// director notes, a storyboard strip mocking each layout moment, coach cues,
// and the narration beats. Scenes share the slide editor / assist pipeline
// (same svg + steps + structureApproved attrs).
import { mergeAttributes, Node } from '@tiptap/core'
import { dialogueCaption, dialogueSection } from './dialogue-card'

export type SceneStoryboardEntry = {
  label?: string
  family?: string
  treatment?: string
  note?: string
}

const ACCENT = '#4ade80'
const INK = '#0b0e0c'
const PANEL = '#22282a'
const LINE = '#3a4440'
const DIM = '#1a1f1d'

// The storyboard mock: one tiny frame (160×90) per layout moment, built from
// the stage family geometry (fractions of the frame — see stage-families.md)
// plus the treatment. Shipped as a data-URL <img> because ProseMirror's DOM
// serializer cannot create real SVG elements.
const storyboardMockSvg = (entry: SceneStoryboardEntry) => {
  const family = entry.family || 'content-pip'
  const treatment = entry.treatment || ''
  const parts: string[] = []
  const contentPanel = (x: number, y: number, w: number, h: number, opacity = 1) => {
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${PANEL}" opacity="${opacity}"/>`,
      `<rect x="${x + 6}" y="${y + 8}" width="${w * 0.55}" height="4" rx="2" fill="${LINE}" opacity="${opacity}"/>`,
      `<rect x="${x + 6}" y="${y + 16}" width="${w * 0.8}" height="3" rx="1.5" fill="${LINE}" opacity="${opacity * 0.8}"/>`,
      `<rect x="${x + 6}" y="${y + 23}" width="${w * 0.65}" height="3" rx="1.5" fill="${LINE}" opacity="${opacity * 0.8}"/>`,
    )
  }
  const speaker = (cx: number, cy: number, scale: number) => {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${9 * scale}" fill="${ACCENT}"/>`,
      `<path d="M ${cx - 14 * scale} ${cy + 26 * scale} q 0 ${-16 * scale} ${14 * scale} ${-16 * scale} q ${14 * scale} 0 ${14 * scale} ${16 * scale} z" fill="${ACCENT}"/>`,
    )
  }
  if (family === 'speaker-full') {
    // Person full frame, middle vertical third, content absent or dimmed.
    contentPanel(98, 16, 54, 52, 0.25)
    speaker(52, 40, 1.6)
  } else if (family === 'speaker-panel') {
    // Person column left (0.56 W), content panel right.
    parts.push(`<rect x="6" y="8" width="84" height="68" rx="3" fill="${DIM}"/>`)
    speaker(48, 34, 1.3)
    contentPanel(96, 8, 58, 68)
  } else if (family === 'split') {
    // Person left half, content right half, equal weight.
    parts.push(`<rect x="4" y="8" width="74" height="68" rx="3" fill="${DIM}"/>`)
    speaker(41, 34, 1.25)
    contentPanel(84, 8, 72, 68)
  } else if (family === 'content-card') {
    // Content card most of the frame, person in the right margin.
    contentPanel(6, 8, 112, 66)
    parts.push(`<rect x="122" y="8" width="32" height="66" rx="3" fill="${DIM}"/>`)
    speaker(138, 34, 0.85)
  } else {
    // content-pip: content full frame, chip Ø ≈ 0.18 W bottom right (bottom
    // edge ≤ 0.84 H).
    contentPanel(6, 6, 148, 66)
    speaker(133, 60, 1.05)
  }
  if (treatment === 'overlay') {
    // Lower-third strap on the right two-thirds.
    parts.push(
      `<rect x="52" y="60" width="102" height="14" rx="3" fill="${ACCENT}" opacity="0.85"/>`,
      `<rect x="58" y="64" width="70" height="5" rx="2.5" fill="${INK}" opacity="0.75"/>`,
    )
  }
  if (treatment === 'glow-bed-hero') {
    // Dimmed bed + one glowing accent bar beside the person.
    parts.push(
      `<rect x="0" y="0" width="160" height="90" fill="${INK}" opacity="0.45"/>`,
      `<rect x="20" y="30" width="46" height="10" rx="5" fill="${ACCENT}" opacity="0.95" stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="4"/>`,
    )
  }
  // Caption band along the bottom of every frame.
  parts.push(`<rect x="0" y="76" width="160" height="6" rx="3" fill="${LINE}" opacity="0.5"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" rx="6" fill="${INK}"/>${parts.join('')}</svg>`
}

export const storyboardMockUrl = (entry: SceneStoryboardEntry) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(storyboardMockSvg(entry))}`

export const SceneBlock = Node.create({
  name: 'scene',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      title: { default: '' },
      // Inline SVG markup, copied from the mother notebook at derive time.
      svg: { default: '' },
      // Poster URL (the mother page's public URL).
      svgSrc: { default: '' },
      // Provenance: the mother notebook id this scene was derived from.
      derivedFrom: { default: '' },
      // Derived pages come from an approved presentation layer.
      structureApproved: { default: true },
      arcRole: { default: '' },
      directorNotes: { default: '' },
      storyboard: { default: [] },
      cues: { default: [] },
      // Same shape as slide steps: [{ title, explanation, reveals, verb }].
      steps: { default: [] },
      directorBrief: { default: null },
      // Script-first: the script is the source of truth (one paragraph per
      // beat, [directions] in brackets); the V2 motion plan is derived from
      // it and runs the driver; steps are the V1 view of the plan.
      script: { default: '' },
      motion: { default: null },
      // What the deterministic director derived (kind, role, required area,
      // storyboard, cues, notes, legibility) — kept apart from the
      // handcrafted fields above so a gold scene is never overwritten.
      directorAuto: { default: null },
      requiredArea: { default: '' },
      // The workflow state: the dialogue is approved before it is broken down
      // into windows of attention; the windows are approved before motion is
      // planned from them. pace = { granularity, wpm }.
      scriptApproved: { default: false },
      pace: { default: null },
      windows: { default: [] },
      breakdownApproved: { default: false },
      // The dialogue as authored (paragraphs), kept for re-cuts.
      sourceText: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-block-type="scene"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const {
      title,
      svg,
      svgSrc,
      derivedFrom,
      structureApproved,
      arcRole,
      directorNotes,
      storyboard,
      cues,
      steps,
      directorBrief,
      script,
      motion,
      directorAuto,
      requiredArea,
      scriptApproved,
      pace,
      windows,
      breakdownApproved,
      ...attributes
    } = HTMLAttributes
    const entries = (Array.isArray(storyboard) ? storyboard : []) as SceneStoryboardEntry[]
    const cueList = (Array.isArray(cues) ? cues : []) as string[]
    const stepList = (Array.isArray(steps) ? steps : []) as Array<{
      title?: string
      explanation?: string
      reveals?: string[]
    }>
    const role = String(arcRole || 'scene')
    const animated = stepList.some(step => (step.reveals || []).length > 0)
    const planned = Boolean(motion && typeof motion === 'object' && Array.isArray((motion as { steps?: unknown[] }).steps) && (motion as { steps: unknown[] }).steps.length)
    const scriptText = String(script || '')
    void scriptText
    void planned
    void animated
    void stepList
    void windows
    void scriptApproved
    void breakdownApproved
    void pace
    const area = String(requiredArea || '')
    const auto = (directorAuto && typeof directorAuto === 'object' ? directorAuto : null) as { kind?: string; legibility?: { minTextPx?: Record<string, number> } } | null
    return [
      'figure',
      mergeAttributes(attributes, {
        'data-block-type': 'scene',
        class: 'notebook-media-block notebook-scene-block',
      }),
      [
        'div',
        { class: 'scene-head' },
        ['span', { class: 'scene-badge' }, 'SCENE'],
        ['strong', { class: 'scene-title' }, title ? String(title) : 'Scene'],
        ['span', { class: `scene-arc scene-arc-${role}` }, role],
        ...(area ? [['span', { class: `scene-area scene-area-${area}`, title: auto?.kind ? `${auto.kind} · needs ${area === 'none' ? 'no' : `a ${area}`} area` : '' }, area === 'none' ? 'behind you' : area]] : []),
        [
          'button',
          { type: 'button', class: 'notebook-image-action', 'data-slide-action': 'edit' },
          'Dialogue & motion',
        ],
        [
          'button',
          { type: 'button', class: 'notebook-image-action scene-animate-action', 'data-slide-action': 'animate', title: 'Re-plan the motion from the dialogue, without opening the studio' },
          'Re-plan',
        ],
      ],
      ...(derivedFrom
        ? [
            [
              'div',
              { class: 'scene-provenance' },
              '↳ derived from the presentation notebook',
            ],
          ]
        : []),
      ...(svgSrc
        ? [['img', { class: 'scene-poster', src: String(svgSrc), alt: String(title || 'Scene') }]]
        : [['div', { class: 'notebook-media-placeholder' }, ['span', {}, '▦'], ['strong', {}, 'Scene without a preview']]]),
      ...(directorNotes
        ? [
            [
              'div',
              { class: 'scene-director' },
              ['span', { class: 'scene-director-label' }, 'Director'],
              ['p', {}, String(directorNotes)],
            ],
          ]
        : []),
      ...(entries.length
        ? [
            [
              'div',
              { class: 'scene-storyboard' },
              ...entries.map(entry => [
                'div',
                { class: 'scene-frame', title: String(entry.note || '') },
                ['img', { src: storyboardMockUrl(entry), alt: String(entry.label || 'frame') }],
                ['span', { class: 'scene-frame-label' }, String(entry.label || '')],
              ]),
            ],
          ]
        : []),
      ...(cueList.length
        ? [
            [
              'div',
              { class: 'scene-cues' },
              ['span', { class: 'scene-cues-label' }, 'Coach cues'],
              ['ul', {}, ...cueList.map(cue => ['li', {}, String(cue)])],
            ],
          ]
        : []),
      dialogueSection(HTMLAttributes as Record<string, unknown>),
      [
        'figcaption',
        {},
        `${dialogueCaption(HTMLAttributes as Record<string, unknown>)} · ${entries.length} layout moment${entries.length === 1 ? '' : 's'} · ${role}`,
      ],
    ]
  },
})
