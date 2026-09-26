// A presentation's export (the four-notebook model): its slides as a PDF,
// one page a slide at the notebook's frame size, in order. The same Chrome
// the renderer uses prints it, with the renderer's own type faces embedded
// (typeFacesOf), so a slide reads in the PDF as it does on the stage and in
// the video. A slide is a drawing, not a program: its scripts and event
// handlers are left out.
//
// An export is chosen, never presumed finished (R04 of the project-flow
// rereview): the designed slides alone, or every slide as a draft — each
// page not yet designed marked as such in the file itself. What an export
// would hold is said before it is made: each slide's state, and the type
// its drawings are set in, with any face that cannot be embedded (R05).
import { acquireBrowser, buildChromeArgs } from '@hyperframes/engine'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { pageFingerprint } from '../src/page-design'
import { declaredFacesOf, typeFacesOf, type TypeReport } from './type-faces'

// designed: the slide as designed · designing: a schematic its design run
// has yet to replace · schematic: a schematic no run is designing.
export type SlideState = 'designed' | 'designing' | 'schematic'
export type PresentationSlide = { id: string; title: string; svg: string; state: SlideState; revision: string }
export type ExportScope = 'ready' | 'draft'

const stateOf = (origin: unknown): SlideState => {
  const page = (origin || {}) as { kind?: string; designing?: unknown }
  return page.kind === 'designed' ? 'designed' : page.designing ? 'designing' : 'schematic'
}

// The slides a notebook holds, in order: every page with a drawing, as it
// is now — its state, and the revision of its drawing.
export const slidesOf = (notebook: ProjectDocumentV1): PresentationSlide[] =>
  (notebook.notebook?.content || [])
    .filter(node => node.type === 'scene' && node.attrs?.id)
    .map(node => {
      const svg = String(node.attrs?.svg || '')
      return { id: String(node.attrs?.id), title: String(node.attrs?.title || ''), svg, state: stateOf(node.attrs?.pageOrigin), revision: pageFingerprint(svg) }
    })
    .filter(slide => /<svg[\s>]/i.test(slide.svg))

const DRAFT_NOTES: Record<Exclude<SlideState, 'designed'>, string> = { designing: 'Draft · still being designed', schematic: 'Draft · schematic, not designed' }

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const drawingOf = (svg: string) =>
  svg
    .slice(svg.search(/<svg[\s>]/i))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '')

// The slides as one printable document: a page each, the drawing filling it.
// A page not yet designed carries its mark, over the drawing, in the file.
export const presentationHtml = (slides: Array<Pick<PresentationSlide, 'title' | 'svg'> & { state?: SlideState }>, width: number, height: number, title = '') => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeText(title)}</title><style>
@page { size: ${width}px ${height}px; margin: 0; }
html, body { margin: 0; padding: 0; background: #ffffff; }
.slide { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; break-after: page; }
.slide:last-child { break-after: auto; }
.slide > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.draft-mark { position: absolute; top: ${Math.round(height * 0.03)}px; right: ${Math.round(width * 0.02)}px; padding: ${Math.round(height * 0.009)}px ${Math.round(width * 0.009)}px; border: 3px solid #b45309; border-radius: 10px; background: #fffbeb; color: #92400e; font: 700 ${Math.round(height * 0.024)}px/1.2 'Inter', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
</style></head><body>
${slides.map((slide, index) => `<section class="slide${slide.state && slide.state !== 'designed' ? ' is-draft' : ''}" aria-label="${escapeText(`${index + 1}. ${slide.title}`)}">${drawingOf(slide.svg)}${slide.state && slide.state !== 'designed' ? `<div class="draft-mark">${escapeText(DRAFT_NOTES[slide.state])}</div>` : ''}</section>`).join('\n')}
</body></html>`

// The type a presentation's drawings are set in: the faces its slides name
// (not the drafts' marks), which are embedded and which cannot be had.
const slideTypeOf = (report: TypeReport, slideFaces: string[]): TypeReport => {
  const named = new Set(slideFaces.map(face => face.toLowerCase()))
  return { faces: slideFaces, substituted: report.substituted, unresolved: report.unresolved.filter(face => named.has(face.toLowerCase())), ...(report.localOnly?.length ? { localOnly: report.localOnly } : {}) }
}

// What an export would hold, said before it is made (R04, R05): each
// slide's state, how many are designed, and the type.
const unmarked = (slides: PresentationSlide[], width: number, height: number) => presentationHtml(slides.map(({ state: _state, ...slide }) => slide), width, height)
export const exportPlanOf = async (notebook: ProjectDocumentV1) => {
  const slides = slidesOf(notebook)
  const html = unmarked(slides, notebook.width || 1920, notebook.height || 1080)
  const { report } = await typeFacesOf(html)
  return {
    slides: slides.map(({ svg: _svg, ...slide }) => slide),
    designed: slides.filter(slide => slide.state === 'designed').length,
    total: slides.length,
    type: slideTypeOf(report, declaredFacesOf(html)),
  }
}

// The slides an export takes: the designed ones, or every one as a draft.
export const exportSlidesOf = (slides: PresentationSlide[], scope: ExportScope) => (scope === 'ready' ? slides.filter(slide => slide.state === 'designed') : slides)

export const presentationPdf = async (slides: PresentationSlide[], options: { width: number; height: number; title?: string; type?: Parameters<typeof typeFacesOf>[1] }) => {
  const document = presentationHtml(slides, options.width, options.height, options.title)
  const { html, report } = await typeFacesOf(document, options.type)
  const type = slideTypeOf(report, declaredFacesOf(unmarked(slides, options.width, options.height)))
  const lease = await acquireBrowser(buildChromeArgs({ width: options.width, height: options.height, captureMode: 'screenshot' }), { forceScreenshot: true, enableBrowserPool: false })
  const page = await lease.browser.newPage()
  try {
    await page.setViewport({ width: options.width, height: options.height })
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 })
    await page.evaluateHandle('document.fonts.ready').catch(() => null)
    return { pdf: Buffer.from(await page.pdf({ width: `${options.width}px`, height: `${options.height}px`, printBackground: true, preferCSSPageSize: true })), type }
  } finally {
    await page.close().catch(() => {})
    await lease.release().catch(() => {})
  }
}
