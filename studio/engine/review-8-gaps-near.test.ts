import { describe, expect, it } from 'vitest'
import { coveredBy, markCovered, type GapCard } from './series-gaps'
// Review 8, F09, round 1: the covered-gap check on the live run's own cards
// and the audit's near misses: a card that asks a question or names what is
// still to choose doesn't answer it; a "why" gap needs a reason, a "how"
// gap a method, a "how long" gap a quantity; drawn labels are matched and
// quoted one by one; a card in the gap's episode or before it comes first.
// A word check: these prove what it reads, not what a model plans.

const key: GapCard = {
  id: 'key',
  idea: 'The client reuses one unique key per logical order, the server matches retries against the key, a request fingerprint and the stored result, and that matching only holds while the key is retained.',
  script:
    'Our first tool is an idempotency key. Before sending the latte order, the client creates a unique key for it and reuses that same key on every retry of that order. The server stores the key with a fingerprint of the request and the result. A retry with the same key and the same request gets the original result back, while the same key carrying a different order is rejected, and a genuinely new purchase gets a new key. One caveat: the server only keeps that key for a retention window.',
  evidence: [
    'Same key with a different order should be rejected instead of quietly reusing the first result.'
  ],
  shows: [
    'Idempotency key',
    'One key per order,',
    'reused on retry',
    'Stored key record',
    'Same key, new order',
    'Reject: don’t reuse the first result'
  ]
}
const race: GapCard = {
  id: 'race',
  script:
    'Two copies of the same latte order can arrive at the same moment, and if we check for the key and then insert it, both copies can pass the check. A unique constraint plus an atomic transaction makes one request the winner, and the copy still in progress needs an explicit response policy that we have to choose. Keep it small, though: this doesn’t give us universal exactly-once delivery.'
}
const retry: GapCard = {
  id: 'retry',
  idea: 'The client retries only transient failures, with capped exponential backoff, jitter, Retry-After and a deadline, so recovery doesn’t overload the server.',
  evidence: [
    'Retry transient failures with capped exponential backoff and random jitter, and respect Retry-After when the service provides it.'
  ]
}
const questions: GapCard = {
  id: 'questions',
  script:
    'This approach left two questions open. How long should an idempotency key live? The second question is still open: what happens if charging the card for that latte sits outside the database transaction?',
  evidence: [
    'Questions I still have: how long should a key live, and what happens if charging a card is outside the database transaction?'
  ]
}
const cards = [key, race, retry, questions]

it('still marks the review’s own gap with the idempotency card’s words', () => {
  expect(
    coveredBy(
      'What the server does when the same key arrives with a different order',
      cards
    )
  ).toEqual({
    page: 'key',
    says: 'the same key carrying a different order is rejected'
  })
})

describe('the audit’s near misses', () => {
  it.each([
    // A card that asks the question, or names what is still to choose.
    'Which explicit response policy the copy still in progress gets',
    'The explicit response policy for a copy still in progress',
    'How long an idempotency key should live',
    'What happens if charging the card sits outside the database transaction',
    // A card that says it, not why, how or how long.
    'Why the same key with a different order must be rejected rather than replayed',
    'Why a unique constraint does not give universal exactly-once delivery',
    'How long the server keeps the key in its retention window',
    'How random jitter is added to the exponential backoff',
    // A card that names a part of it only.
    'What status code the server returns when the same key arrives with a different order',
    'What cap and base delay the capped exponential backoff uses'
  ])('leaves “%s” open', (missing) => {
    expect(coveredBy(missing, cards)).toBeNull()
  })
})

// Round 2's audit: "the server never rejects…" counted as covering a gap on
// what it rejects; the small words, never and not among them, were dropped.
describe('a card that says it the other way round', () => {
  const REJECTS =
    'The server rejects a reused key that carries a different order'
  it.each([
    'The server never rejects a reused key that carries a different order.',
    'The server doesn’t reject a reused key that carries a different order; it replays the first result.',
    'A reused key that carries a different order is not rejected by the server.',
    'Retries are cheap. The server cannot reject a reused key that carries a different order.',
    'No server rejects a reused key that carries a different order.'
  ])('leaves the gap open against “%s”', (script) => {
    expect(coveredBy(REJECTS, [{ id: 'card', script }])).toBeNull()
  })

  it('still marks a card that says it, its negation elsewhere, or negated as the gap is', () => {
    expect(
      coveredBy(REJECTS, [
        {
          id: 'card',
          script:
            'The server rejects a reused key that carries a different order, and never replays the first result.'
        }
      ])
    ).toMatchObject({ page: 'card' })
    expect(
      coveredBy(
        'Why the server never reuses the first result for a different order',
        [
          {
            id: 'card',
            script:
              'The server never reuses the first result for a different order, because the request fingerprint differs.'
          }
        ]
      )
    ).toMatchObject({ page: 'card' })
  })
})

