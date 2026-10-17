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
    'cannot won’t wouldn’t shouldn’t couldn’t hasn’t haven’t hadn’t ' +
    'isnt arent wasnt werent dont doesnt didnt cant wont wouldnt ' +
    'shouldnt couldnt hasnt havent hadnt'
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

/** A text's words in order, lower case, apostrophes as typeset; a
 * possessive's ending left off ("the key's window" is key, window: round 3's
 * audit found "key's" never met "key"). */
export const tokensOf = (text: string) =>
  String(text || '')
    .toLowerCase()
    .replace(/'/g, '’')
    .split(/[^a-z0-9%’]+/)
    .map((word) => word.replace(/^’+|’+$/g, '').replace(/’s$/, ''))
    .filter(Boolean)

const isContent = (word: string) =>
  !SMALL.has(word) && (word.length > 1 || /\d/.test(word))

/** The content words of a text, stemmed, in order: what it is about. */
export const contentWords = (text: string) =>
  tokensOf(text).filter(isContent).map(stem)

/** Words that turn the next content word around: "never rejects", "don't
 * reuse", "no retry", "without a key", "hardly ever rejects". */
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
  'cannot',
  'hardly',
  'barely',
  'scarcely',
  'seldom'
])
/** "Doesnt", "dont", "isnt", "cant", "wont": typed without the apostrophe. */
const BARE_NOT =
  /^(?:is|are|was|were|do|does|did|has|have|had|ca|wo|would|should|could|must|need|sha)nt$/
/** How many words from here say "not", or 0: one ("never", "doesnt") or
 * two ("no longer rejects", "fails to reject"); "stops" says it before a
 * word in -ing only ("stops rejecting", not "stops a retry"). */
const negatorAt = (words: string[], at: number) => {
  const [word, next = ''] = [words[at], words[at + 1]]
  if (word === 'no' && next === 'longer') return 2
  if (/^(?:fail(?:s|ed|ing)?|unable|refus(?:e|es|ed|ing))$/.test(word))
    return next === 'to' ? 2 : 0
  if (
    /^(?:stop(?:s|ped|ping)?|ceas(?:e|es|ed|ing)|quit(?:s|ting)?)$/.test(word)
  )
    return /..ing$/.test(next) ? 1 : 0
  return NEGATORS.has(word) || word.endsWith('n’t') || BARE_NOT.test(word)
    ? 1
    : 0
}
/** Words that say how, not what: a negation passes over them to the word
 * it turns ("doesn't always reject" is ¬reject). */
const HOW = new Set(
  (
    'always really actually necessarily simply quite entirely fully once ' +
    'automatically explicitly silently quietly usually normally generally ' +
    'typically currently immediately properly correctly reliably'
  ).split(' ')
)

/**
 * A text's content words, as contentWords gives them, each one a negation
 * turns around marked "¬" ("the server never rejects it" is server, ¬reject):
 * a passage that says the opposite of what a gap asks doesn't cover it
 * (review 8, rounds 2 and 3 of the audit). A negation reaches the next
 * content word of its clause, so "don't reuse the first result" is ¬reuse,
 * first, result; past a word that says how ("doesn't always reject"); and,
 * given the words looked for, to one of them a word further on ("never in
 * practice rejects", "does not in this case reject"). Left at a clause's
 * end, it reaches past a short aside ("does not, in this case, reject").
 */
export const polarWords = (text: string, aims?: Set<string>) =>
  String(text || '')
    .split(/[;:!?.]+/)
    .flatMap((sentence) => {
      const clauses = sentence
        .split(/[,()—–]+|\s-\s/)
        .map(tokensOf)
        .filter((words) => words.length)
      const said: string[] = []
      let negated = false
      let aside = false
      clauses.forEach((words, index) => {
        // One aside of a few words between the negation and its word.
        if (
          negated &&
          !aside &&
          words.length <= 4 &&
          index + 1 < clauses.length
        ) {
          said.push(...words.filter(isContent).map(stem))
          aside = true
          return
        }
        if (!aside) negated = false
        aside = false
        for (let at = 0; at < words.length; ) {
          const takes = negatorAt(words, at)
          if (takes) {
            negated = true
            at += takes
            continue
          }
          const word = words[at++]
          if (!isContent(word)) continue
          if (!negated || HOW.has(word)) {
            said.push(stem(word))
            continue
          }
          negated = false
          const next = words.findIndex(
            (one, from) => from >= at && isContent(one)
          )
          const aimed =
            aims &&
            !aims.has(stem(word)) &&
            next >= 0 &&
            !words
              .slice(at, next + 1)
              .some((_, from) => negatorAt(words, at + from)) &&
            aims.has(stem(words[next]))
          if (aimed) {
            said.push(stem(word), `¬${stem(words[next])}`)
            at = next + 1
          } else said.push(`¬${stem(word)}`)
        }
      })
      return said
    })
/** The same word said the other way round. */
export const turned = (word: string) =>
  word.startsWith('¬') ? word.slice(1) : `¬${word}`

/** Verbs that say each other's opposite: a passage that "accepts" what a
 * gap says is rejected says it the other way round. */
const OPPOSITES = [
  ['accept', 'reject'],
  ['accept', 'refuse'],
  ['allow', 'block'],
  ['allow', 'deny'],
  ['allow', 'forbid'],
  ['permit', 'deny'],
  ['keep', 'drop'],
  ['keep', 'discard'],
  ['keep', 'delete'],
  ['keep', 'lose'],
  ['succeed', 'fail'],
  ['pass', 'fail'],
  ['include', 'exclude'],
  ['enable', 'disable']
].reduce((all, [one, other]) => {
  const [a, b] = [stem(one), stem(other)]
  all.set(a, [...(all.get(a) || []), b])
  all.set(b, [...(all.get(b) || []), a])
  return all
}, new Map<string, string[]>())

/** The words that say this one the other way round: it negated, or turned
 * ("¬reject"), and its opposite verbs said the same way ("accept"). */
export const againstOf = (word: string) => {
  const negated = word.startsWith('¬')
  const plain = negated ? word.slice(1) : word
  return [
    turned(word),
    ...(OPPOSITES.get(plain) || []).map((one) => (negated ? `¬${one}` : one))
  ]
}

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
