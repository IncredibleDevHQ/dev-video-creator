// What a line the studio writes may promise: no more than the creator's
// material says. A segue, a cold open or a post that says never, always,
// guaranteed, forever, impossible, can't fail or 100%, where neither the
// pages nor the creator's notes say it so and the line gives no limit of its
// own, goes back to its writer once, with the creator's words it goes past
// (review 8: "so a retry can never pour a second latte", against a note on
// the key's retention window). A word check, not a model: a line that still
// says it after the rewrite is kept, and flagged for the creator.
import type { Slide } from '../shared/model'
import { contentWords, drawnWords, sentencesOf, tokensOf } from './card-words'

/** A passage of the creator's material, and where it is. */
export type Passage = { text: string; from: string }
/** The creator's words that limit a claim, and where they are. */
export type Limit = { says: string; from: string }
/** An absolute word a line says where the material doesn't. */
export type Overclaim = { word: string; sentence: string; limit?: Limit }

const ABSOLUTE =
  /\b(?:never|always|forever|guarantee[sd]?|impossible|can(?:no|['’])?t\s+fail|every\s+(?:single\s+)?time|no\s+matter\s+what)\b|\b100\s?%/gi
/** A limit the sentence gives itself: then its absolute word is scoped. */
const SCOPED =
  /\b(?:within|as long as|until|unless|only (?:if|while|when|within|until|for)|provided|during|window|retention|expir\w*|for (?:\d+|a few|several) (?:seconds?|minutes?|hours?|days?))\b/i
/** Words that qualify what a sentence says. */
const QUALIFIES =
  /\b(?:only|unless|until|as long as|within|depends?|depending|except|provided|assuming|caveat|careful|however|although|though|but|may|might|promise\w*|window|retention|expir\w*|ttl|limit\w*|at most|at least|usually|typically|sometimes|rarely|not (?:forever|always|guaranteed|safe))\b/i
const STRONG =
  /\b(?:forever|always|never|guarantee\w*|promise\w*|window|retention|expir\w*|ttl|unless|until|as long as)\b/i
const NEGATES = new Set(['not', 'no', 'nor', 'without', 'cannot', 'never'])
/** Words that only promise. "Never" and "always" are everyday words in a
 * script ("a request that never hears back"): they count when they go past
 * a limit the creator wrote. */
const PROMISES = new Set([
  'guarantee',
  'forever',
  'impossible',
  'cannot fail',
  '100%'
])

const kindOf = (word: string) => {
  const said = word.toLowerCase().replace(/\s+/g, ' ')
  if (said.startsWith('guarantee')) return 'guarantee'
  if (said.endsWith('fail')) return 'cannot fail'
  if (said.startsWith('100')) return '100%'
  if (said.startsWith('every')) return 'every time'
  return said
}
/** Whether a "not", "don't" or the like comes just before, in its clause:
 * "don't promise a retry is safe forever" keeps a limit, it isn't one. */
const negated = (sentence: string, at: number, kind: string) => {
  const clause =
    sentence
      .slice(0, at)
      .split(/[,;:—–()]/)
      .pop() || ''
  return tokensOf(clause)
    .slice(-6)
    .some((word) =>
      word === 'never'
        ? kind !== 'never'
        : NEGATES.has(word) || word.endsWith('n’t')
    )
}
/** What a sentence is about, its absolute words left out. */
const aboutOf = (text: string) => contentWords(text.replace(ABSOLUTE, ' '))
const shared = (text: string, words: Set<string>) =>
  new Set(aboutOf(text).filter((word) => words.has(word))).size
/** The absolute words a sentence says outright, by kind. */
const saidOutright = (sentence: string) =>
  [...sentence.matchAll(ABSOLUTE)]
    .filter((match) => !negated(sentence, match.index!, kindOf(match[0])))
    .map((match) => ({ word: match[0], kind: kindOf(match[0]) }))
const clip = (text: string, most: number) =>
  text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text

/** The material, sentence by sentence, each once. */
const sentencesIn = (material: Passage[]) => {
  const seen = new Set<string>()
  return material.flatMap(({ text, from }) =>
    sentencesOf(text)
      .filter((sentence) => {
        const key = sentence.toLowerCase().replace(/\W+/g, ' ').trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((sentence) => ({ text: sentence, from }))
  )
}
const limiting = (sentence: string) =>
  QUALIFIES.test(sentence) ||
  [...sentence.matchAll(ABSOLUTE)].some((match) =>
    negated(sentence, match.index!, kindOf(match[0]))
  )

/**
 * The creator's material for lines written about these pages: the source
 * and each note added to it since ("## Note, <date>"), then each page's
 * title, idea, script, evidence, drawn words and the creator's answers. The
 * lines the studio wrote around the pages are not material.
 */
export const materialOf = (source: string, pages: Slide[]): Passage[] => {
  const parts = String(source || '').split(/\n## Note, ([^\n]+)\n/)
  const passages: Passage[] = [{ text: parts[0], from: 'the source' }]
  for (let at = 1; at < parts.length; at += 2)
    passages.push({
      text: parts[at + 1] || '',
      from: `the note of ${parts[at]}`
    })
  for (const page of pages)
    for (const text of [
      page.title,
      page.idea,
      page.base ?? page.narration,
      ...(page.evidence || []),
      ...drawnWords(page.svg),
      ...(page.answers || []).map((item) => item.answer)
    ])
      if (text?.trim())
        passages.push({ text, from: `the card “${page.title}”` })
  return passages.filter((passage) => passage.text.trim())
}

/** The creator's own limits that bear on these words: sentences that
 * qualify a claim (only, unless, within, a window, "don't promise…") and
 * share what they are about, strongest first, given in their order. */
export const limitsFor = (material: Passage[], about: string, most = 6) => {
  const words = new Set(contentWords(about))
  return sentencesIn(material)
    .map((sentence, at) => ({
      ...sentence,
      at,
      meets: shared(sentence.text, words)
    }))
    .filter((sentence) => sentence.meets >= 2 && limiting(sentence.text))
    .sort(
      (one, other) =>
        other.meets +
        (STRONG.test(other.text) ? 2 : 0) -
        (one.meets + (STRONG.test(one.text) ? 2 : 0))
    )
    .slice(0, most)
    .sort((one, other) => one.at - other.at)
    .map(({ text, from }): Limit => ({ says: clip(text, 240), from }))
}

/**
 * The absolute words a written text says where the material doesn't: each
 * with its sentence and the creator's words it goes past, when found. A word
 * is backed when a sentence of the material says it too, outright, about two
 * of the same things; a sentence that gives its own limit ("within the
 * key's retention window") or says "not always" is not a claim. "Never" or
 * "always" counts only past a limit of the creator's; a promise word
 * (guaranteed, forever, impossible, can't fail, 100%) always needs backing.
 */
export const overclaims = (text: string, material: Passage[]) => {
  const sources = sentencesIn(material)
  const found: Overclaim[] = []
  for (const sentence of sentencesOf(text)) {
    if (SCOPED.test(sentence)) continue
    const words = new Set(aboutOf(sentence))
    const need = Math.min(2, words.size)
    for (const { word, kind } of saidOutright(sentence)) {
      if (found.some((item) => item.sentence === sentence)) break
      const backed = sources.some(
        (source) =>
          saidOutright(source.text).some((said) => said.kind === kind) &&
          shared(source.text, words) >= need
      )
      if (backed) continue
      const limit = sources
        .filter((source) => limiting(source.text))
        .map((source) => ({
          source,
          meets:
            shared(source.text, words) + (STRONG.test(source.text) ? 0.5 : 0)
        }))
        .filter((item) => item.meets >= Math.max(1, need))
        .sort((one, other) => other.meets - one.meets)[0]?.source
      if (!limit && !PROMISES.has(kind)) continue
      found.push({
        word,
        sentence,
        ...(limit
          ? { limit: { says: clip(limit.text, 240), from: limit.from } }
          : {})
      })
    }
  }
  return found
}

/** What the writer is told: where, the word, and the words it goes past. */
export const claimProblem = (where: string, claim: Overclaim) =>
  `${where} says “${claim.word}”, which the pages and the creator’s notes don’t promise${claim.limit ? `; ${claim.limit.from} says: “${claim.limit.says}”` : ''}. Keep to what they say, within its limit, or leave the promise out`

/** What the creator reads under a line still flagged after its rewrite. */
export const claimNote = (claim: Overclaim) =>
  claim.limit
    ? `It says “${claim.word}”; ${claim.limit.from} says “${claim.limit.says}”`
    : `It says “${claim.word}”, which the pages don’t say`

type Report<T> = {
  ok: boolean
  problems: string[]
  warnings: string[]
  value: T
}
/** A validator that sends the lines back once when they promise more than
 * the material, saying what each goes past; after that it takes them, and
 * the caller flags what is left. */
export const askOnce = <T>(
  validate: (raw: unknown) => Report<T>,
  problemsOf: (value: T) => string[]
) => {
  let asked = false
  return (raw: unknown): Report<T> => {
    const report = validate(raw)
    if (asked) return report
    const said = problemsOf(report.value)
    if (!said.length) return report
    asked = true
    return { ...report, ok: false, problems: [...report.problems, ...said] }
  }
}
