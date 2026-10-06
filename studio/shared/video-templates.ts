// Video templates: the shape of an engineering explainer, by the kind of blog
// it tells. A template is an ordered list of slots; each slot is a role in the
// story with a length, a type of shot, the speaker's place, one signature move
// and the seam into the next. The video's scenes (its locked wireframe pages)
// take the slots in order, and the planner shapes each scene's moments on its
// slot. The idea is HyperFrames' blueprint (a template for one shot) taken up
// one level, to the whole video.
import type { Moment, Presence } from './model'

export type SlotType = 'motion' | 'explainer' | 'capture' | 'code' | 'speaker'
export type SpeakerPlace = 'off' | 'corner' | 'beside' | 'full'
export type Seam = 'cut' | 'match' | 'hold' | 'push' | 'cover' | 'zoom' | 'end'
export type TemplateSlot = {
  id: string
  role: string
  /** Seconds into the template, a guide the creator's words fill. */
  from: number
  to: number
  type: SlotType
  speaker: SpeakerPlace
  /** The sketch that plays the slot's signature move. */
  sketch: string
  move: string
  /** HyperFrames names the slot is built from: blueprints, rules, blocks. */
  builds: string[]
  seam: Seam
}
export type TemplateFamilyId = 'internal' | 'external' | 'demo'
export type TemplateFamily = {
  id: TemplateFamilyId
  name: string
  short: string
  summary: string
  audience: string
  length: string
  tone: string
  pacing: string
}
export type VideoTemplate = {
  id: string
  family: TemplateFamilyId
  name: string
  purpose: string
  /** One short line, for the gallery's cards. */
  tagline: string
  seconds: number
  slots: TemplateSlot[]
}

export const SLOT_TYPES: Record<SlotType, { label: string; workflow: string }> =
  {
    motion: { label: 'Motion graphic', workflow: 'motion-graphics' },
    explainer: { label: 'Explainer', workflow: 'general-video' },
    capture: { label: 'Product capture', workflow: 'product-launch-video' },
    code: { label: 'Code', workflow: 'pr-to-video' },
    speaker: { label: 'Speaker', workflow: 'talking-head-recut' }
  }

export const SPEAKER_LABELS: Record<SpeakerPlace, string> = {
  off: 'Speaker off',
  corner: 'Speaker in the corner',
  beside: 'Speaker beside',
  full: 'Speaker full frame'
}

export const SEAM_LABELS: Record<Seam, string> = {
  cut: 'Cut',
  match: 'Match',
  hold: 'Hold',
  push: 'Push',
  cover: 'Cover',
  zoom: 'Zoom',
  end: 'End'
}
/** How a slot hands over: into the next scene, or it ends the video. */
export const seamLine = (seam: Seam) =>
  seam === 'end' ? 'Ends the video' : `${SEAM_LABELS[seam]} into the next`

export const TEMPLATE_FAMILIES: TemplateFamily[] = [
  {
    id: 'internal',
    name: 'Concept explainers for internal teams',
    short: 'Internal',
    summary:
      'For the team and the teams next to it: a shared understanding and a decision people can act on. Decision first, trade-offs visible.',
    audience: 'Engineers on and around the team',
    length: '2–4 minutes',
    tone: 'Candid, decision-first',
    pacing: 'Calm; one idea per diagram'
  },
  {
    id: 'external',
    name: 'Engineering explainers for the world',
    short: 'External',
    summary:
      'For developers outside the company: real understanding, and trust in the team that built it. Concrete before abstract, and where it breaks.',
    audience: 'Developers outside the company',
    length: '1.5–3 minutes',
    tone: 'Curious, concrete, brisk',
    pacing: 'Fast; a reveal on every phrase'
  },
  {
    id: 'demo',
    name: 'Engineering explainers with a product demo',
    short: 'Product demo',
    summary:
      'For developers deciding whether to adopt: a first try. The result first, one problem solved with one workflow, and just enough of how it works.',
    audience: 'Developers evaluating a tool',
    length: '1–3 minutes',
    tone: "Show, don't tell; honest about limits",
    pacing: 'Cursor-led; zoom on every click'
  }
]

