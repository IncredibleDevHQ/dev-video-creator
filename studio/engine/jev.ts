// Jev, TypeSafe's System One classifier: a block of state and typed
// questions in, calibrated probabilities out, never text. The studio asks it
// its categorical questions (which template, which direction, what the
// source holds, which beat a page carries). The key is read from the
// engine's environment only; without it, nothing is asked.

export type JevQuestion =
  | {
      type: 'noul'
      instructions: string
      criteria?: { true: string; false: string }
    }
  | {
      type: 'choice'
      instructions: string
      criteria: Record<string, string | null>
    }
  | { type: 'score'; instructions: string; criteria: string[] }

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | {
      type: 'choice'
      choice: string
      probabilities: Record<string, number>
      confidence: number
    }
  | {
      type: 'score'
      score: number
      legend: Record<string, string>
      probabilities: Record<string, number>
      confidence: number
    }

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

export const jevConfigured = () => Boolean(process.env.TYPESAFE_API_KEY?.trim())

/**
 * Asks Jev, retrying a rate limit (429) or an overload (529) with backoff.
 * Throws without a key, on a refused request, or after the last retry.
 */
export const askJev = async (
  state: unknown,
  questions: Record<string, JevQuestion>,
  options: { retries?: number; pause?: number } = {}
): Promise<Record<string, JevAnswer>> => {
  const key = process.env.TYPESAFE_API_KEY?.trim()
  if (!key) throw new Error('Jev is not set up: add TYPESAFE_API_KEY to .env')
  const retries = options.retries ?? 3
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ model: 'jev-latest', state, questions }),
      signal: AbortSignal.timeout(60_000)
    })
    if (
      (response.status === 429 || response.status === 529) &&
      attempt < retries
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, (options.pause ?? 1000) * 2 ** attempt)
      )
      continue
    }
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'Jev refused the key'
          : `Jev could not answer (${response.status})`
      )
    const body = (await response.json()) as {
      answers?: Record<string, JevAnswer>
    }
    return body.answers || {}
  }
}
