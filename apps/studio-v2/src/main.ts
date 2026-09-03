import '@hyperframes/player'
import { Editor, Extension, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import {
  builtinStudioThemes,
  compileProject,
  createDefaultBlockConfig,
  defaultBrand,
  defaultStudioTheme,
  explainerDurationSeconds,
  mergedShapeCollection,
  renderExplainerDiagram,
  sanitizeExplainerPlan,
  type ExplainerPlanV1,
  type ShapeDefV1,
  estimateSpokenSeconds,
  generateThemeDirections,
  normalizeStudioTheme,
  normalizedRectStyle,
  presenterLayoutGeometry,
  sanitizeNotebookMedia,
  type BlockBackgroundPreset,
  type BlockRenderConfigV1,
  type CameraPosition,
  type FrameTransitionStyle,
  type MediaBorderWidth,
  type MediaCornerStyle,
  type MediaElevation,
  type ProjectDocumentV1,
  type RecordedBlockV1,
  type PresenterLayoutMode,
  type RevealStyle,
  type Scene,
  type SceneLayout,
  type StudioThemeV1,
  type ThemeBlockKind,
  type ThemeBlockLayout,
  type ThemeBlockRendering,
  type ThemeCanvasTreatment,
  type ThemeCodeAnimation,
  type ThemeCodeSyntax,
  type TiptapDocument,
  type TiptapNode,
} from 'markdown-composition'
import NodeIdentifier from 'node-identifier'
import { ExplainerBlock, ImageBlock, ScreenRecordingBlock } from './media-nodes'
import './styles.css'

const studioLogoUrl = new URL(
  '../../webfront/svg/StudioLogo.svg',
  import.meta.url,
).href
const logomarkUrl = new URL(
  '../../webfront/svg/Logomark.svg',
  import.meta.url,
).href
const previewPresenterUrls = {
  arun: new URL('./assets/presenters/arun.jpg', import.meta.url).href,
  maya: new URL('./assets/presenters/maya.jpg', import.meta.url).href,
  jin: new URL('./assets/presenters/jin.jpg', import.meta.url).href,
  theo: new URL('./assets/presenters/theo.jpg', import.meta.url).href,
  sofia: new URL('./assets/presenters/sofia.jpg', import.meta.url).href,
} as const

const PREVIEW_PRESENTERS = [
  { id: 'arun', name: 'Arun', url: previewPresenterUrls.arun },
  { id: 'maya', name: 'Maya', url: previewPresenterUrls.maya },
  { id: 'jin', name: 'Jin', url: previewPresenterUrls.jin },
  { id: 'theo', name: 'Theo', url: previewPresenterUrls.theo },
  { id: 'sofia', name: 'Sofia', url: previewPresenterUrls.sofia },
] as const

type PreviewPresenterId = (typeof PREVIEW_PRESENTERS)[number]['id']
type ThemePreviewKind = 'title' | 'content' | 'list' | 'code' | 'quote' | 'video'
type ThemeLabAxis = 'layout' | 'render' | 'syntax' | 'motion' | 'code-motion'
type ThemeRenderValue =
  | StudioThemeV1['blocks']['title']
  | StudioThemeV1['blocks']['content']
  | StudioThemeV1['blocks']['list']
  | StudioThemeV1['blocks']['code']
  | StudioThemeV1['blocks']['quote']
type CatalogOption<Value extends string> = {
  value: Value
  label: string
  description: string
  glyph: string
}

const BLOCK_KIND_META: Record<ThemeBlockKind, { label: string; description: string }> = {
  title: { label: 'Title system', description: 'Headlines and section openers' },
  content: { label: 'Text system', description: 'Paragraphs and explanations' },
  list: { label: 'Point system', description: 'Bullets, steps and sequences' },
  code: { label: 'Code system', description: 'Technical walkthroughs' },
  quote: { label: 'Quote system', description: 'Statements and callouts' },
}

const BLOCK_LAYOUT_OPTIONS: CatalogOption<ThemeBlockLayout>[] = [
  { value: 'center', label: 'Centered', description: '72% centered focal stack', glyph: '⊙' },
  { value: 'left', label: 'Left rail', description: '62% left story column', glyph: '◧' },
  { value: 'right', label: 'Right rail', description: '62% right story column', glyph: '◨' },
  { value: 'upper', label: 'Upper stage', description: '78% across the top', glyph: '⬒' },
  { value: 'lower', label: 'Lower stage', description: '78% across the bottom', glyph: '⬓' },
  { value: 'split-left', label: 'Split left', description: '44% compact left lane', glyph: '◫' },
  { value: 'split-right', label: 'Split right', description: '44% compact right lane', glyph: '◫' },
  { value: 'full', label: 'Full canvas', description: 'Maximum safe-area width', glyph: '▣' },
]

const IMAGE_PLACEMENT_OPTIONS: CatalogOption<ThemeBlockLayout>[] = [
  { value: 'center', label: 'Balanced focus', description: 'Calm centered composition', glyph: '⊙' },
  { value: 'left', label: 'Story + human', description: 'Image leads, presenter supports', glyph: '◧' },
  { value: 'full', label: 'Immersive', description: 'Maximum presenter-safe image', glyph: '▣' },
]

const SCREEN_PLACEMENT_OPTIONS: CatalogOption<ThemeBlockLayout>[] = [
  { value: 'center', label: 'Demo focus', description: 'Centered readable capture', glyph: '⊙' },
  { value: 'left', label: 'Demo + human', description: 'Screen leads, presenter supports', glyph: '◧' },
  { value: 'full', label: 'Full screen', description: 'Maximum presenter-safe demo', glyph: '▣' },
]

const MEDIA_PLACEMENT_VALUES = new Set<ThemeBlockLayout>(
  IMAGE_PLACEMENT_OPTIONS.map(option => option.value),
)

const BLOCK_RENDER_OPTIONS: Record<
  ThemeBlockKind,
  CatalogOption<ThemeRenderValue>[]
> = {
  title: [
    ['statement', 'Statement', 'Large decisive headline', 'Aa'],
    ['split', 'Split editorial', 'Copy in a narrow column', 'A|'],
    ['lower-third', 'Lower third', 'Broadcast-style title', '▁A'],
    ['editorial', 'Editorial', 'Magazine rhythm and kicker', '¶'],
    ['framed', 'Framed', 'Headline inside a border', '▢'],
    ['gradient', 'Gradient type', 'Brand-gradient headline', '◒'],
    ['outline', 'Outline type', 'High-impact stroked letters', 'A̲'],
    ['highlight', 'Highlight band', 'Color-backed emphasis', '▰'],
    ['compact', 'Compact', 'Dense short-form title', 'A·'],
  ].map(([value, label, description, glyph]) => ({ value, label, description, glyph })) as CatalogOption<ThemeRenderValue>[],
  content: [
    ['editorial', 'Editorial', 'Readable article typography', '¶'],
    ['card', 'Content card', 'Copy on a raised surface', '▤'],
    ['columns', 'Two columns', 'Dense information split', '▥'],
    ['lede', 'Large lede', 'Lead with the first thought', 'L'],
    ['callout', 'Callout', 'Accent edge and emphasis', '!'],
    ['minimal', 'Minimal', 'Quiet text-only canvas', '—'],
    ['highlight', 'Highlighted', 'Brand-backed sentence', '▰'],
    ['caption', 'Caption', 'Compact supporting copy', 'cc'],
  ].map(([value, label, description, glyph]) => ({ value, label, description, glyph })) as CatalogOption<ThemeRenderValue>[],
  list: [
    ['bullets', 'Gradient bullets', 'Classic brand markers', '••'],
    ['cards', 'Point cards', 'One surface per idea', '▤'],
    ['timeline', 'Timeline', 'Connected horizontal flow', '●—'],
    ['steps', 'Numbered steps', 'Explicit ordered sequence', '01'],
    ['pills', 'Pills', 'Compact rounded points', '▰'],
    ['checklist', 'Checklist', 'Completion-oriented list', '✓'],
    ['number-grid', 'Number grid', 'Bold modular sequence', '#'],
    ['spotlight', 'Spotlight', 'One dominant point', '◎'],
    ['columns', 'Columns', 'Parallel point groups', '▥'],
    ['compact', 'Compact', 'High-density bullet rail', '≡'],
  ].map(([value, label, description, glyph]) => ({ value, label, description, glyph })) as CatalogOption<ThemeRenderValue>[],
  code: [
    ['panel', 'Code panel', 'Clean developer surface', '</>'],
    ['terminal', 'Terminal', 'CLI window with chrome', '>_'],
    ['full', 'Full canvas', 'Maximum code area', '▣'],
    ['editor', 'Editor', 'IDE-inspired frame', '⌘'],
    ['glass', 'Glass', 'Translucent floating panel', '◇'],
    ['minimal', 'Minimal', 'No-window code treatment', '—'],
    ['spotlight', 'Spotlight', 'Focused code excerpt', '◎'],
    ['split', 'Code + notes', 'Code beside explanation', '◫'],
    ['paper', 'Paper', 'Light printed-code style', '▧'],
  ].map(([value, label, description, glyph]) => ({ value, label, description, glyph })) as CatalogOption<ThemeRenderValue>[],
  quote: [
    ['bar', 'Accent bar', 'Classic editorial quote', '│'],
    ['card', 'Quote card', 'Statement on a surface', '▤'],
    ['statement', 'Statement', 'Large centered quote', '“'],
    ['pull', 'Pull quote', 'Oversized opening mark', '❝'],
    ['speech', 'Speech', 'Conversational bubble', '◰'],
    ['highlight', 'Highlight', 'Brand-backed phrase', '▰'],
    ['framed', 'Framed', 'Formal bordered quote', '▢'],
    ['minimal', 'Minimal', 'Typography only', '—'],
    ['oversized', 'Oversized', 'Full-canvas words', 'AA'],
  ].map(([value, label, description, glyph]) => ({ value, label, description, glyph })) as CatalogOption<ThemeRenderValue>[],
}

const IMAGE_RENDER_OPTIONS: CatalogOption<ThemeRenderValue>[] = [
  { value: 'minimal', label: 'Clean gallery', description: 'Quiet edge and natural image', glyph: '—' },
  { value: 'card', label: 'Editorial card', description: 'Soft matte and confident lift', glyph: '▤' },
  { value: 'framed', label: 'Brand frame', description: 'Restrained branded outline', glyph: '▢' },
  { value: 'glass', label: 'Glass gallery', description: 'Light translucent presentation', glyph: '◇' },
]

const SCREEN_RENDER_OPTIONS: CatalogOption<ThemeRenderValue>[] = [
  { value: 'minimal', label: 'Clean demo', description: 'Distraction-free screen', glyph: '—' },
  { value: 'card', label: 'Product card', description: 'Raised product walkthrough', glyph: '▤' },
  { value: 'framed', label: 'Brand frame', description: 'Restrained branded outline', glyph: '▢' },
  { value: 'glass', label: 'Glass demo', description: 'Light translucent presentation', glyph: '◇' },
]

const applyRecommendedMediaFrame = (
  config: BlockRenderConfigV1,
  rendering: ThemeBlockRendering,
) => {
  if (rendering === 'card') {
    config.mediaFrame = {
      borderWidth: 'thin',
      corners: 'rounded',
      elevation: 'lifted',
    }
  } else if (rendering === 'framed') {
    config.mediaFrame = {
      borderWidth: 'medium',
      corners: 'soft',
      elevation: 'soft',
    }
  } else if (rendering === 'glass') {
    config.mediaFrame = {
      borderWidth: 'thin',
      corners: 'rounded',
      elevation: 'soft',
    }
  } else {
    config.mediaFrame = {
      borderWidth: 'thin',
      corners: 'soft',
      elevation: 'soft',
    }
  }
}

const MEDIA_BORDER_OPTIONS: CatalogOption<MediaBorderWidth>[] = [
  { value: 'none', label: 'None', description: 'Pure edge-to-canvas', glyph: '—' },
  { value: 'thin', label: 'Thin', description: 'Quiet 1px separation', glyph: '▱' },
  { value: 'medium', label: 'Medium', description: 'Clear 3px brand edge', glyph: '▣' },
  { value: 'thick', label: 'Thick', description: 'Bold 6px statement', glyph: '▰' },
]

const MEDIA_CORNER_OPTIONS: CatalogOption<MediaCornerStyle>[] = [
  { value: 'square', label: 'Square', description: 'Precise editorial edge', glyph: '□' },
  { value: 'soft', label: 'Soft', description: 'Balanced 18px corners', glyph: '▢' },
  { value: 'rounded', label: 'Rounded', description: 'Friendly 36px corners', glyph: '▣' },
]

const MEDIA_ELEVATION_OPTIONS: CatalogOption<MediaElevation>[] = [
  { value: 'flat', label: 'Flat', description: 'No added depth', glyph: '—' },
  { value: 'soft', label: 'Soft', description: 'Subtle editorial lift', glyph: '◫' },
  { value: 'lifted', label: 'Lifted', description: 'Confident focal depth', glyph: '▰' },
]

const MOTION_OPTIONS: CatalogOption<RevealStyle>[] = [
  { value: 'none', label: 'Static', description: 'No entrance motion', glyph: '—' },
  { value: 'fade', label: 'Soft fade', description: 'Quiet opacity reveal', glyph: '◌' },
  { value: 'rise', label: 'Rise', description: 'Ease upward', glyph: '↑' },
  { value: 'fall', label: 'Drop in', description: 'Ease downward', glyph: '↓' },
  { value: 'slide-left', label: 'From left', description: 'Horizontal entrance', glyph: '→' },
  { value: 'slide-right', label: 'From right', description: 'Horizontal entrance', glyph: '←' },
  { value: 'scale', label: 'Scale', description: 'Grow into focus', glyph: '⊕' },
  { value: 'blur', label: 'Focus', description: 'Resolve from blur', glyph: '◉' },
  { value: 'type', label: 'Type', description: 'Progressive text wipe', glyph: 'T' },
  { value: 'wipe', label: 'Brand wipe', description: 'Directional mask reveal', glyph: '▰' },
  { value: 'pop', label: 'Pop', description: 'Playful spring entrance', glyph: '✦' },
  { value: 'line-by-line', label: 'Sequence', description: 'Stagger items or lines', glyph: '≡' },
]

const CODE_THEME_OPTIONS: CatalogOption<ThemeCodeSyntax>[] = [
  ['light_vs', 'Light', 'VS light', '#000000'],
  ['light_plus', 'Light+', 'VS Code Light+', '#001081'],
  ['quietlight', 'Quiet Light', 'Soft editorial light', '#7a3f9d'],
  ['solarized_light', 'Solarized Light', 'Warm low-contrast light', '#288dd2'],
  ['abyss', 'Abyss', 'Deep blue-black', '#6588cc'],
  ['dark_vs', 'Dark', 'Classic VS dark', '#d4d5d4'],
  ['dark_plus', 'Dark+', 'VS Code default dark', '#9cdcfe'],
  ['kimbie_dark', 'Kimbie Dark', 'Warm sepia dark', '#d3af86'],
  ['monokai', 'Monokai', 'Vivid classic palette', '#a6e22e'],
  ['monokai_dimmed', 'Monokai Dimmed', 'Quieter Monokai', '#9872a2'],
  ['red', 'Red', 'High-energy red canvas', '#fb9b4c'],
  ['solarized_dark', 'Solarized Dark', 'Balanced cyan dark', '#268bd2'],
  ['tomorrow_night_blue', 'Tomorrow Night', 'Saturated midnight blue', '#ff9ea4'],
  ['hc_black', 'High Contrast', 'Maximum legibility', '#9cddfe'],
].map(([value, label, description, glyph]) => ({ value, label, description, glyph })) as CatalogOption<ThemeCodeSyntax>[]

const CODE_ANIMATION_OPTIONS: CatalogOption<ThemeCodeAnimation>[] = [
  { value: 'type-lines', label: 'Type lines', description: 'Token-by-token line construction', glyph: '>_' },
  { value: 'highlight-lines', label: 'Highlight lines', description: 'Dim context and focus each step', glyph: '01' },
]

const CODE_THEME_SURFACES: Record<ThemeCodeSyntax, string> = {
  light_vs: '#ffffff',
  light_plus: '#ffffff',
  quietlight: '#f5f5f5',
  solarized_light: '#fdf6e3',
  abyss: '#000c18',
  dark_vs: '#1e1e1e',
  dark_plus: '#1e1e1e',
  kimbie_dark: '#221a0f',
  monokai: '#272822',
  monokai_dimmed: '#1e1e1e',
  red: '#390000',
  solarized_dark: '#002b36',
  tomorrow_night_blue: '#002451',
  hc_black: '#000000',
}

document.querySelector<HTMLImageElement>('#studio-logo')!.src = studioLogoUrl
document.querySelector<HTMLImageElement>('#theme-builder-logo')!.src = studioLogoUrl
document.querySelector<HTMLLinkElement>('#app-icon')!.href = logomarkUrl

const SAMPLE_MARKDOWN = `# Make technical ideas feel human

The notebook is the storyboard. Every block becomes a frame you can direct, present, and render.

## Show the idea, then talk over it

- Write naturally in Markdown
- Choose how each block appears
- Record your real camera without needing a microphone

> Generated voice removes recording friction. It does not remove the person.

\`\`\`ts
const story = compile(notebook)
const video = await hyperframes.render(story)
\`\`\``

const STORAGE_KEY = 'incredible-studio-v2-project'
// Which saved notebook the studio opens; set by the notebook switcher.
const ACTIVE_PROJECT_KEY = 'incredible-studio-v2-active-project'
const THEME_STORAGE_KEY = 'incredible-studio-v2-themes'
const WORKER_URL = import.meta.env.VITE_RENDER_WORKER_URL || ''
const LEGACY_MVP_BRAND = {
  background: '#f4f2ec',
  surface: '#fffdf8',
  text: '#171814',
  mutedText: '#686b61',
  primary: '#ff5c35',
  accent: '#1747e8',
  codeBackground: '#151711',
} as const

const DIRECTOR_OPTIONS: Record<
  Scene['kind'],
  {
    label: string
    layouts: SceneLayout[]
    animations: RevealStyle[]
  }
> = {
  title: {
    label: 'Heading options',
    layouts: ['title', 'prose', 'split'],
    animations: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop'],
  },
  content: {
    label: 'Paragraph options',
    layouts: ['prose', 'title', 'split'],
    animations: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop'],
  },
  list: {
    label: 'List options',
    layouts: ['prose', 'split'],
    animations: MOTION_OPTIONS.map(option => option.value),
  },
  quote: {
    label: 'Quote options',
    layouts: ['prose', 'title', 'split'],
    animations: ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop'],
  },
  code: {
    label: 'Code options',
    layouts: ['code', 'split'],
    animations: MOTION_OPTIONS.map(option => option.value),
  },
}

const LAYOUT_META: Record<
  SceneLayout,
  { label: string; description: string; lines: number }
> = {
  title: { label: 'Statement', description: 'Centered title', lines: 2 },
  prose: { label: 'Readable', description: 'Editorial content', lines: 3 },
  code: { label: 'Code focus', description: 'Developer canvas', lines: 3 },
  split: { label: 'Side column', description: 'Narrow content frame', lines: 2 },
}

const IMAGE_LAYOUT_META: Partial<
  Record<SceneLayout, { label: string; description: string; lines: number }>
> = {
  prose: { label: 'Gallery frame', description: 'Large editorial image', lines: 1 },
  title: { label: 'Hero crop', description: 'Cinematic centered crop', lines: 1 },
  split: { label: 'Inset card', description: 'Balanced, uncropped frame', lines: 1 },
}

const SCREEN_LAYOUT_META: Partial<
  Record<SceneLayout, { label: string; description: string; lines: number }>
> = {
  prose: { label: 'Demo frame', description: 'Readable screen capture', lines: 1 },
  title: { label: 'Screen focus', description: 'Large centered demo', lines: 1 },
  split: { label: 'Side column', description: 'Compact demo rail', lines: 1 },
}

const PRESENTER_LAYOUT_PRESETS: Array<{
  id: string
  label: string
  mode: PresenterLayoutMode
  position: CameraPosition
  shape: BlockRenderConfigV1['camera']['shape']
}> = [
  { id: 'content-only', label: 'Content only', mode: 'information-circle', position: 'hidden', shape: 'circle' },
  { id: 'information-circle', label: 'Content + circle', mode: 'information-circle', position: 'bottom-right', shape: 'circle' },
  { id: 'information-tile', label: 'Content + tile', mode: 'information-tile', position: 'bottom-right', shape: 'rounded-rectangle' },
  { id: 'portrait-overlay', label: 'Portrait overlay', mode: 'portrait-overlay', position: 'overlay-right', shape: 'rounded-rectangle' },
  { id: 'portrait-rail', label: 'Portrait rail', mode: 'portrait-rail', position: 'overlay-right', shape: 'rounded-rectangle' },
  { id: 'split', label: '50 / 50 split', mode: 'split', position: 'split-right', shape: 'rounded-rectangle' },
  { id: 'person-background-left', label: 'Camera + points left', mode: 'person-background-left', position: 'full', shape: 'rounded-rectangle' },
  { id: 'person-background-right', label: 'Camera + points right', mode: 'person-background-right', position: 'full', shape: 'rounded-rectangle' },
  { id: 'person-only', label: 'Full camera', mode: 'person-only', position: 'full', shape: 'rounded-rectangle' },
]

const BACKGROUND_PRESETS: Array<{
  id: BlockBackgroundPreset
  label: string
  mode: 'gradient' | 'color'
  swatch: string
}> = [
  { id: 'violet', label: 'Violet', mode: 'gradient', swatch: 'linear-gradient(135deg,#d8b4fe,#7c3aed)' },
  { id: 'sunset', label: 'Sunset', mode: 'gradient', swatch: 'linear-gradient(135deg,#fda4af,#fb923c)' },
  { id: 'ocean', label: 'Ocean', mode: 'gradient', swatch: 'linear-gradient(135deg,#93c5fd,#2563eb)' },
  { id: 'mint', label: 'Mint', mode: 'gradient', swatch: 'linear-gradient(135deg,#a7f3d0,#14b8a6)' },
  { id: 'rose', label: 'Rose', mode: 'gradient', swatch: 'linear-gradient(135deg,#fbcfe8,#e879f9)' },
  { id: 'paper', label: 'Paper', mode: 'color', swatch: '#f9fafb' },
  { id: 'charcoal', label: 'Charcoal', mode: 'color', swatch: '#27272a' },
  { id: 'custom', label: 'Custom', mode: 'color', swatch: 'var(--custom-background,#111827)' },
]

const sceneVisualKind = (scene: Pick<Scene, 'kind' | 'node'>) =>
  scene.node.type === 'image'
    ? 'image'
    : scene.node.type === 'screenRecording'
      ? 'screen'
      : scene.node.type === 'explainer'
        ? 'explainer'
        : scene.kind

const TIMELINE_BLOCK_META = {
  title: { label: 'Title', icon: 'T' },
  content: { label: 'Text', icon: 'Aa' },
  list: { label: 'Points', icon: '☷' },
  quote: { label: 'Quote', icon: '“' },
  code: { label: 'Code', icon: '</>' },
  image: { label: 'Image', icon: '▧' },
  screen: { label: 'Screen', icon: '▶' },
  explainer: { label: 'Explainer', icon: '◈' },
} as const

const sceneObjectLabel = (scene: Pick<Scene, 'kind' | 'node'>) =>
  TIMELINE_BLOCK_META[sceneVisualKind(scene)].label

const directorKindForNode = (node: TiptapNode): Scene['kind'] => {
  if (node.type === 'heading') return 'title'
  if (node.type === 'codeBlock') return 'code'
  if (node.type === 'bulletList' || node.type === 'orderedList') return 'list'
  if (node.type === 'blockquote') return 'quote'
  return 'content'
}

const $ = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing UI element: ${selector}`)
  return element
}

const player = $('#player') as HyperframesPlayerElement
const playerShell = $('#player-shell')
const playerLoading = $('#player-loading')
const screenPlayToggle = $('#screen-play-toggle') as HTMLButtonElement
const canvasViewSwitch = $('#canvas-view-switch')
const canvasViewVideoButton = $('#canvas-view-video') as HTMLButtonElement
const canvasViewContentButton = $('#canvas-view-content') as HTMLButtonElement
const canvasViewDownload = $('#canvas-view-download') as HTMLAnchorElement
const canvasTakePlayer = $('#canvas-take-player') as HTMLVideoElement
const canvasTakeVersions = $('#canvas-take-versions')
const replaceCanvasRecordingButton = $(
  '#replace-canvas-recording',
) as HTMLButtonElement
const liveCameraToggle = $('#live-camera-toggle') as HTMLButtonElement
const liveCameraFrame = $('#live-camera-frame')
const liveCameraPreview = $('#live-camera-preview') as HTMLVideoElement
const editorLayout = $('#editor-layout')
const inlinePreview = $('#inline-preview')
const canvasBlockTimeline = $('#canvas-block-timeline')
const canvasRecordingControls = $('#canvas-recording-controls')
const canvasRecordingLabel = $('#canvas-recording-label')
const canvasRecordingMeta = $('#canvas-recording-meta')
const canvasRecordingProjectTitle = $('#canvas-recording-project-title')
const canvasRecordingProjectBlock = $('#canvas-recording-project-block')
const canvasRecordingCameraState = $('#canvas-recording-camera-state')
const canvasRecordingClock = $('#canvas-recording-clock')
const canvasRecordingMicState = $('#canvas-recording-mic-state')
const startCanvasRecordingButton = $('#start-canvas-recording') as HTMLButtonElement
const previousAnimationStepButton = $('#previous-animation-step') as HTMLButtonElement
const nextAnimationStepButton = $('#next-animation-step') as HTMLButtonElement
const stopCanvasRecordingButton = $('#stop-canvas-recording') as HTMLButtonElement
const canvasRecordingReview = $('#canvas-recording-review')
const canvasRecordingPlayback = $('#canvas-recording-playback') as HTMLVideoElement
const downloadCanvasRecording = $('#download-canvas-recording') as HTMLAnchorElement
const saveCanvasRecordingButton = $('#save-canvas-recording') as HTMLButtonElement
const canvasRecordingReviewStatus = $('#canvas-recording-review-status')
const canvasRecordingReviewTitle = $('#canvas-recording-review-title')
const canvasRecordingCoach = $('#canvas-recording-coach')
const recordingCoachTitle = $('#recording-coach-title')
const recordingCoachNumber = $('#recording-coach-number')
const recordingNotesInput = $('#recording-notes') as HTMLTextAreaElement
const recordingNotesMinutes = $('#recording-notes-minutes') as HTMLInputElement
const recordingNotesMinutesOutput = $(
  '#recording-notes-minutes-output',
) as HTMLOutputElement
const recordingNotesEstimate = $('#recording-notes-estimate')
const recordingNotesLengthFill = $('#recording-notes-length-fill')
const recordingNotesProvider = $('#recording-notes-provider')
const generateNotesButton = $('#generate-notes') as HTMLButtonElement
const recordingCoachActionGrid = $('#recording-coach-action-grid')
const recordingCoachBlockTitle = $('#recording-coach-block-title')
const recordingCoachProgress = $('#recording-coach-progress')
const recordingCoachThumbnail = $('#recording-coach-thumbnail')
const inspectorPanel = $('#inspector-panel')
const sceneRail = $('#scene-rail')
const saveState = $('#save-state')
const renderButton = $('#render-video') as HTMLButtonElement
const markdownDialog = $('#markdown-dialog') as HTMLDialogElement
const cameraDialog = $('#camera-dialog') as HTMLDialogElement
const cameraPreview = $('#camera-preview') as HTMLVideoElement
const cameraPlaceholder = $('#camera-placeholder')
const guideAudio = $('#guide-audio') as HTMLAudioElement
const audioMode = $('#audio-mode') as HTMLSelectElement
const presenterScript = $('#presenter-script') as HTMLTextAreaElement
const voiceReference = $('#voice-reference') as HTMLInputElement
const voiceCapability = $('#voice-capability')
const startRecordingButton = $('#start-recording') as HTMLButtonElement
const stopRecordingButton = $('#stop-recording') as HTMLButtonElement
const engineRecordingButton = $('#engine-recording') as HTMLButtonElement
const countdown = $('#countdown')
const cameraStatus = $('#camera-status')
const cameraStatusDot = $('#camera-status-dot')

let selectedNodeId = ''
let previewRequest = 0
let previewFetchTimer: number | undefined
let previewFetchInFlight = false
let pendingPreviewRequest: {
  requestNumber: number
  previewPresenter: { imageUrl: string; name: string }
  includeEmptyNodeId?: string
  contentViewNodeId?: string
} | null = null
let recordedTakeCanvasView: 'video' | 'content' = 'video'
let scenes: Scene[] = []
let syncTimer: number | undefined
let databaseSyncTimer: number | undefined
let toastTimer: number | undefined
let cameraStream: MediaStream | null = null
let liveCameraStream: MediaStream | null = null
let injectedLiveCameraPreview: HTMLVideoElement | null = null
let mediaRecorder: MediaRecorder | null = null
let recordingChunks: Blob[] = []
let recordingNodeId = ''
let canvasRecorder: MediaRecorder | null = null
let canvasCaptureStream: MediaStream | null = null
let canvasMicrophoneStream: MediaStream | null = null
let canvasRecordingChunks: Blob[] = []
let canvasRecordingStartedAt = 0
let canvasRecordingTimer: number | undefined
let canvasRecordingStep = 0
let canvasRecordingTargets: Array<{ element: HTMLElement; style: string }> = []
let canvasRecordingExplainerPlan: ExplainerPlanV1 | null = null
let canvasRecordingContent: { element: HTMLElement; style: string } | null = null
let canvasRecordingCodeStyles: Array<{ element: HTMLElement; style: string }> = []
let canvasRecordingLines: HTMLElement[] = []
let canvasRecordingTokens: HTMLElement[] = []
let canvasRecordingLineStep = 0
let canvasRecordingTokenStep = 0
let canvasRecordingFocusStep = 0
let canvasRecordingScene: Scene | null = null
let pendingRecordedBlock: {
  projectId: string
  blockId: string
  assetId: string
  mediaUrl: string
  durationMs: number
} | null = null
let screenRecordingStream: MediaStream | null = null
let screenRecordingHasAudio = false
let microphonePreference = true
let screenRecorder: MediaRecorder | null = null
let screenRecordingChunks: Blob[] = []
let screenRecordingUploadKey = ''
let screenRecordingStartedAt = 0
let screenRecordingTimer: number | undefined
let generatedVoiceUrl = ''
let animationPreviewTimer: number | undefined
let screenPlaybackWatcher: (() => void) | null = null
let replayAnimationOnReady = false
let selectedCanvasObject: 'content' | 'presenter' = 'content'
let selectedBackgroundMode: 'gradient' | 'color' = 'gradient'

const syncLiveCameraToggle = () => {
  const isLive = Boolean(liveCameraStream)
  liveCameraToggle.classList.toggle('is-live', isLive)
  liveCameraToggle.setAttribute('aria-pressed', String(isLive))
  liveCameraToggle.setAttribute(
    'aria-label',
    isLive ? 'Stop live camera' : 'Start live camera',
  )
  const title = liveCameraToggle.querySelector('strong')
  const detail = liveCameraToggle.querySelector('small')
  if (title) title.textContent = isLive ? 'Camera live' : 'Live camera'
  if (detail) {
    detail.textContent = isLive
      ? 'Click to stop preview'
      : 'Preview yourself in frame'
  }
  canvasRecordingCameraState.classList.toggle('muted', !isLive)
  canvasRecordingCameraState.setAttribute('aria-pressed', String(isLive))
  canvasRecordingCameraState.title = isLive
    ? 'Camera live · click to stop the preview'
    : 'Camera off · click to preview yourself in frame'
}

const clearLiveCameraFromPlayer = () => {
  liveCameraPreview.pause()
  liveCameraPreview.srcObject = null
  liveCameraFrame.hidden = true
  if (injectedLiveCameraPreview) {
    injectedLiveCameraPreview.pause()
    injectedLiveCameraPreview.srcObject = null
    injectedLiveCameraPreview.remove()
    injectedLiveCameraPreview = null
  }
  try {
    const iframeDocument = player.iframeElement.contentDocument
    iframeDocument
      ?.querySelectorAll<HTMLElement>('[data-live-camera-replaced]')
      .forEach(element => {
        element.style.visibility = ''
        delete element.dataset.liveCameraReplaced
      })
    iframeDocument
      ?.querySelectorAll<HTMLVideoElement>('[data-live-camera-preview]')
      .forEach(element => {
        element.pause()
        element.srcObject = null
        element.remove()
      })
  } catch {
    // The outer frame remains a safe fallback if a remote preview is not same-origin.
  }
}

const attachLiveCameraInsideComposition = (scene: Scene) => {
  try {
    const iframeDocument = player.iframeElement.contentDocument
    const sceneElement = iframeDocument?.querySelector<HTMLElement>(
      `#scene-${scene.index}`,
    )
    const cameraTemplate = sceneElement?.querySelector<HTMLElement>('.camera')
    if (!iframeDocument || !sceneElement || !cameraTemplate) return false

    const video = iframeDocument.createElement('video')
    video.className = cameraTemplate.className.replace(/\bpreview-camera\b/g, '').trim()
    video.style.cssText = cameraTemplate.style.cssText
    video.dataset.liveCameraPreview = 'true'
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.srcObject = liveCameraStream
    video.style.setProperty('scale', '-1 1')
    video.style.setProperty('transform-origin', 'center')
    cameraTemplate.dataset.liveCameraReplaced = 'true'
    cameraTemplate.style.visibility = 'hidden'
    sceneElement.appendChild(video)
    injectedLiveCameraPreview = video
    void video.play().catch(() => undefined)
    return true
  } catch {
    return false
  }
}

