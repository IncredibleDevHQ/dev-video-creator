import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { exportSlidesOf, presentationHtml, presentationPdf, slidesOf } from './presentation-export'

// A presentation's export: its slides, in order, one page each at the
// notebook's frame size, drawings only.
const slide = (id: string, title: string, svg: string) => ({ type: 'scene', attrs: { id, title, svg } })
const notebook = (content: unknown[]) => ({ id: 'p', title: 'How BoltDB works', notebook: { type: 'doc', content } }) as unknown as ProjectDocumentV1

describe('a presentation as a PDF', () => {
  it('says each slide\'s state: designed, still being designed, or a schematic', () => {
    const slides = slidesOf(notebook([
      { type: 'scene', attrs: { id: 'a', title: 'One file', svg: '<svg viewBox="0 0 1920 1080"/>', pageOrigin: { kind: 'designed', by: 'Kimi' } } },
      { type: 'scene', attrs: { id: 'b', title: 'Pages', svg: '<svg viewBox="0 0 1920 1080"/>', pageOrigin: { kind: 'schematic', designing: { runId: 'run-1', page: 2, by: 'Kimi', placeholder: 'x' } } } },
      { type: 'scene', attrs: { id: 'c', title: 'Freelist', svg: '<svg viewBox="0 0 1920 1080"/>', pageOrigin: { kind: 'schematic' } } },
    ]))
    expect(slides.map(slide => slide.state)).toEqual(['designed', 'designing', 'schematic'])
    expect(slides.every(slide => /^[0-9a-f]+$/.test(slide.revision))).toBe(true)
    // R04 of the project-flow rereview: the designed slides alone, or every
    // slide — the rest marked as drafts in the file itself.
    expect(exportSlidesOf(slides, 'ready').map(slide => slide.id)).toEqual(['a'])
    expect(exportSlidesOf(slides, 'draft').map(slide => slide.id)).toEqual(['a', 'b', 'c'])
    const html = presentationHtml(slides, 1920, 1080, 'How BoltDB works — draft (1 of 3 designed)')
    expect(html.match(/<section class="slide is-draft"/g)).toHaveLength(2)
    expect(html).toContain('<div class="draft-mark">Draft · still being designed</div>')
    expect(html).toContain('<div class="draft-mark">Draft · schematic, not designed</div>')
    expect(html).toContain('<title>How BoltDB works — draft (1 of 3 designed)</title>')
  })

  // R05 of the project-flow rereview: a slide sets its type in SVG
  // attributes, bare — "Source Serif 4, Segoe UI, sans-serif" — which CSS
  // could not read, so the PDF set it in Times, and nothing said a face was
  // missing. Offline, the renderer's own faces are embedded; the one it
  // cannot have is said, and its text falls back as its list says.
  it('prints a slide in the faces its SVG names, and says which it could not have', async () => {
    const offline = { fetchImpl: (async () => { throw new Error('offline') }) as unknown as typeof fetch, fontFetchRetryPolicy: { maxAttempts: 1, attemptTimeoutMs: 50, maxElapsedMs: 50, baseDelayMs: 0 }, allowSystemFontCapture: false }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#0b1020"/>
<text x="120" y="220" fill="#fff" font-size="96" font-family="Source Serif 4, Segoe UI, sans-serif">How BoltDB works</text>
<text x="120" y="400" fill="#fff" font-size="48" font-family="Inter, sans-serif">Pages are 4 KB each</text>
<text x="120" y="560" fill="#fff" font-size="40" font-family="JetBrains Mono, Consolas, monospace">page 3 · leaf</text></svg>`
    const { pdf, type } = await presentationPdf([{ id: 'a', title: 'One file', svg, state: 'designed', revision: 'r' }], { width: 1920, height: 1080, title: 'How BoltDB works', type: offline })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(type.faces).toEqual(expect.arrayContaining(['Source Serif 4', 'Inter', 'JetBrains Mono']))
    expect(type.unresolved).toEqual(['Source Serif 4'])
    const pdffonts = spawnSync('pdffonts', ['-v'])
    if (pdffonts.error) return // poppler is not installed here: the report above is the proof
    const file = join(mkdtempSync(join(tmpdir(), 'presentation-pdf-')), 'deck.pdf')
    writeFileSync(file, pdf)
    const fonts = spawnSync('pdffonts', [file], { encoding: 'utf8' }).stdout
    // Its faces are the ones it names, embedded — never the default serif.
    expect(fonts).toMatch(/Inter/)
    expect(fonts).toMatch(/JetBrainsMono/)
    expect(fonts).not.toMatch(/Times/)
  }, 60_000)

  it('takes every slide with a drawing, in order', () => {
    const slides = slidesOf(notebook([
      slide('a', 'One file', '<svg viewBox="0 0 1920 1080"><text>One file</text></svg>'),
      { type: 'paragraph', attrs: { id: 'x' }, content: [{ type: 'text', text: 'not a slide' }] },
      slide('b', 'Not drawn yet', ''),
      slide('c', 'Pages', '<?xml version="1.0"?><svg viewBox="0 0 1920 1080"><text>Pages</text></svg>'),
    ]))
    expect(slides.map(entry => entry.title)).toEqual(['One file', 'Pages'])
  })

  it('prints a page a slide at the frame size, the drawing alone', () => {
    const html = presentationHtml(
      [
        { title: 'One file', svg: '<?xml version="1.0"?><svg viewBox="0 0 1920 1080" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><text>One file</text></a></svg>' },
        { title: 'Pages & <tables>', svg: '<svg viewBox="0 0 1920 1080"><text>Pages</text></svg>' },
      ],
      1920,
      1080,
      'How BoltDB works',
    )
    expect(html).toContain('@page { size: 1920px 1080px; margin: 0; }')
    expect(html.match(/<section class="slide"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="2. Pages &amp; &lt;tables&gt;"')
    expect(html).not.toMatch(/<\?xml|<script|onload=|javascript:/)
    expect(html).toContain('<text>One file</text>')
  })
})
