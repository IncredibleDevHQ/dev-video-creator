// A font-family value as CSS reads it, the same for the renderer's type
// (server/type-faces.ts) and the stage's live drawing of a page.

// The families the producer counts as generic (its GENERIC_FAMILIES).
export const GENERIC = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont'])

// A value's entries as written, split on the commas outside quotes and
// brackets.
const entriesOf = (value: string) => {
  const entries: string[] = []
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
      entries.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  entries.push(value.slice(start).trim())
  return entries
}

// A font-family value's families, unquoted — as the producer reads one.
export const familiesOf = (value: string) => entriesOf(value).map(family => family.replace(/^['"]|['"]$/g, '').trim()).filter(Boolean)

// A family list CSS can read (R05 of the project-flow rereview). A drawing
// often names a face bare — font-family="Source Serif 4, Segoe UI" — which
// CSS cannot parse: a bare name may not have a word that starts with a
// number, so the whole list is dropped, and the text is set in whatever the
// page around it uses — the studio's sans-serif on the stage, the default
// serif in a PDF. Such a list is given back with every named family
// quoted; a list CSS reads already is left as it is (null).
const bareName = /^-?[A-Za-z_ -￿][\w -￿-]*(?:\s+-?[A-Za-z_ -￿][\w -￿-]*)*$/
export const readableList = (value: string) => {
  const unreadable = entriesOf(value).some(entry => entry && !/^(['"]).*\1$/.test(entry) && !/^var\(/i.test(entry) && !bareName.test(entry))
  if (!unreadable) return null
  return familiesOf(value).map(family => (GENERIC.has(family.toLowerCase()) || /^var\(/i.test(family) ? family : `'${family.replace(/'/g, '')}'`)).join(', ')
}
