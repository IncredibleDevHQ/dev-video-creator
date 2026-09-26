import { describe, expect, it } from 'vitest'
import type { ProjectDocumentV1 } from 'markdown-composition'
import { presentationHtml, slidesOf } from './presentation-export'

// A presentation's export: its slides, in order, one page each at the
// notebook's frame size, drawings only.
const slide = (id: string, title: string, svg: string) => ({ type: 'scene', attrs: { id, title, svg } })
const notebook = (content: unknown[]) => ({ id: 'p', title: 'How BoltDB works', notebook: { type: 'doc', content } }) as unknown as ProjectDocumentV1

describe('a presentation as a PDF', () => {
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
