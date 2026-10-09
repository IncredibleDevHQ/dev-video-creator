import { expect, it } from 'vitest'
import { agentStopped } from './notebook-chat'
import { HarnessStageError } from './generation-errors'
import { Refusal } from './refusal'

// A route that waits for the agent says what stopped it in the studio's
// words, as background work does (review 6, ENG-1).
it('says an agent’s failure plainly, and leaves the studio’s own faults as they are', () => {
  const signedOut = new HarnessStageError(
    { category: 'auth', message: 'raw provider text' } as never,
    'fallback'
  )
  const said = agentStopped(signedOut, 'Could not answer. Try again.')
  expect(said).toBeInstanceOf(Refusal)
  expect(said!.message).toContain('sign-in is required')
  expect(said!.message).not.toContain('raw provider text')
  const refused = new Refusal('Finish reading the source first')
  expect(agentStopped(refused, 'x')).toBe(refused)
  expect(agentStopped(new Error('a bug'), 'x')).toBeNull()
})