it('reads the labels drawn on a card one by one, never run together', () => {
  // Run together, these labels said "key … reused … order"; one by one,
  // none says what is missing.
  const drawn: GapCard = { id: 'drawn', shows: key.shows }
  expect(
    coveredBy('The server rejecting a key reused for a new order', [drawn])
  ).toBeNull()
  // One label that says it is quoted as it is drawn.
  expect(
    coveredBy('Reject the first result and don’t reuse it', [drawn])
  ).toEqual({ page: 'drawn', says: 'Reject: don’t reuse the first result' })
})

it('puts a card in the gap’s episode or before it first', () => {
  const later: GapCard = {
    id: 'later',
    script:
      'Same key with a different order should be rejected instead of quietly reusing the first result.'
  }
  const earlier: GapCard = { ...later, id: 'earlier' }
  const [gap] = markCovered(
    [
      {
        id: 'g',
        missing: 'Rejecting the same key with a different order',
        episode: 2
      }
    ],
    [later, earlier],
    new Map([
      ['later', 4],
      ['earlier', 1]
    ])
  )
  expect(gap.covered?.page).toBe('earlier')
})

// Round 3's audit: "fails to reject", "stops rejecting", "doesnt reject"
// typed without its apostrophe, "accepts" and "does not, in this case,
// reject" each still covered a gap on what the server rejects.
describe('a card that says it the other way round, as round 3’s audit found', () => {
  const SHORT = 'The server rejects a reused key'
  const LONG = 'The server rejects a reused key that carries a different order'
  it.each([
    'The server fails to reject a reused key that carries a different order.',
    'The server stops rejecting a reused key that carries a different order.',
    'The server doesnt reject a reused key that carries a different order.',
    'The server dont reject a reused key that carries a different order.',
    'The server isnt rejecting a reused key that carries a different order.',
    'The server no longer rejects a reused key that carries a different order.',
    'The server hardly ever rejects a reused key that carries a different order.',
    'The server does not, in this case, reject a reused key that carries a different order.',
    'The server never in practice rejects a reused key that carries a different order.',
    'The server doesn’t always reject a reused key that carries a different order.',
    'The server accepts a reused key that carries a different order.'
  ])('leaves the gap open against “%s”', (script) => {
    expect(coveredBy(LONG, [{ id: 'card', script }])).toBeNull()
    expect(coveredBy(SHORT, [{ id: 'card', script }])).toBeNull()
  })

  it('reads the gap’s own “no longer” or “doesn’t always” as a negation', () => {
    const card: GapCard = {
      id: 'card',
      script: 'After expiry, the server rejects a reused key from an old order.'
    }
    for (const missing of [
      'After expiry, the server no longer rejects a reused key from an old order',
      'After expiry, the server doesn’t always reject a reused key from an old order'
    ])
      expect(coveredBy(missing, [card]), missing).toBeNull()
    expect(
      coveredBy(
        'After expiry, the server rejects a reused key from an old order',
        [card]
      )
    ).toMatchObject({ page: 'card' })
  })

  it('reads an opposite verb either way round, and when both are negated', () => {
    expect(
      coveredBy('The server accepts a retry with the same key and request', [
        {
          id: 'card',
          script:
            'The server rejects a retry with the same key and the same request.'
        }
      ])
    ).toBeNull()
    expect(
      coveredBy('Why the server does not accept a key reused for a new order', [
        {
          id: 'card',
          script:
            'The server does not reject a key reused for a new order, because the fingerprint matches.'
        }
      ])
    ).toBeNull()
  })

  it.each([
    'The server rejects a reused key that carries a different order.',
    'The server, in this case, rejects a reused key that carries a different order.',
    'Not surprisingly, the server rejects a reused key that carries a different order.',
    'Without fail, the server rejects a reused key that carries a different order.',
    'The client never retries blindly, so the server rejects a reused key that carries a different order.',
    'The server rejects a reused key that carries a different order; it does not, in this case, replay the first result.',
    'The server rejects a reused key that carries a different order and doesnt replay the first result.'
  ])('still marks a card that says it: “%s”', (script) => {
    expect(coveredBy(LONG, [{ id: 'card', script }])).toMatchObject({
      page: 'card'
    })
  })
})
