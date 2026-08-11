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
export type RevealStyle = 'none' | 'fade' | 'rise' | 'type' | 'line-by-line'
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
}

export type HumanCameraTrackV1 = {
  kind: 'human-camera'
  videoUrl: string
  audioUrl?: string
  audioKind: 'recorded-mic' | 'generated' | 'none'
  trimStartMs?: number
}

export type NarrationTrackV1 = {
  kind: 'narration'
  audioUrl: string
  audioKind: 'generated' | 'recorded-mic'
}

export type PresenterTrackV1 = HumanCameraTrackV1 | NarrationTrackV1

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
export type ThemeTitleStyle = 'statement' | 'split' | 'lower-third'
export type ThemeListStyle = 'bullets' | 'cards' | 'timeline' | 'steps'
export type ThemeCodeStyle = 'panel' | 'terminal' | 'full'
export type ThemeQuoteStyle = 'bar' | 'card' | 'statement'
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
    list: ThemeListStyle
    code: ThemeCodeStyle
    quote: ThemeQuoteStyle
    surface: ThemeSurfaceStyle
    borderRadius: number
  }
  motion: {
    title: RevealStyle
    content: RevealStyle
    list: RevealStyle
    code: RevealStyle
    quote: RevealStyle
  }
}

export type ProjectDocumentV1 = {
  version: 1
  id: string
  title: string
  notebook: TiptapDocument
  fps: 30
  width: 1920
  height: 1080
  blocks: Record<NodeId, BlockRenderConfigV1>
  presenterTracks: Record<NodeId, PresenterTrackV1[]>
  brand: BrandTemplateV1
  theme?: StudioThemeV1
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