const attachLiveCameraToPlayer = () => {
  clearLiveCameraFromPlayer()
  if (!liveCameraStream || !playerShell.classList.contains('canvas-open')) return
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene || scene.config.camera.position === 'hidden') return
  if (attachLiveCameraInsideComposition(scene)) return
  const geometry = presenterLayoutGeometry(scene.config.camera.mode, scene.kind)
  const playerBounds = player.getBoundingClientRect()
  const scale = playerBounds.width / project.width
  const pixelRatio = window.devicePixelRatio || 1
  const snapToDevicePixel = (value: number) => Math.round(value * pixelRatio) / pixelRatio
  const theme = project.theme || defaultStudioTheme
  const radius = scene.config.camera.shape === 'circle'
    ? '50%'
    : `${Math.max(2, snapToDevicePixel(theme.video.borderRadius * scale))}px`
  const border = theme.video.borderStyle === 'none'
    ? 0
    : Math.max(1 / pixelRatio, snapToDevicePixel(theme.video.borderWidth * scale))
  liveCameraFrame.style.left = `${snapToDevicePixel(playerBounds.left + playerBounds.width * geometry.camera.left / 100)}px`
  liveCameraFrame.style.top = `${snapToDevicePixel(playerBounds.top + playerBounds.height * geometry.camera.top / 100)}px`
  liveCameraFrame.style.width = `${snapToDevicePixel(playerBounds.width * geometry.camera.width / 100)}px`
  liveCameraFrame.style.height = `${snapToDevicePixel(playerBounds.height * geometry.camera.height / 100)}px`
  liveCameraFrame.style.setProperty('--live-camera-radius', radius)
  liveCameraFrame.style.setProperty('--live-camera-border', `${border}px`)
  liveCameraFrame.style.setProperty('--live-camera-surface', theme.brand.surface)
  liveCameraFrame.className = `live-camera-frame ${scene.config.camera.shape} presenter-${scene.config.camera.mode}`
  liveCameraPreview.srcObject = liveCameraStream
  liveCameraFrame.hidden = false
  void liveCameraPreview.play().catch(() => undefined)
}

const stopLiveCamera = () => {
  clearLiveCameraFromPlayer()
  liveCameraStream?.getTracks().forEach(track => track.stop())
  liveCameraStream = null
  syncLiveCameraToggle()
}

const restoreCanvasRecordingSteps = () => {
  canvasRecordingTargets.forEach(({ element, style }) => {
    element.style.cssText = style
  })
  canvasRecordingCodeStyles.forEach(({ element, style }) => {
    element.style.cssText = style
  })
  if (canvasRecordingContent) {
    canvasRecordingContent.element.style.cssText = canvasRecordingContent.style
  }
  canvasRecordingTargets = []
  canvasRecordingCodeStyles = []
  canvasRecordingContent = null
  canvasRecordingExplainerPlan = null
  canvasRecordingLines = []
  canvasRecordingTokens = []
  canvasRecordingStep = 0
  canvasRecordingLineStep = 0
  canvasRecordingTokenStep = 0
  canvasRecordingFocusStep = 0
  canvasRecordingScene = null
}

type CanvasRecordingAction = 'next-beat' | 'next-token' | 'next-line' | 'focus-line'

const updateRecordingCoachProgress = (message: string) => {
  recordingCoachProgress.textContent = message
  canvasRecordingMeta.textContent = message
}

const resetCanvasRecordingProgress = () => {
  const visualKind = canvasRecordingScene ? sceneVisualKind(canvasRecordingScene) : 'content'
  if (visualKind === 'explainer' && canvasRecordingExplainerPlan) {
    if (canvasRecordingScene) {
      explainerCompositionDriver(canvasRecordingScene.id)?.setStep(0, 0)
    }
    canvasRecordingTargets.forEach(({ element }) => {
      element.style.setProperty('opacity', '0', 'important')
      element.style.setProperty('visibility', 'visible', 'important')
    })
    canvasRecordingStep = 0
    nextAnimationStepButton.disabled = false
    updateRecordingCoachProgress(
      `Ready · ${canvasRecordingExplainerPlan.steps.length} diagram steps to narrate`,
    )
    return
  }
  if (visualKind === 'code') {
    canvasRecordingLines.forEach(line => {
      line.style.setProperty('opacity', '1', 'important')
      line.style.removeProperty('background')
      line.style.removeProperty('box-shadow')
    })
    canvasRecordingTokens.forEach(token => {
      token.style.setProperty('opacity', '.28', 'important')
      token.style.removeProperty('background')
      token.style.removeProperty('box-shadow')
    })
    canvasRecordingLineStep = 0
    canvasRecordingTokenStep = 0
    canvasRecordingFocusStep = 0
    updateRecordingCoachProgress(`Ready · ${canvasRecordingLines.length} lines to direct`)
    return
  }
  canvasRecordingTargets.forEach(({ element }) => {
    element.style.setProperty('opacity', '0', 'important')
    element.style.setProperty('transform', 'translateY(34px)', 'important')
    element.style.setProperty('filter', 'blur(8px)', 'important')
  })
  canvasRecordingStep = 0
  nextAnimationStepButton.disabled = false
  updateRecordingCoachProgress(`Ready · ${canvasRecordingTargets.length} beats to direct`)
}

const runCanvasRecordingAction = (action: CanvasRecordingAction) => {
  // Explainer blocks step their diagram: each beat reveals one narrated
  // step's entities, connectors and caption — the animation you talk over.
  if (
    canvasRecordingScene &&
    sceneVisualKind(canvasRecordingScene) === 'explainer' &&
    canvasRecordingExplainerPlan
  ) {
    const plan = canvasRecordingExplainerPlan
    if (canvasRecordingStep >= plan.steps.length) {
      updateRecordingCoachProgress('Every diagram step has been shown')
      return
    }
    const step = canvasRecordingStep
    if (canvasRecordingScene) {
      explainerCompositionDriver(canvasRecordingScene.id)?.setStep(step, 1)
    }
    canvasRecordingTargets.forEach(({ element }) => {
      if (element.classList.contains('ex-caption')) {
        const at = Number(element.dataset.exStep || 0)
        element.style.setProperty('opacity', at === step ? '1' : '0', 'important')
        return
      }
      const revealAt = Number(element.dataset.exStepReveal || 0)
      const shown = revealAt <= step
      element.style.setProperty('opacity', shown ? '1' : '0', 'important')
      if (revealAt === step) {
        element.animate(
          [
            { opacity: 0, transform: 'scale(.86)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 480, easing: 'cubic-bezier(.34,1.4,.5,1)' },
        )
      }
    })
    canvasRecordingStep += 1
    updateRecordingCoachProgress(
      `Step ${step + 1} of ${plan.steps.length} · ${plan.steps[step]?.title || ''}`,
    )
    return
  }
  if (action === 'next-token') {
    const target = canvasRecordingTokens[canvasRecordingTokenStep]
    if (!target) {
      updateRecordingCoachProgress('Every token has been covered')
      return
    }
    canvasRecordingTokens.forEach((token, index) => {
      token.style.setProperty('opacity', index <= canvasRecordingTokenStep ? '1' : '.28', 'important')
      token.style.removeProperty('background')
      token.style.removeProperty('box-shadow')
    })
    target.style.setProperty('background', 'rgba(74, 222, 128, .16)', 'important')
    target.style.setProperty('box-shadow', '0 0 0 4px rgba(74, 222, 128, .08)', 'important')
    target.style.setProperty('border-radius', '3px', 'important')
    target.animate(
      [{ opacity: .25, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' },
    )
    canvasRecordingTokenStep += 1
    updateRecordingCoachProgress(`${canvasRecordingTokenStep} of ${canvasRecordingTokens.length} tokens revealed`)
    return
  }

  if (action === 'next-line') {
    const target = canvasRecordingLines[canvasRecordingLineStep]
    if (!target) {
      updateRecordingCoachProgress('Every line has been covered')
      return
    }
    canvasRecordingLines.forEach(line => {
      line.style.setProperty('opacity', '.24', 'important')
      line.style.removeProperty('background')
      line.style.removeProperty('box-shadow')
    })
    target.style.setProperty('opacity', '1', 'important')
    target.querySelectorAll<HTMLElement>('[class*="code-token-"]').forEach(token => {
      token.style.setProperty('opacity', '1', 'important')
    })
    target.animate(
      [{ opacity: .2, transform: 'translateX(-20px)' }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)' },
    )
    canvasRecordingLineStep += 1
    updateRecordingCoachProgress(`${canvasRecordingLineStep} of ${canvasRecordingLines.length} lines covered`)
    return
  }

  if (action === 'focus-line') {
    if (!canvasRecordingLines.length) return
    const target = canvasRecordingLines[canvasRecordingFocusStep % canvasRecordingLines.length]
    canvasRecordingLines.forEach(line => {
      line.style.setProperty('opacity', '.2', 'important')
      line.style.removeProperty('background')
      line.style.removeProperty('box-shadow')
    })
    target.style.setProperty('opacity', '1', 'important')
    target.style.setProperty('background', 'rgba(74, 222, 128, .11)', 'important')
    target.style.setProperty('box-shadow', '-4px 0 0 rgba(74, 222, 128, .82)', 'important')
    target.animate(
      [{ background: 'rgba(74, 222, 128, .28)' }, { background: 'rgba(74, 222, 128, .11)' }],
      { duration: 520, easing: 'ease-out' },
    )
    canvasRecordingFocusStep += 1
    updateRecordingCoachProgress(`Focused line ${canvasRecordingFocusStep % canvasRecordingLines.length || canvasRecordingLines.length}`)
    return
  }

  const target = canvasRecordingTargets[canvasRecordingStep]?.element
  if (!target) {
    updateRecordingCoachProgress('Every beat has been shown')
    return
  }
  target.style.setProperty('opacity', '1', 'important')
  target.style.setProperty('transform', 'none', 'important')
  target.style.setProperty('filter', 'none', 'important')
  target.animate(
    [
      { opacity: 0, transform: 'translateY(34px)', filter: 'blur(8px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
    ],
    { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' },
  )
  canvasRecordingStep += 1
  updateRecordingCoachProgress(`${canvasRecordingStep} of ${canvasRecordingTargets.length} beats shown`)
  if (canvasRecordingStep >= canvasRecordingTargets.length) {
    nextAnimationStepButton.disabled = true
    nextAnimationStepButton.textContent = 'All beats shown'
  }
}

const syncMicrophoneToggle = () => {
  const liveTracks = canvasMicrophoneStream?.getAudioTracks() || []
  const micLive = liveTracks.some(track => track.enabled)
  const micOn = canvasMicrophoneStream ? micLive : microphonePreference
  const label = canvasMicrophoneStream
    ? micLive
      ? 'Mic live · click to mute'
      : 'Mic muted · click to unmute'
    : microphonePreference
      ? 'Mic on at start · click to record without mic'
      : 'Mic off · click to enable at start'
  canvasRecordingMicState.classList.toggle('muted', !micOn)
  canvasRecordingMicState.setAttribute('aria-pressed', String(micOn))
  canvasRecordingMicState.title = label
  canvasRecordingMicState.setAttribute('aria-label', label)
}

const syncRecordingNotesMeter = () => {
  const notes = recordingNotesInput.value
  const spokenSeconds = estimateSpokenSeconds(notes)
  const targetSeconds = Number(recordingNotesMinutes.value) * 60
  recordingNotesMinutesOutput.value = `${recordingNotesMinutes.value} min`
  recordingNotesEstimate.textContent = notes.trim()
    ? `≈ ${formatTime(spokenSeconds)} spoken · target ${formatTime(targetSeconds)}`
    : 'No notes yet — write or generate them'
  const ratio = targetSeconds ? Math.min(1, spokenSeconds / targetSeconds) : 0
  recordingNotesLengthFill.style.width = `${Math.round(ratio * 100)}%`
  recordingNotesLengthFill.classList.toggle(
    'over',
    spokenSeconds > targetSeconds * 1.15,
  )
}

const loadRecordingNotes = (scene: Scene) => {
  const config = project.blocks[scene.id]
  recordingNotesInput.value = config?.speakerNotes || ''
  recordingNotesMinutes.value = String(config?.notesTargetMinutes || 1)
  recordingNotesProvider.textContent = 'Yours to edit'
  syncRecordingNotesMeter()
}

recordingNotesInput.addEventListener('input', () => {
  const config = project.blocks[selectedNodeId]
  if (config) {
    config.speakerNotes = recordingNotesInput.value
    scheduleSync()
    refreshExplanations()
    syncExplainerTeleprompter()
  }
  syncRecordingNotesMeter()
})

recordingNotesMinutes.addEventListener('input', () => {
  const config = project.blocks[selectedNodeId]
  if (config) {
    config.notesTargetMinutes = Number(recordingNotesMinutes.value)
    scheduleSync()
  }
  syncRecordingNotesMeter()
})

generateNotesButton.addEventListener('click', async () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  generateNotesButton.disabled = true
  generateNotesButton.textContent = 'Generating…'
  try {
    project.notebook = editor.getJSON() as TiptapDocument
    ensureBlockConfiguration(project.notebook)
    const result = await fetchJson<{ notes: string; provider: string }>(
      '/api/notes',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project,
          blockId: scene.id,
          targetMinutes: Number(recordingNotesMinutes.value),
        }),
      },
    )
    recordingNotesInput.value = result.notes
    const config = project.blocks[scene.id]
    if (config) {
      config.speakerNotes = result.notes
      config.notesTargetMinutes = Number(recordingNotesMinutes.value)
    }
    recordingNotesProvider.textContent =
      result.provider === 'openai' ? 'AI draft · edit freely' : 'Draft · edit freely'
    syncRecordingNotesMeter()
    scheduleSync()
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Could not generate notes')
  } finally {
    generateNotesButton.disabled = false
    generateNotesButton.textContent = '✦ Generate notes'
  }
})

canvasRecordingCameraState.addEventListener('click', () => {
  if (liveCameraStream) {
    stopLiveCamera()
    syncLiveCameraToggle()
  } else {
    void startLiveCamera().catch(() =>
      showToast('Camera unavailable — check browser permissions'),
    )
  }
})

canvasRecordingMicState.addEventListener('click', () => {
  if (canvasMicrophoneStream) {
    const nextEnabled = !canvasMicrophoneStream
      .getAudioTracks()
      .some(track => track.enabled)
    canvasMicrophoneStream.getAudioTracks().forEach(track => {
      track.enabled = nextEnabled
    })
  } else {
    microphonePreference = !microphonePreference
  }
  syncMicrophoneToggle()
})

const configureCanvasRecordingCoach = (scene: Scene) => {
  const visualKind = sceneVisualKind(scene)
  const meta = TIMELINE_BLOCK_META[visualKind]
  const blockText = sceneScript(scene) || `${meta.label} block`
  const actionDefinitions: Array<{ action: CanvasRecordingAction; label: string; detail: string; key: string }> =
    visualKind === 'code'
      ? [
          { action: 'next-token', label: 'Next token', detail: 'Reveal one expression', key: '→' },
          { action: 'next-line', label: 'Next line', detail: 'Advance the explanation', key: '↓' },
          { action: 'focus-line', label: 'Focus line', detail: 'Move the audience focus', key: 'F' },
        ]
      : visualKind === 'list'
        ? [{ action: 'next-beat', label: 'Next point', detail: 'Reveal the next idea', key: '→' }]
        : visualKind === 'explainer'
          ? [{ action: 'next-beat', label: 'Next step', detail: 'Reveal the next diagram step', key: '→' }]
          : [{ action: 'next-beat', label: 'Next beat', detail: `Reveal the ${meta.label.toLowerCase()}`, key: '→' }]

  canvasRecordingScene = scene
  recordingCoachTitle.textContent = visualKind === 'code'
    ? 'Explain the code as you reveal it'
    : visualKind === 'list'
      ? 'Walk through each point'
      : visualKind === 'explainer'
        ? 'Narrate each diagram step'
        : 'Talk over this block'
  recordingCoachNumber.textContent = `Block ${String(scene.index + 1).padStart(2, '0')}`
  canvasRecordingProjectTitle.textContent = project.title
  canvasRecordingProjectBlock.textContent = `Block ${String(scene.index + 1).padStart(2, '0')} · ${meta.label}`
  syncLiveCameraToggle()
  syncMicrophoneToggle()
  loadRecordingNotes(scene)
  recordingCoachBlockTitle.textContent = blockText
  recordingCoachProgress.textContent = 'Ready for your first beat'
  recordingCoachThumbnail.innerHTML = `<span>${String(scene.index + 1).padStart(2, '0')}</span><strong>${meta.icon}</strong>`
  recordingCoachActionGrid.replaceChildren()
  actionDefinitions.forEach(definition => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'recording-coach-action'
    button.innerHTML = `<span><strong>${definition.label}</strong><small>${definition.detail}</small></span><kbd>${definition.key}</kbd>`
    button.addEventListener('click', () => runCanvasRecordingAction(definition.action))
    recordingCoachActionGrid.append(button)
  })
  nextAnimationStepButton.textContent =
    visualKind === 'code'
      ? 'Next line ↓'
      : visualKind === 'list'
        ? 'Next point →'
        : visualKind === 'explainer'
          ? 'Next step →'
          : 'Next beat →'
}

const prepareCanvasRecordingSteps = async (scene: Scene) => {
  restoreCanvasRecordingSteps()
  disengageCanvasExplainerStepper()
  player.pause()
  player.seek(scene.startSeconds + 0.02)
  await wait(120)
  const iframeDocument = player.iframeElement.contentDocument
  const sceneElement = iframeDocument?.querySelector<HTMLElement>(`#scene-${scene.index}`)
  const content = sceneElement?.querySelector<HTMLElement>('.content')
  if (!content) throw new Error('The live canvas is not ready to record')

  const visualKind = sceneVisualKind(scene)
  const sequenceSelector = visualKind === 'list' ? 'li' : ':scope > *'
  const candidates = Array.from(
    content.querySelectorAll<HTMLElement>(sequenceSelector),
  ).filter(element => element.offsetParent !== null)
  canvasRecordingContent = { element: content, style: content.style.cssText }
  content.getAnimations().forEach(animation => animation.cancel())
  content.style.setProperty('opacity', '1', 'important')
  content.style.setProperty('transform', 'none', 'important')
  content.style.setProperty('clip-path', 'none', 'important')
  configureCanvasRecordingCoach(scene)
  if (visualKind === 'explainer') {
    const items = Array.from(
      sceneElement?.querySelectorAll<HTMLElement>(
        '[data-ex-step-reveal], .ex-caption',
      ) || [],
    )
    canvasRecordingTargets = items.map(element => ({
      element,
      style: element.style.cssText,
    }))
    canvasRecordingExplainerPlan = sanitizeExplainerPlan(
      scene.node.attrs?.plan as ExplainerPlanV1 | undefined,
      mergedShapeCollection(project.shapeCollection),
    )
    canvasRecordingTargets.forEach(({ element }) => {
      element.getAnimations().forEach(animation => animation.cancel())
      element.style.setProperty('opacity', '0', 'important')
      element.style.setProperty('visibility', 'visible', 'important')
    })
    updateRecordingCoachProgress(
      `Ready · ${canvasRecordingExplainerPlan.steps.length} diagram steps to narrate`,
    )
    canvasRecordingStep = 0
    return
  }
  if (visualKind === 'code') {
    canvasRecordingLines = Array.from(content.querySelectorAll<HTMLElement>('.code-line'))
      .filter(element => element.offsetParent !== null)
    canvasRecordingTokens = Array.from(content.querySelectorAll<HTMLElement>('[class*="code-token-"]'))
      .filter(element => element.offsetParent !== null)
    const codeElements = [...canvasRecordingLines, ...canvasRecordingTokens]
    canvasRecordingCodeStyles = codeElements.map(element => ({ element, style: element.style.cssText }))
    canvasRecordingLines.forEach(line => line.getAnimations().forEach(animation => animation.cancel()))
    canvasRecordingTokens.forEach(token => token.style.setProperty('opacity', '.28', 'important'))
    updateRecordingCoachProgress(`Ready · ${canvasRecordingLines.length} lines to direct`)
  } else {
    const targets = candidates.length ? candidates : [content]
    canvasRecordingTargets = targets.map(element => ({ element, style: element.style.cssText }))
    canvasRecordingTargets.forEach(({ element }) => {
      element.getAnimations().forEach(animation => animation.cancel())
      element.style.setProperty('opacity', '0', 'important')
      element.style.setProperty('transform', 'translateY(34px)', 'important')
      element.style.setProperty('filter', 'blur(8px)', 'important')
    })
    updateRecordingCoachProgress(`Ready · ${canvasRecordingTargets.length} beats to direct`)
  }
  canvasRecordingStep = 0
}

const revealNextCanvasRecordingStep = () => {
  if (!canvasRecordingScene) return
  runCanvasRecordingAction(sceneVisualKind(canvasRecordingScene) === 'code' ? 'next-line' : 'next-beat')
}

const updateCanvasRecordingClock = () => {
  const elapsed = (Date.now() - canvasRecordingStartedAt) / 1000
  canvasRecordingLabel.textContent = `Recording · ${formatTime(elapsed)}`
  canvasRecordingClock.textContent = formatTime(elapsed)
}

const resetCanvasRecordingControls = () => {
  window.clearInterval(canvasRecordingTimer)
  playerShell.classList.remove('canvas-recording-active')
  playerShell.classList.remove('canvas-recording-mode')
  canvasRecordingControls.removeAttribute('aria-busy')
  canvasRecordingCoach.hidden = true
  startCanvasRecordingButton.hidden = false
  startCanvasRecordingButton.disabled = false
  nextAnimationStepButton.hidden = true
  previousAnimationStepButton.hidden = true
  nextAnimationStepButton.disabled = false
  nextAnimationStepButton.textContent = 'Next step →'
  stopCanvasRecordingButton.hidden = true
  canvasRecordingLabel.textContent = 'Record this block'
  canvasRecordingMeta.textContent = 'Camera visible · microphone optional'
}

const uploadDirectedCanvasRecording = async (
  blob: Blob,
  scene: Scene,
  durationMs: number,
) => {
  project.notebook = editor.getJSON() as TiptapDocument
  ensureBlockConfiguration(project.notebook)
  await persistProjectNow(structuredClone(project))
  const result = await fetchJson<{
    url: string
    draft: { assetId: string; blockId: string; durationMs: number }
  }>(
    '/api/recordings/finalize', {
    method: 'POST',
    headers: {
      'content-type': blob.type || 'video/webm',
      'x-project-id': project.id,
      'x-block-id': scene.id,
      'x-duration-ms': String(durationMs),
    },
    body: blob,
  })
  pendingRecordedBlock = {
    projectId: project.id,
    blockId: scene.id,
    assetId: result.draft.assetId,
    mediaUrl: result.url,
    durationMs: result.draft.durationMs,
  }
  canvasRecordingPlayback.src = result.url
  downloadCanvasRecording.href = result.url
  const existingTakes = project.recordedBlockTakes?.[scene.id] || []
  const hasActiveTake = Boolean(project.recordedBlocks?.[scene.id])
  saveCanvasRecordingButton.disabled = false
  saveCanvasRecordingButton.textContent = hasActiveTake
    ? `Save as v${existingTakes.length + 1}`
    : 'Save block'
  replaceCanvasRecordingButton.hidden = !hasActiveTake
  replaceCanvasRecordingButton.disabled = false
  replaceCanvasRecordingButton.textContent = 'Replace current take'
  canvasRecordingReviewStatus.textContent = 'Review take'
  canvasRecordingReviewTitle.textContent = hasActiveTake
    ? 'Keep it as a new version, or replace the current take'
    : 'Save this recording to the selected block'
  canvasRecordingReview.hidden = false
  showToast('Take ready — review it, then save the block')
}

const finishCanvasRecording = () => {
  if (canvasRecorder?.state === 'recording') canvasRecorder.stop()
}

// Canvas-agent explainer blocks are drawn entirely by our own program, so the
// take can be captured straight from the rendered buffer (OSS-v1 style:
// canvas.captureStream + mic), with no tab-capture permission prompt.
let explainerBufferTimer = 0

const stopExplainerBufferCapture = () => {
  if (explainerBufferTimer) window.clearInterval(explainerBufferTimer)
  explainerBufferTimer = 0
}

const wrapCanvasCaptionText = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  words.forEach(word => {
    const probe = line ? `${line} ${word}` : word
    if (line && context.measureText(probe).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = probe
    }
  })
  if (line) lines.push(line)
  return lines
}

const drawLiveCameraOnBuffer = (
  context: CanvasRenderingContext2D,
  capture: HTMLCanvasElement,
) => {
  if (!liveCameraStream || liveCameraFrame.hidden) return
  if (liveCameraPreview.readyState < 2 || !liveCameraPreview.videoWidth) return
  const playerBounds = player.getBoundingClientRect()
  if (!playerBounds.width || !playerBounds.height) return
  const frameBounds = liveCameraFrame.getBoundingClientRect()
  const scale = capture.width / playerBounds.width
  const x = (frameBounds.left - playerBounds.left) * scale
  const y = (frameBounds.top - playerBounds.top) * scale
  const width = frameBounds.width * scale
  const height = frameBounds.height * scale
  if (width < 4 || height < 4) return
  const radiusValue = getComputedStyle(liveCameraFrame).borderRadius
  const radius = radiusValue.includes('%')
    ? (Math.min(width, height) * Number.parseFloat(radiusValue)) / 100
    : (Number.parseFloat(radiusValue) || 0) * scale
  context.save()
  context.beginPath()
  context.roundRect(x, y, width, height, Math.min(radius, Math.min(width, height) / 2))
  context.clip()
  const videoWidth = liveCameraPreview.videoWidth
  const videoHeight = liveCameraPreview.videoHeight
  const cover = Math.max(width / videoWidth, height / videoHeight)
  const drawWidth = videoWidth * cover
  const drawHeight = videoHeight * cover
  context.drawImage(
    liveCameraPreview,
    x - (drawWidth - width) / 2,
    y - (drawHeight - height) / 2,
    drawWidth,
    drawHeight,
  )
  context.restore()
}

const startExplainerBufferCapture = (scene: Scene): MediaStream => {
  const iframeDocument = player.iframeElement.contentDocument
  const iframeWindow = player.iframeElement.contentWindow
  const sceneElement = iframeDocument?.querySelector<HTMLElement>(`#scene-${scene.index}`)
  const sourceCanvas = sceneElement?.querySelector<HTMLCanvasElement>('canvas.explainer-canvas')
  if (!sceneElement || !sourceCanvas || !iframeWindow) {
    throw new Error('The explainer canvas is not ready to record')
  }
  const capture = document.createElement('canvas')
  capture.width = 1920
  capture.height = 1080
  const context = capture.getContext('2d')
  if (!context) throw new Error('Canvas capture is unavailable in this browser')

  const paint = () => {
    const sceneRect = sceneElement.getBoundingClientRect()
    if (!sceneRect.width || !sceneRect.height) return
    const scale = capture.width / sceneRect.width
    const mapRect = (rect: DOMRect) => ({
      x: (rect.left - sceneRect.left) * scale,
      y: (rect.top - sceneRect.top) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    })
    let background = iframeWindow.getComputedStyle(sceneElement).backgroundColor
    if (!background || background === 'rgba(0, 0, 0, 0)' || background === 'transparent') {
      background = iframeDocument?.body
        ? iframeWindow.getComputedStyle(iframeDocument.body).backgroundColor
        : ''
    }
    context.fillStyle =
      background && background !== 'rgba(0, 0, 0, 0)' ? background : '#0f1014'
    context.fillRect(0, 0, capture.width, capture.height)
    const canvasRect = mapRect(sourceCanvas.getBoundingClientRect())
    context.drawImage(sourceCanvas, canvasRect.x, canvasRect.y, canvasRect.width, canvasRect.height)
    sceneElement.querySelectorAll<HTMLElement>('.ex-caption').forEach(caption => {
      const alpha = Number.parseFloat(iframeWindow.getComputedStyle(caption).opacity)
      if (!alpha) return
      context.globalAlpha = Math.min(1, Math.max(0, alpha))
      Array.from(caption.children).forEach(child => {
        const element = child as HTMLElement
        const text = element.textContent?.trim()
        if (!text) return
        const style = iframeWindow.getComputedStyle(element)
        const rect = mapRect(element.getBoundingClientRect())
        const fontSize = Number.parseFloat(style.fontSize) * scale
        const lineHeight =
          (Number.parseFloat(style.lineHeight) || fontSize * 1.3) * scale
        context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
        context.fillStyle = style.color
        context.textAlign = 'center'
        context.textBaseline = 'top'
        wrapCanvasCaptionText(context, text, rect.width).forEach((lineText, index) => {
          context.fillText(
            lineText,
            rect.x + rect.width / 2,
            rect.y + index * lineHeight,
            rect.width,
          )
        })
      })
      context.globalAlpha = 1
    })
    drawLiveCameraOnBuffer(context, capture)
  }

  paint()
  stopExplainerBufferCapture()
  explainerBufferTimer = window.setInterval(paint, 33)
  return capture.captureStream(30)
}

const startCanvasRecording = async () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  // Canvas-program explainers record from our own buffer (no tab-capture
  // permission); every other block kind still films the live composed DOM.
  const bufferCapture =
    sceneVisualKind(scene) === 'explainer' && Boolean(scene.node.attrs?.canvasCode)
  if (
    typeof MediaRecorder === 'undefined' ||
    (!bufferCapture && !navigator.mediaDevices?.getDisplayMedia)
  ) {
    showToast('Canvas recording is not supported in this browser')
    return
  }
  startCanvasRecordingButton.disabled = true
  configureCanvasRecordingCoach(scene)
  playerShell.classList.add('canvas-recording-mode')
  canvasRecordingCoach.hidden = false
  try {
    if (!bufferCapture) {
      canvasCaptureStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
      } as DisplayMediaStreamOptions)
    }
    if (!liveCameraStream && scene.config.camera.position !== 'hidden') {
      await startLiveCamera()
    }
    if (!bufferCapture && canvasCaptureStream) {
      const captureTrack = canvasCaptureStream.getVideoTracks()[0] as MediaStreamTrack & {
        cropTo?: (target: unknown) => Promise<void>
      }
      const cropTargetApi = (window as Window & {
        CropTarget?: { fromElement: (element: Element) => Promise<unknown> }
      }).CropTarget
      if (cropTargetApi && captureTrack.cropTo) {
        await captureTrack.cropTo(await cropTargetApi.fromElement(player))
      }
    }
    if (microphonePreference) {
      try {
        canvasMicrophoneStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true },
        })
      } catch {
        canvasMicrophoneStream = null
        showToast('Microphone unavailable — recording the visual take without mic audio')
      }
    } else {
      canvasMicrophoneStream = null
    }
    syncMicrophoneToggle()
    await prepareCanvasRecordingSteps(scene)
    if (bufferCapture) {
      canvasCaptureStream = startExplainerBufferCapture(scene)
    }
    if (!canvasCaptureStream) throw new Error('No capture stream is available')
    const tracks = [
      ...canvasCaptureStream.getVideoTracks(),
      ...(canvasMicrophoneStream?.getAudioTracks() || []),
    ]
    const recordingStream = new MediaStream(tracks)
    const recorderType = supportedRecorderType()
    canvasRecorder = new MediaRecorder(
      recordingStream,
      recorderType ? { mimeType: recorderType } : undefined,
    )
    canvasRecordingChunks = []
    canvasRecorder.ondataavailable = event => {
      if (event.data.size) canvasRecordingChunks.push(event.data)
    }
    canvasRecorder.onstop = async () => {
      const mimeType = canvasRecorder?.mimeType || 'video/webm'
      const durationMs = Math.max(1, Date.now() - canvasRecordingStartedAt)
      stopExplainerBufferCapture()
      canvasCaptureStream?.getTracks().forEach(track => track.stop())
      canvasMicrophoneStream?.getTracks().forEach(track => track.stop())
      canvasCaptureStream = null
      canvasMicrophoneStream = null
      resetCanvasRecordingControls()
      restoreCanvasRecordingSteps()
      player.seek(scenePreviewTime(scene))
      try {
        canvasRecordingLabel.textContent = 'Making MP4…'
        startCanvasRecordingButton.disabled = true
        await uploadDirectedCanvasRecording(
          new Blob(canvasRecordingChunks, { type: mimeType }),
          scene,
          durationMs,
        )
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not make MP4')
      } finally {
        resetCanvasRecordingControls()
        canvasRecordingChunks = []
      }
    }
    canvasCaptureStream
      .getVideoTracks()[0]
      ?.addEventListener('ended', finishCanvasRecording, { once: true })
    canvasRecorder.start(250)
    canvasRecordingStartedAt = Date.now()
    canvasRecordingTimer = window.setInterval(updateCanvasRecordingClock, 250)
    playerShell.classList.add('canvas-recording-active')
    canvasRecordingControls.setAttribute('aria-busy', 'true')
    startCanvasRecordingButton.hidden = true
    previousAnimationStepButton.hidden = false
    nextAnimationStepButton.hidden = false
    stopCanvasRecordingButton.hidden = false
    canvasRecordingMeta.textContent = bufferCapture
      ? 'Direct canvas capture — no screen permission needed'
      : 'Camera visible · microphone optional'
    updateCanvasRecordingClock()
  } catch (error) {
    stopExplainerBufferCapture()
    canvasCaptureStream?.getTracks().forEach(track => track.stop())
    canvasMicrophoneStream?.getTracks().forEach(track => track.stop())
    canvasCaptureStream = null
    canvasMicrophoneStream = null
    restoreCanvasRecordingSteps()
    resetCanvasRecordingControls()
    showToast(error instanceof Error ? error.message : 'Canvas recording was cancelled')
  }
}

