// The stage: who owns the frame at any moment of a scene — the page, the
// presenter, or both in one of the shared families (Motion Core Part II
// §11–13, Part V layout track). A scene carries a stage track (segments by
// scene time); the composition applies it as a data attribute the CSS
// animates, so every change is a smooth reframe. The presenter can override
// it live; the director writes the default.
export const STAGE_FAMILIES = [
  'content-full',
  'speaker-full',
  'speaker-panel',
  'split',
  'content-pip',
  'content-card',
  'content-cutout',
] as const
export type StageFamily = (typeof STAGE_FAMILIES)[number]
export type StageTreatment = '' | 'overlay' | 'glow-bed-hero'

export type StageSegment = { atMs: number; family: StageFamily; treatment?: StageTreatment }

export type StageRect = { left: number; top: number; width: number; height: number }
export type StageGeometry = {
  camera: StageRect | null
  content: StageRect | null
  cameraShape: 'circle' | 'rounded' | 'full'
}

// Frame fractions (percent of 1920×1080). The page keeps its aspect inside
// its rect; the camera is cropped to its rect (object-fit: cover).
export const STAGE_GEOMETRY: Record<StageFamily, StageGeometry> = {
  'content-full': { camera: null, content: { left: 4.7, top: 5, width: 90.6, height: 90 }, cameraShape: 'rounded' },
  'speaker-full': { camera: { left: 0, top: 0, width: 100, height: 100 }, content: null, cameraShape: 'full' },
  'speaker-panel': { camera: { left: 0, top: 0, width: 44, height: 100 }, content: { left: 47, top: 8, width: 50, height: 84 }, cameraShape: 'full' },
  split: { camera: { left: 50, top: 0, width: 50, height: 100 }, content: { left: 3, top: 10, width: 44, height: 80 }, cameraShape: 'full' },
  'content-pip': { camera: { left: 79, top: 64, width: 16, height: 28.45 }, content: { left: 4.7, top: 5, width: 90.6, height: 90 }, cameraShape: 'circle' },
  'content-card': { camera: { left: 72, top: 8, width: 24, height: 84 }, content: { left: 3, top: 6, width: 66, height: 88 }, cameraShape: 'rounded' },
  'content-cutout': { camera: { left: 2.5, top: 50, width: 24, height: 46 }, content: { left: 4.7, top: 5, width: 90.6, height: 90 }, cameraShape: 'rounded' },
}

// The title-card overlay a speaker-full moment can carry.
export const STAGE_OVERLAY_CONTENT: StageRect = { left: 56, top: 56, width: 40, height: 36 }

export const STAGE_LABELS: Record<StageFamily, string> = {
  'content-full': 'Page',
  'speaker-full': 'You',
  'speaker-panel': 'Panel',
  split: 'Split',
  'content-pip': 'Chip',
  'content-card': 'Card',
  'content-cutout': 'Cutout',
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
      const treatment = segment.treatment === 'overlay' || segment.treatment === 'glow-bed-hero' ? segment.treatment : ''
      return { atMs: Number.isFinite(atMs) ? Math.max(0, atMs) : 0, family: segment.family, ...(treatment ? { treatment } : {}) }
    })
    .filter((segment): segment is StageSegment => Boolean(segment))
    .sort((a, b) => a.atMs - b.atMs)
  // Collapse repeats.
  return track.filter((segment, index) => index === 0 || segment.family !== track[index - 1].family || (segment.treatment || '') !== (track[index - 1].treatment || ''))
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
  entries: Array<{ family?: string; treatment?: string; beats?: number[] }>,
  beatOffsetsMs: number[],
): StageSegment[] => {
  const track: StageSegment[] = []
  entries.forEach(entry => {
    const family = isStageFamily(entry.family) ? entry.family : null
    if (!family || !Array.isArray(entry.beats) || !entry.beats.length) return
    const first = Math.min(...entry.beats)
    const atMs = beatOffsetsMs[first] ?? 0
    const treatment = entry.treatment === 'overlay' || entry.treatment === 'glow-bed-hero' ? entry.treatment : ''
    track.push({ atMs, family, ...(treatment ? { treatment } : {}) })
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
    `.scene[data-stage="speaker-full"] .camera, .scene[data-stage="speaker-panel"] .camera, .scene[data-stage="split"] .camera { border-width: 0 !important; border-radius: 0 !important; box-shadow: none; }`,
    `.scene[data-stage="content-pip"] .camera { border-radius: 50% !important; }`,
    `.scene[data-stage="content-full"] .camera { opacity: 0; pointer-events: none; }`,
    `.scene[data-stage="speaker-full"] > .content { opacity: 0; pointer-events: none; }`,
    `.scene[data-stage="speaker-full"][data-stage-treatment="overlay"] > .content { opacity: 1; ${rectCss(STAGE_OVERLAY_CONTENT)} }`,
    `.scene[data-stage="speaker-full"][data-stage-treatment="overlay"] .ex-captions { display: none; }`,
    `.scene[data-stage="speaker-full"] .logo-footer-left, .scene[data-stage="speaker-full"] .scene-index { opacity: 0; }`,
  ]
  ;(Object.keys(STAGE_GEOMETRY) as StageFamily[]).forEach(family => {
    const geometry = STAGE_GEOMETRY[family]
    if (geometry.camera) rules.push(`.scene[data-stage="${family}"] .camera { ${rectCss(geometry.camera)} }`)
    else rules.push(`.scene[data-stage="${family}"] .camera { ${rectCss(STAGE_GEOMETRY['content-pip'].camera!)} }`)
    if (geometry.content) rules.push(`.scene[data-stage="${family}"] > .content { ${rectCss(geometry.content)} }`)
    else rules.push(`.scene[data-stage="${family}"] > .content { ${rectCss(STAGE_OVERLAY_CONTENT)} }`)
  })
  return rules.join('\n    ')
}
