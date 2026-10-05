import { expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { sourceContent } from './source-content'
import { articleText } from './source-document'
import { readSourceUrl } from './source-reader'

vi.mock('./source-fetch', async (original) => ({
  ...(await original<typeof import('./source-fetch')>()),
  fetchText: vi.fn(),
  fetchBinary: vi.fn().mockResolvedValue(null),
  renderedRead: vi.fn().mockResolvedValue(null)
}))
const { fetchText } = await import('./source-fetch')
const content = (html: string) => sourceContent(parseHTML(html).document)
const text = (html: string) => articleText(content(html)).text

// Mirrors the failing layout: a large documentation menu outside main, a
// blog header in main, and only the actual post in article#mainContent.
const page = `<html><head><title>LED display | Example</title></head><body>
<div>For the complete documentation index, see llms.txt.</div>
<div class="docs-menu">${'<h3>Get started</h3><a href="/docs">Navigation item</a>'.repeat(100)}</div>
<main><header><h1>LED display</h1><p>Published yesterday</p></header>
<article id="mainContent"><p>For my roommate’s birthday, I bought an LED display.</p>
<h2>Moving to a Raspberry Pi</h2><p>A voice service delegates requests to a renderer.</p>
<img src="/diagram.png" alt="The display pipeline">
<p>The renderer sends frames to the panel.</p></article>
<div class="related-posts"><h2>Related posts</h2>More stories</div></main>
<footer>Footer links</footer><img src="/site-promo.png" alt="Promotion">
</body></html>`

it('imports only the article even when the site shell is much longer', async () => {
  vi.mocked(fetchText).mockResolvedValue({
    text: page,
    contentType: 'text/html',
    finalUrl: 'https://example.com/blog/led'
  })
  const source = await readSourceUrl('https://example.com/blog/led')
  expect(source.text).toBe(
    'For my roommate’s birthday, I bought an LED display.\n\n## Moving to a Raspberry Pi\n\nA voice service delegates requests to a renderer.\n\nThe renderer sends frames to the panel.'
  )
  expect(source.headings).toEqual([
    { level: 2, text: 'Moving to a Raspberry Pi' }
  ])
  expect(source.images).toEqual([
    { url: 'https://example.com/diagram.png', alt: 'The display pipeline' }
  ])
})

it('keeps article headings, prose, code, tables, and useful links while stripping embedded site controls', () => {
  const result = articleText(
    content(`<html><body><article>
    <header><h1>The pipeline</h1></header>
    <p>Read <a href="/reference">the reference</a> for details.</p>
    <nav>Table of contents</nav><div class="newsletter">Subscribe</div>
    <div role="navigation">Other pages</div><div hidden>Hidden menu</div>
    <h2>Results</h2><table><tr><th>Size</th><th>Time</th></tr><tr><td>128</td><td>42 ms</td></tr></table>
    <pre><code>draw(frame)\nflush()</code></pre>
  </article></body></html>`)
  )
  expect(result.text).toContain('# The pipeline')
  expect(result.text).toContain('Read the reference for details.')
  expect(result.text).toContain('| 128 | 42 ms |')
  expect(result.text).toContain('```\ndraw(frame)\nflush()\n```')
  expect(result.text).not.toMatch(/contents|Subscribe|Other pages|Hidden menu/)
  expect(result).toMatchObject({ tables: 1, codeBlocks: 1 })
})

it('prefers the declared article body and ignores hidden or sidebar article previews', () => {
  expect(
    text(`<html><body>
    <aside><article>${'Sidebar preview '.repeat(100)}</article></aside>
    <div hidden><article>${'Mobile copy '.repeat(100)}</article></div>
    <article><div>Share this post</div><div itemprop="articleBody"><p>The actual post.</p></div></article>
  </body></html>`)
  ).toBe('The actual post.')
})

it('uses main content when there is no article and the body only as a fallback', () => {
  expect(
    text(
      '<html><body><div>Outside menu</div><main><h1>The story</h1><p>Its content.</p></main></body></html>'
    )
  ).toBe('# The story\n\nIts content.')
  expect(
    text(
      '<html><body><header>Site title</header><nav>Menu</nav><div><h1>Simple post</h1><p>The text.</p></div><footer>Footer</footer></body></html>'
    )
  ).toBe('# Simple post\n\nThe text.')
})

it('does not mutate the original document used for separate branding extraction', () => {
  const { document } = parseHTML(page)
  sourceContent(document)
  expect(document.querySelector('footer')?.textContent).toBe('Footer links')
  expect(document.querySelector('main header h1')?.textContent).toBe(
    'LED display'
  )
})
