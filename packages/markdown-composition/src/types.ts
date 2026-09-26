export type NodeId = string

export type TiptapMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}

export type TiptapDocument = TiptapNode & {
  type: 'doc'
  content: TiptapNode[]
}

export type SceneLayout = 'title' | 'prose' | 'code' | 'split'
export type RevealStyle =
  | 'none'
  | 'fade'
  | 'rise'
  | 'fall'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'blur'
  | 'type'
  | 'wipe'
  | 'pop'
  | 'line-by-line'
export type BlockBackgroundPreset =
  | 'brand'
  | 'violet'
  | 'sunset'
  | 'ocean'
  | 'mint'
  | 'rose'
  | 'paper'
  | 'charcoal'
  | 'custom'
export type CameraPosition =
  | 'hidden'
  | 'full'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'overlay-left'
  | 'overlay-right'
  | 'split-left'
  | 'split-right'
export type PresenterLayoutMode =
  | 'information-circle'
  | 'information-tile'
  | 'portrait-overlay'
  | 'portrait-rail'
  | 'split'
  | 'person-background-left'
  | 'person-background-right'
  | 'person-only'
export type FrameTransitionStyle =
  | 'cut'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'wipe'
  | 'zoom'
export type MediaBorderWidth = 'none' | 'thin' | 'medium' | 'thick'
export type MediaCornerStyle = 'square' | 'soft' | 'rounded'
export type MediaElevation = 'flat' | 'soft' | 'lifted'

export type BlockRenderConfigV1 = {
  nodeId: NodeId
  layout: SceneLayout
  durationMs: number
  reveal: RevealStyle
  alignment: 'left' | 'center'
  background: {
    preset: BlockBackgroundPreset
    color: string
  }
  camera: {
    mode: PresenterLayoutMode
    position: CameraPosition
    shape: 'circle' | 'rounded-rectangle'
    scale: number
  }
  // Who owns the frame over the scene (page blocks). follow = the director's
  // stage track; override = one family for the whole block; overrides = the
  // presenter's live switches during the last take (scene time, ms).
  stage?: {
    follow: boolean
    override?: string | null
    overrides?: Array<{ atMs: number; family: string }>
  }
  appearance: {
    layout: ThemeBlockLayout
    render: ThemeBlockRendering
    codeTheme: ThemeCodeSyntax
    codeAnimation: ThemeCodeAnimation
  }
  mediaFrame: {
    borderWidth: MediaBorderWidth
    corners: MediaCornerStyle
    elevation: MediaElevation
  }
  speakerNotes?: string
  notesTargetMinutes?: number
  revealDurationSeconds?: number
  frameTransition?: {
    style: FrameTransitionStyle
    durationSeconds?: number
  }
}

export type HumanCameraTrackV1 = {
  kind: 'human-camera'
  videoUrl: string
  audioUrl?: string
  audioKind: 'recorded-mic' | 'generated' | 'none'
  trimStartMs?: number
}

export type NarrationTrackV1 = {
  recordingId?: string
  kind: 'narration'
  audioUrl: string
  audioKind: 'generated' | 'recorded-mic'
}

export type PresenterTrackV1 = HumanCameraTrackV1 | NarrationTrackV1

// A scene produced from its approved plan and accepted (P4): the render of
// the accepted bundle, from the pinned producer, and what it was made of.
export type ProducedSceneV1 = {
  productionId: string
  videoUrl: string
  durationMs: number
  // The accepted bundle's hash, and the approved plan it realizes.
  bundle: string
  plan: { record: string; revision: number }
  acceptedAt: string
  // Whether the render carries the scene's voice; a silent scene's does not.
  voiced: boolean
  // The creator's edit revision the render was made with (P6).
  edits?: number
}

