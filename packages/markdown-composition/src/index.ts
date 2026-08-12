import type {
  BlockRenderConfigV1,
  BlockBackgroundPreset,
  CompiledComposition,
  ProjectDocumentV1,
  Scene,
  SceneLayout,
  ThemeBlockRendering,
  TiptapMark,
  TiptapNode,
} from './types'
import { defaultBrand, defaultThemeBlocks, normalizeStudioTheme } from './themes'
import { normalizedRectStyle, presenterLayoutGeometry } from './presenter-layouts'

export * from './types'
export * from './themes'
export * from './presenter-layouts'

const incredibleMarkPath =
  'M8.96168 0.740305C7.9746 -0.246768 6.37424 -0.246768 5.38717 0.740304L0.740312 5.38716C-0.24676 6.37423 -0.246761 7.9746 0.740312 8.96167L1.99139 10.2127C2.97846 11.1998 2.97846 12.8002 1.99139 13.7872L0.740304 15.0383C-0.246768 16.0254 -0.246768 17.6258 0.740304 18.6128L5.38716 23.2597C6.37423 24.2468 7.9746 24.2468 8.96167 23.2597L10.2127 22.0086C11.1998 21.0215 12.8002 21.0215 13.7873 22.0086L15.0383 23.2597C16.0254 24.2468 17.6258 24.2468 18.6128 23.2597L23.2597 18.6128C24.2468 17.6258 24.2468 16.0254 23.2597 15.0383L22.0086 13.7873C21.0215 12.8002 21.0215 11.1998 22.0086 10.2127L23.2597 8.96167C24.2468 7.9746 24.2468 6.37424 23.2597 5.38716L18.6128 0.740305C17.6258 -0.246767 16.0254 -0.246766 15.0383 0.740307L13.7873 1.99138C12.8002 2.97845 11.1998 2.97845 10.2127 1.99138L8.96168 0.740305Z'

const renderIncredibleBrand = (sceneIndex: number) => {
  const gradientId = `incredible-gradient-${sceneIndex}`
  return `<span class="composition-brand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${incredibleMarkPath}" fill="url(#${gradientId})"/><defs><linearGradient id="${gradientId}" x1="3.13253" y1="3.46988" x2="20.9639" y2="20.7229" gradientUnits="userSpaceOnUse"><stop stop-color="#4ADE80"/><stop offset="1" stop-color="#16A34A"/></linearGradient></defs></svg><strong>incredible</strong></span>`
}

const defaultLayoutForNode = (node: TiptapNode): SceneLayout => {
  if (node.type === 'heading' && node.attrs?.level === 1) return 'title'
  if (node.type === 'codeBlock') return 'code'
  return 'prose'
}

const defaultAppearanceForNode = (node: TiptapNode) => {
  const kind = node.type === 'heading'
    ? 'title'
    : node.type === 'codeBlock'
      ? 'code'
      : node.type === 'bulletList' || node.type === 'orderedList'
        ? 'list'
        : node.type === 'blockquote'
          ? 'quote'
          : 'content'
  return {
    layout: defaultThemeBlocks.layout[kind],
    render: defaultThemeBlocks[kind] as ThemeBlockRendering,
    codeTheme: defaultThemeBlocks.codeTheme,
    codeAnimation: defaultThemeBlocks.codeAnimation,
  }
}

export const createDefaultBlockConfig = (
  nodeId: string,
  node: TiptapNode,
): BlockRenderConfigV1 => ({
  nodeId,
  layout: defaultLayoutForNode(node),
  durationMs: node.type === 'codeBlock' ? 7000 : 5000,
  reveal: node.type === 'codeBlock' ? 'line-by-line' : 'rise',
  alignment: node.type === 'heading' ? 'center' : 'left',
  background: {
    preset: 'brand',
    color: defaultBrand.background,
  },
  camera: {
    mode: 'information-circle',
    position: 'bottom-right',
    shape: 'circle',
    scale: 1,
  },
  appearance: defaultAppearanceForNode(node),
})

const allowedValue = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  fallback: Value,
) =>
  typeof value === 'string' && allowed.includes(value as Value)
    ? (value as Value)
    : fallback

const normalizeBlockConfig = (
  nodeId: string,
  node: TiptapNode,
  supplied: BlockRenderConfigV1 | undefined,
): BlockRenderConfigV1 => {
  const fallback = createDefaultBlockConfig(nodeId, node)
  if (!supplied) return fallback

  return {
    nodeId,
    layout: allowedValue(
      supplied.layout,
      ['title', 'prose', 'code', 'split'] as const,
      fallback.layout,
    ),
    durationMs: Number.isFinite(supplied.durationMs)
      ? supplied.durationMs
      : fallback.durationMs,
    reveal: allowedValue(
      supplied.reveal,
      ['none', 'fade', 'rise', 'fall', 'slide-left', 'slide-right', 'scale', 'blur', 'type', 'wipe', 'pop', 'line-by-line'] as const,
      fallback.reveal,
    ),
    alignment: allowedValue(
      supplied.alignment,
      ['left', 'center'] as const,
      fallback.alignment,
    ),
    background: {
      preset: allowedValue(
        supplied.background?.preset,
        [
          'brand',
          'violet',
          'sunset',
          'ocean',
          'mint',
          'rose',
          'paper',
          'charcoal',
          'custom',
        ] as const,
        fallback.background.preset,
      ),
      color: safeColor(
        supplied.background?.color,
        fallback.background.color,
      ),
    },
    camera: {
      mode: allowedValue(
        supplied.camera?.mode,
        [
          'information-circle',
          'information-tile',
          'portrait-overlay',
          'portrait-rail',
          'split',
          'person-background-left',
          'person-background-right',
          'person-only',
        ] as const,
        fallback.camera.mode,
      ),
      position: allowedValue(
        supplied.camera?.position,
        [
          'hidden',
          'full',
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
          'overlay-left',
          'overlay-right',
          'split-left',
          'split-right',
        ] as const,
        fallback.camera.position,
      ),
      shape: allowedValue(
        supplied.camera?.shape,
        ['circle', 'rounded-rectangle'] as const,
        fallback.camera.shape,
      ),
      scale: Number.isFinite(supplied.camera?.scale)
        ? supplied.camera.scale
        : fallback.camera.scale,
    },
    appearance: {
      layout: allowedValue(
        supplied.appearance?.layout,
        ['center', 'left', 'right', 'upper', 'lower', 'split-left', 'split-right', 'full'] as const,
        fallback.appearance.layout,
      ),
      render: allowedValue(
        supplied.appearance?.render,
        ['statement', 'split', 'lower-third', 'editorial', 'framed', 'gradient', 'outline', 'highlight', 'compact', 'card', 'columns', 'lede', 'callout', 'caption', 'bullets', 'cards', 'timeline', 'steps', 'pills', 'checklist', 'number-grid', 'spotlight', 'panel', 'terminal', 'full', 'editor', 'glass', 'minimal', 'paper', 'bar', 'pull', 'speech', 'oversized'] as const,
        fallback.appearance.render,
      ),
      codeTheme: allowedValue(
        supplied.appearance?.codeTheme,
        ['light_vs', 'light_plus', 'quietlight', 'solarized_light', 'abyss', 'dark_vs', 'dark_plus', 'kimbie_dark', 'monokai', 'monokai_dimmed', 'red', 'solarized_dark', 'tomorrow_night_blue', 'hc_black'] as const,
        fallback.appearance.codeTheme,
      ),
      codeAnimation: allowedValue(
        supplied.appearance?.codeAnimation,
        ['type-lines', 'highlight-lines'] as const,
        fallback.appearance.codeAnimation,
      ),
    },
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const scriptString = (value: string) =>
  JSON.stringify(value).replaceAll('<', '\\u003c')

const safeColor = (value: string, fallback: string) =>
  /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|hsl\([\d\s,.%]+\))$/i.test(value)
    ? value
    : fallback

const backgroundValue = (
  preset: BlockBackgroundPreset,
  customColor: string,
  brandBackground: string,
) => {
  const presets: Record<BlockBackgroundPreset, string> = {
    brand: brandBackground,
    violet: 'linear-gradient(135deg, #d8b4fe 0%, #7c3aed 100%)',
    sunset: 'linear-gradient(135deg, #fda4af 0%, #fb923c 100%)',
    ocean: 'linear-gradient(135deg, #93c5fd 0%, #2563eb 100%)',
    mint: 'linear-gradient(135deg, #a7f3d0 0%, #14b8a6 100%)',
    rose: 'linear-gradient(135deg, #fbcfe8 0%, #e879f9 100%)',
    paper: '#f9fafb',
    charcoal: '#27272a',
    custom: safeColor(customColor, brandBackground),
  }
  return presets[preset]
}

const safeUrl = (value: unknown) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value, 'http://localhost')
    if (!['http:', 'https:', 'blob:'].includes(url.protocol)) return null
    return value
  } catch {
    return null
  }
}