startCanvasRecordingButton.addEventListener('click', () => void startCanvasRecording())
previousAnimationStepButton.addEventListener('click', resetCanvasRecordingProgress)
nextAnimationStepButton.addEventListener('click', revealNextCanvasRecordingStep)
stopCanvasRecordingButton.addEventListener('click', finishCanvasRecording)
;($('#close-canvas-recording-review') as HTMLButtonElement).addEventListener('click', () => {
  canvasRecordingPlayback.pause()
  canvasRecordingReview.hidden = true
})
const commitPendingRecordedBlock = async (mode: 'version' | 'replace') => {
  if (!pendingRecordedBlock) return
  const activeButton =
    mode === 'replace' ? replaceCanvasRecordingButton : saveCanvasRecordingButton
  saveCanvasRecordingButton.disabled = true
  replaceCanvasRecordingButton.disabled = true
  activeButton.textContent = 'Saving…'
  try {
    const result = await fetchJson<{ recording: RecordedBlockV1 }>(
      '/api/recordings/commit',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(pendingRecordedBlock),
      },
    )
    const recording = result.recording
    project.recordedBlocks ||= {}
    project.recordedBlockTakes ||= {}
    const takes = (project.recordedBlockTakes[recording.blockId] ||= [])
    const previousActive = project.recordedBlocks[recording.blockId]
    if (
      previousActive &&
      !takes.some(take => take.recordingId === previousActive.recordingId)
    ) {
      takes.push(previousActive)
    }
    if (mode === 'replace' && previousActive) {
      const activeIndex = takes.findIndex(
        take => take.recordingId === previousActive.recordingId,
      )
      if (activeIndex >= 0) takes[activeIndex] = recording
      else takes.push(recording)
    } else {
      takes.push(recording)
    }
    project.recordedBlocks[recording.blockId] = recording
    pendingRecordedBlock = null
    renderCanvasBlockTimeline()
    syncProject()
    await persistProjectNow(structuredClone(project))
    saveState.textContent = 'Saved'
    const versionNumber =
      takes.findIndex(take => take.recordingId === recording.recordingId) + 1
    canvasRecordingReviewStatus.textContent = 'Recorded block'
    canvasRecordingReviewTitle.textContent = `Take v${versionNumber} is saved and active`
    activeButton.textContent = 'Saved'
    replaceCanvasRecordingButton.hidden = true
    syncCanvasViewSwitch()
    showToast(
      mode === 'replace'
        ? `Replaced the current take with v${versionNumber}`
        : `Saved take v${versionNumber} — it's now the active version`,
    )
  } catch (error) {
    saveCanvasRecordingButton.disabled = false
    replaceCanvasRecordingButton.disabled = false
    activeButton.textContent =
      mode === 'replace' ? 'Replace current take' : 'Save block'
    showToast(error instanceof Error ? error.message : 'Could not save the block')
  }
}

saveCanvasRecordingButton.addEventListener('click', () =>
  void commitPendingRecordedBlock('version'),
)
replaceCanvasRecordingButton.addEventListener('click', () =>
  void commitPendingRecordedBlock('replace'),
)
;($('#record-canvas-again') as HTMLButtonElement).addEventListener('click', () => {
  canvasRecordingPlayback.pause()
  canvasRecordingReview.hidden = true
  void startCanvasRecording()
})
document.addEventListener('keydown', event => {
  if (canvasRecorder?.state !== 'recording' || !canvasRecordingScene) return
  const visualKind = sceneVisualKind(canvasRecordingScene)
  if (visualKind === 'code' && event.key === 'ArrowRight') {
    event.preventDefault()
    runCanvasRecordingAction('next-token')
    return
  }
  if (visualKind === 'code' && event.key === 'ArrowDown') {
    event.preventDefault()
    runCanvasRecordingAction('next-line')
    return
  }
  if (visualKind === 'code' && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    runCanvasRecordingAction('focus-line')
    return
  }
  if (event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault()
    revealNextCanvasRecordingStep()
  }
})

const startLiveCamera = async () => {
  stopLiveCamera()
  const config = project.blocks[selectedNodeId]
  if (config?.camera.position === 'hidden') {
    config.camera.mode = 'information-circle'
    config.camera.position = 'bottom-right'
    config.camera.shape = 'circle'
    syncProject()
  }
  liveCameraStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  syncLiveCameraToggle()
  attachLiveCameraToPlayer()
}

const readStoredProject = (): ProjectDocumentV1 | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as ProjectDocumentV1
    return parsed.version === 1 ? parsed : null
  } catch {
    return null
  }
}

const localProject = readStoredProject()
// The notebook to open: an explicit pick from the switcher wins, then the
// locally cached notebook, then whatever was saved most recently.
const activeProjectId = window.localStorage.getItem(ACTIVE_PROJECT_KEY) || ''

const readPersistedProject = async (
  local: ProjectDocumentV1 | null,
): Promise<ProjectDocumentV1 | null> => {
  const path = activeProjectId
    ? `/api/projects/${encodeURIComponent(activeProjectId)}`
    : local
      ? `/api/projects/${encodeURIComponent(local.id)}`
      : '/api/projects/latest'
  // The worker often boots a beat after the dev server; a failed fetch must
  // not silently spawn a fresh notebook, so retry briefly before giving up.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`${WORKER_URL}${path}`)
      if (response.ok) {
        const body = (await response.json()) as { project?: ProjectDocumentV1 | null }
        return body.project?.version === 1 ? body.project : null
      }
    } catch {
      // retry below
    }
    await new Promise(resolve => window.setTimeout(resolve, 800))
  }
  return null
}

const persistedProject = await readPersistedProject(localProject)
const storedProject =
  persistedProject ||
  (localProject && (!activeProjectId || localProject.id === activeProjectId)
    ? localProject
    : null)

const blankProjectDocument = (title: string): ProjectDocumentV1 => ({
  version: 1,
  id: crypto.randomUUID(),
  title,
  notebook: { type: 'doc', content: [] },
  fps: 30,
  width: 1920,
  height: 1080,
  blocks: {},
  presenterTracks: {},
  recordedBlocks: {},
  brand: { ...defaultBrand },
  theme: structuredClone(defaultStudioTheme),
})

if (
  storedProject &&
  Object.entries(LEGACY_MVP_BRAND).every(
    ([key, value]) =>
      storedProject.brand[key as keyof typeof LEGACY_MVP_BRAND] === value,
  )
) {
  storedProject.brand = { ...defaultBrand }
}

let project: ProjectDocumentV1 =
  storedProject || blankProjectDocument('Human-first developer story')

project.theme = normalizeStudioTheme(project.theme, project.brand)
project.brand = { ...project.theme.brand }
project.recordedBlocks ||= {}
project.recordedBlockTakes ||= {}
// Seed take history for blocks recorded before versioning existed.
Object.entries(project.recordedBlocks).forEach(([blockId, recording]) => {
  const takes = (project.recordedBlockTakes![blockId] ||= [])
  if (!takes.some(take => take.recordingId === recording.recordingId)) {
    takes.push(recording)
  }
})
// Heal documents saved before blob: sources were kept out of persistence.
sanitizeNotebookMedia(project.notebook)
window.localStorage.setItem(ACTIVE_PROJECT_KEY, project.id)

const cloneTheme = (theme: StudioThemeV1): StudioThemeV1 =>
  structuredClone(theme)

const readSavedThemes = (): StudioThemeV1[] => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(THEME_STORAGE_KEY) || '[]',
    ) as StudioThemeV1[]
    return Array.isArray(parsed)
      ? parsed
          .filter(theme => theme?.version === 1 && typeof theme.id === 'string')
          .map(theme => normalizeStudioTheme(theme))
      : []
  } catch {
    return []
  }
}

let savedThemes = readSavedThemes()
let generatedThemes: StudioThemeV1[] = []
let themeDraft = cloneTheme(project.theme)
let themePreviewKind: ThemePreviewKind = 'title'
let themeLabAxis: ThemeLabAxis = 'render'
let previewPresenterId: PreviewPresenterId = 'arun'

const allStudioThemes = () => [...builtinStudioThemes, ...savedThemes]
const selectedPreviewPresenter = () =>
  PREVIEW_PRESENTERS.find(presenter => presenter.id === previewPresenterId) ||
  PREVIEW_PRESENTERS[0]

const themeCanvasCss = (theme: StudioThemeV1) => {
  if (theme.canvas.treatment === 'gradient') {
    return `linear-gradient(135deg, ${theme.canvas.gradient[0]}, ${theme.canvas.gradient[1]})`
  }
  if (theme.canvas.treatment === 'grid') {
    return `linear-gradient(90deg, transparent calc(20% - 1px), ${theme.canvas.gridColor} 20%, transparent calc(20% + 1px)), ${theme.brand.background}`
  }
  return theme.brand.background
}

const presenterPresetForMode = (mode: PresenterLayoutMode) =>
  PRESENTER_LAYOUT_PRESETS.find(
    preset => preset.mode === mode && preset.position !== 'hidden',
  ) ||
  PRESENTER_LAYOUT_PRESETS[0]

const appearanceFromTheme = (kind: ThemeBlockKind, theme: StudioThemeV1) => ({
  layout: theme.blocks.layout[kind],
  render: theme.blocks[kind] as ThemeBlockRendering,
  codeTheme: theme.blocks.codeTheme,
  codeAnimation: theme.blocks.codeAnimation,
})

const applyThemeToProject = (theme: StudioThemeV1, updateCamera = true) => {
  project.theme = cloneTheme(normalizeStudioTheme(theme))
  project.brand = { ...project.theme.brand }
  const nodesById = new Map(
    project.notebook.content
      .filter(node => typeof node.attrs?.id === 'string')
      .map(node => [node.attrs!.id as string, node]),
  )
  if (updateCamera) {
    Object.values(project.blocks).forEach(config => {
      const preset = presenterPresetForMode(project.theme!.video.layout)
      config.camera.mode = preset.mode
      config.camera.position = preset.position
      config.camera.shape = preset.shape
      const node = nodesById.get(config.nodeId)
      if (node) {
        const kind = directorKindForNode(node)
        config.reveal = project.theme!.motion[kind]
        config.appearance = appearanceFromTheme(kind, project.theme!)
      }
    })
  }
  document.documentElement.style.setProperty('--brand', project.brand.primary)
  document.documentElement.style.setProperty('--brand-light', project.brand.accent)
  renderStudioThemeSelector()
  syncProject()
}

const createThemePreview = (theme: StudioThemeV1) => {
  const preview = document.createElement('div')
  preview.className = `theme-card-preview treatment-${theme.canvas.treatment} video-${theme.video.layout}`
  preview.style.setProperty('--theme-card-canvas', themeCanvasCss(theme))
  preview.style.setProperty('--theme-card-surface', theme.brand.surface)
  preview.style.setProperty('--theme-card-text', theme.brand.text)
  preview.style.setProperty('--theme-card-muted', theme.brand.mutedText)
  preview.style.setProperty('--theme-card-primary', theme.brand.primary)
  preview.style.setProperty('--theme-card-secondary', theme.brand.secondary)
  preview.style.setProperty('--theme-card-accent', theme.brand.accent)
  preview.style.setProperty('--theme-card-code', theme.brand.codeBackground)
  preview.style.setProperty('--theme-card-radius', `${theme.blocks.borderRadius}px`)
  preview.innerHTML =
    '<span class="theme-card-number">01</span><div class="theme-card-copy"><strong>Make ideas feel human.</strong><span>Markdown → live canvas</span></div><div class="theme-card-code"><i></i><i></i><i></i></div><div class="theme-card-human"><span></span></div>'
  const human = preview.querySelector<HTMLElement>('.theme-card-human')!
  human.style.borderRadius = `${theme.video.borderRadius}px`
  human.style.borderWidth = `${Math.max(0, theme.video.borderWidth / 2)}px`
  human.classList.toggle('gradient-border', theme.video.borderStyle === 'gradient')
  human.classList.toggle('no-border', theme.video.borderStyle === 'none')
  if (theme.logo.url) {
    const logo = document.createElement('img')
    logo.className = 'theme-card-logo'
    logo.src = theme.logo.url
    logo.alt = ''
    preview.append(logo)
  }
  return preview
}

const createThemeCard = (
  theme: StudioThemeV1,
  mode: 'library' | 'generated',
) => {
  const article = document.createElement('article')
  article.className = 'theme-card'
  article.dataset.themeId = theme.id
  article.classList.toggle('selected', project.theme?.id === theme.id)
  article.append(createThemePreview(theme))

  const meta = document.createElement('div')
  meta.className = 'theme-card-meta'
  const copy = document.createElement('div')
  const name = document.createElement('strong')
  name.textContent = theme.name
  const description = document.createElement('p')
  description.textContent = theme.description
  copy.append(name, description)
  const badge = document.createElement('span')
  badge.textContent = theme.source === 'built-in' ? 'Incredible' : theme.source
  meta.append(copy, badge)
  article.append(meta)

  const actions = document.createElement('div')
  actions.className = 'theme-card-actions'
  if (mode === 'generated') {
    const choose = document.createElement('button')
    choose.type = 'button'
    choose.className = 'button ghost wide'
    choose.textContent = 'Choose direction'
    choose.addEventListener('click', () => {
      const logo = { ...themeDraft.logo }
      themeDraft = cloneTheme(theme)
      themeDraft.logo = logo
      themeDraft.id = `custom-${crypto.randomUUID()}`
      themeDraft.source = 'custom'
      syncThemeBuilderControls()
      renderThemeBuilderPreview()
    })
    actions.append(choose)
  } else {
    const customize = document.createElement('button')
    customize.type = 'button'
    customize.className = 'button ghost'
    customize.textContent = 'Customize'
    customize.addEventListener('click', () => openThemeBuilder(theme))
    const use = document.createElement('button')
    use.type = 'button'
    use.className = 'button primary'
    use.textContent = project.theme?.id === theme.id ? 'In use' : 'Use in notebook'
    use.addEventListener('click', () => {
      applyThemeToProject(theme)
      navigateToSurface('studio')
    })
    actions.append(customize, use)
  }
  article.append(actions)
  return article
}

const renderThemeLibrary = () => {
  const grid = $('#theme-library-grid')
  grid.replaceChildren(
    ...allStudioThemes().map(theme => createThemeCard(theme, 'library')),
  )
  ;($('#theme-count') as HTMLElement).textContent = String(allStudioThemes().length)
}

const renderGeneratedThemes = () => {
  const grid = $('#generated-theme-grid')
  grid.replaceChildren(
    ...generatedThemes.map(theme => createThemeCard(theme, 'generated')),
  )
}

const renderStudioThemeSelector = () => {
  const selector = $('#studio-theme-selector') as HTMLSelectElement
  const themes = allStudioThemes()
  if (project.theme && !themes.some(theme => theme.id === project.theme?.id)) {
    themes.push(project.theme)
  }
  selector.replaceChildren(
    ...themes.map(theme => {
      const option = document.createElement('option')
      option.value = theme.id
      option.textContent = theme.name
      return option
    }),
  )
  selector.value = project.theme?.id || defaultStudioTheme.id
}

const setBuilderValue = (selector: string, value: string | number) => {
  const input = $(selector) as HTMLInputElement | HTMLSelectElement
  input.value = String(value)
}

const syncThemeBuilderControls = () => {
  setBuilderValue('#theme-name', themeDraft.name)
  setBuilderValue('#theme-brand-color', themeDraft.brand.primary)
  setBuilderValue('#theme-secondary-color', themeDraft.brand.secondary)
  setBuilderValue('#theme-accent-color', themeDraft.brand.accent)
  setBuilderValue('#theme-canvas-treatment', themeDraft.canvas.treatment)
  setBuilderValue('#theme-background', themeDraft.brand.background)
  setBuilderValue('#theme-surface', themeDraft.brand.surface)
  setBuilderValue('#theme-text', themeDraft.brand.text)
  setBuilderValue('#theme-logo-placement', themeDraft.logo.placement)
  setBuilderValue('#theme-logo-size', themeDraft.logo.size)
  setBuilderValue('#theme-surface-style', themeDraft.blocks.surface)
  setBuilderValue('#theme-block-radius', themeDraft.blocks.borderRadius)
  setBuilderValue('#theme-video-layout', themeDraft.video.layout)
  setBuilderValue('#theme-video-border', themeDraft.video.borderStyle)
  setBuilderValue('#theme-video-radius', themeDraft.video.borderRadius)
  setBuilderValue('#theme-video-width', themeDraft.video.borderWidth)
  ;($('#theme-block-radius-output') as HTMLOutputElement).value = `${themeDraft.blocks.borderRadius}px`
  ;($('#theme-video-radius-output') as HTMLOutputElement).value = `${themeDraft.video.borderRadius}px`
  ;($('#theme-video-width-output') as HTMLOutputElement).value = `${themeDraft.video.borderWidth}px`
  ;($('#theme-logo-size-output') as HTMLOutputElement).value = `${themeDraft.logo.size}px`
  const logoPreview = $('#theme-logo-preview') as HTMLImageElement
  logoPreview.hidden = !themeDraft.logo.url
  logoPreview.src = themeDraft.logo.url || ''
  ;($('#theme-logo-placeholder') as HTMLElement).hidden = Boolean(themeDraft.logo.url)
  ;($('#remove-theme-logo') as HTMLButtonElement).disabled = !themeDraft.logo.url
}

const previewThemeBlockKind = (): ThemeBlockKind =>
  themePreviewKind === 'video' ? 'title' : themePreviewKind

const renderThemeDesignLab = () => {
  const kind = previewThemeBlockKind()
  if (kind !== 'code' && (themeLabAxis === 'syntax' || themeLabAxis === 'code-motion')) {
    themeLabAxis = 'render'
  }
  const meta = BLOCK_KIND_META[kind]
  const motions = kind === 'list' || kind === 'code'
    ? MOTION_OPTIONS
    : MOTION_OPTIONS.filter(option => option.value !== 'line-by-line')
  const options: CatalogOption<string>[] =
    themeLabAxis === 'layout'
      ? BLOCK_LAYOUT_OPTIONS
      : themeLabAxis === 'motion'
        ? motions
        : themeLabAxis === 'syntax'
          ? CODE_THEME_OPTIONS
          : themeLabAxis === 'code-motion'
            ? CODE_ANIMATION_OPTIONS
            : BLOCK_RENDER_OPTIONS[kind]
  const activeValue =
    themeLabAxis === 'layout'
      ? themeDraft.blocks.layout[kind]
      : themeLabAxis === 'motion'
        ? themeDraft.motion[kind]
        : themeLabAxis === 'syntax'
          ? themeDraft.blocks.codeTheme
          : themeLabAxis === 'code-motion'
            ? themeDraft.blocks.codeAnimation
            : String(themeDraft.blocks[kind])

  ;($('#theme-lab-title') as HTMLElement).textContent = meta.label
  ;($('#theme-lab-description') as HTMLElement).textContent = meta.description
  ;($('#theme-lab-count') as HTMLElement).textContent =
    `${BLOCK_LAYOUT_OPTIONS.length * BLOCK_RENDER_OPTIONS[kind].length * motions.length * (kind === 'code' ? CODE_THEME_OPTIONS.length * CODE_ANIMATION_OPTIONS.length : 1)} combinations`
  ;($('#replay-theme-motion') as HTMLButtonElement).hidden =
    themeLabAxis !== 'motion' && themeLabAxis !== 'code-motion'

  document
    .querySelectorAll<HTMLButtonElement>('[data-theme-lab-axis]')
    .forEach(button => {
      const codeOnly =
        button.dataset.themeLabAxis === 'syntax' ||
        button.dataset.themeLabAxis === 'code-motion'
      button.hidden = codeOnly && kind !== 'code'
      const active = button.dataset.themeLabAxis === themeLabAxis
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', String(active))
    })

  const grid = $('#theme-lab-options')
  grid.replaceChildren(
    ...options.map(option => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = option.value === activeValue ? 'active' : ''
      button.classList.toggle('code-theme-choice', themeLabAxis === 'syntax')
      button.setAttribute('aria-pressed', String(option.value === activeValue))
      const glyph = document.createElement('span')
      glyph.className = 'theme-lab-option-glyph'
      if (themeLabAxis === 'syntax') {
        glyph.classList.add('theme-lab-code-swatch')
        glyph.style.background = CODE_THEME_SURFACES[option.value as ThemeCodeSyntax]
        glyph.style.color = option.glyph
        glyph.textContent = '{ }'
      } else {
        glyph.textContent = option.glyph
      }
      const copy = document.createElement('span')
      const label = document.createElement('strong')
      label.textContent = option.label
      const description = document.createElement('small')
      description.textContent = option.description
      copy.append(label, description)
      button.append(glyph, copy)
      button.addEventListener('click', () => {
        if (themeLabAxis === 'layout') {
          themeDraft.blocks.layout[kind] = option.value as ThemeBlockLayout
        } else if (themeLabAxis === 'motion') {
          themeDraft.motion[kind] = option.value as RevealStyle
        } else if (themeLabAxis === 'syntax') {
          themeDraft.blocks.codeTheme = option.value as ThemeCodeSyntax
        } else if (themeLabAxis === 'code-motion') {
          themeDraft.blocks.codeAnimation = option.value as ThemeCodeAnimation
        } else {
          ;(themeDraft.blocks as Record<string, unknown>)[kind] = option.value
        }
        renderThemeBuilderPreview()
      })
      return button
    }),
  )
}

const renderThemeBuilderPreview = () => {
  const blockKind = previewThemeBlockKind()
  const preview = $('#theme-builder-preview')
  preview.className = `theme-builder-preview preview-${themePreviewKind} block-layout-${themeDraft.blocks.layout[blockKind]} block-render-${String(themeDraft.blocks[blockKind])} title-${themeDraft.blocks.title} content-${themeDraft.blocks.content} list-${themeDraft.blocks.list} code-${themeDraft.blocks.code} code-theme-${themeDraft.blocks.codeTheme} code-animation-${themeDraft.blocks.codeAnimation} quote-${themeDraft.blocks.quote} surface-${themeDraft.blocks.surface} video-${themeDraft.video.layout} border-${themeDraft.video.borderStyle} logo-${themeDraft.logo.placement}`
  preview.style.setProperty('--preview-canvas', themeCanvasCss(themeDraft))
  preview.style.setProperty('--preview-bg', themeDraft.brand.background)
  preview.style.setProperty('--preview-surface', themeDraft.brand.surface)
  preview.style.setProperty('--preview-text', themeDraft.brand.text)
  preview.style.setProperty('--preview-muted', themeDraft.brand.mutedText)
  preview.style.setProperty('--preview-primary', themeDraft.brand.primary)
  preview.style.setProperty('--preview-secondary', themeDraft.brand.secondary)
  preview.style.setProperty('--preview-accent', themeDraft.brand.accent)
  preview.style.setProperty('--preview-code', themeDraft.brand.codeBackground)
  preview.style.setProperty('--preview-gradient', `linear-gradient(135deg, ${themeDraft.brand.primary}, ${themeDraft.brand.secondary}, ${themeDraft.brand.accent})`)
  preview.style.setProperty(
    '--preview-radius',
    `${Math.max(2, themeDraft.blocks.borderRadius * 0.45)}px`,
  )
  preview.style.setProperty(
    '--preview-video-radius',
    `${Math.max(0, themeDraft.video.borderRadius * 0.45)}px`,
  )
  preview.style.setProperty(
    '--preview-video-width',
    `${Math.max(themeDraft.video.borderWidth ? 1 : 0, themeDraft.video.borderWidth * 0.45)}px`,
  )
  ;($('#builder-preview-title') as HTMLElement).textContent = themeDraft.name
  ;($('#theme-preview-name') as HTMLElement).textContent = themeDraft.name
  const previewLogo = $('#theme-preview-logo') as HTMLImageElement
  const logoInFooter = themeDraft.logo.placement.startsWith('footer-')
  previewLogo.hidden = !themeDraft.logo.url || !logoInFooter
  previewLogo.src = themeDraft.logo.url || ''
  previewLogo.style.height = `${Math.max(14, themeDraft.logo.size / 2)}px`
  ;($('#theme-preview-fallback-mark') as HTMLElement).hidden = Boolean(
    themeDraft.logo.url,
  )
  const cornerLogo = $('#theme-preview-corner-logo')
  cornerLogo.hidden = !themeDraft.logo.url || logoInFooter
  cornerLogo.className = `theme-preview-corner-logo ${themeDraft.logo.placement}`
  const cornerImage = $('#theme-preview-corner-image') as HTMLImageElement
  cornerImage.src = themeDraft.logo.url || ''
  cornerImage.style.height = `${Math.max(14, themeDraft.logo.size / 2)}px`

  const content = $('#theme-preview-content')
  content.replaceChildren()
  if (
    themePreviewKind === 'video' &&
    themeDraft.video.layout.startsWith('person-background')
  ) {
    const title = document.createElement('strong')
    title.textContent = 'What matters most'
    const list = document.createElement('ol')
    ;['People stay visible', 'Points stay readable', 'The story leads'].forEach(
      item => {
        const listItem = document.createElement('li')
        listItem.textContent = item
        list.append(listItem)
      },
    )
    content.append(title, list)
  } else if (themePreviewKind === 'title' || themePreviewKind === 'video') {
    const kicker = document.createElement('span')
    kicker.textContent = 'Human-first developer video'
    const title = document.createElement('strong')
    title.textContent = 'Make technical ideas feel human.'
    const body = document.createElement('p')
    body.textContent = 'Write in Markdown. Direct the canvas. Stay on camera.'
    content.append(kicker, title, body)
  } else if (themePreviewKind === 'content') {
    const kicker = document.createElement('span')
    kicker.textContent = 'One idea at a time'
    const title = document.createElement('strong')
    title.textContent = 'Explain the important part clearly.'
    const body = document.createElement('p')
    body.textContent =
      'The canvas follows the speaker, giving each thought enough room to land.'
    content.append(kicker, title, body)
  } else if (themePreviewKind === 'list') {
    const title = document.createElement('strong')
    title.textContent = 'A clearer way to explain'
    const list = document.createElement('ol')
    ;['Write naturally', 'Choose the layout', 'Tell it as yourself'].forEach(item => {
      const listItem = document.createElement('li')
      listItem.textContent = item
      list.append(listItem)
    })
    content.append(title, list)
  } else if (themePreviewKind === 'code') {
    const title = document.createElement('strong')
    title.textContent = 'Render the notebook'
    const code = document.createElement('pre')
    ;[
      [
        ['keyword', 'const '],
        ['variable', 'story'],
        ['plain', ' = '],
        ['function', 'compile'],
        ['plain', '('],
        ['variable', 'notebook'],
        ['plain', ')'],
      ],
      [
        ['keyword', 'await '],
        ['variable', 'hyperframes'],
        ['plain', '.'],
        ['function', 'render'],
        ['plain', '('],
        ['variable', 'story'],
        ['plain', ')'],
      ],
      [
        ['comment', '// keep the person in the frame'],
      ],
    ].forEach((tokens, index) => {
      const codeLine = document.createElement('span')
      codeLine.className = 'theme-preview-code-line'
      codeLine.style.setProperty('--motion-index', String(index + 1))
      tokens.forEach(([kind, value]) => {
        const token = document.createElement('span')
        token.className = `code-token-${kind}`
        token.textContent = value
        codeLine.append(token)
      })
      code.append(codeLine)
    })
    content.append(title, code)
  } else {
    const quote = document.createElement('blockquote')
    quote.textContent = 'Generated voice removes friction. It does not remove the person.'
    content.append(quote)
  }
  const previewPresenter = PREVIEW_PRESENTERS.find(
    presenter => presenter.id === previewPresenterId,
  ) || PREVIEW_PRESENTERS[0]
  const previewPerson = $('#theme-preview-person')
  const previewPersonImage = $('#theme-preview-presenter-image') as HTMLImageElement
  previewPerson.classList.add('has-presenter-image')
  previewPersonImage.src = previewPresenter.url
  previewPersonImage.alt = `${previewPresenter.name}, sample presenter`
  ;(previewPerson.querySelector('span') as HTMLElement).hidden = true
  previewPerson.hidden = false

  content.querySelectorAll('li').forEach((item, index) => {
    ;(item as HTMLElement).style.setProperty('--motion-index', String(index + 1))
  })

  document
    .querySelectorAll<HTMLButtonElement>('[data-preview-presenter]')
    .forEach(button => {
      const active = button.dataset.previewPresenter === previewPresenterId
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
  renderThemeDesignLab()
  replayThemeMotionPreview()
}

const replayThemeMotionPreview = () => {
  const preview = $('#theme-builder-preview')
  const motion = themeDraft.motion[previewThemeBlockKind()]
  MOTION_OPTIONS.map(option => option.value).forEach(
    option => preview.classList.remove(`motion-${option}`),
  )
  preview.classList.remove('motion-playing')
  void preview.offsetWidth
  preview.classList.add(`motion-${motion}`, 'motion-playing')
}

const renderPreviewPresenterPicker = () => {
  const picker = $('#theme-presenter-picker')
  picker.replaceChildren()
  PREVIEW_PRESENTERS.forEach(presenter => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.previewPresenter = presenter.id
    button.setAttribute('aria-label', `Preview with ${presenter.name}`)
    button.setAttribute('aria-pressed', String(presenter.id === previewPresenterId))
    button.className = presenter.id === previewPresenterId ? 'active' : ''
    const image = document.createElement('img')
    image.src = presenter.url
    image.alt = ''
    const label = document.createElement('span')
    label.textContent = presenter.name
    button.append(image, label)
    button.addEventListener('click', () => {
      previewPresenterId = presenter.id
      renderThemeBuilderPreview()
    })
    picker.append(button)
  })
}

const showThemePanel = (panel: 'library' | 'builder') => {
  ;($('#theme-library-panel') as HTMLElement).hidden = panel !== 'library'
  ;($('#theme-builder-panel') as HTMLElement).hidden = panel !== 'builder'
  ;($('#show-theme-library') as HTMLButtonElement).classList.toggle(
    'active',
    panel === 'library',
  )
  ;($('#show-theme-builder') as HTMLButtonElement).classList.toggle(
    'active',
    panel === 'builder',
  )
}

const openThemeBuilder = (theme?: StudioThemeV1) => {
  themeDraft = cloneTheme(theme || project.theme || defaultStudioTheme)
  themeDraft.id = themeDraft.source === 'custom'
    ? themeDraft.id
    : `custom-${crypto.randomUUID()}`
  themeDraft.source = 'custom'
  syncThemeBuilderControls()
  renderThemeBuilderPreview()
  showThemePanel('builder')
}

const navigateToSurface = (surface: 'themes' | 'studio', replace = false) => {
  const path = surface === 'themes' ? '/themes' : '/studio'
  if (replace) window.history.replaceState({ surface }, '', path)
  else if (window.location.pathname !== path) {
    window.history.pushState({ surface }, '', path)
  }
  ;($('#theme-app') as HTMLElement).hidden = surface !== 'themes'
  ;($('#app') as HTMLElement).hidden = surface !== 'studio'
  document.body.classList.toggle('theme-surface-open', surface === 'themes')
  if (surface === 'themes') renderThemeLibrary()
  else window.requestAnimationFrame(positionInlinePreview)
}

type SlashBlockId =
  | 'title'
  | 'text'
  | 'points'
  | 'quote'
  | 'code'
  | 'image'
  | 'screen'
  | 'explainer'

const SLASH_BLOCKS: Array<{
  id: SlashBlockId
  label: string
  description: string
  icon: string
  keywords: string
}> = [
  { id: 'title', label: 'Title', description: 'Open a section', icon: 'T', keywords: 'heading h1 headline' },
  { id: 'text', label: 'Text', description: 'Explain an idea', icon: 'Aa', keywords: 'paragraph prose copy' },
  { id: 'points', label: 'Points', description: 'Build a sequence', icon: '☷', keywords: 'list bullets steps' },
  { id: 'quote', label: 'Quote', description: 'Emphasize a thought', icon: '“', keywords: 'blockquote callout' },
  { id: 'code', label: 'Code', description: 'Walk through code', icon: '</>', keywords: 'snippet terminal developer' },
  { id: 'image', label: 'Image', description: 'Show a visual', icon: '▧', keywords: 'photo picture media upload' },
  { id: 'screen', label: 'Screen recording', description: 'Capture your screen', icon: '▶', keywords: 'video screencast demo capture' },
  { id: 'explainer', label: 'Explainer', description: 'AI-planned animated diagram', icon: '◈', keywords: 'explain diagram animation concept ai shapes entities' },
]

let slashMenuActiveIndex = 0
let slashMenuRange: { from: number; to: number; query: string } | null = null
let dismissedSlashKey = ''
let pendingImageUploadKey = ''
let editor: Editor

const slashContext = () => {
  if (!editor || !editor.state.selection.empty) return null
  const { $from } = editor.state.selection
  if ($from.parent.type.name !== 'paragraph' || $from.depth !== 1) return null
  const beforeCursor = $from.parent.textBetween(0, $from.parentOffset, ' ')
  const match = beforeCursor.match(/^\/([a-z\s-]*)$/i)
  if (!match) return null
  return {
    from: $from.before(),
    to: $from.after(),
    query: match[1].trim().toLowerCase(),
  }
}

const filteredSlashBlocks = (query: string) =>
  SLASH_BLOCKS.filter(option =>
    `${option.label} ${option.description} ${option.keywords}`
      .toLowerCase()
      .includes(query),
  )

const hideSlashMenu = () => {
  ;($('#slash-menu') as HTMLElement).hidden = true
  slashMenuRange = null
}

const positionSlashMenu = () => {
  if (!slashMenuRange) return
  const menu = $('#slash-menu')
  const coordinates = editor.view.coordsAtPos(editor.state.selection.from)
  const menuWidth = 470
  const menuHeight = 370
  menu.style.left = `${Math.max(16, Math.min(coordinates.left, window.innerWidth - menuWidth - 16))}px`
  menu.style.top = `${Math.max(16, Math.min(coordinates.bottom + 10, window.innerHeight - menuHeight - 16))}px`
}

const renderSlashMenu = () => {
  const context = slashContext()
  const menu = $('#slash-menu')
  if (!context) {
    hideSlashMenu()
    dismissedSlashKey = ''
    return
  }
  const contextKey = `${context.from}:${context.to}:${context.query}`
  if (contextKey === dismissedSlashKey) return
  slashMenuRange = context
  const options = filteredSlashBlocks(context.query)
  slashMenuActiveIndex = Math.min(slashMenuActiveIndex, Math.max(0, options.length - 1))
  const grid = $('#slash-menu-grid')
  grid.replaceChildren()
  options.forEach((option, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.slashBlock = option.id
    button.className = index === slashMenuActiveIndex ? 'active' : ''
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(index === slashMenuActiveIndex))
    button.innerHTML = `<span>${option.icon}</span><strong>${option.label}</strong><small>${option.description}</small>`
    button.addEventListener('pointerdown', event => event.preventDefault())
    button.addEventListener('click', () => insertSlashBlock(option.id))
    grid.append(button)
  })
  ;($('#slash-menu-empty') as HTMLElement).hidden = options.length > 0
  menu.hidden = false
  window.requestAnimationFrame(positionSlashMenu)
}

