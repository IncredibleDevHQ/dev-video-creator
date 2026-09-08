// The stage: who owns the frame at any moment of a scene — the page, the
// presenter, or both in one of the shared families (Motion Core Part II
// §11–13, Part V layout track). A scene carries a stage track (segments by
// scene time); the composition applies it as a data attribute the CSS
// animates, so every change is a smooth reframe. The presenter can override
// it live; the director writes the default.
export const STAGE_FAMILIES = [
  'content-full',
  'speaker-full',
  'speaker-lead',
  'speaker-panel',
  'split',
  'content-lead',
  'content-card',
  'content-cutout',
  'content-tile',
  'content-pip',
] as const
export type StageFamily = (typeof STAGE_FAMILIES)[number]
// speaker-full can carry a title card in a corner (overlay), a warm bed for
// the hero line (glow-bed-hero), or the page on a board over you (board —
// the words are the picture: a quote, a statement, a short list).
export type StageTreatment = '' | 'overlay' | 'glow-bed-hero' | 'board'
export const STAGE_TREATMENTS: readonly StageTreatment[] = ['', 'overlay', 'glow-bed-hero', 'board']
export const isStageTreatment = (value: unknown): value is StageTreatment =>
  typeof value === 'string' && (STAGE_TREATMENTS as readonly string[]).includes(value)

// What each family is for — the director weighs these, the picker shows them.
export const STAGE_DESCRIPTIONS: Record<StageFamily, string> = {
  'content-full': 'The page alone, edge to edge.',
  'speaker-full': 'You alone, full frame — for the line that belongs to your face.',
  'speaker-lead': 'You lead; the page rides as a card beside you — a term, a short list, a quote.',
  'speaker-panel': 'You in a tall panel, the page beside you at half the frame.',
  split: 'Half and half — the page and you as equals.',
  'content-lead': 'The page leads at sixty percent; you stand tall beside it.',
  'content-card': 'The page moves aside for your portrait card.',
  'content-cutout': 'The page owns the frame; you float over it in a tall cutout.',
  'content-tile': 'The page owns the frame; you float over it in a small tile.',
  'content-pip': 'The page owns the frame; you float over it as a round chip.',
}

// A variant is a placement of the presenter for the families that float
// over the page: an anchor (br, bl, tr, tl, mr, ml — bottom-right first)
// and a size (s, m, l), e.g. "bl-m". Panel, split and full frames have none.
export type StageAnchor = 'br' | 'bl' | 'tr' | 'tl' | 'mr' | 'ml'
export type StageSize = 's' | 'm' | 'l'
export type StageVariant = `${StageAnchor}-${StageSize}`

export type StageSegment = { atMs: number; family: StageFamily; treatment?: StageTreatment; variant?: StageVariant }

export type StageRect = { left: number; top: number; width: number; height: number }
export type StageGeometry = {
  camera: StageRect | null
  content: StageRect | null
  cameraShape: 'circle' | 'rounded' | 'full'
}

// Frame fractions (percent of 1920×1080). The page keeps its aspect inside
// its rect; the camera is cropped to its rect (object-fit: cover).
const PAGE_RECT: StageRect = { left: 4.7, top: 5, width: 90.6, height: 90 }
const FRAME_ASPECT = 1920 / 1080

// Width (% of the frame) per size, for the floating families.
const FLOAT_WIDTHS: Record<Exclude<StageFamily, 'content-full' | 'speaker-full' | 'speaker-lead' | 'speaker-panel' | 'split' | 'content-lead'>, Record<StageSize, number>> = {
  'content-pip': { s: 12, m: 16, l: 20 },
  'content-tile': { s: 18, m: 22, l: 27 },
  'content-card': { s: 20, m: 24, l: 28 },
  'content-cutout': { s: 20, m: 24, l: 30 },
}
// Height as a multiple of width, in frame percent (the frame is 16:9).
const FLOAT_RATIO: Record<keyof typeof FLOAT_WIDTHS, number> = {
  'content-pip': FRAME_ASPECT, // a circle
  'content-tile': 1, // 16:9 tile
  'content-card': (4 / 3) * FRAME_ASPECT, // 3:4 portrait
  'content-cutout': (5 / 4) * FRAME_ASPECT, // 4:5 portrait
}
const FLOAT_ANCHORS: Record<keyof typeof FLOAT_WIDTHS, StageAnchor[]> = {
  'content-pip': ['br', 'bl', 'tr', 'tl', 'mr', 'ml'],
  'content-tile': ['br', 'bl', 'tr', 'tl'],
  'content-card': ['mr', 'ml'],
  'content-cutout': ['br', 'bl'],
}
const MARGIN_X = 4
const MARGIN_Y = 7

