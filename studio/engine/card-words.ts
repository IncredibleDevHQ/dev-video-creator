// A card's words as the studio's own checks read them: its sentences, the
// content words of each (lower case, stemmed, the small words left out) and
// the words drawn on its wireframe. The series' gap check and the claim check
// compare these; no model reads them here.

const SMALL = new Set(
  (
    'a an the and or but so nor yet of to in on at by for with from as into ' +
    'onto out up down over under off about after before while until than ' +
    'then because though although if unless whether through between during ' +
    'without within per via is are was were be been being am do does did ' +
    'done doing has have had having can could will would shall should may ' +
    'might must it its it’s this that these those there here what when where ' +
    'which who whom whose why how i you he she we they me him her us them my ' +
    'your his our their mine yours ours theirs itself not no yes never ever ' +
    'just only also very too more most some any each every all both few ' +
    'many much such own other another again still even let lets let’s get ' +
    'gets got isn’t aren’t wasn’t weren’t don’t doesn’t didn’t can’t ' +
    'cannot won’t wouldn’t shouldn’t couldn’t hasn’t haven’t hadn’t'
  ).split(' ')
)

/** A word without its common endings, so "rejected" meets "reject" and
 * "arrives" meets "arrive". */
export const stem = (word: string) => {
  let w = word
  if (w.length <= 3 || /\d/.test(w)) return w
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`
  else if (w.endsWith('sses')) w = w.slice(0, -2)
  else if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1)
  const ending = /(?:ing|ed)$/.exec(w)?.[0]
  const rest = ending ? w.slice(0, -ending.length) : ''
  if (rest.length >= 3 && /[aeiouy]/.test(rest)) {
    w = rest
    if (w.endsWith('i')) w = `${w.slice(0, -1)}y`
    else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1)
  }
  if (w.endsWith('ly') && w.length > 4) w = w.slice(0, -2)
  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1)
  return w
}

/** A text's words in order, lower case, apostrophes as typeset. */
export const tokensOf = (text: string) =>
  String(text || '')
    .toLowerCase()
    .replace(/'/g, '’')
    .split(/[^a-z0-9%’]+/)
    .map((word) => word.replace(/^’+|’+$/g, ''))
    .filter(Boolean)

/** The content words of a text, stemmed, in order: what it is about. */
export const contentWords = (text: string) =>
  tokensOf(text)
    .filter((word) => !SMALL.has(word) && (word.length > 1 || /\d/.test(word)))
    .map(stem)

/** Words that turn the next content word around: "never rejects", "don't
 * reuse", "no retry", "without a key". */
const NEGATORS = new Set([
  'not',
  'no',
  'never',
  'nor',
  'neither',
  'none',
  'nothing',
  'nobody',
  'without',
  'cannot'
])
const negates = (word: string) => NEGATORS.has(word) || word.endsWith('n’t')

/**
 * A text's content words, as contentWords gives them, each one a negation
 * turns around marked "¬" ("the server never rejects it" is server, ¬reject):
 * a passage that says the opposite of what a gap asks doesn't cover it
 * (review 8, round 2's audit). A negation reaches the next content word of
 * its clause only, so "don't reuse the first result" is ¬reuse, first,
 * result.
 */
export const polarWords = (text: string) =>
  String(text || '')
    .split(/[,;:!?.()—–]+|\s-\s/)
    .flatMap((clause) => {
      let negated = false
      return tokensOf(clause).flatMap((word) => {
        if (negates(word)) {
          negated = true
          return []
        }
        if (SMALL.has(word) || (word.length <= 1 && !/\d/.test(word))) return []
        const said = negated ? `¬${stem(word)}` : stem(word)
        negated = false
        return [said]
      })
    })
/** The same word said the other way round. */
export const turned = (word: string) =>
  word.startsWith('¬') ? word.slice(1) : `¬${word}`

/** A text's sentences: split at full stops, question and exclamation marks
 * and line breaks; list marks and headings are left out. */
export const sentencesOf = (text: string) =>
  String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.replace(/^[\s#>*•–—-]+/, '').trim())
    .filter((part) => /[a-z0-9]/i.test(part))

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) =>
    name[0] === '#'
      ? String.fromCodePoint(
          name[1].toLowerCase() === 'x'
            ? parseInt(name.slice(2), 16)
            : parseInt(name.slice(1), 10)
        )
      : (ENTITIES[name.toLowerCase()] ?? whole)
  )

/** The words drawn on a wireframe: each label, its lines joined. */
export const drawnWords = (svg: string | null | undefined) =>
  [...String(svg || '').matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((match) =>
      decode(match[1].replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