const mediaNodeContent = (
  type: 'image' | 'screenRecording',
  attributes: Record<string, string>,
) => [
  { type, attrs: attributes },
  { type: 'paragraph' },
]

const insertSlashBlock = (blockId: SlashBlockId) => {
  const range = slashMenuRange || slashContext()
  if (!range) return
  hideSlashMenu()
  dismissedSlashKey = ''
  if (blockId === 'explainer') {
    // Insert an empty explainer node right away (the identifier plugin gives
    // it a stable id in the same transaction), then hand it to the wizard.
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: range.from, to: range.to },
        [
          {
            type: 'explainer',
            attrs: { topic: '', verbosity: 'standard', abstract: '', plan: null },
          },
          { type: 'paragraph' },
        ],
      )
      .run()
    const inserted = editor.state.doc.nodeAt(range.from)
    const nodeId =
      inserted && inserted.type.name === 'explainer'
        ? String(inserted.attrs.id || '')
        : ''
    if (nodeId) openExplainerWizard(nodeId, true)
    return
  }

  const content: Record<Exclude<SlashBlockId, 'image' | 'screen' | 'explainer'>, JSONContent> = {
    title: {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'New section title' }],
    },
    text: {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Start explaining your idea…' }],
    },
    points: {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'First point' }],
            },
          ],
        },
      ],
    },
    quote: {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A thought worth emphasizing' }],
        },
      ],
    },
    code: {
      type: 'codeBlock',
      attrs: { language: 'ts' },
      content: [{ type: 'text', text: 'const idea = "show, then explain"' }],
    },
  }

  if (blockId === 'image') {
    pendingImageUploadKey = crypto.randomUUID()
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: range.from, to: range.to },
        mediaNodeContent('image', {
          src: '',
          alt: 'Image',
          title: 'Image',
          status: 'uploading',
          uploadKey: pendingImageUploadKey,
        }),
      )
      .run()
    chooseImageFile(pendingImageUploadKey)
    return
  }

  if (blockId === 'screen') {
    const uploadKey = crypto.randomUUID()
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: range.from, to: range.to },
        mediaNodeContent('screenRecording', {
          src: '',
          title: 'Screen recording',
          status: 'recording',
          uploadKey,
        }),
      )
      .run()
    void beginScreenRecording(uploadKey)
    return
  }

  editor
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to: range.to }, content[blockId])
    .run()
}

const handleSlashKey = (event: KeyboardEvent) => {
  const menu = $('#slash-menu')
  if (menu.hidden || !slashMenuRange) return false
  const options = filteredSlashBlocks(slashMenuRange.query)
  if (event.key === 'Escape') {
    dismissedSlashKey = `${slashMenuRange.from}:${slashMenuRange.to}:${slashMenuRange.query}`
    hideSlashMenu()
    return true
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!options.length) return true
    const direction = event.key === 'ArrowDown' ? 1 : -1
    slashMenuActiveIndex =
      (slashMenuActiveIndex + direction + options.length) % options.length
    renderSlashMenu()
    return true
  }
  if (event.key === 'Enter' && options[slashMenuActiveIndex]) {
    insertSlashBlock(options[slashMenuActiveIndex].id)
    return true
  }
  return false
}

// ——— Block explanations ———
// Every block can carry the words spoken over it. The text lives in the
// block's configuration (`speakerNotes`, shared with the recording coach and
// the teleprompter), never in the notebook document — so it is edited beside
// the block as a widget and never becomes a scene of its own.
const explanationPluginKey = new PluginKey('blockExplanations')
const explanationWidgets = new Map<string, HTMLElement>()

const autosizeExplanation = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

const writeExplanation = (nodeId: string, value: string) => {
  if (!project.blocks[nodeId]) {
    project.notebook = editor.getJSON() as TiptapDocument
    ensureBlockConfiguration(project.notebook)
  }
  const config = project.blocks[nodeId]
  if (!config) return
  config.speakerNotes = value
  scheduleSync()
  if (nodeId === selectedNodeId) {
    recordingNotesInput.value = value
    syncRecordingNotesMeter()
    syncExplainerTeleprompter()
  }
}

const refreshExplanations = () => {
  if (!editor?.view) return
  editor.view.dispatch(editor.state.tr.setMeta(explanationPluginKey, Date.now()))
}

const explanationWidget = (nodeId: string) => {
  let dom = explanationWidgets.get(nodeId)
  if (dom) return dom
  dom = document.createElement('div')
  dom.className = 'notebook-explanation'
  dom.contentEditable = 'false'
  dom.dataset.nodeId = nodeId
  dom.innerHTML =
    '<div class="notebook-explanation-head"><span class="notebook-explanation-link" aria-hidden="true">↳</span><strong title="Spoken over this block while recording · never rendered into the video">Explanation</strong><small class="notebook-explanation-ref"></small><button type="button" class="notebook-explanation-clear" title="Remove explanation">×</button></div>' +
    '<textarea rows="1" spellcheck="true" placeholder="What you’ll say while this block is on screen…"></textarea>' +
    '<button type="button" class="notebook-explanation-add">＋ Add explanation</button>'
  const textarea = dom.querySelector('textarea') as HTMLTextAreaElement
  textarea.addEventListener('input', () => {
    autosizeExplanation(textarea)
    writeExplanation(nodeId, textarea.value)
  })
  textarea.addEventListener('blur', () => {
    if (!textarea.value.trim()) {
      dom?.classList.remove('is-editing')
      refreshExplanations()
    }
  })
  ;(dom.querySelector('.notebook-explanation-add') as HTMLButtonElement).addEventListener(
    'click',
    () => {
      dom?.classList.add('is-editing')
      textarea.focus()
    },
  )
  ;(dom.querySelector('.notebook-explanation-clear') as HTMLButtonElement).addEventListener(
    'click',
    () => {
      textarea.value = ''
      dom?.classList.remove('is-editing')
      writeExplanation(nodeId, '')
      refreshExplanations()
    },
  )
  // Hovering or editing the card lights up the block it belongs to, so the
  // pairing stays obvious in a long scroll.
  const target = () => dom?.previousElementSibling as HTMLElement | null
  const link = (on: boolean) => target()?.classList.toggle('explanation-target', on)
  dom.addEventListener('mouseenter', () => link(true))
  dom.addEventListener('mouseleave', () => {
    if (!dom?.contains(document.activeElement)) link(false)
  })
  dom.addEventListener('focusin', () => link(true))
  dom.addEventListener('focusout', () => link(false))
  explanationWidgets.set(nodeId, dom)
  return dom
}

// A short handle for the block a card belongs to: its timeline number plus
// what it is or says.
const explanationReference = (nodeId: string, node: { type: { name: string }; attrs: Record<string, unknown>; textContent: string }) => {
  const scene = scenes.find(item => item.id === nodeId)
  const number = scene ? String(scene.index + 1).padStart(2, '0') : ''
  const attrs = node.attrs || {}
  const summary =
    node.type.name === 'image' || node.type.name === 'screenRecording'
      ? String(attrs.title || attrs.alt || node.type.name)
      : node.type.name === 'codeBlock'
        ? 'Code block'
        : node.textContent.replace(/\s+/g, ' ').trim().slice(0, 56) || node.type.name
  return `${number ? `for block ${number} · ` : 'for '}${summary}`
}

const buildExplanationDecorations = (state: EditorState) => {
  const decorations: Decoration[] = []
  state.doc.forEach((node, offset) => {
    const nodeId = typeof node.attrs?.id === 'string' ? node.attrs.id : ''
    // Explainer blocks already carry their script as per-step lines.
    if (!nodeId || node.type.name === 'explainer') return
    const notes = project.blocks[nodeId]?.speakerNotes || ''
    const selected = nodeId === selectedNodeId
    if (!notes && !selected) return
    const dom = explanationWidget(nodeId)
    const textarea = dom.querySelector('textarea') as HTMLTextAreaElement
    if (document.activeElement !== textarea && textarea.value !== notes) {
      textarea.value = notes
    }
    dom.classList.toggle('is-empty', !notes.trim())
    dom.classList.toggle('is-selected', selected)
    ;(dom.querySelector('.notebook-explanation-ref') as HTMLElement).textContent =
      explanationReference(nodeId, node)
    window.requestAnimationFrame(() => autosizeExplanation(textarea))
    decorations.push(
      Decoration.widget(offset + node.nodeSize, dom, {
        side: 1,
        key: `explanation-${nodeId}`,
        stopEvent: () => true,
        ignoreSelection: true,
      }),
    )
  })
  return DecorationSet.create(state.doc, decorations)
}

const BlockExplanations = Extension.create({
  name: 'blockExplanations',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: explanationPluginKey,
        props: {
          decorations: state => buildExplanationDecorations(state),
        },
      }),
    ]
  },
})

editor = new Editor({
  element: $('#editor'),
  extensions: [
    StarterKit,
    BlockExplanations,
    ImageBlock,
    ScreenRecordingBlock,
    ExplainerBlock,
    Markdown.configure({
      markedOptions: { gfm: true, breaks: false },
    }),
    NodeIdentifier.configure({
      types: [
        'paragraph',
        'blockquote',
        'heading',
        'bulletList',
        'orderedList',
        'codeBlock',
        'image',
        'screenRecording',
        'explainer',
      ],
    }),
  ],
  content: storedProject?.notebook || SAMPLE_MARKDOWN,
  contentType: storedProject ? 'json' : 'markdown',
  autofocus: false,
  editorProps: {
    handleKeyDown: (_view, event) => handleSlashKey(event),
  },
  onUpdate: () => {
    const nodeId = selectedIdAtCursor()
    if (nodeId && nodeId !== selectedNodeId) {
      selectNode(nodeId, false)
      if (!scenes.some(scene => scene.id === nodeId)) {
        playerLoading.hidden = false
        playerLoading.textContent = 'New block · start typing'
      }
    }
    scheduleSync()
    renderSlashMenu()
  },
  onSelectionUpdate: () => {
    const nodeId = selectedIdAtCursor()
    if (nodeId && nodeId !== selectedNodeId) {
      selectNode(nodeId, false)
      if (!scenes.some(scene => scene.id === nodeId)) {
        playerLoading.hidden = false
        playerLoading.textContent = 'New block · start typing'
      }
      scheduleSync()
    } else if (nodeId) {
      window.requestAnimationFrame(() => {
        document.getElementById(nodeId)?.classList.add('selected-block')
      })
    }
    updateToolbar()
    renderSlashMenu()
  },
})

const showToast = (message: string) => {
  const toast = $('#toast')
  toast.textContent = message
  toast.hidden = false
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.hidden = true
  }, 3600)
}

const setSaving = (saving: boolean) => {
  saveState.textContent = saving ? 'Saving…' : 'Saved'
  saveState.parentElement?.classList.toggle('saving', saving)
}

const scheduleDatabaseSync = () => {
  window.clearTimeout(databaseSyncTimer)
  const snapshot = structuredClone(project)
  databaseSyncTimer = window.setTimeout(async () => {
    try {
      await persistProjectNow(snapshot)
      saveState.textContent = 'Saved'
    } catch {
      saveState.textContent = 'Saved offline'
    }
  }, 450)
}

const selectedIdAtCursor = () => {
  const position = editor.state.selection.from
  let result = ''
  editor.state.doc.forEach((node, offset) => {
    if (position >= offset && position <= offset + node.nodeSize) {
      const nodeId = node.attrs.id as unknown
      if (typeof nodeId === 'string') result = nodeId
    }
  })
  return result
}

const topLevelNodePosition = (nodeId: string) => {
  let result: number | null = null
  editor.state.doc.forEach((node, offset) => {
    if (node.attrs.id === nodeId) result = offset + 1
  })
  return result
}

const ensureBlockConfiguration = (document: TiptapDocument) => {
  const activeIds = new Set<string>()
  document.content.forEach(node => {
    const nodeId = node.attrs?.id
    if (typeof nodeId !== 'string' || !nodeId) return
    activeIds.add(nodeId)
    if (!project.blocks[nodeId]) {
      project.blocks[nodeId] = createDefaultBlockConfig(nodeId, node)
      const kind = directorKindForNode(node)
      const isMediaBlock =
        node.type === 'image' || node.type === 'screenRecording'
      project.blocks[nodeId].reveal =
        project.theme?.motion[kind] ||
        project.blocks[nodeId].reveal
      if (project.theme && !isMediaBlock) {
        project.blocks[nodeId].appearance = appearanceFromTheme(kind, project.theme)
      }
    }
    const config = project.blocks[nodeId]
    const fallback = createDefaultBlockConfig(nodeId, node)
    const isMediaBlock =
      node.type === 'image' || node.type === 'screenRecording'
    if (!config.background) {
      config.background = { ...fallback.background }
    }
    if (!config.camera) {
      config.camera = { ...fallback.camera }
    }
    if (!config.camera.mode) {
      config.camera.mode = fallback.camera.mode
    }
    if (!config.appearance) {
      config.appearance = project.theme && !isMediaBlock
        ? appearanceFromTheme(directorKindForNode(node), project.theme)
        : fallback.appearance
    }
    if (!config.mediaFrame) {
      config.mediaFrame = { ...fallback.mediaFrame }
    }
    if (isMediaBlock && !MEDIA_PLACEMENT_VALUES.has(config.appearance.layout)) {
      config.appearance.layout = 'center'
    }
    const options = DIRECTOR_OPTIONS[directorKindForNode(node)]
    if (!options.layouts.includes(config.layout)) {
      config.layout = fallback.layout
    }
    if (!options.animations.includes(config.reveal)) {
      config.reveal = node.type === 'codeBlock' ? 'line-by-line' : 'rise'
    }
  })

  Object.keys(project.blocks).forEach(nodeId => {
    if (!activeIds.has(nodeId)) delete project.blocks[nodeId]
  })
  Object.keys(project.presenterTracks).forEach(nodeId => {
    if (!activeIds.has(nodeId)) delete project.presenterTracks[nodeId]
  })
  Object.keys(project.recordedBlocks || {}).forEach(nodeId => {
    if (!activeIds.has(nodeId) && project.recordedBlocks) {
      delete project.recordedBlocks[nodeId]
    }
  })
}

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(wholeSeconds / 60)).padStart(2, '0')}:${String(
    wholeSeconds % 60,
  ).padStart(2, '0')}`
}

const transitionPopover = $('#transition-popover')
const transitionPopoverGrid = $('#transition-popover-grid')
const transitionPopoverTitle = $('#transition-popover-title')

let activeBoundarySceneIndex = -1

const closeTransitionPopover = () => {
  transitionPopover.hidden = true
  activeBoundarySceneIndex = -1
  highlightCurrentJunction()
  stopMotionPreviewLoop()
}

const blockTag = (scene: Scene) =>
  `${String(scene.index + 1).padStart(2, '0')} · ${TIMELINE_BLOCK_META[sceneVisualKind(scene)].label}`

const openTransitionPopover = (scene: Scene) => {
  // Clicking a node is direct editing — leave the guided finalize
  // walkthrough, or its junction highlight fights the drawer's.
  if (finalizeModeActive) exitFinalizeMode()
  transitionPopoverTitle.textContent = 'Frame switch'
  const fromScene = scenes[scene.index - 1]
  const pair = $('#transition-popover-pair')
  pair.replaceChildren()
  if (fromScene) {
    const fromTag = document.createElement('b')
    fromTag.textContent = blockTag(fromScene)
    const arrow = document.createElement('span')
    arrow.textContent = '→'
    const toTag = document.createElement('b')
    toTag.textContent = blockTag(scene)
    pair.append(fromTag, arrow, toTag)
  }
  activeBoundarySceneIndex = scene.index
  highlightCurrentJunction()
  transitionPopoverGrid.replaceChildren(
    ...FRAME_TRANSITION_OPTIONS.map(option => {
      const tile = document.createElement('button')
      tile.type = 'button'
      tile.className = `motion-tile${option.value === sceneFrameStyle(scene.id) ? ' active' : ''}`
      tile.title = option.description
      const label = document.createElement('strong')
      label.textContent = option.label
      tile.append(
        fromScene
          ? createJunctionDemo(fromScene, scene, `junction-in-frame-${option.value}`)
          : createMotionDemo('fade'),
        label,
      )
      tile.addEventListener('click', () => {
        // Stay open so switchovers can be auditioned one after another —
        // each pick plays full-size on the canvas, the tiles are the menu.
        transitionPopoverGrid
          .querySelectorAll('.motion-tile')
          .forEach(item => item.classList.toggle('active', item === tile))
        selectNode(scene.id, false)
        armMotionPreviewLoop(scene.id, `Frame · ${option.label}`, 'realtime')
        if (sceneFrameStyle(scene.id) !== option.value) {
          const durationInput = $(
            '#popover-duration-slot input',
          ) as HTMLInputElement | null
          setSceneFrameTransition(
            scene.id,
            option.value,
            Number(durationInput?.value || 0.5),
          )
          // Persists in the background — the canvas refresh is held while
          // the audition owns the junction, so the pick previews instantly.
          syncProject()
          renderCanvasBlockTimeline()
        }
        void replaySelectedAnimation()
      })
      return tile
    }),
  )
  hydrateJunctionFrames(transitionPopoverGrid)
  const popoverDurationSlot = $('#popover-duration-slot')
  popoverDurationSlot.replaceChildren(
    createRevealDurationControl(() => scene.id, 'frame'),
  )
  transitionPopover.hidden = false
  selectNode(scene.id, false)
  const openingFrame = FRAME_TRANSITION_OPTIONS.find(
    option => option.value === sceneFrameStyle(scene.id),
  )
  armMotionPreviewLoop(
    scene.id,
    `Frame · ${openingFrame?.label || 'Cut'}`,
    'realtime',
  )
  void replaySelectedAnimation()
  // A drawer that rises from the timeline: centred over the rail, sitting
  // just above it, so the spotlighted From/To chips stay in view below.
  const railRect = canvasBlockTimeline.getBoundingClientRect()
  const width = transitionPopover.offsetWidth
  const left = Math.max(
    12,
    Math.min(
      window.innerWidth - width - 12,
      railRect.left + railRect.width / 2 - width / 2,
    ),
  )
  transitionPopover.style.left = `${left}px`
  transitionPopover.style.bottom = `${window.innerHeight - railRect.top + 10}px`
}

document.addEventListener('click', event => {
  if (transitionPopover.hidden) return
  if (event.target instanceof Node && transitionPopover.contains(event.target))
    return
  closeTransitionPopover()
})

// ——— Junction thumbnails: real frames from A's tail into B's head ———
const boundaryFrameCache = new Map<string, string | null>()

const captureVideoFrame = (url: string, edge: 'first' | 'last') => {
  const cacheKey = `${url}#${edge}`
  const cached = boundaryFrameCache.get(cacheKey)
  if (cached !== undefined) return Promise.resolve(cached)
  return new Promise<string | null>(resolve => {
    let settled = false
    const video = document.createElement('video')
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      boundaryFrameCache.set(cacheKey, value)
      resolve(value)
    }
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.addEventListener('error', () => finish(null), { once: true })
    video.addEventListener(
      'loadedmetadata',
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        video.currentTime =
          edge === 'last' ? Math.max(0, duration - 0.15) : Math.min(0.05, duration)
      },
      { once: true },
    )
    video.addEventListener(
      'seeked',
      () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 160
          canvas.height = 90
          canvas.getContext('2d')?.drawImage(video, 0, 0, 160, 90)
          finish(canvas.toDataURL('image/jpeg', 0.72))
        } catch {
          finish(null)
        }
      },
      { once: true },
    )
    video.src = url
    window.setTimeout(() => finish(null), 4000)
  })
}

const sceneBoundaryVideoUrl = (scene: Scene) =>
  project.recordedBlocks?.[scene.id]?.videoUrl ||
  (scene.node.type === 'screenRecording' &&
  typeof scene.node.attrs?.src === 'string'
    ? scene.node.attrs.src
    : '')

// A stand-in built from the block's own colors, kind, and words — used for
// blocks that have no recorded footage to sample frames from.
const buildJunctionLayer = (scene: Scene) => {
  const layer = document.createElement('span')
  layer.className = 'junction-layer'
  const preset = scene.config.background.preset
  const base =
    preset === 'custom' ? scene.config.background.color : project.brand.background
  layer.style.background = `linear-gradient(135deg, ${base}, color-mix(in srgb, ${base} 52%, ${project.brand.primary}))`
  if (
    scene.node.type === 'image' &&
    typeof scene.node.attrs?.src === 'string' &&
    scene.node.attrs.src
  ) {
    layer.style.backgroundImage = `url("${scene.node.attrs.src}")`
    layer.classList.add('captured')
    return layer
  }
  const meta = TIMELINE_BLOCK_META[sceneVisualKind(scene)]
  const icon = document.createElement('b')
  icon.textContent = meta.icon
  const words = document.createElement('em')
  words.textContent = scene.title.slice(0, 18)
  layer.append(icon, words)
  const videoUrl = sceneBoundaryVideoUrl(scene)
  if (videoUrl) layer.dataset.captureUrl = videoUrl
  return layer
}

const createJunctionDemo = (
  fromScene: Scene,
  toScene: Scene,
  animationClass: string,
) => {
  const demo = document.createElement('span')
  demo.className = 'motion-demo junction-demo'
  demo.setAttribute('aria-hidden', 'true')
  const outgoing = buildJunctionLayer(fromScene)
  outgoing.classList.add('out')
  if (outgoing.dataset.captureUrl) outgoing.dataset.captureEdge = 'last'
  const incoming = buildJunctionLayer(toScene)
  incoming.classList.add('in', animationClass)
  if (incoming.dataset.captureUrl) incoming.dataset.captureEdge = 'first'
  demo.append(outgoing, incoming)
  return demo
}

const hydrateJunctionFrames = (root: HTMLElement) => {
  root
    .querySelectorAll<HTMLElement>('.junction-layer[data-capture-url]')
    .forEach(layer => {
      const url = layer.dataset.captureUrl || ''
      const edge = layer.dataset.captureEdge === 'last' ? 'last' : 'first'
      void captureVideoFrame(url, edge).then(frame => {
        if (!frame || !layer.isConnected) return
        layer.style.backgroundImage = `url("${frame}")`
        layer.classList.add('captured')
      })
    })
}

// ——— Guided finalize flow: walk every junction on the real video ———
const finalizeBar = $('#finalize-bar')
const finalizeTiles = $('#finalize-tiles')
let finalizeModeActive = false
let finalizeJunctionIndex = 0

const highlightCurrentJunction = () => {
  const finalizeTarget = finalizeModeActive
    ? scenes[finalizeJunctionIndex + 1]
    : undefined
  const targetIndex = finalizeTarget
    ? finalizeTarget.index
    : activeBoundarySceneIndex
  canvasBlockTimeline
    .querySelectorAll<HTMLElement>('.timeline-transition-node')
    .forEach(node => {
      node.classList.toggle(
        'current',
        targetIndex >= 0 && node.dataset.boundaryIndex === String(targetIndex),
      )
    })
  // Spotlight the pair the switchover connects: the outgoing and incoming
  // chips get From/To tags while everything else on the rail dims.
  const fromId = targetIndex > 0 ? scenes[targetIndex - 1]?.id : undefined
  const toId = targetIndex > 0 ? scenes[targetIndex]?.id : undefined
  canvasBlockTimeline.classList.toggle('junction-focus', Boolean(toId))
  canvasBlockTimeline
    .querySelectorAll<HTMLElement>('.canvas-timeline-block')
    .forEach(chip => {
      chip.classList.toggle(
        'junction-from',
        Boolean(fromId) && chip.dataset.timelineNodeId === fromId,
      )
      chip.classList.toggle(
        'junction-to',
        Boolean(toId) && chip.dataset.timelineNodeId === toId,
      )
    })
}

const renderFinalizeJunction = (playPreview: boolean) => {
  const junctionCount = scenes.length - 1
  const from = scenes[finalizeJunctionIndex]
  const to = scenes[finalizeJunctionIndex + 1]
  if (!from || !to) return
  const fromMeta = TIMELINE_BLOCK_META[sceneVisualKind(from)]
  const toMeta = TIMELINE_BLOCK_META[sceneVisualKind(to)]
  ;($('#finalize-step') as HTMLElement).textContent =
    `Junction ${finalizeJunctionIndex + 1} of ${junctionCount}`
  ;($('#finalize-pair') as HTMLElement).textContent =
    `${fromMeta.label} → ${toMeta.label}`
  const hasTake = Boolean(project.recordedBlocks?.[to.id]?.videoUrl)
  ;($('#finalize-note') as HTMLElement).hidden = !hasTake
  ;($('#finalize-next') as HTMLButtonElement).textContent =
    finalizeJunctionIndex >= junctionCount - 1 ? 'Continue →' : 'Next →'
  ;($('#finalize-back') as HTMLButtonElement).disabled =
    finalizeJunctionIndex === 0
  finalizeTiles.replaceChildren(
    ...FRAME_TRANSITION_OPTIONS.map(option => {
      const tile = document.createElement('button')
      tile.type = 'button'
      tile.className = `motion-tile${option.value === sceneFrameStyle(to.id) ? ' active' : ''}`
      tile.title = option.description
      const label = document.createElement('strong')
      label.textContent = option.label
      tile.append(
        createJunctionDemo(from, to, `junction-in-frame-${option.value}`),
        label,
      )
      tile.addEventListener('click', () => {
        finalizeTiles
          .querySelectorAll('.motion-tile')
          .forEach(item => item.classList.toggle('active', item === tile))
        armMotionPreviewLoop(to.id, `Frame · ${option.label}`, 'realtime')
        if (sceneFrameStyle(to.id) !== option.value) {
          const durationInput = $(
            '#finalize-duration-slot input',
          ) as HTMLInputElement | null
          setSceneFrameTransition(
            to.id,
            option.value,
            Number(durationInput?.value || 0.5),
          )
          syncProject()
          renderCanvasBlockTimeline()
        }
        void replaySelectedAnimation()
      })
      return tile
    }),
  )
  hydrateJunctionFrames(finalizeTiles)
  ;($('#finalize-duration-slot') as HTMLElement).replaceChildren(
    createRevealDurationControl(() => to.id, 'frame'),
  )
  selectNode(to.id, false)
  highlightCurrentJunction()
  if (playPreview) {
    const currentFrame = FRAME_TRANSITION_OPTIONS.find(
      option => option.value === sceneFrameStyle(to.id),
    )
    armMotionPreviewLoop(
      to.id,
      `Frame · ${currentFrame?.label || 'Cut'}`,
      'realtime',
    )
    void replaySelectedAnimation()
  }
}

const exitFinalizeMode = () => {
  finalizeModeActive = false
  finalizeBar.hidden = true
  playerShell.classList.remove('canvas-finalize-mode')
  stopMotionPreviewLoop()
  highlightCurrentJunction()
}

const enterFinalizeMode = () => {
  if (scenes.length < 2) {
    openPublishSummary()
    return
  }
  if (!playerShell.classList.contains('canvas-open')) openCanvasFullscreen()
  finalizeModeActive = true
  finalizeJunctionIndex = 0
  playerShell.classList.add('canvas-finalize-mode')
  finalizeBar.hidden = false
  renderFinalizeJunction(true)
}

;($('#finalize-next') as HTMLButtonElement).addEventListener('click', () => {
  if (finalizeJunctionIndex >= scenes.length - 2) {
    exitFinalizeMode()
    openPublishSummary()
    return
  }
  finalizeJunctionIndex += 1
  renderFinalizeJunction(true)
})
;($('#finalize-back') as HTMLButtonElement).addEventListener('click', () => {
  if (finalizeJunctionIndex === 0) return
  finalizeJunctionIndex -= 1
  renderFinalizeJunction(true)
})
;($('#finalize-replay') as HTMLButtonElement).addEventListener('click', () =>
  void replaySelectedAnimation(),
)
;($('#finalize-cancel') as HTMLButtonElement).addEventListener(
  'click',
  exitFinalizeMode,
)

let draggedBlockId = ''

// Reordering happens on the notebook document itself; configurations, notes,
// and recorded takes are keyed by stable node ID, so they travel with it.
const reorderBlock = (
  movingId: string,
  referenceId: string,
  placeBefore: boolean,
) => {
  if (movingId === referenceId) return
  const doc = editor.getJSON() as TiptapDocument
  const fromIndex = doc.content.findIndex(node => node.attrs?.id === movingId)
  if (fromIndex === -1) return
  const [node] = doc.content.splice(fromIndex, 1)
  const referenceIndex = doc.content.findIndex(
    item => item.attrs?.id === referenceId,
  )
  if (referenceIndex === -1) return
  const insertion = placeBefore ? referenceIndex : referenceIndex + 1
  doc.content.splice(insertion, 0, node)
  editor.commands.setContent(doc)
  selectNode(movingId, false)
  syncProject()
}

const clearDropMarkers = () => {
  document
    .querySelectorAll('.drop-before, .drop-after, .dragging')
    .forEach(element =>
      element.classList.remove('drop-before', 'drop-after', 'dragging'),
    )
}

const makeChipReorderable = (chip: HTMLElement, sceneId: string) => {
  chip.draggable = true
  chip.addEventListener('dragstart', event => {
    draggedBlockId = sceneId
    chip.classList.add('dragging')
    event.dataTransfer?.setData('text/plain', sceneId)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  })
  chip.addEventListener('dragend', () => {
    draggedBlockId = ''
    clearDropMarkers()
  })
  chip.addEventListener('dragover', event => {
    if (!draggedBlockId || draggedBlockId === sceneId) return
    event.preventDefault()
    const rect = chip.getBoundingClientRect()
    const before = event.clientX < rect.left + rect.width / 2
    chip.classList.toggle('drop-before', before)
    chip.classList.toggle('drop-after', !before)
  })
  chip.addEventListener('dragleave', () =>
    chip.classList.remove('drop-before', 'drop-after'),
  )
  chip.addEventListener('drop', event => {
    event.preventDefault()
    const movingId =
      draggedBlockId || event.dataTransfer?.getData('text/plain') || ''
    clearDropMarkers()
    if (!movingId || movingId === sceneId) return
    const rect = chip.getBoundingClientRect()
    const before = event.clientX < rect.left + rect.width / 2
    reorderBlock(movingId, sceneId, before)
    draggedBlockId = ''
  })
}

