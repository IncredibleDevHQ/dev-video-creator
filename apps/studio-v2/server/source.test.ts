import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractionOf, githubDocumentOf, markdownDocument, readSourceNarrative, readSourceUrl, renderPage, statFigure, type OutlineScene, type PageBrand } from './source'

// F1 of the fresh end-to-end review: the schematic page for Anthropic's
// latency results printed "50" and "95" captioned "pTTFT" — the percentile
// in the label read as the measured value. A number in a name is a label.
const brand: PageBrand = { ground: '#f5f1ea', text: '#191919', muted: '#6b6b6b', line: '#d8d2c8', accent: '#c96442', secondary: '#5a7a9a', panel: '#ece6dc', display: 'font-family="serif"', body: 'font-family="sans-serif"', mono: 'font-family="monospace"' }

describe('a stat page states only the figures its labels state', () => {
  it('reads a figure only where the label states one', () => {
    expect(statFigure('99.9% uptime')).toEqual({ figure: '99.9%', caption: 'uptime' })
    expect(statFigure('Uptime 99.9%')).toEqual({ figure: '99.9%', caption: 'Uptime' })
    expect(statFigure('40 ms')).toEqual({ figure: '40 ms', caption: '' })
    expect(statFigure('3× faster')).toEqual({ figure: '3×', caption: 'faster' })
    expect(statFigure('10 regions')).toEqual({ figure: '10', caption: 'regions' })
    expect(statFigure('~60% lower')).toEqual({ figure: '~60%', caption: 'lower' })
    expect(statFigure('1,200 requests a second')).toEqual({ figure: '1,200', caption: 'requests a second' })
    // Percentiles, versions, model and product names, and years are labels.
    for (const label of ['p50 TTFT', 'p95 TTFT', 'v2 API', 'GPT-4 calls', 'H100 GPUs', 'Claude 3.5 Sonnet', 'S3 buckets', '2024 launch', 'Since 2019']) {
      expect(statFigure(label), label).toBeNull()
    }
  })

  it('renders percentile metrics as written, with the detail that holds their value', () => {
    const scene: OutlineScene = {
      title: 'Latency once the brain is decoupled',
      idea: 'Time to first token falls at every percentile',
      kind: 'numbers',
      seconds: 8,
      parts: [
        { kind: 'number', label: 'p50 TTFT', detail: 'roughly 60% lower' },
        { kind: 'number', label: 'p95 TTFT', detail: 'over 90% lower' },
      ] as OutlineScene['parts'],
      relations: [],
      narration: '',
      source: [],
    }
    const svg = renderPage(scene, 10, 13, brand, { title: 'Scaling Managed Agents', site: 'anthropic.com' })
    expect(svg).toContain('p50 TTFT')
    expect(svg).toContain('p95 TTFT')
    expect(svg).toContain('roughly 60% lower')
    expect(svg).toContain('over 90% lower')
    expect(svg).not.toMatch(/>(50|95)</)
    expect(svg).not.toContain('pTTFT')
    // A real figure still leads its stat.
    const figures = renderPage({ ...scene, parts: [{ kind: 'number', label: '99.9% uptime', detail: 'across regions' }] as OutlineScene['parts'] }, 10, 13, brand, { title: 'x', site: 'x' })
    expect(figures).toMatch(/font-weight="bold"[^>]*>99\.9%</)
  })
})

// F3–F5 of the Perplexity review: a GitHub document URL read 17 words of
// the host's navigation, with GitHub's colours and logo as the brand; and a
// fallback palette read as if it were seen on the site.
const DOCUMENT = `fabric-lib: point-to-point transfers
====================================

A library for moving tensors between GPUs across nodes.

## Dispatch and combine

Each token goes to the GPUs that hold its experts, over NVLink inside a node and RDMA between nodes.

| Batch | Dispatch | Combine |
| ----- | -------- | ------- |
| 128   | 42 µs    | 51 µs   |

\`\`\`python
# not a heading
engine.submit(transfer)
\`\`\`

See [the paper](https://example.com/paper) and ![the kernel](kernel.png).
`
afterEach(() => vi.unstubAllGlobals())

