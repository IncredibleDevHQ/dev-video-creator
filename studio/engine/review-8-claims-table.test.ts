import { describe, expect, it } from 'vitest'
import type { Slide } from '../shared/model'
import { limitsFor, materialOf, overclaims } from './claims'
// Review 8, F10, round 1: the claim check on the live run's own material
// (the learning log and its note as the creator wrote them, the two cards
// the outro and the post stand between) and on the audit's tables of
// rewordings and plain story lines. A word check: these prove what it reads,
// not what a model would write.

const NOTE =
  'New learning: the retention window is part of the idempotency contract. Keep a key long enough to cover the documented client retry window. After expiry, the same key may be treated as a new request. Do not promise that an old retry will be deduplicated forever. I want this caveat included in the series.'
const LOG = `# Learning log: APIs that survive retries

## Today: a timeout is ambiguous
A client sends POST /orders and waits. The server might commit the order, but the response can get lost. A timeout tells the client that it did not receive a response; it does not prove the order failed. Retrying the same POST can create two orders. My example is a coffee order: one click should mean one latte, even if Wi-Fi drops.

## First tool: an idempotency key
The client creates a unique key for one logical order and reuses it when retrying that order. The server stores the key with a fingerprint of the request and the result. Same key and same request should return the original result. Same key with a different order should be rejected instead of quietly reusing the first result. A new intended purchase gets a new key.

## The database race
Two copies of the same request may arrive at the same time. Checking for a key and then inserting it is not enough: both requests can pass the check. A unique constraint plus an atomic transaction can make one request the winner. Keep the example small; do not claim this gives universal exactly-once delivery.

## Retry responsibly
Retry transient failures with capped exponential backoff and random jitter, and respect Retry-After when the service provides it. Do not retry every validation error. The goal is to recover without making a struggling server busier.`
const SOURCE = `${LOG}\n\n## Note, 17 October 2026\n\n${NOTE}`
const timeout: Slide = {
  id: 'timeout',
  title: 'A timeout is ambiguous',
  svg: '<svg><text>Lost response</text><text>never reaches the client</text></svg>',
  idea: 'A timeout only means no response arrived; the order may already be committed, so a blind retry can create a second order.',
  narration:
    'Our client sends POST /orders for one latte and waits. The server commits the order, but its response gets lost on the way back. All the timeout tells the client is that no answer arrived; it doesn’t prove the order failed. If the client simply sends the same POST again, one click can turn into two lattes.',
  evidence: [
    'A timeout tells the client that it did not receive a response; it does not prove the order failed.'
  ]
}
const key: Slide = {
  id: 'key',
  title: 'First tool: an idempotency key',
  svg: '<svg><text>Same key, new order</text><text>Old retries: no dedup forever</text></svg>',
  idea: 'The client reuses one unique key per logical order, the server matches retries against the key, a request fingerprint and the stored result, and that matching only holds while the key is retained.',
  narration:
    'Our first tool is an idempotency key. Before sending the latte order, the client creates a unique key for it and reuses that same key on every retry of that order. The server stores the key with a fingerprint of the request and the result. A retry with the same key and the same request gets the original result back, while the same key carrying a different order is rejected, and a genuinely new purchase gets a new key. One caveat: the server only keeps that key for a retention window. After expiry, the same key may be treated as a new request, so we can’t promise that an old retry will be deduplicated forever.'
}
const material = materialOf(SOURCE, [timeout, key])
const OUTRO =
  'Next time, in Give the latte a name, we reach for our first tool: an idempotency key, so a retry can never pour a second latte.'
const said = (line: string, from = material) => overclaims(line, from)

describe('the review’s own note', () => {
  it('backs no promise it forbids: “deduplicated forever” is flagged against it, word for word', () => {
    for (const line of [
      'Next time: an idempotency key, so an old retry is deduplicated forever.',
      'Next time: an idempotency key, so an old retry will be deduplicated forever.',
      'Next time, the key that keeps every retry deduplicated forever.',
      'Next time: an idempotency key, so a retry is safe forever.'
    ])
      for (const from of [material, materialOf(SOURCE, [])])
        expect(said(line, from), line).toMatchObject([
          {
            word: 'forever',
            limit: {
              from: 'the note of 17 October 2026',
              says: 'Do not promise that an old retry will be deduplicated forever.'
            }
          }
        ])
  })

  it('flags the live run’s outro and LinkedIn line against the note, and lets them be without it', () => {
    const post =
      'Next episode, I reach for the first tool: an idempotency key, so a retry can never pour a second latte.'
    for (const line of [OUTRO, post])
      expect(said(line)).toMatchObject([
        {
          word: 'never',
          limit: {
            from: 'the note of 17 October 2026',
            says: 'Do not promise that an old retry will be deduplicated forever.'
          }
        }
      ])
    // No limit written, no limit gone past: "never" alone is the writer's.
    expect(said(OUTRO, materialOf(LOG, []))).toEqual([])
  })

  it('gives the writers the creator’s restrictions, not every “but” or “may”', () => {
    const limits = limitsFor(material, `${key.title} ${key.narration}`)
    expect(limits).toContainEqual({
      from: 'the note of 17 October 2026',
      says: 'Do not promise that an old retry will be deduplicated forever.'
    })
    expect(limits.map((limit) => limit.says).join(' ')).not.toContain(
      'The server might commit the order'
    )
  })
})