const renderNotebookTimeline = () => {
  const notebookTimeline = $('#notebook-timeline')
  const track = document.createElement('div')
  track.className = 'notebook-timeline-track'
  scenes.forEach(scene => {
    const isSelected = scene.id === selectedNodeId
    const visualKind = sceneVisualKind(scene)
    const meta = TIMELINE_BLOCK_META[visualKind]
    const recordedBlock = project.recordedBlocks?.[scene.id]
    const seconds = (recordedBlock?.durationMs || scene.durationSeconds * 1000) / 1000
    // Only surface a time the creator can stand behind: a saved recording, a
    // captured screen take, or a duration they set themselves. Untouched
    // type defaults stay silent here; the expanded rail shows the full plan.
    const isScreenCapture = scene.node.type === 'screenRecording'
    const isCustomDuration =
      scene.config.durationMs !==
      createDefaultBlockConfig(scene.id, scene.node).durationMs
    const showTime = Boolean(recordedBlock) || isScreenCapture || isCustomDuration
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = `notebook-timeline-chip timeline-kind-${visualKind}${
      isSelected ? ' active' : ''
    }${recordedBlock ? ' recorded' : ''}`
    chip.title = `${sceneObjectLabel(scene)} · ${scene.title}`
    chip.setAttribute('aria-current', isSelected ? 'true' : 'false')
    chip.setAttribute(
      'aria-label',
      `Block ${scene.index + 1}, ${sceneObjectLabel(scene)}, ${scene.title}${showTime ? `, ${formatTime(seconds)}` : ''}${recordedBlock ? ', saved recording' : ''}`,
    )
    const icon = document.createElement('span')
    icon.className = 'notebook-timeline-icon'
    icon.textContent = meta.icon
    if (recordedBlock) {
      const saved = document.createElement('em')
      saved.className = 'notebook-timeline-recorded'
      saved.title = 'This block has a saved recording'
      saved.textContent = '✓'
      icon.append(saved)
    }
    const copy = document.createElement('span')
    copy.className = 'notebook-timeline-copy'
    const kind = document.createElement('strong')
    kind.textContent = meta.label
    copy.append(kind)
    if (showTime) {
      const duration = document.createElement('time')
      duration.textContent = formatTime(seconds)
      duration.classList.toggle(
        'recorded-length',
        Boolean(recordedBlock) || isScreenCapture,
      )
      duration.title = recordedBlock
        ? 'Length of the saved recording'
        : isScreenCapture
          ? 'Length of the captured screen recording'
          : 'Scene duration you set for the export'
      copy.append(duration)
    }
    chip.append(icon, copy)
    chip.addEventListener('click', () => {
      // Focusing the editor would drop the caret after atom nodes and
      // re-select the following block, so only select and scroll.
      selectNode(scene.id, false)
      document.getElementById(scene.id)?.scrollIntoView({ block: 'center' })
    })
    makeChipReorderable(chip, scene.id)
    track.append(chip)
  })
  notebookTimeline.replaceChildren(track)
  notebookTimeline.hidden = scenes.length === 0
  const activeChip = track.querySelector<HTMLElement>(
    '.notebook-timeline-chip.active',
  )
  if (activeChip) {
    window.requestAnimationFrame(() => {
      // Only scroll when the chip is out of view: a scrollIntoView no-op
      // still cancels the notebook's in-flight smooth scroll to the block.
      const trackRect = track.getBoundingClientRect()
      const chipRect = activeChip.getBoundingClientRect()
      if (chipRect.left < trackRect.left || chipRect.right > trackRect.right) {
        activeChip.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    })
  }
}

const renderCanvasBlockTimeline = () => {
  canvasBlockTimeline.replaceChildren()
  const totalDuration = scenes.reduce(
    (duration, scene) => duration + scene.durationSeconds,
    0,
  )

  const heading = document.createElement('div')
  heading.className = 'canvas-timeline-heading'
  const headingLabel = document.createElement('strong')
  headingLabel.textContent = 'Story timeline'
  const headingMeta = document.createElement('span')
  headingMeta.textContent = `${scenes.length} blocks · ${formatTime(totalDuration)}`
  heading.append(headingLabel, headingMeta)

  const track = document.createElement('div')
  track.className = 'canvas-timeline-track'
  track.setAttribute('role', 'list')

  scenes.forEach(scene => {
    const button = document.createElement('button')
    const isSelected = scene.id === selectedNodeId
    button.type = 'button'
    const visualKind = sceneVisualKind(scene)
    const recordedBlock = project.recordedBlocks?.[scene.id]
    const meta = TIMELINE_BLOCK_META[visualKind]
    button.className = `canvas-timeline-block timeline-kind-${visualKind}${isSelected ? ' active' : ''}`
    button.dataset.timelineNodeId = scene.id
    button.dataset.timelineBlockType = visualKind
    button.setAttribute('role', 'listitem')
    button.setAttribute('aria-current', isSelected ? 'true' : 'false')
    button.setAttribute(
      'aria-label',
      `Block ${scene.index + 1}, ${sceneObjectLabel(scene)}, ${scene.title}, ${formatTime((recordedBlock?.durationMs || scene.durationSeconds * 1000) / 1000)}${recordedBlock ? ', saved recording' : ''}`,
    )
    button.style.flexGrow = String(Math.max(1, scene.durationSeconds))

    const top = document.createElement('span')
    top.className = 'canvas-timeline-block-top'
    const index = document.createElement('b')
    index.textContent = String(scene.index + 1).padStart(2, '0')
    const duration = document.createElement('time')
    duration.classList.toggle('recorded-length', Boolean(recordedBlock))
    duration.title = recordedBlock
      ? 'Length of the saved recording'
      : 'Planned scene duration in the export'
    duration.textContent = formatTime(
      (recordedBlock?.durationMs || scene.durationSeconds * 1000) / 1000,
    )
    top.append(index, duration)

    const body = document.createElement('span')
    body.className = 'canvas-timeline-block-body'
    const visual = document.createElement('span')
    visual.className = 'canvas-timeline-block-visual'
    const source = scene.node.attrs?.src
    if (visualKind === 'image' && typeof source === 'string' && source) {
      const image = document.createElement('img')
      image.src = source
      image.alt = ''
      visual.append(image)
    } else {
      visual.textContent = meta.icon
    }
    const copy = document.createElement('span')
    copy.className = 'canvas-timeline-block-copy'
    const type = document.createElement('span')
    type.className = 'canvas-timeline-block-type'
    type.textContent = meta.label
    if (recordedBlock) {
      button.classList.add('recorded')
      const saved = document.createElement('em')
      saved.className = 'canvas-timeline-recorded'
      saved.textContent = 'Recorded'
      type.append(saved)
      const savedBadge = document.createElement('em')
      savedBadge.className = 'notebook-timeline-recorded'
      savedBadge.title = 'This block has a saved recording'
      savedBadge.textContent = '✓'
      visual.append(savedBadge)
    }
    if (scene.presenterTracks.length) {
      const presenter = document.createElement('i')
      presenter.title = 'Recorded presenter'
      presenter.setAttribute('aria-label', 'Recorded presenter')
      type.append(presenter)
    }

    const title = document.createElement('strong')
    title.textContent = scene.title
    copy.append(type, title)
    body.append(visual, copy)
    button.append(top, body)
    // Selecting a recorded block shows its take directly on the canvas with
    // the video/content switch — no review dialog in the way.
    button.addEventListener('click', () => selectNode(scene.id, false))
    makeChipReorderable(button, scene.id)
    if (scene.index > 0) {
      // A CapCut-style boundary node between chips: filled when a frame
      // switchover into the right-hand block exists, hollow on a plain cut.
      const node = document.createElement('button')
      const frameStyle = scene.config.frameTransition?.style || 'cut'
      const hasTransition = frameStyle !== 'cut'
      const frameLabel =
        FRAME_TRANSITION_OPTIONS.find(option => option.value === frameStyle)
          ?.label || frameStyle
      node.type = 'button'
      node.dataset.boundaryIndex = String(scene.index)
      node.className = `timeline-transition-node${hasTransition ? ' set' : ''}`
      node.title = hasTransition
        ? `Frame switch: ${frameLabel} — click to change`
        : 'Add a frame switch between these blocks'
      node.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14l7-7-7-7Zm16 0-7 7 7 7V5Z"/></svg>'
      node.addEventListener('click', event => {
        event.stopPropagation()
        // The node toggles: first click opens the picker and starts the
        // audition, clicking it again closes both and restores the canvas.
        if (!transitionPopover.hidden && activeBoundarySceneIndex === scene.index) {
          closeTransitionPopover()
          return
        }
        openTransitionPopover(scene)
      })
      track.append(node)
    }
    if (scene.index > 0) {
      const previousScene = scenes[scene.index - 1]
      const swap = document.createElement('span')
      swap.className = 'canvas-timeline-swap'
      swap.setAttribute('role', 'button')
      swap.tabIndex = 0
      swap.title = 'Swap with the previous block'
      swap.setAttribute('aria-label', 'Swap with the previous block')
      swap.textContent = '⇄'
      swap.addEventListener('click', event => {
        event.stopPropagation()
        reorderBlock(scene.id, previousScene.id, true)
      })
      button.append(swap)
    }
    track.append(button)
  })

  canvasBlockTimeline.append(heading, track)
  renderNotebookTimeline()
  highlightCurrentJunction()
  const activeBlock = track.querySelector<HTMLElement>(
    '.canvas-timeline-block.active',
  )
  if (activeBlock) {
    // The rail is rebuilt on every selection, which resets its scroll; keep
    // the active block visible.
    window.requestAnimationFrame(() => {
      activeBlock.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
}

const renderSceneRail = () => {
  sceneRail.replaceChildren()
  scenes.forEach(scene => {
    const button = document.createElement('button')
    button.className = `scene-card${scene.id === selectedNodeId ? ' selected' : ''}`
    button.type = 'button'

    const top = document.createElement('div')
    top.className = 'scene-card-top'
    top.innerHTML = `<span>${String(scene.index + 1).padStart(2, '0')}</span><span>${scene.config.layout}</span>`
    const title = document.createElement('strong')
    title.textContent = scene.title
    const footer = document.createElement('footer')
    if (scene.presenterTracks.length) {
      const dot = document.createElement('span')
      dot.className = 'presenter-pill'
      footer.append(dot)
    }
    footer.append(document.createTextNode(scene.kind))
    button.append(top, title, footer)
    button.addEventListener('click', () => selectNode(scene.id, true))
    sceneRail.append(button)
  })
  renderCanvasBlockTimeline()
}


const positionInlinePreview = () => {
  const selectedNode = document.getElementById(selectedNodeId)
  if (!selectedNode) return
  const layoutTop = editorLayout.getBoundingClientRect().top
  const selectedTop = selectedNode.getBoundingClientRect().top
  inlinePreview.style.setProperty(
    '--preview-offset',
    `${Math.max(0, selectedTop - layoutTop)}px`,
  )
}

const createContentLayoutButton = (
  layout: SceneLayout,
  activeLayout: SceneLayout,
  visualKind?: 'image' | 'screen',
) => {
  const meta =
    (visualKind === 'image'
      ? IMAGE_LAYOUT_META[layout]
      : visualKind === 'screen'
        ? SCREEN_LAYOUT_META[layout]
        : undefined) || LAYOUT_META[layout]
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `layout-preset${layout === activeLayout ? ' active' : ''}`
  button.dataset.layoutOption = layout
  button.setAttribute('aria-pressed', String(layout === activeLayout))

  const thumb = document.createElement('span')
  thumb.className = `layout-thumb layout-thumb-${layout}${
    visualKind ? ` layout-thumb-media layout-thumb-${visualKind}` : ''
  }`
  for (let index = 0; index < meta.lines; index += 1) {
    thumb.append(document.createElement('i'))
  }
  const label = document.createElement('strong')
  label.textContent = meta.label
  const description = document.createElement('small')
  description.textContent = meta.description
  button.append(thumb, label, description)
  button.addEventListener('click', () => {
    updateSelectedConfig(config => {
      config.layout = layout
    })
  })
  return button
}

const createPresenterLayoutButton = (
  preset: (typeof PRESENTER_LAYOUT_PRESETS)[number],
  config: BlockRenderConfigV1,
  blockKind: ThemeBlockKind,
) => {
  const isActive =
    config.camera.mode === preset.mode &&
    config.camera.position === preset.position &&
    config.camera.shape === preset.shape
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `presenter-layout-preset${isActive ? ' active' : ''}`
  button.dataset.presenterLayout = preset.id
  button.dataset.presenterMode = preset.mode
  button.dataset.cameraPosition = preset.position
  button.dataset.cameraShape = preset.shape
  button.setAttribute('aria-label', preset.label)
  button.setAttribute('aria-pressed', String(isActive))

  const thumbnail = document.createElement('span')
  thumbnail.className = 'presenter-layout-thumb'
  const content = document.createElement('i')
  content.className = 'presenter-layout-content'
  const person = document.createElement('i')
  person.className = 'presenter-layout-person'
  const layoutGeometry = presenterLayoutGeometry(preset.mode, blockKind)
  if (preset.position === 'hidden') {
    content.style.cssText = 'left:7%;top:17%;right:7%;bottom:17%;width:auto;height:auto;'
    person.hidden = true
  } else if (layoutGeometry.content) {
    content.style.cssText = normalizedRectStyle(layoutGeometry.content)
  } else {
    content.hidden = true
  }
  person.style.cssText = normalizedRectStyle(layoutGeometry.camera)
  const personImage = document.createElement('img')
  personImage.src = selectedPreviewPresenter().url
  personImage.alt = ''
  person.append(personImage)
  thumbnail.append(content, person)
  const label = document.createElement('small')
  label.textContent = preset.label
  button.append(thumbnail, label)
  button.addEventListener('click', () => {
    updateSelectedConfig(blockConfig => {
      blockConfig.camera.mode = preset.mode
      blockConfig.camera.position = preset.position
      blockConfig.camera.shape = preset.shape
    })
  })
  return button
}

const renderLayoutPresetPicker = (
  scene: Scene,
  config: BlockRenderConfigV1,
) => {
  const contentGrid = $('#layout-preset-grid')
  const presenterGrid = $('#presenter-layout-grid')
  presenterGrid.dataset.blockKind = scene.kind
  contentGrid.replaceChildren()
  presenterGrid.replaceChildren()
  const presenterSelected = selectedCanvasObject === 'presenter'
  const visualKind = sceneVisualKind(scene)
  const mediaScope =
    visualKind === 'image'
      ? 'Image options'
      : visualKind === 'screen'
        ? 'Screen recording options'
        : null
  ;($('#content-layout-group') as HTMLElement).hidden = presenterSelected
  ;($('#presenter-layout-group') as HTMLElement).hidden = !presenterSelected
  ;($('#presenter-layout-group') as HTMLElement).classList.toggle(
    'presenter-layout-group-focused',
    presenterSelected,
  )
  ;($('#presenter-layout-heading') as HTMLElement).hidden = presenterSelected
  ;($('#director-layout-kicker') as HTMLElement).textContent = presenterSelected
    ? 'Human camera'
    : 'Content layout'
  ;($('#director-layout-title') as HTMLElement).textContent = presenterSelected
    ? 'Place the human'
    : `Compose the ${sceneObjectLabel(scene).toLowerCase()}`
  ;($('#director-layout-scope') as HTMLElement).textContent = presenterSelected
    ? `${PRESENTER_LAYOUT_PRESETS.length} options`
    : mediaScope || DIRECTOR_OPTIONS[scene.kind].label
  ;($('#director-layout-note') as HTMLElement).textContent = presenterSelected
    ? 'Keep the person visible while you choose framing and prominence.'
    : visualKind === 'image'
      ? 'Choose the image scale and crop. Place the person independently from the Presenter tab.'
      : visualKind === 'screen'
        ? 'Choose how much canvas the screen capture occupies. Place the person from the Presenter tab.'
        : 'Arrange the Markdown here. Choose whether and where a person appears from the Presenter tab.'
  ;($('#studio-preview-presenter-name') as HTMLElement).textContent =
    selectedPreviewPresenter().name

  DIRECTOR_OPTIONS[scene.kind].layouts.forEach(layout =>
    contentGrid.append(
      createContentLayoutButton(
        layout,
        config.layout,
        visualKind === 'image' || visualKind === 'screen'
          ? visualKind
          : undefined,
      ),
    ),
  )
  PRESENTER_LAYOUT_PRESETS.forEach(preset =>
    presenterGrid.append(createPresenterLayoutButton(preset, config, scene.kind)),
  )
}

const createStudioChoiceButton = <Value extends string>(
  option: CatalogOption<Value>,
  activeValue: string,
  onSelect: () => void,
  codeTheme = false,
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = option.value === activeValue ? 'active' : ''
  button.setAttribute('aria-pressed', String(option.value === activeValue))
  const glyph = document.createElement('span')
  glyph.className = 'studio-choice-glyph'
  if (codeTheme) {
    glyph.classList.add('studio-code-theme-swatch')
    glyph.style.background = CODE_THEME_SURFACES[option.value as ThemeCodeSyntax]
    glyph.style.color = option.glyph
    glyph.textContent = '{ }'
  } else {
    glyph.textContent = option.glyph
  }
  const copy = document.createElement('span')
  const label = document.createElement('strong')
  label.textContent = option.label
  const description = document.createElement('small')
  description.textContent = option.description
  copy.append(label, description)
  button.append(glyph, copy)
  button.addEventListener('click', onSelect)
  return button
}

const createPlacementChoiceButton = (
  option: CatalogOption<ThemeBlockLayout>,
  activeValue: ThemeBlockLayout,
  onSelect: () => void,
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = option.value === activeValue ? 'active' : ''
  button.setAttribute('aria-pressed', String(option.value === activeValue))

  const preview = document.createElement('span')
  preview.className = 'studio-placement-preview'
  preview.dataset.placement = option.value
  const content = document.createElement('i')
  preview.append(content)

  const copy = document.createElement('span')
  const label = document.createElement('strong')
  label.textContent = option.label
  const description = document.createElement('small')
  description.textContent = option.description
  copy.append(label, description)
  button.append(preview, copy)
  button.addEventListener('click', onSelect)
  return button
}

const renderStudioStyleControls = (
  scene: Scene,
  config: BlockRenderConfigV1,
) => {
  const visualKind = sceneVisualKind(scene)
  const isMediaBlock = visualKind === 'image' || visualKind === 'screen'
  const renderOptions = visualKind === 'image'
    ? IMAGE_RENDER_OPTIONS
    : visualKind === 'screen'
      ? SCREEN_RENDER_OPTIONS
      : BLOCK_RENDER_OPTIONS[scene.kind]
  const placementOptions = visualKind === 'image'
    ? IMAGE_PLACEMENT_OPTIONS
    : visualKind === 'screen'
      ? SCREEN_PLACEMENT_OPTIONS
      : BLOCK_LAYOUT_OPTIONS
  const placementGrid = $('#studio-placement-options')
  placementGrid.replaceChildren(
    ...placementOptions.map(option =>
      createPlacementChoiceButton(
        option,
        config.appearance.layout,
        () => updateSelectedConfig(blockConfig => {
          blockConfig.appearance.layout = option.value
          if (blockConfig.camera.mode === 'person-only') {
            blockConfig.camera.mode =
              option.value === 'right' || option.value === 'split-right'
                ? 'person-background-right'
                : 'person-background-left'
          }
        }),
      ),
    ),
  )
  const renderGrid = $('#studio-render-options')
  renderGrid.replaceChildren(
    ...renderOptions.map(option =>
      createStudioChoiceButton(
        option,
        config.appearance.render,
        () => updateSelectedConfig(blockConfig => {
          blockConfig.appearance.render = option.value
          if (isMediaBlock) {
            applyRecommendedMediaFrame(blockConfig, option.value)
          }
        }),
      ),
    ),
  )
  ;($('#studio-render-heading') as HTMLElement).textContent =
    `${isMediaBlock ? sceneObjectLabel(scene) : BLOCK_KIND_META[scene.kind].label.replace(' system', '')} rendering`
  const mediaFrameOptions = $('#studio-media-frame-options')
  mediaFrameOptions.hidden = !isMediaBlock
  if (isMediaBlock) {
    $('#studio-media-border-options').replaceChildren(
      ...MEDIA_BORDER_OPTIONS.map(option =>
        createStudioChoiceButton(
          option,
          config.mediaFrame.borderWidth,
          () => updateSelectedConfig(blockConfig => {
            blockConfig.mediaFrame.borderWidth = option.value
          }),
        ),
      ),
    )
    $('#studio-media-corner-options').replaceChildren(
      ...MEDIA_CORNER_OPTIONS.map(option =>
        createStudioChoiceButton(
          option,
          config.mediaFrame.corners,
          () => updateSelectedConfig(blockConfig => {
            blockConfig.mediaFrame.corners = option.value
          }),
        ),
      ),
    )
    $('#studio-media-elevation-options').replaceChildren(
      ...MEDIA_ELEVATION_OPTIONS.map(option =>
        createStudioChoiceButton(
          option,
          config.mediaFrame.elevation,
          () => updateSelectedConfig(blockConfig => {
            blockConfig.mediaFrame.elevation = option.value
          }),
        ),
      ),
    )
  }
  const codeOptions = $('#studio-code-options')
  codeOptions.hidden = scene.kind !== 'code'
  if (scene.kind === 'code') {
    const syntaxGrid = $('#studio-code-theme-options')
    syntaxGrid.replaceChildren(
      ...CODE_THEME_OPTIONS.map(option =>
        createStudioChoiceButton(
          option,
          config.appearance.codeTheme,
          () => updateSelectedConfig(blockConfig => {
            blockConfig.appearance.codeTheme = option.value
          }),
          true,
        ),
      ),
    )
    const codeMotionGrid = $('#studio-code-motion-options')
    codeMotionGrid.replaceChildren(
      ...CODE_ANIMATION_OPTIONS.map(option =>
        createStudioChoiceButton(
          option,
          config.appearance.codeAnimation,
          () => {
            replayAnimationOnReady = true
            updateSelectedConfig(blockConfig => {
              blockConfig.appearance.codeAnimation = option.value
            })
          },
        ),
      ),
    )
  }
  const motions = DIRECTOR_OPTIONS[scene.kind].animations.length
  const codeMultiplier = scene.kind === 'code'
    ? CODE_THEME_OPTIONS.length * CODE_ANIMATION_OPTIONS.length
    : 1
  const mediaMultiplier = isMediaBlock
    ? MEDIA_BORDER_OPTIONS.length *
      MEDIA_CORNER_OPTIONS.length *
      MEDIA_ELEVATION_OPTIONS.length
    : 1
  ;($('#director-style-count') as HTMLElement).textContent =
    `${placementOptions.length * renderOptions.length * motions * codeMultiplier * mediaMultiplier} combinations`
}

// A looping visual preview of an entrance motion — the tile language used by
// the director's transition tab and the publish walkthrough.
const createMotionDemo = (value: RevealStyle) => {
  const demo = document.createElement('span')
  demo.className = `motion-demo motion-demo-${value}`
  demo.setAttribute('aria-hidden', 'true')
  const barCount = value === 'line-by-line' ? 3 : 1
  for (let index = 0; index < barCount; index += 1) {
    demo.append(document.createElement('i'))
  }
  return demo
}

const renderStudioMotionControls = (
  scene: Scene,
  config: BlockRenderConfigV1,
) => {
  const available = DIRECTOR_OPTIONS[scene.kind].animations
  const container = $('#studio-motion-options')
  container.replaceChildren(
    createRevealDurationControl(() => scene.id),
    ...MOTION_OPTIONS.filter(option => available.includes(option.value)).map(
      option => {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.animationOption = option.value
        button.className = option.value === config.reveal ? 'active' : ''
        button.setAttribute('aria-pressed', String(option.value === config.reveal))
        const glyph = createMotionDemo(option.value)
        const copy = document.createElement('div')
        const label = document.createElement('strong')
        label.textContent = option.label
        const description = document.createElement('small')
        description.textContent = option.description
        copy.append(label, description)
        button.append(glyph, copy)
        button.addEventListener('click', () => {
          replayAnimationOnReady = true
          updateSelectedConfig(blockConfig => {
            blockConfig.reveal = option.value
          })
        })
        return button
      },
    ),
  )
}

const renderBackgroundPresets = (config: BlockRenderConfigV1) => {
  const grid = $('#background-preset-grid')
  grid.replaceChildren()
  grid.style.setProperty('--custom-background', config.background.color)
  BACKGROUND_PRESETS.filter(
    preset => preset.mode === selectedBackgroundMode,
  ).forEach(preset => {
    const button = document.createElement('button')
    const isActive = config.background.preset === preset.id
    button.type = 'button'
    button.className = isActive ? 'active' : ''
    button.dataset.backgroundPreset = preset.id
    button.setAttribute('aria-label', preset.label)
    button.setAttribute('aria-pressed', String(isActive))
    button.style.setProperty('--background-swatch', preset.swatch)
    button.innerHTML = '<span></span>'
    button.addEventListener('click', () => {
      updateSelectedConfig(blockConfig => {
        blockConfig.background.preset = preset.id
      })
    })
    grid.append(button)
  })
}

// Explainer blocks compose themselves — the diagram fills the frame and the
// agent owns its drawing — so prose layout presets and the Style tab's
// placement/text treatments are no-ops there. Hide them and say why;
// Presenter, Background and Transition still apply.
// The teleprompter mirrors the canvas step controls: the current step's
// spoken line — the same dialogue the notebook lists — always in view.
const syncExplainerTeleprompter = () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  const panel = $('#explainer-teleprompter') as HTMLElement
  if (!scene) {
    panel.hidden = true
    return
  }
  if (scene.node.type !== 'explainer') {
    // Ordinary blocks read their explanation — the same text the notebook
    // card and the recording coach edit.
    const notes = project.blocks[scene.id]?.speakerNotes?.trim() || ''
    panel.hidden = !notes
    if (!notes) return
    ;($('#teleprompter-step') as HTMLElement).textContent = 'script'
    ;($('#teleprompter-title') as HTMLElement).textContent = 'Explanation'
    ;($('#teleprompter-text') as HTMLElement).textContent = notes
    return
  }
  const plan = sanitizeExplainerPlan(
    scene.node.attrs?.plan as ExplainerPlanV1 | undefined,
    projectShapes(),
  )
  const step = Math.min(canvasExplainerStep, plan.steps.length - 1)
  panel.hidden = false
  ;($('#teleprompter-step') as HTMLElement).textContent =
    `${step + 1}/${plan.steps.length}`
  ;($('#teleprompter-title') as HTMLElement).textContent =
    plan.steps[step]?.title || ''
  ;($('#teleprompter-text') as HTMLElement).textContent =
    plan.steps[step]?.explanation || ''
}

const syncExplainerDirectorTabs = (scene: Scene) => {
  const isExplainer = scene.node.type === 'explainer'
  const styleTab = document.querySelector<HTMLButtonElement>(
    '[data-director-tab="style"]',
  )
  if (styleTab) {
    styleTab.hidden = isExplainer
    if (isExplainer && styleTab.classList.contains('active')) {
      document
        .querySelector<HTMLButtonElement>('[data-director-tab="layout"]')
        ?.click()
    }
  }
  const layoutGroup = $('#content-layout-group')
  layoutGroup.hidden = isExplainer
  let note = layoutGroup.parentElement?.querySelector<HTMLElement>(
    '.explainer-director-note',
  )
  if (!note && layoutGroup.parentElement) {
    note = document.createElement('p')
    note.className = 'director-section-note explainer-director-note'
    note.textContent =
      'Explainer blocks compose themselves — the diagram fills the frame and animates step by step. Direct the presenter, background and transition here; change the diagram itself with “Edit explainer” on the block.'
    layoutGroup.parentElement.insertBefore(note, layoutGroup)
  }
  if (note) note.hidden = !isExplainer
  syncExplainerTeleprompter()
}

const updateInspector = () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  const config = scene.config
  const directorOptions = DIRECTOR_OPTIONS[scene.kind]
  ;($('#selected-number') as HTMLElement).textContent = `Block ${String(
    scene.index + 1,
  ).padStart(2, '0')}`
  ;($('#selected-title') as HTMLElement).textContent = scene.title
  ;($('#selected-id') as HTMLElement).textContent = scene.id
  ;($('#selected-label') as HTMLElement).textContent = `Block ${String(
    scene.index + 1,
  ).padStart(2, '0')} · ${scene.title}`
  ;($('#layout') as HTMLSelectElement).value = config.layout
  ;($('#block-background') as HTMLSelectElement).value =
    config.background.preset
  ;($('#reveal') as HTMLSelectElement).value = config.reveal
  ;($('#alignment') as HTMLSelectElement).value = config.alignment
  ;($('#duration') as HTMLInputElement).value = String(config.durationMs / 1000)
  ;($('#duration-output') as HTMLOutputElement).value = `${(
    config.durationMs / 1000
  ).toFixed(1)}s`
  ;($('#camera-position') as HTMLSelectElement).value = config.camera.position
  ;($('#presenter-mode') as HTMLSelectElement).value = config.camera.mode
  ;($('#camera-shape') as HTMLSelectElement).value = config.camera.shape
  ;($('#block-background-color') as HTMLInputElement).value =
    config.background.color
  ;($('#remove-presenter') as HTMLButtonElement).disabled =
    scene.presenterTracks.length === 0
  ;($('#director-block-number') as HTMLElement).textContent = `Block ${String(
    scene.index + 1,
  ).padStart(2, '0')}`
  ;($('#director-animation-scope') as HTMLElement).textContent =
    directorOptions.label
  renderLayoutPresetPicker(scene, config)
  renderStudioStyleControls(scene, config)
  syncExplainerDirectorTabs(scene)
  renderStudioMotionControls(scene, config)
  renderBackgroundPresets(config)
  document
    .querySelectorAll<HTMLButtonElement>('[data-animation-option]')
    .forEach(button => {
      const isAvailable = directorOptions.animations.includes(
        button.dataset.animationOption as RevealStyle,
      )
      button.hidden = !isAvailable
      button.disabled = !isAvailable
      button.classList.toggle(
        'active',
        button.dataset.animationOption === config.reveal,
      )
    })
  document
    .querySelectorAll<HTMLButtonElement>('[data-alignment-option]')
    .forEach(button =>
      button.classList.toggle(
        'active',
        button.dataset.alignmentOption === config.alignment,
      ),
    )
  Array.from(($('#layout') as HTMLSelectElement).options).forEach(option => {
    option.disabled = !directorOptions.layouts.includes(
      option.value as SceneLayout,
    )
  })
  Array.from(($('#reveal') as HTMLSelectElement).options).forEach(option => {
    option.disabled = !directorOptions.animations.includes(
      option.value as RevealStyle,
    )
  })
  renderButton.disabled = scenes.length === 0
  renderButton.title = renderButton.disabled
    ? 'Add at least one block first'
    : 'Choose takes and transitions, then publish the MP4'
}

const selectNode = (nodeId: string, focusEditor: boolean) => {
  if (selectedNodeId !== nodeId) {
    stopScreenPlayback()
    selectedCanvasObject = 'content'
    recordedTakeCanvasView = 'video'
    // The saved-take review dialog belongs to the block it was opened for.
    if (!canvasRecordingReview.hidden) {
      canvasRecordingPlayback.pause()
      canvasRecordingReview.hidden = true
    }
  }
  selectedNodeId = nodeId
  refreshExplanations()
  document
    .querySelectorAll('.tiptap > .selected-block')
    .forEach(element => element.classList.remove('selected-block'))
  document.getElementById(nodeId)?.classList.add('selected-block')
  if (focusEditor) {
    const position = topLevelNodePosition(nodeId)
    if (position !== null) editor.commands.setTextSelection(position)
  }
  renderSceneRail()
  updateInspector()
  window.requestAnimationFrame(positionInlinePreview)
  const scene = scenes.find(item => item.id === nodeId)
  // While a switchover audition owns the canvas it also owns the parked
  // clock — re-seeking to the preview frame here would drag the runtime's
  // visibility stamps out of the switch overlap mid-audition.
  if (scene && motionPreviewLoopSceneId !== nodeId) {
    player.seek(scenePreviewTime(scene))
  }
  syncScreenPlaybackControl()
  attachLiveCameraToPlayer()
}

$('#editor').addEventListener('pointerdown', event => {
  let block = event.target as HTMLElement | null
  while (block?.parentElement && !block.parentElement.classList.contains('tiptap')) {
    block = block.parentElement
  }
  if (block?.id) {
    selectNode(block.id, false)
    if (!scenes.some(scene => scene.id === block?.id)) {
      playerLoading.hidden = false
      playerLoading.textContent = 'New block · start typing'
      scheduleSync()
    }
  }
})

const flushPreviewRequest = async () => {
  if (previewFetchInFlight || !pendingPreviewRequest) return
  const pending = pendingPreviewRequest
  pendingPreviewRequest = null
  previewFetchInFlight = true

  try {
    const preview = await fetchJson<{ url: string }>('/api/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        previewPresenter: pending.previewPresenter,
        includeEmptyNodeId: pending.includeEmptyNodeId,
        contentViewNodeId: pending.contentViewNodeId,
      }),
    })
    if (pending.requestNumber === previewRequest) {
      stopScreenPlayback()
      player.setAttribute('src', preview.url)
    }
  } catch (error) {
    if (pending.requestNumber !== previewRequest) return
    playerLoading.hidden = false
    playerLoading.textContent =
      error instanceof Error ? error.message : 'Could not compile project'
  } finally {
    previewFetchInFlight = false
    if (pendingPreviewRequest) {
      window.clearTimeout(previewFetchTimer)
      previewFetchTimer = window.setTimeout(flushPreviewRequest, 120)
    }
  }
}

let previewRefreshHeld = false

const updatePreview = () => {
  const requestNumber = ++previewRequest
  window.clearTimeout(previewFetchTimer)

  try {
    const previewPresenter = selectedPreviewPresenter()
    const contentViewNodeId =
      recordedTakeCanvasView === 'content' ? selectedNodeId : undefined
    const compiled = compileProject(project, {
      previewPresenter: {
        imageUrl: previewPresenter.url,
        name: previewPresenter.name,
      },
      includeEmptyNodeId: selectedNodeId,
      contentViewNodeId,
    })
    scenes = compiled.scenes

    if (!selectedNodeId || !scenes.some(scene => scene.id === selectedNodeId)) {
      selectedNodeId = scenes[0]?.id || ''
    }
    ;($('#block-count') as HTMLElement).textContent = `${scenes.length} ${
      scenes.length === 1 ? 'block' : 'blocks'
    }`
    ;($('#total-duration') as HTMLElement).textContent = formatTime(
      compiled.durationSeconds,
    )
    ;($('#timeline-duration') as HTMLElement).textContent = `${compiled.durationSeconds.toFixed(
      1,
    )} seconds`
    renderSceneRail()
    updateInspector()
    window.requestAnimationFrame(positionInlinePreview)

    if (motionPreviewLoopSceneId) {
      // A switchover audition owns the canvas: picks preview instantly by
      // overriding section styles, so hold the iframe refresh — a mid-loop
      // reload would blank the junction. Flushed when the loop stops.
      previewRefreshHeld = true
      pendingPreviewRequest = null
      return
    }
    playerLoading.hidden = false
    playerLoading.textContent = 'Compiling live canvas…'
    pendingPreviewRequest = {
      requestNumber,
      previewPresenter: {
        imageUrl: previewPresenter.url,
        name: previewPresenter.name,
      },
      includeEmptyNodeId: selectedNodeId,
      contentViewNodeId,
    }
    previewFetchTimer = window.setTimeout(flushPreviewRequest, 120)
  } catch (error) {
    pendingPreviewRequest = null
    playerLoading.hidden = false
    playerLoading.textContent =
      error instanceof Error ? error.message : 'Could not compile project'
  }
}

const syncProject = () => {
  setSaving(true)
  const notebook = editor.getJSON() as TiptapDocument
  ensureBlockConfiguration(notebook)
  project.notebook = notebook
  const stored = structuredClone(project)
  sanitizeNotebookMedia(stored.notebook)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  scheduleDatabaseSync()
  updatePreview()
  setSaving(false)
}

function scheduleSync() {
  setSaving(true)
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(syncProject, 120)
}

const updateSelectedConfig = (
  update: (config: BlockRenderConfigV1) => void,
) => {
  const config = project.blocks[selectedNodeId]
  if (!config) return
  update(config)
  syncProject()
}

const scenePreviewTime = (scene: Scene) =>
  scene.startSeconds + Math.max(0.05, scene.durationSeconds - 0.12)

const selectedPlayableRecordingScene = () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  return scene?.node.type === 'screenRecording' && scene.node.attrs?.src
    ? scene
    : undefined
}

const selectRecordedTake = (blockId: string, take: RecordedBlockV1) => {
  project.recordedBlocks ||= {}
  if (project.recordedBlocks[blockId]?.recordingId === take.recordingId) return
  project.recordedBlocks[blockId] = take
  renderCanvasBlockTimeline()
  syncProject()
  syncCanvasViewSwitch()
  const takes = project.recordedBlockTakes?.[blockId] || []
  const versionNumber =
    takes.findIndex(item => item.recordingId === take.recordingId) + 1
  showToast(`Take v${versionNumber} is now used for the final video`)
}

const renderTakeVersionPicker = (blockId: string) => {
  const takes = project.recordedBlockTakes?.[blockId] || []
  const active = project.recordedBlocks?.[blockId]
  canvasTakeVersions.replaceChildren()
  canvasTakeVersions.hidden = takes.length < 2
  if (takes.length < 2) return
  takes.forEach((take, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    const isActive = take.recordingId === active?.recordingId
    button.className = isActive ? 'active' : ''
    button.textContent = `v${index + 1}`
    button.title = isActive
      ? `Take v${index + 1} · used for the final video`
      : `Use take v${index + 1} (${formatTime(take.durationMs / 1000)}) for the final video`
    button.addEventListener('click', () => selectRecordedTake(blockId, take))
    canvasTakeVersions.append(button)
  })
}