describe('a document its code host serves', () => {
  it('reads a GitHub file or repository address as the document it names', () => {
    expect(githubDocumentOf(new URL('https://github.com/perplexityai/pplx-garden/blob/main/docs/fabric-lib.md'))).toEqual({ owner: 'perplexityai', repo: 'pplx-garden', ref: 'main', path: 'docs/fabric-lib.md' })
    expect(githubDocumentOf(new URL('https://github.com/perplexityai/pplx-garden'))).toEqual({ owner: 'perplexityai', repo: 'pplx-garden', ref: 'HEAD', path: 'README.md' })
    expect(githubDocumentOf(new URL('https://github.com/perplexityai/pplx-garden/blob/main/src/lib.rs'))).toBeNull()
    expect(githubDocumentOf(new URL('https://github.com/perplexityai/pplx-garden/issues/3'))).toBeNull()
    expect(githubDocumentOf(new URL('https://example.com/a/b'))).toBeNull()
  })

  it('reads Markdown as headings, prose, tables and code', () => {
    const read = markdownDocument(DOCUMENT)
    expect(read.headings).toEqual([{ level: 1, text: 'fabric-lib: point-to-point transfers' }, { level: 2, text: 'Dispatch and combine' }])
    expect(read.text).toMatch(/^# fabric-lib: point-to-point transfers\n\nA library/)
    expect(read.text).toContain('| 128   | 42 µs    | 51 µs   |')
    expect(read.text).toContain('# not a heading')
    expect(read.text).toContain('See the paper and (figure: the kernel).')
  })

  it('reads the document from the host at its commit, and leaves the host\'s chrome out of the brand', async () => {
    const commit = '1ed972ed3f0bd5616c997c9507c25616c63394fc'
    const fetched: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      fetched.push(String(url))
      if (String(url).startsWith('https://raw.githubusercontent.com/perplexityai/pplx-garden/main/docs/fabric-lib.md')) return new Response(DOCUMENT, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      if (String(url) === 'https://api.github.com/repos/perplexityai/pplx-garden/commits/main' && init?.headers?.accept === 'application/vnd.github.sha') return new Response(commit, { status: 200, headers: { 'content-type': 'application/vnd.github.sha' } })
      return new Response('not found', { status: 404 })
    }))
    const read = await readSourceUrl('https://github.com/perplexityai/pplx-garden/blob/main/docs/fabric-lib.md')
    expect(fetched.some(url => url === 'https://github.com/perplexityai/pplx-garden/blob/main/docs/fabric-lib.md')).toBe(false)
    expect(read).toMatchObject({ kind: 'url', title: 'fabric-lib: point-to-point transfers', site: 'github.com/perplexityai', url: 'https://github.com/perplexityai/pplx-garden/blob/main/docs/fabric-lib.md', origin: { host: 'github', owner: 'perplexityai', repo: 'pplx-garden', ref: 'main', commit, path: 'docs/fabric-lib.md' } })
    expect(read.text).toContain('| 128   | 42 µs    | 51 µs   |')
    expect(read.headings.map(heading => heading.text)).toEqual(['fabric-lib: point-to-point transfers', 'Dispatch and combine'])
    expect(read.palette).toMatchObject({ provenance: 'fallback', candidates: [] })
    expect(read.logos[0]).toMatchObject({ url: 'https://github.com/perplexityai.png?size=200', source: 'perplexityai on GitHub' })
    expect(read.warnings.join(' ')).toMatch(/at 1ed972e\. GitHub's own page colours and logo are left out/)
    // A short document is still what it is; a navigation page is thin.
    expect(read.extraction).toMatchObject({ confidence: 'thin', headings: 2 })
    expect(read.extraction.excerpt).toMatch(/^# fabric-lib/)
  })
})

describe('what a read is sure of', () => {
  it('calls a read of a page\'s navigation thin, and pasted words good', () => {
    expect(extractionOf('Sign in Pricing Docs Blog Careers', 0, 'github.com')).toMatchObject({ confidence: 'thin', words: 6, reason: 'Only 6 words were read from github.com — it may be the page\'s navigation, not the article.' })
    expect(extractionOf('word '.repeat(400), 3).confidence).toBe('good')
    const navigation = readSourceNarrative('Sign in · Pricing · Docs · Blog')
    expect(navigation.extraction.confidence).toBe('good')
    expect(navigation.palette).toMatchObject({ provenance: 'fallback', from: 'no brand website was given' })
  })
})
