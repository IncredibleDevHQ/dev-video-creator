import { describe, expect, it } from 'vitest'
import { REFERENCE_STYLE, acceptArtwork, briefKey, briefPrompt, referenceObjects } from './appearance'

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
})