export type RecordedBlockV1 = {
  blockId: NodeId
  recordingId: string
  videoUrl: string
  durationMs: number
  recordedAt: string
  storage: 'minio' | 'supabase' | 'local'
  // What the take is: absent or 'scene' is a composed scene recording (the
  // directed canvas capture — it legitimately replaces the scene at compile).
  // 'presenter' is raw camera footage from the camera dialog: it composes
  // WITH the scene's graphics as the presenter track, never replaces them.
  role?: 'scene' | 'presenter'
  // A page scene's take keeps the plan: the composite is kept for review,
  // the camera (carrying the voice) is its own track, and the presses that
  // advanced the beats are marks the plan is re-timed to at compile — so
  // the page re-renders from the plan, at full resolution, at the pace it
  // was spoken.
  keepsPlan?: boolean
  cameraUrl?: string
  cameraAssetId?: string
  beatMarksMs?: number[]
  // The words the take was spoken against: their fingerprint, each line's
  // fingerprint and, when a scene plan supplied them, that plan's record and
  // revision. A later script never relabels an earlier take as current.
  script?: { hash: string; lines?: string[]; treatment?: string; revision?: number }
  // A pickup: a take of only some of the scene's lines, recorded to replace
  // those lines of the selected take. It is never the scene's selected take.
  pickup?: boolean
}

export type BrandTemplateV1 = {
  background: string
  surface: string
  text: string
  mutedText: string
  primary: string
  secondary: string
  accent: string
  codeBackground: string
}

export type ThemeSource = 'built-in' | 'generated' | 'custom'
export type ThemeCanvasTreatment = 'solid' | 'gradient' | 'grid'
export type ThemeVideoLayout =
  | 'information-circle'
  | 'information-tile'
  | 'portrait-overlay'
  | 'portrait-rail'
  | 'split'
  | 'person-background-left'
  | 'person-background-right'
  | 'person-only'
export type ThemeBorderStyle = 'none' | 'solid' | 'gradient'
export type ThemeBlockKind = 'title' | 'content' | 'list' | 'code' | 'quote'
export type ThemeBlockLayout =
  | 'center'
  | 'left'
  | 'right'
  | 'upper'
  | 'lower'
  | 'split-left'
  | 'split-right'
  | 'full'
export type ThemeTitleStyle =
  | 'statement'
  | 'split'
  | 'lower-third'
  | 'editorial'
  | 'framed'
  | 'gradient'
  | 'outline'
  | 'highlight'
  | 'compact'
export type ThemeContentStyle =
  | 'editorial'
  | 'card'
  | 'columns'
  | 'lede'
  | 'callout'
  | 'minimal'
  | 'highlight'
  | 'caption'
export type ThemeListStyle =
  | 'bullets'
  | 'cards'
  | 'timeline'
  | 'steps'
  | 'pills'
  | 'checklist'
  | 'number-grid'
  | 'spotlight'
  | 'columns'
  | 'compact'
export type ThemeCodeStyle =
  | 'panel'
  | 'terminal'
  | 'full'
  | 'editor'
  | 'glass'
  | 'minimal'
  | 'spotlight'
  | 'split'
  | 'paper'
export type ThemeCodeSyntax =
  | 'light_vs'
  | 'light_plus'
  | 'quietlight'
  | 'solarized_light'
  | 'abyss'
  | 'dark_vs'
  | 'dark_plus'
  | 'kimbie_dark'
  | 'monokai'
  | 'monokai_dimmed'
  | 'red'
  | 'solarized_dark'
  | 'tomorrow_night_blue'
  | 'hc_black'
export type ThemeCodeAnimation = 'type-lines' | 'highlight-lines'
export type ThemeQuoteStyle =
  | 'bar'
  | 'card'
  | 'statement'
  | 'pull'
  | 'speech'
  | 'highlight'
  | 'framed'
  | 'minimal'
  | 'oversized'
export type ThemeBlockRendering =
  | ThemeTitleStyle
  | ThemeContentStyle
  | ThemeListStyle
  | ThemeCodeStyle
  | ThemeQuoteStyle
export type ThemeSurfaceStyle = 'none' | 'outline' | 'card'

