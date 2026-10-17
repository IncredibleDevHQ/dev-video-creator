// What a line the studio writes may promise: no more than the creator's
// material says. A segue, a hook, a storyboard line or a post that promises
// an outcome with never, always or ever ("an idempotency key, so a retry can
// never pour a second latte") past a limit the creator wrote, or says a
// promise word (guaranteed, forever, impossible, can't fail, 100%, every
// single time, no matter what) that the creator's own words don't say,
// goes back to its writer once, with the creator's words it goes past
// (review 8). A word check, not a model: a line that still says it after the
// rewrite is kept, and flagged for the creator to rewrite or keep.
import type { Slide } from '../shared/model'
import { contentWords, drawnWords, sentencesOf, tokensOf } from './card-words'

/** A passage of the material, where it is, and who wrote it: the creator
 * (their notes, the source, its evidence, their answers) or the studio's
 * agent (a card's idea, script and drawing). */
export type Passage = { text: string; from: string; by: 'creator' | 'card' }
/** The creator's words that limit a claim, and where they are. */
export type Limit = { says: string; from: string }
/** An absolute word a line says where the material doesn't. */
export type Overclaim = { word: string; sentence: string; limit?: Limit }

const ABSOLUTE =
  /\b(?:never(?:\s+ever)?|always|forever|for\s+good|once\s+and\s+for\s+all|guarantee[sd]?|impossible|can(?:no|['’])?t\s+(?:ever\s+)?fail|every\s+(?:single\s+)?time|no\s+matter\s+what|ever)\b|\b100\s?%/gi
/** Words that only promise: they always need the creator's own backing. */
const PROMISES = new Set([
  'guarantee',
  'forever',
  'impossible',
  'cannot fail',
  '100%',
  'every single time',
  'no matter what'
])
/** A limit the line gives itself: its absolute word is then scoped. */
const SCOPED =
  /\b(?:within|as long as|unless|only (?:if|while|when|within|until|for)|provided that|until (?:it|the \w+) expires?|before (?:it|the \w+) expires?|retention|window|expir\w*|for (?:\d+|a few|several) (?:seconds?|minutes?|hours?|days?|weeks?))\b/i
/** "Do not promise…", "we can't guarantee…": a limit, never a claim. */
const NEGATED_PROMISE =
  /\b(?:not|no|never|cannot|can['’]t|don['’]t|doesn['’]t|won['’]t|shouldn['’]t|mustn['’]t|isn['’]t|aren['’]t|without)\b[^,;:.!?]*\b(?:promis\w*|guarante\w*|claim\w*|assum\w*)/i
/** What restricts a claim: a negated promise, a lifetime, a condition. */
const RESTRICTS =
  /\b(?:only\s+(?:holds?|lasts?|keeps?|works?|while|for|as long as|within|until|when|if|covers?)|as long as|unless|expir\w*|retention|window|ttl|not\s+(?:forever|always|guaranteed|every time))\b/i
/** Words that soften what a sentence says: such a sentence backs nothing. */
const QUALIFIES =
  /\b(?:only|unless|until|as long as|within|depends?|depending|except|provided|assuming|caveat|careful|however|although|though|but|may|might|usually|typically|sometimes|rarely|often)\b/i
const NEGATES = new Set(['not', 'no', 'nor', 'without', 'cannot', 'nothing'])
/** An outcome clause: what a tool brings about ("…, so a retry never…"). */
const OUTCOME = /^(?:so|so that|which means|meaning|and|thus|that way|then)\b/i
const BRINGS =
  /\b(?:means?|makes?|keeps?|ensures?|lets?|guarantees?|stops?|prevents?|turns?|gives?)\b/i
const BY = /^(?:with|thanks to|using|once|by)\b/i
const ADVICE = new Set([
  'should',
  'must',
  'need',
  'needs',
  'have',
  'has',
  'ought',
  'shouldn’t',
  'mustn’t'
])
/** Words that frame a line rather than say what it is about. */
const FRAME = new Set(['next', 'last', 'time', 'episode', 'series', 'today'])
/** Words for one thing twice: a second latte is a duplicate. */
const TWICE = new Set(['second', 'twic', 'duplicat', 'deduplicat', 'dedup'])

const kindOf = (word: string) => {
  const said = word.toLowerCase().replace(/\s+/g, ' ')
  if (said.startsWith('never')) return 'never'
  if (said.startsWith('guarantee')) return 'guarantee'
  if (said.endsWith('fail')) return 'cannot fail'
  if (said.startsWith('100')) return '100%'
  if (said === 'every single time') return said
  if (said.startsWith('every')) return 'every time'
  if (said === 'for good' || said.startsWith('once')) return 'forever'
  return said
}

const CLAUSE = /[,;:—–()]|\s-\s/
/** The clauses of a sentence, each with where it starts. */
const clausesOf = (sentence: string) => {
  const clauses: Array<{ text: string; start: number }> = []
  let start = 0
  for (let at = 0; at <= sentence.length; at++)
    if (at === sentence.length || CLAUSE.test(sentence[at])) {
      clauses.push({ text: sentence.slice(start, at), start })
      start = at + 1
    }
  return clauses
}
/** The clause a word sits in, the one before it, and the words before it. */
const placeOf = (sentence: string, at: number) => {
  const clauses = clausesOf(sentence)
  let index = clauses.findIndex(
    (clause) => at >= clause.start && at <= clause.start + clause.text.length
  )
  // ", ever" at the end belongs to the clause it closes.
  if (index > 0 && !sentence.slice(clauses[index].start, at).trim()) index--
  const clause = clauses[index]
  return {
    clause: clause.text,
    before: sentence.slice(clause.start, at),
    previous: index > 0 ? clauses[index - 1].text : ''
  }
}
const isNegated = (before: string, kind: string) =>
  tokensOf(before)
    .slice(-6)
    .some((word) =>
      word === 'never'
        ? kind !== 'never'
        : NEGATES.has(word) || word.endsWith('n’t')
    )

type Said = { word: string; kind: string; at: number }
/**
 * The absolute words a sentence says outright: not under a negated promise
 * ("we can't promise … forever"), nor negated ("not always"). "Ever" counts
 * as "never" after a negative ("can't ever", "no retry will ever").
 */
const absolutesIn = (sentence: string): Said[] =>
  [...sentence.matchAll(ABSOLUTE)].flatMap((match) => {
    const kind = kindOf(match[0])
    const { before, clause } = placeOf(sentence, match.index!)
    if (NEGATED_PROMISE.test(before)) return []
    const scope = kind === 'ever' && !before.trim() ? clause : before
    if (kind === 'ever')
      return isNegated(scope, 'never')
        ? [{ word: match[0], kind: 'never', at: match.index! }]
        : []
    return isNegated(before, kind)
      ? []
      : [{ word: match[0], kind, at: match.index! }]
  })

/** Whether a sentence restricts what may be promised. */
const restricts = (sentence: string) =>
  NEGATED_PROMISE.test(sentence) ||
  RESTRICTS.test(sentence) ||
  [...sentence.matchAll(ABSOLUTE)].some(
    (match) =>
      kindOf(match[0]) !== 'ever' &&
      !absolutesIn(sentence).some((said) => said.at === match.index)
  )

/** What a text is about: its content words, absolutes and framing left out,
 * one thing twice said one way. */
const aboutOf = (text: string) =>
  contentWords(text.replace(ABSOLUTE, ' '))
    .filter((word) => !FRAME.has(word))
    .map((word) => (TWICE.has(word) ? 'twice' : word))
const shared = (text: string, words: Set<string>) =>
  new Set(aboutOf(text).filter((word) => words.has(word))).size
const clip = (text: string, most: number) =>
  text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text

type Sentence = {
  text: string
  from: string
  by: Passage['by']
  /** The sentences on either side, in its passage. */
  around: string
}
/** The material, sentence by sentence, each once, with its neighbours. */
const sentencesIn = (material: Passage[]) => {
  const seen = new Set<string>()
  return material.flatMap(({ text, from, by }) => {
    const all = sentencesOf(text)
    return all.flatMap((sentence, at): Sentence[] => {
      const key = sentence.toLowerCase().replace(/\W+/g, ' ').trim()
      if (seen.has(key)) return []
      seen.add(key)
      return [
        {
          text: sentence,
          from,
          by,
          around: all.slice(Math.max(0, at - 1), at + 2).join(' ')
        }
      ]
    })
  })
}

/**
 * The creator's material for lines written about these pages: the source
 * and each note added to it since ("## Note, <date>"), then each page's
 * title, idea, script, evidence, drawn words and the creator's answers. The
 * lines the studio wrote around the pages are not material; a card's idea,
 * script and drawing are the agent's, and back no promise word.
 */
export const materialOf = (source: string, pages: Slide[]): Passage[] => {
  const parts = String(source || '').split(/\n## Note, ([^\n]+)\n/)
  const passages: Passage[] = [
    { text: parts[0].trim(), from: 'the source', by: 'creator' }
  ]
  for (let at = 1; at < parts.length; at += 2)
    passages.push({
      text: (parts[at + 1] || '').trim(),
      from: `the note of ${parts[at]}`,
      by: 'creator'
    })
  for (const page of pages) {
    const from = `the card “${page.title}”`
    // A script the creator wrote in an episode is theirs.
    const own = Boolean(page.copyOf && page.base === undefined)
    const add = (text: string | undefined, by: Passage['by']) => {
      if (text?.trim()) passages.push({ text, from, by })
    }
    for (const text of [page.title, page.idea, ...drawnWords(page.svg)])
      add(text, 'card')
    add(page.base ?? page.narration, own ? 'creator' : 'card')
    for (const text of [
      ...(page.evidence || []),
      ...(page.answers || []).map((item) => item.answer)
    ])
      add(text, 'creator')
  }
  return passages.filter((passage) => passage.text.trim())
}

/** The creator's own limits that bear on these words: sentences that
 * restrict what may be promised (a negated promise, a lifetime, a
 * condition) and share what they are about, strongest first, given in their
 * order. */
export const limitsFor = (material: Passage[], about: string, most = 6) => {
  const words = new Set(aboutOf(about))
  return sentencesIn(material)
    .map((sentence, at) => ({
      ...sentence,
      at,
      meets: shared(sentence.text, words),
      // Read with its neighbours: "Do not promise that an old retry…"
      // follows the sentence that says which key.
      near: shared(sentence.around, words)
    }))
    .filter((sentence) => sentence.near >= 2 && restricts(sentence.text))
    .sort(
      (one, other) =>
        other.meets +
        (NEGATED_PROMISE.test(other.text) ? 3 : 0) +
        (other.by === 'creator' ? 1 : 0) -
        (one.meets +
          (NEGATED_PROMISE.test(one.text) ? 3 : 0) +
          (one.by === 'creator' ? 1 : 0))
    )
    .slice(0, most)
    .sort((one, other) => one.at - other.at)
    .map(({ text, from }): Limit => ({ says: clip(text, 240), from }))
}

/** The restriction a claim goes past: one sharing its subject, read with
 * its neighbours, the creator's negated promise first. */
const limitOf = (
  sources: Sentence[],
  subject: Set<string>,
  kind: string,
  least: number
) =>
  sources
    .filter((source) => restricts(source.text))
    .map((source) => ({
      source,
      meets: shared(source.around, subject),
      score:
        shared(source.text, subject) +
        (NEGATED_PROMISE.test(source.text) ? 1 : 0) +
        (new RegExp(`\\b${kind}`, 'i').test(source.text) ? 1 : 0) +
        (source.by === 'creator' ? 2 : 0)
    }))
    .filter((item) => item.meets >= least)
    .sort((one, other) => other.score - one.score)[0]?.source

/**
 * The absolute words a written text says where the material doesn't, each
 * with its sentence and the creator's words it goes past, when found.
 * - A promise word needs backing: a sentence of the creator's own (not a
 *   card's) that says it outright about two of the same things.
 * - "Never", "always", "every time" or "ever" counts only where it promises
 *   an outcome ("…, so a retry can never…", "…means it never will") and
 *   goes past a limit the creator wrote on the same thing; advice ("never
 *   hammer a struggling server") and a story line are no promise.
 * - A line that gives its own limit ("within the key's retention window")
 *   promises nothing more; a sentence that limits backs nothing.
 */
export const overclaims = (text: string, material: Passage[]) => {
  const sources = sentencesIn(material)
  const found: Overclaim[] = []
  for (const sentence of sentencesOf(text)) {
    if (SCOPED.test(sentence)) continue
    for (const said of absolutesIn(sentence)) {
      const { clause, before, previous } = placeOf(sentence, said.at)
      const head = tokensOf(before)
      const promise = PROMISES.has(said.kind)
      // Advice: "Never trust…", "should always…".
      if (!promise && !head.length) continue
      if (head.slice(-2).some((word) => ADVICE.has(word))) continue
      const outcome = OUTCOME.test(clause.trim()) || BY.test(previous.trim())
      if (!promise && !outcome && !BRINGS.test(before)) continue
      const subject = new Set(aboutOf(`${outcome ? previous : ''} ${clause}`))
      const need = Math.min(2, subject.size)
      const backed = sources.some(
        (source) =>
          (promise ? source.by === 'creator' : true) &&
          !restricts(source.text) &&
          !QUALIFIES.test(source.text) &&
          absolutesIn(source.text).some((one) => one.kind === said.kind) &&
          shared(source.text, subject) >= need
      )
      if (backed) continue
      const limit = limitOf(sources, subject, said.kind, Math.max(1, need))
      if (!limit && !promise) continue
      found.push({
        word: said.word,
        sentence,
        ...(limit
          ? { limit: { says: clip(limit.text, 240), from: limit.from } }
          : {})
      })
      break
    }
  }
  return found
}

/** What the writer is told: where, the word, and the words it goes past. */
export const claimProblem = (where: string, claim: Overclaim) =>
  `${where} says “${claim.word}”, which the pages and the creator’s notes don’t promise${claim.limit ? `; ${claim.limit.from} says: “${claim.limit.says}”` : ''}. Keep to what they say, within its limit, or leave the promise out`

/** What the creator reads beside a line still flagged after its rewrite. */
export const claimNote = (claim: Overclaim) =>
  claim.limit
    ? `It says “${claim.word}”; ${claim.limit.from} says “${claim.limit.says}”`
    : `It says “${claim.word}”, which your own words don’t say`

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