const renderText = (text: string, marks: TiptapMark[] = []) => {
  let html = escapeHtml(text)
  marks.forEach(mark => {
    if (mark.type === 'bold') html = `<strong>${html}</strong>`
    if (mark.type === 'italic') html = `<em>${html}</em>`
    if (mark.type === 'strike') html = `<s>${html}</s>`
    if (mark.type === 'code') html = `<code>${html}</code>`
    if (mark.type === 'link') {
      const href = safeUrl(mark.attrs?.href)
      if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`
    }
  })
  return html
}

const renderChildren = (node: TiptapNode): string =>
  (node.content || []).map(renderNode).join('')

const codeKeywords = new Set([
  'async', 'await', 'break', 'case', 'class', 'const', 'continue', 'default',
  'else', 'export', 'extends', 'false', 'for', 'from', 'function', 'if',
  'import', 'in', 'interface', 'let', 'new', 'null', 'return', 'static',
  'switch', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'while',
])

const renderCodeLine = (line: string) => {
  const pattern = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\()|\b[A-Za-z_$][\w$]*\b)/g
  let cursor = 0
  let markup = ''
  for (const match of line.matchAll(pattern)) {
    const index = match.index || 0
    const token = match[0]
    markup += escapeHtml(line.slice(cursor, index))
    const tokenClass = token.startsWith('//') || token.startsWith('/*')
      ? 'comment'
      : /^['"`]/.test(token)
        ? 'string'
        : /^\d/.test(token)
          ? 'number'
          : codeKeywords.has(token)
            ? 'keyword'
            : line.slice(index + token.length).match(/^\s*\(/)
              ? 'function'
              : 'variable'
    markup += `<span class="code-token-${tokenClass}">${escapeHtml(token)}</span>`
    cursor = index + token.length
  }
  markup += escapeHtml(line.slice(cursor))
  return markup || '&nbsp;'
}

const renderNode = (node: TiptapNode): string => {
  if (node.type === 'text') return renderText(node.text || '', node.marks)
  const children = renderChildren(node)

  switch (node.type) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2))
      return `<h${level}>${children}</h${level}>`
    }
    case 'paragraph':
      return `<p>${children || '&nbsp;'}</p>`
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`
    case 'bulletList':
      return `<ul>${children}</ul>`
    case 'orderedList':
      return `<ol>${children}</ol>`
    case 'listItem':
      return `<li>${children}</li>`
    case 'codeBlock':
      return `<pre><code>${(node.content || [])
        .map(child => child.text || '')
        .join('')
        .split('\n')
        .map(
          (line, index) =>
            `<span class="code-line" data-line="${index + 1}">${renderCodeLine(line)}</span>`,
        )
        .join('')}</code></pre>`
    case 'horizontalRule':
      return '<hr />'
    case 'hardBreak':
      return '<br />'
    default:
      return children
  }
}

const textContent = (node: TiptapNode): string => {
  if (node.type === 'text') return node.text || ''
  return (node.content || []).map(textContent).join(' ').replace(/\s+/g, ' ').trim()
}

const sceneKind = (node: TiptapNode): Scene['kind'] => {
  if (node.type === 'heading') return 'title'
  if (node.type === 'codeBlock') return 'code'
  if (node.type === 'bulletList' || node.type === 'orderedList') return 'list'
  if (node.type === 'blockquote') return 'quote'
  return 'content'
}

const assertProject = (project: ProjectDocumentV1) => {
  if (project.version !== 1) throw new Error('Unsupported project version')
  if (project.notebook.type !== 'doc' || !Array.isArray(project.notebook.content)) {
    throw new Error('Project notebook must be a Tiptap document')
  }
  if (project.width < 320 || project.width > 3840) {
    throw new Error('Project width is outside the supported range')
  }
  if (project.height < 320 || project.height > 2160) {
    throw new Error('Project height is outside the supported range')
  }
}

const cameraClass = (position: string) =>
  position === 'hidden' ? 'camera-hidden' : `camera-${position}`

const buildCompositionHtml = (
  project: ProjectDocumentV1,
  scenes: Scene[],
  durationSeconds: number,
  gsapUrl: string,
  hyperframesRuntimeUrl: string,
  previewPresenter?: { imageUrl: string; name?: string },
) => {
  const theme = normalizeStudioTheme(project.theme, project.brand)
  const brand = {
    background: safeColor(theme.brand.background, defaultBrand.background),
    surface: safeColor(theme.brand.surface, defaultBrand.surface),
    text: safeColor(theme.brand.text, defaultBrand.text),
    mutedText: safeColor(theme.brand.mutedText, defaultBrand.mutedText),
    primary: safeColor(theme.brand.primary, defaultBrand.primary),
    secondary: safeColor(theme.brand.secondary, defaultBrand.secondary),
    accent: safeColor(theme.brand.accent, defaultBrand.accent),
    codeBackground: safeColor(
      theme.brand.codeBackground,
      defaultBrand.codeBackground,
    ),
  }
  const canvasGradient = theme.canvas.gradient.map((color, index) =>
    safeColor(color, index ? brand.accent : brand.primary),
  ) as [string, string]
  const gridColor = safeColor(theme.canvas.gridColor, '#ffffff20')
  const canvasBackground =
    theme.canvas.treatment === 'grid'
      ? `linear-gradient(90deg, transparent calc(20% - 1px), ${gridColor} 20%, transparent calc(20% + 1px)), ${brand.background}`
      : theme.canvas.treatment === 'gradient'
        ? `linear-gradient(135deg, ${canvasGradient[0]} 0%, ${canvasGradient[1]} 100%)`
        : brand.background
  const videoBorderWidth = Math.min(
    28,
    Math.max(0, Number(theme.video.borderWidth) || 0),
  )
  const videoBorderRadius = Math.min(
    180,
    Math.max(0, Number(theme.video.borderRadius) || 0),
  )
  const blockBorderRadius = Math.min(
    120,
    Math.max(0, Number(theme.blocks.borderRadius) || 0),
  )
  const logoUrl = safeUrl(theme.logo.url)
  const logoSize = Math.min(160, Math.max(18, Number(theme.logo.size) || 28))
  const userLogoMarkup = logoUrl
    ? `<span class="composition-brand user-brand"><img src="${escapeHtml(logoUrl)}" alt="" /></span>`
    : ''

  const sceneMarkup = scenes
    .map(scene => {
      const cameraGeometry = presenterLayoutGeometry(
        scene.config.camera.mode,
        scene.kind,
      )
      const cameraGeometryStyle = normalizedRectStyle(cameraGeometry.camera)
      const presenterMarkup = scene.presenterTracks
        .map((track, trackIndex) => {
          if (track.kind === 'narration') {
            const audioUrl = safeUrl(track.audioUrl)
            return audioUrl
              ? `<audio data-start="${scene.startSeconds}" data-duration="${scene.durationSeconds}" data-track-index="${20 + trackIndex}" src="${escapeHtml(audioUrl)}"></audio>`
              : ''
          }

          const videoUrl = safeUrl(track.videoUrl)
          const audioUrl = safeUrl(track.audioUrl)
          const cameraScale = Math.min(
            1.6,
            Math.max(0.6, scene.config.camera.scale),
          )
          const muted = track.audioKind === 'recorded-mic' && !audioUrl ? '' : ' muted'
          const video = videoUrl
            ? `<video class="camera camera-kind-${scene.kind} clip ${cameraClass(scene.config.camera.position)} ${scene.config.camera.shape} presenter-${scene.config.camera.mode}" style="--camera-scale:${cameraScale};${cameraGeometryStyle}" data-start="${scene.startSeconds}" data-duration="${scene.durationSeconds}" data-track-index="${10 + trackIndex}" src="${escapeHtml(videoUrl)}"${muted} playsinline></video>`
            : ''
          const audio = audioUrl
            ? `<audio data-start="${scene.startSeconds}" data-duration="${scene.durationSeconds}" data-track-index="${20 + trackIndex}" src="${escapeHtml(audioUrl)}"></audio>`
            : ''
          return `${video}${audio}`
        })
        .join('')
      const hasRecordedCamera = scene.presenterTracks.some(
        track => track.kind === 'human-camera' && safeUrl(track.videoUrl),
      )
      const previewPresenterUrl = hasRecordedCamera
        ? null
        : safeUrl(previewPresenter?.imageUrl)
      const previewPresenterMarkup = previewPresenterUrl
        ? `<img class="camera camera-kind-${scene.kind} preview-camera ${cameraClass(scene.config.camera.position)} ${scene.config.camera.shape} presenter-${scene.config.camera.mode}" style="--camera-scale:${Math.min(1.6, Math.max(0.6, scene.config.camera.scale))};${cameraGeometryStyle}" src="${escapeHtml(previewPresenterUrl)}" alt="${escapeHtml(previewPresenter?.name || 'Sample presenter')}" data-preview-presenter="true" />`
        : ''

      return `<section
        id="scene-${scene.index}"
        class="scene clip scene-kind-${scene.kind} layout-${scene.config.layout} align-${scene.config.alignment} presenter-${scene.config.camera.mode} camera-position-${scene.config.camera.position} theme-layout-${scene.config.appearance.layout} theme-render-${scene.config.appearance.render} code-theme-${scene.config.appearance.codeTheme} code-animation-${scene.config.appearance.codeAnimation}"
        data-start="${scene.startSeconds}"
        data-duration="${scene.durationSeconds}"
        data-track-index="${scene.index}"
        data-node-id="${escapeHtml(scene.id)}"
        data-reveal="${scene.config.reveal}"
        data-render-style="${scene.config.appearance.render}"
        data-block-layout="${scene.config.appearance.layout}"
        data-background-preset="${scene.config.background.preset}"
        style="--scene-background:${escapeHtml(
          backgroundValue(
            scene.config.background.preset,
            scene.config.background.color,
            canvasBackground,
          ),
        )}"
      >
        ${
          userLogoMarkup && theme.logo.placement.startsWith('top-')
            ? `<div class="composition-corner-logo logo-${theme.logo.placement}">${userLogoMarkup}</div>`
            : ''
        }
        <div class="scene-index">${String(scene.index + 1).padStart(2, '0')}</div>
        <main class="content">${renderNode(scene.node)}</main>
        <footer class="logo-${theme.logo.placement}">${
          theme.logo.placement.startsWith('footer-')
            ? userLogoMarkup || renderIncredibleBrand(scene.index)
            : ''
        }<span>${escapeHtml(project.title)}</span></footer>
        ${previewPresenterMarkup}
      </section>${presenterMarkup}`
    })
    .join('\n')

  const animationMarkup = scenes
    .map(scene => {
      const selector = scriptString(`#scene-${scene.index} .content`)
      const sequenceSelector = scriptString(
        scene.kind === 'list'
          ? `#scene-${scene.index} .content li`
          : scene.kind === 'code'
            ? `#scene-${scene.index} .content .code-line`
            : `#scene-${scene.index} .content > *`,
      )
      const start = scene.startSeconds
      let entrance: string
      switch (scene.config.reveal) {
        case 'none':
          entrance = `tl.set(${selector}, { opacity: 1 }, ${start});`
          break
        case 'fade':
          entrance = `tl.fromTo(${selector}, { opacity: 0 }, { opacity: 1, duration: 0.65, ease: "power2.out" }, ${start});`
          break
        case 'fall':
          entrance = `tl.fromTo(${selector}, { opacity: 0, y: -56 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3.out" }, ${start});`
          break
        case 'slide-left':
          entrance = `tl.fromTo(${selector}, { opacity: 0, x: -90 }, { opacity: 1, x: 0, duration: 0.78, ease: "power3.out" }, ${start});`
          break
        case 'slide-right':
          entrance = `tl.fromTo(${selector}, { opacity: 0, x: 90 }, { opacity: 1, x: 0, duration: 0.78, ease: "power3.out" }, ${start});`
          break
        case 'scale':
          entrance = `tl.fromTo(${selector}, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.72, ease: "power3.out" }, ${start});`
          break
        case 'blur':
          entrance = `tl.fromTo(${selector}, { opacity: 0, filter: "blur(24px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.82, ease: "power2.out" }, ${start});`
          break
        case 'type':
          entrance = `tl.fromTo(${selector}, { opacity: 1, clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${Math.min(2.4, scene.durationSeconds * 0.45)}, ease: "steps(18)" }, ${start});`
          break
        case 'wipe':
          entrance = `tl.fromTo(${selector}, { opacity: 1, clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.82, ease: "power3.inOut" }, ${start});`
          break
        case 'pop':
          entrance = `tl.fromTo(${selector}, { opacity: 0, scale: 0.72, rotation: -2 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.72, ease: "back.out(1.7)" }, ${start});`
          break
        case 'line-by-line':
          entrance = `tl.set(${selector}, { opacity: 1 }, ${start}); tl.fromTo(${sequenceSelector}, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.48, stagger: ${Math.min(0.28, scene.durationSeconds * 0.06)}, ease: "power3.out" }, ${start});`
          break
        case 'rise':
        default:
          entrance = `tl.fromTo(${selector}, { opacity: 0, y: 56 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3.out" }, ${start});`
      }
      if (scene.kind !== 'code') return entrance
      const codeMotion = scene.config.appearance.codeAnimation === 'highlight-lines'
        ? ` tl.set(${sequenceSelector}, { opacity: 0.24 }, ${start + 0.28}); tl.to(${sequenceSelector}, { opacity: 1, duration: 0.38, stagger: 0.55, ease: "power2.inOut" }, ${start + 0.32});`
        : ` tl.fromTo(${sequenceSelector}, { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.62, stagger: 0.3, ease: "steps(12)" }, ${start + 0.24});`
      return `${entrance}${codeMotion}`
    })
    .join('\n      ')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${project.width}, height=${project.height}" />
  <meta data-composition-id="${escapeHtml(project.id)}" data-width="${project.width}" data-height="${project.height}" />
  <title>${escapeHtml(project.title)}</title>
  <script src="${escapeHtml(gsapUrl)}"></script>
  <style>
    :root { --bg:${brand.background}; --surface:${brand.surface}; --text:${brand.text}; --muted:${brand.mutedText}; --primary:${brand.primary}; --secondary:${brand.secondary}; --accent:${brand.accent}; --code:${brand.codeBackground}; --theme-canvas:${canvasBackground}; --theme-gradient:linear-gradient(135deg, ${canvasGradient[0]}, ${canvasGradient[1]}); --brand-gradient:linear-gradient(135deg, var(--primary), var(--secondary), var(--accent)); --block-radius:${blockBorderRadius}px; --video-border-width:${videoBorderWidth}px; --video-radius:${videoBorderRadius}px; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: var(--bg); }
    body { color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #composition { position: relative; width: ${project.width}px; height: ${project.height}px; overflow: hidden; background: var(--theme-canvas); }
    .clip { visibility: hidden; }
    .scene { --content-layout-width: 1500px; --presenter-safe-width: 100%; position: absolute; inset: 0; padding: 112px 132px 84px; display: grid; grid-template-rows: auto 1fr auto; gap: 42px; background: var(--scene-background, var(--theme-canvas)); }
    .scene > .scene-index, .scene > .content, .scene > footer, .scene > .composition-corner-logo { position: relative; z-index: 22; }
    .scene > * { position: relative; z-index: 25; }
    .scene::before { content: ""; position: absolute; z-index: 24; inset: 42px; border: 2px solid color-mix(in srgb, var(--text) 12%, transparent); border-radius: var(--block-radius); pointer-events: none; }
    #composition[data-surface-style="none"] .scene::before { display: none; }
    #composition[data-surface-style="card"] .scene::before { border-color: transparent; background: color-mix(in srgb, var(--surface) 78%, transparent); box-shadow: 0 32px 90px rgba(0,0,0,.16); }
    .scene-index { color: var(--primary); font-size: 24px; font-weight: 800; letter-spacing: .18em; }
    .content { align-self: center; width: min(100%, var(--content-layout-width), var(--presenter-safe-width)); max-width: min(100%, var(--content-layout-width), var(--presenter-safe-width)); min-width: 0; overflow-wrap: anywhere; }
    .align-center .content { margin-inline: auto; text-align: center; }
    h1, h2, h3 { max-width: 100%; margin: 0; font-weight: 760; letter-spacing: -.055em; line-height: .98; text-wrap: balance; overflow-wrap: anywhere; }
    h1 { font-size: 124px; } h2 { font-size: 94px; } h3 { font-size: 74px; }
    p, li, blockquote { max-width: 100%; font-size: 55px; line-height: 1.24; letter-spacing: -.025em; overflow-wrap: anywhere; }
    p { margin: 0 0 28px; } ul, ol { margin: 0; padding-left: 1.1em; } li { margin: 0 0 22px; padding-left: .25em; }
    .scene-kind-list.theme-render-bullets li::marker { color: var(--accent); }
    .scene-kind-list.theme-render-cards ul, .scene-kind-list.theme-render-cards ol { padding: 0; display: grid; gap: 18px; list-style: none; }
    .scene-kind-list.theme-render-cards li { margin: 0; padding: 27px 34px; border: 2px solid color-mix(in srgb, var(--accent) 66%, transparent); border-radius: var(--block-radius); background: color-mix(in srgb, var(--surface) 86%, transparent); }
    .scene-kind-list.theme-render-timeline ul, .scene-kind-list.theme-render-timeline ol { padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 26px; list-style: none; counter-reset: theme-step; }
    .scene-kind-list.theme-render-timeline li { margin: 0; padding-top: 86px; position: relative; font-size: 36px; text-align: center; counter-increment: theme-step; }
    .scene-kind-list.theme-render-timeline li::before { content: counter(theme-step); position: absolute; top: 0; left: 50%; width: 64px; height: 64px; translate: -50% 0; display: grid; place-items: center; border-radius: 50%; background: var(--brand-gradient); color: white; font-size: 24px; font-weight: 800; }
    .scene-kind-list.theme-render-steps ol, .scene-kind-list.theme-render-steps ul { padding: 0; list-style: none; counter-reset: theme-step; }
    .scene-kind-list.theme-render-steps li { position: relative; margin-bottom: 28px; padding-left: 88px; counter-increment: theme-step; }
    .scene-kind-list.theme-render-steps li::before { content: counter(theme-step, decimal-leading-zero); position: absolute; left: 0; color: var(--primary); font-weight: 800; }
    .scene-kind-list.theme-render-pills ul, .scene-kind-list.theme-render-pills ol { display: flex; flex-wrap: wrap; gap: 20px; padding: 0; list-style: none; }
    .scene-kind-list.theme-render-pills li { margin: 0; padding: 18px 30px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
    .scene-kind-list.theme-render-checklist ul, .scene-kind-list.theme-render-checklist ol { padding: 0; list-style: none; }
    .scene-kind-list.theme-render-checklist li { position: relative; padding-left: 76px; }
    .scene-kind-list.theme-render-checklist li::before { content: "✓"; position: absolute; left: 0; top: .05em; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; background: var(--brand-gradient); color: white; font-size: 25px; font-weight: 900; }
    .scene-kind-list.theme-render-number-grid ul, .scene-kind-list.theme-render-number-grid ol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; padding: 0; list-style: none; counter-reset: theme-step; }
    .scene-kind-list.theme-render-number-grid li { position: relative; min-height: 150px; margin: 0; padding: 34px 34px 28px 98px; border: 2px solid color-mix(in srgb, var(--text) 14%, transparent); border-radius: var(--block-radius); counter-increment: theme-step; }
    .scene-kind-list.theme-render-number-grid li::before { content: counter(theme-step, decimal-leading-zero); position: absolute; left: 30px; color: var(--accent); font-size: 28px; font-weight: 900; }
    .scene-kind-list.theme-render-spotlight li { opacity: .46; }
    .scene-kind-list.theme-render-spotlight li:first-child { opacity: 1; font-size: 1.24em; color: var(--text); }
    .scene-kind-list.theme-render-columns ul, .scene-kind-list.theme-render-columns ol { columns: 2; column-gap: 80px; }
    .scene-kind-list.theme-render-compact li { margin-bottom: 10px; font-size: 42px; line-height: 1.15; }
    strong { color: var(--accent); } a { color: var(--accent); text-decoration: none; }
    blockquote { margin: 0; padding: 16px 0 16px 40px; border-left: 12px solid var(--primary); color: var(--muted); }
    .scene-kind-quote.theme-render-card blockquote { padding: 48px; border: 0; border-radius: var(--block-radius); background: var(--surface); color: var(--text); }
    .scene-kind-quote.theme-render-statement blockquote { padding: 0; border: 0; color: var(--text); font-size: 76px; font-weight: 750; }
    .scene-kind-quote.theme-render-pull blockquote { position: relative; padding: 40px 0 0 112px; border: 0; color: var(--text); font-size: 70px; }
    .scene-kind-quote.theme-render-pull blockquote::before { content: "“"; position: absolute; left: 0; top: -28px; color: var(--primary); font-size: 170px; line-height: 1; }
    .scene-kind-quote.theme-render-speech blockquote { position: relative; padding: 54px; border: 0; border-radius: var(--block-radius); background: var(--surface); color: var(--text); }
    .scene-kind-quote.theme-render-speech blockquote::after { content: ""; position: absolute; left: 64px; bottom: -30px; border: 16px solid transparent; border-top-color: var(--surface); }
    .scene-kind-quote.theme-render-highlight blockquote { display: inline; padding: 8px 18px; border: 0; background: var(--accent); color: var(--bg); box-decoration-break: clone; }
    .scene-kind-quote.theme-render-framed blockquote { padding: 54px; border: 3px solid var(--accent); border-radius: var(--block-radius); color: var(--text); }
    .scene-kind-quote.theme-render-minimal blockquote { padding: 0; border: 0; color: var(--text); }
    .scene-kind-quote.theme-render-oversized blockquote { padding: 0; border: 0; color: var(--text); font-size: 96px; font-weight: 800; line-height: 1; }
    pre { width: 100%; min-width: 0; max-width: 100%; margin: 0; padding: 54px; border-radius: var(--block-radius); background: var(--code-theme-bg, var(--code)); color: var(--code-theme-text, #f7f7ef); box-shadow: 0 32px 80px rgba(0,0,0,.16); overflow: hidden; }
    .code-token-keyword { color: var(--code-theme-keyword, #c586c0); }
    .code-token-variable { color: var(--code-theme-variable, #9cdcfe); }
    .code-token-function { color: var(--code-theme-function, #dcdcaa); }
    .code-token-string { color: var(--code-theme-string, #ce9178); }
    .code-token-number { color: var(--code-theme-number, #b5cea8); }
    .code-token-comment { color: var(--code-theme-comment, #6a9955); font-style: italic; }
    .code-theme-light_vs { --code-theme-bg:#fff; --code-theme-text:#000; --code-theme-keyword:#00f; --code-theme-variable:#001080; --code-theme-function:#795e26; --code-theme-string:#a31515; --code-theme-number:#098658; --code-theme-comment:#008000; }
    .code-theme-light_plus { --code-theme-bg:#fff; --code-theme-text:#000; --code-theme-keyword:#af00db; --code-theme-variable:#001080; --code-theme-function:#795e26; --code-theme-string:#a31515; --code-theme-number:#098658; --code-theme-comment:#008000; }
    .code-theme-quietlight { --code-theme-bg:#f5f5f5; --code-theme-text:#333; --code-theme-keyword:#7a3f9d; --code-theme-variable:#4b83cd; --code-theme-function:#aa3731; --code-theme-string:#448c27; --code-theme-number:#ab6526; --code-theme-comment:#aaaaaa; }
    .code-theme-solarized_light { --code-theme-bg:#fdf6e3; --code-theme-text:#657b83; --code-theme-keyword:#859900; --code-theme-variable:#268bd2; --code-theme-function:#b58900; --code-theme-string:#2aa198; --code-theme-number:#d33682; --code-theme-comment:#93a1a1; }
    .code-theme-abyss { --code-theme-bg:#000c18; --code-theme-text:#6688cc; --code-theme-keyword:#9966b8; --code-theme-variable:#2277ff; --code-theme-function:#ddbb88; --code-theme-string:#22aa44; --code-theme-number:#f280d0; --code-theme-comment:#384887; }
    .code-theme-dark_vs { --code-theme-bg:#1e1e1e; --code-theme-text:#d4d4d4; --code-theme-keyword:#569cd6; --code-theme-variable:#9cdcfe; --code-theme-function:#dcdcaa; --code-theme-string:#d69d85; --code-theme-number:#b5cea8; --code-theme-comment:#57a64a; }
    .code-theme-dark_plus { --code-theme-bg:#1e1e1e; --code-theme-text:#d4d4d4; --code-theme-keyword:#c586c0; --code-theme-variable:#9cdcfe; --code-theme-function:#dcdcaa; --code-theme-string:#ce9178; --code-theme-number:#b5cea8; --code-theme-comment:#6a9955; }
    .code-theme-kimbie_dark { --code-theme-bg:#221a0f; --code-theme-text:#d3af86; --code-theme-keyword:#98676a; --code-theme-variable:#dc3958; --code-theme-function:#8ab1b0; --code-theme-string:#889b4a; --code-theme-number:#f79a32; --code-theme-comment:#a57a4c; }
    .code-theme-monokai { --code-theme-bg:#272822; --code-theme-text:#f8f8f2; --code-theme-keyword:#f92672; --code-theme-variable:#fd971f; --code-theme-function:#a6e22e; --code-theme-string:#e6db74; --code-theme-number:#ae81ff; --code-theme-comment:#75715e; }
    .code-theme-monokai_dimmed { --code-theme-bg:#1e1e1e; --code-theme-text:#c5c8c6; --code-theme-keyword:#676867; --code-theme-variable:#c7444a; --code-theme-function:#9872a2; --code-theme-string:#d08442; --code-theme-number:#6089b4; --code-theme-comment:#88846f; }
    .code-theme-red { --code-theme-bg:#390000; --code-theme-text:#f8f8f8; --code-theme-keyword:#ff9da4; --code-theme-variable:#ff6262; --code-theme-function:#f8f8f8; --code-theme-string:#f1d710; --code-theme-number:#ff628c; --code-theme-comment:#e7c0c0; }
    .code-theme-solarized_dark { --code-theme-bg:#002b36; --code-theme-text:#839496; --code-theme-keyword:#859900; --code-theme-variable:#268bd2; --code-theme-function:#b58900; --code-theme-string:#2aa198; --code-theme-number:#d33682; --code-theme-comment:#586e75; }
    .code-theme-tomorrow_night_blue { --code-theme-bg:#002451; --code-theme-text:#fff; --code-theme-keyword:#ff9da4; --code-theme-variable:#ffc58f; --code-theme-function:#d1f1a9; --code-theme-string:#ffeead; --code-theme-number:#bbdaff; --code-theme-comment:#7285b7; }
    .code-theme-hc_black { --code-theme-bg:#000; --code-theme-text:#fff; --code-theme-keyword:#c586c0; --code-theme-variable:#9cddfe; --code-theme-function:#ffff00; --code-theme-string:#ce9178; --code-theme-number:#b5cea8; --code-theme-comment:#7ca668; }
    .scene-kind-code.theme-render-terminal pre { border: 3px solid var(--accent); border-image: var(--brand-gradient) 1; }
    .scene-kind-code.theme-render-terminal pre::before { content: "●  ●  ●"; display: block; margin-bottom: 30px; color: var(--primary); font: 22px/1 ui-monospace, monospace; letter-spacing: .35em; }
    .scene-kind-code.theme-render-full { padding: 72px; --content-layout-width: 100%; }
    .scene-kind-code.theme-render-full .content, .scene-kind-code.theme-render-full pre { height: 100%; }
    .scene-kind-code.theme-render-editor pre::before { content: "index.ts   README.md   package.json"; display: block; margin: -54px -54px 36px; padding: 22px 32px; background: color-mix(in srgb, var(--surface) 9%, var(--code)); color: var(--muted); font: 20px/1 ui-monospace, monospace; }
    .scene-kind-code.theme-render-glass pre { border: 2px solid color-mix(in srgb, white 34%, transparent); background: color-mix(in srgb, var(--code) 78%, transparent); backdrop-filter: blur(28px); }
    .scene-kind-code.theme-render-minimal pre { padding: 20px 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--text); }
    .scene-kind-code.theme-render-spotlight pre { border-left: 12px solid var(--accent); }
    .scene-kind-code.theme-render-split .content { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr); gap: 36px; align-items: center; }
    .scene-kind-code.theme-render-split .content::after { content: "Explain the decision\\A then show the code."; white-space: pre-line; color: var(--muted); font-size: 34px; line-height: 1.35; }
    .scene-kind-code.theme-render-paper pre { background: #f6f2e8; color: #17222b; box-shadow: 0 22px 70px rgba(0,0,0,.12); }
    pre code { font: 42px/1.5 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
    .code-line { display: block; min-height: 1.5em; }
    .layout-title { --content-layout-width: 1600px; }
    .layout-title h1, .layout-title h2 { font-size: 142px; }
    .layout-code { --content-layout-width: 1650px; }
    .layout-split { --content-layout-width: 58%; }
    .layout-split .content { margin-left: 0; text-align: left; }
    .scene-kind-code.layout-split { --content-layout-width: 100%; }
    .scene-kind-code.layout-code pre { min-height: 540px; }
    .scene-kind-code.layout-split pre { min-height: 660px; }
    .scene-kind-title.theme-render-split { --content-layout-width: 56%; }
    .scene-kind-title.theme-render-split .content { margin-left: 0; text-align: left; }
    .scene-kind-title.theme-render-lower-third { --content-layout-width: 72%; }
    .scene-kind-title.theme-render-lower-third .content { align-self: end; margin: 0 0 44px; text-align: left; }
    .scene-kind-title.theme-render-editorial h1, .scene-kind-title.theme-render-editorial h2 { max-width: 13ch; font-family: Georgia, serif; font-weight: 500; letter-spacing: -.04em; }
    .scene-kind-title.theme-render-framed .content { padding: 64px; border: 4px solid var(--accent); border-radius: var(--block-radius); }
    .scene-kind-title.theme-render-gradient h1, .scene-kind-title.theme-render-gradient h2 { background: var(--brand-gradient); background-clip: text; color: transparent; }
    .scene-kind-title.theme-render-outline h1, .scene-kind-title.theme-render-outline h2 { color: transparent; -webkit-text-stroke: 3px var(--text); }
    .scene-kind-title.theme-render-highlight h1, .scene-kind-title.theme-render-highlight h2 { display: inline; padding: 0 .12em .06em; background: var(--accent); color: var(--bg); box-decoration-break: clone; }
    .scene-kind-title.theme-render-compact h1, .scene-kind-title.theme-render-compact h2 { max-width: 18ch; font-size: 94px; line-height: 1.04; letter-spacing: -.04em; }
    .scene-kind-content.theme-render-card .content { padding: 58px; border-radius: var(--block-radius); background: var(--surface); box-shadow: 0 28px 80px rgba(0,0,0,.13); }
    .scene-kind-content.theme-render-columns .content { columns: 2; column-gap: 74px; }
    .scene-kind-content.theme-render-lede p:first-child { font-size: 74px; line-height: 1.12; }
    .scene-kind-content.theme-render-callout .content { padding-left: 44px; border-left: 12px solid var(--accent); }
    .scene-kind-content.theme-render-minimal .content { max-width: 980px; }
    .scene-kind-content.theme-render-highlight p:first-child { display: inline; padding: .1em .2em; background: var(--accent); color: var(--bg); box-decoration-break: clone; }
    .scene-kind-content.theme-render-caption .content { max-width: 780px; }
    .scene-kind-content.theme-render-caption p { font-size: 36px; color: var(--muted); }
    .scene.theme-layout-center { --content-layout-width: 72%; }
    .scene.theme-layout-center .content { margin-inline: auto; text-align: center; }
    .scene.theme-layout-left, .scene.theme-layout-right { --content-layout-width: 62%; }
    .scene.theme-layout-left .content { margin-left: 0; margin-right: auto; text-align: left; }
    .scene.theme-layout-right .content { margin-left: auto; margin-right: 0; text-align: right; }
    .scene.theme-layout-upper, .scene.theme-layout-lower { --content-layout-width: 78%; }
    .scene.theme-layout-upper .content { align-self: start; margin: 28px auto 0; text-align: center; }
    .scene.theme-layout-lower .content { align-self: end; margin: 0 auto 28px; text-align: center; }
    .scene.theme-layout-split-left { --content-layout-width: 44%; }
    .scene.theme-layout-split-left .content { margin-left: 0; margin-right: auto; text-align: left; }
    .scene.theme-layout-split-right { --content-layout-width: 44%; }
    .scene.theme-layout-split-right .content { margin-left: auto; margin-right: 0; text-align: left; }
    .scene.theme-layout-full { --content-layout-width: 100%; }
    .scene.theme-layout-full .content { margin-inline: 0; text-align: left; }
    footer { display: flex; align-items: center; justify-content: space-between; margin-bottom: 44px; color: var(--muted); font-size: 19px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .composition-brand { display: inline-flex; align-items: center; gap: 12px; letter-spacing: -.025em; text-transform: lowercase; }
    .composition-brand svg { width: 28px; height: 28px; flex: none; }
    .composition-brand img { display: block; width: auto; max-width: 240px; height: ${logoSize}px; object-fit: contain; }
    .composition-brand strong { color: var(--text); font-size: 23px; font-weight: 760; }
    .composition-corner-logo { position: absolute; top: 58px; z-index: 30; }
    .composition-corner-logo.logo-top-left { left: 72px; }
    .composition-corner-logo.logo-top-right { right: 72px; }
    footer.logo-footer-right { flex-direction: row-reverse; }
    .camera { position: absolute; z-index: 20; width: 360px; height: 360px; object-fit: cover; border: var(--video-border-width) solid var(--surface); border-radius: var(--video-radius); box-shadow: 0 28px 90px rgba(0,0,0,.28); scale: var(--camera-scale, 1); }
    .preview-camera { object-position: center 18%; }
    #composition[data-video-border="none"] .camera { border-width: 0; }
    .video-border-gradient .camera, .camera.video-border-gradient { border-color: var(--accent); border-image: var(--brand-gradient) 1; }
    .camera.circle { border-radius: 50%; } .camera.rounded-rectangle { width: 460px; }
    .camera-top-left { left: 110px; top: 105px; } .camera-top-right { right: 110px; top: 105px; }
    .camera-bottom-left { left: 110px; bottom: 105px; } .camera-bottom-right { right: 110px; bottom: 105px; }
    .camera-overlay-left { left: 110px; top: 50%; width: 500px; height: 620px; translate: 0 -50%; }
    .camera-overlay-right { right: 110px; top: 50%; width: 500px; height: 620px; translate: 0 -50%; }
    .camera-split-left { left: 90px; top: 110px; bottom: 110px; width: 660px; height: auto; border-radius: 38px; }
    .camera-split-right { right: 90px; top: 110px; bottom: 110px; width: 660px; height: auto; border-radius: 38px; }
    .camera-full { inset: 0; z-index: 20; width: 100%; height: 100%; border-radius: 0; scale: 1; }
    .camera.presenter-information-circle { right: 110px; bottom: 170px; width: 330px; height: 330px; border-radius: 50%; }
    .scene.presenter-information-circle { --presenter-safe-width: 100%; padding-right: 520px; }
    .camera.presenter-information-tile { right: 110px; bottom: 170px; width: 390px; height: 300px; }
    .scene.presenter-information-tile { --presenter-safe-width: 100%; padding-right: 560px; }
    .camera.presenter-portrait-overlay { top: 50%; right: 82px; width: 470px; height: 650px; translate: 0 -50%; }
    .scene.presenter-portrait-overlay { --presenter-safe-width: 100%; padding-right: 620px; }
    .camera.presenter-portrait-rail { top: 54px; right: 54px; bottom: auto; width: 31%; height: calc(100% - 108px); border-radius: var(--video-radius); translate: none; }
    .scene.presenter-portrait-rail { --presenter-safe-width: 100%; padding-right: 700px; }
    .camera.camera-kind-code.presenter-portrait-rail { width: 23%; }
    .scene.scene-kind-code.presenter-portrait-rail { padding-right: 540px; padding-left: 72px; }
    .camera.presenter-split { top: 0; right: 0; bottom: 0; width: 50%; height: 100%; border-radius: 0; }
    .scene.presenter-split { --presenter-safe-width: 100%; padding-right: 1040px; }
    .camera.presenter-person-background-left, .camera.presenter-person-background-right, .camera.presenter-person-only { inset: 0; width: 100%; height: 100%; border: 0; border-radius: 0; scale: 1; }
    .scene.presenter-person-background-left::after, .scene.presenter-person-background-right::after { content: ""; position: absolute; inset: 0; z-index: 21; pointer-events: none; }
    .scene.presenter-person-background-left::after { background: linear-gradient(90deg, color-mix(in srgb, var(--bg) 94%, transparent) 0 42%, color-mix(in srgb, var(--bg) 48%, transparent) 64%, transparent 100%); }
    .scene.presenter-person-background-right::after { background: linear-gradient(270deg, color-mix(in srgb, var(--bg) 94%, transparent) 0 42%, color-mix(in srgb, var(--bg) 48%, transparent) 64%, transparent 100%); }
    .scene.presenter-person-background-left, .scene.presenter-person-background-right { --presenter-safe-width: 46%; }
    .scene.presenter-person-background-left .content { margin-left: 0; text-align: left; }
    .scene.presenter-person-background-right .content { margin-right: 0; margin-left: auto; text-align: left; }
    .scene.presenter-portrait-overlay h1, .scene.presenter-portrait-overlay h2, .scene.presenter-portrait-rail h1, .scene.presenter-portrait-rail h2, .scene.presenter-split h1, .scene.presenter-split h2, .scene.presenter-person-background-left h1, .scene.presenter-person-background-left h2, .scene.presenter-person-background-right h1, .scene.presenter-person-background-right h2 { font-size: 104px; }
    .scene.presenter-portrait-overlay p, .scene.presenter-portrait-overlay li, .scene.presenter-portrait-rail p, .scene.presenter-portrait-rail li, .scene.presenter-split p, .scene.presenter-split li, .scene.presenter-person-background-left p, .scene.presenter-person-background-left li, .scene.presenter-person-background-right p, .scene.presenter-person-background-right li { font-size: 46px; }
    .scene.theme-render-timeline.presenter-information-circle ul, .scene.theme-render-timeline.presenter-information-circle ol, .scene.theme-render-timeline.presenter-information-tile ul, .scene.theme-render-timeline.presenter-information-tile ol { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .scene.theme-render-timeline.presenter-portrait-overlay ul, .scene.theme-render-timeline.presenter-portrait-overlay ol, .scene.theme-render-timeline.presenter-portrait-rail ul, .scene.theme-render-timeline.presenter-portrait-rail ol, .scene.theme-render-timeline.presenter-split ul, .scene.theme-render-timeline.presenter-split ol, .scene.theme-render-timeline.presenter-person-background-left ul, .scene.theme-render-timeline.presenter-person-background-left ol, .scene.theme-render-timeline.presenter-person-background-right ul, .scene.theme-render-timeline.presenter-person-background-right ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .scene.presenter-portrait-overlay pre code, .scene.presenter-split pre code, .scene.presenter-person-background-left pre code, .scene.presenter-person-background-right pre code { font-size: 32px; }
    .scene.scene-kind-code.presenter-portrait-rail pre code { font-size: 36px; }
    .scene.presenter-person-only > :not(.camera) { display: none; }
    .scene.camera-position-hidden { --presenter-safe-width: 100%; padding-right: 132px; }
    .camera-hidden { display: none; }
  </style>
</head>
<body>
  <div id="composition" class="video-border-${theme.video.borderStyle}" data-composition-id="${escapeHtml(project.id)}" data-start="0" data-width="${project.width}" data-height="${project.height}" data-theme-id="${escapeHtml(theme.id)}" data-title-style="${theme.blocks.title}" data-content-style="${theme.blocks.content}" data-list-style="${theme.blocks.list}" data-code-style="${theme.blocks.code}" data-code-theme="${theme.blocks.codeTheme}" data-code-animation="${theme.blocks.codeAnimation}" data-quote-style="${theme.blocks.quote}" data-title-layout="${theme.blocks.layout.title}" data-content-layout="${theme.blocks.layout.content}" data-list-layout="${theme.blocks.layout.list}" data-code-layout="${theme.blocks.layout.code}" data-quote-layout="${theme.blocks.layout.quote}" data-surface-style="${theme.blocks.surface}" data-video-border="${theme.video.borderStyle}">
    ${sceneMarkup}
  </div>
  <script>
    var tl = gsap.timeline({ paused: true });
    tl.to({}, { duration: ${durationSeconds} }, 0);
    ${animationMarkup}
    window.__timelines = window.__timelines || {};
    window.__timelines[${scriptString(project.id)}] = tl;
  </script>
  <script src="${escapeHtml(hyperframesRuntimeUrl)}"></script>
</body>
</html>`
}

export const compileProject = (
  project: ProjectDocumentV1,
  options: {
    gsapUrl?: string
    hyperframesRuntimeUrl?: string
    previewPresenter?: { imageUrl: string; name?: string }
  } = {},
): CompiledComposition => {
  assertProject(project)
  const warnings: string[] = []
  const seenIds = new Set<string>()
  let startSeconds = 0

  const scenes = project.notebook.content
    .filter(
      node =>
        node.type !== 'horizontalRule' &&
        !(node.type === 'paragraph' && textContent(node).length === 0),
    )
    .map((node, index): Scene => {
      const nodeId = node.attrs?.id
      if (typeof nodeId !== 'string' || !nodeId.trim()) {
        throw new Error(`Renderable node ${index + 1} is missing its stable ID`)
      }
      if (seenIds.has(nodeId)) {
        throw new Error(`Duplicate renderable node ID: ${nodeId}`)
      }
      seenIds.add(nodeId)

      const config = normalizeBlockConfig(nodeId, node, project.blocks[nodeId])
      const durationMs = Math.min(60_000, Math.max(1_000, config.durationMs))
      if (durationMs !== config.durationMs) {
        warnings.push(`Duration for ${nodeId} was clamped to the supported range`)
      }
      const durationSeconds = durationMs / 1000
      const scene: Scene = {
        id: nodeId,
        index,
        node,
        title: textContent(node).slice(0, 80) || `Scene ${index + 1}`,
        kind: sceneKind(node),
        startSeconds,
        durationSeconds,
        config: { ...config, durationMs },
        presenterTracks: project.presenterTracks[nodeId] || [],
      }
      startSeconds += durationSeconds
      return scene
    })

  if (scenes.length === 0) throw new Error('Add at least one notebook block')

  return {
    scenes,
    durationSeconds: startSeconds,
    warnings,
    html: buildCompositionHtml(
      project,
      scenes,
      startSeconds,
      options.gsapUrl ||
        'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
      options.hyperframesRuntimeUrl ||
        'https://cdn.jsdelivr.net/npm/@hyperframes/core@0.7.106/dist/hyperframe.runtime.iife.js',
      options.previewPresenter,
    ),
  }
}
