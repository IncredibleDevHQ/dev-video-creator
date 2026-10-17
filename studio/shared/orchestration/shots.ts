// The orchestrator's vocabulary: the shots a scene can be built as. A shot
// names the HyperFrames workflow it borrows from and the pinned recipes it
// starts from (ids from skills/video-planner/capabilities.json), the
// evidence it shows best, the beats it suits and where the speaker can be.
// The orchestrator picks one per scene; the scene's planner develops it.
import type {
  BeatFunction,
  EvidenceKind,
  SpeakerPlace
} from '../narratives/model'

export type ShotId =
  | 'title-reveal'
  | 'kinetic-statement'
  | 'stat-hit'
  | 'chart-read'
  | 'diagram-build'
  | 'flow-trace'
  | 'timeline-scrub'
  | 'code-focus'
  | 'terminal-run'
  | 'product-capture'
  | 'side-by-side'
  | 'points-land'
  | 'presenter-led'

/** The four HyperFrames workflows the pinned bundle carries. */
export type ShotWorkflow =
  | 'general-video'
  | 'motion-graphics'
  | 'faceless-explainer'
  | 'talking-head-recut'

export type Shot = {
  id: ShotId
  name: string
  /** What the viewer sees, in one line. */
  line: string
  workflow: ShotWorkflow
  serves: EvidenceKind[]
  suits: BeatFunction[]
  speaker: SpeakerPlace[]
  /** Pinned catalog ids to start from: rules, blueprints or techniques. */
  recipes: string[]
  /** A gallery sketch that shows the idea. */
  example: string
}

const shot = (
  id: ShotId,
  name: string,
  line: string,
  workflow: ShotWorkflow,
  serves: EvidenceKind[],
  suits: BeatFunction[],
  speaker: SpeakerPlace[],
  recipes: string[],
  example: string
): Shot => ({
  id,
  name,
  line,
  workflow,
  serves,
  suits,
  speaker,
  recipes,
  example
})

export const SHOTS: Shot[] = [
  shot(
    'title-reveal',
    'Title',
    'The video’s title lands, with the question it answers.',
    'motion-graphics',
    ['quote'],
    ['hook'],
    ['off', 'beside', 'over'],
    ['titlecard-reveal', 'waterfall-entry'],
    'kinetic'
  ),
  shot(
    'kinetic-statement',
    'Kinetic type',
    'A few words land with the voice, one beat at a time.',
    'motion-graphics',
    ['quote', 'numbers'],
    ['hook', 'turn', 'payoff', 'action'],
    ['off', 'beside', 'over', 'full'],
    ['kinetic-type-beats', 'kinetic-beat-slam', 'per-word-kinetic-typography'],
    'kinetic'
  ),
  shot(
    'stat-hit',
    'Number hit',
    'One number counts up, or a chart lands and holds.',
    'motion-graphics',
    ['numbers'],
    ['hook', 'evidence', 'payoff', 'problem'],
    ['off', 'corner', 'beside', 'over'],
    ['dataviz-countup', 'counting-dynamic-scale', 'stat-bars-and-fills'],
    'bignumber'
  ),
  shot(
    'chart-read',
    'Chart read',
    'A chart draws and a readout follows the point that matters.',
    'general-video',
    ['numbers', 'timeline'],
    ['evidence', 'problem', 'turn', 'context'],
    ['off', 'corner', 'beside'],
    ['chart-scrub-readout', 'stat-bars-and-fills'],
    'spike'
  ),
  shot(
    'diagram-build',
    'Diagram build',
    'The diagram builds part by part as the voice names each one.',
    'general-video',
    ['diagram'],
    ['explain', 'context', 'resolution'],
    ['off', 'corner', 'beside'],
    ['svg-path-draw', 'spring-pop-entrance', 'coordinate-target-zoom'],
    'seqreveal'
  ),
  shot(
    'flow-trace',
    'Flow trace',
    'One request travels the system, hop by hop.',
    'general-video',
    ['diagram', 'timeline'],
    ['explain', 'evidence', 'context'],
    ['off', 'corner'],
    ['gsap-motionpathplugin', 'svg-path-draw', 'camera-journey'],
    'onerequest'
  ),
  shot(
    'timeline-scrub',
    'Timeline',
    'Events land along a time axis as the playhead moves.',
    'general-video',
    ['timeline'],
    ['context', 'evidence', 'problem'],
    ['off', 'corner', 'beside'],
    ['chart-scrub-readout', 'dynamic-content-sequencing'],
    'scrub'
  ),
  shot(
    'code-focus',
    'Code focus',
    'Code on screen, the lines that matter lit, or a diff resolving.',
    'general-video',
    ['code', 'diff'],
    ['explain', 'resolution', 'evidence', 'turn'],
    ['off', 'corner'],
    [
      'css-marker-patterns',
      'coordinate-target-zoom',
      'character-by-character-typing'
    ],
    'codehl'
  ),
  shot(
    'terminal-run',
    'Terminal run',
    'A command runs, and its output answers the question.',
    'general-video',
    ['terminal'],
    ['evidence', 'resolution', 'action', 'explain'],
    ['off', 'corner'],
    ['discrete-text-sequence', 'character-by-character-typing'],
    'tipcard'
  ),
  shot(
    'product-capture',
    'Product capture',
    'The product on screen, the cursor leading, zooming on what matters.',
    'general-video',
    ['demo'],
    ['hook', 'explain', 'evidence', 'payoff'],
    ['off', 'corner', 'beside'],
    ['cursor-ui-demo', 'camera-cursor-tracking', 'cursor-click-ripple'],
    'cursorzoom'
  ),
  shot(
    'side-by-side',
    'Side by side',
    'Two options, or before and after, on the same axes.',
    'general-video',
    ['numbers', 'diff', 'diagram', 'code'],
    ['turn', 'evidence', 'resolution'],
    ['off', 'corner'],
    ['comparison-split', 'split-tilt-cards'],
    'versus'
  ),
  shot(
    'points-land',
    'Points land',
    'Parallel points arrive one at a time and stay.',
    'general-video',
    ['quote'],
    ['context', 'payoff', 'action', 'explain'],
    ['off', 'corner', 'beside'],
    ['grid-card-assemble', 'waterfall-entry'],
    'ticklist'
  ),
  shot(
    'presenter-led',
    'Presenter',
    'The presenter carries it, with a card or a few words beside them.',
    'talking-head-recut',
    ['creator', 'quote'],
    ['hook', 'turn', 'payoff', 'action'],
    ['full', 'over', 'beside'],
    ['asr-keyword-glow', 'waterfall-entry'],
    'quote'
  )
]