const placeFloat = (family: keyof typeof FLOAT_WIDTHS, variant: StageVariant): StageRect => {
  const [anchor, size] = variant.split('-') as [StageAnchor, StageSize]
  const width = FLOAT_WIDTHS[family][size]
  const height = Math.min(84, width * FLOAT_RATIO[family])
  const left = anchor.endsWith('l') ? MARGIN_X : 100 - MARGIN_X - width
  const top = anchor.startsWith('t') ? MARGIN_Y : anchor.startsWith('m') ? (100 - height) / 2 : 100 - MARGIN_Y - height
  return { left, top, width, height }
}

export const DEFAULT_VARIANT: Record<StageFamily, StageVariant | undefined> = {
  'content-full': undefined,
  'speaker-full': undefined,
  'speaker-lead': undefined,
  'speaker-panel': undefined,
  split: undefined,
  'content-lead': undefined,
  'content-pip': 'br-m',
  'content-tile': 'br-m',
  'content-card': 'mr-m',
  'content-cutout': 'bl-m',
}

export const variantsFor = (family: StageFamily): StageVariant[] => {
  if (!(family in FLOAT_WIDTHS)) return []
  const key = family as keyof typeof FLOAT_WIDTHS
  return FLOAT_ANCHORS[key].flatMap(anchor => (['m', 's', 'l'] as StageSize[]).map(size => `${anchor}-${size}` as StageVariant))
}

export const isStageVariant = (family: StageFamily, value: unknown): value is StageVariant =>
  typeof value === 'string' && variantsFor(family).includes(value as StageVariant)

/** Geometry for a family at a variant (the default variant when none). */
export const stageGeometryFor = (family: StageFamily, variant?: string | null): StageGeometry => {
  switch (family) {
    case 'content-full': return { camera: null, content: PAGE_RECT, cameraShape: 'rounded' }
    case 'speaker-full': return { camera: { left: 0, top: 0, width: 100, height: 100 }, content: null, cameraShape: 'full' }
    // You lead (a medium shot at 58%), the page as a card beside you — after
    // TalkCraft's "host + info card / parallel items with host".
    case 'speaker-lead': return { camera: { left: 0, top: 0, width: 58, height: 100 }, content: { left: 61, top: 18, width: 35, height: 64 }, cameraShape: 'full' }
    case 'speaker-panel': return { camera: { left: 0, top: 0, width: 44, height: 100 }, content: { left: 47, top: 8, width: 50, height: 84 }, cameraShape: 'full' }
    case 'split': return { camera: { left: 50, top: 0, width: 50, height: 100 }, content: { left: 3, top: 10, width: 44, height: 80 }, cameraShape: 'full' }
    // The page leads at sixty percent, you tall beside it — after TalkCraft's
    // "document parks left" and "60/40 story split".
    case 'content-lead': return { camera: { left: 66, top: 12, width: 30, height: 76 }, content: { left: 3, top: 8, width: 60, height: 84 }, cameraShape: 'rounded' }
    default: {
      const v = isStageVariant(family, variant) ? variant : DEFAULT_VARIANT[family]!
      const camera = placeFloat(family, v)
      if (family === 'content-card') {
        // The page moves aside for the card.
        const onRight = camera.left > 50
        const content: StageRect = onRight
          ? { left: 3, top: 6, width: camera.left - 6, height: 88 }
          : { left: camera.left + camera.width + 3, top: 6, width: 100 - (camera.left + camera.width) - 6, height: 88 }
        return { camera, content, cameraShape: 'rounded' }
      }
      return { camera, content: PAGE_RECT, cameraShape: family === 'content-pip' ? 'circle' : 'rounded' }
    }
  }
}

// The default geometry per family (kept for callers that do not carry a variant).
export const STAGE_GEOMETRY: Record<StageFamily, StageGeometry> = Object.fromEntries(
  STAGE_FAMILIES.map(family => [family, stageGeometryFor(family, DEFAULT_VARIANT[family])]),
) as Record<StageFamily, StageGeometry>

// The title-card overlay a speaker-full moment can carry, and the board
// (the page over you, centred) — after TalkCraft's "quote card".
export const STAGE_OVERLAY_CONTENT: StageRect = { left: 56, top: 56, width: 40, height: 36 }
export const STAGE_BOARD_CONTENT: StageRect = { left: 15, top: 14, width: 70, height: 72 }

export const STAGE_LABELS: Record<StageFamily, string> = {
  'content-full': 'Page',
  'speaker-full': 'You',
  'speaker-lead': 'You + card',
  'speaker-panel': 'Panel',
  split: 'Split',
  'content-lead': 'Page + you',
  'content-pip': 'Chip',
  'content-tile': 'Tile',
  'content-card': 'Card',
  'content-cutout': 'Cutout',
}

