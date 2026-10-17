// What a line the studio writes may promise: no more than the creator's
// material says. A segue, a hook, a storyboard line or a post that promises
// an outcome absolutely (never, always, ever, can't, won't, no retry…: "an
// idempotency key, so a retry can never pour a second latte") past a limit
// the creator wrote, or promises outright what the creator said not to
// promise, or says a promise word (guaranteed, forever, impossible, can't
// fail, 100%, every single time, no matter what) that the creator's own
// words don't say, goes back to its writer once, with the creator's words it
// goes past (review 8). A word check, not a model: a line that still says it
// after the rewrite is kept, and flagged for the creator to rewrite or keep.
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

/** The absolute words. "Can't" and "won't" say never too, unless they only
 * say what can't be promised, known or told ("we can't promise…"); "no" is
 * one before what it rules out ("no retry pours…"), not in "no longer". */
const ABSOLUTE =
  /\b(?:never(?:\s+ever)?|always|forever|for\s+good|once\s+and\s+for\s+all|guarantee[sd]?|impossible|can(?:no|['’])?t\s+(?:ever\s+)?fail|every\s+(?:single\s+)?time|no\s+matter\s+what|ever|(?:can(?:no|['’])?t|can\s+not|won['’]t|will\s+not)(?=\s+(?!(?:promise|guarantee|claim|assume|say|tell|know|be\s+sure|expect)\b)[a-z])|no(?=\s+(?!(?:longer|more|need|idea|way|matter|guarantee|promise|claim|one\s+knows)\b)[a-z]))\b|\b100\s?%/gi
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
/** A limit a line states for its promise ("within the key's retention
 * window", "as long as the key is kept"): in the promise's clause or one
 * beside it, its absolute word is scoped. A word alone ("window",
 * "retention", "within a week") states no limit (round 2's audit: any such
 * sentence went unchecked). */
const STATES_SCOPE = new RegExp(
  `\\b(?:${[
    "(?:within|inside|during)\\s+(?:[\\w’']+\\s+){0,4}?(?:retention|window|ttl|lifetime|expiry|validity|period)",
    '(?:as|so) long as',
    'unless',
    'only (?:if|while|when|within|until|for|as long as)',
    'provided (?:that\\b)?',
    "while (?:the|its|that) (?:[\\w’']+\\s+){0,2}?(?:is|stays|remains) (?:kept|retained|stored|valid|alive)",
    '(?:until|before) (?:it|the \\w+|its \\w+) (?:expires?|is (?:dropped|deleted|evicted))',
    'for (?:\\d+|a few|several) (?:seconds?|minutes?|hours?|days?|weeks?|months?)'
  ].join('|')})\\b`,
  'i'
)
/** What a negated promise rules out: the words after its promise word ("Do
 * not promise that [an old retry will be deduplicated forever]"). */
const RULED_OUT = /^\s*(?:that\s+)?([^;:]+)/i
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
  // "Can't pour", "won't pour", "no retry pours": never, said another way.
  if (said === 'no' || /^(?:can|won|will)/.test(said)) return 'never'
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
/** Which clause a word of this length at this place sits in. */
const clauseAt = (sentence: string, at: number, length = 0) => {
  const clauses = clausesOf(sentence)
  let index = clauses.findIndex(
    (clause) => at >= clause.start && at <= clause.start + clause.text.length
  )
  // ", ever" or ", every single time" alone at the end belongs to the clause
  // it closes; "…: no retry pours" or "…: never hammer" is a clause of its own.
  const end = index >= 0 ? clauses[index].start + clauses[index].text.length : 0
  if (
    index > 0 &&
    !sentence.slice(clauses[index].start, at).trim() &&
    !/[a-z0-9]/i.test(sentence.slice(at + length, end))
  )
    index--
  return { clauses, index }
}
/** The clause a word sits in, the one before it, and the words before it. */
const placeOf = (sentence: string, at: number, length = 0) => {
  const { clauses, index } = clauseAt(sentence, at, length)
  const clause = clauses[index]
  return {
    clause: clause.text,
    before: sentence.slice(clause.start, at),
    previous: index > 0 ? clauses[index - 1].text : ''
  }
}
/** The limit a line states for its absolute word, in the word's clause or
 * one beside it: from the scope's first word to the clause's end, or to the
 * absolute word ("within the key's retention window"); '' when none. */
const scopeAt = (sentence: string, said: Said) => {
  const { clauses, index } = clauseAt(sentence, said.at, said.word.length)
  return clauses
    .slice(Math.max(0, index - 1), index + 2)
    .flatMap((clause) => {
      const found = STATES_SCOPE.exec(clause.text)
      if (!found) return []
      const from = clause.start + found.index
      const end = clause.start + clause.text.length
      return [
        sentence.slice(from, said.at > from && said.at < end ? said.at : end)
      ]
    })
    .join(' ')
    .replace(SCOPE_WORDS, ' ')
}
/** The words that only say a scope follows: "long" in "as long as" is no
 * word of the limit. */
const SCOPE_WORDS = /\b(?:as|so) long as\b|\bprovided\b|\binside\b/gi
/** Words that name a limit: a lifetime, an expiry, a window, a time. */
const LIMITING =
  /^(?:keep|expir|ttl|lifetim|valid|window|period|stor|evict|minut|hour|day|week|month|year|\d+)$/
/** Of those, the ones only a lifetime's limit says. */
const OWN_LIMIT = /^(?:retain|retent|expir|ttl|lifetim)/
/** A limit's words, one word for one limit: retention, retained and kept
 * are all "keep". */
const limitWords = (text: string) =>
  contentWords(text).map((word) => ({
    word: /^(?:retain|retent|kept$)/.test(word)
      ? 'keep'
      : /^expir/.test(word)
        ? 'expir'
        : TWICE.has(word)
          ? 'twice'
          : word,
    own: OWN_LIMIT.test(word)
  }))
/**
 * Whether the limit a line states is the creator's own: it shares a word
 * only a lifetime's limit says (retention, expiry, TTL), or two words, one
 * of them a limit's ("as long as the server keeps its key"). A scope of the
 * line's own ("during the launch period", "for several weeks") is none
 * (review 8, round 3's audit: any such phrase skipped the check).
 */
const keepsTo = (scope: string, caveats: Sentence[]) => {
  const theirs = new Set(
    caveats.flatMap((one) => limitWords(one.text)).map((one) => one.word)
  )
  const met = limitWords(scope).filter((one) => theirs.has(one.word))
  return (
    met.some((one) => one.own) ||
    (new Set(met.map((one) => one.word)).size >= 2 &&
      met.some((one) => LIMITING.test(one.word)))
  )
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
    const { before, clause } = placeOf(sentence, match.index!, match[0].length)
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
  /** The sentence before it, in its passage. */
  before: string
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
          around: all.slice(Math.max(0, at - 1), at + 2).join(' '),
          before: all[at - 1] || ''
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

/** What "won't" or "never" turns when it says a limit: "won't last
 * forever", "can't always". */
const NOT_FOREVER =
  /\b(?:forever|always|for\s+good|every\s+(?:single\s+)?time|guarantee[sd]?)\b/i
/** A text's content words, absolutes left out, a dedup said one way. */
const plainOf = (text: string) =>
  contentWords(text.replace(ABSOLUTE, ' ')).map((word) =>
    word === 'dedup' ? 'deduplicat' : word
  )
/** What a ruled-out promise says happens: its words after "will be", "is"
 * ("an old retry will be deduplicated forever": deduplicated). */
const predicateOf = (phrase: string) =>
  new Set(
    plainOf(
      /\b(?:will|would|shall|is|are|was|were|be|been|can|could|gets?|got|stays?|remains?)\s+(.+)$/i.exec(
        phrase
      )?.[1] || ''
    )
  )
/** What a sentence limits: its words before its verb ("Dedup depends on the
 * key's retention window": dedup), or its first word. */
const LINKS =
  /\b(?:depends?|relies|rely|holds?|lasts?|works?|only|is|are|was|were|needs?|requires?|expires?|ends?|applies|covers?|has|have|can|will|may|might|must|should)\b/i
const topicOf = (text: string) => {
  const at = text.search(LINKS)
  return at > 0 ? text.slice(0, at) : text.trim().split(/\s+/)[0] || ''
}
/** The material's negated promises, each with the words of what it rules
 * out ("Do not promise that an old retry will be deduplicated forever": old,
 * retry, twice), how many a line must share, and what it denies happens
 * (deduplicated). One that names nothing ("Dedup depends on the key's
 * retention window; don't promise forever") rules out an absolute about
 * what its sentence, or the one before it, limits (round 3's audit). */
const ruledOut = (sources: Sentence[]) =>
  sources.flatMap((source) => {
    const negated = NEGATED_PROMISE.exec(source.text)
    if (!negated) return []
    const rest = source.text.slice(negated.index + negated[0].length)
    const phrase = RULED_OUT.exec(rest)?.[1] || ''
    const words = new Set(aboutOf(phrase))
    if (words.size >= 2)
      return [
        {
          source,
          words,
          least: Math.max(2, Math.ceil(words.size * 0.6)),
          denies: predicateOf(phrase)
        }
      ]
    // What it limits is what it says not to promise forever: a line that
    // says it fails ("won't be deduplicated") keeps the caveat.
    const lead = source.text.slice(0, negated.index)
    const named = words.size
      ? phrase
      : topicOf(/[a-z0-9]/i.test(lead) ? lead : source.before)
    const topic = new Set(aboutOf(named))
    return topic.size
      ? [
          {
            source,
            words: topic,
            least: Math.ceil(topic.size * 0.6),
            denies: new Set(plainOf(named))
          }
        ]
      : []
  })

/**
 * The absolute words a written text says where the material doesn't, each
 * with its sentence and the creator's words it goes past, when found.
 * - A promise word needs backing: a sentence of the creator's own (not a
 *   card's) that says it outright about two of the same things.
 * - "Never", "always", "every time", "ever", "can't", "won't" or "no …"
 *   counts only where it promises an outcome ("…, so a retry can never…",
 *   "…means it never will") and goes past a limit the creator wrote on the
 *   same thing, or promises outright what a negated promise of the material
 *   rules out ("a retry with the same key never pours a second latte"
 *   against "do not promise that an old retry will be deduplicated
 *   forever"); advice ("never hammer a struggling server") and a story line
 *   are no promise.
 * - A line that states the creator's own limit beside the word ("within the
 *   key's retention window") promises nothing more; a scope of its own
 *   ("during the launch period") is no such limit. A line that says the
 *   caveat itself ("After expiry, an old retry won't be deduplicated")
 *   denies what was ruled out: it is no claim past it. A sentence that
 *   limits backs nothing.
 */
export const overclaims = (text: string, material: Passage[]) => {
  const sources = sentencesIn(material)
  const forbids = ruledOut(sources)
  const found: Overclaim[] = []
  for (const sentence of sentencesOf(text)) {
    for (const said of absolutesIn(sentence)) {
      const { clause, before, previous } = placeOf(
        sentence,
        said.at,
        said.word.length
      )
      // The caveat said: what "won't" or "never" turns is what the creator
      // said not to promise ("after expiry, an old retry won't be
      // deduplicated"), or forever itself ("dedup won't last forever"). It
      // keeps the limit (round 3's audit: the caveat itself was flagged).
      if (said.kind === 'never' && said.word.toLowerCase() !== 'no') {
        const rest = clause.slice(before.length + said.word.length)
        const turns = plainOf(rest)[0]
        if (turns && forbids.some(({ denies }) => denies.has(turns))) continue
        if (NOT_FOREVER.test(rest)) continue
      }
      const head = tokensOf(before)
      const promise = PROMISES.has(said.kind)
      // Advice: "Never trust…", "should always…"; "No retry pours…" is none.
      if (!promise && !head.length && said.word.toLowerCase() !== 'no') continue
      if (head.slice(-2).some((word) => ADVICE.has(word))) continue
      const outcome = OUTCOME.test(clause.trim()) || BY.test(previous.trim())
      // What the material said not to promise, promised outright: it needs
      // no "so" (round 2's audit).
      const against = forbids.find(
        ({ words, least }) => shared(clause, words) >= least
      )?.source
      if (!promise && !outcome && !BRINGS.test(before) && !against) continue
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
      const limit =
        limitOf(sources, subject, said.kind, Math.max(1, need)) ?? against
      if (!limit && !promise) continue
      // A limit the line states is the creator's own, or no limit: the
      // caveats are the sentences that restrict and touch what it is about.
      const scope = scopeAt(sentence, said)
      const caveats = sources.filter(
        (source) => restricts(source.text) && shared(source.around, subject)
      )
      if (scope && keepsTo(scope, caveats)) continue
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
