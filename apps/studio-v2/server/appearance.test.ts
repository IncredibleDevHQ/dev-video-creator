import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REFERENCE_STYLE, acceptArtwork, briefKey, briefPrompt, concurrencyObjects, knownObjects, referenceObjects } from './appearance'

describe('the artwork brief', () => {
  it('describes the object family the reference explanation is built from', () => {
    const objects = referenceObjects()
    expect(objects.map(object => object.entity)).toEqual(['token-bucket', 'server', 'request'])
    // The bucket can show every state the story puts it in.
    const bucket = objects[0]
    expect(bucket.states).toEqual(['full', 'partly spent', 'empty', 'refilling'])
    expect(bucket.parts.map(part => part.id)).toContain('tokens')
    expect(bucket.parts.map(part => part.id)).toContain('level')
    // Numbers and names belong to the page, not to the drawing.
    expect(bucket.keepsTextOut.join(' ')).toMatch(/count/)
    expect(objects.every(object => object.style.family === REFERENCE_STYLE.family)).toBe(true)
  })

  it('asks for named parts, a transparent ground and no baked-in text', () => {
    const prompt = briefPrompt(referenceObjects()[0])
    expect(prompt).toMatch(/separate groups, each with its own id/)
    expect(prompt).toMatch(/transparent/)
    expect(prompt).toMatch(/Draw no text/)
    expect(prompt).toMatch(/viewBox "0 0 260 220"/)
  })

  it('keys artwork by what it draws, so rewording a scene does not redraw it', () => {
    const [bucket] = referenceObjects()
    const same = { ...bucket, represents: bucket.represents }
    expect(briefKey(bucket)).toBe(briefKey(same))
    const wider = { ...bucket, size: { width: 300, height: 220 } }
    expect(briefKey(bucket)).not.toBe(briefKey(wider))
    const restyled = { ...bucket, style: { ...bucket.style, angle: 'front' as const } }
    expect(briefKey(bucket)).not.toBe(briefKey(restyled))
  })
})

describe('accepting artwork', () => {
  const [bucket] = referenceObjects()
  const drawing = (extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
    <defs><linearGradient id="fade"/></defs>
    <g id="shell" fill="url(#fade)"><rect x="10" y="10" width="200" height="180"/></g>
    <g id="tokens"><circle cx="40" cy="60" r="10"/></g>
    <g id="level"><rect x="20" y="150" width="160" height="20"/></g>
    <g id="inlet"><path d="M 10 10 L 20 20"/></g>${extra}
  </svg>`

  it('accepts a drawing whose parts the scene can move, and makes its ids its own', () => {
    const accepted = acceptArtwork(drawing(), bucket)
    expect(accepted.ok).toBe(true)
    expect(accepted.missing).toEqual([])
    expect(accepted.parts.map(part => part.element)).toEqual(['g', 'g', 'g', 'g'])
    // The page places it at the size the brief asked for.
    expect(accepted.svg).toMatch(/viewBox="0 0 260 220"/)
    expect(accepted.svg).not.toMatch(/width="500"/)
    // Ids and the references to them are prefixed together.
    const prefix = accepted.parts[0].id.replace(/-shell$/, '')
    expect(accepted.svg).toMatch(new RegExp(`id="${prefix}-tokens"`))
    expect(accepted.svg).toMatch(new RegExp(`url\\(#${prefix}-fade\\)`))
  })

  it('refuses a drawing the scene cannot animate, and says what is missing', () => {
    const withoutTokens = drawing().replace('id="tokens"', 'id="blob"')
    const accepted = acceptArtwork(withoutTokens, bucket)
    expect(accepted.ok).toBe(false)
    expect(accepted.missing).toEqual(['tokens'])
    expect(accepted.problems.join(' ')).toMatch(/tokens/)
  })

  it('refuses artwork that reaches outside itself', () => {
    const external = acceptArtwork(drawing('<image href="https://example.com/a.png"/>'), bucket)
    expect(external.ok).toBe(false)
    expect(external.problems.join(' ')).toMatch(/image, script or foreignObject/)
  })

  // ——— A second mechanism, told with the same objects ———
  it('draws the concurrency limit from its own objects and the reference hand', () => {
    const objects = concurrencyObjects()
    expect(objects.map(object => object.entity)).toEqual(['slot-pool', 'waiting-line'])
    const pool = objects[0]
    // What the story does to it: takes a slot, fills up, frees one.
    expect(pool.parts.map(part => part.id)).toEqual(['shell', 'slots', 'occupied', 'gate'])
    expect(pool.states).toContain('full')
    expect(pool.states).toContain('a slot freed')
    // The same hand: one family, so the two explanations look like one product.
    expect(objects.every(object => object.style.family === REFERENCE_STYLE.family)).toBe(true)
    expect(briefPrompt(pool)).toMatch(/diagram about concurrency limits/)
  })

  it('reuses the request and the server rather than drawing them again', () => {
    // The key is what a drawing is filed under. The travelling request is the
    // same brief in both explanations, so the second one costs nothing.
    const before = referenceObjects().map(briefKey)
    const known = knownObjects()
    expect(known.map(object => object.entity)).toEqual(['token-bucket', 'server', 'request', 'slot-pool', 'waiting-line'])
    expect(known.slice(0, 3).map(briefKey)).toEqual(before)
    // And the new objects are their own drawings, not the old ones renamed.
    expect(new Set(known.map(briefKey)).size).toBe(known.length)
  })

  it('tells the page-master the same objects the studio can draw', () => {
    // The drawing agent picks an object family by name; the studio looks the
    // brief up by that name. One list, or a page names something unbuildable.
    const shipped = JSON.parse(readFileSync(new URL('../../studio-desktop/skills/page-master/references/objects.json', import.meta.url), 'utf8')) as {
      objects: Array<{ entity: string; parts: Array<{ id: string }> }>
    }
    expect(shipped.objects.map(object => object.entity)).toEqual(knownObjects().map(object => object.entity))
    shipped.objects.forEach((object, index) => {
      expect(object.parts.map(part => part.id)).toEqual(knownObjects()[index].parts.map(part => part.id))
    })
  })
})

describe('reusable SVG normalization', () => {
  it('fits a provider canvas instead of cropping it to the brief', () => {
    const brief = { ...referenceObjects()[0], size: { width: 260, height: 220 }, parts: [{ id: 'body', what: 'body' }] }
    const result = acceptArtwork('<svg viewBox="100 200 500 500"><g id="body"><rect x="100" y="200" width="500" height="500"/></g></svg>', brief)
    expect(result.ok).toBe(true)
    expect(result.svg).toContain('matrix(0.44 0 0 0.44 -24 -88)')
  })
  it('prefixes single-quoted IDs and their references together', () => {
    const brief = { ...referenceObjects()[0], parts: [{ id: 'body', what: 'body' }] }
    const result = acceptArtwork("<svg viewBox='0 0 260 220'><defs><linearGradient id='ink'/></defs><g id='body' fill=\"url('#ink')\"/></svg>", brief)
    expect(result.ok).toBe(true)
    expect(result.svg).toContain(`id="${result.parts[0].id}"`)
    expect(result.svg).not.toContain("url('#ink')")
  })
  it('rejects event handlers and external CSS paints in reusable artwork', () => {
    const brief = { ...referenceObjects()[0], parts: [{ id: 'body', what: 'body' }] }
    for (const attribute of ['onload="alert(1)"', 'fill="url(https://example.com/paint.svg)"']) {
      expect(acceptArtwork(`<svg><g id="body" ${attribute}/></svg>`, brief).ok).toBe(false)
    }
  })
})
