// The type a produced scene is set in, the same on the stage and in its
// render (BoltDB review B11). As it renders, the producer puts its own Inter
// ahead of any font-family that names a generic family first, and embeds
// the faces a composition asks for; the stage played the bundle as it was
// handed in. A label set in `serif` read serif on the stage and sans-serif
// in the accepted MP4, and the output said generic serif was used.
//
// When a production is handed in, a generic family set first is given the
// face the producer itself uses for that kind of type — EB Garamond for
// serif, JetBrains Mono for monospace, Inter otherwise — and the producer's
// own faces are embedded in the bundle. The stage then plays, and the render
// renders, the same faces: the producer finds them already there and leaves
// them be. What was put in place of what, and any face that could not be
// had, is said.
import { injectDeterministicFontFaces, type InjectDeterministicFontFacesOptions } from '@hyperframes/producer'
import { parseHTML } from 'linkedom'

// The families the producer counts as generic (its GENERIC_FAMILIES).
const GENERIC = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont'])
// The face for each kind, as the producer maps that kind's system faces.
export const faceForGeneric = (generic: string) =>
  generic === 'serif' || generic === 'ui-serif' ? 'EB Garamond' : generic === 'monospace' || generic === 'ui-monospace' ? 'JetBrains Mono' : 'Inter'

export type TypeReport = {
  // The faces the scene's type is set in, first families as declared.
  faces: string[]
  // A generic family set first, and the face put ahead of it.
  substituted: Record<string, string>
  // Faces asked for that could not be had: they fall back alike on the
  // stage and in the render.
  unresolved: string[]
}

// A font-family value's families, split on the commas outside quotes and
// brackets, unquoted — as the producer reads one.
export const familiesOf = (value: string) => {
  const families: string[] = []
  let quote = ''
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (char === ',' && depth === 0) {
      families.push(value.slice(start, index))
      start = index + 1
    }
  }
  families.push(value.slice(start))
  return families.map(family => family.trim().replace(/^['"]|['"]$/g, '').trim()).filter(Boolean)
}

const typedValue = (value: string, substituted: Record<string, string>) => {
  const first = familiesOf(value)[0]?.toLowerCase()
  if (!first || !GENERIC.has(first)) return null
  const face = faceForGeneric(first)
  substituted[first] = face
  return `'${face}', ${value.trim()}`
}

// Declarations in a style sheet or a style attribute: font-family, and the
// custom properties the producer also reads as families. @font-face blocks
// name the faces themselves and are left as they are.
const typedCss = (css: string, substituted: Record<string, string>) => {
  const faces: string[] = []
  const masked = css.replace(/@font-face\s*\{[^}]*\}/gi, block => `\u0000${faces.push(block) - 1}\u0000`)
  const typed = masked.replace(/(^|[{;\s])(font-family|--[A-Za-z0-9_-]+)(\s*:\s*)([^;{}]+)/g, (whole, lead: string, prop: string, colon: string, value: string) => {
    const next = typedValue(value, substituted)
    return next === null ? whole : `${lead}${prop}${colon}${next}`
  })
  return typed.replace(/\u0000(\d+)\u0000/g, (_whole, index: string) => faces[Number(index)])
}

// The first family of each declaration a document sets its type in.
const declaredFaces = (html: string) => {
  const { document } = parseHTML(html)
  const values: string[] = []
  const fromCss = (css: string) => {
    const masked = css.replace(/@font-face\s*\{[^}]*\}/gi, '')
    for (const match of masked.matchAll(/(?:^|[{;\s])font-family\s*:\s*([^;{}]+)/g)) values.push(match[1])
  }
  for (const style of Array.from(document.querySelectorAll('style'))) fromCss(style.textContent || '')
  for (const element of Array.from(document.querySelectorAll('[style]'))) fromCss(element.getAttribute('style') || '')
  for (const element of Array.from(document.querySelectorAll('[data-font-family]'))) values.push(element.getAttribute('data-font-family') || '')
  return [...new Set(values.map(value => familiesOf(value)[0]).filter((family): family is string => Boolean(family) && !family.startsWith('var(') && !GENERIC.has(family.toLowerCase())))]
}
const embeddedFaces = (html: string) =>
  new Set([...html.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*([^;}]+)/gi)].map(match => familiesOf(match[1])[0]?.toLowerCase()).filter(Boolean))