const slot = (
  id: string,
  role: string,
  from: number,
  to: number,
  type: SlotType,
  speaker: SpeakerPlace,
  sketch: string,
  seam: Seam,
  move: string,
  builds: string[]
): TemplateSlot => ({
  id,
  role,
  from,
  to,
  type,
  speaker,
  sketch,
  seam,
  move,
  builds
})

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'design-decision',
    family: 'internal',
    name: 'Design decision walkthrough',
    purpose:
      'A design doc or RFC in three minutes: the decision first, then why, then what else was considered.',
    tagline: 'A design doc or RFC, decision first',
    seconds: 180,
    slots: [
      slot(
        'decision',
        'Decision',
        0,
        15,
        'speaker',
        'beside',
        'decision',
        'cut',
        'The one-line decision stamps onto a card while the author says it.',
        ['titlecard-reveal', 'spring-pop-entrance']
      ),
      slot(
        'context',
        'Context',
        15,
        40,
        'explainer',
        'off',
        'c4zoom',
        'match',
        'Wide, then zoom: the system in context, then one part opens and the painful path glows.',
        ['multi-phase-camera', 'coordinate-target-zoom']
      ),
      slot(
        'proposal',
        'Proposal',
        40,
        100,
        'explainer',
        'corner',
        'spotlight',
        'push',
        'Spotlight walk: each component lights in turn, the rest dims, and a request travels the new path.',
        ['svg-path-draw', 'ambient-glow-bloom']
      ),
      slot(
        'trade-offs',
        'Trade-offs',
        100,
        140,
        'motion',
        'off',
        'tradeoff',
        'cover',
        'Each alternative gets one honest line, then folds away with the constraint it broke.',
        ['comparison-split', 'grid-card-assemble', 'card-morph-anchor']
      ),
      slot(
        'rollout',
        'Risks and rollout',
        140,
        165,
        'motion',
        'off',
        'rollout',
        'cut',
        'The rollout line draws; risks pin onto the phase they threaten.',
        ['svg-path-draw', 'waterfall-entry']
      ),
      slot(
        'ask',
        'The ask',
        165,
        180,
        'speaker',
        'beside',
        'checklist',
        'end',
        'Owners and dates tick in beside the author.',
        ['talking-head-recut']
      )
    ]
  },
  {
    id: 'incident',
    family: 'internal',
    name: 'Incident walkthrough',
    purpose:
      'An internal postmortem: what users felt, what happened when, why, and what changes now.',
    tagline: 'A postmortem your team can act on',
    seconds: 150,
    slots: [
      slot(
        'impact',
        'Impact',
        0,
        15,
        'motion',
        'off',
        'spike',
        'cut',
        'The error line spikes while minutes and failed requests count up.',
        ['dataviz-countup', 'chart-scrub-readout']
      ),
      slot(
        'timeline',
        'Timeline',
        15,
        50,
        'explainer',
        'off',
        'scrub',
        'match',
        'A playhead scrubs through the hour; events pin, and the false lead greys out.',
        ['chart-scrub-readout', 'waterfall-entry']
      ),
      slot(
        'root-cause',
        'Root cause',
        50,
        90,
        'explainer',
        'corner',
        'fault',
        'hold',
        'The bad change travels the graph; each service changes state as it is hit.',
        ['svg-path-draw']
      ),
      slot(
        'fix',
        'Fix and follow-ups',
        90,
        125,
        'explainer',
        'corner',
        'recover',
        'push',
        'Services recover in reverse order; follow-ups stack up with their owners.',
        ['waterfall-entry']
      ),
      slot(
        'lesson',
        'Lesson',
        125,
        150,
        'speaker',
        'full',
        'speaker',
        'end',
        'The author, full frame, with one lesson in a lower third.',
        ['talking-head-recut']
      )
    ]
  },
  {
    id: 'how-it-works',
    family: 'external',
    name: 'How it works',
    purpose:
      'One concept, the way the best teaching channels do it: a hook, one example, the mechanism, the breaking point, the pattern.',
    tagline: 'One concept, from example to pattern',
    seconds: 120,
    slots: [
      slot(
        'hook',
        'Hook',
        0,
        8,
        'motion',
        'off',
        'kinetic',
        'cut',
        'The question lands word by word; one word swaps to show the tension.',
        ['kinetic-type-beats', 'kinetic-beat-slam']
      ),
      slot(
        'example',
        'One example',
        8,
        30,
        'explainer',
        'off',
        'onerequest',
        'match',
        'Follow one request end to end before anything is named.',
        ['svg-path-draw']
      ),
      slot(
        'mechanism',
        'Mechanism',
        30,
        65,
        'explainer',
        'off',
        'seqreveal',
        'hold',
        'Components arrive in order, and requests flow along the edges as the voice names each one.',
        ['spatial-pan-stations', 'center-outward-expansion', 'flowchart']
      ),
      slot(
        'breaking-point',
        'Breaking point',
        65,
        90,
        'explainer',
        'off',
        'overload',
        'zoom',
        'Load ramps; one part overheats and its queue backs up.',
        ['reactive-displacement']
      ),
      slot(
        'pattern',
        'The pattern',
        90,
        110,
        'motion',
        'off',
        'zoomout',
        'push',
        'Zoom out: the one example becomes the general pattern, and it gets its name.',
        ['zoom-out-workspace-reveal', 'grid-card-assemble']
      ),
      slot(
        'recap',
        'Recap',
        110,
        120,
        'speaker',
        'beside',
        'recap',
        'end',
        'Three points build while the speaker shares the frame.',
        ['titlecard-reveal']
      )
    ]
  },
  {
    id: 'engineering-story',
    family: 'external',
    name: 'Engineering story',
    purpose:
      'A public postmortem or case study: the moment it broke, a normal day, the cascade, the hunt, the safeguard.',
    tagline: 'A public postmortem, told as a story',
    seconds: 150,
    slots: [
      slot(
        'cold-open',
        'Cold open',
        0,
        10,
        'motion',
        'off',
        'status',
        'cut',
        'The status flips red; the numbers that mattered count up.',
        ['ticker-takeover', 'counting-dynamic-scale']
      ),
      slot(
        'normal-day',
        'A normal day',
        10,
        35,
        'explainer',
        'off',
        'calm',
        'hold',
        'How it usually works: a calm, healthy flow through the system.',
        ['svg-path-draw']
      ),
      slot(
        'cascade',
        'The cascade',
        35,
        70,
        'explainer',
        'off',
        'fault',
        'zoom',
        'The change lands, and the failure spreads in step with the clock.',
        ['chart-scrub-readout']
      ),
      slot(
        'finding-it',
        'Finding it',
        70,
        100,
        'code',
        'off',
        'logzoom',
        'cut',
        'Zoom into the log line, then the change that caused it.',
        ['coordinate-target-zoom']
      ),
      slot(
        'safeguard',
        'The safeguard',
        100,
        130,
        'explainer',
        'off',
        'safeguard',
        'push',
        'The new safeguard drops in and catches the replayed fault.',
        ['physics-press-reaction']
      ),
      slot(
        'for-you',
        'What it means for you',
        130,
        150,
        'speaker',
        'full',
        'speaker',
        'end',
        'The engineer, full frame, with one line for customers.',
        ['talking-head-recut']
      )
    ]
  },
  {
    id: 'launch-demo',
    family: 'demo',
    name: 'Launch demo',
    purpose:
      'A feature or product launch: the outcome, the old pain, the walkthrough, a look under the hood, the proof, one way to try it.',
    tagline: 'A launch that shows the result first',
    seconds: 90,
    slots: [
      slot(
        'result-first',
        'Result first',
        0,
        6,
        'capture',
        'off',
        'resultfirst',
        'cut',
        'The finished outcome plays, then rewinds to the start.',
        ['video-text-pivot', 'cursor-ui-demo']
      ),
      slot(
        'old-way',
        'The old way',
        6,
        20,
        'motion',
        'off',
        'pileup',
        'cover',
        'Manual steps pile up while a clock spins.',
        ['overwhelm-surround']
      ),
      slot(
        'walkthrough',
        'Walkthrough',
        20,
        55,
        'capture',
        'corner',
        'cursorzoom',
        'match',
        'Cursor-led: zoom to each click, and a callout names what changed.',
        ['cursor-ui-demo', 'camera-cursor-tracking', 'cursor-click-ripple']
      ),
      slot(
        'under-the-hood',
        'Under the hood',
        55,
        70,
        'explainer',
        'off',
        'peel',
        'push',
        'The interface peels back to the diagram behind the button.',
        ['card-morph-anchor']
      ),
      slot(
        'proof',
        'Proof',
        70,
        82,
        'motion',
        'off',
        'bars',
        'cut',
        'Before and after race: latency, cost, steps.',
        ['dataviz-countup', 'stat-bars-and-fills', 'bar-chart-race']
      ),
      slot(
        'try-it',
        'Try it',
        82,
        90,
        'code',
        'beside',
        'terminal',
        'end',
        'The install command types itself, beside the speaker.',
        ['typewriter-reveal', 'cta-morph-press']
      )
    ]
  },
  {
    id: 'feature-deep-dive',
    family: 'demo',
    name: 'Feature deep dive',
    purpose:
      "Engineer to engineer: the problem in today's code, a live run, how it works inside, the honest limits, and how to start.",
    tagline: 'One feature, engineer to engineer',
    seconds: 180,
    slots: [
      slot(
        'problem-in-code',
        'The problem in code',
        0,
        25,
        'code',
        'off',
        'codehl',
        'cut',
        'The painful lines light up in the code people write today.',
        ['css-marker-patterns']
      ),
      slot(
        'live-run',
        'Live run',
        25,
        65,
        'capture',
        'corner',
        'stream',
        'match',
        'Run it: output streams, and the result pops.',
        ['transcript-scroll-artifact-reveal', 'agent-progress-theater']
      ),
      slot(
        'inside',
        'How it works',
        65,
        115,
        'explainer',
        'off',
        'layers',
        'hold',
        'The request lights each layer it passes through.',
        ['multi-phase-camera']
      ),
      slot(
        'limits',
        'Limits',
        115,
        145,
        'motion',
        'off',
        'limits',
        'push',
        'Honest limits: cards flip to "works" or "not yet".',
        ['split-tilt-cards', 'grid-card-assemble']
      ),
      slot(
        'get-started',
        'Get started',
        145,
        180,
        'speaker',
        'beside',
        'steps',
        'end',
        'Three steps build beside the speaker.',
        ['talking-head-recut', 'waterfall-entry']
      )
    ]
  }
]