const syncCanvasViewSwitch = () => {
  const recordedBlock = project.recordedBlocks?.[selectedNodeId]
  // While a frame-switch audition loops, the composition player IS the
  // canvas: the raw-take overlay would sit exactly on top of the junction
  // being previewed and swallow it. It returns when the picker closes.
  const showTakeVideo = Boolean(
    recordedBlock?.videoUrl &&
      recordedTakeCanvasView === 'video' &&
      !motionPreviewLoopSceneId,
  )
  renderTakeVersionPicker(selectedNodeId)
  // The saved take plays in its own video element so its transport is scoped
  // to the take (0:00–take length), not the whole story composition.
  if (showTakeVideo && recordedBlock) {
    if (canvasTakePlayer.getAttribute('src') !== recordedBlock.videoUrl) {
      canvasTakePlayer.setAttribute('src', recordedBlock.videoUrl)
    }
  } else {
    if (!canvasTakePlayer.paused) canvasTakePlayer.pause()
    if (!showTakeVideo && canvasTakePlayer.getAttribute('src')) {
      canvasTakePlayer.removeAttribute('src')
    }
  }
  canvasTakePlayer.hidden = !showTakeVideo
  canvasViewSwitch.hidden = !recordedBlock?.videoUrl
  // Redo lives in the record bar only when the block already has a take —
  // the keep-both-versions / replace choice arrives at save time.
  ;($('#redo-canvas-recording') as HTMLButtonElement).hidden =
    !recordedBlock?.videoUrl
  syncCanvasExplainerStepper()
  if (!recordedBlock?.videoUrl) return
  canvasViewVideoButton.classList.toggle(
    'active',
    recordedTakeCanvasView === 'video',
  )
  canvasViewContentButton.classList.toggle(
    'active',
    recordedTakeCanvasView === 'content',
  )
  canvasViewDownload.href = recordedBlock.videoUrl
}

const setRecordedTakeCanvasView = (view: 'video' | 'content') => {
  if (recordedTakeCanvasView === view) return
  recordedTakeCanvasView = view
  stopScreenPlayback()
  updatePreview()
  syncCanvasViewSwitch()
}

const syncScreenPlaybackControl = () => {
  const scene = selectedPlayableRecordingScene()
  // The composition transport (scrubber, pause, mute, volume) belongs to
  // screen-recording scenes; saved takes play in their own video element.
  if (scene) player.setAttribute('controls', '')
  else player.removeAttribute('controls')
  screenPlayToggle.hidden = !scene || !player.paused
  screenPlayToggle.setAttribute('aria-label', 'Play screen recording')
  screenPlayToggle.title = 'Play screen recording'
  syncCanvasViewSwitch()
}

const stopScreenPlayback = (seekToPreview = false) => {
  if (screenPlaybackWatcher) {
    player.removeEventListener('timeupdate', screenPlaybackWatcher)
    screenPlaybackWatcher = null
  }
  player.pause()
  const scene = selectedPlayableRecordingScene()
  if (seekToPreview && scene) {
    player.seek(scenePreviewTime(scene))
  }
  syncScreenPlaybackControl()
}

screenPlayToggle.addEventListener('click', () => {
  const scene = selectedPlayableRecordingScene()
  if (!scene) return

  window.clearTimeout(animationPreviewTimer)
  player.pause()
  const sceneEnd = scene.startSeconds + scene.durationSeconds
  // Resume a position paused inside the scene; restart from the top when the
  // canvas is parked on the preview frame (scenePreviewTime, near the end).
  if (
    player.currentTime < scene.startSeconds ||
    player.currentTime >= sceneEnd - 0.5
  ) {
    player.seek(scene.startSeconds)
  }
  if (screenPlaybackWatcher) {
    player.removeEventListener('timeupdate', screenPlaybackWatcher)
  }
  screenPlaybackWatcher = () => {
    if (!player.paused && player.currentTime >= sceneEnd - 0.05) {
      stopScreenPlayback(true)
    }
  }
  player.addEventListener('timeupdate', screenPlaybackWatcher)
  try {
    player.play()
  } catch (error) {
    stopScreenPlayback()
    console.error('Could not play the recording', error)
  }
  syncScreenPlaybackControl()
})

player.addEventListener('play', syncScreenPlaybackControl)
player.addEventListener('pause', syncScreenPlaybackControl)

// The player element toggles play/pause on any bare click. The directing
// canvas parks 0.12s before the selected scene ends, so an accidental click
// would immediately play into the next block. Swallow bare-canvas clicks
// before they reach the player; clicks on its transport chrome pass through.
player.parentElement?.addEventListener(
  'click',
  event => {
    if (event.target !== player) return
    const clickedTransport = event
      .composedPath()
      .some(
        element =>
          element instanceof HTMLElement &&
          element.classList.contains('hfp-controls'),
      )
    if (!clickedTransport) event.stopPropagation()
  },
  true,
)

;($('#close-transition-popover') as HTMLButtonElement).addEventListener(
  'click',
  closeTransitionPopover,
)

canvasViewVideoButton.addEventListener('click', () =>
  setRecordedTakeCanvasView('video'),
)
canvasViewContentButton.addEventListener('click', () =>
  setRecordedTakeCanvasView('content'),
)

let motionPreviewLabel = ''
let motionPreviewLoopSceneId = ''

const setMotionPreviewBadge = (text: string) => {
  const badge = $('#motion-preview-badge')
  if (!text) {
    badge.hidden = true
    return
  }
  ;($('#motion-preview-label') as HTMLElement).textContent = text
  badge.hidden = false
}

// Entrances finish in under a second at full speed, which makes styles hard
// to tell apart — preview replays run slowed down so each motion is legible.
const PREVIEW_PLAYBACK_RATE = 0.45

const REVEAL_DEFAULT_SECONDS: Record<RevealStyle, number> = {
  none: 0.2,
  fade: 0.65,
  rise: 0.75,
  fall: 0.75,
  'slide-left': 0.78,
  'slide-right': 0.78,
  scale: 0.72,
  blur: 0.82,
  type: 1.2,
  wipe: 0.82,
  pop: 0.72,
  'line-by-line': 0.48,
}

// Frame switchovers: how the whole video frame hands over between two
// blocks — distinct from content motion, which animates the words inside.
const FRAME_TRANSITION_OPTIONS: Array<{
  value: FrameTransitionStyle
  label: string
  description: string
}> = [
  { value: 'cut', label: 'Cut', description: 'Instant switch, no motion' },
  { value: 'crossfade', label: 'Crossfade', description: 'Dissolve into the next frame' },
  { value: 'slide-left', label: 'Push left', description: 'Next frame pushes in from the right' },
  { value: 'slide-right', label: 'Push right', description: 'Next frame pushes in from the left' },
  { value: 'slide-up', label: 'Push up', description: 'Next frame rises over this one' },
  { value: 'wipe', label: 'Wipe', description: 'An edge sweeps the new frame in' },
  { value: 'zoom', label: 'Zoom', description: 'Next frame settles from a zoom' },
]

const sceneFrameStyle = (sceneId: string): FrameTransitionStyle =>
  project.blocks[sceneId]?.frameTransition?.style || 'cut'

const setSceneFrameTransition = (
  sceneId: string,
  style: FrameTransitionStyle,
  durationSeconds: number,
) => {
  const config = project.blocks[sceneId]
  if (!config) return
  config.frameTransition = { style, durationSeconds }
}

// Duration is what makes a transition perceptible — every picker carries the
// same slider, and changes recompile the export-real composition.
const createRevealDurationControl = (
  getSceneId: () => string,
  kind: 'reveal' | 'frame' = 'reveal',
) => {
  const wrap = document.createElement('div')
  wrap.className = 'transition-duration'
  const label = document.createElement('label')
  label.textContent = kind === 'frame' ? 'Switch duration' : 'Duration'
  const output = document.createElement('output')
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0.2'
  slider.max = kind === 'frame' ? '1.5' : '3'
  slider.step = '0.1'
  const config = project.blocks[getSceneId()]
  const initial =
    kind === 'frame'
      ? config?.frameTransition?.durationSeconds || 0.5
      : config?.revealDurationSeconds ||
        REVEAL_DEFAULT_SECONDS[config?.reveal || 'fade'] ||
        0.7
  slider.value = String(Math.min(Number(slider.max), Math.max(0.2, initial)))
  const syncOutput = () => {
    output.textContent = `${Number(slider.value).toFixed(1)}s`
  }
  syncOutput()
  slider.addEventListener('input', syncOutput)
  slider.addEventListener('change', () => {
    const target = project.blocks[getSceneId()]
    if (!target) return
    if (kind === 'frame') {
      setSceneFrameTransition(
        getSceneId(),
        sceneFrameStyle(getSceneId()),
        Number(slider.value),
      )
    } else {
      target.revealDurationSeconds = Number(slider.value)
    }
    scheduleSync()
    if (motionPreviewLoopSceneId === getSceneId()) {
      if (kind === 'frame') {
        // New length auditions immediately — the sweep restarts with it.
        void replaySelectedAnimation()
      } else {
        setMotionPreviewBadge(`Preparing ${slider.value}s timing…`)
        replayAnimationOnReady = true
      }
    }
  })
  label.append(output)
  wrap.append(label, slider)
  return wrap
}

// While a transition picker is open, the junction keeps looping on the main
// canvas — the loop is disarmed when the picker closes or the focus moves.
const armMotionPreviewLoop = (
  sceneId: string,
  label: string,
  paced: 'realtime' | 'slow-mo' = 'slow-mo',
) => {
  motionPreviewLoopSceneId = sceneId
  motionPreviewLabel = `Previewing · ${label}${paced === 'slow-mo' ? ' · slow-mo' : ''}`
  playerShell.classList.add('transition-preview-active')
  syncCanvasViewSwitch()
}

const stopMotionPreviewLoop = () => {
  motionPreviewLoopSceneId = ''
  motionPreviewLabel = ''
  if (activeFrameAudition) {
    killFrameAudition()
    const scene = scenes.find(item => item.id === selectedNodeId)
    if (scene) player.seek(scenePreviewTime(scene))
  }
  player.playbackRate = 1
  playerShell.classList.remove('transition-preview-active')
  setMotionPreviewBadge('')
  window.clearTimeout(animationPreviewTimer)
  syncCanvasViewSwitch()
  if (previewRefreshHeld) {
    // Picks made during the audition changed the composition — compile and
    // load the real thing now that the loop no longer owns the canvas.
    previewRefreshHeld = false
    updatePreview()
  }
}

// Read the live block config, not the scene snapshot: picks made while the
// drawer is open mutate project.blocks and must audition immediately.
const sceneFrameSeconds = (sceneId: string) => {
  const frame = project.blocks[sceneId]?.frameTransition
  if (!frame || frame.style === 'cut') return 0
  return Math.min(1.5, Math.max(0.2, frame.durationSeconds || 0.5))
}

type FrameAuditionHandle = { kill: () => void }

type CompositionTimelineHandle = {
  time: (value?: number) => unknown
  seek?: (value: number, suppressEvents?: boolean) => unknown
  progress?: (value?: number, suppressEvents?: boolean) => unknown
  render?: (value: number, suppressEvents?: boolean, force?: boolean) => unknown
}

const compositionTimeline = () => {
  const compositionWindow = player.iframeElement?.contentWindow as
    | (Window & {
        __timelines?: Record<string, CompositionTimelineHandle>
      })
    | null
    | undefined
  return compositionWindow?.__timelines?.[project.id]
}

let activeFrameAudition: FrameAuditionHandle | null = null

const killFrameAudition = () => {
  activeFrameAudition?.kill()
  activeFrameAudition = null
}

// Frame switchovers can't be auditioned by simply playing across the
// boundary: the runtime clock gates on media buffering right at a junction
// and can jump clean over the whole switch window, which reads as a plain
// cut. So the player is parked inside the overlap — where the runtime keeps
// both frames visible — and the switch segment is driven on the
// composition's GSAP timeline directly: smooth, deterministic, export-true.
const auditionFrameSwitchover = (scene: Scene, frameSeconds: number) => {
  const timeline = compositionTimeline()
  const compositionDoc = player.iframeElement?.contentDocument
  const outgoingSection = compositionDoc?.querySelector<HTMLElement>(
    `#scene-${scene.index - 1}`,
  )
  const incomingSection = compositionDoc?.querySelector<HTMLElement>(
    `#scene-${scene.index}`,
  )
  if (!timeline || !outgoingSection || !incomingSection) return false
  player.pause()
  if (motionPreviewLabel) setMotionPreviewBadge(motionPreviewLabel)
  const parkAt = scene.startSeconds + frameSeconds / 2
  const leadSeconds = Math.min(0.6, scene.startSeconds)
  const from = scene.startSeconds - leadSeconds
  const to = scene.startSeconds + frameSeconds + 0.4
  // Picks audition instantly: the style is read from the live config and the
  // two sections' frame-level styles are written directly every frame,
  // replacing whatever tween the (possibly stale, refresh-held) composition
  // was compiled with. The compiled export uses the same math.
  const overrideStyle = sceneFrameStyle(scene.id)
  const heldTakeVideos = Array.from(
    outgoingSection.querySelectorAll<HTMLElement>('video.recorded-take'),
  )
  // The player adapter re-stamps the timeline to its own parked clock every
  // frame — racing it paints the compiled composition's mid-switch state on
  // half the frames. While the audition owns the junction, external writes
  // to the timeline are swallowed; the driver keeps the only real setter,
  // and stamps with a forced render so GSAP's lazy queue can never repaint
  // the compiled state after the override on the iframe's own ticker.
  const realTime = timeline.time.bind(timeline)
  const realSeek = timeline.seek?.bind(timeline)
  const realProgress = timeline.progress?.bind(timeline)
  const realRender = timeline.render?.bind(timeline)
  const stampTime = (value: number) => {
    if (realRender) realRender(value, true, true)
    else realTime(value)
  }
  timeline.time = value => (value === undefined ? realTime() : timeline)
  if (realSeek) timeline.seek = () => timeline
  if (realProgress)
    timeline.progress = value =>
      value === undefined ? realProgress() : timeline
  if (realRender) timeline.render = () => timeline
  const restoreTimelineControl = () => {
    timeline.time = realTime
    if (realSeek) timeline.seek = realSeek
    if (realProgress) timeline.progress = realProgress
    if (realRender) timeline.render = realRender
  }
  const easedProgress = (linear: number) =>
    linear <= 0
      ? 0
      : linear >= 1
        ? 1
        : linear < 0.5
          ? 2 * linear * linear
          : 1 - (-2 * linear + 2) ** 2 / 2
  // Override styles are written with !important: the runtime's visibility
  // stamps and GSAP's tween renders both write normal-priority inline
  // styles, so the audition's writes win every paint no matter who writes
  // last in a frame.
  const own = (element: HTMLElement, property: string, value: string) =>
    element.style.setProperty(property, value, 'important')
  const release = (element: HTMLElement, ...properties: string[]) => {
    for (const property of properties) element.style.removeProperty(property)
  }
  const clearFrameOverride = () => {
    for (const section of [outgoingSection, incomingSection]) {
      release(
        section,
        'transform',
        'opacity',
        'clip-path',
        'filter',
        'visibility',
        'display',
      )
    }
    for (const video of heldTakeVideos) release(video, 'visibility')
  }
  const applyFrameOverride = (positionSeconds: number) => {
    const p = easedProgress(
      (positionSeconds - scene.startSeconds) / frameSeconds,
    )
    // The audition owns every channel a frame tween can write — visibility,
    // transform, opacity, clip-path — on both sections, every frame, with
    // neutral defaults. Owning only the audited style's channel would let a
    // differently-styled compiled tween paint through the released ones.
    for (const section of [outgoingSection, incomingSection]) {
      own(section, 'visibility', 'visible')
      release(section, 'display')
      own(section, 'transform', 'none')
      own(section, 'opacity', '1')
      own(section, 'clip-path', 'none')
      own(section, 'filter', 'none')
    }
    for (const video of heldTakeVideos) own(video, 'visibility', 'visible')
    if (overrideStyle === 'crossfade') {
      own(incomingSection, 'opacity', String(p))
      own(outgoingSection, 'opacity', String(1 - p))
    } else if (overrideStyle === 'slide-left') {
      own(incomingSection, 'transform', `translateX(${(1 - p) * 100}%)`)
      own(outgoingSection, 'transform', `translateX(${-p * 100}%)`)
    } else if (overrideStyle === 'slide-right') {
      own(incomingSection, 'transform', `translateX(${-(1 - p) * 100}%)`)
      own(outgoingSection, 'transform', `translateX(${p * 100}%)`)
    } else if (overrideStyle === 'slide-up') {
      own(incomingSection, 'transform', `translateY(${(1 - p) * 100}%)`)
      own(outgoingSection, 'transform', `translateY(${-p * 100}%)`)
    } else if (overrideStyle === 'wipe') {
      own(incomingSection, 'clip-path', `inset(0 ${(1 - p) * 100}% 0 0)`)
      own(
        incomingSection,
        'filter',
        `drop-shadow(6px 0px 0px rgba(255,255,255,${(0.9 * (1 - p)).toFixed(3)})) drop-shadow(42px 0px 44px rgba(0,0,0,${(0.55 * (1 - p)).toFixed(3)}))`,
      )
    } else if (overrideStyle === 'zoom') {
      own(incomingSection, 'opacity', String(p))
      own(incomingSection, 'transform', `scale(${1.12 - 0.12 * p})`)
      own(outgoingSection, 'opacity', String(1 - p))
    }
  }
  // The driver starts synchronously, before any parking or media gating: it
  // stamps the timeline and both sections' styles every frame, which is the
  // only reliable way to out-write the runtime adapter — a paused wait here
  // would leave the canvas resting on the compiled composition's parked,
  // mid-switch frame for the whole settle window.
  // The sweep is paced by the display: a requestAnimationFrame pump renders
  // a vsync-aligned frame each tick, and a coarse timer backstop keeps the
  // segment moving in contexts that throttle rAF (composition iframes,
  // embedded panes). Position derives from the wall clock, so extra calls
  // only add frames — they never change the speed.
  //
  // The driver runs continuously — sweep, hold on the arrived frame,
  // restart — and never leaves an idle gap: the player runtime occasionally
  // re-stamps the timeline to its parked (mid-switch) clock, and an owned
  // timeline overwrites that within a frame instead of letting it rest on a
  // half-and-half frame or yank a sweep boundary around.
  let cancelled = false
  let last = performance.now()
  let position = from
  let holdUntil = 0
  const stop = () => {
    cancelled = true
    window.clearInterval(backstop)
    restoreTimelineControl()
    clearFrameOverride()
    if (activeFrameAudition === handle) activeFrameAudition = null
  }
  const step = () => {
    if (cancelled) return
    if (motionPreviewLoopSceneId !== scene.id) {
      stop()
      return
    }
    const now = performance.now()
    if (holdUntil) {
      stampTime(to)
      applyFrameOverride(to)
      if (now < holdUntil) return
      holdUntil = 0
      position = from
      last = now
      stampTime(from)
      applyFrameOverride(from)
      return
    }
    // Cap the advance per rendered frame: after a main-thread hitch the
    // sweep resumes from where it paused instead of leaping to where the
    // wall clock says it should be — a brief hold reads fine, a jump never.
    // The sweep runs in real time — what the export will look like.
    position += Math.min(now - last, 80) / 1000
    last = now
    const shown = Math.min(position, to)
    stampTime(shown)
    applyFrameOverride(shown)
    if (position >= to) holdUntil = now + 650
  }
  const backstop = window.setInterval(step, 40)
  const pump = () => {
    if (cancelled) return
    step()
    window.requestAnimationFrame(pump)
  }
  const handle = { kill: stop }
  activeFrameAudition = handle
  stampTime(from)
  applyFrameOverride(from)
  window.requestAnimationFrame(pump)
  // Parking and media readiness improve the sweep but never block it: the
  // seek keeps the runtime's visibility stamps inside the overlap, and the
  // gates warm the junction's media so its first decode can't hitch a sweep.
  if (Math.abs(player.currentTime - parkAt) > 0.2) {
    player.seek(parkAt)
    const junctionSelector = (tag: string) =>
      `#scene-${scene.index} ${tag}, #scene-${scene.index - 1} ${tag}`
    void (async () => {
      const settleDeadline = Date.now() + 1600
      while (
        !cancelled &&
        Date.now() < settleDeadline &&
        Math.abs(player.currentTime - parkAt) > 0.2
      ) {
        await new Promise(resolve => window.setTimeout(resolve, 120))
      }
      const mediaDeadline = Date.now() + 1200
      const junctionVideos = () =>
        Array.from(
          player.iframeElement?.contentDocument?.querySelectorAll<HTMLVideoElement>(
            junctionSelector('video'),
          ) || [],
        )
      while (
        !cancelled &&
        Date.now() < mediaDeadline &&
        junctionVideos().some(video => video.readyState < 2)
      ) {
        await new Promise(resolve => window.setTimeout(resolve, 120))
      }
      await Promise.race([
        Promise.all(
          Array.from(
            player.iframeElement?.contentDocument?.querySelectorAll<HTMLImageElement>(
              junctionSelector('img'),
            ) || [],
          ).map(image => image.decode().catch(() => undefined)),
        ),
        new Promise(resolve => window.setTimeout(resolve, 600)),
      ])
    })()
  }
  return true
}

const replaySelectedAnimation = async () => {
  stopScreenPlayback()
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  window.clearTimeout(animationPreviewTimer)
  killFrameAudition()
  const frameSeconds = scene.index > 0 ? sceneFrameSeconds(scene.id) : 0
  if (motionPreviewLoopSceneId === scene.id && frameSeconds > 0) {
    if (auditionFrameSwitchover(scene, frameSeconds)) return
  }
  player.pause()
  const previewing = Boolean(motionPreviewLabel)
  const previewRate =
    previewing && motionPreviewLabel.includes('slow-mo')
      ? PREVIEW_PLAYBACK_RATE
      : 1
  if (previewing) setMotionPreviewBadge(motionPreviewLabel)
  player.playbackRate = previewing ? previewRate : 1
  // Start just before the boundary so the previous block's tail is visible
  // and the entrance reads as a transition between the two.
  const leadInSeconds = Math.min(0.7, scene.startSeconds)
  player.seek(scene.startSeconds - leadInSeconds)
  await player.play()
  const entranceMilliseconds =
    (scene.config.revealDurationSeconds || 1) * 1000
  const shownMilliseconds =
    leadInSeconds * 1000 +
    Math.max(
      Math.min(2200, Math.max(900, scene.durationSeconds * 450)),
      entranceMilliseconds + 500,
    )
  animationPreviewTimer = window.setTimeout(
    () => {
      player.playbackRate = 1
      player.pause()
      player.seek(scenePreviewTime(scene))
      if (
        motionPreviewLoopSceneId &&
        motionPreviewLoopSceneId === selectedNodeId
      ) {
        animationPreviewTimer = window.setTimeout(
          () => void replaySelectedAnimation(),
          650,
        )
        return
      }
      setMotionPreviewBadge('')
      motionPreviewLabel = ''
      playerShell.classList.remove('transition-preview-active')
    },
    previewing ? shownMilliseconds / previewRate : shownMilliseconds,
  )
}

document
  .querySelectorAll<HTMLButtonElement>('[data-director-tab]')
  .forEach(button => {
    button.addEventListener('click', () => {
      const selectedTab = button.dataset.directorTab
      if (selectedTab === 'presenter') selectedCanvasObject = 'presenter'
      if (selectedTab === 'layout' || selectedTab === 'style') {
        selectedCanvasObject = 'content'
      }
      document
        .querySelectorAll<HTMLButtonElement>('[data-director-tab]')
        .forEach(tab => {
          const isActive = tab === button
          tab.classList.toggle('active', isActive)
          tab.setAttribute('aria-selected', String(isActive))
        })
      ;($('#director-layout') as HTMLElement).hidden =
        selectedTab !== 'layout' && selectedTab !== 'presenter'
      ;($('#director-style') as HTMLElement).hidden = selectedTab !== 'style'
      ;($('#director-background') as HTMLElement).hidden =
        selectedTab !== 'background'
      ;($('#director-animation') as HTMLElement).hidden =
        selectedTab !== 'animation'
      updateInspector()
    })
  })

document
  .querySelectorAll<HTMLButtonElement>('[data-background-mode]')
  .forEach(button => {
    button.addEventListener('click', () => {
      selectedBackgroundMode = button.dataset.backgroundMode as
        | 'gradient'
        | 'color'
      document
        .querySelectorAll<HTMLButtonElement>('[data-background-mode]')
        .forEach(modeButton => {
          const isActive = modeButton === button
          modeButton.classList.toggle('active', isActive)
          modeButton.setAttribute('aria-selected', String(isActive))
        })
      const config = project.blocks[selectedNodeId]
      if (config) renderBackgroundPresets(config)
    })
  })

;($('#block-background-color') as HTMLInputElement).addEventListener(
  'input',
  event => {
    updateSelectedConfig(config => {
      config.background.color = (event.currentTarget as HTMLInputElement).value
      config.background.preset = 'custom'
    })
  },
)

;($('#use-brand-background') as HTMLButtonElement).addEventListener(
  'click',
  () => {
    updateSelectedConfig(config => {
      config.background.preset = 'brand'
    })
  },
)

document
  .querySelectorAll<HTMLButtonElement>('[data-alignment-option]')
  .forEach(button => {
    button.addEventListener('click', () => {
      updateSelectedConfig(config => {
        config.alignment = button.dataset.alignmentOption as 'left' | 'center'
      })
    })
  })

;($('#replay-animation') as HTMLButtonElement).addEventListener('click', () => {
  void replaySelectedAnimation()
})

const updateToolbar = () => {
  const active: Record<string, boolean> = {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    h1: editor.isActive('heading', { level: 1 }),
    h2: editor.isActive('heading', { level: 2 }),
    bulletList: editor.isActive('bulletList'),
    blockquote: editor.isActive('blockquote'),
    codeBlock: editor.isActive('codeBlock'),
  }
  document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => {
    button.classList.toggle('active', Boolean(active[button.dataset.command || '']))
  })
}

document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => {
  button.addEventListener('click', () => {
    const chain = editor.chain().focus()
    switch (button.dataset.command) {
      case 'bold':
        chain.toggleBold().run()
        break
      case 'italic':
        chain.toggleItalic().run()
        break
      case 'h1':
        chain.toggleHeading({ level: 1 }).run()
        break
      case 'h2':
        chain.toggleHeading({ level: 2 }).run()
        break
      case 'bulletList':
        chain.toggleBulletList().run()
        break
      case 'blockquote':
        chain.toggleBlockquote().run()
        break
      case 'codeBlock':
        chain.toggleCodeBlock().run()
        break
    }
  })
})

player.addEventListener('ready', () => {
  playerLoading.hidden = true
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (scene && replayAnimationOnReady) {
    replayAnimationOnReady = false
    void replaySelectedAnimation()
  } else if (scene) {
    player.seek(scenePreviewTime(scene))
  }
  attachLiveCameraToPlayer()
})
player.addEventListener('error', event => {
  stopScreenPlayback()
  const detail = (event as unknown as CustomEvent<{ message?: string }>).detail
  playerLoading.hidden = false
  playerLoading.textContent = detail?.message || 'Hyperframes preview failed'
})

const openInspector = () => {
  inspectorPanel.classList.add('open')
  inspectorPanel.setAttribute('aria-hidden', 'false')
}

const closeInspector = () => {
  inspectorPanel.classList.remove('open')
  inspectorPanel.setAttribute('aria-hidden', 'true')
}

const openCanvasFullscreen = () => {
  if (canvasRecorder?.state === 'recording') return
  const isOpen = playerShell.classList.toggle('canvas-open')
  if (!isOpen) stopLiveCamera()
  if (!isOpen && finalizeModeActive) exitFinalizeMode()
  // Transition auditioning is a canvas-mode activity: leaving the canvas
  // closes the picker and stops the loop, so the notebook's side-panel
  // preview never plays a switchover audition.
  if (!isOpen) closeTransitionPopover()
  document.body.classList.toggle('canvas-is-open', isOpen)
  const fullscreenButton = $('#canvas-fullscreen') as HTMLButtonElement
  fullscreenButton.textContent = isOpen ? '×' : '↗'
  fullscreenButton.setAttribute(
    'aria-label',
    isOpen ? 'Close full-screen canvas' : 'Open canvas full screen',
  )
  syncLiveCameraToggle()
}

;($('#director-toggle') as HTMLButtonElement).addEventListener('click', () => {
  const collapsed = playerShell.classList.toggle('director-collapsed')
  const toggle = $('#director-toggle') as HTMLButtonElement
  toggle.setAttribute('aria-expanded', String(!collapsed))
  toggle.title = collapsed
    ? 'Expand the director panel'
    : 'Collapse the panel — see the full canvas and timeline'
  toggle.setAttribute(
    'aria-label',
    collapsed ? 'Expand the director panel' : 'Collapse the director panel',
  )
})

liveCameraToggle.addEventListener('click', async () => {
  if (liveCameraStream) {
    stopLiveCamera()
    showToast('Live camera preview stopped')
    return
  }
  try {
    await startLiveCamera()
    showToast('Live camera is visible in the selected layout')
  } catch (error) {
    stopLiveCamera()
    showToast(error instanceof Error ? error.message : 'Camera permission failed')
  }
})

;($('#inline-settings') as HTMLButtonElement).addEventListener(
  'click',
  openInspector,
)
;($('#close-settings') as HTMLButtonElement).addEventListener(
  'click',
  closeInspector,
)
;['#open-fullscreen', '#open-fullscreen-tab', '#canvas-fullscreen'].forEach(
  selector =>
    ($(selector) as HTMLButtonElement).addEventListener(
      'click',
      openCanvasFullscreen,
    ),
)
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && playerShell.classList.contains('canvas-open')) {
    openCanvasFullscreen()
  }
})
window.addEventListener('resize', () => {
  positionInlinePreview()
  attachLiveCameraToPlayer()
})

const importMenuToggle = $('#import-menu-toggle') as HTMLButtonElement
const importMenuList = $('#import-menu-list')

const closeImportMenu = () => {
  importMenuList.hidden = true
  importMenuToggle.setAttribute('aria-expanded', 'false')
}

importMenuToggle.addEventListener('click', event => {
  event.stopPropagation()
  const open = importMenuList.hidden
  importMenuList.hidden = !open
  importMenuToggle.setAttribute('aria-expanded', String(open))
})
importMenuList.addEventListener('click', () => closeImportMenu())
document.addEventListener('click', event => {
  if (importMenuList.hidden) return
  if (
    !(event.target instanceof Node) ||
    !importMenuToggle.parentElement?.contains(event.target)
  ) {
    closeImportMenu()
  }
})

;($('#project-title') as HTMLInputElement).value = project.title
;($('#project-title') as HTMLInputElement).addEventListener('input', event => {
  project.title = (event.currentTarget as HTMLInputElement).value
  scheduleSync()
})

// ——— Notebook switcher ———
// Every saved notebook lives in the worker's database; the switcher lists
// them, opens one (a reload with the pick remembered), creates blank ones,
// and deletes ones you no longer need.
const notebookMenuToggle = $('#notebook-menu-toggle') as HTMLButtonElement
const notebookMenuList = $('#notebook-menu-list') as HTMLElement

const closeNotebookMenu = () => {
  notebookMenuList.hidden = true
  notebookMenuToggle.setAttribute('aria-expanded', 'false')
}

const openNotebook = async (notebookId: string) => {
  if (notebookId !== project.id) {
    // Flush the current notebook before leaving it.
    project.notebook = editor.getJSON() as TiptapDocument
    ensureBlockConfiguration(project.notebook)
    try {
      await persistProjectNow(structuredClone(project))
    } catch {
      // The switch still proceeds; the local cache keeps the edits.
    }
  }
  window.localStorage.setItem(ACTIVE_PROJECT_KEY, notebookId)
  window.localStorage.removeItem(STORAGE_KEY)
  window.location.reload()
}

const createNotebook = async () => {
  const fresh = blankProjectDocument('Untitled notebook')
  if (project.theme) {
    fresh.theme = structuredClone(project.theme)
    fresh.brand = { ...project.theme.brand }
  }
  await persistProjectNow(structuredClone(fresh))
  await openNotebook(fresh.id)
}

const deleteNotebook = async (notebookId: string, title: string) => {
  if (!window.confirm(`Delete the notebook "${title}"? Its recordings and assets go with it.`)) return
  await fetchJson<{ deleted: boolean }>(
    `/api/projects/${encodeURIComponent(notebookId)}`,
    { method: 'DELETE' },
  )
  if (notebookId === project.id) {
    window.localStorage.removeItem(ACTIVE_PROJECT_KEY)
    window.localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
    return
  }
  await renderNotebookMenu()
}

const renderNotebookMenu = async () => {
  const { projects } = await fetchJson<{
    projects: Array<{ id: string; title: string; blockCount: number; updatedAt: string }>
  }>('/api/projects')
  notebookMenuList.replaceChildren()
  const create = document.createElement('button')
  create.type = 'button'
  create.className = 'notebook-menu-create'
  create.innerHTML = '<strong>+ New notebook</strong><small>Start a blank story with the current theme</small>'
  create.addEventListener('click', () => void createNotebook())
  notebookMenuList.append(create)
  const heading = document.createElement('div')
  heading.className = 'notebook-menu-heading'
  heading.textContent = `Saved notebooks · ${projects.length}`
  notebookMenuList.append(heading)
  projects.forEach(entry => {
    const row = document.createElement('div')
    row.className = `notebook-menu-row${entry.id === project.id ? ' is-current' : ''}`
    const open = document.createElement('button')
    open.type = 'button'
    open.className = 'notebook-menu-open'
    const updated = new Date(entry.updatedAt)
    open.innerHTML = `<strong></strong><small>${entry.blockCount} block${entry.blockCount === 1 ? '' : 's'} · ${updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${updated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}${entry.id === project.id ? ' · open now' : ''}</small>`
    ;(open.querySelector('strong') as HTMLElement).textContent = entry.title || 'Untitled notebook'
    open.addEventListener('click', () => void openNotebook(entry.id))
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'notebook-menu-delete'
    remove.setAttribute('aria-label', `Delete ${entry.title}`)
    remove.textContent = '×'
    remove.addEventListener('click', event => {
      event.stopPropagation()
      void deleteNotebook(entry.id, entry.title || 'Untitled notebook')
    })
    row.append(open, remove)
    notebookMenuList.append(row)
  })
}

