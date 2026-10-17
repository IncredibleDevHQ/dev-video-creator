// A plan's gaps checked against the cards after planning: a gap whose
// missing material a card already says is marked with that card and its
// words, so the creator can close it with the card in one step (review 8:
// the planner asked for what the idempotency card's script already said).
// A word check, tuned to mark rather than drop: a marked gap stays open.
import { contentWords, sentencesOf } from './card-words'

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

/** Where a card says something: its idea, each sentence of its script with
 * the one after it, each line of evidence, each answer, the words drawn on it. */
const passagesOf = (card: GapCard): Passage[] => {
  const script = sentencesOf(card.script || '')
  return [
    ...[card.idea, ...(card.evidence || []), ...(card.answers || [])]
      .filter((text): text is string => Boolean(text))
      .flatMap(sentencesOf)
      .map((sentence) => ({ sentences: [sentence] })),
    ...script.map((sentence, at) => ({
      sentences: script.slice(at, at + 2)
    })),
    ...(card.shows?.length ? [{ sentences: [card.shows.join('. ')] }] : [])
  ]
}

const pairs = (words: string[]) =>
  new Set(words.slice(1).map((word, at) => `${words[at]} ${word}`))

/** The clause of a sentence that holds most of what is wanted, when it can
 * stand alone; else the sentence. */
const clauseOf = (sentence: string, wanted: Set<string>) => {
  const met = (text: string) =>
    contentWords(text).filter((word) => wanted.has(word)).length
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

/**
 * The card that already says what a gap calls missing, and its words, or
 * null. Most of the gap's content words must sit in one passage, two of its
 * word pairs with them (or one, when nearly all of its words do): a card
 * that only names a thing doesn't cover a gap about it. A gap of fewer than
 * three content words ("what a Durable Object is") is left to the planner.
 */
export const coveredBy = (missing: string, cards: GapCard[]) => {
  const words = contentWords(missing)
  const wanted = new Set(words)
  if (wanted.size < 3) return null
  const wantedPairs = pairs(words)
  let best: { score: number; page: string; sentence: string } | null = null
  for (const card of cards)
    for (const passage of passagesOf(card)) {
      const said = contentWords(passage.sentences.join(' '))
      const have = new Set(said)
      const met = [...wanted].filter((word) => have.has(word)).length
      const share = met / wanted.size
      const joined = [...pairs(said)].filter((pair) =>
        wantedPairs.has(pair)
      ).length
      if (!((joined >= 2 && share >= 0.6) || (joined >= 1 && share >= 0.8)))
        continue
      const score = share + joined / 10
      if (best && score <= best.score) continue
      // The sentence of the two that says most of it is the one to quote.
      const sentence = passage.sentences.reduce((one, other) =>
        contentWords(other).filter((word) => wanted.has(word)).length >
        contentWords(one).filter((word) => wanted.has(word)).length
          ? other
          : one
      )
      best = { score, page: card.id, sentence }
    }
  return best
    ? ({ page: best.page, says: clauseOf(best.sentence, wanted) } as Covered)
    : null
}

/** The plan's gaps, each one a card may already cover marked with it. */
export const markCovered = <T extends { missing: string }>(
  gaps: T[],
  cards: GapCard[]
): Array<T & { covered?: Covered }> =>
  gaps.map((gap) => {
    const covered = coveredBy(gap.missing, cards)
    return covered ? { ...gap, covered } : gap
  })