export const templateById = (id?: string | null) =>
  VIDEO_TEMPLATES.find((template) => template.id === id)

export const familyById = (id: TemplateFamilyId) =>
  TEMPLATE_FAMILIES.find((family) => family.id === id)!

/**
 * How the speaker is framed in a slot. Presence still decides when they
 * appear (Low: each scene's close; High: its open and close); the slot says
 * how: full frame, beside the content or in the corner. Off keeps them out.
 */
export const speakerPlace = (
  slot: TemplateSlot,
  presence: Presence
): SpeakerPlace => (presence === 'off' ? 'off' : slot.speaker)

/** The presenter layout a speaker place uses, or none when they are off. */
export const presenterLayoutFor = (
  place: SpeakerPlace
): Moment['layout'] | null =>
  place === 'full'
    ? 'full-screen'
    : place === 'beside'
      ? 'beside-slide'
      : place === 'corner'
        ? 'corner'
        : null

/**
 * Which slot each scene takes, in order: the first scene opens, the last one
 * closes, and the scenes between spread over the middle slots by their time.
 * A creator's choice for a scene wins over this.
 */
export const assignSlots = (
  template: VideoTemplate,
  sceneCount: number
): TemplateSlot[] => {
  const slots = template.slots
  if (sceneCount <= 0) return []
  if (sceneCount === 1)
    return [
      slots.reduce((longest, item) =>
        item.to - item.from > longest.to - longest.from ? item : longest
      )
    ]
  const middle = slots.slice(1, -1)
  const assigned: TemplateSlot[] = [slots[0]]
  const start = middle[0]?.from ?? 0
  const end = middle.at(-1)?.to ?? 0
  for (let index = 1; index < sceneCount - 1; index++) {
    const at = start + ((index - 0.5) / (sceneCount - 2)) * (end - start)
    assigned.push(
      middle.find((item) => at >= item.from && at < item.to) ??
        middle.at(-1) ??
        slots[0]
    )
  }
  assigned.push(slots.at(-1)!)
  return assigned
}

