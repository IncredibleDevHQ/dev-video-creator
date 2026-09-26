import { describe, expect, it } from 'vitest'
import { familiesOf, themeFacesOf, typeFacesOf } from './type-faces'

// BoltDB review B11: a produced scene's labels set in a generic serif read
// serif on the stage and sans-serif in its MP4 — the producer puts its own
// Inter first as it renders. This fixture sets type every way the producer
// reads it. No network: only the producer's embedded faces can be had.
const offline = { fetchImpl: (async () => { throw new Error('offline') }) as unknown as typeof fetch, fontFetchRetryPolicy: { maxAttempts: 1, attemptTimeoutMs: 50, maxElapsedMs: 50, baseDelayMs: 0 }, allowSystemFontCapture: false }
const FIXTURE = `<!doctype html><html><head><style>
:root { --label-font: serif; --gap: 12px; }
.title { font-family: serif; font-size: 64px; }
.code { font-family: monospace }
.body{font-family:system-ui,sans-serif}
.named { font-family: "Source Serif 4", Georgia, serif; }
@font-face { font-family: 'Hand'; src: url(./hand.woff2); }
</style></head><body>
<div class="title">Old root</div><div class="code">page 3</div>
<p style="font-family: ui-monospace; color: #111">inline</p>
<span data-font-family="serif">data</span>
</body></html>`

