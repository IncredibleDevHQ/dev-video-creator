import '@hyperframes/player'
import { Editor, type JSONContent } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import {
  builtinStudioThemes,
  compileProject,
  createDefaultBlockConfig,
  defaultBrand,
  defaultStudioTheme,
  estimateSpokenSeconds,
  generateThemeDirections,
  normalizeStudioTheme,
  normalizedRectStyle,
  presenterLayoutGeometry,
  sanitizeNotebookMedia,
  type BlockBackgroundPreset,
  type BlockRenderConfigV1,
  type CameraPosition,
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
import { ImageBlock, ScreenRecordingBlock } from './media-nodes'
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
      : scene.kind

const TIMELINE_BLOCK_META = {
  title: { label: 'Title', icon: 'T' },
  content: { label: 'Text', icon: 'Aa' },
  list: { label: 'Points', icon: '☷' },
  quote: { label: 'Quote', icon: '“' },
  code: { label: 'Code', icon: '</>' },
  image: { label: 'Image', icon: '▧' },
  screen: { label: 'Screen', icon: '▶' },
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
        : [{ action: 'next-beat', label: 'Next beat', detail: `Reveal the ${meta.label.toLowerCase()}`, key: '→' }]

  canvasRecordingScene = scene
  recordingCoachTitle.textContent = visualKind === 'code'
    ? 'Explain the code as you reveal it'
    : visualKind === 'list'
      ? 'Walk through each point'
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
  nextAnimationStepButton.textContent = visualKind === 'code' ? 'Next line ↓' : visualKind === 'list' ? 'Next point →' : 'Next beat →'
}

const prepareCanvasRecordingSteps = async (scene: Scene) => {
  restoreCanvasRecordingSteps()
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

const startCanvasRecording = async () => {
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    showToast('Canvas recording is not supported in this browser')
    return
  }
  startCanvasRecordingButton.disabled = true
  configureCanvasRecordingCoach(scene)
  playerShell.classList.add('canvas-recording-mode')
  canvasRecordingCoach.hidden = false
  try {
    canvasCaptureStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    } as DisplayMediaStreamOptions)
    if (!liveCameraStream && scene.config.camera.position !== 'hidden') {
      await startLiveCamera()
    }
    const captureTrack = canvasCaptureStream.getVideoTracks()[0] as MediaStreamTrack & {
      cropTo?: (target: unknown) => Promise<void>
    }
    const cropTargetApi = (window as Window & {
      CropTarget?: { fromElement: (element: Element) => Promise<unknown> }
    }).CropTarget
    if (cropTargetApi && captureTrack.cropTo) {
      await captureTrack.cropTo(await cropTargetApi.fromElement(player))
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
    captureTrack.addEventListener('ended', finishCanvasRecording, { once: true })
    canvasRecorder.start(250)
    canvasRecordingStartedAt = Date.now()
    canvasRecordingTimer = window.setInterval(updateCanvasRecordingClock, 250)
    playerShell.classList.add('canvas-recording-active')
    canvasRecordingControls.setAttribute('aria-busy', 'true')
    startCanvasRecordingButton.hidden = true
    previousAnimationStepButton.hidden = false
    nextAnimationStepButton.hidden = false
    stopCanvasRecordingButton.hidden = false
    updateCanvasRecordingClock()
  } catch (error) {
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

const readPersistedProject = async (
  local: ProjectDocumentV1 | null,
): Promise<ProjectDocumentV1 | null> => {
  try {
    const path = local
      ? `/api/projects/${encodeURIComponent(local.id)}`
      : '/api/projects/latest'
    const response = await fetch(`${WORKER_URL}${path}`)
    if (!response.ok) return null
    const body = (await response.json()) as { project?: ProjectDocumentV1 | null }
    return body.project?.version === 1 ? body.project : null
  } catch {
    return null
  }
}

const storedProject = (await readPersistedProject(localProject)) || localProject

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
  storedProject ||
  ({
    version: 1,
    id: crypto.randomUUID(),
    title: 'Human-first developer story',
    notebook: { type: 'doc', content: [] },
    fps: 30,
    width: 1920,
    height: 1080,
    blocks: {},
    presenterTracks: {},
    recordedBlocks: {},
    brand: { ...defaultBrand },
    theme: structuredClone(defaultStudioTheme),
  } satisfies ProjectDocumentV1)

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
  const content: Record<Exclude<SlashBlockId, 'image' | 'screen'>, JSONContent> = {
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

editor = new Editor({
  element: $('#editor'),
  extensions: [
    StarterKit,
    ImageBlock,
    ScreenRecordingBlock,
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

const closeTransitionPopover = () => {
  transitionPopover.hidden = true
}

const openTransitionPopover = (scene: Scene, node: HTMLElement) => {
  const meta = TIMELINE_BLOCK_META[sceneVisualKind(scene)]
  const hasTake = Boolean(project.recordedBlocks?.[scene.id]?.videoUrl)
  transitionPopoverTitle.textContent = `Transition into ${String(scene.index + 1).padStart(2, '0')} · ${meta.label}${
    hasTake ? ' (plays its recorded take)' : ''
  }`
  const currentReveal = () =>
    project.blocks[scene.id]?.reveal || scene.config.reveal
  const fromScene = scenes[scene.index - 1]
  transitionPopoverGrid.replaceChildren(
    ...MOTION_OPTIONS.filter(option =>
      DIRECTOR_OPTIONS[scene.kind].animations.includes(option.value),
    ).map(option => {
      const tile = document.createElement('button')
      tile.type = 'button'
      tile.className = `motion-tile${option.value === currentReveal() ? ' active' : ''}`
      tile.title = option.description
      const label = document.createElement('strong')
      label.textContent = option.label
      tile.append(
        fromScene
          ? createJunctionDemo(fromScene, scene, option.value)
          : createMotionDemo(option.value),
        label,
      )
      tile.addEventListener('click', () => {
        // Stay open so styles can be auditioned one after another — each
        // pick plays full-size on the canvas, the tiles are just the menu.
        transitionPopoverGrid
          .querySelectorAll('.motion-tile')
          .forEach(item => item.classList.toggle('active', item === tile))
        selectNode(scene.id, false)
        motionPreviewLabel = `Previewing · ${option.label}`
        if (currentReveal() === option.value) {
          void replaySelectedAnimation()
        } else {
          // Recompiles the preview and replays across the boundary once the
          // player reports ready — the pick is previewed on the video itself.
          setMotionPreviewBadge(`Preparing ${option.label}…`)
          replayAnimationOnReady = true
          updateSelectedConfig(config => {
            config.reveal = option.value
          })
        }
      })
      return tile
    }),
  )
  hydrateJunctionFrames(transitionPopoverGrid)
  transitionPopover.hidden = false
  const rect = node.getBoundingClientRect()
  const width = transitionPopover.offsetWidth
  const left = Math.max(
    12,
    Math.min(
      window.innerWidth - width - 12,
      rect.left + rect.width / 2 - width / 2,
    ),
  )
  transitionPopover.style.left = `${left}px`
  transitionPopover.style.bottom = `${window.innerHeight - rect.top + 10}px`
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
  value: RevealStyle,
) => {
  const demo = document.createElement('span')
  demo.className = 'motion-demo junction-demo'
  demo.setAttribute('aria-hidden', 'true')
  const outgoing = buildJunctionLayer(fromScene)
  outgoing.classList.add('out')
  if (outgoing.dataset.captureUrl) outgoing.dataset.captureEdge = 'last'
  const incoming = buildJunctionLayer(toScene)
  incoming.classList.add('in', `junction-in-${value}`)
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
  const target = finalizeModeActive
    ? scenes[finalizeJunctionIndex + 1]
    : undefined
  canvasBlockTimeline
    .querySelectorAll<HTMLElement>('.timeline-transition-node')
    .forEach(node => {
      node.classList.toggle(
        'current',
        Boolean(target) && node.dataset.boundaryIndex === String(target?.index),
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
  const currentReveal = () => project.blocks[to.id]?.reveal || to.config.reveal
  finalizeTiles.replaceChildren(
    ...MOTION_OPTIONS.filter(option =>
      DIRECTOR_OPTIONS[to.kind].animations.includes(option.value),
    ).map(option => {
      const tile = document.createElement('button')
      tile.type = 'button'
      tile.className = `motion-tile${option.value === currentReveal() ? ' active' : ''}`
      tile.title = option.description
      const label = document.createElement('strong')
      label.textContent = option.label
      tile.append(createJunctionDemo(from, to, option.value), label)
      tile.addEventListener('click', () => {
        finalizeTiles
          .querySelectorAll('.motion-tile')
          .forEach(item => item.classList.toggle('active', item === tile))
        motionPreviewLabel = `Previewing · ${option.label}`
        if (currentReveal() === option.value) {
          void replaySelectedAnimation()
          return
        }
        // Applies the pick and replays the real frames across this junction
        // as soon as the recompiled preview is ready.
        setMotionPreviewBadge(`Preparing ${option.label}…`)
        replayAnimationOnReady = true
        updateSelectedConfig(config => {
          config.reveal = option.value
        })
      })
      return tile
    }),
  )
  hydrateJunctionFrames(finalizeTiles)
  selectNode(to.id, false)
  highlightCurrentJunction()
  if (playPreview) {
    const currentMotion = MOTION_OPTIONS.find(
      option => option.value === currentReveal(),
    )
    motionPreviewLabel = `Previewing · ${currentMotion?.label || 'transition'}`
    void replaySelectedAnimation()
  }
}

const exitFinalizeMode = () => {
  finalizeModeActive = false
  finalizeBar.hidden = true
  playerShell.classList.remove('canvas-finalize-mode')
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
      // A CapCut-style boundary node between chips: filled when a transition
      // into the right-hand block exists, hollow when it enters statically.
      const node = document.createElement('button')
      const hasTransition = scene.config.reveal !== 'none'
      const motionLabel =
        MOTION_OPTIONS.find(option => option.value === scene.config.reveal)
          ?.label || scene.config.reveal
      node.type = 'button'
      node.dataset.boundaryIndex = String(scene.index)
      node.className = `timeline-transition-node${hasTransition ? ' set' : ''}`
      node.title = hasTransition
        ? `Transition: ${motionLabel} — click to change`
        : 'Add a transition between these blocks'
      node.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14l7-7-7-7Zm16 0-7 7 7 7V5Z"/></svg>'
      node.addEventListener('click', event => {
        event.stopPropagation()
        openTransitionPopover(scene, node)
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
  if (scene) {
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
    playerLoading.hidden = false
    playerLoading.textContent = 'Compiling live canvas…'

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
  const showTakeVideo = Boolean(
    recordedBlock?.videoUrl && recordedTakeCanvasView === 'video',
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

const setMotionPreviewBadge = (text: string) => {
  const badge = $('#motion-preview-badge')
  if (!text) {
    badge.hidden = true
    return
  }
  ;($('#motion-preview-label') as HTMLElement).textContent = text
  badge.hidden = false
}

const replaySelectedAnimation = async () => {
  stopScreenPlayback()
  const scene = scenes.find(item => item.id === selectedNodeId)
  if (!scene) return
  window.clearTimeout(animationPreviewTimer)
  player.pause()
  if (motionPreviewLabel) setMotionPreviewBadge(motionPreviewLabel)
  // Start just before the boundary so the previous block's tail is visible
  // and the entrance reads as a transition between the two.
  const leadInSeconds = Math.min(0.7, scene.startSeconds)
  player.seek(scene.startSeconds - leadInSeconds)
  await player.play()
  animationPreviewTimer = window.setTimeout(
    () => {
      player.pause()
      player.seek(scenePreviewTime(scene))
      setMotionPreviewBadge('')
      motionPreviewLabel = ''
    },
    leadInSeconds * 1000 +
      Math.min(2200, Math.max(900, scene.durationSeconds * 450)),
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
  document.body.classList.toggle('canvas-is-open', isOpen)
  const fullscreenButton = $('#canvas-fullscreen') as HTMLButtonElement
  fullscreenButton.textContent = isOpen ? '×' : '↗'
  fullscreenButton.setAttribute(
    'aria-label',
    isOpen ? 'Close full-screen canvas' : 'Open canvas full screen',
  )
  syncLiveCameraToggle()
}

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
        takeSelect.addEventListener('change', () => {
          const take = takes.find(item => item.recordingId === takeSelect.value)
          if (take) {
            selectRecordedTake(scene.id, take)
            renderPublishBlockList()
          }
        })
        controls.append(takeSelect)
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

const openPublishSummary = () => {
  publishExcluded.clear()
  ;($('#render-result') as HTMLElement).hidden = true
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