/** The slot a scene plays: the creator's choice, or its place in order. */
export const sceneSlot = (
  template: VideoTemplate,
  scenes: Array<{ id: string; slot?: string | null }>,
  sceneId: string
): TemplateSlot | undefined => {
  const index = scenes.findIndex((scene) => scene.id === sceneId)
  if (index < 0) return undefined
  const chosen = template.slots.find((item) => item.id === scenes[index].slot)
  return chosen ?? assignSlots(template, scenes.length)[index]
}

/** The video's template and the slot this scene plays, when there is one. */
export const sceneTemplateSlot = (
  video:
    | {
        settings: { template?: string }
        scenes: Array<{ id: string; slot?: string | null }>
      }
    | null
    | undefined,
  sceneId: string
) => {
  const template = templateById(video?.settings.template)
  const slot = template && sceneSlot(template, video!.scenes, sceneId)
  return template && slot ? { template, slot } : null
}

/** What the planner is told about the slot a scene plays. */
export type SlotBrief = {
  template: string
  family: string
  slot: string
  role: string
  position: string
  type: string
  move: string
  speaker: string
  seconds: number
  seam: string
  builds: string[]
}
export const slotBrief = (
  template: VideoTemplate,
  slot: TemplateSlot,
  presence: Presence
): SlotBrief => ({
  template: template.name,
  family: familyById(template.family).name,
  slot: slot.id,
  role: slot.role,
  position: `${template.slots.indexOf(slot) + 1} of ${template.slots.length}`,
  type: SLOT_TYPES[slot.type].label,
  move: slot.move,
  speaker: SPEAKER_LABELS[speakerPlace(slot, presence)],
  seconds: slot.to - slot.from,
  seam: SEAM_LABELS[slot.seam],
  builds: slot.builds
})