notebookMenuToggle.addEventListener('click', async () => {
  if (!notebookMenuList.hidden) {
    closeNotebookMenu()
    return
  }
  notebookMenuList.hidden = false
  notebookMenuToggle.setAttribute('aria-expanded', 'true')
  notebookMenuList.innerHTML = '<div class="notebook-menu-heading">Loading notebooks…</div>'
  try {
    await renderNotebookMenu()
  } catch (error) {
    const failure = document.createElement('div')
    failure.className = 'notebook-menu-heading'
    failure.textContent = error instanceof Error ? error.message : 'Could not list notebooks'
    notebookMenuList.replaceChildren(failure)
  }
})
document.addEventListener('click', event => {
  if (notebookMenuList.hidden) return
  const target = event.target as Node
  if (!notebookMenuList.contains(target) && !notebookMenuToggle.contains(target)) {
    closeNotebookMenu()
  }
})

;($('#layout') as HTMLSelectElement).addEventListener('change', event => {
  updateSelectedConfig(config => {
    config.layout = (event.currentTarget as HTMLSelectElement).value as SceneLayout
  })
})
;($('#block-background') as HTMLSelectElement).addEventListener(
  'change',
  event => {
    updateSelectedConfig(config => {
      config.background.preset = (event.currentTarget as HTMLSelectElement)
        .value as BlockBackgroundPreset
    })
  },
)
;($('#reveal') as HTMLSelectElement).addEventListener('change', event => {
  updateSelectedConfig(config => {
    config.reveal = (event.currentTarget as HTMLSelectElement).value as RevealStyle
  })
})
;($('#alignment') as HTMLSelectElement).addEventListener('change', event => {
  updateSelectedConfig(config => {
    config.alignment = (event.currentTarget as HTMLSelectElement).value as
      | 'left'
      | 'center'
  })
})
;($('#duration') as HTMLInputElement).addEventListener('input', event => {
  const seconds = Number((event.currentTarget as HTMLInputElement).value)
  ;($('#duration-output') as HTMLOutputElement).value = `${seconds.toFixed(1)}s`
  updateSelectedConfig(config => {
    config.durationMs = seconds * 1000
  })
})
;($('#camera-position') as HTMLSelectElement).addEventListener(
  'change',
  event => {
    updateSelectedConfig(config => {
      config.camera.position = (event.currentTarget as HTMLSelectElement)
        .value as CameraPosition
    })
  },
)
;($('#presenter-mode') as HTMLSelectElement).addEventListener('change', event => {
  const mode = (event.currentTarget as HTMLSelectElement)
    .value as PresenterLayoutMode
  const preset = presenterPresetForMode(mode)
  updateSelectedConfig(config => {
    config.camera.mode = mode
    config.camera.position = preset.position
    config.camera.shape = preset.shape
  })
})
;($('#camera-shape') as HTMLSelectElement).addEventListener('change', event => {
  updateSelectedConfig(config => {
    config.camera.shape = (event.currentTarget as HTMLSelectElement).value as
      | 'circle'
      | 'rounded-rectangle'
  })
})

const bindBrandColor = (selector: string, key: keyof ProjectDocumentV1['brand']) => {
  const input = $(selector) as HTMLInputElement
  input.value = project.brand[key]
  input.addEventListener('input', () => {
    project.brand[key] = input.value
    if (project.theme) project.theme.brand[key] = input.value
    scheduleSync()
  })
}
bindBrandColor('#brand-primary', 'primary')
bindBrandColor('#brand-secondary', 'secondary')
bindBrandColor('#brand-accent', 'accent')
bindBrandColor('#brand-background', 'background')
bindBrandColor('#brand-text', 'text')

;($('#paste-markdown') as HTMLButtonElement).addEventListener('click', () => {
  ;($('#markdown-input') as HTMLTextAreaElement).value = editor.getMarkdown()
  markdownDialog.showModal()
})
;($('#apply-markdown') as HTMLButtonElement).addEventListener('click', event => {
  event.preventDefault()
  const markdown = ($('#markdown-input') as HTMLTextAreaElement).value
  editor.commands.setContent(markdown, { contentType: 'markdown' })
  markdownDialog.close()
})
;($('#import-file') as HTMLButtonElement).addEventListener('click', () =>
  ($('#file-input') as HTMLInputElement).click(),
)
;($('#file-input') as HTMLInputElement).addEventListener('change', async event => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0]
  if (!file) return
  editor.commands.setContent(await file.text(), { contentType: 'markdown' })
  showToast(`Imported ${file.name}`)
})
;($('#reset-sample') as HTMLButtonElement).addEventListener('click', () => {
  if (!window.confirm('Replace the current notebook with the sample project?')) return
  project.blocks = {}
  project.presenterTracks = {}
  editor.commands.setContent(SAMPLE_MARKDOWN, { contentType: 'markdown' })
})

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${WORKER_URL}${path}`, init)
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body
}

const persistProjectNow = (snapshot: ProjectDocumentV1) => {
  // Callers always pass a detached clone; the live editor keeps its blob
  // preview while the persisted copy stays retryable.
  sanitizeNotebookMedia(snapshot.notebook)
  return fetchJson<{ projectId: string; saved: boolean }>(
    `/api/projects/${encodeURIComponent(snapshot.id)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    },
  )
}

const updateMediaNode = (
  uploadKey: string,
  attributes: Record<string, unknown>,
) => {
  const transaction = editor.state.tr
  editor.state.doc.descendants((node, position) => {
    if (node.attrs.uploadKey !== uploadKey) return
    transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      ...attributes,
    })
  })
  if (transaction.docChanged) editor.view.dispatch(transaction)
}

const setMediaBlockDuration = (uploadKey: string, durationSeconds: number) => {
  let nodeId = ''
  editor.state.doc.descendants(node => {
    if (node.attrs.uploadKey === uploadKey && typeof node.attrs.id === 'string') {
      nodeId = node.attrs.id
    }
  })
  if (!nodeId) return
  ensureBlockConfiguration(editor.getJSON() as TiptapDocument)
  if (project.blocks[nodeId]) {
    project.blocks[nodeId].durationMs = Math.max(1000, durationSeconds * 1000)
  }
}

const mediaNodeIdForUploadKey = (uploadKey: string) => {
  let nodeId = ''
  editor.state.doc.descendants(node => {
    if (node.attrs.uploadKey === uploadKey && typeof node.attrs.id === 'string') {
      nodeId = node.attrs.id
    }
  })
  return nodeId
}

const uploadNotebookAsset = async (file: Blob, name: string, blockId?: string) => {
  project.notebook = editor.getJSON() as TiptapDocument
  ensureBlockConfiguration(project.notebook)
  await persistProjectNow(structuredClone(project))
  return fetchJson<{ url: string }>('/api/assets', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-asset-name': name,
      'x-project-id': project.id,
      ...(blockId ? { 'x-block-id': blockId } : {}),
    },
    body: file,
  })
}

function chooseImageFile(uploadKey: string) {
  if (!uploadKey) return
  pendingImageUploadKey = uploadKey
  const input = $('#block-image-file') as HTMLInputElement
  input.dataset.uploadKey = uploadKey
  input.click()
}

$('#editor').addEventListener('click', event => {
  const block = (event.target as HTMLElement).closest<HTMLElement>(
    '.notebook-image-block',
  )
  if (!block) return
  const status = block.dataset.mediaStatus
  const explicitReplace = Boolean(
    (event.target as HTMLElement).closest('[data-image-action]'),
  )
  if (!explicitReplace && status !== 'error' && status !== 'empty') return
  chooseImageFile(block.dataset.uploadKey || '')
})

;($('#block-image-file') as HTMLInputElement).addEventListener(
  'change',
  async event => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    const uploadKey = input.dataset.uploadKey || pendingImageUploadKey
    delete input.dataset.uploadKey
    input.value = ''
    pendingImageUploadKey = ''
    if (!file || !uploadKey) {
      if (uploadKey) updateMediaNode(uploadKey, { status: 'empty' })
      return
    }
    const localPreviewUrl = URL.createObjectURL(file)
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
    updateMediaNode(uploadKey, {
      src: localPreviewUrl,
      alt: title || 'Image',
      title: title || 'Image',
      status: 'uploading',
    })
    try {
      const result = await uploadNotebookAsset(
        file,
        file.name,
        mediaNodeIdForUploadKey(uploadKey),
      )
      updateMediaNode(uploadKey, {
        src: result.url,
        alt: title || 'Image',
        title: title || 'Image',
        status: 'ready',
      })
      window.setTimeout(() => URL.revokeObjectURL(localPreviewUrl), 1000)
      showToast('Image added to the notebook and timeline')
    } catch (error) {
      updateMediaNode(uploadKey, {
        src: localPreviewUrl,
        status: 'error',
      })
      showToast(error instanceof Error ? error.message : 'Could not upload image')
    }
  },
)

const updateScreenRecordingClock = () => {
  const seconds = Math.floor((Date.now() - screenRecordingStartedAt) / 1000)
  ;($('#screen-recording-time') as HTMLElement).textContent = formatTime(seconds)
}

const stopScreenRecording = () => {
  if (screenRecorder?.state === 'recording') screenRecorder.stop()
}

async function beginScreenRecording(uploadKey: string) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    updateMediaNode(uploadKey, { status: 'unsupported' })
    showToast('Screen recording is not supported in this browser')
    return
  }
  try {
    screenRecordingStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: true,
    })
    // Captured before onstop stops the tracks; drives the hasAudio attr so
    // the compiler only authors an audio element for captures that have one.
    screenRecordingHasAudio = screenRecordingStream.getAudioTracks().length > 0
    screenRecordingUploadKey = uploadKey
    screenRecordingChunks = []
    screenRecordingStartedAt = Date.now()
    const recorderType = supportedRecorderType()
    screenRecorder = new MediaRecorder(
      screenRecordingStream,
      recorderType ? { mimeType: recorderType } : undefined,
    )
    screenRecorder.ondataavailable = event => {
      if (event.data.size) screenRecordingChunks.push(event.data)
    }
    screenRecorder.onstop = async () => {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - screenRecordingStartedAt) / 1000),
      )
      window.clearInterval(screenRecordingTimer)
      ;($('#screen-recording-bar') as HTMLElement).hidden = true
      screenRecordingStream?.getTracks().forEach(track => track.stop())
      screenRecordingStream = null
      updateMediaNode(screenRecordingUploadKey, { status: 'uploading' })
      try {
        const blob = new Blob(screenRecordingChunks, {
          type: screenRecorder?.mimeType || 'video/webm',
        })
        const result = await uploadNotebookAsset(
          blob,
          'screen-recording.webm',
          mediaNodeIdForUploadKey(screenRecordingUploadKey),
        )
        setMediaBlockDuration(screenRecordingUploadKey, durationSeconds)
        updateMediaNode(screenRecordingUploadKey, {
          src: result.url,
          title: `Screen recording · ${formatTime(durationSeconds)}`,
          status: 'ready',
          hasAudio: screenRecordingHasAudio,
        })
        showToast('Screen recording added as a timeline block')
      } catch (error) {
        updateMediaNode(screenRecordingUploadKey, { status: 'error' })
        showToast(
          error instanceof Error
            ? error.message
            : 'Could not upload screen recording',
        )
      } finally {
        screenRecordingUploadKey = ''
        screenRecordingChunks = []
      }
    }
    screenRecordingStream.getVideoTracks()[0]?.addEventListener(
      'ended',
      stopScreenRecording,
      { once: true },
    )
    screenRecorder.start(250)
    ;($('#screen-recording-time') as HTMLElement).textContent = '00:00'
    ;($('#screen-recording-bar') as HTMLElement).hidden = false
    screenRecordingTimer = window.setInterval(updateScreenRecordingClock, 500)
  } catch (error) {
    updateMediaNode(uploadKey, { status: 'cancelled' })
    showToast(
      error instanceof Error ? error.message : 'Screen recording was cancelled',
    )
  }
}

;($('#stop-screen-recording') as HTMLButtonElement).addEventListener(
  'click',
  stopScreenRecording,
)

const updateThemeDraftFromControls = () => {
  const previousPrimary = themeDraft.brand.primary
  const previousSecondary = themeDraft.brand.secondary
  themeDraft.name = ($('#theme-name') as HTMLInputElement).value.trim() || 'My brand'
  themeDraft.brand.primary = ($('#theme-brand-color') as HTMLInputElement).value
  themeDraft.brand.secondary = (
    $('#theme-secondary-color') as HTMLInputElement
  ).value
  themeDraft.brand.accent = ($('#theme-accent-color') as HTMLInputElement).value
  themeDraft.canvas.treatment = (
    $('#theme-canvas-treatment') as HTMLSelectElement
  ).value as StudioThemeV1['canvas']['treatment']
  themeDraft.brand.background = ($('#theme-background') as HTMLInputElement).value
  themeDraft.brand.surface = ($('#theme-surface') as HTMLInputElement).value
  themeDraft.brand.text = ($('#theme-text') as HTMLInputElement).value
  themeDraft.logo.placement = (
    $('#theme-logo-placement') as HTMLSelectElement
  ).value as StudioThemeV1['logo']['placement']
  themeDraft.logo.size = Number(($('#theme-logo-size') as HTMLInputElement).value)
  themeDraft.blocks.surface = (
    $('#theme-surface-style') as HTMLSelectElement
  ).value as StudioThemeV1['blocks']['surface']
  themeDraft.blocks.borderRadius = Number(
    ($('#theme-block-radius') as HTMLInputElement).value,
  )
  themeDraft.video.layout = (
    $('#theme-video-layout') as HTMLSelectElement
  ).value as StudioThemeV1['video']['layout']
  themeDraft.video.borderStyle = (
    $('#theme-video-border') as HTMLSelectElement
  ).value as StudioThemeV1['video']['borderStyle']
  themeDraft.video.borderRadius = Number(
    ($('#theme-video-radius') as HTMLInputElement).value,
  )
  themeDraft.video.borderWidth = Number(
    ($('#theme-video-width') as HTMLInputElement).value,
  )
  if (
    previousPrimary !== themeDraft.brand.primary ||
    previousSecondary !== themeDraft.brand.secondary
  ) {
    themeDraft.canvas.gradient = [
      themeDraft.brand.primary,
      themeDraft.brand.secondary,
    ]
  }
  ;($('#theme-block-radius-output') as HTMLOutputElement).value = `${themeDraft.blocks.borderRadius}px`
  ;($('#theme-video-radius-output') as HTMLOutputElement).value = `${themeDraft.video.borderRadius}px`
  ;($('#theme-video-width-output') as HTMLOutputElement).value = `${themeDraft.video.borderWidth}px`
  ;($('#theme-logo-size-output') as HTMLOutputElement).value = `${themeDraft.logo.size}px`
  renderThemeBuilderPreview()
}

;[
  '#theme-name',
  '#theme-brand-color',
  '#theme-secondary-color',
  '#theme-accent-color',
  '#theme-canvas-treatment',
  '#theme-background',
  '#theme-surface',
  '#theme-text',
  '#theme-logo-placement',
  '#theme-logo-size',
  '#theme-surface-style',
  '#theme-block-radius',
  '#theme-video-layout',
  '#theme-video-border',
  '#theme-video-radius',
  '#theme-video-width',
].forEach(selector => {
  $(selector).addEventListener('input', updateThemeDraftFromControls)
  $(selector).addEventListener('change', updateThemeDraftFromControls)
})

;($('#upload-theme-logo') as HTMLButtonElement).addEventListener('click', () =>
  ($('#theme-logo-file') as HTMLInputElement).click(),
)

;($('#theme-logo-file') as HTMLInputElement).addEventListener(
  'change',
  async event => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const status = $('#theme-ai-status')
    status.textContent = 'Uploading logo to the local Studio asset library…'
    try {
      project.notebook = editor.getJSON() as TiptapDocument
      ensureBlockConfiguration(project.notebook)
      await persistProjectNow(structuredClone(project))
      const result = await fetchJson<{ url: string }>('/api/assets', {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-asset-name': file.name,
          'x-project-id': project.id,
        },
        body: file,
      })
      themeDraft.logo.url = result.url
      syncThemeBuilderControls()
      renderThemeBuilderPreview()
      status.textContent = 'Logo uploaded. Placement and size are saved with this theme.'
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Logo upload failed'
    } finally {
      input.value = ''
    }
  },
)

;($('#remove-theme-logo') as HTMLButtonElement).addEventListener('click', () => {
  themeDraft.logo.url = ''
  syncThemeBuilderControls()
  renderThemeBuilderPreview()
})

;($('#generate-themes') as HTMLButtonElement).addEventListener(
  'click',
  async event => {
    const button = event.currentTarget as HTMLButtonElement
    const status = $('#theme-ai-status')
    button.disabled = true
    button.textContent = 'Creating directions…'
    status.textContent = 'OpenAI is designing the canvas, video frame and every Markdown block together.'
    try {
      const result = await fetchJson<{
        themes: StudioThemeV1[]
        provider: 'openai' | 'local-generator' | 'local-fallback'
        warning?: string
      }>('/api/themes/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brandColor: ($('#theme-brand-color') as HTMLInputElement).value,
          secondaryColor: ($('#theme-secondary-color') as HTMLInputElement).value,
          accentColor: ($('#theme-accent-color') as HTMLInputElement).value,
          name: ($('#theme-name') as HTMLInputElement).value,
          treatment: (
            $('#theme-generation-treatment') as HTMLSelectElement
          ).value as ThemeCanvasTreatment | 'both',
          mood: ($('#theme-mood') as HTMLSelectElement).value,
        }),
      })
      generatedThemes = result.themes.map(theme => ({
        ...normalizeStudioTheme(theme),
        logo: { ...themeDraft.logo },
      }))
      renderGeneratedThemes()
      ;($('#generated-provider') as HTMLElement).textContent =
        result.provider === 'openai'
          ? 'Created with OpenAI'
          : result.provider === 'local-fallback'
            ? 'OpenAI unavailable · local directions shown'
            : 'Local directions'
      status.textContent = result.warning
        ? `${result.warning}. The keyless fallback is ready below.`
        : 'Four complete directions are ready. Choose one, then tune it.'
    } catch (error) {
      generatedThemes = generateThemeDirections(
        ($('#theme-brand-color') as HTMLInputElement).value,
        ($('#theme-name') as HTMLInputElement).value,
        ($('#theme-generation-treatment') as HTMLSelectElement).value as
          | ThemeCanvasTreatment
          | 'both',
        {
          secondary: ($('#theme-secondary-color') as HTMLInputElement).value,
          accent: ($('#theme-accent-color') as HTMLInputElement).value,
        },
      ).map(theme => ({ ...theme, logo: { ...themeDraft.logo } }))
      renderGeneratedThemes()
      ;($('#generated-provider') as HTMLElement).textContent = 'Keyless local directions'
      status.textContent =
        error instanceof Error ? error.message : 'Could not reach the theme service'
    } finally {
      button.disabled = false
      button.textContent = 'Generate with AI'
    }
  },
)

;($('#save-theme') as HTMLButtonElement).addEventListener('click', () => {
  updateThemeDraftFromControls()
  themeDraft.source = 'custom'
  const existingIndex = savedThemes.findIndex(theme => theme.id === themeDraft.id)
  if (existingIndex >= 0) savedThemes[existingIndex] = cloneTheme(themeDraft)
  else savedThemes.push(cloneTheme(themeDraft))
  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(savedThemes))
  applyThemeToProject(themeDraft)
  renderThemeLibrary()
  ;($('#theme-ai-status') as HTMLElement).textContent =
    'Saved. This theme is now available in the notebook theme picker.'
})

document
  .querySelectorAll<HTMLButtonElement>('[data-theme-preview]')
  .forEach(button => {
    button.addEventListener('click', () => {
      themePreviewKind = button.dataset.themePreview as typeof themePreviewKind
      document
        .querySelectorAll<HTMLButtonElement>('[data-theme-preview]')
        .forEach(tab => tab.classList.toggle('active', tab === button))
      renderThemeBuilderPreview()
    })
  })

document
  .querySelectorAll<HTMLButtonElement>('[data-theme-lab-axis]')
  .forEach(button => {
    button.addEventListener('click', () => {
      themeLabAxis = button.dataset.themeLabAxis as ThemeLabAxis
      renderThemeDesignLab()
      if (themeLabAxis === 'motion' || themeLabAxis === 'code-motion') {
        replayThemeMotionPreview()
      }
    })
  })

;($('#replay-theme-motion') as HTMLButtonElement).addEventListener(
  'click',
  replayThemeMotionPreview,
)

;($('#show-theme-library') as HTMLButtonElement).addEventListener('click', () =>
  showThemePanel('library'),
)
;($('#show-theme-builder') as HTMLButtonElement).addEventListener('click', () =>
  openThemeBuilder(),
)
;($('#hero-build-theme') as HTMLButtonElement).addEventListener('click', () =>
  openThemeBuilder(),
)
;($('#cancel-theme-builder') as HTMLButtonElement).addEventListener('click', () =>
  showThemePanel('library'),
)
;($('#theme-open-notebook') as HTMLButtonElement).addEventListener('click', () =>
  navigateToSurface('studio'),
)
;($('#open-theme-builder') as HTMLButtonElement).addEventListener('click', () => {
  navigateToSurface('themes')
  openThemeBuilder(project.theme)
})
;($('#studio-theme-selector') as HTMLSelectElement).addEventListener(
  'change',
  event => {
    const theme = allStudioThemes().find(
      item => item.id === (event.currentTarget as HTMLSelectElement).value,
    )
    if (theme) applyThemeToProject(theme)
  },
)

document.querySelectorAll<HTMLElement>('[data-app-route]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault()
    navigateToSurface(link.dataset.appRoute === 'themes' ? 'themes' : 'studio')
  })
})

window.addEventListener('popstate', () => {
  navigateToSurface(window.location.pathname === '/studio' ? 'studio' : 'themes', true)
})

const sceneScript = (scene: Scene) => {
  const collect = (node: TiptapNode): string =>
    node.type === 'text'
      ? node.text || ''
      : (node.content || []).map(collect).join(' ')
  return collect(scene.node).replace(/\s+/g, ' ').trim()
}

const setCameraStatus = (
  text: string,
  state: 'off' | 'live' | 'recording' = 'off',
) => {
  cameraStatus.textContent = text
  cameraStatusDot.className = state === 'off' ? '' : state
}

const stopCameraStream = () => {
  cameraStream?.getTracks().forEach(track => track.stop())
  cameraStream = null
  cameraPreview.srcObject = null
  cameraPlaceholder.hidden = false
  startRecordingButton.disabled = true
  setCameraStatus('Camera off')
}

const enableCamera = async () => {
  stopCameraStream()
  const microphone = audioMode.value === 'microphone'
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: microphone,
  })
  cameraPreview.srcObject = cameraStream
  cameraPlaceholder.hidden = true
  startRecordingButton.disabled = false
  setCameraStatus(microphone ? 'Camera + microphone ready' : 'Camera-only ready', 'live')
}

const openCamera = () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  recordingNodeId = scene.id
  presenterScript.value = sceneScript(scene)
  generatedVoiceUrl = ''
  engineRecordingButton.disabled = true
  engineRecordingButton.hidden = audioMode.value === 'microphone'
  guideAudio.removeAttribute('src')
  cameraDialog.showModal()
}

;($('#record-this-block') as HTMLButtonElement).addEventListener('click', openCamera)
;($('#close-camera') as HTMLButtonElement).addEventListener('click', () => {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
  stopCameraStream()
  cameraDialog.close()
})
;($('#enable-camera') as HTMLButtonElement).addEventListener('click', async () => {
  try {
    await enableCamera()
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Camera permission failed')
  }
})
audioMode.addEventListener('change', () => {
  generatedVoiceUrl = ''
  guideAudio.removeAttribute('src')
  stopCameraStream()
  engineRecordingButton.disabled = true
  engineRecordingButton.hidden = audioMode.value === 'microphone'
  ;($('#voice-reference-label') as HTMLElement).hidden =
    audioMode.value === 'microphone'
})

const refreshCapabilities = async () => {
  try {
    const capabilities = await fetchJson<{
      renderer: boolean
      systemVoice: boolean
      fishAudio: boolean
    }>('/api/health')
    voiceCapability.textContent = capabilities.fishAudio
      ? 'Fish Audio is configured. Add a voice reference ID for cloning, or leave it blank for local system voice.'
      : capabilities.systemVoice
        ? 'Local system voice is ready. Add FISH_AUDIO_API_KEY later to enable authorized voice profiles.'
        : 'No keyless voice engine is available on this machine. Camera + microphone still works.'
  } catch {
    voiceCapability.textContent =
      'Render worker is offline. Start the studio with `yarn studio`.'
  }
}

;($('#generate-guide') as HTMLButtonElement).addEventListener('click', async event => {
  const button = event.currentTarget as HTMLButtonElement
  if (!presenterScript.value.trim()) return
  button.disabled = true
  button.textContent = 'Generating…'
  try {
    project.notebook = editor.getJSON() as TiptapDocument
    ensureBlockConfiguration(project.notebook)
    await persistProjectNow(structuredClone(project))
    const result = await fetchJson<{ url: string; provider: string }>('/api/voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: presenterScript.value,
        referenceId: voiceReference.value.trim() || undefined,
        projectId: project.id,
        blockId: recordingNodeId || selectedNodeId,
      }),
    })
    generatedVoiceUrl = result.url
    guideAudio.src = result.url
    engineRecordingButton.disabled = false
    voiceCapability.textContent = `${result.provider} guide ready. Rehearse once, then record your real camera take.`
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Voice generation failed')
  } finally {
    button.disabled = false
    button.textContent = 'Generate guide'
  }
})

engineRecordingButton.addEventListener('click', () => {
  if (!recordingNodeId || !generatedVoiceUrl) {
    showToast('Generate the guide voice first')
    return
  }
  project.presenterTracks[recordingNodeId] = [
    {
      kind: 'narration',
      audioUrl: generatedVoiceUrl,
      audioKind: 'generated',
    },
  ]
  syncProject()
  cameraDialog.close()
  stopCameraStream()
  showToast('Voice recorded with the live canvas. Video export is now available.')
})

const wait = (milliseconds: number) =>
  new Promise<void>(resolve => window.setTimeout(resolve, milliseconds))

const runCountdown = async () => {
  countdown.hidden = false
  for (const number of [3, 2, 1]) {
    countdown.textContent = String(number)
    await wait(650)
  }
  countdown.hidden = true
}

const supportedRecorderType = () =>
  ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type)) || ''

const uploadRecording = async (blob: Blob) => {
  project.notebook = editor.getJSON() as TiptapDocument
  ensureBlockConfiguration(project.notebook)
  await persistProjectNow(structuredClone(project))
  const response = await fetchJson<{ url: string }>('/api/assets', {
    method: 'POST',
    headers: {
      'content-type': blob.type || 'video/webm',
      'x-asset-name': `camera-${recordingNodeId}.webm`,
      'x-project-id': project.id,
      'x-block-id': recordingNodeId,
    },
    body: blob,
  })
  const hasGeneratedVoice = audioMode.value === 'generated' && generatedVoiceUrl
  const audioUrl = hasGeneratedVoice
    ? generatedVoiceUrl
    : audioMode.value === 'microphone'
      ? response.url
      : undefined
  project.presenterTracks[recordingNodeId] = [
    {
      kind: 'human-camera',
      videoUrl: response.url,
      audioUrl,
      audioKind: hasGeneratedVoice ? 'generated' : 'recorded-mic',
    },
  ]
  syncProject()
  showToast('Real camera take attached to this block')
  cameraDialog.close()
  stopCameraStream()
}

startRecordingButton.addEventListener('click', async () => {
  if (!cameraStream) return
  if (audioMode.value === 'generated' && !generatedVoiceUrl) {
    showToast('Generate the guide voice before recording')
    return
  }
  await runCountdown()
  recordingChunks = []
  const recorderType = supportedRecorderType()
  mediaRecorder = new MediaRecorder(
    cameraStream,
    recorderType ? { mimeType: recorderType } : undefined,
  )
  mediaRecorder.ondataavailable = event => {
    if (event.data.size) recordingChunks.push(event.data)
  }
  mediaRecorder.onstop = async () => {
    setCameraStatus('Uploading take…', 'live')
    stopRecordingButton.hidden = true
    startRecordingButton.hidden = false
    try {
      await uploadRecording(
        new Blob(recordingChunks, { type: mediaRecorder?.mimeType || 'video/webm' }),
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not upload take')
    }
  }
  mediaRecorder.start(250)
  if (audioMode.value === 'generated') {
    guideAudio.currentTime = 0
    await guideAudio.play()
  }
  startRecordingButton.hidden = true
  stopRecordingButton.hidden = false
  setCameraStatus('Recording real camera', 'recording')
})

stopRecordingButton.addEventListener('click', () => {
  guideAudio.pause()
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
})

;($('#remove-presenter') as HTMLButtonElement).addEventListener('click', () => {
  if (!selectedNodeId) return
  delete project.presenterTracks[selectedNodeId]
  syncProject()
  showToast('Presenter track removed')
})

const publishDialog = $('#publish-dialog') as HTMLDialogElement
const publishBlockList = $('#publish-block-list')
const startPublishButton = $('#start-publish') as HTMLButtonElement
const publishExcluded = new Set<string>()

const publishRowSeconds = (scene: Scene) => {
  const recorded = project.recordedBlocks?.[scene.id]
  return (recorded?.durationMs || scene.durationSeconds * 1000) / 1000
}

const syncPublishSummary = () => {
  const included = scenes.filter(scene => !publishExcluded.has(scene.id))
  const total = included.reduce(
    (sum, scene) => sum + publishRowSeconds(scene),
    0,
  )
  ;($('#publish-duration') as HTMLElement).textContent = formatTime(total)
  ;($('#publish-count') as HTMLElement).textContent =
    `${included.length} of ${scenes.length} blocks`
  startPublishButton.disabled = included.length === 0
}

const renderPublishBlockList = () => {
  publishBlockList.replaceChildren(
    ...scenes.map(scene => {
      const row = document.createElement('div')
      row.className = 'publish-block-row'
      row.classList.toggle('excluded', publishExcluded.has(scene.id))

      const include = document.createElement('input')
      include.type = 'checkbox'
      include.checked = !publishExcluded.has(scene.id)
      include.title = 'Ship this block in the final video'
      include.addEventListener('change', () => {
        if (include.checked) publishExcluded.delete(scene.id)
        else publishExcluded.add(scene.id)
        row.classList.toggle('excluded', !include.checked)
        syncPublishSummary()
      })

      const meta = TIMELINE_BLOCK_META[sceneVisualKind(scene)]
      const identity = document.createElement('div')
      identity.className = 'publish-block-identity'
      const number = document.createElement('b')
      number.textContent = String(scene.index + 1).padStart(2, '0')
      const copy = document.createElement('div')
      const kindLabel = document.createElement('strong')
      kindLabel.textContent = meta.label
      const title = document.createElement('small')
      title.textContent = scene.title
      copy.append(kindLabel, title)
      identity.append(number, copy)

      const controls = document.createElement('div')
      controls.className = 'publish-block-controls'
      const takes = project.recordedBlockTakes?.[scene.id] || []
      if (takes.length) {
        const takeSelect = document.createElement('select')
        takeSelect.title = 'Take used in the final video'
        takes.forEach((take, index) => {
          const option = document.createElement('option')
          option.value = take.recordingId
          option.textContent = `Take v${index + 1} · ${formatTime(take.durationMs / 1000)}`
          option.selected =
            take.recordingId ===
            project.recordedBlocks?.[scene.id]?.recordingId
          takeSelect.append(option)
        })
        const showTakePreview = () => {
          const take =
            takes.find(item => item.recordingId === takeSelect.value) ||
            takes[0]
          const version = takes.indexOf(take) + 1
          const video = $('#publish-take-preview-video') as HTMLVideoElement
          ;($('#publish-take-preview-label') as HTMLElement).textContent =
            `Block ${String(scene.index + 1).padStart(2, '0')} · Take v${version} · ${formatTime(take.durationMs / 1000)}`
          if (video.getAttribute('src') !== take.videoUrl) {
            video.setAttribute('src', take.videoUrl)
          }
          ;($('#publish-take-preview-wrap') as HTMLElement).hidden = false
          void video.play().catch(() => undefined)
        }
        takeSelect.addEventListener('change', () => {
          const take = takes.find(item => item.recordingId === takeSelect.value)
          if (take) {
            selectRecordedTake(scene.id, take)
            if (!($('#publish-take-preview-wrap') as HTMLElement).hidden) {
              showTakePreview()
            }
            renderPublishBlockList()
          }
        })
        const view = document.createElement('button')
        view.type = 'button'
        view.className = 'publish-take-view'
        view.title = 'Watch this take before publishing'
        view.setAttribute('aria-label', 'Watch the selected take')
        view.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>'
        view.addEventListener('click', showTakePreview)
        controls.append(takeSelect, view)
      }
      const time = document.createElement('time')
      time.textContent = formatTime(publishRowSeconds(scene))

      row.append(include, identity, controls, time)
      return row
    }),
  )
  syncPublishSummary()
}

const startPublish = async () => {
  startPublishButton.disabled = true
  startPublishButton.textContent = 'Rendering…'
  const resultPanel = $('#render-result')
  resultPanel.hidden = true
  try {
    const payload = structuredClone(project)
    payload.notebook.content = payload.notebook.content.filter(node => {
      const nodeId = node.attrs?.id
      return typeof nodeId !== 'string' || !publishExcluded.has(nodeId)
    })
    const result = await fetchJson<{ url: string; durationSeconds: number }>(
      '/api/render',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const link = $('#download-render') as HTMLAnchorElement
    link.href = result.url
    resultPanel.hidden = false
    ;($('#publish-count') as HTMLElement).textContent =
      `published · ${result.durationSeconds.toFixed(1)}s`
    showToast(`Published ${result.durationSeconds.toFixed(1)} seconds with Hyperframes`)
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Publish failed')
  } finally {
    startPublishButton.disabled = false
    startPublishButton.textContent = 'Publish video'
  }
}

const closePublishTakePreview = () => {
  const video = $('#publish-take-preview-video') as HTMLVideoElement
  video.pause()
  video.removeAttribute('src')
  ;($('#publish-take-preview-wrap') as HTMLElement).hidden = true
}

const openPublishSummary = () => {
  publishExcluded.clear()
  ;($('#render-result') as HTMLElement).hidden = true
  closePublishTakePreview()
  renderPublishBlockList()
  publishDialog.showModal()
}

renderButton.addEventListener('click', () => {
  syncProject()
  // Publishing starts with the guided junction walkthrough on the real
  // video, then lands on the summary (takes, included blocks, duration).
  enterFinalizeMode()
})
startPublishButton.addEventListener('click', () => void startPublish())
;($('#cancel-publish') as HTMLButtonElement).addEventListener('click', () =>
  publishDialog.close(),
)
;($('#close-publish') as HTMLButtonElement).addEventListener('click', () =>
  publishDialog.close(),
)
publishDialog.addEventListener('close', closePublishTakePreview)
;($('#close-publish-take-preview') as HTMLButtonElement).addEventListener(
  'click',
  closePublishTakePreview,
)
;($('#redo-canvas-recording') as HTMLButtonElement).addEventListener(
  'click',
  () => void startCanvasRecording(),
)

// ——— Explainer block: statement → abstract → diagram plan → animated
// preview, plus the editable shape collection the plans draw from ———

const explainerDialog = $('#explainer-dialog') as HTMLDialogElement
const shapeDialog = $('#shape-collection-dialog') as HTMLDialogElement

type ExplainerWizardState = {
  nodeId: string
  freshInsert: boolean
  step: 0 | 1 | 2
  topic: string
  verbosity: 'brief' | 'standard' | 'detailed'
  abstract: string
  plan: ExplainerPlanV1 | null
  canvasCode: string
  previewStep: number
  busy: boolean
}

let exWizard: ExplainerWizardState | null = null

const projectShapes = () => mergedShapeCollection(project.shapeCollection)

const findExplainerNode = (
  nodeId: string,
): { pos: number; attrs: Record<string, unknown> } | null => {
  let found: { pos: number; attrs: Record<string, unknown> } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'explainer' && node.attrs.id === nodeId) {
      found = { pos, attrs: node.attrs as Record<string, unknown> }
      return false
    }
    return found === null
  })
  return found
}

