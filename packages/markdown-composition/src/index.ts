import type {
  BlockRenderConfigV1,
  BlockBackgroundPreset,
  CompiledComposition,
  ProjectDocumentV1,
  Scene,
  SceneLayout,
  TiptapMark,
  TiptapNode,
} from './types'
import { defaultBrand, normalizeStudioTheme } from './themes'

export * from './types'
export * from './themes'

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
      ['none', 'fade', 'rise', 'type', 'line-by-line'] as const,
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
      return `<pre><code>${escapeHtml(
        (node.content || []).map(child => child.text || '').join(''),
      )}</code></pre>`
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
            ? `<video class="camera clip ${cameraClass(scene.config.camera.position)} ${scene.config.camera.shape} presenter-${scene.config.camera.mode}" style="--camera-scale:${cameraScale}" data-start="${scene.startSeconds}" data-duration="${scene.durationSeconds}" data-track-index="${10 + trackIndex}" src="${escapeHtml(videoUrl)}"${muted} playsinline></video>`
            : ''
          const audio = audioUrl
            ? `<audio data-start="${scene.startSeconds}" data-duration="${scene.durationSeconds}" data-track-index="${20 + trackIndex}" src="${escapeHtml(audioUrl)}"></audio>`
            : ''
          return `${video}${audio}`
        })
        .join('')

      return `<section
        id="scene-${scene.index}"
        class="scene clip scene-kind-${scene.kind} layout-${scene.config.layout} align-${scene.config.alignment} presenter-${scene.config.camera.mode}"
        data-start="${scene.startSeconds}"
        data-duration="${scene.durationSeconds}"
        data-track-index="${scene.index}"
        data-node-id="${escapeHtml(scene.id)}"
        data-reveal="${scene.config.reveal}"
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
      </section>${presenterMarkup}`
    })
    .join('\n')

  const animationMarkup = scenes
    .map(scene => {
      const selector = scriptString(`#scene-${scene.index} .content`)
      const start = scene.startSeconds
      switch (scene.config.reveal) {
        case 'none':
          return `tl.set(${selector}, { opacity: 1 }, ${start});`
        case 'fade':
          return `tl.fromTo(${selector}, { opacity: 0 }, { opacity: 1, duration: 0.65, ease: "power2.out" }, ${start});`
        case 'type':
          return `tl.fromTo(${selector}, { opacity: 1, clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${Math.min(2.4, scene.durationSeconds * 0.45)}, ease: "steps(18)" }, ${start});`
        case 'line-by-line':
          return `tl.fromTo(${selector}, { opacity: 1, clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: ${Math.min(1.8, scene.durationSeconds * 0.35)}, ease: "power2.out" }, ${start});`
        case 'rise':
        default:
          return `tl.fromTo(${selector}, { opacity: 0, y: 56 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3.out" }, ${start});`
      }
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
    #composition[data-list-style="bullets"] .scene-kind-list li::marker { color: var(--accent); }
    #composition[data-list-style="cards"] .scene-kind-list ul, #composition[data-list-style="cards"] .scene-kind-list ol { padding: 0; display: grid; gap: 18px; list-style: none; }
    #composition[data-list-style="cards"] .scene-kind-list li { margin: 0; padding: 27px 34px; border: 2px solid color-mix(in srgb, var(--accent) 66%, transparent); border-radius: var(--block-radius); background: color-mix(in srgb, var(--surface) 86%, transparent); }
    #composition[data-list-style="timeline"] .scene-kind-list ul, #composition[data-list-style="timeline"] .scene-kind-list ol { padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 26px; list-style: none; counter-reset: theme-step; }
    #composition[data-list-style="timeline"] .scene-kind-list li { margin: 0; padding-top: 86px; position: relative; font-size: 36px; text-align: center; counter-increment: theme-step; }
    #composition[data-list-style="timeline"] .scene-kind-list li::before { content: counter(theme-step); position: absolute; top: 0; left: 50%; width: 64px; height: 64px; translate: -50% 0; display: grid; place-items: center; border-radius: 50%; background: var(--brand-gradient); color: white; font-size: 24px; font-weight: 800; }
    #composition[data-list-style="steps"] .scene-kind-list ol, #composition[data-list-style="steps"] .scene-kind-list ul { padding: 0; list-style: none; counter-reset: theme-step; }
    #composition[data-list-style="steps"] .scene-kind-list li { position: relative; margin-bottom: 28px; padding-left: 88px; counter-increment: theme-step; }
    #composition[data-list-style="steps"] .scene-kind-list li::before { content: counter(theme-step, decimal-leading-zero); position: absolute; left: 0; color: var(--primary); font-weight: 800; }
    strong { color: var(--accent); } a { color: var(--accent); text-decoration: none; }
    blockquote { margin: 0; padding: 16px 0 16px 40px; border-left: 12px solid var(--primary); color: var(--muted); }
    #composition[data-quote-style="card"] blockquote { padding: 48px; border: 0; border-radius: var(--block-radius); background: var(--surface); color: var(--text); }
    #composition[data-quote-style="statement"] blockquote { padding: 0; border: 0; color: var(--text); font-size: 76px; font-weight: 750; }
    pre { width: 100%; min-width: 0; max-width: 100%; margin: 0; padding: 54px; border-radius: var(--block-radius); background: var(--code); color: #f7f7ef; box-shadow: 0 32px 80px rgba(0,0,0,.16); overflow: hidden; }
    #composition[data-code-style="terminal"] pre { border: 3px solid var(--accent); border-image: var(--brand-gradient) 1; }
    #composition[data-code-style="terminal"] pre::before { content: "●  ●  ●"; display: block; margin-bottom: 30px; color: var(--primary); font: 22px/1 ui-monospace, monospace; letter-spacing: .35em; }
    #composition[data-code-style="full"] .scene-kind-code { padding: 72px; }
    #composition[data-code-style="full"] .scene-kind-code { --content-layout-width: 100%; }
    #composition[data-code-style="full"] .scene-kind-code .content, #composition[data-code-style="full"] .scene-kind-code pre { height: 100%; }
    pre code { font: 42px/1.5 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
    .layout-title { --content-layout-width: 1600px; }
    .layout-title h1, .layout-title h2 { font-size: 142px; }
    .layout-code { --content-layout-width: 1650px; }
    .layout-split { --content-layout-width: 58%; }
    .layout-split .content { margin-left: 0; text-align: left; }
    #composition[data-title-style="split"] .scene-kind-title { --content-layout-width: 56%; }
    #composition[data-title-style="split"] .scene-kind-title .content { margin-left: 0; text-align: left; }
    #composition[data-title-style="lower-third"] .scene-kind-title { --content-layout-width: 72%; }
    #composition[data-title-style="lower-third"] .scene-kind-title .content { align-self: end; margin: 0 0 44px; text-align: left; }
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
    .camera.presenter-information-circle { width: 330px; height: 330px; border-radius: 50%; }
    .scene.presenter-information-circle { --presenter-safe-width: 72%; }
    .camera.presenter-information-tile { width: 390px; height: 300px; }
    .scene.presenter-information-tile { --presenter-safe-width: 68%; }
    .camera.presenter-portrait-overlay { top: 50%; right: 82px; width: 470px; height: 650px; translate: 0 -50%; }
    .scene.presenter-portrait-overlay { --presenter-safe-width: 62%; }
    .camera.presenter-portrait-rail { top: 54px; right: 54px; bottom: 54px; width: 31%; height: auto; border-radius: var(--video-radius); }
    .scene.presenter-portrait-rail { --presenter-safe-width: 58%; }
    .scene.presenter-portrait-rail .content { margin-left: 0; text-align: left; }
    .camera.presenter-split { top: 0; right: 0; bottom: 0; width: 50%; height: 100%; border-radius: 0; }
    .scene.presenter-split { --presenter-safe-width: 46%; }
    .scene.presenter-split .content { margin-left: 0; text-align: left; }
    .camera.presenter-person-background-left, .camera.presenter-person-background-right, .camera.presenter-person-only { inset: 0; width: 100%; height: 100%; border: 0; border-radius: 0; scale: 1; }
    .scene.presenter-person-background-left::after, .scene.presenter-person-background-right::after { content: ""; position: absolute; inset: 0; z-index: 21; pointer-events: none; }
    .scene.presenter-person-background-left::after { background: linear-gradient(90deg, color-mix(in srgb, var(--bg) 94%, transparent) 0 42%, color-mix(in srgb, var(--bg) 48%, transparent) 64%, transparent 100%); }
    .scene.presenter-person-background-right::after { background: linear-gradient(270deg, color-mix(in srgb, var(--bg) 94%, transparent) 0 42%, color-mix(in srgb, var(--bg) 48%, transparent) 64%, transparent 100%); }
    .scene.presenter-person-background-left, .scene.presenter-person-background-right { --presenter-safe-width: 46%; }
    .scene.presenter-person-background-left .content { margin-left: 0; text-align: left; }
    .scene.presenter-person-background-right .content { margin-right: 0; margin-left: auto; text-align: left; }
    .scene.presenter-portrait-overlay h1, .scene.presenter-portrait-overlay h2, .scene.presenter-portrait-rail h1, .scene.presenter-portrait-rail h2, .scene.presenter-split h1, .scene.presenter-split h2, .scene.presenter-person-background-left h1, .scene.presenter-person-background-left h2, .scene.presenter-person-background-right h1, .scene.presenter-person-background-right h2 { font-size: 104px; }
    .scene.presenter-portrait-overlay p, .scene.presenter-portrait-overlay li, .scene.presenter-portrait-rail p, .scene.presenter-portrait-rail li, .scene.presenter-split p, .scene.presenter-split li, .scene.presenter-person-background-left p, .scene.presenter-person-background-left li, .scene.presenter-person-background-right p, .scene.presenter-person-background-right li { font-size: 46px; }
    #composition[data-list-style="timeline"] .scene.presenter-information-circle ul, #composition[data-list-style="timeline"] .scene.presenter-information-circle ol, #composition[data-list-style="timeline"] .scene.presenter-information-tile ul, #composition[data-list-style="timeline"] .scene.presenter-information-tile ol { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    #composition[data-list-style="timeline"] .scene.presenter-portrait-overlay ul, #composition[data-list-style="timeline"] .scene.presenter-portrait-overlay ol, #composition[data-list-style="timeline"] .scene.presenter-portrait-rail ul, #composition[data-list-style="timeline"] .scene.presenter-portrait-rail ol, #composition[data-list-style="timeline"] .scene.presenter-split ul, #composition[data-list-style="timeline"] .scene.presenter-split ol, #composition[data-list-style="timeline"] .scene.presenter-person-background-left ul, #composition[data-list-style="timeline"] .scene.presenter-person-background-left ol, #composition[data-list-style="timeline"] .scene.presenter-person-background-right ul, #composition[data-list-style="timeline"] .scene.presenter-person-background-right ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .scene.presenter-portrait-overlay pre code, .scene.presenter-portrait-rail pre code, .scene.presenter-split pre code, .scene.presenter-person-background-left pre code, .scene.presenter-person-background-right pre code { font-size: 32px; }
    .scene.presenter-person-only > * { display: none; }
    .camera-hidden { display: none; }
  </style>
</head>
<body>
  <div id="composition" class="video-border-${theme.video.borderStyle}" data-composition-id="${escapeHtml(project.id)}" data-start="0" data-width="${project.width}" data-height="${project.height}" data-theme-id="${escapeHtml(theme.id)}" data-title-style="${theme.blocks.title}" data-list-style="${theme.blocks.list}" data-code-style="${theme.blocks.code}" data-quote-style="${theme.blocks.quote}" data-surface-style="${theme.blocks.surface}" data-video-border="${theme.video.borderStyle}">
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
  options: { gsapUrl?: string; hyperframesRuntimeUrl?: string } = {},
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
    ),
  }
}