describe('the audit’s rewordings of the same promise', () => {
  it.each([
    'Next time: an idempotency key, so a retry will never create a second latte.',
    'Next time: an idempotency key, so retrying is always safe.',
    'Next time, an idempotency key guarantees one click means one latte.',
    'Next time, an idempotency key makes a duplicate latte impossible.',
    'Next time: the idempotency key, so every retry returns the first result forever.',
    'Next time: an idempotency key, so a retry can’t ever pour a second latte.',
    'Next time: an idempotency key, and no retry will ever pour a second latte.',
    'Next time: an idempotency key, so a retry won’t pour a second latte, ever.',
    'Next time: an idempotency key, so one click is one latte, every single time.',
    'Next time: an idempotency key, so one click is one latte no matter what.',
    'Next time, during checkout, an idempotency key means a retry can never pour a second latte.',
    'Until now a retry could pour two lattes; next time an idempotency key means it never will.',
    'Next time: an idempotency key, the end of duplicate lattes for good.',
    'Next time: an idempotency key, so a retry can never charge you twice.'
  ])('flags “%s”', (line) => {
    expect(said(line)).toHaveLength(1)
  })
})

describe('plain story lines with never or always', () => {
  it.each([
    'It starts with a single request that never hears back.',
    'A timeout never proves the order failed.',
    'Next time: why the client should never retry a validation error.',
    'The client always reuses the same key when it retries the same order.',
    'A new purchase always gets a new key.',
    'Never trust a timeout to tell you the order failed.',
    'The server always stores the key with a fingerprint of the request.',
    'We never want one click to become two lattes.',
    'Last time, the response never came back, so the client retried.',
    'Always respect Retry-After when the service sends it.',
    'Two copies of the same order always race to the database.',
    'Retry with restraint: never hammer a struggling server.',
    'The outbox worker may publish twice, so consumers always deduplicate by event ID.',
    'A unique constraint means only one of the two copies ever wins.',
    'So what does a retry with a different order get? It never gets the first result.',
    'Same key, different order: the server always rejects it.',
    'Last time, one click became two lattes, because a timeout leaves the client unsure whether the order went through.',
    'Next time, in Two copies, one winner: what happens when two copies of the same order hit the database at once.'
  ])('lets “%s” be', (line) => {
    expect(said(line)).toEqual([])
  })

  it('lets a promise said within its limit be', () => {
    expect(
      said(
        'Next time: an idempotency key, so that within the key’s retention window a retry can never pour a second latte.'
      )
    ).toEqual([])
  })

  it('lets a line that keeps the caveat be: “we can’t promise … forever” is no promise', () => {
    expect(
      said(
        'Next time: an idempotency key, though we can’t promise an old retry is deduplicated forever.'
      )
    ).toEqual([])
  })

  it('takes advice in an outcome clause for advice, not a promise', () => {
    expect(
      said(
        'Next time: a retry policy, so the client should never retry a validation error.'
      )
    ).toEqual([])
  })
})

// Round 2's audit: the check caught the review's sentence word for word but
// not the same promise said without "so", with can't or "no retry", nor any
// sentence holding "window", "within" or "retention" anywhere.
describe('the same promise, said the ways round 2’s audit found', () => {
  const NOTE_LIMIT = {
    from: 'the note of 17 October 2026',
    says: 'Do not promise that an old retry will be deduplicated forever.'
  }
  it.each([
    'A retry with the same key never pours a second latte.',
    'A retry with the same key can’t pour a second latte.',
    'Next time: an idempotency key, so a retry can’t pour a second latte.',
    'Next time: an idempotency key, so a retry cannot pour a second latte.',
    'Next time: an idempotency key, so a retry won’t pour a second latte.',
    'Next time: an idempotency key, and no retry pours a second latte.',
    'No retry pours a second latte.',
    'Next time: no retry pours a second latte.',
    'The retention window is one detail; a retry can never pour a second latte.',
    'Within a week you will see why a retry can never pour a second latte.',
    'Retention matters, and an idempotency key means a retry can never pour a second latte.'
  ])('flags “%s” against the note', (line) => {
    expect(said(line)).toMatchObject([{ limit: NOTE_LIMIT }])
    // No limit written, no limit gone past.
    expect(said(line, materialOf(LOG, []))).toEqual([])
  })

  it.each([
    'Within the key’s retention window, a retry can never pour a second latte.',
    'A retry can never pour a second latte, as long as the server still keeps its key.',
    'Next time: an idempotency key, so that within the key’s retention window no retry pours a second latte.',
    // Can't, won't and no in story lines: no promise.
    'A timeout can’t tell the client whether the order went through.',
    'The client gets no answer, so it cannot know whether the order failed.',
    'No response came back, so the client retried.',
    'Without a key, the server can’t tell a retry from a new order.',
    'A unique constraint won’t let both copies in.',
    'Next time: an idempotency key, though we can’t promise no retry is ever deduplicated twice.'
  ])('lets “%s” be', (line) => {
    expect(said(line)).toEqual([])
  })
})

it('never takes a sentence that limits for backing, even one that says the word', () => {
  const limited = materialOf(
    'In the retention window, a retry with the same key never creates a second order.',
    []
  )
  expect(
    said(
      'Next time: an idempotency key, so a retry with the same key never creates a second order.',
      limited
    )
  ).toMatchObject([
    {
      word: 'never',
      limit: {
        says: 'In the retention window, a retry with the same key never creates a second order.'
      }
    }
  ])
})

it('takes a promise word as backed only by the creator’s own words, never a card’s', () => {
  const line =
    'Next time: retries with the same key are guaranteed to return the first result.'
  const card: Slide = {
    id: 'model',
    title: 'Retries',
    svg: '<svg/>',
    narration:
      'With the same key, retries are guaranteed to return the first result.'
  }
  expect(said(line, materialOf(LOG, [card]))).toMatchObject([
    { word: 'guaranteed' }
  ])
  expect(
    said(
      line,
      materialOf(
        `${LOG}\n\nWith the same key, retries are guaranteed to return the first result.`,
        []
      )
    )
  ).toEqual([])
})