export const shotById = (id?: string | null) =>
  SHOTS.find((item) => item.id === id)

/**
 * How a beat's example sketch would be built: each narrative names one way
 * a beat could look, and that names a shot.
 */
const SKETCH_SHOTS: Record<string, ShotId> = {
  kinetic: 'kinetic-statement',
  quote: 'kinetic-statement',
  mythfact: 'kinetic-statement',
  bignumber: 'stat-hit',
  wrapped: 'stat-hit',
  evals: 'stat-hit',
  slo: 'stat-hit',
  abtest: 'stat-hit',
  countdown: 'stat-hit',
  invoice: 'stat-hit',
  costdown: 'stat-hit',
  rag: 'stat-hit',
  hill: 'chart-read',
  bars: 'chart-read',
  league: 'chart-read',
  spike: 'chart-read',
  scaling: 'chart-read',
  progress: 'chart-read',
  flame: 'chart-read',
  heatmap: 'chart-read',
  overload: 'chart-read',
  seqreveal: 'diagram-build',
  c4zoom: 'diagram-build',
  layers: 'diagram-build',
  figure: 'diagram-build',
  mapping: 'diagram-build',
  testshape: 'diagram-build',
  zoomout: 'diagram-build',
  safeguard: 'diagram-build',
  tradeoff: 'diagram-build',
  matrix: 'diagram-build',
  tree: 'diagram-build',
  attack: 'diagram-build',
  chaos: 'diagram-build',
  recover: 'diagram-build',
  fault: 'diagram-build',
  peel: 'diagram-build',
  onerequest: 'flow-trace',
  apiflow: 'flow-trace',
  trace: 'flow-trace',
  traffic: 'flow-trace',
  pipeline: 'flow-trace',
  journey: 'flow-trace',
  integration: 'flow-trace',
  scrub: 'timeline-scrub',
  montage: 'timeline-scrub',
  phases: 'timeline-scrub',
  roadmap: 'timeline-scrub',
  codehl: 'code-focus',
  diff: 'code-focus',
  prfiles: 'code-focus',
  errorfix: 'code-focus',
  tipcard: 'terminal-run',
  quickstart: 'terminal-run',
  logzoom: 'terminal-run',
  cursorzoom: 'product-capture',
  resultfirst: 'product-capture',
  onboarding: 'product-capture',
  recipes: 'product-capture',
  versus: 'side-by-side',
  race: 'side-by-side',
  thennow: 'side-by-side',
  pricing: 'side-by-side',
  ticklist: 'points-land',
  limits: 'points-land',
  cta: 'points-land',
  columns: 'points-land',
  advisory: 'points-land',
  deprecation: 'points-land',
  maintenance: 'points-land',
  eventcard: 'points-land',
  badge: 'points-land',
  stages: 'points-land',
  suspects: 'points-land',
  numbered: 'points-land',
  attempts: 'points-land',
  teamgrid: 'points-land',
  customer: 'points-land',
  stars: 'points-land',
  slides: 'points-land',
  pileup: 'points-land'
}
export const sketchShot = (sketch: string) => SKETCH_SHOTS[sketch]