export type StudioThemeV1 = {
  version: 1
  id: string
  name: string
  description: string
  source: ThemeSource
  brand: BrandTemplateV1
  logo: {
    url: string
    placement: 'top-left' | 'top-right' | 'footer-left' | 'footer-right'
    size: number
  }
  canvas: {
    treatment: ThemeCanvasTreatment
    gradient: [string, string]
    gridColor: string
  }
  video: {
    layout: ThemeVideoLayout
    borderStyle: ThemeBorderStyle
    borderWidth: number
    borderRadius: number
  }
  blocks: {
    title: ThemeTitleStyle
    content: ThemeContentStyle
    list: ThemeListStyle
    code: ThemeCodeStyle
    codeTheme: ThemeCodeSyntax
    codeAnimation: ThemeCodeAnimation
    quote: ThemeQuoteStyle
    surface: ThemeSurfaceStyle
    borderRadius: number
    layout: Record<ThemeBlockKind, ThemeBlockLayout>
  }
  motion: {
    title: RevealStyle
    content: RevealStyle
    list: RevealStyle
    code: RevealStyle
    quote: RevealStyle
  }
  // The type families read off the brand's site, when the theme was saved
  // from a site read: reusing the theme restores its typography too.
  // Optional — hand-authored themes carry none.
  fonts?: { display: string; body: string; mono: string; seen?: string[] }
  // Where its colours came from, when it was made from a source read: read
  // off a website, defaults because none could be read, or chosen by hand.
  // Optional — hand-authored themes carry none.
  colours?: { provenance: 'extracted' | 'fallback' | 'manual'; from: string }
}

// ——— A project and its notebooks ———
// The project the creator sees is a container. It holds notebooks, each a
// document of its own with the model its kind needs — a video keeps takes,
// produced scenes and export settings a presentation never has — and each
// made from another notebook of the project. The kinds and what each is made
// from are listed in formats.ts: a new kind, a live stream or a newsletter,
// is a new entry there, and nothing about how projects are stored changes.
export type NotebookKind = 'text' | 'wireframe' | 'presentation' | 'video'

