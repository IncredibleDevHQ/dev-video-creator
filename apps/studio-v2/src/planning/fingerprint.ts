// A stable fingerprint for planning inputs: the same inputs always hash the
// same, whatever order their keys happen to be in. FNV-1a in two 32-bit
// halves, like the notebook revision — no crypto, the same answer in the
// browser, the server and the desktop tools.

export const stableJson = (value: unknown): string => {
  const stable = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(stable)
    if (entry && typeof entry === 'object') {
      return Object.keys(entry as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((out, key) => {
          const next = (entry as Record<string, unknown>)[key]
          if (next !== undefined) out[key] = stable(next)
          return out
        }, {})
    }
    return entry
  }
  return JSON.stringify(stable(value))
}

export const fingerprintOf = (value: unknown): string => {
  const text = stableJson(value)
  let high = 0x811c9dc5
  let low = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    high = Math.imul(high ^ code, 0x01000193) >>> 0
    low = Math.imul(low ^ ((code << 5) | (code >>> 3)), 0x01000193) >>> 0
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

// Text as a reader would compare it: case, spacing, typographic quotes and
// dashes do not make a quotation a different quotation.
export const comparableText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Is this quotation really in that text? An ellipsis may join fragments, but
// each fragment must be there, in order. Trailing punctuation is forgiven:
// a quotation that ends where a sentence did is still the sentence.
export const quotedIn = (quotation: string, text: string): boolean => {
  const haystack = comparableText(text)
  const fragments = comparableText(quotation)
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map(fragment => fragment.replace(/^[\s"'([]+|[\s"'.,;:!?)\]]+$/g, ''))
    .filter(Boolean)
  if (!fragments.length) return false
  let from = 0
  for (const fragment of fragments) {
    const at = haystack.indexOf(fragment, from)
    if (at < 0) return false
    from = at + fragment.length
  }
  return true
}