describe('the type a produced scene is set in', () => {
  it('reads a family list as the producer does', () => {
    expect(familiesOf(`"Source Serif 4", Georgia, 'Times New Roman', serif`)).toEqual(['Source Serif 4', 'Georgia', 'Times New Roman', 'serif'])
    expect(familiesOf('var(--a, serif), monospace')).toEqual(['var(--a, serif)', 'monospace'])
  })

  it('never leaves a generic family first, for the producer to put Inter ahead of', async () => {
    const { html, report } = await typeFacesOf(FIXTURE, offline)
    expect(html).toContain(`font-family: 'EB Garamond', serif;`)
    expect(html).toContain(`font-family: 'JetBrains Mono', monospace`)
    expect(html).toContain(`font-family:'Inter', system-ui,sans-serif`)
    expect(html).toContain(`--label-font: 'EB Garamond', serif;`)
    expect(html).toContain('--gap: 12px;')
    expect(html).toContain(`style="font-family: 'JetBrains Mono', ui-monospace; color: #111"`)
    expect(html).toContain(`data-font-family="'EB Garamond', serif"`)
    // A face that names itself, and a named family first, stay as they are.
    expect(html).toContain(`@font-face { font-family: 'Hand'; src: url(./hand.woff2); }`)
    expect(html).toContain(`font-family: "Source Serif 4", Georgia, serif;`)
    // What the producer would change, it finds nothing of.
    for (const match of html.matchAll(/(?:^|[{;\s"])font-family\s*:\s*([^;{}"]+)/g)) {
      const first = familiesOf(match[1])[0]?.toLowerCase()
      expect(['serif', 'monospace', 'sans-serif', 'system-ui', 'ui-monospace', 'ui-serif'].includes(first), match[1]).toBe(false)
    }
    expect(report.substituted).toEqual({ serif: 'EB Garamond', monospace: 'JetBrains Mono', 'system-ui': 'Inter', 'ui-monospace': 'JetBrains Mono' })
  })

  it('embeds the producer\'s own faces, and says which face could not be had', async () => {
    const { html, report } = await typeFacesOf(FIXTURE, offline)
    expect(html).toContain('data-hyperframes-deterministic-fonts')
    for (const face of ['EB Garamond', 'JetBrains Mono', 'Inter']) expect(html).toMatch(new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*["']?${face}`))
    expect(report.faces).toEqual(expect.arrayContaining(['EB Garamond', 'JetBrains Mono', 'Inter', 'Source Serif 4']))
    // Offline, the theme's face cannot be had; it falls back alike on the
    // stage and in the render, and is said.
    expect(report.unresolved).toEqual(['Source Serif 4'])
  })

  it('embeds once: a bundle it has seen is left as it is', async () => {
    const first = await typeFacesOf(FIXTURE, offline)
    const again = await typeFacesOf(first.html, offline)
    expect(again.html).toBe(first.html)
  })
})

// R05 of the project-flow rereview: a slide sets its text in SVG font-family
// attributes, which neither this nor the producer read — so a Source Serif 4
// title reported nothing unresolved, and the PDF set it in Times. And R10:
// a face declared with src: local() alone counted as embedded, though the
// bundle carried nothing.
const SLIDE = `<!doctype html><html><head></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
<text x="80" y="160" font-family="Source Serif 4, Segoe UI, sans-serif" font-size="72">The whole database is one file</text>
<text x="80" y="300" font-family="Inter, sans-serif" font-size="36">Pages are 4 KB each</text>
<g font-family="JetBrains Mono, monospace"><text x="80" y="420" font-size="28">page 3 · leaf</text></g>
<text x="80" y="540" font-family="serif" font-size="28">A generic serif</text>
</svg></body></html>`

describe('the type a drawing sets in its own attributes', () => {
  it('reads an SVG\'s font-family attributes: each face embedded, or said to be missing', async () => {
    const { html, report } = await typeFacesOf(SLIDE, offline)
    expect(report.faces).toEqual(expect.arrayContaining(['Source Serif 4', 'Inter', 'JetBrains Mono', 'EB Garamond']))
    // Offline, the renderer's own faces are embedded; the theme's is not,
    // and is said — never an empty list for a face it did not have.
    expect(report.unresolved).toEqual(['Source Serif 4'])
    for (const face of ['Inter', 'JetBrains Mono', 'EB Garamond']) expect(html).toMatch(new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*["']?${face}`))
    // A generic family first gets the producer's face ahead of it, as in CSS.
    expect(html).toContain(`font-family="'EB Garamond', serif"`)
    // A bare name CSS cannot read — a word starting with a number — is
    // quoted, or the whole list is dropped for the default serif; a list
    // CSS reads is left as it is.
    expect(html).toContain(`font-family="'Source Serif 4', 'Segoe UI', sans-serif"`)
    expect(html).toContain(`font-family="Inter, sans-serif"`)
    expect(report.substituted).toEqual({ serif: 'EB Garamond' })
    const again = await typeFacesOf(html, offline)
    expect(again.html).toBe(html)
  })

  it('quotes a bare family CSS cannot read, in a style sheet too', async () => {
    const { html } = await typeFacesOf(`<!doctype html><html><head><style>.title { font-family: Source Serif 4, Georgia, serif; } .body { font-family: Segoe UI, sans-serif; }</style></head><body><p class="title">x</p><p class="body">y</p></body></html>`, offline)
    expect(html).toContain(`.title { font-family: 'Source Serif 4', 'Georgia', serif; }`)
    expect(html).toContain(`.body { font-family: Segoe UI, sans-serif; }`)
  })

  it('does not take a face declared with src: local() alone as embedded', async () => {
    const local = SLIDE.replace('<head></head>', `<head><style>@font-face { font-family: 'Source Serif 4'; src: local('Source Serif 4'), local('SourceSerif4-Regular'); } @font-face { font-family: 'Hand'; src: url(./hand.woff2); }</style></head>`)
    const { html, report } = await typeFacesOf(local, offline)
    // Set aside, for the face itself; offline it cannot be had, and is said.
    expect(report.localOnly).toEqual(['Source Serif 4'])
    expect(report.unresolved).toEqual(['Source Serif 4'])
    expect(html).not.toContain("src: local('Source Serif 4')")
    // A face the bundle carries stays, as it was.
    expect(html).toContain(`@font-face { font-family: 'Hand'; src: url(./hand.woff2); }`)
  })

  it('embeds the face in place of a local() declaration, when it can be had', async () => {
    // Menlo, named on this machine only; the renderer has its own face for
    // it, carried in the bundle as data — portable, unlike local().
    const local = SLIDE.replace('Source Serif 4', 'Menlo').replace('<head></head>', `<head><style>@font-face { font-family: 'Menlo'; src: local('Menlo'); }</style></head>`)
    const { html, report } = await typeFacesOf(local, offline)
    expect(report.localOnly).toEqual(['Menlo'])
    expect(report.unresolved).toEqual([])
    expect(html).toMatch(/@font-face\s*\{\s*font-family:\s*"Menlo";\s*src:\s*url\("data:font\/woff2;base64,/)
    expect(html).not.toContain("local('Menlo')")
  })
})

// Q01 of the BoltDB review: which of a theme's families can be had, said
// before a scene is produced. Offline, the renderer's own faces can; a
// family only published elsewhere cannot.
describe('the faces a theme names', () => {
  it('says which the renderer can have, and what the rest fall back to', async () => {
    const faces = await themeFacesOf({ display: 'Source Serif 4', body: 'Inter', mono: 'Consolas, monospace' }, offline)
    expect(faces).toEqual([
      { role: 'display', family: 'Source Serif 4', available: false, fallback: 'sans-serif' },
      { role: 'body', family: 'Inter', available: true, fallback: 'sans-serif' },
      { role: 'mono', family: 'Consolas', available: true, fallback: 'monospace' },
    ])
  })
})
