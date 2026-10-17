/**
 * A request the studio refuses with words meant for the creator ("That
 * folder is not a git repo"). The new routes pass its message through; any
 * other error stays the server's generic reply.
 */
export class Refusal extends Error {}

/** Work whose errors are the creator's to read, such as a shared validator's. */
export const asRefusal = <T>(work: () => T): T => {
  try {
    return work()
  } catch (error) {
    if (error instanceof Refusal) throw error
    throw new Refusal(error instanceof Error ? error.message : String(error))
  }
}
