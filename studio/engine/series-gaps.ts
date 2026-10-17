// A plan's gaps checked against the cards after planning: a gap whose
// missing material a card already says is marked with that card and its
// words, so the creator can close it with the card in one step (review 8:
// the planner asked for what the idempotency card's script already said).
// A word check, tuned to mark rather than drop: a marked gap stays open.
import { againstOf, polarWords, sentencesOf } from './card-words'

/** A card as the planner reads it (series-plan.ts `cardsOf`). */
export type GapCard = {
  id: string
  idea?: string
  script?: string
  evidence?: string[]
  shows?: string[]
  answers?: string[]
}
/** A card that may already say what a gap calls missing, in its words. */
export type Covered = { page: string; says: string }

type Passage = { sentences: string[] }

/** Words that ask, or name what is still to settle: such a passage names
 * the gap, it doesn't fill it ("How long should a key live?", "the copy
 * still in progress needs an explicit response policy that we have to
 * choose"). */
const OPEN =
  /\?|\b(?:questions?|still open|unanswered|open question|to choose|to decide|to be decided|tbd|not yet known|we don['’]t know|unknown|needs? an? (?:\w+ ){0,2}(?:policy|decision|answer|choice))\b/i
/** What a "why" gap needs to be answered: a reason. */
const REASON =
  /\b(?:because|since|so that|otherwise|or else|to avoid|to prevent|which would|that would|that['’]s why|the reason)\b|,\s*so\b/i
/** What a "how" gap needs to be answered: a method. */
const METHOD = /\b(?:by|using|via|through|step|steps|first|then)\b|:\s*\w/i
/** What a "how long", "how many" or "how often" gap needs: a quantity. */
const QUANTITY =
  /\d|\b(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|once|twice|times)\b/i

/** Where a card says something: its idea, each sentence of its script with
 * the one after it, each line of evidence, each answer, and each label drawn
 * on it, on its own: labels run together say nothing. A passage that asks or
 * names what is still to settle is left out. */
const passagesOf = (card: GapCard): Passage[] => {
  const script = sentencesOf(card.script || '')
  const plain = (sentence: string) => !OPEN.test(sentence)
  return [
    ...[card.idea, ...(card.evidence || []), ...(card.answers || [])]
      .filter((text): text is string => Boolean(text))
      .flatMap(sentencesOf)
      .filter(plain)
      .map((sentence) => ({ sentences: [sentence] })),
    ...script
      .map((sentence, at) => script.slice(at, at + 2).filter(plain))
      .filter((sentences) => sentences.length)
      .map((sentences) => ({ sentences })),
    ...(card.shows || []).filter(plain).map((label) => ({ sentences: [label] }))
  ]
}

const pairs = (words: string[]) =>
  new Set(words.slice(1).map((word, at) => `${words[at]} ${word}`))

/** A short sentence whole; of a long one, the clause that holds most of
 * what is wanted, when it can stand alone. */
const clauseOf = (sentence: string, wanted: Set<string>) => {
  if (sentence.length <= 140) return sentence.replace(/[.!?]+$/, '')
  const met = (text: string) =>
    polarWords(text).filter((word) => wanted.has(word)).length
  const best = sentence
    .split(/\s*[,;:]\s+|\s+[—–]\s+/)
    .map((clause) =>
      clause
        .replace(/^(?:while|whereas|and|but|so|then|which|because)\s+/i, '')
        .replace(/[.!?]+$/, '')
    )
    .reduce((one, other) => (met(other) > met(one) ? other : one))
  const said = best.split(/\s+/).length >= 4 ? best : sentence
  return said.length > 200 ? `${said.slice(0, 199).trimEnd()}…` : said
}

/** What a gap asks for, by how it begins: a reason, a method, a quantity,
 * or the thing itself. */
const askOf = (missing: string) => {
  const start = missing.trim().toLowerCase()
  if (/^why\b/.test(start)) return REASON
  if (/^how (?:long|many|much|often|far|big|large|soon)\b/.test(start))
    return QUANTITY
  if (/^how\b/.test(start)) return METHOD
  return null
}

/**
 * The card that already says what a gap calls missing, and its words, or
 * null. Most of the gap's content words must sit in one passage, two of its
 * word pairs with them (or one, when nearly all of its words do): a card
 * that only names a thing doesn't cover a gap about it. A "why" gap needs a
 * reason in those words, a "how" gap a method, a "how long" gap a quantity.
 * A word must be said the same way round: a negated one ("never rejects")
 * meets only a negated one, and a passage saying any of the gap's words the
 * other way round (negated, or with its opposite verb: "accepts" for
 * "rejects") is no cover. A gap of fewer than three content words
 * ("what a Durable Object is") is left to the planner. Cards in the gap's
 * episode or before it come first.
 */
export const coveredBy = (
  missing: string,
  cards: GapCard[],
  options: { episode?: number; episodeOf?: Map<string, number> } = {}
) => {
  const words = polarWords(missing)
  const wanted = new Set(words)
  if (wanted.size < 3) return null
  // The gap's own words, which a negation a word further on reaches.
  const aims = new Set(words.map((word) => word.replace(/^¬/, '')))
  const wantedPairs = pairs(words)
  const needs = askOf(missing)
  let best: { score: number; page: string; sentence: string } | null = null
  for (const card of cards) {
    const at = options.episodeOf?.get(card.id)
    const before =
      options.episode !== undefined && at !== undefined && at <= options.episode
    for (const passage of passagesOf(card)) {
      const text = passage.sentences.join(' ')
      if (needs && !needs.test(text)) continue
      const said = polarWords(text, aims)
      // A passage that says any of it the other way round ("the server
      // never rejects…" or "accepts…" for a gap on what it rejects) covers
      // none of it.
      if (said.some((word) => againstOf(word).some((one) => wanted.has(one))))
        continue
      const have = new Set(said)
      const met = [...wanted].filter((word) => have.has(word)).length
      const share = met / wanted.size
      const joined = [...pairs(said)].filter((pair) =>
        wantedPairs.has(pair)
      ).length
      if (!((joined >= 2 && share >= 0.6) || (joined >= 1 && share >= 0.8)))
        continue
      const score = share + joined / 10 + (before ? 0.5 : 0)
      if (best && score <= best.score) continue
      // The sentence of the two that says most of it is the one to quote.
      const sentence = passage.sentences.reduce((one, other) =>
        polarWords(other).filter((word) => wanted.has(word)).length >
        polarWords(one).filter((word) => wanted.has(word)).length
          ? other
          : one
      )
      best = { score, page: card.id, sentence }
    }
  }
  return best
    ? ({ page: best.page, says: clauseOf(best.sentence, wanted) } as Covered)
    : null
}

/** The plan's gaps, each one a card may already cover marked with it; the
 * episode each card went into, by number, puts the gap's own first. */
export const markCovered = <T extends { missing: string; episode?: number }>(
  gaps: T[],
  cards: GapCard[],
  episodeOf: Map<string, number> = new Map()
): Array<T & { covered?: Covered }> =>
  gaps.map((gap) => {
    const covered = coveredBy(gap.missing, cards, {
      episode: gap.episode,
      episodeOf
    })
    return covered ? { ...gap, covered } : gap
  })
