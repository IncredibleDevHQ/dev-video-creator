import { parseHTML } from 'linkedom'
import { expect, it } from 'vitest'
import { articleText } from './source-document'

const read = (body: string) =>
  articleText(
    parseHTML(
      `<html><body><article>${body}</article></body></html>`
    ).document.querySelector('article')!,
    'https://example.com/blog/post'
  )

it('keeps an article’s picture above its caption, and leaves an author avatar out of the text', () => {
  const article = read(`
<h1>Scaling your API</h1>
<figure><img src="https://cdn.example.com/pt.jpg?w=96&h=96" alt=""><figcaption>Paul Tarjan Engineering</figcaption></figure>
<p>Availability and reliability are paramount.</p>
<figure><img src="/images/graph-1.png?w=1620" alt="Graph 1"><figcaption>Request rate limiters restrict users to a maximum number of requests per second.</figcaption></figure>
<p><img src="/icons/logo.svg" alt="logo"> After the picture.</p>`)
  expect(article.text).not.toContain('(figure:')
  expect(article.text).not.toContain('Paul Tarjan')
  expect(article.byline).toBe('Paul Tarjan Engineering')
  expect(article.text).toContain(
    '![Request rate limiters restrict users to a maximum number of requests per second.](https://example.com/images/graph-1.png?w=1620)\n\n*Request rate limiters restrict users to a maximum number of requests per second.*'
  )
  expect(article.text).not.toContain('logo.svg')
})

it('keeps a code figure as code and a picture without a caption as a picture', () => {
  const article = read(`
<figure><pre>const x = 1</pre><figcaption>A constant</figcaption></figure>
<figure><img src="https://example.com/diagram.png" alt="The token bucket"></figure>`)
  expect(article.text).toContain('```\nconst x = 1\n```')
  expect(article.text).toContain(
    '![The token bucket](https://example.com/diagram.png)'
  )
})