// The project itself: what belongs to the whole, not to one notebook. Which
// notebooks it holds is said by the notebooks — each names its project — so
// there is one record of it.
export type ProjectContainerV1 = {
  version: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

// A notebook's place in its project: which project, what kind of notebook
// it is there, and the notebook of the project it was made from. A video
// keeps its pinned base in derivedFrom as well.
export type NotebookPlaceV1 = {
  id: string
  kind: NotebookKind
  from?: string
}

// A notebook still being made in the background (the four-notebook
// model). The import opens on the project's text as soon as the brand is
// chosen; its wireframe is saved at once, waiting for the outline — from
// the story run named here, or the direct model — and is then drawn from
// it. Whoever opens the project, or restarts the app, finds it waiting and
// sees it through.
export type NotebookBuildV1 = {
  kind: 'wireframe'
  via: 'harness' | 'api'
  runId?: string
  // Who makes it, as the creator reads it: "Claude Code · Claude Opus 5.5".
  by: string
  startedAt: string
  // What the outline is made from: the article's stored read, the authored
  // narrative, the wording policy and the length asked for.
  sourceRevision?: string
  narrativeRevision?: string
  wording: 'preserve' | 'assist' | 'draft'
  targetSeconds?: number | null
  // The palette and fonts the pages are drawn in, and the site they name.
  brand: { palette: Record<string, unknown>; fonts: Record<string, unknown> | null; mode: string; site: string }
  // Why it could not be made, when it could not.
  failure?: { message: string; at: string }
}

// Where a derived notebook came from. A video fork pins the revision of the
// base it was taken from and keeps a snapshot of it, so the video stays
// intelligible and renderable even when the base moves on or goes away.
export type ProjectDerivationV1 = {
  notebook: string
  kind?: string
  // The base as it was at the fork: a content revision, when it was taken,
  // and the stored copy it was taken from.
  baseRevision?: string
  baseTitle?: string
  forkedAt?: string
  // The caller's own key for the fork, so an interrupted request that is
  // retried returns the same child instead of making another one.
  forkKey?: string
  snapshot?: { assetId: string; objectKey: string }
  // What the fork carried over, for the record.
  receipt?: { scenes: number; assets: number; at: string }
}

export type ProjectDocumentV1 = {
  version: 1
  id: string
  title: string
  // Derivation lineage: this notebook was derived from another one (e.g. a
  // video fork of a presentation notebook). Optional and additive.
  derivedFrom?: ProjectDerivationV1
  // The project this notebook belongs to and what it is there. A notebook
  // with none stands alone, as every notebook did before projects.
  container?: NotebookPlaceV1
  // Set while the notebook is still being made in the background.
  build?: NotebookBuildV1
  notebook: TiptapDocument
  fps: 30
  width: 1920
  height: 1080
  blocks: Record<NodeId, BlockRenderConfigV1>
  presenterTracks: Record<NodeId, PresenterTrackV1[]>
  recordedBlocks?: Record<NodeId, RecordedBlockV1>
  recordedBlockTakes?: Record<NodeId, RecordedBlockV1[]>
  // Scenes produced from their approved plans and accepted (P4): the render
  // of each replaces the scene — the frames and sound the creator accepted.
  producedScenes?: Record<NodeId, ProducedSceneV1>
  // Custom atomic shapes for explainer diagrams, merged over the built-in
  // vocabulary (see explainer.ts) by shape key.
  shapeCollection?: import('./explainer').ShapeDefV1[]
  brand: BrandTemplateV1
  theme?: StudioThemeV1
  // Phase 0: where this video began and the outline it was planned from.
  // Additive; older notebooks have neither.
  source?: { kind: 'url' | 'narrative'; url: string; site: string; title: string; readAt: string; snapshotId?: string; logoUrl?: string }
  outline?: {
    title: string
    targetSeconds: number
    // A page's plan: its idea, its first line, and the parts it is drawn
    // from and how they relate — what a design run draws the page from.
    scenes: Array<{ nodeId?: string; title: string; kind: string; seconds: number; idea: string; source?: string[]; narration?: string; parts?: unknown[]; relations?: unknown[] }>
    glossary: Array<{ term: string; meaning: string }>
    // The explanation model's objects — one thing keeps one id on every
    // page — and the palette and fonts the pages are drawn in.
    objects?: Array<{ id: string; label: string; kind: string; scenes: string[] }>
    pageBrand?: { palette: Record<string, unknown>; fonts: Record<string, unknown> | null; mode: string }
  }
  // The explainer delivery journey chosen in Create explainer: a recorded
  // human presenter or generated narration. Recorded per notebook; an
  // explicit previous choice is remembered, never assumed for a new one.
  // Additive; older notebooks have none until they choose.
  explainerDelivery?: 'human' | 'generated'
  // The story records this notebook was built from (D2): the wording policy
  // in force, the authored narrative revision and the explanation model.
  // Additive; older notebooks have none.
  story?: { wordingPolicy?: 'preserve' | 'assist' | 'draft'; narrativeId?: string; modelId?: string }
  // The asset library: one asset per thing (keyed by what it is, not by
  // which unit shows it), in the video's palette, reused on every page
  // that names the thing. Additive; older notebooks have none.
  assets?: AssetRecordV1[]
  // Captions: burned into the picture at render (the VTT/SRT files exist
  // either way).
  captions?: { burnIn: boolean }
}

export type AssetRecordV1 = {
  id: string
  kind: 'image' | 'glyph' | 'logo' | 'clip'
  entityKey: string
  label: string
  type: string
  url: string
  palette: { accent: string; background: string }
  prompt?: string
  model?: string
  width?: number
  height?: number
  createdAt: string
  scenes: NodeId[]
}

export type Scene = {
  id: NodeId
  index: number
  node: TiptapNode
  title: string
  kind: 'title' | 'content' | 'code' | 'list' | 'quote'
  startSeconds: number
  durationSeconds: number
  config: BlockRenderConfigV1
  presenterTracks: PresenterTrackV1[]
}

export type CompiledComposition = {
  html: string
  scenes: Scene[]
  durationSeconds: number
  warnings: string[]
}