export const ANCHOR_LABELS: Record<StageAnchor, string> = {
  br: 'bottom right', bl: 'bottom left', tr: 'top right', tl: 'top left', mr: 'right', ml: 'left',
}
export const variantLabel = (variant?: string | null) => {
  if (!variant) return ''
  const [anchor, size] = variant.split('-') as [StageAnchor, StageSize]
  return `${ANCHOR_LABELS[anchor] || anchor}${size === 's' ? ', small' : size === 'l' ? ', large' : ''}`
}

export const isStageFamily = (value: unknown): value is StageFamily =>
  typeof value === 'string' && (STAGE_FAMILIES as readonly string[]).includes(value)

export const sanitizeStageTrack = (value: unknown): StageSegment[] => {
  if (!Array.isArray(value)) return []
  const track = value
    .map((entry): StageSegment | null => {
      if (!entry || typeof entry !== 'object') return null
      const segment = entry as Record<string, unknown>
      if (!isStageFamily(segment.family)) return null
      const atMs = Number(segment.atMs)
      const treatment = isStageTreatment(segment.treatment) ? segment.treatment : ''
      const variant = isStageVariant(segment.family, segment.variant) ? (segment.variant as StageVariant) : undefined
      return { atMs: Number.isFinite(atMs) ? Math.max(0, atMs) : 0, family: segment.family, ...(treatment ? { treatment } : {}), ...(variant ? { variant } : {}) }
    })
    .filter((segment): segment is StageSegment => Boolean(segment))
    .sort((a, b) => a.atMs - b.atMs)
  // Collapse repeats.
  return track.filter(
    (segment, index) =>
      index === 0 ||
      segment.family !== track[index - 1].family ||
      (segment.treatment || '') !== (track[index - 1].treatment || '') ||
      (segment.variant || '') !== (track[index - 1].variant || ''),
  )
}

export const stageAt = (track: StageSegment[], atMs: number): StageSegment | null => {
  let current: StageSegment | null = null
  for (const segment of track) {
    if (segment.atMs <= atMs) current = segment
    else break
  }
  return current || track[0] || null
}

/** The legacy per-block presenter setting, read as a single-segment track. */
export const familyForCameraMode = (mode: string, position: string): StageFamily => {
  if (position === 'hidden') return 'content-full'
  switch (mode) {
    case 'person-only': return 'speaker-full'
    case 'person-background-left':
    case 'person-background-right': return 'speaker-panel'
    case 'split': return 'split'
    case 'portrait-rail':
    case 'portrait-overlay': return 'content-card'
    case 'information-tile': return 'content-cutout'
    default: return 'content-pip'
  }
}

/** The director's storyboard (entries with beat indices) as a stage track. */
export const stageTrackFromStoryboard = (
  entries: Array<{ family?: string; treatment?: string; beats?: number[]; fromEndMs?: number; variant?: string }>,
  beatOffsetsMs: number[],
  beatDurationsMs: number[] = [],
): StageSegment[] => {
  const track: StageSegment[] = []
  entries.forEach(entry => {
    const family = isStageFamily(entry.family) ? entry.family : null
    if (!family || !Array.isArray(entry.beats) || !entry.beats.length) return
    const first = Math.min(...entry.beats)
    const last = Math.max(...entry.beats)
    // An entry can start a little before the end of its beat (the lead-out
    // into the next scene) instead of at the beat's start.
    const fromEnd = Number(entry.fromEndMs)
    const atMs =
      Number.isFinite(fromEnd) && fromEnd > 0
        ? Math.max(beatOffsetsMs[first] ?? 0, (beatOffsetsMs[last] ?? 0) + (beatDurationsMs[last] ?? 0) - fromEnd)
        : beatOffsetsMs[first] ?? 0
    const treatment = isStageTreatment(entry.treatment) ? entry.treatment : ''
    const variant = isStageVariant(family, entry.variant) ? (entry.variant as StageVariant) : undefined
    track.push({ atMs, family, ...(treatment ? { treatment } : {}), ...(variant ? { variant } : {}) })
  })
  return sanitizeStageTrack(track)
}

/** Live overrides replace the director's track from the first override on. */
export const mergeStageOverrides = (track: StageSegment[], overrides: StageSegment[]): StageSegment[] => {
  if (!overrides.length) return track
  const first = overrides[0].atMs
  return sanitizeStageTrack([...track.filter(segment => segment.atMs < first), ...overrides])
}

