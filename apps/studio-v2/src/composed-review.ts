import { compileProject, type ProjectDocumentV1 } from 'markdown-composition'

export const RENDER_REVIEW_VERSION = 'studio-composition-3'
let frame: HTMLIFrameElement | null = null
let current: ProjectDocumentV1 | null = null
/** Review uses the export document and its timeline, including normalization,
 * caption policy, stage track, fonts and presenter layout. */
export async function mountComposedReview(project: ProjectDocumentV1, gsapSource?: string, fontCss = '') {
  frame?.remove()
  current = project
  const compiled = compileProject(project)
  frame = document.createElement('iframe')
  frame.setAttribute('title', 'Export composition review')
  frame.style.cssText = `position:absolute;left:0;top:0;border:0;width:${project.width}px;height:${project.height}px;transform-origin:0 0;transform:scale(${Math.min(1600 / project.width, 900 / project.height)})`
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Composition did not become ready')), 20000)
    frame!.onload = () => { clearTimeout(timer); resolve() }
  })
  let html = fontCss ? compiled.html.replace('</head>', `<style data-shipped-fonts>${fontCss}</style></head>`) : compiled.html
  // Hyperframes capture controls are unnecessary here; its underlying GSAP
  // timeline and production slide clock are the exact export code.
  html = html.replace(/<script src="[^"]*hyperframe[^\"]*"><\/script>/g, '')
  if (gsapSource) html = html.replace(/<script src="[^"]*gsap[^\"]*"><\/script>/, () => `<script>${gsapSource.replace(/<\/script/gi, '<\\/script')}</script>`)
  frame.srcdoc = html
  document.body.append(frame)
  await loaded
  const doc = frame.contentDocument!
  await doc.fonts.ready
  await Promise.all(Array.from(doc.images).map(image => image.decode()))
  const win = frame.contentWindow as Window & { __timelines?: Record<string, { seek: (seconds: number, suppressEvents?: boolean) => void }> }
  if (!win.__timelines?.[project.id]) throw new Error('Export timeline failed to initialize')
  return seekComposedReview(0)
}
export function seekComposedReview(ms: number) {
  if (!frame?.contentWindow || !current) throw new Error('Mount a composition first')
  const win = frame.contentWindow as Window & { __timelines: Record<string, { seek: (seconds: number, suppressEvents?: boolean) => void }>; __slideDrawScene0?: (seconds: number) => void }
  win.__timelines[current.id].seek(Math.max(0, ms) / 1000, false)
  win.__slideDrawScene0?.(Math.max(0, ms) / 1000)
  // Hyperframes owns clip visibility/media clocks during export. The review
  // host drives the same declarative clip intervals while its timeline is paused.
  for (const clip of frame.contentDocument!.querySelectorAll<HTMLElement>('.clip[data-start][data-duration]')) {
    const start = Number(clip.dataset.start), duration = Number(clip.dataset.duration)
    const seconds = Math.max(0, ms) / 1000
    const active = seconds >= start && seconds < start + duration
    clip.style.visibility = active ? 'visible' : 'hidden'
    if (clip.tagName === 'VIDEO' && active) {
      const media = clip as HTMLVideoElement
      media.pause()
      const target = Math.max(0, Math.min(seconds - start, Number.isFinite(media.duration) ? media.duration : seconds - start))
      if (Math.abs(media.currentTime - target) > .001) media.currentTime = target
    }
  }
  const bounds = Array.from(frame.contentDocument!.querySelectorAll<SVGGraphicsElement>('svg [data-part], svg [data-actor], svg [data-role="node"]')).map(node => {
    const rect = node.getBoundingClientRect()
    const style = frame!.contentWindow!.getComputedStyle(node)
    return { id: node.id, part: node.getAttribute('data-part'), x: rect.x, y: rect.y, width: rect.width, height: rect.height, visible: style.visibility !== 'hidden' && Number(style.opacity) > 0 }
  })
  const doc = frame.contentDocument!
  const labels = Array.from(doc.querySelectorAll<SVGGraphicsElement>('.slide-svg text')).filter(node => {
    let alpha = 1
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      const style = win.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      alpha *= Number(style.opacity)
    }
    return alpha > .25 && Boolean(node.textContent?.trim())
  }).map(node => ({ text: node.textContent!.trim(), box: node.getBoundingClientRect() }))
  const readability: string[] = []
  const visible = (node: Element) => {
    let alpha = 1
    for (let parent: Element | null = node; parent; parent = parent.parentElement) {
      const style = win.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      alpha *= Number(style.opacity)
    }
    return alpha > .25
  }
  const covers = Array.from(doc.querySelectorAll<HTMLElement>('.camera, .ex-caption, .burned-caption')).filter(visible).map(node => ({ kind: node.matches('.camera') ? 'presenter' : 'caption', box: node.getBoundingClientRect() }))
  for (const actor of Array.from(doc.querySelectorAll<SVGGraphicsElement>('.slide-svg [data-actor]')).filter(visible)) {
    const b = actor.getBoundingClientRect()
    if (b.width && (b.left < -2 || b.top < -2 || b.right > current.width + 2 || b.bottom > current.height + 2)) readability.push(`Actor leaves the frame: ${actor.id}`)
    for (const cover of covers) {
      const width = Math.min(b.right, cover.box.right) - Math.max(b.left, cover.box.left)
      const height = Math.min(b.bottom, cover.box.bottom) - Math.max(b.top, cover.box.top)
      if (width > 4 && height > 4 && width * height > .15 * b.width * b.height) readability.push(`${cover.kind} covers actor: ${actor.id}`)
    }
  }
  for (const label of labels) {
    const b = label.box
    if (b.width && (b.left < -2 || b.top < -2 || b.right > current.width + 2 || b.bottom > current.height + 2)) readability.push(`Label leaves the frame: “${label.text.slice(0, 60)}”`)
    for (const cover of covers) {
      const width = Math.min(b.right, cover.box.right) - Math.max(b.left, cover.box.left)
      const height = Math.min(b.bottom, cover.box.bottom) - Math.max(b.top, cover.box.top)
      if (width > 4 && height > 4 && width * height > .15 * b.width * b.height) readability.push(`${cover.kind} covers label: “${label.text.slice(0, 60)}”`)
    }
  }
  for (let i = 0; i < labels.length; i++) {
    const a = labels[i]
    for (const b of labels.slice(i + 1)) {
      const width = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
      const height = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)
      if (width > 4 && height > 4 && width * height > .15 * Math.min(a.box.width * a.box.height, b.box.width * b.box.height)) readability.push(`Labels overlap: “${a.text.slice(0, 60)}” and “${b.text.slice(0, 60)}”`)
    }
  }
  return { ms, renderer: RENDER_REVIEW_VERSION, bounds, readability }
}

export function composedActorCenter(id: string) {
  const node = frame?.contentDocument?.getElementById(`s0-${id}`) as unknown as SVGGraphicsElement | null
  const root = frame?.contentDocument?.querySelector('.slide-svg') as SVGSVGElement | null
  if (!node || !root) return null
  const box = node.getBBox(), matrix = root.getScreenCTM()!.inverse().multiply(node.getScreenCTM()!)
  return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix)
}

export async function settleComposedMedia() {
  await Promise.all(Array.from(frame?.contentDocument?.querySelectorAll('video') || []).filter(video => video.style.visibility === 'visible').map(video => {
    if (video.readyState >= 2 && !video.seeking) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      const finish = () => { if (video.readyState < 2 || video.seeking) return; cleanup(); resolve() }
      const fail = () => { cleanup(); reject(new Error('Presenter frame could not be decoded')) }
      const timer = setTimeout(fail, 15000)
      const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', finish); video.removeEventListener('loadeddata', finish); video.removeEventListener('error', fail) }
      video.addEventListener('seeked', finish); video.addEventListener('loadeddata', finish); video.addEventListener('error', fail)
    })
  }))
}
