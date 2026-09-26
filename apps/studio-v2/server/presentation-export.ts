// A presentation's export (the four-notebook model): its slides as a PDF,
// one page a slide at the notebook's frame size, in order. The same Chrome
// the renderer uses prints it, with the renderer's own type faces embedded
// (typeFacesOf), so a slide reads in the PDF as it does on the stage and in
// the video. A slide is a drawing, not a program: its scripts and event
// handlers are left out.
import { acquireBrowser, buildChromeArgs } from '@hyperframes/engine'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { typeFacesOf } from './type-faces'

export type PresentationSlide = { title: string; svg: string }

// The slides a notebook holds, in order: every page with a drawing.
export const slidesOf = (notebook: ProjectDocumentV1): PresentationSlide[] =>
  (notebook.notebook?.content || [])
    .filter(node => node.type === 'scene' && node.attrs?.id)
    .map(node => ({ title: String(node.attrs?.title || ''), svg: String(node.attrs?.svg || '') }))
    .filter(slide => /<svg[\s>]/i.test(slide.svg))

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const drawingOf = (svg: string) =>
  svg
    .slice(svg.search(/<svg[\s>]/i))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '')

// The slides as one printable document: a page each, the drawing filling it.
export const presentationHtml = (slides: PresentationSlide[], width: number, height: number, title = '') => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeText(title)}</title><style>
@page { size: ${width}px ${height}px; margin: 0; }
html, body { margin: 0; padding: 0; background: #ffffff; }
.slide { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; break-after: page; }
.slide:last-child { break-after: auto; }
.slide > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style></head><body>
${slides.map((slide, index) => `<section class="slide" aria-label="${escapeText(`${index + 1}. ${slide.title}`)}">${drawingOf(slide.svg)}</section>`).join('\n')}
</body></html>`

export const presentationPdf = async (slides: PresentationSlide[], options: { width: number; height: number; title?: string }) => {
  const { html } = await typeFacesOf(presentationHtml(slides, options.width, options.height, options.title))
  const lease = await acquireBrowser(buildChromeArgs({ width: options.width, height: options.height, captureMode: 'screenshot' }), { forceScreenshot: true, enableBrowserPool: false })
  const page = await lease.browser.newPage()
  try {
    await page.setViewport({ width: options.width, height: options.height })
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 })
    await page.evaluateHandle('document.fonts.ready').catch(() => null)
    return Buffer.from(await page.pdf({ width: `${options.width}px`, height: `${options.height}px`, printBackground: true, preferCSSPageSize: true }))
  } finally {
    await page.close().catch(() => {})
    await lease.release().catch(() => {})
  }
}