const rectCss = (rect: StageRect) =>
  `left:${rect.left}% !important;top:${rect.top}% !important;width:${rect.width}% !important;height:${rect.height}% !important;right:auto !important;bottom:auto !important;translate:none !important;`

/** CSS for the stage families: geometry per family, smooth reframes. */
export const stageCss = () => {
  const ease = 'cubic-bezier(.65,.05,.25,1)'
  const rules: string[] = [
    // Any staged scene: the camera and the page are positioned by the stage,
    // never by the per-block presenter mode; both travel smoothly.
    // (Inactive scenes stay hidden: visibility is inherited from the scene.)
    `.scene[data-stage] .camera { transition: left .62s ${ease}, top .62s ${ease}, width .62s ${ease}, height .62s ${ease}, border-radius .62s ${ease}, opacity .45s ease; object-fit: cover; scale: 1 !important; z-index: 30; }`,
    `.scene[data-stage] .camera.camera-hidden { display: block !important; }`,
    `.scene[data-stage] > .content { position: absolute; margin: 0 !important; max-width: none !important; display: flex; flex-direction: column; justify-content: center; align-items: stretch; transition: left .62s ${ease}, top .62s ${ease}, width .62s ${ease}, height .62s ${ease}, opacity .45s ease; box-sizing: border-box; padding: 0 !important; }`,
    `.scene[data-stage] > .content .slide-stage svg.slide-svg { width: 100% !important; max-height: 100%; }`,
    `.scene[data-stage] { padding: 0 !important; }`,
    `.scene[data-stage="speaker-full"] .camera, .scene[data-stage="speaker-lead"] .camera, .scene[data-stage="speaker-panel"] .camera, .scene[data-stage="split"] .camera { border-width: 0 !important; border-radius: 0 !important; box-shadow: none; }`,
    `.scene[data-stage="speaker-lead"] > .content { border-radius: 18px; background: rgba(8, 12, 10, .5); backdrop-filter: blur(14px); box-shadow: 0 24px 60px rgba(0,0,0,.3); padding: 1.4% !important; }`,
    `.scene[data-stage="content-pip"] .camera { border-radius: 50% !important; }`,
    `.scene[data-stage="content-full"] .camera { opacity: 0; pointer-events: none; }`,
    `.scene[data-stage="speaker-full"] > .content { opacity: 0; pointer-events: none; }`,
    `.scene[data-stage="speaker-full"][data-stage-treatment="overlay"] > .content { opacity: 1; ${rectCss(STAGE_OVERLAY_CONTENT)} }`,
    `.scene[data-stage="speaker-full"][data-stage-treatment="overlay"] .ex-captions { display: none; }`,
    `.scene[data-stage="speaker-full"][data-stage-treatment="board"] > .content { opacity: 1; ${rectCss(STAGE_BOARD_CONTENT)} padding: 1.6% !important; border-radius: 22px; background: rgba(8, 12, 10, .58); backdrop-filter: blur(16px); box-shadow: 0 30px 80px rgba(0,0,0,.35); }`,
    `.scene[data-stage="speaker-full"][data-stage-treatment="board"] .ex-captions { display: none; }`,
    `.scene[data-stage="speaker-full"] .logo-footer-left, .scene[data-stage="speaker-full"] .scene-index { opacity: 0; }`,
  ]
  ;(Object.keys(STAGE_GEOMETRY) as StageFamily[]).forEach(family => {
    const geometry = STAGE_GEOMETRY[family]
    if (geometry.camera) rules.push(`.scene[data-stage="${family}"] .camera { ${rectCss(geometry.camera)} }`)
    else rules.push(`.scene[data-stage="${family}"] .camera { ${rectCss(STAGE_GEOMETRY['content-pip'].camera!)} }`)
    if (geometry.content) rules.push(`.scene[data-stage="${family}"] > .content { ${rectCss(geometry.content)} }`)
    else rules.push(`.scene[data-stage="${family}"] > .content { ${rectCss(STAGE_OVERLAY_CONTENT)} }`)
    // Placement variants: anchor and size for the floating families.
    variantsFor(family).forEach(variant => {
      const placed = stageGeometryFor(family, variant)
      rules.push(`.scene[data-stage="${family}"][data-stage-variant="${variant}"] .camera { ${rectCss(placed.camera!)} }`)
      if (placed.content) rules.push(`.scene[data-stage="${family}"][data-stage-variant="${variant}"] > .content { ${rectCss(placed.content)} }`)
    })
  })
  rules.push(`.scene[data-stage="content-tile"] .camera, .scene[data-stage="content-cutout"] .camera, .scene[data-stage="content-card"] .camera, .scene[data-stage="content-lead"] .camera { border-radius: var(--video-radius, 18px) !important; }`)
  return rules.join('\n    ')
}