export const typeFacesOf = async (html: string, options: InjectDeterministicFontFacesOptions = {}): Promise<{ html: string; report: TypeReport }> => {
  const substituted: Record<string, string> = {}
  const { document } = parseHTML(html)
  let changed = false
  for (const style of Array.from(document.querySelectorAll('style'))) {
    const css = style.textContent || ''
    const next = typedCss(css, substituted)
    if (next !== css) {
      style.textContent = next
      changed = true
    }
  }
  for (const element of Array.from(document.querySelectorAll('[style]'))) {
    const css = element.getAttribute('style') || ''
    const next = typedCss(css, substituted)
    if (next !== css) {
      element.setAttribute('style', next)
      changed = true
    }
  }
  for (const element of Array.from(document.querySelectorAll('[data-font-family]'))) {
    const next = typedValue(element.getAttribute('data-font-family') || '', substituted)
    if (next !== null) {
      element.setAttribute('data-font-family', next)
      changed = true
    }
  }
  const typed = changed ? document.toString() : html
  // The producer's own faces, embedded now rather than as it renders.
  const faced = await injectDeterministicFontFaces(typed, { failClosedFontFetch: false, ...options })
  const embedded = embeddedFaces(faced)
  const faces = declaredFaces(faced)
  return { html: faced, report: { faces, substituted, unresolved: faces.filter(face => !embedded.has(face.toLowerCase())) } }
}

// The faces a theme names, as a scene's type will be set in them (Q01 of the
// BoltDB review): each family the renderer can have — its own faces, the
// family's published files, a face on this machine — or not. Said before a
// scene is produced, and told to the producer, so no family is swapped for
// a generic one by hand and reported missing after the creator waited.
export type ThemeRole = 'display' | 'body' | 'mono'
export type ThemeFace = { role: ThemeRole; family: string; available: boolean; fallback: string }
const FALLBACK: Record<ThemeRole, string> = { display: 'sans-serif', body: 'sans-serif', mono: 'monospace' }
const themeFaces = new Map<string, Promise<ThemeFace[]>>()
const themeFacesSettled = new Map<string, ThemeFace[]>()
const namedFaces = (fonts: Partial<Record<ThemeRole, string | null>> | null | undefined) =>
  (['display', 'body', 'mono'] as ThemeRole[]).flatMap(role => (fonts?.[role] ? [{ role, family: String(fonts[role]).split(',')[0].replace(/["']/g, '').trim() }] : [])).filter(entry => entry.family)
export const themeFacesOf = (fonts: Partial<Record<ThemeRole, string | null>> | null | undefined, options: InjectDeterministicFontFacesOptions = {}) => {
  const named = namedFaces(fonts)
  const key = JSON.stringify(named)
  let resolved = themeFaces.get(key)
  if (!resolved) {
    const css = named.map(entry => `.${entry.role}{font-family:"${entry.family.replace(/"/g, '')}", ${FALLBACK[entry.role]}}`).join('')
    resolved = typeFacesOf(`<!doctype html><html><head><style>${css}</style></head><body></body></html>`, options)
      .then(({ report }) => named.map(entry => ({ ...entry, available: !report.unresolved.some(face => face.toLowerCase() === entry.family.toLowerCase()), fallback: FALLBACK[entry.role] })))
      .catch(() => named.map(entry => ({ ...entry, available: false, fallback: FALLBACK[entry.role] })))
      .then(faces => {
        themeFacesSettled.set(key, faces)
        return faces
      })
    themeFaces.set(key, resolved)
  }
  return resolved
}
// The same, when it is already known: what the overview says without
// waiting for the renderer's font sources.
export const themeFacesNow = (fonts: Partial<Record<ThemeRole, string | null>> | null | undefined) => {
  void themeFacesOf(fonts)
  return themeFacesSettled.get(JSON.stringify(namedFaces(fonts))) || null
}
