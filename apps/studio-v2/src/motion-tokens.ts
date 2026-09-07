// Motion tokens — easing anchors and timing ranges derived from
// diffusionstudio/lottie (MIT License, https://motion.dev/ and the Lottie
// motion-spec; anchor values per that table). Advisory for now: the slide
// driver and the composition compiler already bake these same anchors into
// their generated code (see slide.ts slideDriverScript), and the V1 step
// schema carries no easing/duration fields — so this table is the single
// source for future per-step tuning, not a parallel animation system.

export const EASE_ANCHORS = {
  // Snappy entrance — UI elements appearing.
  entranceSharp: [0.2, 0.75, 0.34, 0.94],
  // Soft settle — the end of every entrance.
  settleSoft: [0.0, 0.65, 0.51, 0.99],
  // Kinetic UI — quick utilitarian moves.
  kineticUi: [0.85, 0.46, 0.14, 0.53],
  // Focal pop — one flourish per beat.
  expressivePop: [0.94, 0.75, 0.34, 0.94],
  // Even travel — moves and camera pans.
  travelBalanced: [1.0, 0.49, 0.0, 0.55],
  // Accelerating exit.
  exitAccelerate: [1.0, 0.02, 0.54, 0.42],
  // Cut-like travel.
  travelCut: [0.15, 0.85, 0.95, 0.05],
} as const

export type EaseAnchor = keyof typeof EASE_ANCHORS

// Frame ranges at 30 fps.
export const TIMING = {
  // UI elements: 12–30 frames.
  uiFrames: { min: 12, max: 30 },
  // Lower thirds: 45–90 frames in.
  lowerThirdInFrames: { min: 45, max: 90 },
  // Stagger between scene beats.
  sceneBeatStaggerMs: { min: 50, max: 80 },
} as const

// Anchor by behaviour (the driver/compiler idiom today): entering, settling,
// travelling, exiting, focal emphasis.
export const EASE_FOR: Record<string, EaseAnchor> = {
  reveal: 'entranceSharp',
  settle: 'settleSoft',
  trace: 'travelBalanced',
  move: 'travelBalanced',
  exit: 'exitAccelerate',
  pulse: 'expressivePop',
  count: 'settleSoft',
}