const writeExplainerNode = (nodeId: string, attrs: Record<string, unknown>) => {
  const found = findExplainerNode(nodeId)
  if (!found) return
  const transaction = editor.state.tr.setNodeMarkup(found.pos, undefined, {
    ...found.attrs,
    ...attrs,
  })
  editor.view.dispatch(transaction)
}

const removeExplainerNode = (nodeId: string) => {
  const found = findExplainerNode(nodeId)
  if (!found) return
  const node = editor.state.doc.nodeAt(found.pos)
  if (!node) return
  editor.view.dispatch(editor.state.tr.delete(found.pos, found.pos + node.nodeSize))
}

const exStatus = (text: string) => {
  ;($('#explainer-status') as HTMLElement).textContent = text
}

const renderExplainerWizard = () => {
  if (!exWizard) return
  const { step } = exWizard
  ;($('#explainer-step-explain') as HTMLElement).hidden = step !== 0
  ;($('#explainer-step-plan') as HTMLElement).hidden = step !== 1
  ;($('#explainer-step-preview') as HTMLElement).hidden = step !== 2
  document
    .querySelectorAll<HTMLElement>('[data-ex-wizard-step]')
    .forEach(chip => {
      const chipStep = Number(chip.dataset.exWizardStep)
      chip.classList.toggle('active', chipStep === step)
      chip.classList.toggle('done', chipStep < step)
    })
  ;($('#explainer-status') as HTMLElement).classList.toggle(
    'working',
    exWizard.busy,
  )
  const back = $('#explainer-back') as HTMLButtonElement
  const next = $('#explainer-next') as HTMLButtonElement
  for (const id of [
    '#explainer-generate-abstract',
    '#explainer-generate-plan',
    '#explainer-preview-regenerate',
    '#explainer-visual-pass',
    '#explainer-canvas-agent',
  ]) {
    ;($(id) as HTMLButtonElement).disabled = exWizard.busy
  }
  back.disabled = step === 0 || exWizard.busy
  next.textContent =
    step === 0 ? 'Next · Diagram →' : step === 1 ? 'Approve · Preview →' : 'Save block'
  next.disabled =
    exWizard.busy ||
    (step === 0 && !exWizard.abstract.trim()) ||
    (step >= 1 && !exWizard.plan)
  if (step === 1) renderExplainerPlanSummary()
  if (step === 2) renderExplainerPreview()
}

const generateExplainerAbstract = async () => {
  if (!exWizard) return
  exWizard.topic = (
    $('#explainer-topic') as HTMLTextAreaElement
  ).value.trim()
  exWizard.verbosity = ($('#explainer-verbosity') as HTMLSelectElement)
    .value as ExplainerWizardState['verbosity']
  if (!exWizard.topic) {
    exStatus('Describe what to explain first')
    return
  }
  exWizard.busy = true
  exStatus('Expanding your statement…')
  renderExplainerWizard()
  try {
    const result = await fetchJson<{ abstract: string; provider: string }>(
      '/api/explainer/abstract',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: exWizard.topic,
          verbosity: exWizard.verbosity,
          instructions: (
            $('#explainer-abstract-instructions') as HTMLInputElement
          ).value,
        }),
      },
    )
    exWizard.abstract = result.abstract
    ;($('#explainer-abstract') as HTMLTextAreaElement).value = result.abstract
    exStatus(
      result.provider === 'openai'
        ? 'Explanation ready — edit freely, then continue'
        : 'Explanation drafted locally (no OpenAI key) — edit freely',
    )
  } catch (error) {
    exStatus(error instanceof Error ? error.message : 'Could not expand that')
  } finally {
    exWizard.busy = false
    renderExplainerWizard()
  }
}

const generateExplainerPlan = async (instructions: string) => {
  if (!exWizard) return
  exWizard.busy = true
  exStatus('Designing the diagram…')
  renderExplainerWizard()
  try {
    const result = await fetchJson<{ plan: ExplainerPlanV1; provider: string }>(
      '/api/explainer/plan',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: exWizard.topic,
          abstract: exWizard.abstract,
          instructions,
          shapes: project.shapeCollection || [],
        }),
      },
    )
    exWizard.plan = sanitizeExplainerPlan(result.plan, projectShapes())
    exWizard.previewStep = 0
    if (result.provider === 'openai') {
      // The agent looks at its own render before handing the plan over.
      exStatus('Diagram planned — running a visual pass on the render…')
      renderExplainerWizard()
      await refineExplainerPlan(instructions, true)
      return
    }
    exStatus('Diagram drafted locally (no OpenAI key) — review it')
  } catch (error) {
    exStatus(error instanceof Error ? error.message : 'Could not plan the diagram')
  } finally {
    exWizard.busy = false
    renderExplainerWizard()
  }
}

// The visual-feedback loop: the server renders the plan headlessly,
// screenshots it, and the model critiques its own pixels and revises the
// plan — the coding-agent pattern, constrained to the diagram schema.
const refineExplainerPlan = async (instructions: string, chained = false) => {
  if (!exWizard?.plan) return
  exWizard.busy = true
  if (!chained) exStatus('Rendering and reviewing the diagram…')
  renderExplainerWizard()
  try {
    const result = await fetchJson<{
      plan: ExplainerPlanV1
      iterations: number
      notes: string
      provider: string
    }>('/api/explainer/refine', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: exWizard.topic,
        abstract: exWizard.abstract,
        plan: exWizard.plan,
        shapes: project.shapeCollection || [],
        instructions,
      }),
    })
    exWizard.plan = sanitizeExplainerPlan(result.plan, projectShapes())
    exWizard.previewStep = 0
    exStatus(
      result.iterations > 0
        ? `Visual pass ×${result.iterations} — ${result.notes}`
        : result.notes,
    )
  } catch (error) {
    exStatus(
      error instanceof Error ? error.message : 'Visual review did not finish',
    )
  } finally {
    exWizard.busy = false
    renderExplainerWizard()
  }
}

// The coding-agent path: the server harness has the model write a full
// Canvas program for these narration steps, runs it in a disposable
// sandbox, screenshots every step, and iterates on its own frames.
const runExplainerCanvasAgent = async (instructions: string) => {
  if (!exWizard?.plan) return
  exWizard.busy = true
  exStatus('Canvas agent — writing the program, rendering each step, reviewing the frames… (1–3 min)')
  renderExplainerWizard()
  try {
    const result = await fetchJson<{
      code: string
      iterations: number
      notes: string
    }>('/api/explainer/canvas-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: exWizard.topic,
        abstract: exWizard.abstract,
        plan: exWizard.plan,
        instructions,
      }),
    })
    exWizard.canvasCode = result.code
    exWizard.previewStep = 0
    exWizard.step = 2
    exStatus(
      `Canvas agent ×${result.iterations} — ${result.notes || 'program ready, preview each step'}`,
    )
  } catch (error) {
    exStatus(
      error instanceof Error ? error.message : 'The canvas agent did not finish',
    )
  } finally {
    exWizard.busy = false
    renderExplainerWizard()
  }
}

const shapeThumb = (shape: ShapeDefV1) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '-92 -66 184 132')
  svg.classList.add('shape-thumb')
  svg.innerHTML = shape.svg
  return svg
}

const renderExplainerPlanSummary = () => {
  if (!exWizard?.plan) return
  const plan = exWizard.plan
  const shapes = projectShapes()
  const summary = $('#explainer-plan-summary')
  summary.replaceChildren()

  const entitiesHeading = document.createElement('h4')
  entitiesHeading.textContent = `Entities · ${plan.entities.length}`
  summary.append(entitiesHeading)
  plan.entities.forEach(entity => {
    const row = document.createElement('div')
    row.className = 'ex-plan-row'
    const shape = shapes.find(item => item.key === entity.shape) || shapes[0]
    row.append(shapeThumb(shape))
    const label = document.createElement('input')
    label.value = entity.label
    label.addEventListener('change', () => {
      entity.label = label.value.slice(0, 60)
    })
    const shapeSelect = document.createElement('select')
    shapes.forEach(item => {
      const option = document.createElement('option')
      option.value = item.key
      option.textContent = item.label
      option.selected = item.key === entity.shape
      shapeSelect.append(option)
    })
    shapeSelect.addEventListener('change', () => {
      entity.shape = shapeSelect.value
      renderExplainerPlanSummary()
    })
    row.append(label, shapeSelect)
    summary.append(row)
  })

  const connectorHeading = document.createElement('h4')
  connectorHeading.textContent = `Connectors · ${plan.connectors.length}`
  summary.append(connectorHeading)
  plan.connectors.forEach(connector => {
    const row = document.createElement('div')
    row.className = 'ex-plan-row'
    const description = document.createElement('span')
    const fromLabel =
      plan.entities.find(entity => entity.id === connector.from)?.label ||
      connector.from
    const toLabel =
      plan.entities.find(entity => entity.id === connector.to)?.label ||
      connector.to
    description.textContent = `${fromLabel} → ${toLabel}${connector.label ? ` · ${connector.label}` : ''}`
    const styleSelect = document.createElement('select')
    ;(['arrow', 'line', 'dashed'] as const).forEach(style => {
      const option = document.createElement('option')
      option.value = style
      option.textContent =
        style === 'arrow' ? 'Arrow' : style === 'line' ? 'Line' : 'Dashed'
      option.selected = style === connector.style
      styleSelect.append(option)
    })
    styleSelect.addEventListener('change', () => {
      connector.style = styleSelect.value as typeof connector.style
    })
    row.append(description, styleSelect)
    summary.append(row)
  })

  const stepsHeading = document.createElement('h4')
  stepsHeading.textContent = `Animated steps · ${plan.steps.length}`
  summary.append(stepsHeading)
  plan.steps.forEach((step, index) => {
    const row = document.createElement('div')
    row.className = 'ex-plan-step'
    const title = document.createElement('input')
    title.value = step.title
    title.addEventListener('change', () => {
      step.title = title.value.slice(0, 80)
    })
    const explanation = document.createElement('textarea')
    explanation.rows = 2
    explanation.value = step.explanation
    explanation.addEventListener('change', () => {
      step.explanation = explanation.value.slice(0, 400)
    })
    const reveals = document.createElement('small')
    reveals.textContent = `Step ${index + 1} reveals: ${step.reveals.join(', ') || 'nothing new'}`
    row.append(title, explanation, reveals)
    summary.append(row)
  })
}

const applyExplainerPreviewStep = () => {
  if (!exWizard?.plan) return
  const stage = $('#explainer-preview-stage')
  const current = exWizard.previewStep
  const sandbox = stage.querySelector('iframe.explainer-preview-frame')
  if (sandbox) {
    ;(sandbox as HTMLIFrameElement).contentWindow?.postMessage(
      { step: current, progress: 1 },
      '*',
    )
  }
  stage
    .querySelectorAll<SVGElement>('[data-ex-step-reveal]')
    .forEach(item => {
      const revealAt = Number(item.dataset.exStepReveal || 0)
      item.style.opacity = revealAt <= current ? '1' : '0'
    })
  const step = exWizard.plan.steps[current]
  const caption = $('#explainer-step-caption')
  caption.innerHTML = ''
  const title = document.createElement('strong')
  title.textContent = `Step ${current + 1} of ${exWizard.plan.steps.length} · ${step?.title || ''}`
  const text = document.createElement('span')
  text.textContent = step?.explanation || ''
  caption.append(title, text)
  ;($('#explainer-prev-step') as HTMLButtonElement).disabled = current === 0
  ;($('#explainer-next-step') as HTMLButtonElement).disabled =
    current >= exWizard.plan.steps.length - 1
}

// The agent-written program previews inside a sandboxed iframe (scripts
// only, no same-origin), driven by postMessage — isolated from the studio.
const explainerPreviewSandbox = (code: string) =>
  `<!doctype html><html><head><style>html,body{margin:0;height:100%;background:#101312}canvas{width:100%;height:100%;display:block;object-fit:contain}</style></head><body><canvas id="stage" width="1600" height="860"></canvas><script>
var program=null;try{var scope={};(function(globalThis){${code}
}).call(scope,scope);program=scope.explainer||null}catch(e){}
var theme={stroke:'#4ade80',fill:'rgba(74,222,128,.12)',text:'#f4f4f5',muted:'#a1a1aa'};
function draw(k,p){var c=document.getElementById('stage');var x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);if(program&&program.drawFrame){try{program.drawFrame(x,k,p==null?1:p,c.width,c.height,theme)}catch(e){}}}
window.addEventListener('message',function(ev){var d=ev.data||{};if(typeof d.step==='number')draw(d.step,d.progress)});
draw(0,1);
<\/script></body></html>`

const renderExplainerPreview = () => {
  if (!exWizard?.plan) return
  const stage = $('#explainer-preview-stage')
  if (exWizard.canvasCode) {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.className = 'explainer-preview-frame'
    frame.srcdoc = explainerPreviewSandbox(exWizard.canvasCode)
    stage.replaceChildren(frame)
    frame.addEventListener('load', applyExplainerPreviewStep, { once: true })
    return
  }
  stage.innerHTML = renderExplainerDiagram(exWizard.plan, projectShapes())
  applyExplainerPreviewStep()
}

const openExplainerWizard = (nodeId: string, freshInsert: boolean) => {
  const found = findExplainerNode(nodeId)
  if (!found) return
  const attrs = found.attrs
  exWizard = {
    nodeId,
    freshInsert,
    step: 0,
    topic: String(attrs.topic || ''),
    verbosity:
      (attrs.verbosity as ExplainerWizardState['verbosity']) || 'standard',
    abstract: String(attrs.abstract || ''),
    plan: attrs.plan
      ? sanitizeExplainerPlan(attrs.plan as ExplainerPlanV1, projectShapes())
      : null,
    canvasCode: String(attrs.canvasCode || ''),
    previewStep: 0,
    busy: false,
  }
  ;($('#explainer-topic') as HTMLTextAreaElement).value = exWizard.topic
  ;($('#explainer-verbosity') as HTMLSelectElement).value = exWizard.verbosity
  document
    .querySelectorAll<HTMLButtonElement>('#explainer-verbosity-segment button')
    .forEach(button =>
      button.classList.toggle(
        'active',
        button.dataset.verbosity === exWizard?.verbosity,
      ),
    )
  ;($('#explainer-abstract') as HTMLTextAreaElement).value = exWizard.abstract
  ;($('#explainer-abstract-instructions') as HTMLInputElement).value = ''
  ;($('#explainer-plan-instructions') as HTMLInputElement).value = ''
  ;($('#explainer-preview-instructions') as HTMLInputElement).value = ''
  exStatus('')
  renderExplainerWizard()
  explainerDialog.showModal()
}

const saveExplainerWizard = () => {
  if (!exWizard?.plan) return
  writeExplainerNode(exWizard.nodeId, {
    topic: exWizard.topic,
    verbosity: exWizard.verbosity,
    abstract: exWizard.abstract,
    plan: exWizard.plan,
    canvasCode: exWizard.canvasCode || null,
  })
  const config = project.blocks[exWizard.nodeId]
  if (config) {
    config.durationMs = Math.round(
      explainerDurationSeconds(exWizard.plan) * 1000,
    )
  }
  exWizard = null
  explainerDialog.close()
  syncProject()
  showToast('Explainer block saved — it animates step by step in the video')
}

document
  .querySelectorAll<HTMLButtonElement>('#explainer-verbosity-segment button')
  .forEach(button =>
    button.addEventListener('click', () => {
      ;($('#explainer-verbosity') as HTMLSelectElement).value =
        button.dataset.verbosity || 'standard'
      document
        .querySelectorAll<HTMLButtonElement>('#explainer-verbosity-segment button')
        .forEach(item => item.classList.toggle('active', item === button))
    }),
  )
;($('#explainer-generate-abstract') as HTMLButtonElement).addEventListener(
  'click',
  () => void generateExplainerAbstract(),
)
;($('#explainer-generate-plan') as HTMLButtonElement).addEventListener(
  'click',
  () =>
    void generateExplainerPlan(
      ($('#explainer-plan-instructions') as HTMLInputElement).value,
    ),
)
;($('#explainer-preview-regenerate') as HTMLButtonElement).addEventListener(
  'click',
  () =>
    void generateExplainerPlan(
      ($('#explainer-preview-instructions') as HTMLInputElement).value,
    ),
)
;($('#explainer-visual-pass') as HTMLButtonElement).addEventListener(
  'click',
  () =>
    void refineExplainerPlan(
      ($('#explainer-plan-instructions') as HTMLInputElement).value,
    ),
)
;($('#explainer-canvas-agent') as HTMLButtonElement).addEventListener(
  'click',
  () =>
    void runExplainerCanvasAgent(
      ($('#explainer-plan-instructions') as HTMLInputElement).value,
    ),
)
// Play walks the steps automatically so the animation can be watched, not
// just stepped; any manual step (button or arrow key) takes control back.
let explainerPlayTimer: number | undefined

const stopExplainerPlayback = () => {
  window.clearInterval(explainerPlayTimer)
  explainerPlayTimer = undefined
  ;($('#explainer-play-step') as HTMLButtonElement).textContent = '▶ Play'
}

const startExplainerPlayback = () => {
  if (!exWizard?.plan) return
  if (exWizard.previewStep >= exWizard.plan.steps.length - 1) {
    exWizard.previewStep = 0
    applyExplainerPreviewStep()
  }
  ;($('#explainer-play-step') as HTMLButtonElement).textContent = '⏸ Pause'
  explainerPlayTimer = window.setInterval(() => {
    if (!exWizard?.plan || !explainerDialog.open) {
      stopExplainerPlayback()
      return
    }
    if (exWizard.previewStep >= exWizard.plan.steps.length - 1) {
      stopExplainerPlayback()
      return
    }
    exWizard.previewStep += 1
    applyExplainerPreviewStep()
  }, 2200)
}

;($('#explainer-play-step') as HTMLButtonElement).addEventListener('click', () => {
  if (explainerPlayTimer) stopExplainerPlayback()
  else startExplainerPlayback()
})
;($('#explainer-prev-step') as HTMLButtonElement).addEventListener('click', () => {
  if (!exWizard) return
  stopExplainerPlayback()
  exWizard.previewStep = Math.max(0, exWizard.previewStep - 1)
  applyExplainerPreviewStep()
})
;($('#explainer-next-step') as HTMLButtonElement).addEventListener('click', () => {
  if (!exWizard?.plan) return
  stopExplainerPlayback()
  exWizard.previewStep = Math.min(
    exWizard.plan.steps.length - 1,
    exWizard.previewStep + 1,
  )
  applyExplainerPreviewStep()
})
explainerDialog.addEventListener('close', stopExplainerPlayback)
;($('#explainer-back') as HTMLButtonElement).addEventListener('click', () => {
  if (!exWizard || exWizard.step === 0) return
  exWizard.step = (exWizard.step - 1) as ExplainerWizardState['step']
  renderExplainerWizard()
})
;($('#explainer-next') as HTMLButtonElement).addEventListener('click', () => {
  if (!exWizard) return
  if (exWizard.step === 0) {
    exWizard.topic = ($('#explainer-topic') as HTMLTextAreaElement).value.trim()
    exWizard.abstract = ($('#explainer-abstract') as HTMLTextAreaElement).value
    exWizard.step = 1
    renderExplainerWizard()
    if (!exWizard.plan) {
      void generateExplainerPlan(
        ($('#explainer-plan-instructions') as HTMLInputElement).value,
      )
    }
    return
  }
  if (exWizard.step === 1) {
    exWizard.step = 2
    exWizard.previewStep = 0
    renderExplainerWizard()
    return
  }
  saveExplainerWizard()
})
// ——— Canvas step controls: rehearse the compiled explainer animation on
// the real canvas — restart the flow, step forward and back — so what you
// narrate over is exactly what the export shows. ———

let canvasExplainerStep = 0
let canvasExplainerNodeId = ''
let canvasExplainerKeeper: number | undefined

const explainerCompositionDriver = (nodeId: string) =>
  (
    player.iframeElement?.contentWindow as unknown as {
      __explainerDrivers?: Record<
        string,
        { stepCount: number; setStep: (step: number, progress?: number) => void }
      >
    } | null
  )?.__explainerDrivers?.[nodeId]

const canvasExplainerContext = () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene || scene.node.type !== 'explainer') return null
  const sceneElement = player.iframeElement?.contentDocument?.querySelector<HTMLElement>(
    `#scene-${scene.index}`,
  )
  if (!sceneElement) return null
  return {
    scene,
    sceneElement,
    plan: sanitizeExplainerPlan(
      scene.node.attrs?.plan as ExplainerPlanV1 | undefined,
      projectShapes(),
    ),
  }
}

const clearCanvasExplainerOverrides = () => {
  const context = canvasExplainerContext()
  if (!context) return
  context.sceneElement
    .querySelectorAll<HTMLElement>('[data-ex-step-reveal], .ex-caption')
    .forEach(element => {
      element.style.removeProperty('opacity')
      element.style.removeProperty('visibility')
    })
}

const disengageCanvasExplainerStepper = () => {
  if (canvasExplainerKeeper === undefined) return
  window.clearInterval(canvasExplainerKeeper)
  canvasExplainerKeeper = undefined
  clearCanvasExplainerOverrides()
}

const applyCanvasExplainerStep = () => {
  const context = canvasExplainerContext()
  if (!context) return
  player.pause()
  const stepCount = context.plan.steps.length
  const step = Math.min(canvasExplainerStep, stepCount - 1)
  // Canvas-agent blocks draw through their registered driver.
  explainerCompositionDriver(selectedNodeId)?.setStep(step, 1)
  context.sceneElement
    .querySelectorAll<HTMLElement>('[data-ex-step-reveal]')
    .forEach(element => {
      const revealAt = Number(element.dataset.exStepReveal || 0)
      element.style.setProperty(
        'opacity',
        revealAt <= step ? '1' : '0',
        'important',
      )
      element.style.setProperty('visibility', 'visible', 'important')
    })
  context.sceneElement
    .querySelectorAll<HTMLElement>('.ex-caption')
    .forEach(element => {
      element.style.setProperty(
        'opacity',
        Number(element.dataset.exStep || 0) === step ? '1' : '0',
        'important',
      )
    })
  const label = $('#ex-canvas-step-label') as HTMLElement
  label.textContent = `${step + 1}/${stepCount}`
  label.title = context.plan.steps[step]?.title || ''
  syncExplainerTeleprompter()
  ;($('#ex-canvas-prev') as HTMLButtonElement).disabled = step === 0
  ;($('#ex-canvas-next') as HTMLButtonElement).disabled = step >= stepCount - 1
}

const engageCanvasExplainerStepper = () => {
  applyCanvasExplainerStep()
  if (canvasExplainerKeeper === undefined) {
    // The paused runtime occasionally restamps the compiled state; a light
    // keeper re-asserts the chosen step so it can't flash back.
    canvasExplainerKeeper = window.setInterval(applyCanvasExplainerStep, 400)
  }
}

const syncCanvasExplainerStepper = () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  const isExplainer = scene?.node.type === 'explainer'
  ;($('#explainer-step-bar') as HTMLElement).hidden = !isExplainer
  if (selectedNodeId !== canvasExplainerNodeId) {
    disengageCanvasExplainerStepper()
    canvasExplainerNodeId = selectedNodeId
    canvasExplainerStep = 0
    if (isExplainer && scene) {
      const plan = sanitizeExplainerPlan(
        scene.node.attrs?.plan as ExplainerPlanV1 | undefined,
        projectShapes(),
      )
      const stepLabel = $('#ex-canvas-step-label') as HTMLElement
      stepLabel.textContent = `0/${plan.steps.length}`
      stepLabel.title = 'Restart to rehearse the animation step by step'
    }
  }
}

;($('#ex-canvas-restart') as HTMLButtonElement).addEventListener('click', () => {
  canvasExplainerStep = 0
  engageCanvasExplainerStepper()
})
;($('#ex-canvas-prev') as HTMLButtonElement).addEventListener('click', () => {
  canvasExplainerStep = Math.max(0, canvasExplainerStep - 1)
  engageCanvasExplainerStepper()
})
;($('#ex-canvas-next') as HTMLButtonElement).addEventListener('click', () => {
  const context = canvasExplainerContext()
  if (!context) return
  canvasExplainerStep = Math.min(
    context.plan.steps.length - 1,
    canvasExplainerStep + 1,
  )
  engageCanvasExplainerStepper()
})

// Full-screen preview: same stage and step controls, viewport-sized — for
// judging real entries. Esc leaves fullscreen (not the wizard); ←/→ step.
const explainerPreviewShell = $('#explainer-preview-shell')

const setExplainerFullscreen = (on: boolean) => {
  explainerPreviewShell.classList.toggle('fullscreen', on)
}

;($('#explainer-fullscreen') as HTMLButtonElement).addEventListener(
  'click',
  () => setExplainerFullscreen(!explainerPreviewShell.classList.contains('fullscreen')),
)
explainerDialog.addEventListener('cancel', event => {
  if (explainerPreviewShell.classList.contains('fullscreen')) {
    event.preventDefault()
    setExplainerFullscreen(false)
  }
})
explainerDialog.addEventListener('close', () => setExplainerFullscreen(false))
document.addEventListener('keydown', event => {
  if (!explainerDialog.open || !exWizard || exWizard.step !== 2) return
  const editingField =
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  if (editingField) return
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    ;($('#explainer-next-step') as HTMLButtonElement).click()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    ;($('#explainer-prev-step') as HTMLButtonElement).click()
  }
})

;($('#close-explainer') as HTMLButtonElement).addEventListener('click', () => {
  // Cancelling a brand-new, never-configured explainer removes the empty node.
  if (exWizard?.freshInsert && !exWizard.plan && !exWizard.topic) {
    removeExplainerNode(exWizard.nodeId)
    syncProject()
  }
  exWizard = null
  explainerDialog.close()
})

document.addEventListener('click', event => {
  const action = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-explainer-action]',
  )
  if (!action) return
  const block = action.closest<HTMLElement>('.notebook-explainer-block')
  if (block?.id) openExplainerWizard(block.id, false)
})

// ——— Shape collection: view, multi-select, edit, extend ———

const selectedShapeKeys = new Set<string>()
let shapeEditorKey: string | null = null

const renderShapeCollection = () => {
  const grid = $('#shape-collection-grid')
  grid.replaceChildren()
  projectShapes().forEach(shape => {
    const card = document.createElement('label')
    card.className = 'shape-card'
    card.classList.toggle('selected', selectedShapeKeys.has(shape.key))
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = selectedShapeKeys.has(shape.key)
    check.addEventListener('change', () => {
      if (check.checked) selectedShapeKeys.add(shape.key)
      else selectedShapeKeys.delete(shape.key)
      renderShapeCollection()
    })
    const name = document.createElement('strong')
    name.textContent = shape.label
    const badge = document.createElement('em')
    badge.textContent = shape.builtin === false ? 'custom' : 'built-in'
    card.append(check, shapeThumb(shape), name, badge)
    grid.append(card)
  })
  const single = selectedShapeKeys.size === 1
  const onlyCustomSelected = [...selectedShapeKeys].every(key =>
    (project.shapeCollection || []).some(shape => shape.key === key),
  )
  ;($('#shape-edit') as HTMLButtonElement).disabled = !single
  ;($('#shape-duplicate') as HTMLButtonElement).disabled = !single
  ;($('#shape-delete') as HTMLButtonElement).disabled =
    selectedShapeKeys.size === 0 || !onlyCustomSelected
}

const openShapeEditor = (shape: Partial<ShapeDefV1>, editKey: string | null) => {
  shapeEditorKey = editKey
  ;($('#shape-editor') as HTMLElement).hidden = false
  ;($('#shape-editor-label') as HTMLInputElement).value = shape.label || ''
  ;($('#shape-editor-svg') as HTMLTextAreaElement).value =
    shape.svg ||
    '<rect x="-80" y="-55" width="160" height="110" rx="10" fill="var(--ex-fill)" stroke="var(--ex-stroke)" stroke-width="3"/>'
  syncShapeEditorPreview()
}

const syncShapeEditorPreview = () => {
  const preview = $('#shape-editor-preview')
  preview.replaceChildren(
    shapeThumb({
      key: 'preview',
      label: 'preview',
      svg: ($('#shape-editor-svg') as HTMLTextAreaElement).value,
    }),
  )
}

;($('#shape-editor-svg') as HTMLTextAreaElement).addEventListener(
  'input',
  syncShapeEditorPreview,
)
;($('#shape-new') as HTMLButtonElement).addEventListener('click', () =>
  openShapeEditor({}, null),
)
;($('#shape-edit') as HTMLButtonElement).addEventListener('click', () => {
  const key = [...selectedShapeKeys][0]
  const shape = projectShapes().find(item => item.key === key)
  if (!shape) return
  // Built-ins are the shared vocabulary: editing one creates a custom copy.
  openShapeEditor(shape, shape.builtin === false ? key : null)
})
;($('#shape-duplicate') as HTMLButtonElement).addEventListener('click', () => {
  const key = [...selectedShapeKeys][0]
  const shape = projectShapes().find(item => item.key === key)
  if (shape) openShapeEditor({ ...shape, label: `${shape.label} copy` }, null)
})
;($('#shape-delete') as HTMLButtonElement).addEventListener('click', () => {
  project.shapeCollection = (project.shapeCollection || []).filter(
    shape => !selectedShapeKeys.has(shape.key),
  )
  selectedShapeKeys.clear()
  renderShapeCollection()
  syncProject()
})
;($('#shape-editor-save') as HTMLButtonElement).addEventListener('click', () => {
  const label = ($('#shape-editor-label') as HTMLInputElement).value.trim()
  const svg = ($('#shape-editor-svg') as HTMLTextAreaElement).value.trim()
  if (!label || !svg) {
    showToast('A shape needs a name and its SVG markup')
    return
  }
  const key =
    shapeEditorKey ||
    `${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)}-${(project.shapeCollection?.length || 0) + 1}`
  project.shapeCollection = [
    ...(project.shapeCollection || []).filter(shape => shape.key !== key),
    { key, label: label.slice(0, 40), svg: svg.slice(0, 4000) },
  ]
  ;($('#shape-editor') as HTMLElement).hidden = true
  shapeEditorKey = null
  renderShapeCollection()
  if (exWizard?.plan) renderExplainerPlanSummary()
  syncProject()
  showToast(`Shape "${label}" is in the collection`)
})
;($('#open-shape-collection') as HTMLButtonElement).addEventListener(
  'click',
  () => {
    selectedShapeKeys.clear()
    ;($('#shape-editor') as HTMLElement).hidden = true
    renderShapeCollection()
    shapeDialog.showModal()
  },
)
;($('#close-shape-collection') as HTMLButtonElement).addEventListener(
  'click',
  () => shapeDialog.close(),
)
;($('#shape-collection-done') as HTMLButtonElement).addEventListener(
  'click',
  () => shapeDialog.close(),
)

window.addEventListener('beforeunload', () => {
  finishCanvasRecording()
  stopLiveCamera()
  stopCameraStream()
  screenRecordingStream?.getTracks().forEach(track => track.stop())
  window.clearInterval(screenRecordingTimer)
  editor.destroy()
})

queueMicrotask(() => {
  renderThemeLibrary()
  renderStudioThemeSelector()
  renderPreviewPresenterPicker()
  syncThemeBuilderControls()
  renderThemeBuilderPreview()
  navigateToSurface(
    window.location.pathname === '/studio' ? 'studio' : 'themes',
    true,
  )
  syncProject()
  refreshCapabilities()
})
